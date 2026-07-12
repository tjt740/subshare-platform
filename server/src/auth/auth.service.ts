import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { effectiveLevel, LEVELS, LoginLog, nextLevelAt, User } from '../entities';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(LoginLog) private readonly logs: Repository<LoginLog>,
    private readonly jwt: JwtService,
  ) {}

  private sign(user: User) {
    let permissions: string[] = [];
    try {
      permissions = JSON.parse(user.permissions || '[]');
    } catch {
      permissions = [];
    }
    return this.jwt.sign({
      sub: user.id,
      email: user.email,
      role: user.role,
      permissions,
    });
  }

  private toProfile(user: User) {
    let permissions: string[] = [];
    try {
      permissions = JSON.parse(user.permissions || '[]');
    } catch {
      permissions = [];
    }
    const level = effectiveLevel(user);
    return {
      id: user.id,
      email: user.email,
      nickname: user.nickname || '',
      avatar: user.avatar || 'sv:spark',
      avatarFrame: user.avatarFrame || 'none',
      role: user.role,
      permissions,
      balance: user.balance,
      level,
      growthUsd: Math.round((user.growthUsd ?? 0) * 100) / 100,
      nextLevelAt: nextLevelAt(level),
      levels: LEVELS,
      createdAt: user.createdAt,
    };
  }

  /** 我的登录记录（最近 20 条） */
  async loginHistory(userId: number) {
    return this.logs.find({
      where: { userId },
      order: { id: 'DESC' },
      take: 20,
    });
  }

  /** 忘记密码：签发重置令牌（演示直接返回；生产改为邮件发送链接） */
  async forgotPassword(email: string) {
    const user = await this.users.findOneBy({
      email: (email || '').trim().toLowerCase(),
    });
    // 防枚举：无论账号是否存在都返回成功
    if (!user) return { ok: true, sent: true };
    const token = `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
    user.resetToken = token;
    user.resetExpires = new Date(Date.now() + 30 * 60 * 1000); // 30 分钟
    await this.users.save(user);
    return {
      ok: true,
      sent: true,
      // 演示环境直接回传，生产环境删除此字段并改走邮件
      demoToken: process.env.NODE_ENV === 'production' ? undefined : token,
    };
  }

  /** 用令牌重置密码 */
  async resetPassword(token: string, newPassword: string) {
    const user = await this.users.findOneBy({ resetToken: token });
    if (!user || !user.resetExpires || user.resetExpires < new Date()) {
      throw new BadRequestException('重置链接无效或已过期，请重新申请');
    }
    user.passwordHash = await bcrypt.hash(newPassword, 10);
    user.resetToken = null;
    user.resetExpires = null;
    await this.users.save(user);
    return { ok: true };
  }

  /** 修改个人资料（昵称/头像/头像框；邮箱为登录账号不支持修改） */
  async updateProfile(
    userId: number,
    data: { nickname?: string; avatar?: string; avatarFrame?: string },
  ) {
    const user = await this.users.findOneBy({ id: userId });
    if (!user) throw new UnauthorizedException();
    if (data.nickname !== undefined) {
      user.nickname = data.nickname.trim().slice(0, 24);
    }
    if (data.avatar !== undefined) {
      const av = data.avatar.trim();
      // 上传头像：限制 base64 大小（约 200KB）
      if (av.startsWith('data:image/') && av.length > 280_000) {
        throw new BadRequestException('头像图片过大，请压缩到 200KB 以内');
      }
      user.avatar = av || 'sv:spark';
    }
    if (data.avatarFrame !== undefined) {
      user.avatarFrame = data.avatarFrame.trim().slice(0, 16) || 'none';
    }
    await this.users.save(user);
    return this.toProfile(user);
  }

  /** 修改密码：验证旧密码 */
  async changePassword(userId: number, oldPassword: string, newPassword: string) {
    const user = await this.users.findOneBy({ id: userId });
    if (!user) throw new UnauthorizedException();
    if (!(await bcrypt.compare(oldPassword, user.passwordHash))) {
      throw new BadRequestException('当前密码不正确');
    }
    user.passwordHash = await bcrypt.hash(newPassword, 10);
    await this.users.save(user);
    return { ok: true };
  }

  private async createAccount(
    email: string,
    password: string,
    role: User['role'],
  ) {
    const normalized = email.trim().toLowerCase();
    const exists = await this.users.findOneBy({ email: normalized });
    if (exists) throw new BadRequestException('该邮箱已注册');
    return this.users.save(
      this.users.create({
        email: normalized,
        passwordHash: await bcrypt.hash(password, 10),
        role,
      }),
    );
  }

  async register(email: string, password: string) {
    const user = await this.createAccount(email, password, 'user');
    return { token: this.sign(user), user: this.toProfile(user) };
  }

  /** 供应商入驻注册（演示为即时生效；生产可加人工审核） */
  async registerSupplier(email: string, password: string) {
    const user = await this.createAccount(email, password, 'supplier');
    return { token: this.sign(user), user: this.toProfile(user) };
  }

  async login(email: string, password: string, ip = '', ua = '') {
    const user = await this.users.findOneBy({
      email: email.trim().toLowerCase(),
    });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new UnauthorizedException('邮箱或密码错误');
    }
    if (user.status === 'banned') {
      throw new UnauthorizedException('账号已被封禁，请联系客服');
    }
    await this.logs.save(
      this.logs.create({ userId: user.id, ip, userAgent: (ua || '').slice(0, 200) }),
    );
    return { token: this.sign(user), user: this.toProfile(user) };
  }

  async me(userId: number) {
    const user = await this.users.findOneBy({ id: userId });
    if (!user) throw new UnauthorizedException();
    return this.toProfile(user);
  }
}
