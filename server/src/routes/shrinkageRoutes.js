import { ShrinkageInspection } from '../models/inspections/ShrinkageInspection.js';
import { Order, Buyer, Style, Fabric, Colour, Gsm, Supplier } from '../models/masters/index.js';
import { QualitySpecification } from '../models/QualitySpecification.js';
import { calculateShrinkageInspection } from '../services/calculationService.js';
import { createInspectionLifecycleRouter } from './inspectionRouteFactory.js';
import { AppError } from '../utils/errors.js';

export default createInspectionLifecycleRouter({
  model: ShrinkageInspection,
  inspectionType: 'shrinkage',
  moduleKey: 'shrinkage',
  reportPrefix: 'QF29',
  extraPopulates: [
    { path: 'orderId', select: 'code orderNumber orderQuantity' },
    { path: 'buyerId', select: 'code name' },
    { path: 'styleId', select: 'code styleNumber name' },
    { path: 'supplierId', select: 'code name' },
    { path: 'fabricId', select: 'code name' },
    { path: 'colourId', select: 'code name' },
    { path: 'gsmId', select: 'code name value' },
    { path: 'specificationId', select: 'code title version' },
  ],
  buildExtraFilter: (query) => {
    const f = {};
    if (query.overallResult) f['summaryResults.overallResult'] = query.overallResult;
    return f;
  },
  extraRoutes: (router) => {
    // Override endpoint for QA Manager / Admin
    router.post('/:id/override', async (req, res, next) => {
      try {
        if (!['Admin', 'Quality Manager'].includes(req.user.role)) {
          throw new AppError('Only Quality Managers and Administrators can override inspection results.', 403);
        }
        const { overrideReason, newResult = 'PASS' } = req.body;
        if (!overrideReason || !overrideReason.trim()) {
          throw new AppError('A recorded justification is required to override inspection results.', 400);
        }

        const record = await ShrinkageInspection.findById(req.params.id);
        if (!record) throw new AppError('Shrinkage report not found.', 404);

        record.isOverridden = true;
        record.overrideReason = overrideReason.trim();
        record.overrideBy = req.user._id;
        record.overrideAt = new Date();
        record.summaryResults.overallResult = newResult;
        await record.save();

        res.json({ success: true, data: record, message: 'Inspection result successfully overridden.' });
      } catch (err) {
        next(err);
      }
    });
  },
  buildPayload: async ({ req, config, existing }) => {
    const {
      orderId,
      buyerId,
      styleId,
      fabricId,
      colourId,
      gsmId,
      supplierId,
      specificationId,
      inspectionDate,
      headerSnapshot = {},
      toleranceConfig = {},
      garmentMeasurements = [],
      fabricMeasurements = [],
      gsmTesting = {},
      colourFastness = {},
      processDetail = {},
      spirality = {},
      remarks = '',
      correctiveAction = '',
      retestRequired = false,
      retestOfReportId = null,
      retestReason = '',
      icLabSignature = '',
      icQadSignature = '',
      receivedBySignature = '',
    } = req.body;

    const validDate = new Date(inspectionDate || Date.now());
    if (Number.isNaN(validDate.getTime())) {
      throw new AppError('Valid inspection date is required.', 400);
    }

    let resolvedBuyerName = headerSnapshot.buyerName || '';
    let resolvedOrderNumber = headerSnapshot.orderNumber || '';
    let resolvedStyleNumber = headerSnapshot.styleNumber || '';
    let resolvedFabricName = headerSnapshot.fabricName || '';
    let resolvedSupplierName = headerSnapshot.supplierName || '';
    let resolvedColourName = headerSnapshot.colourName || '';
    let resolvedGsm = headerSnapshot.requiredGsm || 0;

    if (orderId) {
      const ord = await Order.findById(orderId)
        .populate('buyerId', 'name')
        .populate('styleId', 'styleNumber name')
        .populate('supplierId', 'name')
        .populate('fabricId', 'name')
        .populate('gsmId', 'value')
        .populate('colourId', 'name')
        .lean();
      if (ord) {
        resolvedOrderNumber = ord.orderNumber;
        resolvedBuyerName = ord.buyerId?.name || resolvedBuyerName;
        resolvedStyleNumber = ord.styleId?.styleNumber || resolvedStyleNumber;
        resolvedFabricName = ord.fabricId?.name || resolvedFabricName;
        resolvedSupplierName = ord.supplierId?.name || resolvedSupplierName;
        resolvedColourName = ord.colourId?.name || resolvedColourName;
        resolvedGsm = ord.gsmId?.value || resolvedGsm;
      }
    }

    // Default parameters for standard rows if empty
    const defaultPoints = ['CHEST', 'BOTTOM', 'CBL', 'HPS', 'S.LENGTH'];
    const filledGarment =
      garmentMeasurements.length > 0
        ? garmentMeasurements
        : defaultPoints.map((p) => ({ point: p, bw: 0, aw: 0, spec: '+2% to -5%' }));
    const filledFabric =
      fabricMeasurements.length > 0
        ? fabricMeasurements
        : defaultPoints.map((p) => ({ point: p, bw: 0, aw: 0, spec: '+2% to -5%' }));

    // Run automated calculations
    const calcResult = calculateShrinkageInspection({
      toleranceConfig,
      garmentMeasurements: filledGarment,
      fabricMeasurements: filledFabric,
      gsmTesting: { ...gsmTesting, requiredGsm: resolvedGsm || gsmTesting.requiredGsm },
      colourFastness,
      processDetail,
      spirality,
      headerSnapshot: { ...headerSnapshot, requiredGsm: resolvedGsm },
    });

    return {
      orderId: orderId || null,
      buyerId: buyerId || null,
      styleId: styleId || null,
      fabricId: fabricId || null,
      colourId: colourId || null,
      gsmId: gsmId || null,
      supplierId: supplierId || null,
      specificationId: specificationId || null,
      inspectionDate: validDate,
      headerSnapshot: {
        orderNumber: resolvedOrderNumber,
        buyerName: resolvedBuyerName,
        styleNumber: resolvedStyleNumber,
        fabricName: resolvedFabricName,
        supplierName: resolvedSupplierName,
        colourName: resolvedColourName,
        requiredGsm: resolvedGsm,
        lotNumber: headerSnapshot.lotNumber || '',
        sampleIdentification: headerSnapshot.sampleIdentification || '',
        allowedShrinkage: headerSnapshot.allowedShrinkage || '+2% -5%',
      },
      toleranceConfig: {
        minShrinkage: toleranceConfig.minShrinkage ?? -5,
        maxShrinkage: toleranceConfig.maxShrinkage ?? 2,
        gsmTolerancePercent: toleranceConfig.gsmTolerancePercent ?? 5,
        burstingStrengthMin: toleranceConfig.burstingStrengthMin ?? 250,
        attachmentMinNewton: toleranceConfig.attachmentMinNewton ?? 70,
        spiralityMaxPercent: toleranceConfig.spiralityMaxPercent ?? 4,
      },
      garmentMeasurements: calcResult.garmentMeasurements,
      fabricMeasurements: calcResult.fabricMeasurements,
      gsmTesting: calcResult.gsmTesting,
      colourFastness: calcResult.colourFastness,
      processDetail: calcResult.processDetail,
      spirality: calcResult.spirality,
      summaryResults: calcResult.summaryResults,
      remarks,
      correctiveAction,
      retestRequired: Boolean(retestRequired),
      retestOfReportId: retestOfReportId || null,
      retestReason,
      icLabSignature: icLabSignature || (req.user?.name ? `${req.user.name} (Lab)` : ''),
      icQadSignature,
      receivedBySignature,
    };
  },
});

