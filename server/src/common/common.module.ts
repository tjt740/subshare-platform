import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../entities';
import { KeyedLock } from './keyed-lock';
import { AccountStatusService } from './account-status.service';

/** 全局通用模块：并发锁、账号状态校验等基础设施，任意模块可直接注入 */
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([User])],
  providers: [KeyedLock, AccountStatusService],
  exports: [KeyedLock, AccountStatusService],
})
export class CommonModule {}
