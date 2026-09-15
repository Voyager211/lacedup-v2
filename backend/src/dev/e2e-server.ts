import { MongoMemoryServer } from 'mongodb-memory-server';

/**
 * API server for the Playwright suite.
 *
 * Backed by a throwaway in-memory MongoDB, so an e2e run can never write to the
 * database in .env (which may be a real cluster) and always starts from the
 * same state. Everything is set before the app is imported: dotenv never
 * overwrites a variable that already exists, so these win over .env.
 */
const PORT = process.env.E2E_API_PORT || '3100';

const start = async (): Promise<void> => {
  const mongod = await MongoMemoryServer.create();

  process.env.MONGODB_URI = mongod.getUri('lacedup-e2e');
  process.env.PORT = PORT;

  // Rate limiters skip under NODE_ENV=test, so a suite that logs in repeatedly
  // is not throttled by its own requests.
  process.env.NODE_ENV = 'test';

  // Uploads go to disk and emails to the console, never to real accounts.
  process.env.CLOUDINARY_URL = '';
  process.env.MOCK_EMAIL = 'true';
  process.env.JWT_SECRET ||= 'e2e-jwt-secret';

  const stop = async (): Promise<void> => {
    await mongod.stop();
    process.exit(0);
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);

  // require, not import: imports are hoisted above the env setup.
  require('../server');
};

start();
