import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import { AppModule } from './app.module';
import { ALL_ENTITIES, User } from './entities';
import { runSeed } from './seed-data';

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
