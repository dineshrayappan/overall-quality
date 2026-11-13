import { createApp } from './app.js';
import { connectDB } from './config/db.js';
import { env } from './config/env.js';
import { bootstrapSystemConfig } from './services/bootstrapService.js';

async function startServer() {
  await connectDB(env.mongoUri);
  await bootstrapSystemConfig();
  const app = createApp();
  app.listen(env.port, () => {
    console.log(`Garment QMS server listening on http://localhost:${env.port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start Garment QMS server:', err);
  process.exit(1);
});

