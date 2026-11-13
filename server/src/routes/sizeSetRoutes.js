import { SizeSetInspection } from '../models/inspections/SizeSetInspection.js';
import { Order, ProductionLine } from '../models/masters/index.js';
import { calculateSizeSet } from '../services/calculationService.js';
import { createInspectionLifecycleRouter } from './inspectionRouteFactory.js';
import { AppError } from '../utils/errors.js';

function sanitizeChecklist(items = [], defaultItems = [], allowNA = false, existingItems = []) {
  const source = Array.isArray(items) && items.length > 0 ? items : defaultItems;
  const existingMap = new Map((existingItems || []).map((i) => [i.itemKey, i]));
  return source.map((item, idx) => {
    const status = ['OK', 'Not OK', 'N/A', 'Pending'].includes(item.status)
      ? item.status
      : 'Pending';
    const wasAlreadyNA = existingMap.get(item.itemKey)?.status === 'N/A';
    if (status === 'N/A' && !allowNA && !wasAlreadyNA) {
      throw new AppError(
        `Your role is not authorized to mark checklist item '${item.label || item.itemKey}' as N/A.`,
        403
      );
    }
    return {
      itemKey: String(item.itemKey || `item_${idx + 1}`).trim(),
      label: String(item.label || `Item ${idx + 1}`).trim(),
      status,
      isCritical: Boolean(item.isCritical),
      remarks: String(item.remarks || '').trim(),
      attachmentIds: Array.isArray(item.attachmentIds) ? item.attachmentIds : [],
    };
  });
}

export default createInspectionLifecycleRouter({
  model: SizeSetInspection,
  inspectionType: 'size_set',
  moduleKey: 'sizeSet',
  reportPrefix: 'SS',
  extraPopulates: [
    { path: 'orderId', select: 'code orderNumber orderQuantity' },
    { path: 'buyerId', select: 'code name' },
    { path: 'styleId', select: 'code styleNumber name description' },
    { path: 'productionLineId', select: 'code name' },
  ],
  buildExtraFilter: (query) => {
    const f = {};
    if (query.inspectionStage) f.inspectionStage = query.inspectionStage;
    if (query.finalDecision) f.finalDecision = query.finalDecision;
    return f;
  },
  buildPayload: async ({ req, config, existing }) => {
    const {
      orderId,
      inspectionStage,
      inspectionDate,
      productionLineId = null,
      accessories,
      workmanship,
      labelling,
      ppsTopStatus = '',
      productionStatus = '',
      finalDecision = 'Pending',
      comments = '',
    } = req.body;

    if (!orderId) throw new AppError('Order selection is required.', 400);
    if (!['Size Set', 'Pilot Run', 'In-line', 'Mid-line'].includes(inspectionStage)) {
      throw new AppError('Valid inspection stage (Size Set, Pilot Run, In-line, or Mid-line) is required.', 400);
    }
    const validDate = new Date(inspectionDate);
    if (!inspectionDate || Number.isNaN(validDate.getTime())) {
      throw new AppError('Valid inspection date is required.', 400);
    }

    const order = await Order.findById(orderId)
      .populate('buyerId', 'name')
      .populate('styleId', 'styleNumber name description')
      .populate('supplierId', 'name')
      .populate('fabricId', 'name')
      .populate('gsmId', 'name value')
      .populate('colourId', 'name')
      .populate('sizeRangeId', 'name sizes')
      .lean();
    if (!order) throw new AppError('Selected Order does not exist.', 404);

    const orderStyleIdStr = (order.styleId?._id || order.styleId)?.toString();
    const orderBuyerIdStr = (order.buyerId?._id || order.buyerId)?.toString();

    if (orderStyleIdStr && req.body.styleId && req.body.styleId.toString() !== orderStyleIdStr) {
      throw new AppError('Selected Style does not match the selected Order.', 400);
    }
    if (orderBuyerIdStr && req.body.buyerId && req.body.buyerId.toString() !== orderBuyerIdStr) {
      throw new AppError('Selected Buyer does not match the selected Order.', 400);
    }

    let line = null;
    if (productionLineId) {
      line = await ProductionLine.findById(productionLineId).lean();
      if (!line) throw new AppError('Selected Production Line does not exist.', 404);
    }

    const allowNA =
      req.user.role === 'Admin' ||
      Boolean(req.permissions?.sizeSet?.markNA) ||
      (Array.isArray(config.allowNAForRoles) && config.allowNAForRoles.includes(req.user.role));

    const accList = sanitizeChecklist(
      accessories,
      (config.accessoriesChecklist || []).filter((i) => i.isActive !== false),
      allowNA,
      existing?.accessories
    );
    const wrkList = sanitizeChecklist(
      workmanship,
      (config.workmanshipChecklist || []).filter((i) => i.isActive !== false),
      allowNA,
      existing?.workmanship
    );
    const lblList = sanitizeChecklist(
      labelling,
      (config.labellingChecklist || []).filter((i) => i.isActive !== false),
      allowNA,
      existing?.labelling
    );

    const calculations = calculateSizeSet(
      { accessories: accList, workmanship: wrkList, labelling: lblList },
      config
    );

    return {
      inspectionStage,
      inspectionDate: validDate,
      orderId: order._id,
      buyerId: order.buyerId?._id || order.buyerId,
      styleId: order.styleId?._id || order.styleId,
      supplierId: order.supplierId?._id || order.supplierId || null,
      fabricId: order.fabricId?._id || order.fabricId || null,
      gsmId: order.gsmId?._id || order.gsmId || null,
      colourId: order.colourId?._id || order.colourId || null,
      sizeRangeId: order.sizeRangeId?._id || order.sizeRangeId || null,
      productionLineId: line?._id || null,
      headerSnapshot: {
        buyerName: order.buyerId?.name || '',
        description: order.styleDescription || order.styleId?.description || '',
        styleNumber: order.styleId?.styleNumber || '',
        orderNumber: order.orderNumber || '',
        supplierName: order.supplierId?.name || '',
        fabricName: order.fabricId?.name || '',
        gsmLabel: order.gsmId?.name || '',
        orderQuantity: order.orderQuantity || 0,
        colourName: order.colourId?.name || '',
        sizeRangeName: order.sizeRangeId?.name || '',
        productionLineName: line?.name || '',
      },
      accessories: accList,
      workmanship: wrkList,
      labelling: lblList,
      calculations,
      ppsTopStatus: String(ppsTopStatus || '').trim(),
      productionStatus: String(productionStatus || '').trim(),
      finalDecision: ['Pending', 'Accepted', 'Rework', 'Hold'].includes(finalDecision)
        ? finalDecision
        : 'Pending',
      comments: String(comments || '').trim(),
    };
  },
});

