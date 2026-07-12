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

export const MOCK_PROVIDERS = ['mock-card', 'mock-alipay', 'mock-usdt'];
export const RECHARGE_PRESETS = [10, 25, 50, 100];

/**
 * 支付模块：checkout 创建支付单，confirm 相当于 PSP webhook 回调。
 * provider=balance 时余额即时扣款；purpose=recharge 为钱包充值。
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
      const user = await this.users.findOneBy({ id: userId });
      if (!user) throw new NotFoundException();
      if (user.balance < usd) {
        throw new BadRequestException(
          `余额不足：需 $${usd.toFixed(2)}，当前 $${user.balance.toFixed(2)}，请先充值`,
        );
      }
      user.balance = Math.round((user.balance - usd) * 100) / 100;
      user.growthUsd = Math.round(((user.growthUsd ?? 0) + usd) * 100) / 100;
      await this.users.save(user);
      await this.txns.save(
        this.txns.create({
          userId,
          type: 'order_pay',
          amountUsd: -usd,
          note: `订单 ${order.orderNo} 余额支付（${order.currency} ${order.amount}）`,
        }),
      );
      const payment = await this.payments.save(
        this.payments.create({
          orderId: order.id,
          userId,
          purpose: 'order',
          provider: 'balance',
          amount: order.amount,
          currency: order.currency,
          status: 'succeeded',
        }),
      );
      order.status = 'paid';
      order.paymentStatus = 'paid';
      order.paidAt = new Date();
      await this.orders.save(order);
      await this.fulfillment.fulfill(order);
      return { paymentId: payment.id, paid: true, orderStatus: order.status };
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
      const payer = await this.users.findOneBy({ id: userId });
      if (payer) {
        payer.growthUsd =
          Math.round(((payer.growthUsd ?? 0) + toUsd(order.amount, order.currency)) * 100) / 100;
        await this.users.save(payer);
      }
      await this.fulfillment.fulfill(order);
    }
    return this.result(payment);
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
