import express from 'express';
import fs from 'fs';
import path from 'path';
import { env } from '../config/env.js';
import { brandingUpload, inspectionUpload } from '../config/upload.js';
import { InspectionAttachment } from '../models/InspectionAttachment.js';
import { authenticate } from '../middleware/auth.js';
import { recordAudit } from '../services/auditService.js';
import { AppError, asyncHandler } from '../utils/errors.js';

const router = express.Router();
router.use(authenticate);

async function saveAttachmentMeta(req, moduleName) {
  if (!req.file) {
    throw new AppError('No image file provided.', 400);
  }
  const relativePath = path.relative(env.uploadDir, req.file.path).replace(/\\/g, '/');
  const doc = await InspectionAttachment.create({
    originalName: req.file.originalname,
    storedName: req.file.filename,
    relativePath,
    mimeType: req.file.mimetype,
    sizeBytes: req.file.size,
    module: moduleName,
    inspectionId: req.body.inspectionId || null,
    itemKey: req.body.itemKey || '',
    uploadedBy: req.user._id,
    uploadedByName: req.user.fullName,
  });

  await recordAudit({
    entityType: 'attachment',
    entityId: doc._id,
    entityIdentifier: doc.originalName,
    action: 'CREATE',
    user: req.user,
    summary: `Uploaded image '${doc.originalName}' for module '${moduleName}'.`,
    req,
  });

  return doc;
}

router.post(
  '/upload',
  inspectionUpload.single('file'),
  asyncHandler(async (req, res) => {
    const allowedModules = ['target_chart', 'size_set', 'seven_point', 'measurement'];
    const moduleName = allowedModules.includes(req.body.module) ? req.body.module : 'size_set';
    const doc = await saveAttachmentMeta(req, moduleName);
    res.status(201).json({ success: true, data: doc });
  })
);

router.post(
  '/upload-logo',
  brandingUpload.single('file'),
  asyncHandler(async (req, res) => {
    if (req.user.role !== 'Admin' && !req.permissions?.configuration?.edit) {
      throw new AppError('Only authorized administrators can upload company logo.', 403);
    }
    const doc = await saveAttachmentMeta(req, 'branding');
    res.status(201).json({ success: true, data: doc });
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const doc = await InspectionAttachment.findById(req.params.id).lean();
    if (!doc || doc.isArchived) throw new AppError('Attachment not found.', 404);
    res.json({ success: true, data: doc });
  })
);

router.get(
  '/:id/file',
  asyncHandler(async (req, res) => {
    const doc = await InspectionAttachment.findById(req.params.id).lean();
    if (!doc || doc.isArchived) throw new AppError('Attachment not found.', 404);

    const absPath = path.resolve(env.uploadDir, doc.relativePath);
    const rootResolved = path.resolve(env.uploadDir);
    if (!absPath.startsWith(rootResolved + path.sep)) {
      throw new AppError('Invalid file path.', 403);
    }
    if (!fs.existsSync(absPath)) {
      throw new AppError('Stored image file is missing on server.', 404);
    }

    res.setHeader('Content-Type', doc.mimeType);
    res.setHeader('Cache-Control', 'private, max-age=86400');
    fs.createReadStream(absPath).pipe(res);
  })
);

export default router;

