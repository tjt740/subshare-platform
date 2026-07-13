import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Order,
  Payment,
  toUsd,
  User,
  WalletTransaction,
} from '../entities';
import { FulfillmentService } from './fulfillment.service';
import { KeyedLock } from '../common/keyed-lock';

export const MOCK_PROVIDERS = ['mock-card', 'mock-alipay', 'mock-usdt'];
export const RECHARGE_PRESETS = [10, 25, 50, 100];

/**
 * 支付模块：checkout 创建支付单，confirm 相当于 PSP webhook 回调。
 * provider=balance 时余额即时扣款；purpose=recharge 为钱包充值。
 *
 * 成长值口径（避免同一笔钱重复计等级）：
 * - 充值入账 → +成长值（钱进平台）
 * - 直接用 mock 通道支付订单 → +成长值（钱进平台）
 * - 用余额支付订单 → 不再加（该笔钱在充值时已计过）
 */
@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(Payment) private readonly payments: Repository<Payment>,
    @InjectRepository(Order) private readonly orders: Repository<Order>,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(WalletTransaction)
    private readonly txns: Repository<WalletTransaction>,
    private readonly fulfillment: FulfillmentService,
    private readonly lock: KeyedLock,
  ) {}

  /** 订单支付：mock 通道走收银台；balance 余额即时支付 */
  async checkout(userId: number, orderId: number, provider: string) {
    if (![...MOCK_PROVIDERS, 'balance'].includes(provider)) {
      throw new BadRequestException('不支持的支付方式');
    }
    const order = await this.orders.findOneBy({ id: orderId, userId });
    if (!order) throw new NotFoundException('订单不存在');
    if (order.status !== 'created') {
      throw new BadRequestException('订单当前状态不可支付');
    }

    if (provider === 'balance') {
      const usd = toUsd(order.amount, order.currency);
      // 按用户加锁：串行化「读余额→校验→扣减→改单→交付」，杜绝并发双花。
      // 订单则按 orderId 一并纳入同一锁语义，防同单并发重复支付。
      return this.lock.run(`pay:user:${userId}`, async () => {
        // 锁内重读订单，确认仍处可支付态（可能已被上一个排队请求支付）
        const fresh = await this.orders.findOneBy({ id: orderId, userId });
        if (!fresh) throw new NotFoundException('订单不存在');
        if (fresh.status !== 'created') {
          throw new BadRequestException('订单当前状态不可支付');
        }
        const user = await this.users.findOneBy({ id: userId });
        if (!user) throw new NotFoundException();
        if (user.balance < usd) {
          throw new BadRequestException(
            `余额不足：需 $${usd.toFixed(2)}，当前 $${user.balance.toFixed(2)}，请先充值`,
          );
        }
        user.balance = Math.round((user.balance - usd) * 100) / 100;
        // 余额支付不再加成长值：这笔钱在充值入账时已计过（避免同一笔钱重复升等级）
        await this.users.save(user);
        await this.txns.save(
          this.txns.create({
            userId,
            type: 'order_pay',
            amountUsd: -usd,
            note: `订单 ${fresh.orderNo} 余额支付（${fresh.currency} ${fresh.amount}）`,
          }),
        );
        const payment = await this.payments.save(
          this.payments.create({
            orderId: fresh.id,
            userId,
            purpose: 'order',
            provider: 'balance',
            amount: fresh.amount,
            currency: fresh.currency,
            status: 'succeeded',
          }),
        );
        fresh.status = 'paid';
        fresh.paymentStatus = 'paid';
        fresh.paidAt = new Date();
        await this.orders.save(fresh);
        await this.fulfillment.fulfill(fresh);
        return { paymentId: payment.id, paid: true, orderStatus: fresh.status };
      });
    }

    await this.payments.update(
      { orderId: order.id, status: 'pending' },
      { status: 'failed' },
    );
    const payment = await this.payments.save(
      this.payments.create({
        orderId: order.id,
        userId,
        purpose: 'order',
        provider,
        amount: order.amount,
        currency: order.currency,
        status: 'pending',
      }),
    );
    return { paymentId: payment.id, paid: false };
  }

  /** 钱包充值：创建充值支付单（USD），走 Mock 收银台 */
  async rechargeCheckout(userId: number, amountUsd: number, provider: string) {
    if (!MOCK_PROVIDERS.includes(provider)) {
      throw new BadRequestException('不支持的支付方式');
    }
    if (!RECHARGE_PRESETS.includes(amountUsd)) {
      throw new BadRequestException('不支持的充值面额');
    }
    const payment = await this.payments.save(
      this.payments.create({
        orderId: null,
        userId,
        purpose: 'recharge',
        provider,
        amount: amountUsd,
        currency: 'USD',
        status: 'pending',
      }),
    );
    return { paymentId: payment.id };
  }

  async getForUser(userId: number, paymentId: number) {
    const payment = await this.payments.findOneBy({ id: paymentId, userId });
    if (!payment) throw new NotFoundException('支付单不存在');
    let orderNo: string | null = null;
    let orderStatus: string | null = null;
    if (payment.purpose === 'order' && payment.orderId) {
      const order = await this.orders.findOneBy({ id: payment.orderId });
      orderNo = order?.orderNo ?? null;
      orderStatus = order?.status ?? null;
    }
    return {
      id: payment.id,
      purpose: payment.purpose,
      provider: payment.provider,
      amount: payment.amount,
      currency: payment.currency,
      status: payment.status,
      orderId: payment.orderId,
      orderNo,
      orderStatus,
    };
  }

  /** 模拟 PSP 回调 */
  async mockConfirm(userId: number, paymentId: number, success: boolean) {
    // 按用户加锁：防止同一支付单/同一订单的并发 confirm 造成重复入账、重复交付
    return this.lock.run(`pay:user:${userId}`, async () => {
      const payment = await this.payments.findOneBy({ id: paymentId, userId });
      if (!payment) throw new NotFoundException('支付单不存在');

      // 幂等：已终态直接返回
      if (payment.status !== 'pending') {
        return this.result(payment);
      }

      if (!success) {
        payment.status = 'failed';
        await this.payments.save(payment);
        return this.result(payment);
      }

      payment.status = 'succeeded';
      await this.payments.save(payment);

      if (payment.purpose === 'recharge') {
        const user = await this.users.findOneBy({ id: userId });
        if (user) {
          user.balance = Math.round((user.balance + payment.amount) * 100) / 100;
          // 充值入账 → 计成长值（钱进平台）
          user.growthUsd = Math.round(((user.growthUsd ?? 0) + payment.amount) * 100) / 100;
          await this.users.save(user);
          await this.txns.save(
            this.txns.create({
              userId,
              type: 'recharge',
              amountUsd: payment.amount,
              note: `钱包充值（${payment.provider}）`,
            }),
          );
        }
        return this.result(payment);
      }

      const order = await this.orders.findOneBy({
        id: payment.orderId!,
        userId,
      });
      if (order && order.status === 'created') {
        order.status = 'paid';
        order.paymentStatus = 'paid';
        order.paidAt = new Date();
        await this.orders.save(order);
        // 直接用 mock 通道支付订单 → 计成长值（这笔钱首次进平台，未经过充值）
        const payer = await this.users.findOneBy({ id: userId });
        if (payer) {
          payer.growthUsd =
            Math.round(((payer.growthUsd ?? 0) + toUsd(order.amount, order.currency)) * 100) / 100;
          await this.users.save(payer);
        }
        await this.fulfillment.fulfill(order);
      }
      return this.result(payment);
    });
  }

  private async result(payment: Payment) {
    let orderStatus: string | null = null;
    if (payment.purpose === 'order' && payment.orderId) {
      const order = await this.orders.findOneBy({ id: payment.orderId });
      orderStatus = order?.status ?? null;
    }
    return {
      paymentStatus: payment.status,
      purpose: payment.purpose,
      orderStatus,
    };
  }
}
