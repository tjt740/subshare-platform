import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { User } from '../entities';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
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
    return {
      id: user.id,
      email: user.email,
      nickname: user.nickname || '',
      avatar: user.avatar || '😀',
      role: user.role,
      permissions,
      balance: user.balance,
      createdAt: user.createdAt,
    };
  }

  /** 修改个人资料（昵称/头像；邮箱为登录账号不支持修改） */
  async updateProfile(
    userId: number,
    data: { nickname?: string; avatar?: string },
  ) {
    const user = await this.users.findOneBy({ id: userId });
    if (!user) throw new UnauthorizedException();
    if (data.nickname !== undefined) {
      user.nickname = data.nickname.trim().slice(0, 24);
    }
    if (data.avatar !== undefined) {
      user.avatar = data.avatar.trim().slice(0, 8) || '😀';
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

  async login(email: string, password: string) {
    const user = await this.users.findOneBy({
      email: email.trim().toLowerCase(),
    });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new UnauthorizedException('邮箱或密码错误');
    }
    if (user.status === 'banned') {
      throw new UnauthorizedException('账号已被封禁，请联系客服');
    }
    return { token: this.sign(user), user: this.toProfile(user) };
  }

  async me(userId: number) {
    const user = await this.users.findOneBy({ id: userId });
    if (!user) throw new UnauthorizedException();
    return this.toProfile(user);
  }
}
