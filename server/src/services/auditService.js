import { AuditLog } from '../models/AuditLog.js';
import { ApprovalHistory } from '../models/ApprovalHistory.js';

export async function recordAudit({
  entityType,
  entityId = null,
  entityIdentifier = '',
  action,
  user = null,
  previousValues = null,
  newValues = null,
  summary,
  req = null,
}) {
  return AuditLog.create({
    entityType,
    entityId,
    entityIdentifier,
    action,
    actorId: user?._id || null,
    actorUsername: user?.username || 'system',
    actorName: user?.fullName || 'System',
    actorRole: user?.role || 'System',
    previousValues,
    newValues,
    summary,
    ipAddress: req?.ip || req?.socket?.remoteAddress || '',
    userAgent: req?.get?.('user-agent') || '',
  });
}

export async function recordApprovalHistory({
  inspectionType,
  inspectionId,
  reportNumber,
  stage = '',
  action,
  decision = '',
  user,
  comments = '',
}) {
  return ApprovalHistory.create({
    inspectionType,
    inspectionId,
    reportNumber,
    stage,
    action,
    decision,
    approverId: user._id,
    approverName: user.fullName,
    approverRole: user.role,
    comments,
    timestamp: new Date(),
  });
}

