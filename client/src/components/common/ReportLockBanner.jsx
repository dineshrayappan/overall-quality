import React, { useState } from 'react';
import { Edit3, Lock, RotateCcw } from 'lucide-react';
import { api, getErrorMessage } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.jsx';

/**
 * Displays a clear lock notice at the top of read-only inspection reports
 * with 1-click actions to return Pending reports to Draft or create a revision on finalized reports.
 */
export default function ReportLockBanner({ endpointBase, moduleKey, record, onUnlocked }) {
  const { user, hasPerm } = useAuth();
  const [reason, setReason] = useState('Edit requested by authorized user');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  if (!record?._id || record.isArchived) return null;
  if (['Draft', 'Returned for Correction'].includes(record.approvalStatus)) return null;

  const isPending = record.approvalStatus === 'Pending Approval';
  const isFinal = ['Approved', 'Rejected'].includes(record.approvalStatus);

  const canReturnToDraft =
    isPending &&
    (user?.role === 'Admin' ||
      hasPerm(moduleKey, 'reject') ||
      hasPerm(moduleKey, 'edit') ||
      hasPerm(moduleKey, 'create'));

  const canRevise =
    isFinal && (user?.role === 'Admin' || hasPerm(moduleKey, 'edit'));

  const handleReturnToDraft = async () => {
    setErr('');
    setBusy(true);
    try {
      const nextStage = record.workflowStages?.find((s) => s.status === 'Pending')?.stage;
      await api.post(`${endpointBase}/${record._id}/reject`, {
        stage: nextStage || undefined,
        returnForCorrection: true,
        comments: 'Returned to draft for editing',
      });
      await onUnlocked?.();
    } catch (e) {
      setErr(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const handleCreateRevision = async () => {
    const revReason = (reason || '').trim() || 'Edit requested by authorized user';
    setErr('');
    setBusy(true);
    try {
      await api.post(`${endpointBase}/${record._id}/revise`, { reason: revReason });
      await onUnlocked?.();
    } catch (e) {
      setErr(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`alert ${isFinal ? 'alert-warning' : 'alert-info'}`} style={{ marginBottom: '0.75rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
          <Lock size={15} aria-hidden="true" />
          <span>
            This report is <strong>{record.approvalStatus}</strong> (v{record.version || 1}) and fields are locked.
          </span>
        </div>

        <div className="btn-row">
          {canReturnToDraft ? (
            <button
              type="button"
              className="btn btn-warning btn-sm"
              disabled={busy}
              onClick={handleReturnToDraft}
            >
              <RotateCcw size={14} aria-hidden="true" />
              <span>{busy ? 'Unlocking...' : 'Return to Draft to Edit'}</span>
            </button>
          ) : null}

          {canRevise ? (
            <>
              <input
                type="text"
                aria-label="Revision reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Revision reason..."
                style={{ width: 210, minBlockSize: '30px', padding: '0.2rem 0.45rem', fontSize: '0.8rem' }}
              />
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={busy}
                onClick={handleCreateRevision}
              >
                <Edit3 size={14} aria-hidden="true" />
                <span>{busy ? 'Creating Revision...' : `Unlock & Edit (Rev v${(record.version || 1) + 1})`}</span>
              </button>
            </>
          ) : null}
        </div>
      </div>
      {err ? <div style={{ marginTop: '0.4rem', color: 'var(--danger)', fontWeight: 600 }}>{err}</div> : null}
    </div>
  );
}

