import './config/env';

import connectDB from './config/db';
import app from './app';

/**
 * Process entry point.
 *
 * Kept separate from app.ts so the Express app can be imported by tests
 * (supertest) without opening a database connection or binding a port.
 */
const PORT = process.env.PORT || 3000;

const start = async (): Promise<void> => {
  await connectDB();

  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Docs available at: http://localhost:${PORT}/docs`)
  });
};

start();
