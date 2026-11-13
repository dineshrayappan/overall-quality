import React, { useState } from 'react';
import { Archive, CheckCircle, RotateCcw, Send, XCircle } from 'lucide-react';
import { api, getErrorMessage } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.jsx';
import StatusBadge from './StatusBadge.jsx';

export default function ApprovalPanel({
  endpointBase,
  moduleKey,
  inspectionType,
  record,
  onUpdated,
}) {
  const { user, permissions, hasPerm } = useAuth();
  const [comments, setComments] = useState('');
  const [decision, setDecision] = useState(
    record?.finalDecision && record.finalDecision !== 'Pending'
      ? record.finalDecision
      : record?.calculations?.acceptanceRuleEvaluation?.suggestedDecision || 'Accepted'
  );
  const [revisionReason, setRevisionReason] = useState('');
  const [archiveReason, setArchiveReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  if (!record?._id) return null;

  const isMultiStage = ['seven_point', 'measurement'].includes(inspectionType);
  const stages = record.workflowStages || [];
  const nextPendingStage = stages.find((s) => s.status === 'Pending');
  const rolePermStages = permissions?.[moduleKey]?.approvalStages || [];
  const canActOnNextStage =
    user?.role === 'Admin' ||
    (nextPendingStage &&
      (!nextPendingStage.allowedRoles?.length ||
        nextPendingStage.allowedRoles.includes(user?.role)) &&
      (!rolePermStages.length || rolePermStages.includes(nextPendingStage.stage)));

  const runAction = async (path, payload, label) => {
    setError('');
    setSuccessMsg('');
    setBusy(true);
    try {
      await api.post(`${endpointBase}/${record._id}${path}`, payload);
      setComments('');
      setRevisionReason('');
      setSuccessMsg(`${label} completed.`);
      await onUpdated?.();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const handleArchiveToggle = async () => {
    if (!record.isArchived && !archiveReason.trim()) {
      setError('Please enter a reason to archive this report.');
      return;
    }
    setError('');
    setBusy(true);
    try {
      await api.patch(`${endpointBase}/${record._id}/archive`, {
        isArchived: !record.isArchived,
        reason: archiveReason.trim() || 'Restored by authorized user',
      });
      setArchiveReason('');
      setSuccessMsg(record.isArchived ? 'Report restored.' : 'Report archived.');
      await onUpdated?.();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card" aria-label="Approval & Revision Workflow">
      <div className="card-header">
        <div>
          <h2 className="card-title">Digital Approval &amp; Audit Workflow</h2>
          <span className="muted">
            Report {record.reportNumber} · Version v{record.version || 1}
          </span>
        </div>
        <div className="btn-row">
          <StatusBadge value={record.approvalStatus} />
          {record.isArchived ? <StatusBadge value="Archived" /> : null}
        </div>
      </div>

      {error ? <div className="alert alert-error">{error}</div> : null}
      {successMsg ? <div className="alert alert-success">{successMsg}</div> : null}

      {isMultiStage && stages.length > 0 ? (
        <div className="table-wrapper" tabIndex={0} role="region" aria-label="Approval data table" style={{ marginBlockEnd: '1rem' }}>
          <table className="qms-table">
            <thead>
              <tr>
                <th>Stage</th>
                <th>Requirement</th>
                <th>Status</th>
                <th>Approver</th>
                <th>Role</th>
                <th>Timestamp</th>
                <th>Comments</th>
              </tr>
            </thead>
            <tbody>
              {stages.map((s) => (
                <tr key={s.stage}>
                  <td><strong>{s.stage}</strong></td>
                  <td>{s.required ? 'Required' : 'Optional'}</td>
                  <td><StatusBadge value={s.status} /></td>
                  <td>{s.actionByName || '-'}</td>
                  <td>{s.actionByRole || '-'}</td>
                  <td>{s.actionAt ? new Date(s.actionAt).toLocaleString() : '-'}</td>
                  <td>{s.comments || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {!record.isArchived && ['Draft', 'Returned for Correction'].includes(record.approvalStatus) && hasPerm(moduleKey, 'submit') ? (
        <div className="btn-row" style={{ marginBlockEnd: '1rem' }}>
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy}
            onClick={() => runAction('/submit', {}, 'Submission')}
          >
            <Send size={15} aria-hidden="true" />
            <span>Submit for Approval</span>
          </button>
        </div>
      ) : null}

      {!record.isArchived && record.approvalStatus === 'Pending Approval' && (hasPerm(moduleKey, 'approve') || hasPerm(moduleKey, 'reject')) ? (
        <div
          style={{
            background: 'var(--surface-muted)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            padding: '1rem',
            marginBlockEnd: '1rem',
          }}
        >
          {isMultiStage && nextPendingStage ? (
            <p style={{ marginTop: 0, fontWeight: 600 }}>
              Next Pending Stage: <span className="badge badge-info">{nextPendingStage.stage}</span>
              {!canActOnNextStage ? (
                <span className="muted" style={{ marginInlineStart: '0.5rem' }}>
                  (Assigned roles: {nextPendingStage.allowedRoles?.join(', ') || 'Admin'})
                </span>
              ) : null}
            </p>
          ) : null}

          {inspectionType === 'size_set' ? (
            <div className="field">
              <label htmlFor="approval-decision">Final Decision</label>
              <select
                id="approval-decision"
                value={decision}
                onChange={(e) => setDecision(e.target.value)}
              >
                <option value="Accepted">Accepted</option>
                <option value="Rework">Rework</option>
                <option value="Hold">Hold</option>
              </select>
              {record.calculations?.acceptanceRuleEvaluation?.failedRules?.length ? (
                <span className="hint" style={{ color: 'var(--warning)' }}>
                  Rule alerts: {record.calculations.acceptanceRuleEvaluation.failedRules.join(' ')}
                </span>
              ) : null}
            </div>
          ) : null}

          <div className="field">
            <label htmlFor="approval-comments">Approval / Rejection Comments</label>
            <textarea
              id="approval-comments"
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              placeholder="Enter approval remarks (required for rejection, return, or rule override)..."
            />
          </div>

          <div className="btn-row">
            {hasPerm(moduleKey, 'approve') && (!isMultiStage || canActOnNextStage) ? (
              <button
                type="button"
                className="btn btn-success"
                disabled={busy}
                onClick={() =>
                  runAction(
                    '/approve',
                    {
                      stage: nextPendingStage?.stage,
                      decision: inspectionType === 'size_set' ? decision : undefined,
                      comments,
                    },
                    'Approval'
                  )
                }
              >
                <CheckCircle size={15} aria-hidden="true" />
                <span>{isMultiStage && nextPendingStage ? `Approve (${nextPendingStage.stage})` : 'Approve Report'}</span>
              </button>
            ) : null}

            {hasPerm(moduleKey, 'reject') && (!isMultiStage || canActOnNextStage) ? (
              <>
                <button
                  type="button"
                  className="btn btn-warning"
                  disabled={busy}
                  onClick={() =>
                    runAction(
                      '/reject',
                      {
                        stage: nextPendingStage?.stage,
                        returnForCorrection: true,
                        comments,
                      },
                      'Return for correction'
                    )
                  }
                >
                  <RotateCcw size={15} aria-hidden="true" />
                  <span>Return for Correction</span>
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  disabled={busy}
                  onClick={() =>
                    runAction(
                      '/reject',
                      {
                        stage: nextPendingStage?.stage,
                        returnForCorrection: false,
                        comments,
                      },
                      'Rejection'
                    )
                  }
                >
                  <XCircle size={15} aria-hidden="true" />
                  <span>Reject</span>
                </button>
              </>
            ) : null}
          </div>
        </div>
      ) : null}

      {!record.isArchived && ['Approved', 'Rejected'].includes(record.approvalStatus) && hasPerm(moduleKey, 'edit') ? (
        <div
          style={{
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            padding: '0.85rem',
            marginBlockEnd: '1rem',
          }}
        >
          <div className="field" style={{ marginBlockEnd: '0.5rem' }}>
            <label htmlFor="revision-reason">Controlled Revision (Finalized reports are locked)</label>
            <input
              id="revision-reason"
              type="text"
              value={revisionReason}
              onChange={(e) => setRevisionReason(e.target.value)}
              placeholder="Reason for creating a new revision..."
            />
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={busy || !revisionReason.trim()}
            onClick={() => runAction('/revise', { reason: revisionReason.trim() }, 'Controlled revision')}
          >
            <RotateCcw size={14} aria-hidden="true" />
            <span>Create Revision (v{(record.version || 1) + 1})</span>
          </button>
        </div>
      ) : null}

      {hasPerm(moduleKey, 'archive') ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'flex-end', marginBlockEnd: '1rem' }}>
          {!record.isArchived ? (
            <div className="field" style={{ flex: '1 1 240px', marginBlockEnd: 0 }}>
              <label htmlFor="archive-reason">Soft-Archive Reason (submitted records are never permanently deleted)</label>
              <input
                id="archive-reason"
                type="text"
                value={archiveReason}
                onChange={(e) => setArchiveReason(e.target.value)}
                placeholder="Reason to archive..."
              />
            </div>
          ) : null}
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={busy}
            onClick={handleArchiveToggle}
          >
            <Archive size={14} aria-hidden="true" />
            <span>{record.isArchived ? 'Restore Report' : 'Archive Report'}</span>
          </button>
        </div>
      ) : null}

      {Array.isArray(record.approvalHistory) && record.approvalHistory.length > 0 ? (
        <div>
          <h3 style={{ fontSize: '0.9rem', margin: '0 0 0.5rem' }}>Approval &amp; Action Timeline</h3>
          <div className="table-wrapper" tabIndex={0} role="region" aria-label="Approval data table">
            <table className="qms-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Stage</th>
                  <th>Action</th>
                  <th>User</th>
                  <th>Role</th>
                  <th>Comments</th>
                </tr>
              </thead>
              <tbody>
                {record.approvalHistory.map((h) => (
                  <tr key={h._id}>
                    <td>{new Date(h.timestamp).toLocaleString()}</td>
                    <td>{h.stage || '-'}</td>
                    <td><StatusBadge value={h.action} /></td>
                    <td>{h.approverName}</td>
                    <td>{h.approverRole}</td>
                    <td>{h.comments || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {Array.isArray(record.revisionHistory) && record.revisionHistory.length > 0 ? (
        <div style={{ marginTop: '0.9rem' }}>
          <h3 style={{ fontSize: '0.9rem', margin: '0 0 0.5rem' }}>Revision Snapshots</h3>
          <ul style={{ margin: 0, paddingInlineStart: '1.25rem', fontSize: '0.84rem' }}>
            {record.revisionHistory.map((rev) => (
              <li key={rev.version}>
                <strong>v{rev.version}</strong> archived on{' '}
                {new Date(rev.revisedAt).toLocaleString()} by {rev.revisedByName} —{' '}
                <em>{rev.reason}</em>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
