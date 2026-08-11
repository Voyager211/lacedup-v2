import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

/**
 * In-memory MongoDB lifecycle for tests.
 *
 * Every run gets a throwaway mongod, so tests can never reach the production
 * Atlas cluster and never depend on leftover state from a previous run.
 */
let mongod: MongoMemoryServer | null = null;

export const connect = async (): Promise<void> => {
  if (mongoose.connection.readyState !== 0) return;
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri(), { dbName: 'lacedup-test' });
};

export const disconnect = async (): Promise<void> => {
  await mongoose.connection.dropDatabase().catch(() => {});
  await mongoose.disconnect();
  if (mongod) {
    await mongod.stop();
    mongod = null;
  }
};

/** Wipe every collection without tearing down the connection. */
export const clear = async (): Promise<void> => {
  const { collections } = mongoose.connection;
  await Promise.all(Object.values(collections).map((c) => c.deleteMany({})));
};
