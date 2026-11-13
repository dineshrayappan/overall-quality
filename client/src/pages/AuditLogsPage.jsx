import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { api, getErrorMessage } from '../api/client.js';

export default function AuditLogsPage() {
  const [logs, setLogs] = useState([]);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const qs = new URLSearchParams({ limit: '100' });
      if (search.trim()) qs.set('search', search.trim());
      if (actionFilter) qs.set('action', actionFilter);
      const res = await api.get(`/audit-logs?${qs.toString()}`);
      setLogs(res.data?.data || []);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [search, actionFilter]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  return (
    <section className="card">
      <div className="card-header">
        <div>
          <h1 className="card-title" style={{ fontSize: '1.15rem' }}>
            System Audit Trail &amp; Change History
          </h1>
          <span className="muted">
            Immutable log of creations, edits, submissions, approvals, rejections, revisions, and archives
          </span>
        </div>
        <button type="button" className="btn btn-secondary btn-sm" onClick={loadLogs}>
          <RefreshCw size={14} aria-hidden="true" />
          <span>Refresh</span>
        </button>
      </div>

      <div className="grid-3" style={{ marginBottom: '0.9rem' }}>
        <div className="field" style={{ marginBlockEnd: 0 }}>
          <label htmlFor="audit-search">Search Identifier / User / Summary</label>
          <input
            id="audit-search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Report #, user, summary..."
          />
        </div>
        <div className="field" style={{ marginBlockEnd: 0 }}>
          <label htmlFor="audit-action">Action Type</label>
          <select
            id="audit-action"
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
          >
            <option value="">All Actions</option>
            <option value="CREATE">CREATE</option>
            <option value="UPDATE">UPDATE</option>
            <option value="SUBMIT">SUBMIT</option>
            <option value="APPROVE">APPROVE</option>
            <option value="REJECT">REJECT</option>
            <option value="RETURN">RETURN</option>
            <option value="REVISE">REVISE</option>
            <option value="ARCHIVE">ARCHIVE</option>
            <option value="RESTORE">RESTORE</option>
            <option value="CONFIG_UPDATE">CONFIG_UPDATE</option>
            <option value="LOGIN">LOGIN</option>
          </select>
        </div>
      </div>

      {error ? <div className="alert alert-error">{error}</div> : null}

      {loading ? (
        <p className="muted">Loading audit logs...</p>
      ) : (
        <div className="table-wrapper" tabIndex={0} role="region" aria-label="Audit logs data table">
          <table className="qms-table responsive-stack">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Action</th>
                <th>Entity Type</th>
                <th>Identifier</th>
                <th>User</th>
                <th>Role</th>
                <th>Summary</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log._id}>
                  <td data-label="Timestamp">{new Date(log.timestamp).toLocaleString()}</td>
                  <td data-label="Action"><span className="badge badge-info">{log.action}</span></td>
                  <td data-label="Entity">{log.entityType}</td>
                  <td data-label="Identifier"><strong>{log.entityIdentifier || '-'}</strong></td>
                  <td data-label="User">{log.actorName} ({log.actorUsername})</td>
                  <td data-label="Role">{log.actorRole}</td>
                  <td data-label="Summary">{log.summary}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
