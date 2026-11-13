import { AppError } from '../utils/errors.js';
import { recordApprovalHistory, recordAudit } from './auditService.js';

function buildInitialWorkflowStages(config = {}) {
  const stages = config.approvalWorkflow || [];
  return stages.map((s) => ({
    stage: s.stage,
    required: s.required !== false,
    allowedRoles: Array.isArray(s.allowedRoles) ? s.allowedRoles : [],
    status: 'Pending',
    actionBy: null,
    actionByName: '',
    actionByRole: '',
    actionAt: null,
    comments: '',
  }));
}

export async function submitInspection({ doc, inspectionType, config = {}, user, req }) {
  if (doc.isArchived) {
    throw new AppError('Archived reports cannot be submitted.', 400);
  }
  if (!['Draft', 'Returned for Correction'].includes(doc.approvalStatus)) {
    throw new AppError(
      `Report ${doc.reportNumber} is already '${doc.approvalStatus}' and cannot be submitted again.`,
      409
    );
  }

  if (['seven_point', 'measurement'].includes(inspectionType)) {
    doc.workflowStages = buildInitialWorkflowStages(config);
    doc.currentStageIndex = 0;
  }

  doc.approvalStatus = 'Pending Approval';
  doc.submittedAt = new Date();
  doc.submittedBy = user._id;
  doc.updatedBy = user._id;
  await doc.save();

  await recordApprovalHistory({
    inspectionType,
    inspectionId: doc._id,
    reportNumber: doc.reportNumber,
    stage: 'Submission',
    action: 'Submitted',
    user,
    comments: 'Submitted for quality approval.',
  });

  await recordAudit({
    entityType: inspectionType,
    entityId: doc._id,
    entityIdentifier: doc.reportNumber,
    action: 'SUBMIT',
    user,
    summary: `Submitted ${doc.reportNumber} for approval.`,
    req,
  });

  return doc;
}

export async function processApprovalAction({
  doc,
  inspectionType,
  moduleKey,
  action,
  stage,
  decision,
  comments = '',
  user,
  permissions,
  config = {},
  req,
}) {
  if (doc.isArchived) {
    throw new AppError('Cannot approve or reject an archived report.', 400);
  }
  if (doc.approvalStatus !== 'Pending Approval') {
    throw new AppError(
      `Report ${doc.reportNumber} must be in 'Pending Approval' status (currently '${doc.approvalStatus}').`,
      409
    );
  }
  if (!['Approved', 'Rejected', 'Returned for Correction'].includes(action)) {
    throw new AppError('Invalid approval action.', 400);
  }
  if (['Rejected', 'Returned for Correction'].includes(action) && !comments.trim()) {
    throw new AppError(`Comments are required when marking a report '${action}'.`, 400);
  }

  // Multi-stage workflow (7 Point & Measurement)
  if (['seven_point', 'measurement'].includes(inspectionType)) {
    if (!Array.isArray(doc.workflowStages) || doc.workflowStages.length === 0) {
      doc.workflowStages = buildInitialWorkflowStages(config);
    }

    const targetIndex = stage
      ? doc.workflowStages.findIndex((s) => s.stage === stage)
      : doc.workflowStages.findIndex((s) => s.status === 'Pending');

    if (targetIndex < 0) {
      throw new AppError('No matching pending approval stage found.', 400);
    }

    const targetStage = doc.workflowStages[targetIndex];
    if (targetStage.status === 'Approved') {
      throw new AppError(`Stage '${targetStage.stage}' is already approved.`, 409);
    }

    if (config.enforceSequentialApproval !== false) {
      const priorIncompleteRequired = doc.workflowStages
        .slice(0, targetIndex)
        .find((s) => s.required && s.status !== 'Approved');
      if (priorIncompleteRequired) {
        throw new AppError(
          `Sequential approval required: '${priorIncompleteRequired.stage}' must approve before '${targetStage.stage}'.`,
          400
        );
      }
    }

    const isAdmin = user.role === 'Admin';
    const stageAllowsRole =
      !targetStage.allowedRoles?.length || targetStage.allowedRoles.includes(user.role);
    const rolePermStages = permissions?.[moduleKey]?.approvalStages || [];
    const roleAllowsStage =
      !rolePermStages.length || rolePermStages.includes(targetStage.stage);

    if (!isAdmin && (!stageAllowsRole || !roleAllowsStage)) {
      throw new AppError(
        `Role '${user.role}' is not authorized to act on approval stage '${targetStage.stage}'.`,
        403
      );
    }

    targetStage.status = action;
    targetStage.actionBy = user._id;
    targetStage.actionByName = user.fullName;
    targetStage.actionByRole = user.role;
    targetStage.actionAt = new Date();
    targetStage.comments = comments;

    if (action === 'Approved') {
      const nextPendingIdx = doc.workflowStages.findIndex(
        (s) => s.required && s.status !== 'Approved'
      );
      if (nextPendingIdx === -1) {
        doc.approvalStatus = 'Approved';
        doc.finalizedAt = new Date();
        doc.finalizedBy = user._id;
        doc.currentStageIndex = doc.workflowStages.length;
      } else {
        doc.currentStageIndex = nextPendingIdx;
      }
    } else if (action === 'Rejected') {
      doc.approvalStatus = 'Rejected';
      doc.finalizedAt = new Date();
      doc.finalizedBy = user._id;
    } else {
      doc.approvalStatus = 'Returned for Correction';
    }

    doc.updatedBy = user._id;
    await doc.save();

    await recordApprovalHistory({
      inspectionType,
      inspectionId: doc._id,
      reportNumber: doc.reportNumber,
      stage: targetStage.stage,
      action,
      user,
      comments,
    });

    await recordAudit({
      entityType: inspectionType,
      entityId: doc._id,
      entityIdentifier: doc.reportNumber,
      action: action === 'Approved' ? 'APPROVE' : action === 'Rejected' ? 'REJECT' : 'RETURN',
      user,
      summary: `${action} stage '${targetStage.stage}' on ${doc.reportNumber}.`,
      req,
    });

    return doc;
  }

  // Single-tier approval with configurable decision rules (Target Chart & Size Set)
  if (inspectionType === 'size_set' && action === 'Approved') {
    const chosenDecision = decision || doc.finalDecision;
    if (!['Accepted', 'Rework', 'Hold'].includes(chosenDecision)) {
      throw new AppError('Final decision (Accepted, Rework, or Hold) is required to approve.', 400);
    }
    if (
      chosenDecision === 'Accepted' &&
      doc.calculations?.acceptanceRuleEvaluation?.meetsConfiguredRules === false &&
      !comments.trim()
    ) {
      throw new AppError(
        'Report fails configured quality acceptance rules. Provide override justification comments or choose Rework/Hold.',
        400
      );
    }
    doc.finalDecision = chosenDecision;
  }

  doc.approvalStatus = action;
  if (action === 'Approved' || action === 'Rejected') {
    doc.finalizedAt = new Date();
    doc.finalizedBy = user._id;
  }
  doc.updatedBy = user._id;
  await doc.save();

  await recordApprovalHistory({
    inspectionType,
    inspectionId: doc._id,
    reportNumber: doc.reportNumber,
    stage: 'Final Approval',
    action,
    decision: doc.finalDecision || '',
    user,
    comments,
  });

  await recordAudit({
    entityType: inspectionType,
    entityId: doc._id,
    entityIdentifier: doc.reportNumber,
    action: action === 'Approved' ? 'APPROVE' : action === 'Rejected' ? 'REJECT' : 'RETURN',
    user,
    summary: `${action} report ${doc.reportNumber}${doc.finalDecision ? ` (${doc.finalDecision})` : ''}.`,
    req,
  });

  return doc;
}

export async function createControlledRevision({ doc, inspectionType, reason, user, req }) {
  const finalReason = String(reason || '').trim() || 'Revision requested by authorized user';
  if (!['Approved', 'Rejected'].includes(doc.approvalStatus)) {
    throw new AppError('Only finalized (Approved or Rejected) reports require a controlled revision.', 400);
  }

  const plain = doc.toObject();
  delete plain.revisionHistory;

  doc.revisionHistory.push({
    version: doc.version,
    snapshot: plain,
    revisedBy: user._id,
    revisedByName: user.fullName,
    revisedAt: new Date(),
    reason: finalReason,
  });
  doc.version += 1;
  doc.approvalStatus = 'Returned for Correction';
  doc.finalizedAt = null;
  doc.finalizedBy = null;
  if (Array.isArray(doc.workflowStages)) {
    doc.workflowStages = doc.workflowStages.map((s) => ({
      ...s.toObject?.() || s,
      status: 'Pending',
      actionBy: null,
      actionByName: '',
      actionByRole: '',
      actionAt: null,
      comments: '',
    }));
    doc.currentStageIndex = 0;
  }
  doc.updatedBy = user._id;
  await doc.save();

  await recordApprovalHistory({
    inspectionType,
    inspectionId: doc._id,
    reportNumber: doc.reportNumber,
    stage: `Revision v${doc.version}`,
    action: 'Revised',
    user,
    comments: reason.trim(),
  });

  await recordAudit({
    entityType: inspectionType,
    entityId: doc._id,
    entityIdentifier: doc.reportNumber,
    action: 'REVISE',
    user,
    summary: `Created controlled revision v${doc.version} for ${doc.reportNumber}: ${reason.trim()}`,
    req,
  });

  return doc;
}

export async function toggleArchiveInspection({ doc, inspectionType, archive, reason = '', user, req }) {
  if (archive && !reason.trim()) {
    throw new AppError('An archive reason is required.', 400);
  }
  doc.isArchived = Boolean(archive);
  doc.archivedAt = archive ? new Date() : null;
  doc.archivedBy = archive ? user._id : null;
  doc.archiveReason = archive ? reason.trim() : '';
  doc.updatedBy = user._id;
  await doc.save();

  await recordApprovalHistory({
    inspectionType,
    inspectionId: doc._id,
    reportNumber: doc.reportNumber,
    stage: 'Archive',
    action: archive ? 'Archived' : 'Restored',
    user,
    comments: reason.trim(),
  });

  await recordAudit({
    entityType: inspectionType,
    entityId: doc._id,
    entityIdentifier: doc.reportNumber,
    action: archive ? 'ARCHIVE' : 'RESTORE',
    user,
    summary: `${archive ? 'Archived' : 'Restored'} ${doc.reportNumber}${reason ? `: ${reason}` : ''}`,
    req,
  });

  return doc;
}

