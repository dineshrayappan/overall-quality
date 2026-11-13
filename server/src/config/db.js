import mongoose from 'mongoose';
import { env } from './env.js';

let cachedPromise = null;

export async function connectDB(uri = env.mongoUri) {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }
  if (!cachedPromise) {
    cachedPromise = mongoose
      .connect(uri, {
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      })
      .then((m) => m.connection)
      .catch((err) => {
        cachedPromise = null;
        throw err;
      });
  }
  await cachedPromise;
  return mongoose.connection;
}

export async function disconnectDB() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
    cachedPromise = null;
  }
}
