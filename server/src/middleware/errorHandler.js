import multer from 'multer';
import { ZodError } from 'zod';
import { AppError } from '../utils/errors.js';

export function errorHandler(err, _req, res, _next) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      details: err.details || undefined,
    });
  }

  if (err instanceof ZodError) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed.',
      details: err.errors.map((e) => ({
        path: e.path.join('.'),
        message: e.message,
      })),
    });
  }

  if (err instanceof multer.MulterError) {
    return res.status(400).json({
      success: false,
      message: err.code === 'LIMIT_FILE_SIZE'
        ? 'Uploaded image exceeds maximum allowed size.'
        : err.message,
    });
  }

  if (err?.name === 'ValidationError') {
    const messages = Object.values(err.errors || {}).map((e) => e.message);
    return res.status(400).json({
      success: false,
      message: messages[0] || 'Database validation error.',
      details: messages,
    });
  }

  if (err?.code === 11000) {
    const duplicateFields = Object.keys(err.keyPattern || {});
    return res.status(409).json({
      success: false,
      message: `Duplicate record: ${duplicateFields.join(', ') || 'unique field'} already exists.`,
    });
  }

  if (err?.name === 'CastError') {
    return res.status(400).json({
      success: false,
      message: `Invalid identifier for ${err.path || 'field'}.`,
    });
  }

  console.error('[QMS Error]', err);
  return res.status(err?.statusCode || 500).json({
    success: false,
    message: err?.message || 'Internal server error.',
  });
}

