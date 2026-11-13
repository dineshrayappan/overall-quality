import { MeasurementInspection } from '../models/inspections/MeasurementInspection.js';
import {
  Buyer,
  Colour,
  Fabric,
  Gsm,
  MeasurementSpec,
  Order,
  ProductionLine,
  Style,
  Supplier,
} from '../models/masters/index.js';
import { calculateMeasurementRows } from '../services/calculationService.js';
import { createInspectionLifecycleRouter } from './inspectionRouteFactory.js';
import { AppError } from '../utils/errors.js';

export default createInspectionLifecycleRouter({
  model: MeasurementInspection,
  inspectionType: 'measurement',
  moduleKey: 'measurement',
  reportPrefix: 'MS',
  extraPopulates: [
    { path: 'orderId', select: 'code orderNumber orderQuantity' },
    { path: 'buyerId', select: 'code name' },
    { path: 'styleId', select: 'code styleNumber name description' },
    { path: 'supplierId', select: 'code name' },
    { path: 'productionLineId', select: 'code name' },
  ],
  buildExtraFilter: (query) => {
    const f = {};
    if (query.inspectionStage) f.inspectionStage = query.inspectionStage;
    if (query.overallResult) f['summary.overallResult'] = query.overallResult;
    return f;
  },
  buildPayload: async ({ req }) => {
    const {
      orderId = null,
      buyerId,
      styleId,
      supplierId = null,
      fabricId = null,
      gsmId = null,
      colourId = null,
      productionLineId = null,
      inspectionDate,
      inspectionStage = 'In-line',
      selectedSizes = [],
      rows = [],
      remarks = '',
      specialComments = '',
      attachmentIds = [],
    } = req.body;

    const validDate = new Date(inspectionDate);
    if (!inspectionDate || Number.isNaN(validDate.getTime())) {
      throw new AppError('Valid inspection date is required.', 400);
    }

    let order = null;
    if (orderId) {
      order = await Order.findById(orderId)
        .populate('buyerId', 'name')
        .populate('styleId', 'styleNumber name description')
        .populate('supplierId', 'name')
        .populate('fabricId', 'name')
        .populate('gsmId', 'name value')
        .populate('colourId', 'name')
        .lean();
      if (!order) throw new AppError('Selected Order does not exist.', 404);
    }

    const resolvedStyleId = styleId || order?.styleId?._id;
    const resolvedBuyerId = buyerId || order?.buyerId?._id;
    if (!resolvedStyleId) throw new AppError('Style is required.', 400);
    if (!resolvedBuyerId) throw new AppError('Buyer is required.', 400);

    if (order && styleId && styleId.toString() !== order.styleId?._id?.toString()) {
      throw new AppError('Selected Style does not match the selected Order.', 400);
    }
    if (order && buyerId && buyerId.toString() !== order.buyerId?._id?.toString()) {
      throw new AppError('Selected Buyer does not match the selected Order.', 400);
    }

    const [style, buyer, supplier, fabric, gsm, colour, line] = await Promise.all([
      Style.findById(resolvedStyleId).lean(),
      Buyer.findById(resolvedBuyerId).lean(),
      (supplierId || order?.supplierId?._id)
        ? Supplier.findById(supplierId || order?.supplierId?._id).lean()
        : null,
      (fabricId || order?.fabricId?._id)
        ? Fabric.findById(fabricId || order?.fabricId?._id).lean()
        : null,
      (gsmId || order?.gsmId?._id) ? Gsm.findById(gsmId || order?.gsmId?._id).lean() : null,
      (colourId || order?.colourId?._id)
        ? Colour.findById(colourId || order?.colourId?._id).lean()
        : null,
      productionLineId ? ProductionLine.findById(productionLineId).lean() : null,
    ]);

    if (!style) throw new AppError('Selected Style does not exist.', 404);
    if (!buyer) throw new AppError('Selected Buyer does not exist.', 404);

    // Hydrate from MeasurementSpec master where specId is provided so tolerances are authoritative
    const specIds = rows.map((r) => r.specId).filter(Boolean);
    const specs = specIds.length
      ? await MeasurementSpec.find({ _id: { $in: specIds } }).lean()
      : [];
    const specMap = new Map(specs.map((s) => [s._id.toString(), s]));

    const hydratedRows = rows.map((r) => {
      const spec = r.specId ? specMap.get(String(r.specId)) : null;
      return {
        ...r,
        size: r.size || spec?.size,
        measurementPoint: r.measurementPoint || spec?.measurementPoint,
        measurementDescription: r.measurementDescription ?? spec?.measurementDescription ?? '',
        unit: r.unit || spec?.unit || 'cm',
        approvedSpec: spec ? spec.approvedSpec : r.approvedSpec,
        upperTolerance: spec ? spec.upperTolerance : r.upperTolerance,
        lowerTolerance: spec ? spec.lowerTolerance : r.lowerTolerance,
      };
    });

    const calculated = calculateMeasurementRows(hydratedRows);
    const derivedSizes =
      Array.isArray(selectedSizes) && selectedSizes.length > 0
        ? selectedSizes
        : [...new Set(calculated.rows.map((r) => r.size))];

    return {
      inspectionStage: String(inspectionStage || 'In-line').trim(),
      inspectionDate: validDate,
      orderId: order?._id || null,
      buyerId: buyer._id,
      styleId: style._id,
      supplierId: supplier?._id || null,
      fabricId: fabric?._id || null,
      gsmId: gsm?._id || null,
      colourId: colour?._id || null,
      productionLineId: line?._id || null,
      headerSnapshot: {
        styleNumber: style.styleNumber || '',
        styleDescription: order?.styleDescription || style.description || style.name || '',
        fabricName: fabric?.name || '',
        gsmLabel: gsm?.name || '',
        colourName: colour?.name || '',
        orderQuantity: order?.orderQuantity || Number(req.body.orderQuantity || 0),
        orderNumber: order?.orderNumber || '',
        buyerName: buyer.name || '',
        supplierName: supplier?.name || '',
        productionLineName: line?.name || '',
      },
      selectedSizes: derivedSizes,
      rows: calculated.rows,
      summary: calculated.summary,
      remarks: String(remarks || '').trim(),
      specialComments: String(specialComments || '').trim(),
      attachmentIds: Array.isArray(attachmentIds) ? attachmentIds : [],
    };
  },
});

