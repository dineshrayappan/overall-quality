import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env.js';
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import masterRoutes from './routes/masterRoutes.js';
import configRoutes from './routes/configRoutes.js';
import targetChartRoutes from './routes/targetChartRoutes.js';
import sizeSetRoutes from './routes/sizeSetRoutes.js';
import sevenPointRoutes from './routes/sevenPointRoutes.js';
import measurementRoutes from './routes/measurementRoutes.js';
import shrinkageRoutes from './routes/shrinkageRoutes.js';
import fourPointRoutes from './routes/fourPointRoutes.js';
import accessoriesRoutes from './routes/accessoriesRoutes.js';
import specificationRoutes from './routes/specificationRoutes.js';
import attachmentRoutes from './routes/attachmentRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import exportRoutes from './routes/exportRoutes.js';
import auditRoutes from './routes/auditRoutes.js';
import { errorHandler } from './middleware/errorHandler.js';

export function createApp() {
  const app = express();

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(
    cors({
      origin: env.clientOrigin.split(',').map((o) => o.trim()),
      credentials: true,
    })
  );
  if (env.nodeEnv !== 'test') {
    app.use(morgan('dev'));
  }
  app.use(express.json({ limit: '5mb' }));
  app.use(express.urlencoded({ extended: true }));

  app.get('/api/health', (_req, res) => {
    res.json({ success: true, service: 'garment-qms-api', timestamp: new Date().toISOString() });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/masters', masterRoutes);
  app.use('/api/config', configRoutes);
  app.use('/api/inspections/target-charts', targetChartRoutes);
  app.use('/api/inspections/size-sets', sizeSetRoutes);
  app.use('/api/inspections/seven-points', sevenPointRoutes);
  app.use('/api/inspections/measurements', measurementRoutes);
  app.use('/api/inspections/shrinkage', shrinkageRoutes);
  app.use('/api/inspections/four