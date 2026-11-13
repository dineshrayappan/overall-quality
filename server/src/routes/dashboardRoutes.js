import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import { getDashboardAnalytics } from '../services/dashboardService.js';
import { asyncHandler } from '../utils/errors.js';

const router = express.Router();
router.use(authenticate);

router.get(
  '/analytics',
  requirePermission('dashboard', 'view'),
  asyncHandler(async (req, res) => {
    const data = await getDashboardAnalytics(req, req.query);
    res.json({ success: true, data });
  })
);

export default router;

