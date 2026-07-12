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
      role: user.role,
      permissions,
      balance: user.balance,
      createdAt: user.createdAt,
    };
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
