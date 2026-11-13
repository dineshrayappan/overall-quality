import { FourPointInspection } from '../models/inspections/FourPointInspection.js';
import { Order, Buyer, Style, Fabric, Colour, Gsm, Supplier } from '../models/masters/index.js';
import { calculateFourPointInspection } from '../services/calculationService.js';
import { createInspectionLifecycleRouter } from './inspectionRouteFactory.js';
import { AppError } from '../utils/errors.js';

export default createInspectionLifecycleRouter({
  model: FourPointInspection,
  inspectionType: 'four_point',
  moduleKey: 'fourPoint',
  reportPrefix: 'QF30',
  extraPopulates: [
    { path: 'orderId', select: 'code orderNumber orderQuantity' },
    { path: 'buyerId', select: 'code name' },
    { path: 'styleId', select: 'code styleNumber name' },
    { path: 'supplierId', select: 'code name' },
    { path: 'fabricId', select: 'code name' },
    { path: 'colourId', select: 'code name' },
    { path: 'gsmId', select: 'code name value' },
    { path: 'specificationId', select: 'code title' },
  ],
  buildExtraFilter: (query) => {
    const f = {};
    if (query.finalBatchResult) f['batchSummary.finalBatchResult'] = query.finalBatchResult;
    return f;
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
      isTubularFabric = true,
      acceptanceCriteria = {},
      rolls = [],
      inspectorRemarks = '',
      checkerSignature = '',
      labIcSignature = '',
      retestRequired = false,
      retestOfReportId = null,
    } = req.body;

    const validDate = new Date(inspectionDate || Date.now());
    if (Number.isNaN(validDate.getTime())) {
      throw new AppError('Valid inspection date is required.', 400);
    }

    let resolvedBuyerName = headerSnapshot.buyerName || '';
    let resolvedOrderNumber = headerSnapshot.orderNumber || '';
    let resolvedStyleNumber = headerSnapshot.styleNumber || '';
    let resolvedFabricName = headerSnapshot.fabricDescription || '';
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
        resolvedColourName = ord.colourId?.name || resolvedColourName;
        resolvedGsm = ord.gsmId?.value || resolvedGsm;
      }
    }

    // Run 4-point calculation engine
    const calc = calculateFourPointInspection({
      acceptanceCriteria,
      isTubularFabric,
      rolls,
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
        fabricDescription: resolvedFabricName,
        colourName: resolvedColourName,
        requiredGsm: resolvedGsm,
        yarnMill: headerSnapshot.yarnMill || '',
        knittingName: headerSnapshot.knittingName || '',
        countDia: headerSnapshot.countDia || '',
        dcNumber: headerSnapshot.dcNumber || '',
        rollNumberSummary: headerSnapshot.rollNumberSummary || '',
        totalReceivedWeight: Number(headerSnapshot.totalReceivedWeight || 0),
        inspectionQuantityYards: Number(headerSnapshot.inspectionQuantityYards || calc.batchSummary.totalInspectedYards || 0),
      },
      isTubularFabric: Boolean(isTubularFabric),
      acceptanceCriteria: {
        rollMaxPointsPer100SqYds: Number(acceptanceCriteria.rollMaxPointsPer100SqYds ?? 28),
        batchMaxPointsPer100SqYds: Number(acceptanceCriteria.batchMaxPointsPer100SqYds ?? 20),
      },
      rolls: calc.rolls,
      batchSummary: calc.batchSummary,
      retestRequired: Boolean(retestRequired),
      retestOfReportId: retestOfReportId || null,
      inspectorRemarks,
      checkerSignature,
      labIcSignature,
    };
  },
});

