import { createApp } from '../server/src/app.js';
import { connectDB } from '../server/src/config/db.js';
import { env } from '../server/src/config/env.js';
import { bootstrapSystemConfig } from '../server/src/services/bootstrapService.js';

let app = null;
let isConnected = false;

async function init() {
  if (!isConnected) {
    const mongoUri = process.env.MONGO_URI || env.mongoUri;
    if (mongoUri) {
      try {
        await connectDB(mongoUri);
        await bootstrapSystemConfig().catch((err) => {
          console.error('Bootstrap error:', err.message);
        });
        isConnected = true;
      } catch (err) {
        console.error('MongoDB connection error:', err.message);
      }
    }
  }
  if (!app) {
    app = createApp();
  }
}

export default async function handler(req, res) {
  // Normalize req.url so Express router always matches /api/... routes
  let url = req.url || '/';
  if (url.startsWith('/api/index.js')) {
    url = url.replace('/api/index.js', '') || '/';
  }
  if (!url.startsWith('/api')) {
    req.url = '/api' + (url.startsWith('/') ? url : '/' + url);
  }

  await init();
  return app(req, res);
}

