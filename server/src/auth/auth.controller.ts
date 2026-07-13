import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Request, Response } from 'express';
import {
  IsEmail,
  IsOptional,
  IsString,
  MinLength,
  MaxLength,
} from 'class-validator';
import { AuthService } from './auth.service';
import { OAuthService } from './oauth.service';
import { CurrentUser, JwtAuthGuard, JwtUser } from './auth.common';

class RegisterDto {
  @IsEmail({}, { message: '邮箱格式不正确' })
  email: string;
  @IsString()
  @MinLength(6, { message: '密码至少 6 位' })
  @MaxLength(64)
  password: string;
}

class LoginDto {
  @IsEmail({}, { message: '邮箱格式不正确' })
  email: string;
  @IsString()
  password: string;
}

class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(24)
  nickname?: string;
  @IsOptional()
  @IsString()
  @MaxLength(300000) // 支持 base64 上传头像
  avatar?: string;
  @IsOptional()
  @IsString()
  @MaxLength(16)
  avatarFrame?: string;
}

class ChangePasswordDto {
  @IsString()
  oldPassword: string;
  @IsString()
  @MinLength(6, { message: '新密码至少 6 位' })
  @MaxLength(64)
  newPassword: string;
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly oauth: OAuthService,
  ) {}

  /* ============ 第三方登录（Google / GitHub / Microsoft） ============ */

  /** 前台据此渲染按钮：哪些可用、是真实 OAuth 还是演示模式 */
  @Get('oauth/providers')
  providers() {
    return this.oauth.listProviders();
  }

  /** 第 1 步：跳转到厂商授权页（未配置密钥则直通演示回调） */
  @Get('oauth/:provider/start')
  async oauthStart(
    @Param('provider') provider: string,
    @Query('next') next: string,
    @Res() res: Response,
  ) {
    const url = await this.oauth.startUrl(provider, next || '/');
    return res.redirect(url);
  }

  /** 第 2 步：厂商回调 → 换 token → 建号/绑定 → 带本站 JWT 回前台 */
  @Get('oauth/:provider/callback')
  async oauthCallback(
    @Param('provider') provider: string,
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const web = (process.env.WEB_ORIGIN || 'http://localhost:5173').trim();
    if (error) return res.redirect(`${web}/login?oauth_error=${encodeURIComponent(error)}`);
    try {
      const url = await this.oauth.handleCallback(
        provider,
        code,
        state,
        (req.headers['x-forwarded-for'] as string) || req.ip || '',
        req.headers['user-agent'] || '',
      );
      return res.redirect(url);
    } catch (e: any) {
      return res.redirect(
        `${web}/login?oauth_error=${encodeURIComponent(e?.message || '授权失败')}`,
      );
    }
  }

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto.email, dto.password);
  }

  /** 供应商入驻注册 */
  @Post('register-supplier')
  registerSupplier(@Body() dto: RegisterDto) {
    return this.auth.registerSupplier(dto.email, dto.password);
  }

  @Post('login')
  login(@Body() dto: LoginDto, @Req() req: Request) {
    const ip =
      ((req.headers['x-forwarded-for'] as string) || '').split(',')[0].trim() ||
      req.socket.remoteAddress ||
      '';
    return this.auth.login(
      dto.email,
      dto.password,
      ip,
      (req.headers['user-agent'] as string) || '',
    );
  }

  /** 忘记密码：申请重置令牌 */
  @Post('forgot-password')
  forgot(@Body() body: { email: string }) {
    return this.auth.forgotPassword(body?.email || '');
  }

  /** 用令牌重置密码 */
  @Post('reset-password')
  reset(@Body() body: { token: string; newPassword: string }) {
    return this.auth.resetPassword(body?.token || '', body?.newPassword || '');
  }

  /** 我的登录记录（账户安全） */
  @Get('login-history')
  @UseGuards(JwtAuthGuard)
  loginHistory(@CurrentUser() user: JwtUser) {
    return this.auth.loginHistory(user.sub);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: JwtUser) {
    return this.auth.me(user.sub);
  }

  /** 修改个人资料（昵称/头像） */
  @Patch('profile')
  @UseGuards(JwtAuthGuard)
  updateProfile(@CurrentUser() user: JwtUser, @Body() dto: UpdateProfileDto) {
    return this.auth.updateProfile(user.sub, dto);
  }

  /** 修改密码（验证旧密码） */
  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  changePassword(@CurrentUser() user: JwtUser, @Body() dto: ChangePasswordDto) {
    return this.auth.changePassword(user.sub, dto.oldPassword, dto.newPassword);
  }
}
