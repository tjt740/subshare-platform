import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  SetMetadata,
  createParamDecorator,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { AccountStatusService } from '../common/account-status.service';

export interface JwtUser {
  sub: number;
  email: string;
  role: 'user' | 'admin' | 'super' | 'supplier';
  permissions: string[];
}

/** Bearer Token 校验，把 payload 挂到 req.user；并校验账号未被封禁/删除 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly accounts: AccountStatusService,
  ) {}
  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const header: string = req.headers['authorization'] || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) throw new UnauthorizedException('未登录');
    let user: JwtUser;
    try {
      user = this.jwt.verify<JwtUser>(token);
    } catch {
      throw new UnauthorizedException('登录已过期，请重新登录');
    }
    // 无状态令牌兜底：封禁/删除后立即失效，而非等 7 天过期
    if (!(await this.accounts.isActive(user.sub))) {
      throw new UnauthorizedException('账号不可用，请重新登录或联系客服');
    }
    req.user = user;
    return true;
  }
}

export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

/** 角色守卫：@Roles('admin','super') */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}
  canActivate(ctx: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!roles || roles.length === 0) return true;
    const user: JwtUser | undefined = ctx.switchToHttp().getRequest().user;
    if (!user || !roles.includes(user.role)) {
      throw new ForbiddenException('没有权限执行此操作');
    }
    return true;
  }
}

export const PERM_KEY = 'perm';
/** 模块级权限点：@Perm('products')；super 全通过，admin 校验 permissions */
export const Perm = (perm: string) => SetMetadata(PERM_KEY, perm);

@Injectable()
export class PermGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}
  canActivate(ctx: ExecutionContext): boolean {
    const perm = this.reflector.getAllAndOverride<string>(PERM_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!perm) return true;
    const user: JwtUser | undefined = ctx.switchToHttp().getRequest().user;
    if (!user) throw new ForbiddenException();
    if (user.role === 'super') return true;
    if (user.role === 'admin' && (user.permissions || []).includes(perm)) {
      return true;
    }
    throw new ForbiddenException(`缺少「${perm}」模块权限，请联系超级管理员`);
  }
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtUser =>
    ctx.switchToHttp().getRequest().user,
);
