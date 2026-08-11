require('./config/env');

const connectDB = require('./config/db');
const app = require('./app');

/**
 * Process entry point.
 *
 * Kept separate from app.js so the Express app can be imported by tests
 * (supertest) without opening a database connection or binding a port.
 */
const PORT = process.env.PORT || 3000;

const start = async () => {
  await connectDB();

  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
};

start();
