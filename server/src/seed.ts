import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import { ALL_ENTITIES } from './entities';
import { runSeed } from './seed-data';

/** CLI：npm run seed（服务端空库启动时也会自动执行同一份种子逻辑） */
async function main() {
  fs.mkdirSync(path.join(__dirname, '..', 'data'), { recursive: true });
  const ds = new DataSource({
    type: 'sqljs',
    location:
      process.env.DB_FILE || path.join(__dirname, '..', 'data', 'app.db'),
    autoSave: true,
    entities: ALL_ENTITIES,
    synchronize: true,
  });
  await ds.initialize();
  await runSeed(ds);
  await ds.destroy();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
