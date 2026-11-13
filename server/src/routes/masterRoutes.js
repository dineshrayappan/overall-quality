import express from 'express';
import {
  MASTER_REGISTRY,
  MeasurementSpec,
  Order,
  Style,
} from '../models/masters/index.js';
import { authenticate } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import { recordAudit } from '../services/auditService.js';
import { AppError, asyncHandler } from '../utils/errors.js';

const router = express.Router();
router.use(authenticate);

function getRegistryEntry(entity) {
  const entry = MASTER_REGISTRY[entity];
  if (!entry) {
    throw new AppError(`Unknown master data type '${entity}'.`, 404);
  }
  return entry;
}

function buildOrderPopulateQuery(query) {
  return query
    .populate('buyerId', 'code name contactPerson country')
    .populate('styleId', 'code styleNumber name description category season')
    .populate('fabricId', 'code name composition construction width')
    .populate('gsmId', 'code value name')
    .populate('colourId', 'code name pantoneCode hexCode')
    .populate('supplierId', 'code name factoryLocation contactPerson')
    .populate('sizeRangeId', 'code name sizes');
}

function formatPopulatedOrder(order) {
  if (!order) return null;
  return {
    ...order,
    autoFilled: {
      orderId: order._id,
      orderNumber: order.orderNumber,
      orderQuantity: order.orderQuantity,
      buyerId: order.buyerId?._id || null,
      buyerName: order.buyerId?.name || '',
      styleId: order.styleId?._id || null,
      styleNumber: order.styleId?.styleNumber || '',
      styleName: order.styleId?.name || '',
      styleDescription: order.styleDescription || order.styleId?.description || '',
      fabricId: order.fabricId?._id || null,
      fabricName: order.fabricId?.name || '',
      gsmId: order.gsmId?._id || null,
      gsmValue: order.gsmId?.value || null,
      gsmLabel: order.gsmId?.name || '',
      colourId: order.colourId?._id || null,
      colourName: order.colourId?.name || '',
      supplierId: order.supplierId?._id || null,
      supplierName: order.supplierId?.name || '',
      sizeRangeId: order.sizeRangeId?._id || null,
      sizeRangeName: order.sizeRangeId?.name || '',
      sizes: order.sizeRangeId?.sizes || [],
    },
  };
}

router.get(
  '/orders/:id/populated',
  requirePermission('masterData', 'view'),
  asyncHandler(async (req, res) => {
    const order = await buildOrderPopulateQuery(Order.findById(req.params.id)).lean();
    if (!order) throw new AppError('Order not found.', 404);
    res.json({ success: true, data: formatPopulatedOrder(order) });
  })
);

router.get(
  '/measurement-specs/for-style',
  requirePermission('masterData', 'view'),
  asyncHandler(async (req, res) => {
    const { styleId, size } = req.query;
    if (!styleId) throw new AppError('styleId query parameter is required.', 400);

    const filter = { styleId, isActive: true };
    if (size) filter.size = size;

    const specs = await MeasurementSpec.find(filter)
      .populate('styleId', 'code styleNumber name')
      .sort({ size: 1, sortOrder: 1, measurementPoint: 1 })
      .lean();

    res.json({ success: true, data: specs });
  })
);

router.get(
  '/:entity',
  requirePermission('masterData', 'view'),
  asyncHandler(async (req, res) => {
    const { model, searchFields, populates } = getRegistryEntry(req.params.entity);
    const {
      search = '',
      activeOnly = '',
      page = '1',
      limit = '50',
      styleId,
      buyerId,
      productionLineId,
      departmentId,
      module: cfgModule,
      section,
      size,
    } = req.query;

    const filter = {};
    if (activeOnly === 'true') filter.isActive = true;
    if (styleId) filter.styleId = styleId;
    if (buyerId) filter.buyerId = buyerId;
    if (productionLineId) filter.productionLineId = productionLineId;
    if (departmentId) filter.departmentId = departmentId;
    if (cfgModule) filter.module = cfgModule;
    if (section) filter.section = section;
    if (size) filter.size = size;

    if (search.trim()) {
      const rx = new RegExp(search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = searchFields.map((f) => ({ [f]: rx }));
    }

    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.min(200, Math.max(1, Number(limit) || 50));
    const skip = (pageNum - 1) * limitNum;

    let query = model.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limitNum);
    for (const pop of populates) {
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
  '/:entity/:id',
  requirePermission('masterData', 'view'),
  asyncHandler(async (req, res) => {
    const { model, populates } = getRegistryEntry(req.params.entity);
    let query = model.findById(req.params.id);
    for (const pop of populates) query = query.populate(pop);
    const doc = await query.lean();
    if (!doc) throw new AppError('Master record not found.', 404);
    res.json({ success: true, data: doc });
  })
);

async function validateMasterPayload(entity, payload) {
  if (entity === 'measurement-specs') {
    const approved = Number(payload.approvedSpec);
    const upper = Number(payload.upperTolerance);
    const lower = Number(payload.lowerTolerance);
    if (![approved, upper, lower].every(Number.isFinite)) {
      throw new AppError('Approved spec, upper tolerance, and lower tolerance must be numeric.', 400);
    }
    if (lower > upper) {
      throw new AppError('Lower tolerance cannot be greater than upper tolerance.', 400);
    }
  }
  if (entity === 'orders') {
    const style = await Style.findById(payload.styleId).lean();
    if (!style) throw new AppError('Selected Style does not exist.', 400);
    if (!payload.styleDescription && style.description) {
      payload.styleDescription = style.description;
    }
  }
  if (entity === 'size-ranges' && typeof payload.sizes === 'string') {
    payload.sizes = payload.sizes
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
}

router.post(
  '/:entity',
  requirePermission('masterData', 'create'),
  asyncHandler(async (req, res) => {
    const entity = req.params.entity;
    const { model, populates, label } = getRegistryEntry(entity);
    const payload = { ...req.body, createdBy: req.user._id, updatedBy: req.user._id };
    delete payload._id;

    await validateMasterPayload(entity, payload);

    const created = await model.create(payload);
    let query = model.findById(created._id);
    for (const pop of populates) query = query.populate(pop);
    const fullDoc = await query.lean();

    await recordAudit({
      entityType: `master:${entity}`,
      entityId: created._id,
      entityIdentifier: created.code,
      action: 'CREATE',
      user: req.user,
      newValues: payload,
      summary: `Created ${label} record '${created.code}'.`,
      req,
    });

    res.status(201).json({ success: true, data: fullDoc });
  })
);

router.patch(
  '/:entity/:id',
  requirePermission('masterData', 'edit'),
  asyncHandler(async (req, res) => {
    const entity = req.params.entity;
    const { model, populates, label } = getRegistryEntry(entity);
    const existing = await model.findById(req.params.id);
    if (!existing) throw new AppError('Master record not found.', 404);

    const previousValues = existing.toObject();
    const payload = { ...req.body, updatedBy: req.user._id };
    delete payload._id;
    delete payload.createdBy;

    await validateMasterPayload(entity, { ...previousValues, ...payload });
    Object.assign(existing, payload);
    await existing.save();

    let query = model.findById(existing._id);
    for (const pop of populates) query = query.populate(pop);
    const fullDoc = await query.lean();

    await recordAudit({
      entityType: `master:${entity}`,
      entityId: existing._id,
      entityIdentifier: existing.code,
      action: 'UPDATE',
      user: req.user,
      previousValues,
      newValues: payload,
      summary: `Updated ${label} record '${existing.code}'.`,
      req,
    });

    res.json({ success: true, data: fullDoc });
  })
);

router.patch(
  '/:entity/:id/archive',
  requirePermission('masterData', 'archive'),
  asyncHandler(async (req, res) => {
    const entity = req.params.entity;
    const { model, label } = getRegistryEntry(entity);
    const doc = await model.findById(req.params.id);
    if (!doc) throw new AppError('Master record not found.', 404);

    const nextActive = req.body.isActive !== undefined ? Boolean(req.body.isActive) : !doc.isActive;
    doc.isActive = nextActive;
    doc.updatedBy = req.user._id;
    await doc.save();

    await recordAudit({
      entityType: `master:${entity}`,
      entityId: doc._id,
      entityIdentifier: doc.code,
      action: nextActive ? 'RESTORE' : 'ARCHIVE',
      user: req.user,
      summary: `${nextActive ? 'Activated' : 'Deactivated'} ${label} record '${doc.code}'.`,
      req,
    });

    res.json({ success: true, data: doc });
  })
);

export default router;

