import { TargetChart } from '../models/inspections/TargetChart.js';
import { SizeSetInspection } from '../models/inspections/SizeSetInspection.js';
import { SevenPointInspection } from '../models/inspections/SevenPointInspection.js';
import { MeasurementInspection } from '../models/inspections/MeasurementInspection.js';
import { ShrinkageInspection } from '../models/inspections/ShrinkageInspection.js';
import { FourPointInspection } from '../models/inspections/FourPointInspection.js';
import { AccessoriesInspection } from '../models/inspections/AccessoriesInspection.js';
import { buildScopeFilter } from '../middleware/rbac.js';
import { roundTo } from './calculationService.js';

function getIsoWeekKey(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

function buildModuleQuery(req, moduleKey, queryParams, supportsOrderBuyerStyle = true) {
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

  const filter = { ...buildScopeFilter(req, moduleKey), isArchived: false };

  if (dateFrom || dateTo) {
    filter.inspectionDate = {};
    if (dateFrom) filter.inspectionDate.$gte = new Date(dateFrom);
    if (dateTo) {
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      filter.inspectionDate.$lte = end;
    }
  }
  if (productionLineId) filter.productionLineId = productionLineId;
  if (inspectorId) filter.inspectorId = inspectorId;
  if (approvalStatus) filter.approvalStatus = approvalStatus;

  if (supportsOrderBuyerStyle) {
    if (buyerId) filter.buyerId = buyerId;
    if (styleId) filter.styleId = styleId;
    if (orderId) filter.orderId = orderId;
  }

  if (inspectionStage && ['sizeSet', 'measurement'].includes(moduleKey)) {
    filter.inspectionStage = inspectionStage;
  }

  return filter;
}

export async function getDashboardAnalytics(req, queryParams = {}) {
  const canViewTarget = req.user.role === 'Admin' || req.permissions?.targetChart?.view;
  const canViewSizeSet = req.user.role === 'Admin' || req.permissions?.sizeSet?.view;
  const canViewSevenPoint = req.user.role === 'Admin' || req.permissions?.sevenPoint?.view;
  const canViewMeasurement = req.user.role === 'Admin' || req.permissions?.measurement?.view;
  const canViewShrinkage = req.user.role === 'Admin' || req.permissions?.shrinkage?.view;
  const canViewFourPoint = req.user.role === 'Admin' || req.permissions?.fourPoint?.view;
  const canViewAccessories = req.user.role === 'Admin' || req.permissions?.accessories?.view;

  const hasOrderFilter = Boolean(queryParams.buyerId || queryParams.styleId || queryParams.orderId);
  const hasStageFilter = Boolean(queryParams.inspectionStage);

  const [targetCharts, sizeSets, sevenPoints, measurements, shrinkages, fourPoints, accessories] =
    await Promise.all([
      canViewTarget && !hasOrderFilter && !hasStageFilter
        ? TargetChart.find(buildModuleQuery(req, 'targetChart', queryParams, false)).lean()
        : [],
      canViewSizeSet
        ? SizeSetInspection.find(buildModuleQuery(req, 'sizeSet', queryParams, true)).lean()
        : [],
      canViewSevenPoint && !hasStageFilter
        ? SevenPointInspection.find(buildModuleQuery(req, 'sevenPoint', queryParams, true)).lean()
        : [],
      canViewMeasurement
        ? MeasurementInspection.find(buildModuleQuery(req, 'measurement', queryParams, true)).lean()
        : [],
      canViewShrinkage
        ? ShrinkageInspection.find(buildModuleQuery(req, 'shrinkage', queryParams, true)).lean()
        : [],
      canViewFourPoint
        ? FourPointInspection.find(buildModuleQuery(req, 'fourPoint', queryParams, true)).lean()
        : [],
      canViewAccessories
        ? AccessoriesInspection.find(buildModuleQuery(req, 'accessories', queryParams, true)).lean()
        : [],
    ]);

  const normalized = [];

  for (const r of targetCharts) {
    normalized.push({
      id: r._id,
      reportNumber: r.reportNumber,
      module: 'Target Chart',
      stage: 'Line Target',
      date: new Date(r.inspectionDate),
      lineName: r.productionLineName || 'Unassigned',
      buyerName: 'Factory Production',
      supplierName: 'Internal Factory',
      inspectorName: r.inspectorName,
      approvalStatus: r.approvalStatus,
      qualityScore: Number(r.summary?.achievementPercentage ?? 0),
      decision: r.approvalStatus === 'Approved' ? 'Accepted' : 'Pending',
      okCount: Number(r.summary?.achievedIndicators ?? 0),
      notOkCount: Number(r.summary?.pendingIndicators ?? 0),
      raw: r,
    });
  }

  for (const r of sizeSets) {
    normalized.push({
      id: r._id,
      reportNumber: r.reportNumber,
      module: 'Size Set / In-line',
      stage: r.inspectionStage,
      date: new Date(r.inspectionDate),
      lineName: r.headerSnapshot?.productionLineName || 'Unassigned',
      buyerName: r.headerSnapshot?.buyerName || 'Unassigned',
      supplierName: r.headerSnapshot?.supplierName || 'Internal Factory',
      inspectorName: r.inspectorName,
      approvalStatus: r.approvalStatus,
      qualityScore: Number(r.calculations?.overallOkPercentage ?? 0),
      decision: r.finalDecision || 'Pending',
      okCount: Number(r.calculations?.totalOkItems ?? 0),
      notOkCount: Number(r.calculations?.totalNotOkItems ?? 0),
      raw: r,
    });
  }

  for (const r of sevenPoints) {
    normalized.push({
      id: r._id,
      reportNumber: r.reportNumber,
      module: '7 Point',
      stage: '7 Point Production',
      date: new Date(r.inspectionDate),
      lineName: r.headerSnapshot?.productionLineName || 'Unassigned',
      buyerName: r.headerSnapshot?.buyerName || 'Unassigned',
      supplierName: r.headerSnapshot?.supplierName || 'Internal Factory',
      inspectorName: r.inspectorName,
      approvalStatus: r.approvalStatus,
      qualityScore: Number(r.totals?.okPercentage ?? 0),
      decision:
        r.approvalStatus === 'Rejected'
          ? 'Hold'
          : (r.totals?.reworkPieces || 0) > 0 && r.approvalStatus !== 'Approved'
            ? 'Rework'
            : r.approvalStatus === 'Approved'
              ? 'Accepted'
              : 'Pending',
      okCount: Number(r.totals?.okPieces ?? 0),
      notOkCount: Number((r.totals?.reworkPieces || 0) + (r.totals?.rejectedPieces || 0)),
      raw: r,
    });
  }

  for (const r of measurements) {
    normalized.push({
      id: r._id,
      reportNumber: r.reportNumber,
      module: 'Measurement',
      stage: r.inspectionStage,
      date: new Date(r.inspectionDate),
      lineName: r.headerSnapshot?.productionLineName || 'Unassigned',
      buyerName: r.headerSnapshot?.buyerName || 'Unassigned',
      supplierName: r.headerSnapshot?.supplierName || 'Internal Factory',
      inspectorName: r.inspectorName,
      approvalStatus: r.approvalStatus,
      qualityScore: Number(r.summary?.passPercentage ?? 0),
      decision:
        r.summary?.overallResult === 'Pass' && r.approvalStatus === 'Approved'
          ? 'Accepted'
          : r.summary?.overallResult === 'Fail'
            ? 'Hold'
            : 'Pending',
      okCount: Number(r.summary?.passedPoints ?? 0),
      notOkCount: Number(r.summary?.failedPoints ?? 0),
      raw: r,
    });
  }

  for (const r of shrinkages) {
    const isPass = r.summaryResults?.overallResult === 'PASS';
    const isFail = r.summaryResults?.overallResult === 'FAIL';
    normalized.push({
      id: r._id,
      reportNumber: r.reportNumber,
      module: 'Shrinkage Test (QF-29)',
      stage: 'Laboratory Testing',
      date: new Date(r.inspectionDate),
      lineName: 'Testing Lab',
      buyerName: r.headerSnapshot?.buyerName || 'Unassigned',
      supplierName: r.headerSnapshot?.supplierName || 'Internal Factory',
      inspectorName: r.inspectorName,
      approvalStatus: r.approvalStatus,
      qualityScore: isPass ? 100 : isFail ? 0 : 50,
      decision: isPass ? 'Accepted' : isFail ? 'Hold' : 'Pending',
      okCount: isPass ? 1 : 0,
      notOkCount: isFail ? 1 : 0,
      isRetest: Boolean(r.retestOfReportId || r.retestRequired),
      raw: r,
    });
  }

  for (const r of fourPoints) {
    const isPass = r.batchSummary?.finalBatchResult === 'PASS';
    normalized.push({
      id: r._id,
      reportNumber: r.reportNumber,
      module: 'Fabric 4-Point (QF-30)',
      stage: 'Fabric Inspection',
      date: new Date(r.inspectionDate),
      lineName: 'Fabric QC',
      buyerName: r.headerSnapshot?.buyerName || 'Unassigned',
      supplierName: r.headerSnapshot?.supplierName || 'Internal Factory',
      inspectorName: r.inspectorName,
      approvalStatus: r.approvalStatus,
      qualityScore: isPass ? 100 : 0,
      decision: isPass ? 'Accepted' : 'Hold',
      okCount: Number(r.batchSummary?.totalAcceptedRolls || 0),
      notOkCount: Number(r.batchSummary?.totalRejectedRolls || 0),
      isRetest: Boolean(r.retestOfReportId || r.retestRequired),
      raw: r,
    });
  }

  for (const r of accessories) {
    const isAccept = r.finalResult === 'ACCEPT';
    const isReject = r.finalResult === 'REJECT';
    normalized.push({
      id: r._id,
      reportNumber: r.reportNumber,
      module: 'Accessories Inspection (QAD-5)',
      stage: 'Trim & Accessories',
      date: new Date(r.inspectionDate),
      lineName: 'Accessories QC',
      buyerName: r.headerSnapshot?.buyerName || 'Unassigned',
      supplierName: r.headerSnapshot?.supplierName || 'Internal Factory',
      inspectorName: r.inspectorName,
      approvalStatus: r.approvalStatus,
      qualityScore: isAccept ? 100 : isReject ? 0 : 50,
      decision: isAccept ? 'Accepted' : isReject ? 'Hold' : 'Pending',
      okCount: Number(r.calculations?.okCount || 0),
      notOkCount: Number(r.calculations?.notOkCount || 0),
      isRetest: Boolean(r.retestOfReportId || r.retestRequired),
      raw: r,
    });
  }

  const totalInspections = normalized.length;
  const completedInspections = normalized.filter((n) =>
    ['Approved', 'Rejected'].includes(n.approvalStatus)
  ).length;
  const pendingInspections = totalInspections - completedInspections;

  const acceptedReports = normalized.filter((n) => n.decision === 'Accepted').length;
  const reworkReports = normalized.filter((n) => n.decision === 'Rework' || n.approvalStatus === 'Returned for Correction').length;
  const holdReports = normalized.filter((n) => n.decision === 'Hold' || n.approvalStatus === 'Rejected').length;

  const overallAcceptancePercentage =
    totalInspections > 0 ? roundTo((acceptedReports / totalInspections) * 100, 2) : 0;
  const overallRejectionPercentage =
    totalInspections > 0 ? roundTo((holdReports / totalInspections) * 100, 2) : 0;

  // Specific Quantities
  const shrinkageTestQuantity = shrinkages.length;
  const fabricInspectionQuantity = fourPoints.reduce(
    (sum, f) => sum + Number(f.batchSummary?.totalInspectedYards || f.headerSnapshot?.inspectionQuantityYards || 0),
    0
  );
  const accessoriesInspectionQuantity = accessories.reduce(
    (sum, a) => sum + Number(a.inspectedQuantity || 0),
    0
  );

  // Retests
  const retestedCount = normalized.filter((n) => n.isRetest).length;
  const retestRate = totalInspections > 0 ? roundTo((retestedCount / totalInspections) * 100, 2) : 0;

  // Buyer-wise Quality Performance
  const buyerMap = new Map();
  for (const item of normalized) {
    const bName = item.buyerName || 'Unassigned';
    if (!buyerMap.has(bName)) {
      buyerMap.set(bName, { buyerName: bName, total: 0, accepted: 0, rejected: 0, pending: 0 });
    }
    const b = buyerMap.get(bName);
    b.total += 1;
    if (item.decision === 'Accepted') b.accepted += 1;
    else if (item.decision === 'Hold') b.rejected += 1;
    else b.pending += 1;
  }
  const buyerPerformance = Array.from(buyerMap.values()).map((b) => ({
    ...b,
    acceptanceRate: b.total > 0 ? roundTo((b.accepted / b.total) * 100, 2) : 0,
    rejectionRate: b.total > 0 ? roundTo((b.rejected / b.total) * 100, 2) : 0,
  })).sort((a, b) => b.total - a.total);

  // Supplier-wise Quality Performance
  const supplierMap = new Map();
  for (const item of normalized) {
    const sName = item.supplierName || 'Internal Factory';
    if (!supplierMap.has(sName)) {
      supplierMap.set(sName, { supplierName: sName, total: 0, accepted: 0, rejected: 0, pending: 0 });
    }
    const s = supplierMap.get(sName);
    s.total += 1;
    if (item.decision === 'Accepted') s.accepted += 1;
    else if (item.decision === 'Hold') s.rejected += 1;
    else s.pending += 1;
  }
  const supplierPerformance = Array.from(supplierMap.values()).map((s) => ({
    ...s,
    acceptanceRate: s.total > 0 ? roundTo((s.accepted / s.total) * 100, 2) : 0,
    rejectionRate: s.total > 0 ? roundTo((s.rejected / s.total) * 100, 2) : 0,
  })).sort((a, b) => b.total - a.total);

  let total7pChecked = 0;
  let total7pRejected = 0;
  let total7pRework = 0;
  let total7pOil = 0;
  for (const sp of sevenPoints) {
    total7pChecked += Number(sp.totals?.totalPiecesChecked || 0);
    total7pRejected += Number(sp.totals?.rejectedPieces || 0);
    total7pRework += Number(sp.totals?.reworkPieces || 0);
    total7pOil += Number(sp.totals?.oilDefectCount || 0);
  }

  const totalOkItemsAll = normalized.reduce((acc, n) => acc + n.okCount, 0);
  const totalNotOkItemsAll = normalized.reduce((acc, n) => acc + n.notOkCount, 0);
  const totalEvaluatedUnits = totalOkItemsAll + totalNotOkItemsAll;

  const rejectionPercentage =
    total7pChecked > 0
      ? roundTo((total7pRejected / total7pChecked) * 100, 2)
      : totalInspections > 0
        ? roundTo((holdReports / totalInspections) * 100, 2)
        : 0;

  const overallQualityScore =
    normalized.length > 0
      ? roundTo(
          normalized.reduce((acc, n) => acc + n.qualityScore, 0) / normalized.length,
          2
        )
      : 0;

  // Trend aggregators (Daily, Weekly, Monthly)
  const dailyMap = new Map();
  const weeklyMap = new Map();
  const monthlyMap = new Map();
  const lineMap = new Map();
  const stageMap = new Map();

  function addBucket(map, key, label, item) {
    if (!map.has(key)) {
      map.set(key, { key, label, count: 0, scoreSum: 0, ok: 0, notOk: 0 });
    }
    const b = map.get(key);
    b.count += 1;
    b.scoreSum += item.qualityScore;
    b.ok += item.okCount;
    b.notOk += item.notOkCount;
  }

  for (const item of normalized) {
    const d = item.date;
    const dayKey = d.toISOString().slice(0, 10);
    const weekKey = getIsoWeekKey(d);
    const monthKey = d.toISOString().slice(0, 7);

    addBucket(dailyMap, dayKey, dayKey, item);
    addBucket(weeklyMap, weekKey, weekKey, item);
    addBucket(monthlyMap, monthKey, monthKey, item);
    addBucket(lineMap, item.lineName, item.lineName, item);
    addBucket(stageMap, item.stage, item.stage, item);
  }

  const finalizeBuckets = (map, sortByKey = true) => {
    const arr = Array.from(map.values()).map((b) => ({
      name: b.label,
      count: b.count,
      qualityScore: b.count > 0 ? roundTo(b.scoreSum / b.count, 2) : 0,
      okCount: b.ok,
      notOkCount: b.notOk,
    }));
    return sortByKey ? arr.sort((a, b) => a.name.localeCompare(b.name)) : arr;
  };

  // Defect category breakdown
  const defectCategoryMap = new Map();
  for (const s of sizeSets) {
    for (const sectionName of ['accessories', 'workmanship', 'labelling']) {
      for (const item of s[sectionName] || []) {
        if (item.status === 'Not OK') {
          const cat = `${sectionName.toUpperCase()}: ${item.label}`;
          defectCategoryMap.set(cat, (defectCategoryMap.get(cat) || 0) + 1);
        }
      }
    }
  }
  if (total7pRework > 0) defectCategoryMap.set('7-Point Rework Pieces', total7pRework);
  if (total7pRejected > 0) defectCategoryMap.set('7-Point Rejected Pieces', total7pRejected);
  if (total7pOil > 0) defectCategoryMap.set('7-Point Oil Defects', total7pOil);

  for (const fp of fourPoints) {
    for (const roll of fp.rolls || []) {
      const d = roll.defects || {};
      for (const [k, count] of Object.entries(d)) {
        if (Number(count) > 0) {
          const label = k.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase());
          defectCategoryMap.set(`Fabric: ${label}`, (defectCategoryMap.get(`Fabric: ${label}`) || 0) + Number(count));
        }
      }
    }
  }

  for (const sh of shrinkages) {
    for (const failParam of sh.summaryResults?.failedParameters || []) {
      defectCategoryMap.set(`Shrinkage: ${failParam}`, (defectCategoryMap.get(`Shrinkage: ${failParam}`) || 0) + 1);
    }
  }

  for (const acc of accessories) {
    for (const failParam of acc.calculations?.failedParameters || []) {
      defectCategoryMap.set(`Accessory: ${failParam}`, (defectCategoryMap.get(`Accessory: ${failParam}`) || 0) + 1);
    }
  }

  const failedMeasurementCount = measurements.reduce(
    (sum, m) => sum + Number(m.summary?.failedPoints || 0),
    0
  );
  if (failedMeasurementCount > 0) {
    defectCategoryMap.set('Measurement Out-of-Tolerance', failedMeasurementCount);
  }

  const defectCategoryAnalysis = Array.from(defectCategoryMap.entries())
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);

  // Rework & Rejection analysis by date (from 7 Point)
  const reworkByDateMap = new Map();
  for (const r of sevenPoints) {
    const dayKey = new Date(r.inspectionDate).toISOString().slice(0, 10);
    if (!reworkByDateMap.has(dayKey)) {
      reworkByDateMap.set(dayKey, { date: dayKey, checked: 0, rework: 0, rejected: 0, oil: 0 });
    }
    const b = reworkByDateMap.get(dayKey);
    b.checked += Number(r.totals?.totalPiecesChecked || 0);
    b.rework += Number(r.totals?.reworkPieces || 0);
    b.rejected += Number(r.totals?.rejectedPieces || 0);
    b.oil += Number(r.totals?.oilDefectCount || 0);
  }
  const reworkAndRejectionAnalysis = Array.from(reworkByDateMap.values())
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((b) => ({
      date: b.date,
      checked: b.checked,
      reworkPieces: b.rework,
      rejectedPieces: b.rejected,
      oilDefects: b.oil,
      reworkPercentage: b.checked > 0 ? roundTo((b.rework / b.checked) * 100, 2) : 0,
      rejectionPercentage: b.checked > 0 ? roundTo((b.rejected / b.checked) * 100, 2) : 0,
      oilPercentage: b.checked > 0 ? roundTo((b.oil / b.checked) * 100, 2) : 0,
    }));

  // Employee / Process defect analysis (from 7 Point entries)
  const empProcMap = new Map();
  for (const sp of sevenPoints) {
    for (const e of sp.entries || []) {
      const key = `${e.employeeName} — ${e.processName}`;
      if (!empProcMap.has(key)) {
        empProcMap.set(key, {
          label: key,
          employeeName: e.employeeName,
          employeeCode: e.employeeCode,
          processName: e.processName,
          piecesChecked: 0,
          okPieces: 0,
          reworkPieces: 0,
          rejectedPieces: 0,
          oilDefects: 0,
        });
      }
      const b = empProcMap.get(key);
      b.piecesChecked += Number(e.piecesChecked || 0);
      b.okPieces += Number(e.okPieces || 0);
      b.reworkPieces += Number(e.reworkPieces || 0);
      b.rejectedPieces += Number(e.rejectedPieces || 0);
      b.oilDefects += Number(e.oilDefectCount || 0);
    }
  }
  const employeeProcessAnalysis = Array.from(empProcMap.values())
    .map((b) => {
      const defects = b.reworkPieces + b.rejectedPieces;
      return {
        ...b,
        totalDefects: defects,
        defectRate: b.piecesChecked > 0 ? roundTo((defects / b.piecesChecked) * 100, 2) : 0,
      };
    })
    .sort((a, b) => b.totalDefects - a.totalDefects)
    .slice(0, 15);

  // Recent inspection history across modules
  const recentInspections = [...normalized]
    .sort((a, b) => b.date - a.date)
    .slice(0, 12)
    .map(({ raw, ...rest }) => rest);

  return {
    summaryCards: {
      totalInspections,
      completedInspections,
      pendingInspections,
      acceptedReports,
      reworkReports,
      holdReports,
      overallAcceptancePercentage,
      overallRejectionPercentage,
      rejectionPercentage,
      overallQualityScore,
      fabricInspectionQuantity,
      shrinkageTestQuantity,
      accessoriesInspectionQuantity,
      retestedCount,
      retestRate,
    },
    buyerPerformance,
    supplierPerformance,
    charts: {
      dailyTrend: finalizeBuckets(dailyMap),
      weeklyTrend: finalizeBuckets(weeklyMap),
      monthlyTrend: finalizeBuckets(monthlyMap),
      linePerformance: finalizeBuckets(lineMap, false).sort((a, b) => b.count - a.count),
      defectCategoryAnalysis,
      okVsNotOk: [
        { name: 'OK / Pass / Achieved', value: totalOkItemsAll },
        { name: 'Not OK / Fail / Pending', value: totalNotOkItemsAll },
      ],
      okVsNotOkSummary: {
        okTotal: totalOkItemsAll,
        notOkTotal: totalNotOkItemsAll,
        okRate: totalEvaluatedUnits > 0 ? roundTo((totalOkItemsAll / totalEvaluatedUnits) * 100, 2) : 0,
      },
      reworkAndRejectionAnalysis,
      stageComparison: finalizeBuckets(stageMap, false),
      employeeProcessAnalysis,
    },
    recentInspections,
  };
}

