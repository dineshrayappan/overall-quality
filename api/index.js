import { createApp } from '../server/src/app.js';
import { connectDB } from '../server/src/config/db.js';
import { env } from '../server/src/config/env.js';
import { bootstrapSystemConfig } from '../server/src/services/bootstrapService.js';

let app = null;

export default async function handler(req, res) {
  // Normalize req.url so Express router always matches /api/... routes
  let url = req.url || '/';
  if (url.startsWith('/api/index.js')) {
    url = url.replace('/api/index.js', '') || '/';
  }
  if (!url.startsWith('/api')) {
    req.url = '/api' + (url.startsWith('/') ? url : '/' + url);
  }

  const mongoUri = process.env.MONGO_URI || env.mongoUri;
  try {
    await connectDB(mongoUri);
    await bootstrapSystemConfig().catch((err) => {
      console.warn('Bootstrap note:', err.message);
    });
  } catch (err) {
    console.error('Database connection error:', err);
    return res.status(500).json({
      success: false,
      message: `Database connection failed: ${err.message}. Please check MongoDB Atlas connection string and Network Access (whitelist 0.0.0.0/0).`,
    });
  }

  if (!app) {
    app = createApp();
  }

  return app(req, res);
}
