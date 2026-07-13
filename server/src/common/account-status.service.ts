import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities';

/**
 * 账号状态校验（供 JwtAuthGuard 使用）
 *
 * 解决 P2-3：JWT 无状态，用户被封禁/删除或子管理员被收回权限后，旧令牌最长 7 天仍可用。
 * 这里在鉴权时按 sub 查库校验用户存在且未封禁。带 15 秒内存缓存，避免每请求都查库。
 */
@Injectable()
export class AccountStatusService {
  private cache = new Map<number, { banned: boolean; exists: boolean; at: number }>();
  private readonly TTL = 15_000;

  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  /** 返回 true=可放行；false=用户不存在或已封禁 */
  async isActive(userId: number): Promise<boolean> {
    const hit = this.cache.get(userId);
    const now = Date.now();
    if (hit && now - hit.at < this.TTL) {
      return hit.exists && !hit.banned;
    }
    const user = await this.users.findOne({
      where: { id: userId },
      select: { id: true, status: true },
    });
    const state = {
      exists: !!user,
      banned: user?.status === 'banned',
      at: now,
    };
    this.cache.set(userId, state);
    return state.exists && !state.banned;
  }

  /** 状态变更后主动失效缓存（封禁/改权限时调用） */
  invalidate(userId: number) {
    this.cache.delete(userId);
  }
}
