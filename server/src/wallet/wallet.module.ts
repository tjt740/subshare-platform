import { Controller, Get, Module, UseGuards } from '@nestjs/common';
import { InjectRepository, TypeOrmModule } from '@nestjs/typeorm';
import { Injectable, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { User, WalletTransaction } from '../entities';
import { CurrentUser, JwtAuthGuard, JwtUser } from '../auth/auth.common';

@Injectable()
export class WalletService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(WalletTransaction)
    private readonly txns: Repository<WalletTransaction>,
  ) {}

  async overview(userId: number) {
    const user = await this.users.findOneBy({ id: userId });
    if (!user) throw new NotFoundException();
    const transactions = await this.txns.find({
      where: { userId },
      order: { id: 'DESC' },
      take: 50,
    });
    return { balance: user.balance, currency: 'USD', transactions };
  }
}

@Controller('wallet')
@UseGuards(JwtAuthGuard)
export class WalletController {
  constructor(private readonly wallet: WalletService) {}

  /** 钱包总览：余额 + 最近流水（充值走 POST /payments/recharge） */
  @Get()
  overview(@CurrentUser() user: JwtUser) {
    return this.wallet.overview(user.sub);
  }
}

@Module({
  imports: [TypeOrmModule.forFeature([User, WalletTransaction])],
  providers: [WalletService],
  controllers: [WalletController],
})
export class WalletModule {}
