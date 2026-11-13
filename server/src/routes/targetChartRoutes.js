import { TargetChart } from '../models/inspections/TargetChart.js';
import { ProductionLine } from '../models/masters/index.js';
import { calculateTargetChart } from '../services/calculationService.js';
import { buildScopeFilter } from '../middleware/rbac.js';
import { requirePermission } from '../middleware/rbac.js';
import { createInspectionLifecycleRouter } from './inspectionRouteFactory.js';
import { AppError, asyncHandler } from '../utils/errors.js';

function parseValidDate(val) {
  const d = new Date(val);
  if (!val || Number.isNaN(d.getTime())) {
    throw new AppError('Valid inspection date is required.', 400);
  }
  return d;
}

export default createInspectionLifecycleRouter({
  model: TargetChart,
  inspectionType: 'target_chart',
  moduleKey: 'targetChart',
  reportPrefix: 'TC',
  extraPopulates: [{ path: 'productionLineId', select: 'code name floor' }],
  buildExtraFilter: (query) => {
    const f = {};
    if (query.shift) f.shift = query.shift;
    return f;
  },
  buildPayload: async ({ req, config, existing }) => {
    const productionLineId = req.body.productionLineId || existing?.productionLineId?._id || existing?.productionLineId;
    const inspectionDate = req.body.inspectionDate || existing?.inspectionDate;
    const shift = req.body.shift !== undefined ? req.body.shift : (existing?.shift || 'General');
    const indicators = req.body.indicators || existing?.indicators;
    const remarks = req.body.remarks !== undefined ? req.body.remarks : (existing?.remarks || '');

    if (!productionLineId) throw new AppError('Production line is required.', 400);

    const line = await ProductionLine.findById(productionLineId).lean();
    if (!line) throw new AppError('Selected production line does not exist.', 404);

    const validDate = parseValidDate(inspectionDate);
    const defaultIndicators = config.indicators || [];
    const mergedIndicators = Array.isArray(indicators)
      ? indicators.map((ind, idx) => ({
          ...defaultIndicators[idx],
          ...ind,
          index: idx + 1,
        }))
      : defaultIndicators.map((ind, idx) => ({
          ...ind,
          index: idx + 1,
          targetValue: ind.defaultTarget ?? 0,
          actualValue: 0,
        }));

    const calculated = calculateTargetChart(mergedIndicators);

    return {
      productionLineId: line._id,
      productionLineName: line.name,
      inspectionDate: validDate,
      shift: String(shift || 'General').trim(),
      indicators: calculated.indicators,
      summary: calculated.summary,
      remarks: String(remarks || '').trim(),
    };
  },
  extraRoutes: (router) => {
    router.get(
      '/analytics',
      requirePermission('targetChart', 'view'),
      asyncHandler(async (req, res) => {
        const { productionLineId = '', dateFrom = '', dateTo = '' } = req.query;
        const scope = buildScopeFilter(req, 'targetChart');
        const match = { ...scope, isArchived: false };
        if (productionLineId) match.productionLineId = productionLineId;
        if (dateFrom || dateTo) {
          match.inspectionDate = {};
          if (dateFrom) match.inspectionDate.$gte = new Date(dateFrom);
          if (dateTo) {
            const end = new Date(dateTo);
            end.setHours(23, 59, 59, 999);
            match.inspectionDate.$lte = end;
          }
        }

        const records = await TargetChart.find(match).sort({ inspectionDate: 1 }).lean();
        let totalTargets = 0;
        let achievedTargets = 0;
        let pendingTargets = 0;
        let totalTargetValue = 0;
        let totalAchievedValue = 0;

        const byDateMap = new Map();
        const byLineMap = new Map();

        for (const r of records) {
          const s = r.summary || {};
          totalTargets += Number(s.activeIndicators || 0);
          achievedTargets += Number(s.achievedIndicators || 0);
          pendingTargets += Number(s.pendingIndicators || 0);
          totalTargetValue += Number(s.totalTarget || 0);
          totalAchievedValue += Number(s.totalAchieved || 0);

          const dateKey = new Date(r.inspectionDate).toISOString().slice(0, 10);
          if (!byDateMap.has(dateKey)) {
            byDateMap.set(dateKey, { date: dateKey, totalTarget: 0, totalAchieved: 0, count: 0 });
          }
          const db = byDateMap.get(dateKey);
          db.totalTarget += Number(s.totalTarget || 0);
          db.totalAchieved += Number(s.totalAchieved || 0);
          db.count += 1;

          const lineKey = r.productionLineName || 'Unknown';
          if (!byLineMap.has(lineKey)) {
            byLineMap.set(lineKey, {
              productionLineName: lineKey,
              totalTarget: 0,
              totalAchieved: 0,
              achievedTargets: 0,
              pendingTargets: 0,
            });
          }
          const lb = byLineMap.get(lineKey);
          lb.totalTarget += Number(s.totalTarget || 0);
          lb.totalAchieved += Number(s.totalAchieved || 0);
          lb.achievedTargets += Number(s.achievedIndicators || 0);
          lb.pendingTargets += Number(s.pendingIndicators || 0);
        }

        const dateWise = Array.from(byDateMap.values()).map((d) => ({
          ...d,
          achievementPercentage:
            d.totalTarget > 0 ? Math.round((d.totalAchieved / d.totalTarget) * 10000) / 100 : 0,
        }));

        const lineWise = Array.from(byLineMap.values()).map((l) => ({
          ...l,
          achievementPercentage:
            l.totalTarget > 0 ? Math.round((l.totalAchieved / l.totalTarget) * 10000) / 100 : 0,
        }));

        res.json({
          success: true,
          data: {
            totals: {
              reportCount: records.length,
              totalTargets,
              achievedTargets,
              pendingTargets,
              totalTargetValue: Math.round(totalTargetValue * 100) / 100,
              totalAchievedValue: Math.round(totalAchievedValue * 100) / 100,
              totalPendingValue: Math.max(0, Math.round((totalTargetValue - totalAchievedValue) * 100) / 100),
              achievementPercentage:
                totalTargetValue > 0
                  ? Math.round((totalAchievedValue / totalTargetValue) * 10000) / 100
                  : 0,
            },
            dateWise,
            lineWise,
          },
        });
      })
    );
  },
});

