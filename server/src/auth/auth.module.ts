import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LoginLog, User } from '../entities';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { OAuthService } from './oauth.service';

@Module({
  imports: [TypeOrmModule.forFeature([User, LoginLog])],
  providers: [AuthService, OAuthService],
  controllers: [AuthController],
  exports: [AuthService, OAuthService],
})
export class AuthModule {}
