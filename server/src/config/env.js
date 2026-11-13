import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SERVER_ROOT = path.resolve(__dirname, '../..');

dotenv.config({ path: path.join(SERVER_ROOT, '.env') });

export const env = {
  port: Number(process.env.PORT || 5000),
  nodeEnv: process.env.NODE_ENV || 'development',
  mongoUri: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/garment_qms',
  jwtSecret: process.env.JWT_SECRET || 'dev-only-secret-change-in-production',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '12h',
  uploadDir: process.env.UPLOAD_DIR
    ? path.resolve(SERVER_ROOT, process.env.UPLOAD_DIR)
    : process.env.VERCEL
    ? path.join('/tmp', 'uploads')
    : path.resolve(SERVER_ROOT, 'uploads'),
  maxFileSizeBytes: Number(process.env.MAX_FILE_SIZE_MB || 5) * 1024 * 1024,
  clientOrigin: process.env.CLIENT_ORIGIN || '*',
  serverRoot: SERVER_ROOT,
};

