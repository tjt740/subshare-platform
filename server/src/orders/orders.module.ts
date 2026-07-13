import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order, OrderItem, Plan, Product, Subscription } from '../entities';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { CatalogModule } from '../catalog/catalog.module';
import { PaymentsModule } from '../payments/payments.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, OrderItem, Plan, Product, Subscription]),
    CatalogModule,
    PaymentsModule,
  ],
  providers: [OrdersService],
  controllers: [OrdersController],
  exports: [OrdersService],
})
export class OrdersModule {}
