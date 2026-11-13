import React, { useCallback, useEffect, useState } from 'react';
import { Archive, Edit2, Plus, RefreshCw } from 'lucide-react';
import { api, getErrorMessage } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import ModalDialog from '../components/common/ModalDialog.jsx';
import StatusBadge from '../components/common/StatusBadge.jsx';

const MASTER_TABS = [
  {
    key: 'buyers',
    label: 'Buyers',
    columns: ['code', 'name', 'contactPerson', 'country', 'phone'],
    fields: [
      { name: 'name', label: 'Buyer Name', required: true },
      { name: 'contactPerson', label: 'Contact Person' },
      { name: 'email', label: 'Email', type: 'email' },
      { name: 'phone', label: 'Phone' },
      { name: 'country', label: 'Country' },
      { name: 'address', label: 'Address', type: 'textarea' },
    ],
  },
  {
    key: 'suppliers',
    label: 'Suppliers',
    columns: ['code', 'name', 'contactPerson', 'factoryLocation', 'phone'],
    fields: [
      { name: 'name', label: 'Supplier Name', required: true },
      { name: 'contactPerson', label: 'Contact Person' },
      { name: 'email', label: 'Email', type: 'email' },
      { name: 'phone', label: 'Phone' },
      { name: 'factoryLocation', label: 'Factory Location' },
      { name: 'address', label: 'Address', type: 'textarea' },
    ],
  },
  {
    key: 'styles',
    label: 'Styles',
    columns: ['code', 'styleNumber', 'name', 'description', 'category'],
    fields: [
      { name: 'styleNumber', label: 'Style Number', required: true },
      { name: 'name', label: 'Style Name', required: true },
      { name: 'description', label: 'Style Description' },
      { name: 'buyerId', label: 'Default Buyer', type: 'ref', refEntity: 'buyers', refLabel: (r) => r.name },
      { name: 'season', label: 'Season' },
      { name: 'category', label: 'Category' },
    ],
  },
  {
    key: 'orders',
    label: 'Orders',
    columns: ['code', 'orderNumber', 'buyerId', 'styleId', 'orderQuantity', 'status'],
    fields: [
      { name: 'orderNumber', label: 'Order Number', required: true },
      { name: 'buyerId', label: 'Buyer', type: 'ref', refEntity: 'buyers', required: true, refLabel: (r) => r.name },
      { name: 'styleId', label: 'Style', type: 'ref', refEntity: 'styles', required: true, refLabel: (r) => `${r.styleNumber} — ${r.name}` },
      { name: 'styleDescription', label: 'Style Description Override' },
      { name: 'orderQuantity', label: 'Order Quantity', type: 'number', required: true, min: 1 },
      { name: 'fabricId', label: 'Fabric', type: 'ref', refEntity: 'fabrics', refLabel: (r) => r.name },
      { name: 'gsmId', label: 'GSM', type: 'ref', refEntity: 'gsms', refLabel: (r) => r.name || `${r.value} GSM` },
      { name: 'colourId', label: 'Colour', type: 'ref', refEntity: 'colours', refLabel: (r) => r.name },
      { name: 'supplierId', label: 'Supplier', type: 'ref', refEntity: 'suppliers', refLabel: (r) => r.name },
      { name: 'sizeRangeId', label: 'Size Range', type: 'ref', refEntity: 'size-ranges', refLabel: (r) => `${r.name} (${(r.sizes || []).join(', ')})` },
      { name: 'deliveryDate', label: 'Delivery Date', type: 'date' },
      { name: 'status', label: 'Status', type: 'select', options: ['Open', 'In Production', 'Completed', 'Cancelled'] },
    ],
  },
  {
    key: 'fabrics',
    label: 'Fabrics',
    columns: ['code', 'name', 'composition', 'construction', 'width'],
    fields: [
      { name: 'name', label: 'Fabric Name', required: true },
      { name: 'composition', label: 'Composition' },
      { name: 'construction', label: 'Construction' },
      { name: 'width', label: 'Width' },
    ],
  },
  {
    key: 'colours',
    label: 'Colours',
    columns: ['code', 'name', 'pantoneCode', 'hexCode'],
    fields: [
      { name: 'name', label: 'Colour Name', required: true },
      { name: 'pantoneCode', label: 'Pantone Code' },
      { name: 'hexCode', label: 'Hex Code (e.g. #1e3a5f)' },
    ],
  },
  {
    key: 'gsms',
    label: 'GSM',
    columns: ['code', 'value', 'name', 'description'],
    fields: [
      { name: 'value', label: 'GSM Value (Numeric)', type: 'number', required: true, min: 1 },
      { name: 'name', label: 'Display Label (auto if blank)' },
      { name: 'description', label: 'Description' },
    ],
  },
  {
    key: 'size-ranges',
    label: 'Size Ranges',
    columns: ['code', 'name', 'sizes'],
    fields: [
      { name: 'name', label: 'Size Range Name (e.g. S - XXL)', required: true },
      { name: 'sizes', label: 'Sizes (comma-separated, e.g. S, M, L, XL)', required: true, isCsvArray: true },
    ],
  },
  {
    key: 'production-lines',
    label: 'Production Lines',
    columns: ['code', 'name', 'floor', 'departmentId', 'capacity'],
    fields: [
      { name: 'name', label: 'Line Name', required: true },
      { name: 'floor', label: 'Floor / Section' },
      { name: 'departmentId', label: 'Department', type: 'ref', refEntity: 'departments', refLabel: (r) => r.name },
      { name: 'capacity', label: 'Daily Capacity', type: 'number', min: 0 },
    ],
  },
  {
    key: 'departments',
    label: 'Departments',
    columns: ['code', 'name', 'description'],
    fields: [
      { name: 'name', label: 'Department Name', required: true },
      { name: 'description', label: 'Description' },
    ],
  },
  {
    key: 'employees',
    label: 'Employees',
    columns: ['code', 'employeeCode', 'name', 'designation', 'productionLineId'],
    fields: [
      { name: 'employeeCode', label: 'Employee ID / Code', required: true },
      { name: 'name', label: 'Employee Name', required: true },
      { name: 'departmentId', label: 'Department', type: 'ref', refEntity: 'departments', refLabel: (r) => r.name },
      { name: 'productionLineId', label: 'Production Line', type: 'ref', refEntity: 'production-lines', refLabel: (r) => r.name },
      { name: 'designation', label: 'Designation' },
      { name: 'phone', label: 'Phone' },
    ],
  },
  {
    key: 'processes',
    label: 'Processes',
    columns: ['code', 'name', 'departmentId', 'description'],
    fields: [
      { name: 'name', label: 'Process Name', required: true },
      { name: 'departmentId', label: 'Department', type: 'ref', refEntity: 'departments', refLabel: (r) => r.name },
      { name: 'description', label: 'Description' },
    ],
  },
  {
    key: 'machines',
    label: 'Machines',
    columns: ['code', 'machineNumber', 'name', 'machineType', 'productionLineId'],
    fields: [
      { name: 'machineNumber', label: 'Machine Number / Asset ID', required: true },
      { name: 'name', label: 'Machine Name', required: true },
      { name: 'machineType', label: 'Machine Type' },
      { name: 'productionLineId', label: 'Production Line', type: 'ref', refEntity: 'production-lines', refLabel: (r) => r.name },
    ],
  },
  {
    key: 'needles',
    label: 'Needles',
    columns: ['code', 'needleNumber', 'name', 'needleType', 'size'],
    fields: [
      { name: 'needleNumber', label: 'Needle Number', required: true },
      { name: 'name', label: 'Needle Name', required: true },
      { name: 'needleType', label: 'Needle Type' },
      { name: 'size', label: 'Needle Size' },
      { name: 'description', label: 'Description' },
    ],
  },
  {
    key: 'measurement-specs',
    label: 'Measurement Specs',
    columns: ['code', 'styleId', 'size', 'measurementPoint', 'approvedSpec', 'lowerTolerance', 'upperTolerance'],
    fields: [
      { name: 'styleId', label: 'Style', type: 'ref', refEntity: 'styles', required: true, refLabel: (r) => `${r.styleNumber} — ${r.name}` },
      { name: 'size', label: 'Size (e.g. M, L, 32)', required: true },
      { name: 'measurementPoint', label: 'Measurement Point', required: true },
      { name: 'measurementDescription', label: 'Description' },
      { name: 'unit', label: 'Unit', type: 'select', options: ['cm', 'inch', 'mm'] },
      { name: 'approvedSpec', label: 'Approved Specification (Numeric)', type: 'number', step: 'any', required: true },
      { name: 'lowerTolerance', label: 'Lower Tolerance (e.g. -0.5)', type: 'number', step: 'any', required: true },
      { name: 'upperTolerance', label: 'Upper Tolerance (e.g. +0.5)', type: 'number', step: 'any', required: true },
      { name: 'sortOrder', label: 'Sort Order', type: 'number' },
    ],
  },
  {
    key: 'inspection-checkpoints',
    label: 'Checkpoints',
    columns: ['code', 'module', 'section', 'checkpointNumber', 'name', 'isCritical'],
    fields: [
      { name: 'module', label: 'Module', type: 'select', options: ['target_chart', 'size_set', 'seven_point'], required: true },
      { name: 'section', label: 'Section (e.g. accessories, workmanship, labelling, checkpoints)', required: true },
      { name: 'checkpointNumber', label: 'Checkpoint #', type: 'number' },
      { name: 'name', label: 'Checkpoint Name', required: true },
      { name: 'description', label: 'Description' },
      { name: 'isCritical', label: 'Critical Checkpoint', type: 'checkbox' },
      { name: 'sortOrder', label: 'Sort Order', type: 'number' },
    ],
  },
];

function formatCell(val) {
  if (val === null || val === undefined || val === '') return '-';
  if (Array.isArray(val)) return val.join(', ');
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  if (typeof val === 'object') {
    return val.orderNumber || val.styleNumber || val.name || val.code || '-';
  }
  return String(val);
}

export default function MasterDataPage() {
  const { hasPerm } = useAuth();
  const [activeTabKey, setActiveTabKey] = useState('buyers');
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState([]);
  const [refs, setRefs] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingDoc, setEditingDoc] = useState(null);
  const [formState, setFormState] = useState({});
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState('');

  const activeTab = MASTER_TABS.find((t) => t.key === activeTabKey) || MASTER_TABS[0];

  const loadRows = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const qs = new URLSearchParams({ limit: '100' });
      if (search.trim()) qs.set('search', search.trim());
      const res = await api.get(`/masters/${activeTab.key}?${qs.toString()}`);
      setRows(res.data?.data || []);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [activeTab.key, search]);

  const loadTabRefs = useCallback(async () => {
    const refEntities = [
      ...new Set(activeTab.fields.filter((f) => f.type === 'ref').map((f) => f.refEntity)),
    ];
    if (refEntities.length === 0) return;
    const entries = await Promise.all(
      refEntities.map(async (ent) => {
        const res = await api.get(`/masters/${ent}?activeOnly=true&limit=200`);
        return [ent, res.data?.data || []];
      })
    );
    setRefs((prev) => ({ ...prev, ...Object.fromEntries(entries) }));
  }, [activeTab.fields]);

  useEffect(() => {
    loadRows();
    loadTabRefs();
  }, [loadRows, loadTabRefs]);

  const openModal = (doc = null) => {
    setEditingDoc(doc);
    setModalError('');
    const initial = {};
    for (const f of activeTab.fields) {
      const rawVal = doc?.[f.name];
      if (f.type === 'ref') {
        initial[f.name] = rawVal?._id || rawVal || '';
      } else if (f.isCsvArray) {
        initial[f.name] = Array.isArray(rawVal) ? rawVal.join(', ') : '';
      } else if (f.type === 'date' && rawVal) {
        initial[f.name] = new Date(rawVal).toISOString().slice(0, 10);
      } else if (f.type === 'checkbox') {
        initial[f.name] = Boolean(rawVal);
      } else if (f.type === 'select') {
        initial[f.name] = rawVal ?? f.options[0];
      } else {
        initial[f.name] = rawVal ?? '';
      }
    }
    setFormState(initial);
    setModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setModalError('');
    setSaving(true);
    try {
      const payload = { ...formState };
      for (const f of activeTab.fields) {
        if (f.type === 'number' && payload[f.name] !== '') {
          payload[f.name] = Number(payload[f.name]);
        }
        if (f.type === 'ref' && !payload[f.name]) {
          payload[f.name] = null;
        }
        if (f.isCsvArray && typeof payload[f.name] === 'string') {
          payload[f.name] = payload[f.name]
            .split(',')
            .map((x) => x.trim())
            .filter(Boolean);
        }
      }

      if (editingDoc?._id) {
        await api.patch(`/masters/${activeTab.key}/${editingDoc._id}`, payload);
      } else {
        await api.post(`/masters/${activeTab.key}`, payload);
      }
      setModalOpen(false);
      await loadRows();
    } catch (err) {
      setModalError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const toggleArchive = async (doc) => {
    try {
      await api.patch(`/masters/${activeTab.key}/${doc._id}/archive`, {
        isActive: !doc.isActive,
      });
      await loadRows();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const specRangePreview =
    activeTab.key === 'measurement-specs' &&
    formState.approvedSpec !== '' &&
    formState.lowerTolerance !== '' &&
    formState.upperTolerance !== ''
      ? `${Number(formState.approvedSpec) + Number(formState.lowerTolerance)} to ${
          Number(formState.approvedSpec) + Number(formState.upperTolerance)
        } ${formState.unit || 'cm'}`
      : '';

  return (
    <div>
      <section className="card">
        <div className="card-header">
          <div>
            <h1 className="card-title" style={{ fontSize: '1.15rem' }}>
              Common Master Data Management (16 Masters)
            </h1>
            <span className="muted">
              Centralized source of truth auto-populated across all 4 inspection modules
            </span>
          </div>
          {hasPerm('masterData', 'create') ? (
            <button type="button" className="btn btn-primary btn-sm" onClick={() => openModal(null)}>
              <Plus size={15} aria-hidden="true" />
              <span>Add {activeTab.label.replace(/s$/, '')}</span>
            </button>
          ) : null}
        </div>

        <div className="tablist" role="tablist" aria-label="Master Data categories">
          {MASTER_TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              className="tab-btn"
              aria-selected={activeTabKey === t.key}
              onClick={() => {
                setActiveTabKey(t.key);
                setSearch('');
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.9rem', flexWrap: 'wrap' }}>
          <input
            type="search"
            aria-label={`Search ${activeTab.label}`}
            placeholder={`Search ${activeTab.label}...`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ maxWidth: 340 }}
          />
          <button type="button" className="btn btn-secondary btn-sm" onClick={loadRows}>
            <RefreshCw size={14} aria-hidden="true" />
            <span>Refresh</span>
          </button>
        </div>

        {error ? <div className="alert alert-error">{error}</div> : null}

        {loading ? (
          <p className="muted">Loading {activeTab.label}...</p>
        ) : rows.length === 0 ? (
          <p className="muted">No records in {activeTab.label} yet.</p>
        ) : (
          <div className="table-wrapper" tabIndex={0} role="region" aria-label="Master records table">
            <table className="qms-table responsive-stack">
              <thead>
                <tr>
                  {activeTab.columns.map((c) => (
                    <th key={c}>{c}</th>
                  ))}
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((doc) => (
                  <tr key={doc._id}>
                    {activeTab.columns.map((c) => (
                      <td key={c} data-label={c}>
                        {formatCell(doc[c])}
                      </td>
                    ))}
                    <td data-label="Status">
                      <StatusBadge value={doc.isActive ? 'OK' : 'Archived'} />
                    </td>
                    <td data-label="Actions">
                      <div className="btn-row">
                        {hasPerm('masterData', 'edit') ? (
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => openModal(doc)}
                          >
                            <Edit2 size={13} aria-hidden="true" />
                            <span>Edit</span>
                          </button>
                        ) : null}
                        {hasPerm('masterData', 'archive') ? (
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => toggleArchive(doc)}
                          >
                            <Archive size={13} aria-hidden="true" />
                            <span>{doc.isActive ? 'Deactivate' : 'Activate'}</span>
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <ModalDialog
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={`${editingDoc ? 'Edit' : 'Add'} ${activeTab.label}`}
      >
        {modalError ? <div className="alert alert-error">{modalError}</div> : null}
        {specRangePreview ? (
          <div className="alert alert-info">
            Acceptable Measurement Range Preview: <strong>{specRangePreview}</strong>
          </div>
        ) : null}
        <form onSubmit={handleSave}>
          {activeTab.fields.map((f) => (
            <div className="field" key={f.name}>
              {f.type === 'checkbox' ? (
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    type="checkbox"
                    checked={Boolean(formState[f.name])}
                    onChange={(e) => setFormState({ ...formState, [f.name]: e.target.checked })}
                  />
                  <span>{f.label}</span>
                </label>
              ) : (
                <>
                  <label htmlFor={`master-f-${f.name}`}>
                    {f.label} {f.required ? '*' : ''}
                  </label>
                  {f.type === 'textarea' ? (
                    <textarea
                      id={`master-f-${f.name}`}
                      required={f.required}
                      value={formState[f.name] ?? ''}
                      onChange={(e) => setFormState({ ...formState, [f.name]: e.target.value })}
                    />
                  ) : f.type === 'select' ? (
                    <select
                      id={`master-f-${f.name}`}
                      required={f.required}
                      value={formState[f.name] ?? f.options[0]}
                      onChange={(e) => setFormState({ ...formState, [f.name]: e.target.value })}
                    >
                      {f.options.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  ) : f.type === 'ref' ? (
                    <select
                      id={`master-f-${f.name}`}
                      required={f.required}
                      value={formState[f.name] ?? ''}
                      onChange={(e) => setFormState({ ...formState, [f.name]: e.target.value })}
                    >
                      <option value="">Select {f.label}...</option>
                      {(refs[f.refEntity] || []).map((opt) => (
                        <option key={opt._id} value={opt._id}>
                          {f.refLabel(opt)} ({opt.code})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      id={`master-f-${f.name}`}
                      type={f.type || 'text'}
                      step={f.step}
                      min={f.min}
                      required={f.required}
                      value={formState[f.name] ?? ''}
                      onChange={(e) => setFormState({ ...formState, [f.name]: e.target.value })}
                    />
                  )}
                </>
              )}
            </div>
          ))}

          <div className="btn-row">
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving...' : 'Save Record'}
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
