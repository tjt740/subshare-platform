import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  InventoryAccount,
  Order,
  OrderItem,
  Payment,
  Plan,
  Product,
  Slot,
  SlotAssignment,
  Subscription,
  User,
  WalletTransaction,
} from '../entities';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { FulfillmentService } from './fulfillment.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Payment,
      Order,
      OrderItem,
      Plan,
      Product,
      InventoryAccount,
      Slot,
      SlotAssignment,
      Subscription,
      User,
      WalletTransaction,
    ]),
  ],
  providers: [PaymentsService, FulfillmentService],
  controllers: [PaymentsController],
  exports: [PaymentsService, FulfillmentService],
})
export class PaymentsModule {}
