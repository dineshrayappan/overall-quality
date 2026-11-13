import { SevenPointInspection } from '../models/inspections/SevenPointInspection.js';
import {
  Employee,
  Machine,
  Needle,
  Order,
  Process,
  ProductionLine,
} from '../models/masters/index.js';
import { calculateSevenPoint } from '../services/calculationService.js';
import { createInspectionLifecycleRouter } from './inspectionRouteFactory.js';
import { AppError } from '../utils/errors.js';

export default createInspectionLifecycleRouter({
  model: SevenPointInspection,
  inspectionType: 'seven_point',
  moduleKey: 'sevenPoint',
  reportPrefix: '7P',
  extraPopulates: [
    { path: 'orderId', select: 'code orderNumber orderQuantity' },
    { path: 'buyerId', select: 'code name' },
    { path: 'styleId', select: 'code styleNumber name' },
    { path: 'productionLineId', select: 'code name' },
  ],
  buildPayload: async ({ req, config, existing }) => {
    const orderId = req.body.orderId || existing?.orderId?._id || existing?.orderId;
    const productionLineId = req.body.productionLineId !== undefined ? req.body.productionLineId : (existing?.productionLineId?._id || existing?.productionLineId || null);
    const inspectionDate = req.body.inspectionDate || existing?.inspectionDate;
    const entries = req.body.entries || existing?.entries || [];
    const remarks = req.body.remarks !== undefined ? req.body.remarks : (existing?.remarks || '');
    const sNo = req.body.sNo || existing?.sNo || '';
    const qcName = req.body.qcName || existing?.qcName || '';
    const overrideReason = req.body.overrideReason !== undefined ? req.body.overrideReason : (existing?.overrideReason || '');

    if (!orderId) throw new AppError('Order selection is required.', 400);
    const validDate = new Date(inspectionDate);
    if (!inspectionDate || Number.isNaN(validDate.getTime())) {
      throw new AppError('Valid inspection date is required.', 400);
    }

    const order = await Order.findById(orderId)
      .populate('buyerId', 'name')
      .populate('styleId', 'styleNumber name')
      .populate('fabricId', 'name')
      .populate('colourId', 'name')
      .lean();
    if (!order) throw new AppError('Selected Order does not exist.', 404);

    const orderStyleIdStr = (order.styleId?._id || order.styleId)?.toString();
    if (orderStyleIdStr && req.body.styleId && req.body.styleId.toString() !== orderStyleIdStr) {
      throw new AppError('Selected Style does not match the selected Order.', 400);
    }

    let line = null;
    if (productionLineId) {
      line = await ProductionLine.findById(productionLineId).lean();
      if (!line) throw new AppError('Selected Production Line does not exist.', 404);
    }

    if (!Array.isArray(entries) || entries.length === 0) {
      throw new AppError('At least one employee/process inspection entry is required.', 400);
    }

    const activeCheckpoints = (config.checkpoints || []).filter((c) => c.isActive !== false);
    const configuredCheckpointCount = Number(
      config.checkpointCount || activeCheckpoints.length || 10
    );
    const checkpointDefinitions = activeCheckpoints.slice(0, configuredCheckpointCount).map((c, idx) => ({
      checkpointNumber: c.checkpointNumber || idx + 1,
      label: c.label || `Point ${idx + 1}`,
      description: c.description || '',
    }));

    const employeeIds = entries.map((e) => e.employeeId).filter(Boolean);
    const processIds = entries.map((e) => e.processId).filter(Boolean);
    const machineIds = entries.map((e) => e.machineId).filter(Boolean);
    const needleIds = entries.map((e) => e.needleId).filter(Boolean);

    const [emps, procs, machs, needles] = await Promise.all([
      Employee.find({ _id: { $in: employeeIds } }).lean(),
      Process.find({ _id: { $in: processIds } }).lean(),
      machineIds.length ? Machine.find({ _id: { $in: machineIds } }).lean() : [],
      needleIds.length ? Needle.find({ _id: { $in: needleIds } }).lean() : [],
    ]);

    const empMap = new Map(emps.map((d) => [d._id.toString(), d]));
    const procMap = new Map(procs.map((d) => [d._id.toString(), d]));
    const machMap = new Map(machs.map((d) => [d._id.toString(), d]));
    const needleMap = new Map(needles.map((d) => [d._id.toString(), d]));

    const resolvedEntries = entries.map((e, idx) => {
      const emp = empMap.get(String(e.employeeId || ''));
      const proc = procMap.get(String(e.processId || ''));
      if (!emp) throw new AppError(`Entry #${idx + 1}: Valid Employee from master is required.`, 400);
      if (!proc) throw new AppError(`Entry #${idx + 1}: Valid Process from master is required.`, 400);
      const mach = e.machineId ? machMap.get(String(e.machineId)) : null;
      const ndl = e.needleId ? needleMap.get(String(e.needleId)) : null;

      const cpList = checkpointDefinitions.map((def) => {
        const match = (e.checkpoints || []).find(
          (c) => Number(c.checkpointNumber) === Number(def.checkpointNumber)
        );
        return {
          checkpointNumber: def.checkpointNumber,
          label: def.label,
          result: String(match?.result || '').trim(),
          status: ['Pass', 'Fail', 'N/A'].includes(match?.status) ? match.status : 'Pass',
          defectDetails: String(match?.defectDetails || '').trim(),
          remarks: String(match?.remarks || '').trim(),
          inspectionTime: String(match?.inspectionTime || '').trim(),
        };
      });

      return {
        serialNumber: Number(e.serialNumber || idx + 1),
        employeeId: emp._id,
        employeeCode: emp.employeeCode,
        employeeName: emp.name,
        processId: proc._id,
        processName: proc.name,
        machineId: mach?._id || null,
        machineNumber: mach?.machineNumber || '',
        machineName: mach?.name || '',
        needleId: ndl?._id || null,
        needleNumber: ndl?.needleNumber || String(e.needleNumber || '').trim(),
        needleChangeTime: String(e.needleChangeTime || '').trim(),
        checkpoints: cpList,
        piecesChecked: Number(e.piecesChecked ?? 0),
        okPieces: Number(e.okPieces ?? 0),
        reworkPieces: Number(e.reworkPieces ?? 0),
        rejectedPieces: Number(e.rejectedPieces ?? 0),
        oilDefectCount: Number(e.oilDefectCount ?? 0),
        attachmentIds: Array.isArray(e.attachmentIds) ? e.attachmentIds : [],
      };
    });

    const totals = calculateSevenPoint(resolvedEntries, config, overrideReason);

    return {
      sNo: String(sNo || '').trim(),
      qcUserId: req.user._id,
      qcName: String(qcName || req.user.fullName).trim(),
      inspectionDate: validDate,
      orderId: order._id,
      buyerId: order.buyerId?._id || order.buyerId,
      styleId: order.styleId?._id || order.styleId,
      fabricId: order.fabricId?._id || order.fabricId || null,
      colourId: order.colourId?._id || order.colourId || null,
      productionLineId: line?._id || line || null,
      headerSnapshot: {
        styleNumber: order.styleId?.styleNumber || '',
        styleName: order.styleId?.name || '',
        fabricName: order.fabricId?.name || '',
        colourName: order.colourId?.name || '',
        orderNumber: order.orderNumber || '',
        buyerName: order.buyerId?.name || '',
        orderQuantity: order.orderQuantity || 0,
        productionLineName: line?.name || '',
      },
      configuredCheckpointCount,
      checkpointDefinitions,
      entries: resolvedEntries,
      totals,
      remarks: String(remarks || '').trim(),
    };
  },
});

