import mongoose from 'mongoose';
import './env';

/**
 * Opens the MongoDB connection.
 *
 * A failure here is fatal rather than degraded - hence the process.exit.
 */
const connectDB = async (): Promise<void> => {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI is not set');
    }

    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Database connection successful');
  } catch (error) {
    console.error('❌ Database connection failed:', (error as Error).message);
    process.exit(1);
  }
};

export = connectDB;
