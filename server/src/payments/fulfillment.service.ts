import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, LessThan, Repository } from 'typeorm';
import {
  InventoryAccount,
  Order,
  OrderItem,
  Plan,
  PriceBook,
  Product,
  Slot,
  SlotAssignment,
  Subscription,
  toUsd,
} from '../entities';
import { KeyedLock } from '../common/keyed-lock';

/** 全局库存锁 key：所有席位分配/回收串行，杜绝超卖（单节点内足够） */
const INV_LOCK = 'inventory:slots';

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
    @InjectRepository(PriceBook) private readonly prices: Repository<PriceBook>,
    @InjectRepository(Product) private readonly products: Repository<Product>,
    @InjectRepository(InventoryAccount)
    private readonly accounts: Repository<InventoryAccount>,
    @InjectRepository(Slot) private readonly slots: Repository<Slot>,
    @InjectRepository(SlotAssignment)
    private readonly assignments: Repository<SlotAssignment>,
    @InjectRepository(Subscription)
    private readonly subs: Repository<Subscription>,
    private readonly lock: KeyedLock,
  ) {}

  private async bumpSold(planId: number) {
    const plan = await this.plans.findOneBy({ id: planId });
    if (!plan) return;
    await this.products.increment({ id: plan.productId }, 'soldCount', 1);
  }

  private async paymentFeeUsd(item: OrderItem, region: string) {
    const row =
      (await this.prices.findOneBy({ planId: item.planId, region })) ||
      (await this.prices.findOneBy({ planId: item.planId, region: 'GLOBAL' }));
    if (!row || !row.price || !row.paymentFeeAmount) return 0;
    return Math.round(
      toUsd(item.unitPrice, item.currency) *
        (row.paymentFeeAmount / row.price) *
        100,
    ) / 100;
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

  /** 交付整单：返回是否全部完成。全程持库存锁，杜绝并发超卖 */
  async fulfill(order: Order): Promise<boolean> {
    return this.lock.run(INV_LOCK, () => this.fulfillLocked(order));
  }

  private async fulfillLocked(order: Order): Promise<boolean> {
    order.fulfillmentStatus = 'processing';
    await this.orders.save(order);
    const items = await this.orderItems.findBy({
      orderId: order.id,
      status: 'pending',
    });
    let allDone = true;

    for (const item of items) {
      const plan = await this.plans.findOneBy({ id: item.planId });
      const months = plan?.periodMonths ?? 1;
      const paymentFeeUsd = await this.paymentFeeUsd(item, order.region);

      // 续费：同套餐已有生效订阅 -> 顺延
      const existing = await this.subs.findOneBy({
        userId: order.userId,
        planId: item.planId,
        status: 'active',
      });
      if (existing) {
        const startsAt = new Date(existing.expiresAt);
        const base = new Date(startsAt);
        base.setMonth(base.getMonth() + months);
        existing.expiresAt = base;
        await this.subs.save(existing);
        if (existing.slotId) {
          const slot = await this.slots.findOneBy({ id: existing.slotId });
          if (slot) {
            await this.assignments.save(
              this.assignments.create({
                accountId: slot.accountId,
                slotId: slot.id,
                orderId: order.id,
                orderItemId: item.id,
                subscriptionId: existing.id,
                startsAt,
                endsAt: base,
                saleAmount: item.unitPrice,
                saleCurrency: item.currency,
                saleUsd: toUsd(item.unitPrice, item.currency),
                paymentFeeUsd,
                refundUsd: 0,
                status: 'active',
              }),
            );
          }
        }
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
      const subscription = await this.subs.save(
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
      await this.assignments.save(
        this.assignments.create({
          accountId: picked.account.id,
          slotId: picked.slot.id,
          orderId: order.id,
          orderItemId: item.id,
          subscriptionId: subscription.id,
          startsAt,
          endsAt: expiresAt,
          saleAmount: item.unitPrice,
          saleCurrency: item.currency,
          saleUsd: toUsd(item.unitPrice, item.currency),
          paymentFeeUsd,
          refundUsd: 0,
          status: 'active',
        }),
      );
      item.status = 'done';
      await this.orderItems.save(item);
      await this.bumpSold(item.planId);
    }

    order.status = allDone ? 'delivered' : 'allocating';
    order.fulfillmentStatus = allDone ? 'delivered' : 'partial';
    if (allDone) order.deliveredAt = new Date();
    await this.orders.save(order);
    return allDone;
  }

  /** 售后补发：换新坑位并更新凭据（旧坑位作废不复用） */
  async reissue(subscriptionId: number) {
    return this.lock.run(INV_LOCK, () => this.reissueLocked(subscriptionId));
  }

  private async reissueLocked(subscriptionId: number) {
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
    return this.lock.run(INV_LOCK, () => this.revokeLocked(order));
  }

  private async revokeLocked(order: Order) {
    const assignments = await this.assignments.findBy({ orderId: order.id });
    for (const assignment of assignments) {
      assignment.status = 'refunded';
      assignment.refundUsd = assignment.saleUsd;
      await this.assignments.save(assignment);
    }
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

  /**
   * 到期回收：把已过期的生效订阅置 expired，并把其占用的坑位释放回池（free）。
   * 由定时任务与用户打开「我的订阅」时惰性触发；持库存锁保证与分配互斥。
   * 返回本次回收的订阅数（供日志/监控）。
   */
  async sweepExpired(now = new Date()): Promise<number> {
    return this.lock.run(INV_LOCK, async () => {
      const due = await this.subs.find({
        where: { status: 'active', expiresAt: LessThan(now) },
      });
      for (const sub of due) {
        sub.status = 'expired';
        await this.subs.save(sub);
        // 关键修复：到期必须把坑位放回池子，否则库存单调泄漏
        if (sub.slotId) {
          const slot = await this.slots.findOneBy({ id: sub.slotId });
          if (slot && slot.status === 'assigned') {
            slot.status = 'free';
            slot.orderId = null;
            await this.slots.save(slot);
          }
        }
        // 关闭对应的分配记录
        const acts = await this.assignments.findBy({ subscriptionId: sub.id, status: 'active' });
        for (const a of acts) {
          a.status = 'ended';
          await this.assignments.save(a);
        }
      }
      return due.length;
    });
  }

  /** 即将到期（N 天内）的生效订阅，用于到期提醒 */
  async dueSoon(days = 3, now = new Date()) {
    const until = new Date(now.getTime() + days * 86400000);
    const rows = await this.subs.find({
      where: { status: 'active', expiresAt: LessThan(until) },
      order: { expiresAt: 'ASC' },
    });
    // 排除已过期的（那些交给 sweepExpired）
    return rows.filter((s) => new Date(s.expiresAt) >= now);
  }
}
