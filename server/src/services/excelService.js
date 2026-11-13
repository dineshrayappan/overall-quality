import ExcelJS from 'exceljs';
import { TargetChart } from '../models/inspections/TargetChart.js';
import { SizeSetInspection } from '../models/inspections/SizeSetInspection.js';
import { SevenPointInspection } from '../models/inspections/SevenPointInspection.js';
import { MeasurementInspection } from '../models/inspections/MeasurementInspection.js';
import { buildScopeFilter } from '../middleware/rbac.js';
import { roundTo } from './calculationService.js';

function styleHeaderRow(row) {
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };
    cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    };
  });
  row.height = 24;
}

function autoSizeSheet(sheet) {
  sheet.columns.forEach((col) => {
    let maxLen = 12;
    col.eachCell({ includeEmpty: true }, (cell) => {
      const len = String(cell.value ?? '').length;
      if (len + 3 > maxLen) maxLen = Math.min(48, len + 3);
    });
    col.width = maxLen;
  });
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
}

function formatDate(d) {
  return d ? new Date(d).toISOString().slice(0, 10) : '';
}

function buildFilter(req, moduleKey, queryParams, supportsOrderFields = true) {
  const f = { ...buildScopeFilter(req, moduleKey), isArchived: false };
  const {
    dateFrom = '',
    dateTo = '',
    buyerId = '',
    styleId = '',
    orderId = '',
    productionLineId = '',
    inspectionStage = '',
    inspectorId = '',
    approvalStatus = '',
  } = queryParams;

  if (dateFrom || dateTo) {
    f.inspectionDate = {};
    if (dateFrom) f.inspectionDate.$gte = new Date(dateFrom);
    if (dateTo) {
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      f.inspectionDate.$lte = end;
    }
  }
  if (productionLineId) f.productionLineId = productionLineId;
  if (inspectorId) f.inspectorId = inspectorId;
  if (approvalStatus) f.approvalStatus = approvalStatus;
  if (supportsOrderFields) {
    if (buyerId) f.buyerId = buyerId;
    if (styleId) f.styleId = styleId;
    if (orderId) f.orderId = orderId;
  }
  if (inspectionStage && ['sizeSet', 'measurement'].includes(moduleKey)) {
    f.inspectionStage = inspectionStage;
  }
  return f;
}

export async function generateIndividualExcelBuffer(inspectionType, doc) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Garment QMS';
  wb.created = new Date();

  if (inspectionType === 'target_chart') {
    const sheet = wb.addWorksheet('Target Chart');
    sheet.addRow([
      'Report Number',
      'Date',
      'Production Line',
      'Shift',
      'Indicator #',
      'Indicator Name',
      'Unit',
      'Target',
      'Actual',
      'Achievement %',
      'Level Reached',
      'Remarks',
    ]);
    styleHeaderRow(sheet.getRow(1));
    for (const ind of doc.indicators || []) {
      sheet.addRow([
        doc.reportNumber,
        formatDate(doc.inspectionDate),
        doc.productionLineName,
        doc.shift,
        ind.index,
        ind.name,
        ind.unit,
        ind.targetValue,
        ind.actualValue,
        ind.achievementPercentage,
        ind.levelReached,
        ind.remarks,
      ]);
    }
    sheet.addRow([
      'SUMMARY',
      '',
      '',
      '',
      '',
      '',
      '',
      doc.summary?.totalTarget ?? 0,
      doc.summary?.totalAchieved ?? 0,
      doc.summary?.achievementPercentage ?? 0,
      doc.approvalStatus,
      doc.remarks,
    ]);
    autoSizeSheet(sheet);
  } else if (inspectionType === 'size_set') {
    const sheet = wb.addWorksheet('Checklist Inspection');
    sheet.addRow([
      'Report Number',
      'Stage',
      'Date',
      'Buyer',
      'Style',
      'Order',
      'Section',
      'Item',
      'Critical',
      'Status',
      'Remarks',
    ]);
    styleHeaderRow(sheet.getRow(1));
    const h = doc.headerSnapshot || {};
    for (const [sec, items] of [
      ['Accessories', doc.accessories || []],
      ['Workmanship', doc.workmanship || []],
      ['Labelling', doc.labelling || []],
    ]) {
      for (const item of items) {
        sheet.addRow([
          doc.reportNumber,
          doc.inspectionStage,
          formatDate(doc.inspectionDate),
          h.buyerName,
          h.styleNumber,
          h.orderNumber,
          sec,
          item.label,
          item.isCritical ? 'Yes' : 'No',
          item.status,
          item.remarks,
        ]);
      }
    }
    autoSizeSheet(sheet);

    const sumSheet = wb.addWorksheet('Summary');
    sumSheet.addRow(['Metric', 'Value']);
    styleHeaderRow(sumSheet.getRow(1));
    const c = doc.calculations || {};
    sumSheet.addRows([
      ['Total Applicable Items', c.totalApplicableItems ?? 0],
      ['OK Items', c.totalOkItems ?? 0],
      ['Not OK Items', c.totalNotOkItems ?? 0],
      ['N/A Items', c.totalNaItems ?? 0],
      ['OK Percentage', `${c.overallOkPercentage ?? 0}%`],
      ['Not OK Percentage', `${c.overallNotOkPercentage ?? 0}%`],
      ['Final Decision', doc.finalDecision],
      ['Approval Status', doc.approvalStatus],
    ]);
    autoSizeSheet(sumSheet);
  } else if (inspectionType === 'seven_point') {
    const sheet = wb.addWorksheet('7 Point Inspection');
    const cpDefs = doc.checkpointDefinitions || [];
    sheet.addRow([
      'Report Number',
      'Date',
      'QC',
      'Style',
      'Order',
      'S.No',
      'Employee Code',
      'Employee Name',
      'Process',
      'Machine',
      'Needle',
      'Needle Change Time',
      ...cpDefs.map((c) => c.label),
      'Total Checked',
      'OK Pieces',
      'Rework Pieces',
      'Rejected Pieces',
      'Oil Defects',
    ]);
    styleHeaderRow(sheet.getRow(1));
    const h = doc.headerSnapshot || {};
    for (const e of doc.entries || []) {
      sheet.addRow([
        doc.reportNumber,
        formatDate(doc.inspectionDate),
        doc.qcName,
        h.styleNumber,
        h.orderNumber,
        e.serialNumber,
        e.employeeCode,
        e.employeeName,
        e.processName,
        e.machineNumber || e.machineName,
        e.needleNumber,
        e.needleChangeTime,
        ...cpDefs.map((d) => {
          const cp = (e.checkpoints || []).find((c) => c.checkpointNumber === d.checkpointNumber);
          return cp ? `${cp.status}${cp.defectDetails ? ` (${cp.defectDetails})` : ''}` : '';
        }),
        e.piecesChecked,
        e.okPieces,
        e.reworkPieces,
        e.rejectedPieces,
        e.oilDefectCount,
      ]);
    }
    autoSizeSheet(sheet);
  } else if (inspectionType === 'measurement') {
    const sheet = wb.addWorksheet('Measurement Inspection');
    sheet.addRow([
      'Report Number',
      'Date',
      'Stage',
      'Buyer',
      'Style',
      'Size',
      'Sample #',
      'Measurement Point',
      'Unit',
      'Approved Spec',
      'Lower Tol',
      'Upper Tol',
      'Actual',
      'Difference',
      'Result',
      'Remarks',
    ]);
    styleHeaderRow(sheet.getRow(1));
    const h = doc.headerSnapshot || {};
    for (const r of doc.rows || []) {
      sheet.addRow([
        doc.reportNumber,
        formatDate(doc.inspectionDate),
        doc.inspectionStage,
        h.buyerName,
        h.styleNumber,
        r.size,
        r.sampleIndex || 1,
        r.measurementPoint,
        r.unit,
        r.approvedSpec,
        r.lowerTolerance,
        r.upperTolerance,
        r.actualMeasurement,
        r.difference,
        r.toleranceLabel || r.result,
        r.remarks,
      ]);
    }
    autoSizeSheet(sheet);
  }

  return wb.xlsx.writeBuffer();
}

export async function generateReportExportExcelBuffer(req, queryParams = {}) {
  const reportType = queryParams.reportType || 'combined';
  const canTarget = req.user.role === 'Admin' || req.permissions?.targetChart?.view;
  const canSizeSet = req.user.role === 'Admin' || req.permissions?.sizeSet?.view;
  const canSevenPoint = req.user.role === 'Admin' || req.permissions?.sevenPoint?.view;
  const canMeasurement = req.user.role === 'Admin' || req.permissions?.measurement?.view;

  const hasOrderFilter = Boolean(queryParams.buyerId || queryParams.styleId || queryParams.orderId);
  const hasStageFilter = Boolean(queryParams.inspectionStage);

  const [targetCharts, sizeSets, sevenPoints, measurements] = await Promise.all([
    canTarget && !hasOrderFilter && !hasStageFilter
      ? TargetChart.find(buildFilter(req, 'targetChart', queryParams, false))
          .sort({ inspectionDate: -1 })
          .lean()
      : [],
    canSizeSet
      ? SizeSetInspection.find(buildFilter(req, 'sizeSet', queryParams, true))
          .sort({ inspectionDate: -1 })
          .lean()
      : [],
    canSevenPoint && !hasStageFilter
      ? SevenPointInspection.find(buildFilter(req, 'sevenPoint', queryParams, true))
          .sort({ inspectionDate: -1 })
          .lean()
      : [],
    canMeasurement
      ? MeasurementInspection.find(buildFilter(req, 'measurement', queryParams, true))
          .sort({ inspectionDate: -1 })
          .lean()
      : [],
  ]);

  const combinedRows = [
    ...targetCharts.map((r) => ({
      reportNumber: r.reportNumber,
      module: 'Production Line Target Chart',
      stage: 'Target Chart',
      date: formatDate(r.inspectionDate),
      buyer: '-',
      style: '-',
      order: '-',
      line: r.productionLineName,
      inspector: r.inspectorName,
      qualityPct: r.summary?.achievementPercentage ?? 0,
      okCount: r.summary?.achievedIndicators ?? 0,
      defectOrPending: r.summary?.pendingIndicators ?? 0,
      reworkPct: 0,
      rejectionPct: 0,
      decision: r.approvalStatus,
      approvalStatus: r.approvalStatus,
    })),
    ...sizeSets.map((r) => ({
      reportNumber: r.reportNumber,
      module: 'Size Set / In-line',
      stage: r.inspectionStage,
      date: formatDate(r.inspectionDate),
      buyer: r.headerSnapshot?.buyerName || '-',
      style: r.headerSnapshot?.styleNumber || '-',
      order: r.headerSnapshot?.orderNumber || '-',
      line: r.headerSnapshot?.productionLineName || '-',
      inspector: r.inspectorName,
      qualityPct: r.calculations?.overallOkPercentage ?? 0,
      okCount: r.calculations?.totalOkItems ?? 0,
      defectOrPending: r.calculations?.totalNotOkItems ?? 0,
      reworkPct: r.finalDecision === 'Rework' ? 100 : 0,
      rejectionPct: r.finalDecision === 'Hold' ? 100 : 0,
      decision: r.finalDecision,
      approvalStatus: r.approvalStatus,
    })),
    ...sevenPoints.map((r) => ({
      reportNumber: r.reportNumber,
      module: '7 Point Inspection',
      stage: '7 Point',
      date: formatDate(r.inspectionDate),
      buyer: r.headerSnapshot?.buyerName || '-',
      style: r.headerSnapshot?.styleNumber || '-',
      order: r.headerSnapshot?.orderNumber || '-',
      line: r.headerSnapshot?.productionLineName || '-',
      inspector: r.inspectorName,
      qualityPct: r.totals?.okPercentage ?? 0,
      okCount: r.totals?.okPieces ?? 0,
      defectOrPending: (r.totals?.reworkPieces || 0) + (r.totals?.rejectedPieces || 0),
      reworkPct: r.totals?.reworkPercentage ?? 0,
      rejectionPct: r.totals?.rejectionPercentage ?? 0,
      decision: r.approvalStatus,
      approvalStatus: r.approvalStatus,
    })),
    ...measurements.map((r) => ({
      reportNumber: r.reportNumber,
      module: 'Measurement Inspection',
      stage: r.inspectionStage,
      date: formatDate(r.inspectionDate),
      buyer: r.headerSnapshot?.buyerName || '-',
      style: r.headerSnapshot?.styleNumber || '-',
      order: r.headerSnapshot?.orderNumber || '-',
      line: r.headerSnapshot?.productionLineName || '-',
      inspector: r.inspectorName,
      qualityPct: r.summary?.passPercentage ?? 0,
      okCount: r.summary?.passedPoints ?? 0,
      defectOrPending: r.summary?.failedPoints ?? 0,
      reworkPct: 0,
      rejectionPct: 0,
      decision: r.summary?.overallResult || '-',
      approvalStatus: r.approvalStatus,
    })),
  ].sort((a, b) => b.date.localeCompare(a.date));

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Garment QMS';

  const sheetTitleMap = {
    combined: 'Combined Inspections',
    daily: 'Daily Report',
    weekly: 'Weekly Report',
    monthly: 'Monthly Single Sheet',
    line_wise: 'Line-Wise Performance',
    buyer_wise: 'Buyer-Wise Summary',
    style_wise: 'Style-Wise Summary',
    defect_analysis: 'Defect Analysis',
  };

  if (['line_wise', 'buyer_wise', 'style_wise'].includes(reportType)) {
    const groupField =
      reportType === 'line_wise' ? 'line' : reportType === 'buyer_wise' ? 'buyer' : 'style';
    const labelName =
      reportType === 'line_wise'
        ? 'Production Line'
        : reportType === 'buyer_wise'
          ? 'Buyer'
          : 'Style Number';

    const grouped = new Map();
    for (const row of combinedRows) {
      const key = row[groupField] || 'Unassigned';
      if (!grouped.has(key)) {
        grouped.set(key, {
          key,
          count: 0,
          scoreSum: 0,
          okTotal: 0,
          defectTotal: 0,
          approvedCount: 0,
        });
      }
      const g = grouped.get(key);
      g.count += 1;
      g.scoreSum += Number(row.qualityPct || 0);
      g.okTotal += Number(row.okCount || 0);
      g.defectTotal += Number(row.defectOrPending || 0);
      if (row.approvalStatus === 'Approved') g.approvedCount += 1;
    }

    const sheet = wb.addWorksheet(sheetTitleMap[reportType]);
    sheet.addRow([
      labelName,
      'Total Reports',
      'Approved Reports',
      'Average Quality %',
      'Total OK / Passed',
      'Total Defects / Pending',
    ]);
    styleHeaderRow(sheet.getRow(1));
    for (const g of grouped.values()) {
      sheet.addRow([
        g.key,
        g.count,
        g.approvedCount,
        g.count > 0 ? roundTo(g.scoreSum / g.count, 2) : 0,
        g.okTotal,
        g.defectTotal,
      ]);
    }
    autoSizeSheet(sheet);
  }

  if (reportType === 'defect_analysis') {
    const sheet = wb.addWorksheet('Defect Analysis');
    sheet.addRow([
      'Source Module',
      'Report Number',
      'Date',
      'Line / Buyer / Style',
      'Defect Category / Item',
      'Defect Count / Status',
      'Remarks',
    ]);
    styleHeaderRow(sheet.getRow(1));
    for (const r of sizeSets) {
      const h = r.headerSnapshot || {};
      for (const sec of ['accessories', 'workmanship', 'labelling']) {
        for (const item of r[sec] || []) {
          if (item.status === 'Not OK') {
            sheet.addRow([
              'Size Set / In-line',
              r.reportNumber,
              formatDate(r.inspectionDate),
              `${h.buyerName} / ${h.styleNumber}`,
              `${sec}: ${item.label}`,
              1,
              item.remarks,
            ]);
          }
        }
      }
    }
    for (const r of sevenPoints) {
      const h = r.headerSnapshot || {};
      for (const e of r.entries || []) {
        if (e.reworkPieces > 0 || e.rejectedPieces > 0 || e.oilDefectCount > 0) {
          sheet.addRow([
            '7 Point',
            r.reportNumber,
            formatDate(r.inspectionDate),
            `${h.productionLineName || '-'} / ${h.styleNumber}`,
            `${e.employeeName} (${e.processName})`,
            `Rwk: ${e.reworkPieces}, Rej: ${e.rejectedPieces}, Oil: ${e.oilDefectCount}`,
            r.remarks,
          ]);
        }
      }
    }
    for (const r of measurements) {
      const h = r.headerSnapshot || {};
      for (const row of r.rows || []) {
        if (!row.withinTolerance) {
          sheet.addRow([
            'Measurement',
            r.reportNumber,
            formatDate(r.inspectionDate),
            `${h.buyerName} / ${h.styleNumber}`,
            `${row.measurementPoint} (Size ${row.size})`,
            `Diff ${row.difference} ${row.unit}`,
            row.remarks,
          ]);
        }
      }
    }
    autoSizeSheet(sheet);
  }

  // Always include single-sheet Inspection Records worksheet (ensuring monthly export stays in a single worksheet)
  const recordsSheet = wb.addWorksheet(
    ['combined', 'daily', 'weekly', 'monthly'].includes(reportType)
      ? sheetTitleMap[reportType]
      : 'Detailed Records'
  );
  recordsSheet.addRow([
    'Report Number',
    'Module',
    'Stage',
    'Inspection Date',
    'Buyer',
    'Style Number',
    'Order Number',
    'Production Line',
    'Inspector',
    'Quality / Achievement %',
    'OK / Passed',
    'Not OK / Defects / Pending',
    'Rework %',
    'Rejection %',
    'Decision / Result',
    'Approval Status',
  ]);
  styleHeaderRow(recordsSheet.getRow(1));
  for (const row of combinedRows) {
    recordsSheet.addRow([
      row.reportNumber,
      row.module,
      row.stage,
      row.date,
      row.buyer,
      row.style,
      row.order,
      row.line,
      row.inspector,
      row.qualityPct,
      row.okCount,
      row.defectOrPending,
      row.reworkPct,
      row.rejectionPct,
      row.decision,
      row.approvalStatus,
    ]);
  }
  autoSizeSheet(recordsSheet);

  return wb.xlsx.writeBuffer();
}

