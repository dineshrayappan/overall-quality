import mongoose from 'mongoose';
import { env } from './env.js';

export async function connectDB(uri = env.mongoUri) {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }
  await mongoose.connect(uri);
  return mongoose.connection;
}

export async function disconnectDB() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}

