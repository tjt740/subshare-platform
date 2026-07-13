import { Injectable } from '@nestjs/common';

/**
 * 进程内 keyed 互斥锁（零依赖）
 *
 * 为什么需要它：本项目用 sql.js（内存版 SQLite，单连接），没有真正的行级锁/事务隔离。
 * 而 NestJS 里所有「读-判断-写」都跨越 await 边界，并发请求会在临界区交错，
 * 导致余额双花、席位超卖。单节点部署下，用按 key 串行化的异步锁即可彻底消除竞态。
 *
 * 用法：
 *   await lock.run(`balance:${userId}`, async () => { ...读改写... });
 *   同一 key 的回调严格排队执行，不同 key 并行。
 *
 * 注意：仅适用于单进程。多实例横向扩展时需换成 Redis 分布式锁或数据库事务 + SELECT FOR UPDATE。
 */
@Injectable()
export class KeyedLock {
  private chains = new Map<string, Promise<unknown>>();

  async run<T>(key: string, task: () => Promise<T>): Promise<T> {
    // 把新任务接在该 key 现有链条的尾部，形成串行队列。
    // 前一个无论成败都继续（避免一次失败卡死整条链）。
    const prev = this.chains.get(key) ?? Promise.resolve();
    const next = prev.then(
      () => task(),
      () => task(),
    );
    this.chains.set(key, next);
    // 清理链尾：关键是这条支链必须自己吞掉 rejection，否则 task 抛错
    // （如 BadRequestException）会变成 unhandledRejection 直接把进程打挂。
    // 真正的成败仍由返回的 next 交给调用方处理。
    next
      .catch(() => undefined)
      .then(() => {
        if (this.chains.get(key) === next) this.chains.delete(key);
      });
    return next;
  }
}
