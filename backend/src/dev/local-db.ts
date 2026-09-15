import fs from 'fs';
import path from 'path';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { BACKEND_ROOT } from '../config/paths';

/**
 * A local MongoDB for development, with no install.
 *
 * Uses the mongod binary mongodb-memory-server already downloads for the test
 * suite, but on disk under backend/.data/mongo, so data survives restarts.
 * Point MONGODB_URI at it, then `npm run seed`.
 */
const DB_PATH = path.join(BACKEND_ROOT, '.data', 'mongo');
const PORT = Number(process.env.LOCAL_DB_PORT) || 27017;

const start = async (): Promise<void> => {
  fs.mkdirSync(DB_PATH, { recursive: true });

  const mongod = await MongoMemoryServer.create({
    instance: { dbPath: DB_PATH, port: PORT, storageEngine: 'wiredTiger' }
  });

  console.log(`Local MongoDB running: MONGODB_URI=${mongod.getUri('lacedup')}`);
  console.log(`Data directory: ${DB_PATH}`);

  const stop = async (): Promise<void> => {
    await mongod.stop({ doCleanup: false });
    process.exit(0);
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
};

start();
