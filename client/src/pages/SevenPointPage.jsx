import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Eye, Plus, Save, Trash2 } from 'lucide-react';
import { api, createSubmissionToken, getErrorMessage } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import SearchableSelect from '../components/common/SearchableSelect.jsx';
import StatusBadge from '../components/common/StatusBadge.jsx';
import ModalDialog from '../components/common/ModalDialog.jsx';
import ApprovalPanel from '../components/common/ApprovalPanel.jsx';
import PdfPreviewModal from '../components/common/PdfPreviewModal.jsx';
import ReportLockBanner from '../components/common/ReportLockBanner.jsx';
import {
  QuickLineModal,
  QuickOrderModal,
  QuickSimpleMasterModal,
} from '../components/common/QuickMasterModals.jsx';

export default function SevenPointPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, company, hasPerm } = useAuth();

  const [tab, setTab] = useState(id ? 'form' : 'list');
  const [records, setRecords] = useState([]);
  const [config, setConfig] = useState(null);
  const [masters, setMasters] = useState({
    orders: [],
    lines: [],
    employees: [],
    processes: [],
    machines: [],
    needles: [],
  });
  const [activeRecord, setActiveRecord] = useState(null);
  const [editingCp, setEditingCp] = useState(null); // { entryIdx, cpIdx }
  const [pdfOpen, setPdfOpen] = useState(false);
  const [quickOrderOpen, setQuickOrderOpen] = useState(false);
  const [quickLineOpen, setQuickLineOpen] = useState(false);
  const [quickMasterType, setQuickMasterType] = useState(null);

  const [form, setForm] = useState({
    sNo: '',
    qcName: user?.fullName || '',
    orderId: '',
    productionLineId: '',
    inspectionDate: new Date().toISOString().slice(0, 10),
    headerSnapshot: {},
    entries: [],
    remarks: '',
  });
  const [token, setToken] = useState(() => createSubmissionToken());
  const loadedIdRef = useRef(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const getActiveCheckpointDefs = useCallback((cfg) => {
    const count = Number(cfg?.checkpointCount || 10);
    const list = (cfg?.checkpoints || []).filter((c) => c.isActive !== false);
    return Array.from({ length: count }, (_, idx) => {
      const found = list[idx];
      return {
        checkpointNumber: found?.checkpointNumber || idx + 1,
        label: found?.label || `Point ${idx + 1}`,
        description: found?.description || '',
      };
    });
  }, []);

  const createBlankEntry = useCallback(
    (serialNumber, cfg) => ({
      serialNumber,
      employeeId: '',
      processId: '',
      machineId: '',
      needleId: '',
      needleNumber: '',
      needleChangeTime: '',
      piecesChecked: 0,
      okPieces: 0,
      reworkPieces: 0,
      rejectedPieces: 0,
      oilDefectCount: 0,
      checkpoints: getActiveCheckpointDefs(cfg).map((d) => ({
        checkpointNumber: d.checkpointNumber,
        label: d.label,
        result: '',
        status: 'Pass',
        defectDetails: '',
        remarks: '',
        inspectionTime: '',
      })),
    }),
    [getActiveCheckpointDefs]
  );

  const loadList = useCallback(async () => {
    try {
      const res = await api.get('/inspections/seven-points?limit=50');
      setRecords(res.data?.data || []);
    } catch {
      // ignore
    }
  }, []);

  const loadById = useCallback(async (recordId) => {
    if (!recordId) return;
    try {
      const res = await api.get(`/inspections/seven-points/${recordId}`);
      const doc = res.data?.data;
      setActiveRecord(doc);
      setForm({
        sNo: doc.sNo || '',
        qcName: doc.qcName || '',
        orderId: doc.orderId?._id || doc.orderId || '',
        productionLineId: doc.productionLineId?._id || doc.productionLineId || '',
        inspectionDate: new Date(doc.inspectionDate).toISOString().slice(0, 10),
        headerSnapshot: doc.headerSnapshot || {},
        entries: doc.entries || [],
        remarks: doc.remarks || '',
      });
      setTab('form');
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }, []);

  useEffect(() => {
    Promise.all([
      api.get('/masters/orders?activeOnly=true&limit=200'),
      api.get('/masters/production-lines?activeOnly=true&limit=200'),
      api.get('/masters/employees?activeOnly=true&limit=200'),
      api.get('/masters/processes?activeOnly=true&limit=200'),
      api.get('/masters/machines?activeOnly=true&limit=200'),
      api.get('/masters/needles?activeOnly=true&limit=200'),
      api.get('/config/inspections/seven_point'),
    ])
      .then(([o, l, e, p, m, n, cfgRes]) => {
        setMasters({
          orders: o.data?.data || [],
          lines: l.data?.data || [],
          employees: e.data?.data || [],
          processes: p.data?.data || [],
          machines: m.data?.data || [],
          needles: n.data?.data || [],
        });
        const cfg = cfgRes.data?.data;
        setConfig(cfg);
        setForm((prev) => ({
          ...prev,
          qcName: prev.qcName || user?.fullName || '',
          entries: prev.entries.length === 0 ? [createBlankEntry(1, cfg)] : prev.entries,
        }));
      })
      .catch(() => {});
    loadList();
  }, [user?.fullName, createBlankEntry, loadList]);

  const resetBlankForm = useCallback(
    (nextTab = 'form') => {
      setActiveRecord(null);
      setError('');
      setNotice('');
      setToken(createSubmissionToken());
      setForm({
        sNo: '',
        qcName: user?.fullName || '',
        orderId: '',
        productionLineId: '',
        inspectionDate: new Date().toISOString().slice(0, 10),
        headerSnapshot: {},
        entries: [createBlankEntry(1, config)],
        remarks: '',
      });
      setTab(nextTab);
    },
    [user?.fullName, createBlankEntry, config]
  );

  useEffect(() => {
    if (id) {
      loadedIdRef.current = id;
      loadById(id);
    }
  }, [id, loadById]);

  const openRecord = (recordId) => {
    setError('');
    setNotice('');
    setTab('form');
    if (id !== recordId) {
      navigate(`/inspections/seven-points/${recordId}`);
    }
    loadById(recordId);
  };

  const startNew = () => {
    loadedIdRef.current = null;
    resetBlankForm('form');
    if (id) {
      navigate('/inspections/seven-points');
    }
  };

  const isLocked =
    activeRecord && !['Draft', 'Returned for Correction'].includes(activeRecord.approvalStatus);

  const cpDefs = activeRecord?.checkpointDefinitions?.length
    ? activeRecord.checkpointDefinitions
    : getActiveCheckpointDefs(config);

  const updateEntry = (idx, patch) => {
    setForm((prev) => ({
      ...prev,
      entries: prev.entries.map((e, i) => (i === idx ? { ...e, ...patch } : e)),
    }));
  };

  const updateCheckpoint = (entryIdx, cpIdx, patch) => {
    setForm((prev) => ({
      ...prev,
      entries: prev.entries.map((e, i) => {
        if (i !== entryIdx) return e;
        return {
          ...e,
          checkpoints: e.checkpoints.map((cp, j) => (j === cpIdx ? { ...cp, ...patch } : cp)),
        };
      }),
    }));
  };

  const handleSave = async (submitImmediately = false) => {
    setError('');
    setNotice('');
    if (!form.orderId) {
      setError('Please select an Order Number before saving.');
      return;
    }
    if (!form.inspectionDate) {
      setError('Please select an Inspection Date.');
      return;
    }
    const invalidIdx = form.entries.findIndex((e) => !e.employeeId || !e.processId);
    if (invalidIdx !== -1) {
      setError(`Row #${invalidIdx + 1}: Please select both Employee and Process before saving.`);
      return;
    }
    setSaving(true);
    try {
      const isNew = !activeRecord?._id;
      const normalizedEntries = form.entries.map((entry) => ({
        ...entry,
        piecesChecked: Number(entry.piecesChecked || 0),
        okPieces: Number(entry.okPieces || 0),
        reworkPieces: Number(entry.reworkPieces || 0),
        rejectedPieces: Number(entry.rejectedPieces || 0),
        oilDefectCount: Number(entry.oilDefectCount || 0),
      }));
      const payload = {
        ...form,
        entries: normalizedEntries,
        productionLineId: form.productionLineId || null,
        submitImmediately,
        submissionToken: isNew ? token : undefined,
      };
      const res = activeRecord?._id
        ? await api.patch(`/inspections/seven-points/${activeRecord._id}`, payload)
        : await api.post('/inspections/seven-points', payload);
      const saved = res.data?.data;
      if (isNew) setToken(createSubmissionToken());
      setNotice(submitImmediately ? '7 Point report submitted for approval.' : 'Draft saved.');
      await loadList();
      loadedIdRef.current = saved._id;
      navigate(`/inspections/seven-points/${saved._id}`);
      await loadById(saved._id);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const totals = form.entries.reduce(
    (acc, e) => {
      acc.checked += Number(e.piecesChecked || 0);
      acc.ok += Number(e.okPieces || 0);
      acc.rework += Number(e.reworkPieces || 0);
      acc.rejected += Number(e.rejectedPieces || 0);
      acc.oil += Number(e.oilDefectCount || 0);
      return acc;
    },
    { checked: 0, ok: 0, rework: 0, rejected: 0, oil: 0 }
  );
  const sumValid = totals.ok + totals.rework + totals.rejected === totals.checked;
  const pct = (part) =>
    totals.checked > 0 ? Math.round((part / totals.checked) * 10000) / 100 : 0;

  const activeCpObj =
    editingCp !== null
      ? form.entries[editingCp.entryIdx]?.checkpoints?.[editingCp.cpIdx]
      : null;

  const handleOrderSelect = async (newOrderId) => {
    if (!newOrderId) {
      setForm((prev) => ({ ...prev, orderId: '', headerSnapshot: {} }));
      return;
    }
    try {
      const res = await api.get(`/masters/orders/${newOrderId}/populated`);
      setForm((prev) => ({
        ...prev,
        orderId: newOrderId,
        headerSnapshot: res.data?.data?.autoFilled || {},
      }));
    } catch {
      setForm((prev) => ({ ...prev, orderId: newOrderId }));
    }
  };

  const cycleCheckpoint = (entryIdx, cpIdx, d) => {
    if (isLocked) return;
    const current = form.entries[entryIdx]?.checkpoints?.[cpIdx]?.status || 'Pass';
    const nextStatus = current === 'Pass' ? 'Fail' : current === 'Fail' ? 'N/A' : 'Pass';
    updateCheckpoint(entryIdx, cpIdx, {
      checkpointNumber: d.checkpointNumber,
      label: d.label,
      status: nextStatus,
      inspectionTime:
        nextStatus === 'Fail' ? new Date().toTimeString().slice(0, 5) : undefined,
    });
  };

  const h = form.headerSnapshot || {};
  const stageStatus = (stageKey) =>
    activeRecord?.workflowStages?.find((s) => s.stage === stageKey);

  return (
    <div>
      <div className="card" style={{ paddingBottom: '0.5rem' }}>
        <div className="card-header">
          <div>
            <h1 className="card-title" style={{ fontSize: '1.15rem' }}>
              Module 3 — 7 Point Production Inspection Report
            </h1>
            <span className="muted">
              Employee &amp; process tracking across {cpDefs.length} configurable checkpoints with sequential 5-tier approval
            </span>
          </div>
          {hasPerm('sevenPoint', 'create') ? (
            <button type="button" className="btn btn-primary btn-sm" onClick={startNew}>
              <Plus size={15} aria-hidden="true" />
              <span>New 7 Point Report</span>
            </button>
          ) : null}
        </div>

        <div className="tablist" role="tablist">
          <button
            type="button"
            role="tab"
            className="tab-btn"
            aria-selected={tab === 'list'}
            onClick={() => setTab('list')}
          >
            All Reports ({records.length})
          </button>
          {hasPerm('sevenPoint', 'create') ? (
            <button
              type="button"
              role="tab"
              className="tab-btn"
              aria-selected={tab === 'form' && !activeRecord}
              onClick={startNew}
            >
              <Plus size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
              New 7 Point Report
            </button>
          ) : null}
          {activeRecord ? (
            <button
              type="button"
              role="tab"
              className="tab-btn"
              aria-selected={tab === 'form' && Boolean(activeRecord)}
              onClick={() => setTab('form')}
            >
              Report: {activeRecord.reportNumber}
              <span className="badge badge-neutral" style={{ marginLeft: 6, fontSize: '0.7rem' }}>
                {activeRecord.approvalStatus}
              </span>
            </button>
          ) : null}
        </div>
      </div>

      {error ? <div className="alert alert-error">{error}</div> : null}
      {notice ? <div className="alert alert-success">{notice}</div> : null}

      {tab === 'list' ? (
        <section className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <span className="muted" style={{ fontSize: '0.85rem' }}>
              Showing {records.length} 7-point production inspection reports
            </span>
            {hasPerm('sevenPoint', 'create') ? (
              <button type="button" className="btn btn-primary btn-sm" onClick={startNew}>
                <Plus size={14} aria-hidden="true" />
                <span>Create New 7 Point Report</span>
              </button>
            ) : null}
          </div>

          {records.length === 0 ? (
            <p className="muted">No 7 Point inspection reports recorded yet.</p>
          ) : (
            <div className="table-wrapper" tabIndex={0} role="region" aria-label="7 Point inspection table">
              <table className="qms-table responsive-stack">
                <thead>
                  <tr>
                    <th>Report #</th>
                    <th>Date</th>
                    <th>QC</th>
                    <th>Style</th>
                    <th>Order</th>
                    <th>Checked</th>
                    <th>Rework %</th>
                    <th>Rejection %</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((r) => (
                    <tr key={r._id}>
                      <td data-label="Report #"><strong>{r.reportNumber}</strong></td>
                      <td data-label="Date">{new Date(r.inspectionDate).toISOString().slice(0, 10)}</td>
                      <td data-label="QC">{r.qcName}</td>
                      <td data-label="Style">{r.headerSnapshot?.styleNumber}</td>
                      <td data-label="Order">{r.headerSnapshot?.orderNumber}</td>
                      <td data-label="Checked">{r.totals?.totalPiecesChecked ?? 0}</td>
                      <td data-label="Rework %">{r.totals?.reworkPercentage ?? 0}%</td>
                      <td data-label="Rejection %">{r.totals?.rejectionPercentage ?? 0}%</td>
                      <td data-label="Status"><StatusBadge value={r.approvalStatus} /></td>
                      <td data-label="Action">
                        <button
                          type="button"
                          className={`btn ${['Draft', 'Returned for Correction'].includes(r.approvalStatus) ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                          onClick={() => openRecord(r._id)}
                        >
                          {['Draft', 'Returned for Correction'].includes(r.approvalStatus) ? 'Edit' : 'View / Edit'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}

      {tab === 'form' ? (
        <>
          <section className="paper-sheet">
            <div className="paper-topbar">
              <div className="btn-row">
                {activeRecord ? <StatusBadge value={activeRecord.approvalStatus} /> : null}
                <span className={`badge ${sumValid ? 'badge-success' : 'badge-warning'}`}>
                  {sumValid
                    ? 'OK + R/W + Rej = Checked'
                    : `Sum mismatch: ${totals.ok + totals.rework + totals.rejected} / ${totals.checked}`}
                </span>
              </div>
              <div className="btn-row">
                {!isLocked ? (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() =>
                      setForm((prev) => ({
                        ...prev,
                        entries: [
                          ...prev.entries,
                          createBlankEntry(prev.entries.length + 1, config),
                        ],
                      }))
                    }
                  >
                    <Plus size={14} aria-hidden="true" />
                    <span>Add Employee Row</span>
                  </button>
                ) : null}
                {isLocked && hasPerm('sevenPoint', 'create') ? (
                  <button type="button" className="btn btn-primary btn-sm" onClick={startNew}>
                    <Plus size={14} aria-hidden="true" />
                    <span>New 7 Point Report</span>
                  </button>
                ) : null}
                {activeRecord ? (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setPdfOpen(true)}
                  >
                    <Eye size={14} aria-hidden="true" />
                    <span>PDF / Excel</span>
                  </button>
                ) : null}
              </div>
            </div>

            <ReportLockBanner
              endpointBase="/inspections/seven-points"
              moduleKey="sevenPoint"
              record={activeRecord}
              onUnlocked={() => {
                loadById(activeRecord._id);
                loadList();
              }}
            />

            <div className="paper-company-banner" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', textAlign: 'left' }}>
              <strong style={{ fontSize: '0.95rem', color: '#1e3a5f' }}>
                {company?.companyName || 'ESSTEE EXPORTS INDIA PVT. LTD.,'}
              </strong>
              <h2 style={{ margin: '0 auto', fontSize: '1.15rem' }}>7 POINT REPORT</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.78rem' }}>
                <span className="muted">S.No:</span>
                <input
                  type="text"
                  disabled={isLocked}
                  aria-label="S.No"
                  placeholder="Optional S.No"
                  value={form.sNo}
                  onChange={(e) => setForm({ ...form, sNo: e.target.value })}
                  style={{ width: 95, minBlockSize: '26px', padding: '0.1rem 0.3rem', fontSize: '0.76rem' }}
                />
                {activeRecord ? <strong>{activeRecord.reportNumber}</strong> : null}
              </div>
            </div>

            {!isLocked && hasPerm('masterData', 'create') ? (
              <div className="btn-row" style={{ marginBottom: '0.45rem' }}>
                <span className="muted" style={{ fontSize: '0.76rem' }}>Quick Add Master:</span>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setQuickOrderOpen(true)}>
                  + Order
                </button>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setQuickLineOpen(true)}>
                  + Line
                </button>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setQuickMasterType('employee')}>
                  + Employee
                </button>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setQuickMasterType('process')}>
                  + Process
                </button>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setQuickMasterType('machine')}>
                  + Machine
                </button>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setQuickMasterType('needle')}>
                  + Needle
                </button>
              </div>
            ) : null}

            <table className="paper-kv-table">
              <tbody>
                <tr>
                  <td className="paper-kv-label" style={{ width: '9%' }}>LINE NO</td>
                  <td style={{ width: '19%' }}>
                    <SearchableSelect
                      label=""
                      placeholder="Select Line..."
                      options={masters.lines}
                      value={form.productionLineId}
                      disabled={isLocked}
                      getOptionValue={(l) => l._id}
                      getOptionLabel={(l) => l.name}
                      getOptionSubLabel={(l) => l.code}
                      onChange={(val) => setForm({ ...form, productionLineId: val })}
                    />
                  </td>
                  <td className="paper-kv-label" style={{ width: '10%' }}>ORDER NO *</td>
                  <td style={{ width: '20%' }}>
                    <SearchableSelect
                      label=""
                      placeholder="Select Order..."
                      options={masters.orders}
                      value={form.orderId}
                      disabled={isLocked}
                      getOptionValue={(o) => o._id}
                      getOptionLabel={(o) => `${o.orderNumber} (${o.buyerId?.name || ''})`}
                      getOptionSubLabel={(o) => o.styleId?.styleNumber}
                      onChange={handleOrderSelect}
                    />
                  </td>
                  <td className="paper-kv-label" style={{ width: '9%' }}>FABRIC</td>
                  <td style={{ width: '13%' }}>{h.fabricName || '-'}</td>
                  <td className="paper-kv-label" style={{ width: '8%' }}>DATE *</td>
                  <td style={{ width: '12%' }}>
                    <input
                      type="date"
                      disabled={isLocked}
                      value={form.inspectionDate}
                      onChange={(e) => setForm({ ...form, inspectionDate: e.target.value })}
                      style={{ minBlockSize: '28px', padding: '0.12rem 0.25rem', fontSize: '0.78rem' }}
                    />
                  </td>
                </tr>
                <tr>
                  <td className="paper-kv-label">QC</td>
                  <td>
                    <input
                      type="text"
                      disabled={isLocked}
                      value={form.qcName}
                      onChange={(e) => setForm({ ...form, qcName: e.target.value })}
                      style={{ minBlockSize: '28px', padding: '0.12rem 0.3rem', fontSize: '0.78rem' }}
                    />
                  </td>
                  <td className="paper-kv-label">STYLE NO / NAME</td>
                  <td>
                    <strong>{h.styleNumber || '-'}</strong>
                    {h.styleName ? <span className="muted"> — {h.styleName}</span> : null}
                  </td>
                  <td className="paper-kv-label">COLOUR</td>
                  <td>{h.colourName || '-'}</td>
                  <td className="paper-kv-label">ORDER QTY</td>
                  <td>
                    <strong>{h.orderQuantity ?? '-'}</strong>
                  </td>
                </tr>
              </tbody>
            </table>

            <div className="qf40-scroll">
              <table className="sp-paper-table" aria-label="7 Point diagonal checkpoint table">
                <thead>
                  <tr>
                    <th style={{ width: 34 }}>S.NO</th>
                    <th style={{ minWidth: 140 }}>NAME</th>
                    <th style={{ width: 66 }}>ID NO</th>
                    <th style={{ minWidth: 120 }}>PROCESS</th>
                    <th style={{ minWidth: 115 }}>MACHINE</th>
                    <th style={{ minWidth: 96 }}>NEEDLE NO</th>
                    <th style={{ width: 82 }}>NEEDLE CHANGE TIME</th>
                    {cpDefs.map((d) => (
                      <th
                        key={d.checkpointNumber}
                        title={`${d.label}${d.description ? `: ${d.description}` : ''} — Click cell to cycle Pass / Fail / N/A`}
                        style={{ width: 34 }}
                      >
                        {d.checkpointNumber}
                      </th>
                    ))}
                    <th style={{ width: 50 }}>CHK</th>
                    <th style={{ width: 48 }}>OK</th>
                    <th style={{ width: 48 }}>R/W</th>
                    <th style={{ width: 46 }}>OIL</th>
                    <th style={{ width: 48 }}>REJ</th>
                    <th style={{ minWidth: 110 }}>REMARKS</th>
                    {!isLocked ? <th style={{ width: 34 }}>×</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {form.entries.map((entry, idx) => {
                    const empObj = masters.employees.find((em) => em._id === entry.employeeId);
                    const failNotes = (entry.checkpoints || [])
                      .filter((c) => c.status === 'Fail')
                      .map((c) => `#${c.checkpointNumber}${c.defectDetails ? `:${c.defectDetails}` : ''}`)
                      .join(', ');

                    return (
                      <tr key={idx}>
                        <td style={{ textAlign: 'center', fontWeight: 700 }}>{entry.serialNumber}</td>
                        <td>
                          <select
                            disabled={isLocked}
                            value={entry.employeeId}
                            onChange={(e) => updateEntry(idx, { employeeId: e.target.value })}
                          >
                            <option value="">Select Employee...</option>
                            {masters.employees.map((emp) => (
                              <option key={emp._id} value={emp._id}>
                                {emp.name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td style={{ textAlign: 'center', fontWeight: 600, background: '#f8fafc' }}>
                          {empObj?.employeeCode || entry.employeeCode || '-'}
                        </td>
                        <td>
                          <select
                            disabled={isLocked}
                            value={entry.processId}
                            onChange={(e) => updateEntry(idx, { processId: e.target.value })}
                          >
                            <option value="">Select Process...</option>
                            {masters.processes.map((pr) => (
                              <option key={pr._id} value={pr._id}>{pr.name}</option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <select
                            disabled={isLocked}
                            value={entry.machineId || ''}
                            onChange={(e) => updateEntry(idx, { machineId: e.target.value })}
                          >
                            <option value="">Machine...</option>
                            {masters.machines.map((m) => (
                              <option key={m._id} value={m._id}>
                                {m.machineNumber} — {m.name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <select
                            disabled={isLocked}
                            value={entry.needleId || ''}
                            onChange={(e) => updateEntry(idx, { needleId: e.target.value })}
                          >
                            <option value="">Needle...</option>
                            {masters.needles.map((n) => (
                              <option key={n._id} value={n._id}>
                                {n.needleNumber}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <input
                            type="time"
                            disabled={isLocked}
                            value={entry.needleChangeTime || ''}
                            onChange={(e) => updateEntry(idx, { needleChangeTime: e.target.value })}
                          />
                        </td>
                        {cpDefs.map((d, cpIdx) => {
                          const cp = entry.checkpoints?.[cpIdx] || {
                            checkpointNumber: d.checkpointNumber,
                            label: d.label,
                            status: 'Pass',
                          };
                          const stateCls =
                            cp.status === 'Fail' ? 'fail' : cp.status === 'N/A' ? 'na' : 'pass';
                          return (
                            <td key={d.checkpointNumber} className={`cp-diag-cell ${stateCls}`}>
                              <button
                                type="button"
                                disabled={isLocked}
                                className="cp-diag-btn"
                                title={`Point ${d.checkpointNumber} (${d.label}): ${cp.status}${cp.defectDetails ? ` — ${cp.defectDetails}` : ''}. Click to toggle, or click dot to edit note.`}
                                onClick={() => cycleCheckpoint(idx, cpIdx, d)}
                              >
                                {cp.status === 'Pass' ? (
                                  <span className="cp-diag-top">✓</span>
                                ) : cp.status === 'Fail' ? (
                                  <span className="cp-diag-bottom">✕</span>
                                ) : (
                                  <span className="cp-diag-na">N/A</span>
                                )}
                              </button>
                              <button
                                type="button"
                                className="cp-diag-gear"
                                aria-label={`Edit point ${d.checkpointNumber} defect note`}
                                onClick={() => setEditingCp({ entryIdx: idx, cpIdx })}
                              >
                                •
                              </button>
                            </td>
                          );
                        })}
                        <td>
                          <input
                            type="number"
                            min={0}
                            disabled={isLocked}
                            value={entry.piecesChecked ?? ''}
                            onChange={(e) =>
                              updateEntry(idx, {
                                piecesChecked: e.target.value === '' ? '' : Number(e.target.value),
                              })
                            }
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            min={0}
                            disabled={isLocked}
                            value={entry.okPieces ?? ''}
                            onChange={(e) =>
                              updateEntry(idx, {
                                okPieces: e.target.value === '' ? '' : Number(e.target.value),
                              })
                            }
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            min={0}
                            disabled={isLocked}
                            value={entry.reworkPieces ?? ''}
                            onChange={(e) =>
                              updateEntry(idx, {
                                reworkPieces: e.target.value === '' ? '' : Number(e.target.value),
                              })
                            }
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            min={0}
                            disabled={isLocked}
                            value={entry.oilDefectCount ?? ''}
                            onChange={(e) =>
                              updateEntry(idx, {
                                oilDefectCount: e.target.value === '' ? '' : Number(e.target.value),
                              })
                            }
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            min={0}
                            disabled={isLocked}
                            value={entry.rejectedPieces ?? ''}
                            onChange={(e) =>
                              updateEntry(idx, {
                                rejectedPieces: e.target.value === '' ? '' : Number(e.target.value),
                              })
                            }
                          />
                        </td>
                        <td style={{ fontSize: '0.72rem', color: failNotes ? 'var(--danger)' : '#64748b' }}>
                          {failNotes || 'Click • on 1–10 for defect note'}
                        </td>
                        {!isLocked ? (
                          <td style={{ textAlign: 'center' }}>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              aria-label="Remove entry"
                              disabled={form.entries.length <= 1}
                              style={{ minBlockSize: '26px', padding: '0 0.3rem' }}
                              onClick={() =>
                                setForm((prev) => ({
                                  ...prev,
                                  entries: prev.entries
                                    .filter((_, i) => i !== idx)
                                    .map((row, n) => ({ ...row, serialNumber: n + 1 })),
                                }))
                              }
                            >
                              <Trash2 size={13} aria-hidden="true" />
                            </button>
                          </td>
                        ) : null}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Paper Bottom Summary Strip */}
            <div className="sp-summary-strip">
              <div className="sp-summary-cell">
                <span>TTL NO CHECKED PCS :</span>
                <strong>{totals.checked}</strong>
              </div>
              <div className="sp-summary-cell">
                <span>OK PCS -</span>
                <strong style={{ color: 'var(--success)' }}>{totals.ok}</strong>
              </div>
              <div className="sp-summary-cell">
                <span>REWORK -</span>
                <strong style={{ color: 'var(--warning)' }}>{totals.rework}</strong>
              </div>
              <div className="sp-summary-cell">
                <span>R/W % -</span>
                <strong style={{ color: 'var(--warning)' }}>{pct(totals.rework)}%</strong>
              </div>
              <div className="sp-summary-cell">
                <span>OIL -</span>
                <strong>{totals.oil}</strong>
              </div>
              <div className="sp-summary-cell">
                <span>OIL % -</span>
                <strong>{pct(totals.oil)}%</strong>
              </div>
              <div className="sp-summary-cell">
                <span>REJECTION -</span>
                <strong style={{ color: 'var(--danger)' }}>
                  {totals.rejected} ({pct(totals.rejected)}%)
                </strong>
              </div>
              <div className="sp-summary-cell">
                <span>REMARKS -</span>
                <input
                  type="text"
                  disabled={isLocked}
                  value={form.remarks}
                  placeholder="Overall remarks..."
                  onChange={(e) => setForm({ ...form, remarks: e.target.value })}
                  style={{ minBlockSize: '26px', padding: '0.1rem 0.3rem', fontSize: '0.76rem', marginTop: 2 }}
                />
              </div>
            </div>

            {/* Paper 5-Tier Signature Row */}
            <div className="paper-sig-row">
              {['QC', 'Supervisor', 'QAM', 'PM', 'FM'].map((tier) => {
                const st = stageStatus(tier);
                return (
                  <div key={tier} className="paper-sig-cell">
                    <strong>{tier}</strong>
                    <span className="muted">
                      {st?.actionByName || (tier === 'QC' ? form.qcName : '') || st?.status || '-'}
                    </span>
                  </div>
                );
              })}
            </div>

            {error ? <div className="alert alert-error" style={{ marginTop: '0.65rem' }}>{error}</div> : null}
            {notice ? <div className="alert alert-success" style={{ marginTop: '0.65rem' }}>{notice}</div> : null}

            {!isLocked && (hasPerm('sevenPoint', 'create') || hasPerm('sevenPoint', 'edit')) ? (
              <div className="btn-row" style={{ marginTop: '0.75rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={saving}
                  onClick={() => handleSave(false)}
                >
                  <Save size={15} aria-hidden="true" />
                  <span>{saving ? 'Saving...' : 'Save Draft'}</span>
                </button>
                {hasPerm('sevenPoint', 'submit') ? (
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={saving}
                    onClick={() => handleSave(true)}
                  >
                    <span>Save &amp; Submit for Approval</span>
                  </button>
                ) : null}
              </div>
            ) : null}
          </section>

          {activeRecord ? (
            <ApprovalPanel
              endpointBase="/inspections/seven-points"
              moduleKey="sevenPoint"
              inspectionType="seven_point"
              record={activeRecord}
              onUpdated={() => {
                loadById(activeRecord._id);
                loadList();
              }}
            />
          ) : null}
        </>
      ) : null}

      <ModalDialog
        open={Boolean(activeCpObj)}
        onClose={() => setEditingCp(null)}
        title={
          activeCpObj
            ? `Checkpoint #${activeCpObj.checkpointNumber} — ${activeCpObj.label}`
            : ''
        }
        size="sm"
      >
        {activeCpObj ? (
          <div>
            <div className="field">
              <label htmlFor="cp-status">Pass / Fail</label>
              <select
                id="cp-status"
                disabled={isLocked}
                value={activeCpObj.status}
                onChange={(e) =>
                  updateCheckpoint(editingCp.entryIdx, editingCp.cpIdx, { status: e.target.value })
                }
              >
                <option value="Pass">Pass</option>
                <option value="Fail">Fail</option>
                <option value="N/A">N/A</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="cp-result">Inspection Result</label>
              <input
                id="cp-result"
                type="text"
                disabled={isLocked}
                value={activeCpObj.result || ''}
                onChange={(e) =>
                  updateCheckpoint(editingCp.entryIdx, editingCp.cpIdx, { result: e.target.value })
                }
              />
            </div>
            <div className="field">
              <label htmlFor="cp-defect">Defect Details</label>
              <input
                id="cp-defect"
                type="text"
                disabled={isLocked}
                value={activeCpObj.defectDetails || ''}
                onChange={(e) =>
                  updateCheckpoint(editingCp.entryIdx, editingCp.cpIdx, {
                    defectDetails: e.target.value,
                  })
                }
              />
            </div>
            <div className="field">
              <label htmlFor="cp-time">Inspection Time</label>
              <input
                id="cp-time"
                type="time"
                disabled={isLocked}
                value={activeCpObj.inspectionTime || ''}
                onChange={(e) =>
                  updateCheckpoint(editingCp.entryIdx, editingCp.cpIdx, {
                    inspectionTime: e.target.value,
                  })
                }
              />
            </div>
            <div className="field">
              <label htmlFor="cp-remarks">Remarks</label>
              <textarea
                id="cp-remarks"
                disabled={isLocked}
                value={activeCpObj.remarks || ''}
                onChange={(e) =>
                  updateCheckpoint(editingCp.entryIdx, editingCp.cpIdx, { remarks: e.target.value })
                }
              />
            </div>
            <button type="button" className="btn btn-primary" onClick={() => setEditingCp(null)}>
              Done
            </button>
          </div>
        ) : null}
      </ModalDialog>

      <PdfPreviewModal
        open={pdfOpen}
        onClose={() => setPdfOpen(false)}
        moduleSlug="seven-points"
        reportId={activeRecord?._id}
        reportNumber={activeRecord?.reportNumber}
      />

      <QuickOrderModal
        open={quickOrderOpen}
        onClose={() => setQuickOrderOpen(false)}
        onCreated={async (created) => {
          const res = await api.get('/masters/orders?activeOnly=true&limit=200').catch(() => null);
          if (res?.data?.data) setMasters((prev) => ({ ...prev, orders: res.data.data }));
          await handleOrderSelect(created._id);
        }}
      />

      <QuickLineModal
        open={quickLineOpen}
        onClose={() => setQuickLineOpen(false)}
        onCreated={(created) => {
          setMasters((prev) => ({ ...prev, lines: [created, ...prev.lines] }));
          setForm((prev) => ({ ...prev, productionLineId: created._id }));
        }}
      />

      <QuickSimpleMasterModal
        open={Boolean(quickMasterType)}
        type={quickMasterType}
        onClose={() => setQuickMasterType(null)}
        onCreated={(created) => {
          const mapKey =
            quickMasterType === 'employee'
              ? 'employees'
              : quickMasterType === 'machine'
                ? 'machines'
                : quickMasterType === 'needle'
                  ? 'needles'
                  : 'processes';
          setMasters((prev) => ({ ...prev, [mapKey]: [created, ...prev[mapKey]] }));
        }}
      />
    </div>
  );
}
