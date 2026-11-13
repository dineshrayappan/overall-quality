import express from 'express';
import { AuditLog } from '../models/AuditLog.js';
import { authenticate } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import { asyncHandler } from '../utils/errors.js';

const router = express.Router();
router.use(authenticate);

router.get(
  '/',
  requirePermission('auditLogs', 'view'),
  asyncHandler(async (req, res) => {
    const {
      entityType = '',
      action = '',
      search = '',
      page = '1',
      limit = '50',
    } = req.query;

    const filter = {};
    if (entityType) filter.entityType = entityType;
    if (action) filter.action = action;
    if (search.trim()) {
      const rx = new RegExp(search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [
        { entityIdentifier: rx },
        { actorUsername: rx },
        { actorName: rx },
        { summary: rx },
      ];
    }

    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.min(200, Math.max(1, Number(limit) || 50));
    const skip = (pageNum - 1) * limitNum;

    const [items, total] = await Promise.all([
      AuditLog.find(filter).sort({ timestamp: -1 }).skip(skip).limit(limitNum).lean(),
      AuditLog.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: items,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  })
);

export default router;

