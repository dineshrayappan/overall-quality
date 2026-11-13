import express from 'express';
import { QualitySpecification } from '../models/QualitySpecification.js';
import { authenticate } from '../middleware/auth.js';
import { recordAudit } from '../services/auditService.js';
import { AppError, asyncHandler } from '../utils/errors.js';

const router = express.Router();
router.use(authenticate);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { buyerId, fabricId, styleId, search = '', isActive } = req.query;
    const filter = {};
    if (buyerId) filter.buyerId = buyerId;
    if (fabricId) filter.fabricId = fabricId;
    if (styleId) filter.styleId = styleId;
    if (isActive !== undefined) filter.isActive = isActive === 'true';

    if (search.trim()) {
      const rx = new RegExp(search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ code: rx }, { title: rx }, { buyerName: rx }, { fabricName: rx }, { styleNumber: rx }];
    }

    const items = await QualitySpecification.find(filter)
      .sort({ updatedAt: -1 })
      .populate('buyerId', 'name code')
      .populate('fabricId', 'name code')
      .populate('styleId', 'styleNumber name')
      .lean();

    res.json({ success: true, count: items.length, data: items });
  })
);

router.get(
  '/resolve',
  asyncHandler(async (req, res) => {
    const { buyerId, fabricId, styleId } = req.query;
    if (!buyerId) {
      return res.json({ success: true, data: null, message: 'Buyer ID required to resolve specifications.' });
    }

    // Try exact match: buyer + fabric + style
    let spec = null;
    if (fabricId && styleId) {
      spec = await QualitySpecification.findOne({
        buyerId,
        fabricId,
        styleId,
        isActive: true,
      }).lean();
    }

    // Fallback: buyer + fabric
    if (!spec && fabricId) {
      spec = await QualitySpecification.findOne({
        buyerId,
        fabricId,
        isActive: true,
      }).lean();
    }

    // Fallback: buyer + style
    if (!spec && styleId) {
      spec = await QualitySpecification.findOne({
        buyerId,
        styleId,
        isActive: true,
      }).lean();
    }

    // Fallback: general buyer spec
    if (!spec) {
      spec = await QualitySpecification.findOne({
        buyerId,
        isActive: true,
      }).lean();
    }

    res.json({ success: true, data: spec });
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const spec = await QualitySpecification.findById(req.params.id)
      .populate('buyerId', 'name code')
      .populate('fabricId', 'name code')
      .populate('styleId', 'styleNumber name')
      .lean();
    if (!spec) throw new AppError('Specification not found', 404);
    res.json({ success: true, data: spec });
  })
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const {
      title,
      buyerId,
      buyerName = '',
      fabricId = null,
      fabricName = '',
      styleId = null,
      styleNumber = '',
      shrinkage,
      gsmTolerance,
      colourFastness,
      physicalTesting,
      fourPoint,
      accessories,
      remarks = '',
    } = req.body;

    if (!buyerId) throw new AppError('Buyer is required for quality specification.', 400);
    if (!title || !title.trim()) throw new AppError('Specification title is required.', 400);

    const count = await QualitySpecification.countDocuments();
    const code = `SPEC-${String(count + 1).padStart(4, '0')}`;

    const spec = await QualitySpecification.create({
      code,
      title: title.trim(),
      buyerId,
      buyerName,
      fabricId: fabricId || null,
      fabricName,
      styleId: styleId || null,
      styleNumber,
      version: 1,
      isActive: true,
      shrinkage: shrinkage || {},
      gsmTolerance: gsmTolerance || {},
      colourFastness: colourFastness || {},
      physicalTesting: physicalTesting || {},
      fourPoint: fourPoint || {},
      accessories: accessories || {},
      remarks,
      createdBy: req.user._id,
      updatedBy: req.user._id,
    });

    await recordAudit({
      entityType: 'QualitySpecification',
      entityId: spec._id,
      entityIdentifier: code,
      action: 'CREATE',
      user: req.user,
      summary: `Created Quality Specification ${code} (${title.trim()})`,
      req,
    });

    res.status(201).json({ success: true, data: spec });
  })
);

router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const spec = await QualitySpecification.findById(req.params.id);
    if (!spec) throw new AppError('Specification not found', 404);

    const fields = [
      'title',
      'buyerName',
      'fabricId',
      'fabricName',
      'styleId',
      'styleNumber',
      'shrinkage',
      'gsmTolerance',
      'colourFastness',
      'physicalTesting',
      'fourPoint',
      'accessories',
      'remarks',
      'isActive',
    ];

    for (const f of fields) {
      if (req.body[f] !== undefined) {
        spec[f] = req.body[f];
      }
    }
    spec.version = (spec.version || 1) + 1;
    spec.updatedBy = req.user._id;
    await spec.save();

    await recordAudit({
      entityType: 'QualitySpecification',
      entityId: spec._id,
      entityIdentifier: spec.code,
      action: 'UPDATE',
      user: req.user,
      summary: `Updated Quality Specification ${spec.code} to v${spec.version}`,
      req,
    });

    res.json({ success: true, data: spec });
  })
);

export default router;
