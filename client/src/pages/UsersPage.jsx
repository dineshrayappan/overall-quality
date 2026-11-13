import React, { useCallback, useEffect, useState } from 'react';
import { Edit2, Plus } from 'lucide-react';
import { api, getErrorMessage } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import ModalDialog from '../components/common/ModalDialog.jsx';
import StatusBadge from '../components/common/StatusBadge.jsx';

export default function UsersPage() {
  const { hasPerm } = useAuth();
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [lines, setLines] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    username: '',
    fullName: '',
    email: '',
    password: '',
    role: 'QC Inspector',
    assignedLines: [],
    isActive: true,
  });
  const [error, setError] = useState('');
  const [modalError, setModalError] = useState('');
  const [saving, setSaving] = useState(false);

  const loadAll = useCallback(async () => {
    try {
      const [u, r, l] = await Promise.all([
        api.get('/users'),
        api.get('/config/roles'),
        api.get('/masters/production-lines?activeOnly=true&limit=200'),
      ]);
      setUsers(u.data?.data || []);
      setRoles(r.data?.data || []);
      setLines(l.data?.data || []);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const openModal = (u = null) => {
    setEditing(u);
    setModalError('');
    setForm({
      username: u?.username || '',
      fullName: u?.fullName || '',
      email: u?.email || '',
      password: '',
      role: u?.role || 'QC Inspector',
      assignedLines: (u?.assignedLines || []).map((l) => l._id || l),
      isActive: u ? u.isActive : true,
    });
    setModalOpen(true);
  };

  const toggleLine = (lineId) => {
    setForm((prev) => {
      const exists = prev.assignedLines.includes(lineId);
      return {
        ...prev,
        assignedLines: exists
          ? prev.assignedLines.filter((id) => id !== lineId)
          : [...prev.assignedLines, lineId],
      };
    });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setModalError('');
    setSaving(true);
    try {
      if (editing?._id) {
        const payload = { ...form };
        delete payload.username;
        if (!payload.password) delete payload.password;
        await api.patch(`/users/${editing._id}`, payload);
      } else {
        await api.post('/users', form);
      }
      setModalOpen(false);
      await loadAll();
    } catch (err) {
      setModalError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <section className="card">
        <div className="card-header">
          <div>
            <h1 className="card-title" style={{ fontSize: '1.15rem' }}>
              Users &amp; Production Line Access Scope
            </h1>
            <span className="muted">
              Manage Quality users, roles, and line-level authorization
            </span>
          </div>
          {hasPerm('users', 'create') ? (
            <button type="button" className="btn btn-primary btn-sm" onClick={() => openModal(null)}>
              <Plus size={15} aria-hidden="true" />
              <span>Create User</span>
            </button>
          ) : null}
        </div>

        {error ? <div className="alert alert-error">{error}</div> : null}

        <div className="table-wrapper" tabIndex={0} role="region" aria-label="Users management table">
          <table className="qms-table responsive-stack">
            <thead>
              <tr>
                <th>Username</th>
                <th>Full Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Assigned Lines</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u._id}>
                  <td data-label="Username"><strong>{u.username}</strong></td>
                  <td data-label="Full Name">{u.fullName}</td>
                  <td data-label="Email">{u.email || '-'}</td>
                  <td data-label="Role"><span className="badge badge-info">{u.role}</span></td>
                  <td data-label="Assigned Lines">
                    {(u.assignedLines || []).length === 0
                      ? 'None / Role Default'
                      : u.assignedLines.map((l) => l.name || l).join(', ')}
                  </td>
                  <td data-label="Status">
                    <StatusBadge value={u.isActive ? 'OK' : 'Archived'} />
                  </td>
                  <td data-label="Action">
                    {hasPerm('users', 'edit') ? (
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => openModal(u)}
                      >
                        <Edit2 size={13} aria-hidden="true" />
                        <span>Edit</span>
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <ModalDialog
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? `Edit User: ${editing.username}` : 'Create User'}
      >
        {modalError ? <div className="alert alert-error">{modalError}</div> : null}
        <form onSubmit={handleSave}>
          <div className="grid-2">
            <div className="field">
              <label htmlFor="u-username">Username *</label>
              <input
                id="u-username"
                type="text"
                required
                disabled={Boolean(editing)}
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="u-fullname">Full Name *</label>
              <input
                id="u-fullname"
                type="text"
                required
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="u-email">Email</label>
              <input
                id="u-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="u-role">Role *</label>
              <select
                id="u-role"
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
              >
                {roles.map((r) => (
                  <option key={r.roleName} value={r.roleName}>{r.roleName}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="field">
            <label htmlFor="u-pass">
              {editing ? 'New Password (leave blank to keep current)' : 'Password * (min 8 chars)'}
            </label>
            <input
              id="u-pass"
              type="password"
              required={!editing}
              minLength={editing ? undefined : 8}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </div>

          <fieldset style={{ border: '1px solid var(--border)', borderRadius: '6px', padding: '0.75rem', marginBottom: '0.85rem' }}>
            <legend style={{ fontSize: '0.84rem', fontWeight: 700 }}>
              Assigned Production Lines (for QC / Supervisor line scoping)
            </legend>
            {lines.length === 0 ? (
              <p className="muted" style={{ margin: 0 }}>Create Production Lines in Master Data first.</p>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
                {lines.map((l) => (
                  <label key={l._id} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.85rem' }}>
                    <input
                      type="checkbox"
                      checked={form.assignedLines.includes(l._id)}
                      onChange={() => toggleLine(l._id)}
                    />
                    <span>{l.name}</span>
                  </label>
                ))}
              </div>
            )}
          </fieldset>

          <div className="field">
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
              />
              <span>Account Active</span>
            </label>
          </div>

          <div className="btn-row">
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving...' : 'Save User'}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setModalOpen(false)}
            >
              Cancel
            </button>
          </div>
        </form>
      </ModalDialog>
    </div>
  );
}
