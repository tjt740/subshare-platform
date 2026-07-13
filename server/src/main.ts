import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { json, urlencoded } from 'express';
import { ValidationPipe } from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import { AppModule } from './app.module';
import { ALL_ENTITIES, InventoryAccount, Order, SiteSetting, User } from './entities';
import { runSeed } from './seed-data';

/**
 * 极简 .env 加载（零依赖，避免为几个 OAuth 密钥引入 dotenv）
 * 已存在的环境变量优先，不会被文件覆盖。
 */
function loadEnv() {
  const file = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(file)) return;
  for (const raw of fs.readFileSync(file, 'utf8').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}
loadEnv();

const DB_FILE =
  process.env.DB_FILE || path.join(__dirname, '..', 'data', 'app.db');

/**
 * 启动自愈：旧版本数据库结构与新实体冲突时（synchronize 失败），
 * 自动备份旧库为 app.db.bak-<时间戳> 并重建，避免用户升级后启动/支付报错。
 */
async function preflight() {
  fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
  if (!fs.existsSync(DB_FILE)) return;
  const probe = new DataSource({
    type: 'sqljs',
    location: DB_FILE,
    autoSave: false,
    entities: ALL_ENTITIES,
    synchronize: true,
  });
  try {
    await probe.initialize();
    await probe.destroy();
  } catch (err) {
    const backup = `${DB_FILE}.bak-${Date.now()}`;
    fs.renameSync(DB_FILE, backup);
    // eslint-disable-next-line no-console
    console.warn(
      `[subshare] ⚠ 检测到旧版本数据库结构不兼容，已备份至 ${path.basename(backup)} 并自动重建。`,
    );
  }
}

async function bootstrap() {
  await preflight();
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  // 头像 base64 上传：Express 默认 100KB body 上限会导致 413，这里放宽到 4MB
  app.use(json({ limit: '4mb' }));
  app.use(urlencoded({ extended: true, limit: '4mb' }));
  app.enableCors({ origin: true, credentials: true });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // 空库自动初始化种子数据（免去手动 npm run seed 的心智负担）
  try {
    const ds = app.get(DataSource);
    if ((await ds.getRepository(User).count()) === 0) {
      // eslint-disable-next-line no-console
      console.log('[subshare] 检测到空数据库，自动写入种子数据…');
      await runSeed(ds);
    }

    // v10 数据补全只执行一次：拆分旧订单状态，并为旧库存生成可追踪编号。
    const settingRepo = ds.getRepository(SiteSetting);
    const migrated = await settingRepo.findOneBy({ key: 'migration_v10_finance' });
    if (!migrated) {
      const orderRepo = ds.getRepository(Order);
      const legacyOrders = await orderRepo.find();
      for (const order of legacyOrders) {
        if (['paid', 'delivered', 'allocating'].includes(order.status)) {
          order.paymentStatus = 'paid';
        }
        if (order.status === 'delivered') {
          order.fulfillmentStatus = 'delivered';
          order.deliveredAt =
            order.deliveredAt || order.paidAt || order.createdAt;
        } else if (order.status === 'allocating') {
          order.fulfillmentStatus = 'partial';
        }
        if (order.status === 'refunded') {
          order.paymentStatus = 'refunded';
          order.refundStatus = 'refunded';
          order.refundedAt =
            order.refundedAt || order.updatedAt || order.createdAt;
        }
        await orderRepo.save(order);
      }
      const superUser = await ds.getRepository(User).findOneBy({ role: 'super' });
      const accountRepo = ds.getRepository(InventoryAccount);
      const legacyAccounts = await accountRepo.find();
      for (const account of legacyAccounts) {
        if (!account.accountCode) {
          account.accountCode = `ACC-${String(account.id).padStart(6, '0')}`;
        }
        account.purchasedAt = account.purchasedAt || account.createdAt;
        account.serviceStartedAt = account.serviceStartedAt || account.createdAt;
        account.createdBy = account.createdBy || superUser?.id || null;
        account.updatedBy = account.updatedBy || account.createdBy;
        await accountRepo.save(account);
      }
      await settingRepo.save(
        settingRepo.create({
          key: 'migration_v10_finance',
          value: new Date().toISOString(),
        }),
      );
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[subshare] 自动种子跳过：', (err as Error).message);
  }

  const port = Number(process.env.PORT || 3001);
  const host = process.env.HOST || '0.0.0.0';
  await app.listen(port, host);
  // eslint-disable-next-line no-console
  console.log(`[subshare] API ready at http://${host}:${port}/api`);
}
bootstrap();
