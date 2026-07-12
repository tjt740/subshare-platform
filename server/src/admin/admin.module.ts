import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  InventoryAccount,
  Order,
  OrderItem,
  Payment,
  Plan,
  PriceBook,
  SiteSetting,
  Product,
  Slot,
  Subscription,
  SupplierSubmission,
  Ticket,
  TicketMessage,
  User,
  WalletTransaction,
} from '../entities';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { PaymentsModule } from '../payments/payments.module';
import { OrdersModule } from '../orders/orders.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Product,
      Plan,
      PriceBook,
      InventoryAccount,
      Slot,
      Order,
      OrderItem,
      Payment,
      Subscription,
      Ticket,
      TicketMessage,
      SupplierSubmission,
      WalletTransaction,
      SiteSetting,
    ]),
    PaymentsModule,
    OrdersModule,
  ],
  providers: [AdminService],
  controllers: [AdminController],
})
export class AdminModule {}
