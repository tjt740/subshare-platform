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

export interface JwtUser {
  sub: number;
  email: string;
  role: 'user' | 'admin' | 'super' | 'supplier';
  permissions: string[];
}

/** Bearer Token 校验，把 payload 挂到 req.user */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    const header: string = req.headers['authorization'] || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) throw new UnauthorizedException('未登录');
    try {
      req.user = this.jwt.verify<JwtUser>(token);
      return true;
    } catch {
      throw new UnauthorizedException('登录已过期，请重新登录');
    }
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
