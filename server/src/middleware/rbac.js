import { AppError } from '../utils/errors.js';

export function requirePermission(section, action = 'view') {
  return (req, _res, next) => {
    if (!req.user) {
      return next(new AppError('Authentication required.', 401));
    }
    if (req.user.role === 'Admin') {
      return next();
    }
    const allowed = Boolean(req.permissions?.[section]?.[action]);
    if (!allowed) {
      return next(
        new AppError(`Access denied: missing '${section}.${action}' permission.`, 403)
      );
    }
    return next();
  };
}

export function buildScopeFilter(req, moduleKey) {
  if (req.user.role === 'Admin' || req.permissions?.[moduleKey]?.scopeAllLines) {
    return {};
  }
  // For textile lab & fabric modules that do not use production lines
  if (['shrinkage', 'fourPoint', 'accessories', 'specifications'].includes(moduleKey)) {
    return {};
  }
  const assigned = (req.user.assignedLines || []).map((id) => id.toString());
  if (assigned.length === 0) {
    return { inspectorId: req.user._id };
  }
  return {
    $or: [
      { productionLineId: { $in: req.user.assignedLines } },
      { inspectorId: req.user._id },
    ],
  };
}

export function assertRecordAccess(req, moduleKey, doc) {
  if (req.user.role === 'Admin' || req.permissions?.[moduleKey]?.scopeAllLines) {
    return;
  }
  // For textile lab & fabric modules that do not use production lines
  if (['shrinkage', 'fourPoint', 'accessories', 'specifications'].includes(moduleKey)) {
    return;
  }
  const isCreator =
    doc.inspectorId?.toString() === req.user._id.toString() ||
    doc.createdBy?.toString() === req.user._id.toString();
  const assigned = new Set((req.user.assignedLines || []).map((id) => id.toString()));
  const lineId = doc.productionLineId?._id?.toString() || doc.productionLineId?.toString();

  if (!lineId) {
    return; // No production line attached to this document
  }

  if (!isCreator && !assigned.has(lineId)) {
    throw new AppError('You are not authorized to access this production line report.', 403);
  }
}

