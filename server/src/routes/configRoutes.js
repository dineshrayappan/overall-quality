import express from 'express';
import { CompanySetting } from '../models/CompanySetting.js';
import { InspectionConfig } from '../models/InspectionConfig.js';
import { RolePermission } from '../models/RolePermission.js';
import { authenticate } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import { recordAudit } from '../services/auditService.js';
import { AppError, asyncHandler } from '../utils/errors.js';

const router = express.Router();
router.use(authenticate);

router.get(
  '/company',
  asyncHandler(async (_req, res) => {
    const company = await CompanySetting.findOne({ key: 'default' }).lean();
    res.json({ success: true, data: company });
  })
);

router.patch(
  '/company',
  requirePermission('configuration', 'edit'),
  asyncHandler(async (req, res) => {
    const prev = await CompanySetting.findOne({ key: 'default' }).lean();
    const { companyName, companyAddress, companyPhone, companyEmail, logoAttachmentId } = req.body;
    const updated = await CompanySetting.findOneAndUpdate(
      { key: 'default' },
      {
        $set: {
          ...(companyName !== undefined ? { companyName } : {}),
          ...(companyAddress !== undefined ? { companyAddress } : {}),
          ...(companyPhone !== undefined ? { companyPhone } : {}),
          ...(companyEmail !== undefined ? { companyEmail } : {}),
          ...(logoAttachmentId !== undefined ? { logoAttachmentId } : {}),
          updatedBy: req.user._id,
        },
      },
      { new: true, upsert: true }
    ).lean();

    await recordAudit({
      entityType: 'companySetting',
      entityId: updated._id,
      entityIdentifier: 'default',
      action: 'CONFIG_UPDATE',
      user: req.user,
      previousValues: prev,
      newValues: updated,
      summary: 'Updated company branding and report header settings.',
      req,
    });

    res.json({ success: true, data: updated });
  })
);

router.get(
  '/roles',
  asyncHandler(async (_req, res) => {
    const roles = await RolePermission.find().sort({ isSystem: -1, roleName: 1 }).lean();
    res.json({ success: true, data: roles });
  })
);

router.post(
  '/roles',
  requirePermission('configuration', 'edit'),
  asyncHandler(async (req, res) => {
    const { roleName, description = '', permissions } = req.body;
    if (!roleName || !roleName.trim()) {
      throw new AppError('Role name is required.', 400);
    }
    const created = await RolePermission.create({
      roleName: roleName.trim(),
      description,
      isSystem: false,
      permissions: permissions || {},
      updatedBy: req.user._id,
    });

    await recordAudit({
      entityType: 'rolePermission',
      entityId: created._id,
      entityIdentifier: created.roleName,
      action: 'CREATE',
      user: req.user,
      newValues: created.toObject(),
      summary: `Created role '${created.roleName}'.`,
      req,
    });

    res.status(201).json({ success: true, data: created });
  })
);

router.put(
  '/roles/:roleName',
  requirePermission('configuration', 'edit'),
  asyncHandler(async (req, res) => {
    const role = await RolePermission.findOne({ roleName: req.params.roleName });
    if (!role) throw new AppError('Role not found.', 404);

    const prev = role.toObject();
    if (req.body.description !== undefined) role.description = req.body.description;
    if (req.body.permissions !== undefined) role.permissions = req.body.permissions;
    role.updatedBy = req.user._id;
    await role.save();

    await recordAudit({
      entityType: 'rolePermission',
      entityId: role._id,
      entityIdentifier: role.roleName,
      action: 'CONFIG_UPDATE',
      user: req.user,
      previousValues: prev.permissions,
      newValues: role.permissions,
      summary: `Updated permissions for role '${role.roleName}'.`,
      req,
    });

    res.json({ success: true, data: role });
  })
);

router.get(
  '/inspections',
  asyncHandler(async (_req, res) => {
    const configs = await InspectionConfig.find().lean();
    const byModule = {};
    for (const c of configs) byModule[c.module] = c.config;
    res.json({ success: true, data: byModule });
  })
);

router.get(
  '/inspections/:module',
  asyncHandler(async (req, res) => {
    const cfg = await InspectionConfig.findOne({ module: req.params.module }).lean();
    if (!cfg) throw new AppError('Configuration module not found.', 404);
    res.json({ success: true, data: cfg.config });
  })
);

router.put(
  '/inspections/:module',
  requirePermission('configuration', 'edit'),
  asyncHandler(async (req, res) => {
    const allowed = ['target_chart', 'size_set', 'seven_point', 'measurement'];
    if (!allowed.includes(req.params.module)) {
      throw new AppError('Invalid inspection configuration module.', 400);
    }

    const existing = await InspectionConfig.findOne({ module: req.params.module });
    const prevConfig = existing?.config || null;

    if (req.params.module === 'target_chart' && req.body.indicators) {
      if (!Array.isArray(req.body.indicators) || req.body.indicators.length !== 15) {
        throw new AppError('Target Chart configuration must have exactly 15 indicators.', 400);
      }
    }

    const updated = await InspectionConfig.findOneAndUpdate(
      { module: req.params.module },
      { $set: { config: req.body, updatedBy: req.user._id } },
      { new: true, upsert: true }
    ).lean();

    await recordAudit({
      entityType: 'inspectionConfig',
      entityId: updated._id,
      entityIdentifier: req.params.module,
      action: 'CONFIG_UPDATE',
      user: req.user,
      previousValues: prevConfig,
      newValues: updated.config,
      summary: `Updated configuration for '${req.params.module}'.`,
      req,
    });

    res.json({ success: true, data: updated.config });
  })
);

export default router;

