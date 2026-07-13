import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  InventoryAccount,
  Notification,
  Order,
  OrderItem,
  Payment,
  Plan,
  PriceBook,
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
import { MaintenanceService } from './maintenance.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Payment,
      Order,
      OrderItem,
      Plan,
      PriceBook,
      Product,
      InventoryAccount,
      Slot,
      SlotAssignment,
      Subscription,
      User,
      WalletTransaction,
      Notification,
    ]),
  ],
  providers: [PaymentsService, FulfillmentService, MaintenanceService],
  controllers: [PaymentsController],
  exports: [PaymentsService, FulfillmentService, MaintenanceService],
})
export class PaymentsModule {}
