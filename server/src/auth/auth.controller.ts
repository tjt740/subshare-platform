import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import {
  IsEmail,
  IsOptional,
  IsString,
  MinLength,
  MaxLength,
} from 'class-validator';
import { AuthService } from './auth.service';
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
  @MaxLength(8)
  avatar?: string;
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
  constructor(private readonly auth: AuthService) {}

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
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto.email, dto.password);
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
