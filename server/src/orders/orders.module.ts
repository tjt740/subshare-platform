import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order, OrderItem, Plan, Product, Subscription } from '../entities';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { CatalogModule } from '../catalog/catalog.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, OrderItem, Plan, Product, Subscription]),
    CatalogModule,
  ],
  providers: [OrdersService],
  controllers: [OrdersController],
  exports: [OrdersService],
})
export class OrdersModule {}
