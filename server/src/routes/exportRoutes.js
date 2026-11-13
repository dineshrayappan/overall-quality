import express from 'express';
import { TargetChart } from '../models/inspections/TargetChart.js';
import { SizeSetInspection } from '../models/inspections/SizeSetInspection.js';
import { SevenPointInspection } from '../models/inspections/SevenPointInspection.js';
import { MeasurementInspection } from '../models/inspections/MeasurementInspection.js';
import { ShrinkageInspection } from '../models/inspections/ShrinkageInspection.js';
import { FourPointInspection } from '../models/inspections/FourPointInspection.js';
import { AccessoriesInspection } from '../models/inspections/AccessoriesInspection.js';
import { authenticate } from '../middleware/auth.js';
import { assertRecordAccess, requirePermission } from '../middleware/rbac.js';
import { generateInspectionPdfBuffer } from '../services/pdfService.js';
import {
  generateIndividualExcelBuffer,
  generateReportExportExcelBuffer,
} from '../services/excelService.js';
import { AppError, asyncHandler } from '../utils/errors.js';

const router = express.Router();
router.use(authenticate);

const MODULE_MAP = {
  target_chart: { model: TargetChart, moduleKey: 'targetChart' },
  'target-charts': { model: TargetChart, moduleKey: 'targetChart', type: 'target_chart' },
  size_set: { model: SizeSetInspection, moduleKey: 'sizeSet' },
  'size-set': { model: SizeSetInspection, moduleKey: 'sizeSet', type: 'size_set' },
  'size-sets': { model: SizeSetInspection, moduleKey: 'sizeSet', type: 'size_set' },
  seven_point: { model: SevenPointInspection, moduleKey: 'sevenPoint' },
  'seven-point': { model: SevenPointInspection, moduleKey: 'sevenPoint', type: 'seven_point' },
  'seven-points': { model: SevenPointInspection, moduleKey: 'sevenPoint', type: 'seven_point' },
  measurement: { model: MeasurementInspection, moduleKey: 'measurement' },
  measurements: { model: MeasurementInspection, moduleKey: 'measurement', type: 'measurement' },
  shrinkage: { model: ShrinkageInspection, moduleKey: 'shrinkage', type: 'shrinkage' },
  'four-point': { model: FourPointInspection, moduleKey: 'fourPoint', type: 'four_point' },
  four_point: { model: FourPointInspection, moduleKey: 'fourPoint', type: 'four_point' },
  accessories: { model: AccessoriesInspection, moduleKey: 'accessories', type: 'accessories' },
};

async function loadScopedReport(req, moduleParam, id) {
  const entry = MODULE_MAP[moduleParam];
  if (!entry) throw new AppError(`Unknown report module '${moduleParam}'.`, 404);
  const inspectionType = entry.type || moduleParam;
  const doc = await entry.model.findById(id).lean();
  if (!doc) throw new AppError('Inspection report not found.', 404);
  assertRecordAccess(req, entry.moduleKey, doc);
  return { inspectionType, doc };
}

router.get(
  '/pdf/:module/:id',
  requirePermission('exports', 'pdf'),
  asyncHandler(async (req, res) => {
    const { inspectionType, doc } = await loadScopedReport(req, req.params.module, req.params.id);
    const pdfBuffer = await generateInspectionPdfBuffer(inspectionType, doc);
    const disposition = req.query.inline === 'true' ? 'inline' : 'attachment';
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `${disposition}; filename="${doc.reportNumber}.pdf"`
    );
    res.send(pdfBuffer);
  })
);

router.get(
  '/excel/individual/:module/:id',
  requirePermission('exports', 'excel'),
  asyncHandler(async (req, res) => {
    const { inspectionType, doc } = await loadScopedReport(req, req.params.module, req.params.id);
    const buffer = await generateIndividualExcelBuffer(inspectionType, doc);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${doc.reportNumber}.xlsx"`
    );
    res.send(Buffer.from(buffer));
  })
);

router.get(
  '/excel',
  requirePermission('exports', 'excel'),
  asyncHandler(async (req, res) => {
    const reportType = req.query.reportType || 'combined';
    const buffer = await generateReportExportExcelBuffer(req, req.query);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="qms-${reportType}-${new Date().toISOString().slice(0, 10)}.xlsx"`
    );
    res.send(Buffer.from(buffer));
  })
);

export default router;
