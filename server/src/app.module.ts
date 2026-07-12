import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import * as path from 'path';
import { ALL_ENTITIES } from './entities';
import { AuthModule } from './auth/auth.module';
import { CatalogModule } from './catalog/catalog.module';
import { OrdersModule } from './orders/orders.module';
import { PaymentsModule } from './payments/payments.module';
import { AdminModule } from './admin/admin.module';
import { WalletModule } from './wallet/wallet.module';
import { TicketsModule } from './tickets/tickets.module';
import { SupplierModule } from './supplier/supplier.module';
import { MiscController } from './misc/misc.controller';

export const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      // sql.js：纯 JS 的 SQLite（零原生依赖，任何系统 npm install 即可运行）
      // 生产环境建议切换 PostgreSQL：type:'postgres' + url:process.env.DATABASE_URL
      type: 'sqljs',
      location:
        process.env.DB_FILE || path.join(__dirname, '..', 'data', 'app.db'),
      autoSave: true,
      entities: ALL_ENTITIES,
      synchronize: true, // 演示项目自动建表；生产请改用 migration
    }),
    JwtModule.register({
      global: true,
      secret: JWT_SECRET,
      signOptions: { expiresIn: '7d' },
    }),
    AuthModule,
    CatalogModule,
    OrdersModule,
    PaymentsModule,
    AdminModule,
    WalletModule,
    TicketsModule,
    SupplierModule,
  ],
  controllers: [MiscController],
})
export class AppModule {}
