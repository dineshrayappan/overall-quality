import express from 'express';
import { InspectionConfig } from '../models/InspectionConfig.js';
import { ApprovalHistory } from '../models/ApprovalHistory.js';
import { authenticate } from '../middleware/auth.js';
import {
  assertRecordAccess,
  buildScopeFilter,
  requirePermission,
} from '../middleware/rbac.js';
import {
  createControlledRevision,
  processApprovalAction,
  submitInspection,
  toggleArchiveInspection,
} from '../services/approvalService.js';
import { recordAudit } from '../services/auditService.js';
import { nextReportNumber } from '../utils/counter.js';
import { AppError, asyncHandler } from '../utils/errors.js';

export function createInspectionLifecycleRouter({
  model,
  inspectionType,
  moduleKey,
  reportPrefix,
  buildPayload,
  extraRoutes,
  extraPopulates = [],
  buildExtraFilter,
}) {
  const router = express.Router();
  router.use(authenticate);

  if (typeof extraRoutes === 'function') {
    extraRoutes(router);
  }

  router.get(
    '/',
    requirePermission(moduleKey, 'view'),
    asyncHandler(async (req, res) => {
      const {
        search = '',
        approvalStatus = '',
        buyerId = '',
        styleId = '',
        orderId = '',
        productionLineId = '',
        inspectorId = '',
        dateFrom = '',
        dateTo = '',
        includeArchived = 'false',
        page = '1',
        limit = '25',
      } = req.query;

      const scopeFilter = buildScopeFilter(req, moduleKey);
      const filter = { ...scopeFilter };

      if (includeArchived !== 'true') filter.isArchived = false;
      if (approvalStatus) filter.approvalStatus = approvalStatus;
      if (buyerId) filter.buyerId = buyerId;
      if (styleId) filter.styleId = styleId;
      if (orderId) filter.orderId = orderId;
      if (productionLineId) filter.productionLineId = productionLineId;
      if (inspectorId) filter.inspectorId = inspectorId;

      if (dateFrom || dateTo) {
        filter.inspectionDate = {};
        if (dateFrom) filter.inspectionDate.$gte = new Date(dateFrom);
        if (dateTo) {
          const end = new Date(dateTo);
          end.setHours(23, 59, 59, 999);
          filter.inspectionDate.$lte = end;
        }
      }

      if (typeof buildExtraFilter === 'function') {
        Object.assign(filter, buildExtraFilter(req.query));
      }

      if (search.trim()) {
        const rx = new RegExp(search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        const orClauses = [
          { reportNumber: rx },
          { inspectorName: rx },
          { productionLineName: rx },
          { 'headerSnapshot.orderNumber': rx },
          { 'headerSnapshot.styleNumber': rx },
          { 'headerSnapshot.buyerName': rx },
        ];
        if (filter.$or) {
          filter.$and = [{ $or: filter.$or }, { $or: orClauses }];
          delete filter.$or;
        } else {
          filter.$or = orClauses;
        }
      }

      const pageNum = Math.max(1, Number(page) || 1);
      const limitNum = Math.min(200, Math.max(1, Number(limit) || 25));
      const skip = (pageNum - 1) * limitNum;

      let query = model
        .find(filter)
        .sort({ inspectionDate: -1, createdAt: -1 })
        .skip(skip)
        .limit(limitNum);

      for (const pop of extraPopulates) {
        query = query.populate(pop);
      }

      const [items, total] = await Promise.all([query.lean(), model.countDocuments(filter)]);

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

  router.get(
    '/:id',
    requirePermission(moduleKey, 'view'),
    asyncHandler(async (req, res) => {
      let query = model.findById(req.params.id);
      for (const pop of extraPopulates) {
        query = query.populate(pop);
      }
      const doc = await query.lean();
      if (!doc) throw new AppError('Inspection report not found.', 404);

      assertRecordAccess(req, moduleKey, doc);

      const history = await ApprovalHistory.find({
        inspectionType,
        inspectionId: doc._id,
      })
        .sort({ timestamp: -1 })
        .lean();

      res.json({ success: true, data: { ...doc, approvalHistory: history } });
    })
  );

  router.post(
    '/',
    requirePermission(moduleKey, 'create'),
    asyncHandler(async (req, res) => {
      if (req.body.submissionToken) {
        const duplicate = await model.findOne({ submissionToken: req.body.submissionToken }).lean();
        if (duplicate) {
          return res.status(200).json({ success: true, data: duplicate, deduplicated: true });
        }
      }

      const cfgDoc = await InspectionConfig.findOne({ module: inspectionType }).lean();
      const config = cfgDoc?.config || {};
      const prepared = await buildPayload({ req, config, existing: null });

      const reportNumber = await nextReportNumber(reportPrefix);
      const created = await model.create({
        ...prepared,
        reportNumber,
        inspectionType,
        inspectorId: prepared.inspectorId || req.user._id,
        inspectorName: prepared.inspectorName || req.user.fullName,
        approvalStatus: 'Draft',
        submissionToken: req.body.submissionToken || undefined,
        createdBy: req.user._id,
        updatedBy: req.user._id,
      });

      await recordAudit({
        entityType: inspectionType,
        entityId: created._id,
        entityIdentifier: created.reportNumber,
        action: 'CREATE',
        user: req.user,
        newValues: { reportNumber: created.reportNumber },
        summary: `Created draft ${inspectionType} report ${created.reportNumber}.`,
        req,
      });

      if (req.body.submitImmediately) {
        if (req.user.role !== 'Admin' && !req.permissions?.[moduleKey]?.submit) {
          throw new AppError(`Access denied: missing '${moduleKey}.submit' permission.`, 403);
        }
        await submitInspection({ doc: created, inspectionType, config, user: req.user, req });
      }

      res.status(201).json({ success: true, data: created });
    })
  );

  router.patch(
    '/:id',
    requirePermission(moduleKey, 'edit'),
    asyncHandler(async (req, res) => {
      const existing = await model.findById(req.params.id);
      if (!existing) throw new AppError('Inspection report not found.', 404);
      if (existing.isArchived) throw new AppError('Archived reports cannot be edited.', 400);

      assertRecordAccess(req, moduleKey, existing);

      if (!['Draft', 'Returned for Correction'].includes(existing.approvalStatus)) {
        throw new AppError(
          `Report ${existing.reportNumber} is '${existing.approvalStatus}' and cannot be overwritten. Use controlled revision if finalized.`,
          409
        );
      }

      const cfgDoc = await InspectionConfig.findOne({ module: inspectionType }).lean();
      const config = cfgDoc?.config || {};
      const previousValues = existing.toObject();
      const prepared = await buildPayload({ req, config, existing });

      Object.assign(existing, prepared, { updatedBy: req.user._id });
      await existing.save();

      await recordAudit({
        entityType: inspectionType,
        entityId: existing._id,
        entityIdentifier: existing.reportNumber,
        action: 'UPDATE',
        user: req.user,
        previousValues: { approvalStatus: previousValues.approvalStatus, version: previousValues.version },
        newValues: { approvalStatus: existing.approvalStatus, version: existing.version },
        summary: `Updated draft report ${existing.reportNumber}.`,
        req,
      });

      if (req.body.submitImmediately) {
        if (req.user.role !== 'Admin' && !req.permissions?.[moduleKey]?.submit) {
          throw new AppError(`Access denied: missing '${moduleKey}.submit' permission.`, 403);
        }
        await submitInspection({ doc: existing, inspectionType, config, user: req.user, req });
      }

      res.json({ success: true, data: existing });
    })
  );

  router.post(
    '/:id/submit',
    requirePermission(moduleKey, 'submit'),
    asyncHandler(async (req, res) => {
      const doc = await model.findById(req.params.id);
      if (!doc) throw new AppError('Inspection report not found.', 404);
      assertRecordAccess(req, moduleKey, doc);

      const cfgDoc = await InspectionConfig.findOne({ module: inspectionType }).lean();
      await submitInspection({
        doc,
        inspectionType,
        config: cfgDoc?.config || {},
        user: req.user,
        req,
      });

      res.json({ success: true, data: doc });
    })
  );

  router.post(
    '/:id/approve',
    requirePermission(moduleKey, 'approve'),
    asyncHandler(async (req, res) => {
      const doc = await model.findById(req.params.id);
      if (!doc) throw new AppError('Inspection report not found.', 404);
      assertRecordAccess(req, moduleKey, doc);

      const cfgDoc = await InspectionConfig.findOne({ module: inspectionType }).lean();
      await processApprovalAction({
        doc,
        inspectionType,
        moduleKey,
        action: 'Approved',
        stage: req.body.stage,
        decision: req.body.decision,
        comments: req.body.comments || '',
        user: req.user,
        permissions: req.permissions,
        config: cfgDoc?.config || {},
        req,
      });

      res.json({ success: true, data: doc });
    })
  );

  router.post(
    '/:id/reject',
    (req, res, next) => {
      if (req.user?.role === 'Admin' || req.permissions?.[moduleKey]?.reject) {
        return next();
      }
      if (req.body.returnForCorrection && (req.permissions?.[moduleKey]?.edit || req.permissions?.[moduleKey]?.create)) {
        return next();
      }
      return next(new AppError(`Access denied: missing '${moduleKey}.reject' permission.`, 403));
    },
    asyncHandler(async (req, res) => {
      const doc = await model.findById(req.params.id);
      if (!doc) throw new AppError('Inspection report not found.', 404);
      assertRecordAccess(req, moduleKey, doc);

      const cfgDoc = await InspectionConfig.findOne({ module: inspectionType }).lean();
      await processApprovalAction({
        doc,
        inspectionType,
        moduleKey,
        action: req.body.returnForCorrection ? 'Returned for Correction' : 'Rejected',
        stage: req.body.stage,
        comments: req.body.comments || '',
        user: req.user,
        permissions: req.permissions,
        config: cfgDoc?.config || {},
        req,
      });

      res.json({ success: true, data: doc });
    })
  );

  router.post(
    '/:id/revise',
    requirePermission(moduleKey, 'edit'),
    asyncHandler(async (req, res) => {
      const doc = await model.findById(req.params.id);
      if (!doc) throw new AppError('Inspection report not found.', 404);
      assertRecordAccess(req, moduleKey, doc);

      await createControlledRevision({
        doc,
        inspectionType,
        reason: req.body.reason,
        user: req.user,
        req,
      });

      res.json({ success: true, data: doc });
    })
  );

  router.patch(
    '/:id/archive',
    requirePermission(moduleKey, 'archive'),
    asyncHandler(async (req, res) => {
      const doc = await model.findById(req.params.id);
      if (!doc) throw new AppError('Inspection report not found.', 404);
      assertRecordAccess(req, moduleKey, doc);

      const archive = req.body.isArchived !== undefined ? Boolean(req.body.isArchived) : !doc.isArchived;
      await toggleArchiveInspection({
        doc,
        inspectionType,
        archive,
        reason: req.body.reason || '',
        user: req.user,
        req,
      });

      res.json({ success: true, data: doc });
    })
  );

  return router;
}

