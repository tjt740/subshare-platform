import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  AccountCostEntry,
  InventoryAccount,
  InventoryAuditLog,
  Order,
  OrderItem,
  Payment,
  Plan,
  PriceBook,
  SiteSetting,
  SiteConfigRevision,
  Product,
  Slot,
  SlotAssignment,
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
      AccountCostEntry,
      InventoryAuditLog,
      Slot,
      SlotAssignment,
      Order,
      OrderItem,
      Payment,
      Subscription,
      Ticket,
      TicketMessage,
      SupplierSubmission,
      WalletTransaction,
      SiteSetting,
      SiteConfigRevision,
    ]),
    PaymentsModule,
    OrdersModule,
  ],
  providers: [AdminService],
  controllers: [AdminController],
})
export class AdminModule {}
