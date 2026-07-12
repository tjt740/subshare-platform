import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
  InventoryAccount,
  Order,
  OrderItem,
  Plan,
  Product,
  Slot,
  Subscription,
} from '../entities';

/**
 * 交付引擎（支持多商品订单）：
 * - 逐明细交付：首购分配坑位；同套餐有生效订阅则续费顺延
 * - 明细级 done 守卫：重试补发不会重复交付/重复顺延
 * - reissue：售后补发（换新坑位、旧坑位作废）
 */
@Injectable()
export class FulfillmentService {
  constructor(
    @InjectRepository(Order) private readonly orders: Repository<Order>,
    @InjectRepository(OrderItem)
    private readonly orderItems: Repository<OrderItem>,
    @InjectRepository(Plan) private readonly plans: Repository<Plan>,
    @InjectRepository(Product) private readonly products: Repository<Product>,
    @InjectRepository(InventoryAccount)
    private readonly accounts: Repository<InventoryAccount>,
    @InjectRepository(Slot) private readonly slots: Repository<Slot>,
    @InjectRepository(Subscription)
    private readonly subs: Repository<Subscription>,
  ) {}

  private async bumpSold(planId: number) {
    const plan = await this.plans.findOneBy({ id: planId });
    if (!plan) return;
    await this.products.increment({ id: plan.productId }, 'soldCount', 1);
  }

  /** 从健康账号池取一个空闲坑位 */
  private async pickFreeSlot(planId: number, excludeAccountId?: number) {
    const okAccounts = await this.accounts.findBy({ planId, health: 'ok' });
    const candidates = okAccounts.filter((a) => a.id !== excludeAccountId);
    const pool = candidates.length > 0 ? candidates : okAccounts;
    if (pool.length === 0) return null;
    const slot = await this.slots.findOne({
      where: { accountId: In(pool.map((a) => a.id)), status: 'free' },
      order: { id: 'ASC' },
    });
    if (!slot) return null;
    const account = pool.find((a) => a.id === slot.accountId)!;
    return { slot, account };
  }

  /** 交付整单：返回是否全部完成 */
  async fulfill(order: Order): Promise<boolean> {
    const items = await this.orderItems.findBy({
      orderId: order.id,
      status: 'pending',
    });
    let allDone = true;

    for (const item of items) {
      const plan = await this.plans.findOneBy({ id: item.planId });
      const months = plan?.periodMonths ?? 1;

      // 续费：同套餐已有生效订阅 -> 顺延
      const existing = await this.subs.findOneBy({
        userId: order.userId,
        planId: item.planId,
        status: 'active',
      });
      if (existing) {
        const base = new Date(existing.expiresAt);
        base.setMonth(base.getMonth() + months);
        existing.expiresAt = base;
        await this.subs.save(existing);
        item.status = 'done';
        await this.orderItems.save(item);
        await this.bumpSold(item.planId);
        continue;
      }

      // 首购：分配坑位
      const picked = await this.pickFreeSlot(item.planId);
      if (!picked) {
        allDone = false;
        continue;
      }
      picked.slot.status = 'assigned';
      picked.slot.orderId = order.id;
      await this.slots.save(picked.slot);

      const startsAt = new Date();
      const expiresAt = new Date(startsAt);
      expiresAt.setMonth(expiresAt.getMonth() + months);
      await this.subs.save(
        this.subs.create({
          userId: order.userId,
          orderId: order.id,
          planId: item.planId,
          slotId: picked.slot.id,
          status: 'active',
          startsAt,
          expiresAt,
          credentials: picked.account.credentials,
        }),
      );
      item.status = 'done';
      await this.orderItems.save(item);
      await this.bumpSold(item.planId);
    }

    order.status = allDone ? 'delivered' : 'allocating';
    await this.orders.save(order);
    return allDone;
  }

  /** 售后补发：换新坑位并更新凭据（旧坑位作废不复用） */
  async reissue(subscriptionId: number) {
    const sub = await this.subs.findOneBy({ id: subscriptionId });
    if (!sub) throw new BadRequestException('订阅不存在');
    if (sub.status !== 'active') {
      throw new BadRequestException('仅生效中的订阅可补发');
    }
    let oldAccountId: number | undefined;
    if (sub.slotId) {
      const oldSlot = await this.slots.findOneBy({ id: sub.slotId });
      if (oldSlot) {
        oldAccountId = oldSlot.accountId;
        oldSlot.status = 'revoked';
        oldSlot.orderId = null;
        await this.slots.save(oldSlot);
      }
    }
    const picked = await this.pickFreeSlot(sub.planId, oldAccountId);
    if (!picked) {
      throw new BadRequestException('账号池库存不足，请先补充库存再补发');
    }
    picked.slot.status = 'assigned';
    picked.slot.orderId = sub.orderId;
    await this.slots.save(picked.slot);
    sub.slotId = picked.slot.id;
    sub.credentials = picked.account.credentials;
    await this.subs.save(sub);
    return sub;
  }

  /** 退款/撤销：吊销本单订阅并回收坑位；续费项回退顺延时长 */
  async revoke(order: Order) {
    const items = await this.orderItems.findBy({ orderId: order.id });
    // 首购项：吊销 orderId 关联的订阅
    const directSubs = await this.subs.findBy({ orderId: order.id });
    for (const sub of directSubs) {
      sub.status = 'revoked';
      await this.subs.save(sub);
      if (sub.slotId) {
        const slot = await this.slots.findOneBy({ id: sub.slotId });
        if (slot) {
          slot.status = 'free';
          slot.orderId = null;
          await this.slots.save(slot);
        }
      }
    }
    // 续费项（订阅挂在原订单上）：回退顺延的时长
    const directPlanIds = new Set(directSubs.map((s) => s.planId));
    for (const item of items) {
      if (item.status !== 'done' || directPlanIds.has(item.planId)) continue;
      const sub = await this.subs.findOneBy({
        userId: order.userId,
        planId: item.planId,
        status: 'active',
      });
      if (sub) {
        const plan = await this.plans.findOneBy({ id: item.planId });
        const base = new Date(sub.expiresAt);
        base.setMonth(base.getMonth() - (plan?.periodMonths ?? 1));
        sub.expiresAt = base;
        await this.subs.save(sub);
      }
    }
  }
}
