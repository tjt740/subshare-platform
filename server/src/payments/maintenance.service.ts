import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { Notification, Order, Subscription } from '../entities';
import { FulfillmentService } from './fulfillment.service';

/**
 * 后台维护定时任务（零依赖，不引入 @nestjs/schedule）：
 * - 每 10 分钟：回收到期订阅的坑位（sweepExpired）+ 生成到期提醒 + 关闭超时未支付订单
 * 单节点用 setInterval 足够；多实例部署时应改用带分布式锁的调度器。
 */
@Injectable()
export class MaintenanceService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger('Maintenance');
  private timer: ReturnType<typeof setInterval> | null = null;

  /** 未支付订单超时关闭阈值（分钟） */
  private readonly ORDER_TTL_MIN = 60;
  /** 到期提醒提前天数 */
  private readonly REMIND_DAYS = 3;

  constructor(
    private readonly fulfillment: FulfillmentService,
    @InjectRepository(Subscription) private readonly subs: Repository<Subscription>,
    @InjectRepository(Order) private readonly orders: Repository<Order>,
    @InjectRepository(Notification) private readonly notifications: Repository<Notification>,
  ) {}

  onModuleInit() {
    // 启动后延迟 15s 跑第一次（等 DB/seed 就绪），之后每 10 分钟一轮
    setTimeout(() => void this.tick(), 15_000);
    this.timer = setInterval(() => void this.tick(), 10 * 60_000);
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  /** 跑一轮维护；也可被管理端手动触发 */
  async tick() {
    try {
      const freed = await this.fulfillment.sweepExpired();
      const reminded = await this.remindDueSoon();
      const canceled = await this.closeStaleOrders();
      if (freed || reminded || canceled) {
        this.log.log(`维护：到期回收 ${freed} · 到期提醒 ${reminded} · 超时关单 ${canceled}`);
      }
    } catch (e: any) {
      this.log.error(`维护任务出错：${e?.message || e}`);
    }
  }

  /** 到期前 N 天生成站内提醒（每个订阅同一到期周期只提醒一次） */
  private async remindDueSoon(): Promise<number> {
    const soon = await this.fulfillment.dueSoon(this.REMIND_DAYS);
    let n = 0;
    for (const sub of soon) {
      const dedupeKey = `sub_expiring:${sub.id}:${new Date(sub.expiresAt).toISOString().slice(0, 10)}`;
      const exists = await this.notifications.findOneBy({ dedupeKey });
      if (exists) continue;
      const days = Math.max(
        0,
        Math.ceil((new Date(sub.expiresAt).getTime() - Date.now()) / 86400000),
      );
      await this.notifications.save(
        this.notifications.create({
          userId: sub.userId,
          type: 'sub_expiring',
          title: '订阅即将到期',
          body: `你的一个订阅将在 ${days} 天后（${new Date(sub.expiresAt).toLocaleDateString('zh-CN')}）到期，可在「我的订阅」续费以免中断。`,
          link: '/account',
          dedupeKey,
          read: false,
        }),
      );
      n++;
    }
    return n;
  }

  /** 关闭超时未支付订单（created 且创建超过 TTL）；不涉及库存，无需锁 */
  private async closeStaleOrders(): Promise<number> {
    const cutoff = new Date(Date.now() - this.ORDER_TTL_MIN * 60_000);
    const stale = await this.orders.find({
      where: { status: 'created', createdAt: LessThan(cutoff) },
    });
    for (const o of stale) {
      o.status = 'canceled';
      o.paymentStatus = 'canceled';
      await this.orders.save(o);
    }
    return stale.length;
  }
}
