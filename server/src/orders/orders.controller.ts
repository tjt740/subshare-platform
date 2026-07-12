import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
} from 'class-validator';
import { OrdersService } from './orders.service';
import { CurrentUser, JwtAuthGuard, JwtUser } from '../auth/auth.common';

class CreateOrderDto {
  /** 单买传 planId；购物车结算传 planIds 数组 */
  @IsOptional()
  @IsInt()
  planId?: number;
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsInt({ each: true })
  planIds?: number[];
  @IsIn(['US', 'EU', 'CN', 'GLOBAL'])
  region: string;
}

@Controller()
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Post('orders')
  create(@CurrentUser() user: JwtUser, @Body() dto: CreateOrderDto) {
    const planIds = dto.planIds?.length
      ? dto.planIds
      : dto.planId
        ? [dto.planId]
        : [];
    return this.orders.create(user.sub, planIds, dto.region);
  }

  @Get('me/orders')
  mine(@CurrentUser() user: JwtUser) {
    return this.orders.listMine(user.sub);
  }

  @Get('me/subscriptions')
  subscriptions(@CurrentUser() user: JwtUser) {
    return this.orders.listMySubscriptions(user.sub);
  }
}
