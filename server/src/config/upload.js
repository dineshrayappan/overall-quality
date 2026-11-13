import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { env } from './env.js';

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

const EXT_BY_MIME = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

export function getUploadSubdir(category = 'inspections') {
  const now = new Date();
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const subdir = category === 'branding' ? 'branding' : path.join('inspections', ym);
  const absDir = path.join(env.uploadDir, subdir);
  ensureDir(absDir);
  return { subdir, absDir };
}

function createMulterUpload(category) {
  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
      const { absDir } = getUploadSubdir(category);
      cb(null, absDir);
    },
    filename: (_req, file, cb) => {
      const ext = EXT_BY_MIME[file.mimetype] || path.extname(file.originalname).toLowerCase();
      cb(null, `${crypto.randomUUID()}${ext}`);
    },
  });

  return multer({
    storage,
    limits: { fileSize: env.maxFileSizeBytes },
    fileFilter: (_req, file, cb) => {
      if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
        const err = new Error('Only JPEG, PNG, and WebP images are permitted.');
        err.statusCode = 400;
        return cb(err);
      }
      cb(null, true);
    },
  });
}

export const inspectionUpload = createMulterUpload('inspections');
export const brandingUpload = createMulterUpload('branding');

