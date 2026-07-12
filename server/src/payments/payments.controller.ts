import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { IsBoolean, IsIn, IsInt } from 'class-validator';
import {
  MOCK_PROVIDERS,
  PaymentsService,
  RECHARGE_PRESETS,
} from './payments.service';
import { CurrentUser, JwtAuthGuard, JwtUser } from '../auth/auth.common';

class CheckoutDto {
  @IsIn([...MOCK_PROVIDERS, 'balance'], { message: '不支持的支付方式' })
  provider: string;
}

class RechargeDto {
  @IsInt()
  @IsIn(RECHARGE_PRESETS, { message: '不支持的充值面额' })
  amountUsd: number;
  @IsIn(MOCK_PROVIDERS, { message: '不支持的支付方式' })
  provider: string;
}

class ConfirmDto {
  @IsBoolean()
  success: boolean;
}

@Controller('payments')
@UseGuards(JwtAuthGuard)
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Post(':orderId/checkout')
  checkout(
    @CurrentUser() user: JwtUser,
    @Param('orderId', ParseIntPipe) orderId: number,
    @Body() dto: CheckoutDto,
  ) {
    return this.payments.checkout(user.sub, orderId, dto.provider);
  }

  @Post('recharge')
  recharge(@CurrentUser() user: JwtUser, @Body() dto: RechargeDto) {
    return this.payments.rechargeCheckout(user.sub, dto.amountUsd, dto.provider);
  }

  @Get(':id')
  get(@CurrentUser() user: JwtUser, @Param('id', ParseIntPipe) id: number) {
    return this.payments.getForUser(user.sub, id);
  }

  /** 模拟支付网关回调（真实场景为 PSP 服务端 webhook + 验签） */
  @Post('mock/:id/confirm')
  confirm(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ConfirmDto,
  ) {
    return this.payments.mockConfirm(user.sub, id, dto.success);
  }
}
