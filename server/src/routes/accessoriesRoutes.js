import { AccessoriesInspection } from '../models/inspections/AccessoriesInspection.js';
import { Order, Buyer, Style, Supplier, Accessory } from '../models/masters/index.js';
import { calculateAccessoriesInspection } from '../services/calculationService.js';
import { createInspectionLifecycleRouter } from './inspectionRouteFactory.js';
import { AppError } from '../utils/errors.js';

export const DEFAULT_ACCESSORIES_CHECKLIST = [
  { parameterKey: 'material', label: 'Material', isMandatory: true },
  { parameterKey: 'colour_matching', label: 'Colour matching', isMandatory: true },
  { parameterKey: 'content_text', label: 'Content / Text', isMandatory: true },
  { parameterKey: 'design', label: 'Design', isMandatory: true },
  { parameterKey: 'position_design', label: 'Position of design', isMandatory: false },
  { parameterKey: 'size_material', label: 'Size of material', isMandatory: true },
  { parameterKey: 'uniformity', label: 'Uniformity', isMandatory: false },
  { parameterKey: 'fibre_composition', label: 'Fibre composition details', isMandatory: true },
  { parameterKey: 'wash_care_symbol', label: 'Wash care symbol marking', isMandatory: true },
  { parameterKey: 'weight_material', label: 'Weight of material (GSM or thickness)', isMandatory: false },
  { parameterKey: 'breaking_strength', label: 'Breaking strength (if hanger)', isMandatory: false },
  { parameterKey: 'physical_testing', label: 'Physical testing, if any', isMandatory: false },
  { parameterKey: 'lab_testing', label: 'Lab testing, if required', isMandatory: false },
];

export default createInspectionLifecycleRouter({
  model: AccessoriesInspection,
  inspectionType: 'accessories',
  moduleKey: 'accessories',
  reportPrefix: 'QAD5',
  extraPopulates: [
    { path: 'orderId', select: 'code orderNumber orderQuantity' },
    { path: 'buyerId', select: 'code name' },
    { path: 'styleId', select: 'code styleNumber name' },
    { path: 'supplierId', select: 'code name' },
    { path: 'accessoryId', select: 'code name category approvedSpec' },
    { path: 'specificationId', select: 'code title' },
  ],
  buildExtraFilter: (query) => {
    const f = {};
    if (query.finalResult) f.finalResult = query.finalResult;
    return f;
  },
  buildPayload: async ({ req, config, existing }) => {
    const {
      inOrNo = '',
      orderId,
      buyerId,
      styleId,
      supplierId,
      accessoryId,
      specificationId,
      inspectionDate,
      headerSnapshot = {},
      receivedDate,
      receivedQuantity = 0,
      inspectedQuantity = 0,
      checklist = [],
      inspectedBy = '',
      verifiedBy = '',
      approvedBy = '',
      remarks = '',
      correctiveAction = '',
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
    let resolvedSupplierName = headerSnapshot.supplierName || '';
    let resolvedAccDescription = headerSnapshot.accessoryDescription || '';

    if (orderId) {
      const ord = await Order.findById(orderId)
        .populate('buyerId', 'name')
        .populate('styleId', 'styleNumber name')
        .populate('supplierId', 'name')
        .lean();
      if (ord) {
        resolvedOrderNumber = ord.orderNumber;
        resolvedBuyerName = ord.buyerId?.name || resolvedBuyerName;
        resolvedStyleNumber = ord.styleId?.styleNumber || resolvedStyleNumber;
        resolvedSupplierName = ord.supplierId?.name || resolvedSupplierName;
      }
    }

    if (accessoryId && !resolvedAccDescription) {
      const acc = await Accessory.findById(accessoryId).lean();
      if (acc) {
        resolvedAccDescription = `${acc.name} (${acc.approvedSpec || acc.category})`;
      }
    }

    // Merge or initialize 13 standard parameters
    const sourceChecklist =
      Array.isArray(checklist) && checklist.length > 0
        ? checklist
        : DEFAULT_ACCESSORIES_CHECKLIST.map((param) => ({
            parameterKey: param.parameterKey,
            label: param.label,
            isMandatory: param.isMandatory,
            status: 'OK',
            comments: '',
            attachmentIds: [],
          }));

    const calc = calculateAccessoriesInspection({
      receivedQuantity,
      inspectedQuantity,
      checklist: sourceChecklist,
    });

    return {
      inOrNo: inOrNo.trim(),
      orderId: orderId || null,
      buyerId: buyerId || null,
      styleId: styleId || null,
      supplierId: supplierId || null,
      accessoryId: accessoryId || null,
      specificationId: specificationId || null,
      inspectionDate: validDate,
      headerSnapshot: {
        orderNumber: resolvedOrderNumber,
        buyerName: resolvedBuyerName,
        styleNumber: resolvedStyleNumber,
        supplierName: resolvedSupplierName,
        accessoryDescription: resolvedAccDescription,
        poNumber: headerSnapshot.poNumber || '',
        dcNumber: headerSnapshot.dcNumber || '',
      },
      receivedDate: receivedDate ? new Date(receivedDate) : new Date(),
      receivedQuantity: Number(receivedQuantity || 0),
      inspectedQuantity: Number(inspectedQuantity || 0),
      acceptedQuantity: calc.acceptedQuantity,
      rejectedQuantity: calc.rejectedQuantity,
      inspectionPercentage: calc.inspectionPercentage,
      checklist: calc.checklist,
      calculations: calc.calculations,
      finalResult: calc.finalResult,
      retestRequired: Boolean(retestRequired),
      retestOfReportId: retestOfReportId || null,
      inspectedBy: inspectedBy || (req.user?.name ? `${req.user.name}` : ''),
      verifiedBy,
      approvedBy,
      remarks,
      correctiveAction,
    };
  },
});

