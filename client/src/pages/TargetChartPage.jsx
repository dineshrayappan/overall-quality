import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Eye, Plus, Save } from 'lucide-react';
import { api, createSubmissionToken, getErrorMessage } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import SearchableSelect from '../components/common/SearchableSelect.jsx';
import StatusBadge from '../components/common/StatusBadge.jsx';
import ModalDialog from '../components/common/ModalDialog.jsx';
import ApprovalPanel from '../components/common/ApprovalPanel.jsx';
import PdfPreviewModal from '../components/common/PdfPreviewModal.jsx';
import ReportLockBanner from '../components/common/ReportLockBanner.jsx';
import { QuickLineModal } from '../components/common/QuickMasterModals.jsx';

function ConcentricCircleGauge({ indicator, isLocked, onSelect, onInlineChange }) {
  const target = Number(indicator.targetValue || 0);
  const actual = Number(indicator.actualValue || 0);
  const pct = target > 0 ? Math.round((actual / target) * 10000) / 100 : 0;
  const clamped = Math.min(100, Math.max(0, pct));

  const ringColor =
    pct >= 100 ? '#15803d' : pct >= 75 ? '#1d4ed8' : pct >= 50 ? '#d97706' : '#dc2626';

  const maxR = 42;
  const fillR = target > 0 && actual > 0 ? Math.max(3.5, (clamped / 100) * maxR) : 0;

  return (
    <div className="tc-paper-cell">
      <div className="tc-cell-head">
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {indicator.index}. {indicator.name}
        </span>
        <span
          className="badge"
          style={{
            background: actual > 0 ? `${ringColor}1a` : '#f1f5f9',
            color: actual > 0 ? ringColor : '#475569',
            fontSize: '0.7rem',
            padding: '0.1rem 0.35rem',
          }}
        >
          {pct}%
        </span>
      </div>

      <button
        type="button"
        onClick={onSelect}
        title="Click to inspect / edit parameter details & remarks"
        style={{
          background: 'transparent',
          border: 0,
          padding: 0,
          cursor: 'pointer',
          display: 'grid',
          placeItems: 'center',
        }}
      >
        <svg width="128" height="106" viewBox="0 0 130 108" role="img" aria-label={`${indicator.name}: ${pct}%`}>
          {/* 100% Outer Dashed Circle matching paper form */}
          <circle cx="58" cy="54" r={maxR} fill="#ffffff" stroke="#1e293b" strokeDasharray="3.5 2.5" strokeWidth="1.2" />
          {/* 75% Inner Dashed Circle matching paper form */}
          <circle cx="58" cy="54" r={maxR * 0.62} fill="none" stroke="#1e293b" strokeDasharray="3.5 2.5" strokeWidth="1.2" />

          {/* Filled achievement concentric zone */}
          {fillR > 0 ? (
            <circle
              cx="58"
              cy="54"
              r={fillR}
              fill={ringColor}
              fillOpacity="0.2"
              stroke={ringColor}
              strokeWidth="2"
            />
          ) : null}

          {/* 50% Center Target Dot matching paper form */}
          <circle cx="58" cy="54" r="3" fill="#0f172a" />

          <text x="64" y="45" fontSize="8" fontWeight="700" fill="#1e293b">50%</text>
          <text x="80" y="30" fontSize="8" fontWeight="700" fill="#1e293b">75%</text>
          <text x="95" y="16" fontSize="8" fontWeight="700" fill="#1e293b">100%</text>
        </svg>
      </button>

      <div className="tc-cell-inputs">
        <label>
          <span>Target ({indicator.unit || 'pcs'})</span>
          <input
            type="number"
            min="0"
            disabled={isLocked}
            value={indicator.targetValue ?? ''}
            onChange={(e) =>
              onInlineChange({ targetValue: e.target.value === '' ? '' : Number(e.target.value) })
            }
          />
        </label>
        <label>
          <span>Actual ({indicator.unit || 'pcs'})</span>
          <input
            type="number"
            min="0"
            disabled={isLocked}
            value={indicator.actualValue ?? ''}
            onChange={(e) =>
              onInlineChange({ actualValue: e.target.value === '' ? '' : Number(e.target.value) })
            }
          />
        </label>
      </div>
    </div>
  );
}

export default function TargetChartPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { hasPerm, company } = useAuth();

  const [tab, setTab] = useState(id ? 'form' : 'list');
  const [lines, setLines] = useState([]);
  const [config, setConfig] = useState(null);
  const [records, setRecords] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [activeRecord, setActiveRecord] = useState(null);
  const [selectedCircleIdx, setSelectedCircleIdx] = useState(null);
  const [pdfOpen, setPdfOpen] = useState(false);
  const [quickLineOpen, setQuickLineOpen] = useState(false);

  const [form, setForm] = useState({
    productionLineId: '',
    inspectionDate: new Date().toISOString().slice(0, 10),
    shift: 'General',
    remarks: '',
    indicators: [],
  });
  const [token, setToken] = useState(() => createSubmissionToken());
  const loadedIdRef = useRef(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const buildDefaultIndicators = useCallback((cfg) => {
    const base = cfg?.indicators || Array.from({ length: 15 }, (_, idx) => ({
      index: idx + 1,
      code: `IND-${String(idx + 1).padStart(2, '0')}`,
      name: `Target Indicator ${idx + 1}`,
      unit: 'pcs',
      defaultTarget: 100,
      isActive: true,
    }));
    return base.map((item, idx) => ({
      index: idx + 1,
      code: item.code || `IND-${String(idx + 1).padStart(2, '0')}`,
      name: item.name,
      unit: item.unit || 'pcs',
      isActive: item.isActive !== false,
      targetValue: item.defaultTarget ?? 0,
      actualValue: 0,
      remarks: '',
    }));
  }, []);

  const loadListAndAnalytics = useCallback(async () => {
    try {
      const [listRes, anaRes] = await Promise.all([
        api.get('/inspections/target-charts?limit=50'),
        api.get('/inspections/target-charts/analytics'),
      ]);
      setRecords(listRes.data?.data || []);
      setAnalytics(anaRes.data?.data || null);
    } catch {
      // handled gracefully
    }
  }, []);

  const loadRecordById = useCallback(async (recordId) => {
    if (!recordId) return;
    try {
      const res = await api.get(`/inspections/target-charts/${recordId}`);
      const doc = res.data?.data;
      setActiveRecord(doc);
      setForm({
        productionLineId: doc.productionLineId?._id || doc.productionLineId || '',
        inspectionDate: new Date(doc.inspectionDate).toISOString().slice(0, 10),
        shift: doc.shift || 'General',
        remarks: doc.remarks || '',
        indicators: doc.indicators || [],
      });
      setTab('form');
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }, []);

  useEffect(() => {
    Promise.all([
      api.get('/masters/production-lines?activeOnly=true&limit=200'),
      api.get('/config/inspections/target_chart'),
    ])
      .then(([linesRes, cfgRes]) => {
        setLines(linesRes.data?.data || []);
        const cfg = cfgRes.data?.data;
        setConfig(cfg);
        setForm((prev) =>
          prev.indicators.length === 0 ? { ...prev, indicators: buildDefaultIndicators(cfg) } : prev
        );
      })
      .catch(() => {});
    loadListAndAnalytics();
  }, [buildDefaultIndicators, loadListAndAnalytics]);

  const resetBlankForm = useCallback(
    (nextTab = 'form') => {
      setActiveRecord(null);
      setError('');
      setNotice('');
      setToken(createSubmissionToken());
      setForm({
        productionLineId: '',
        inspectionDate: new Date().toISOString().slice(0, 10),
        shift: 'General',
        remarks: '',
        indicators: buildDefaultIndicators(config),
      });
      setTab(nextTab);
    },
    [buildDefaultIndicators, config]
  );

  useEffect(() => {
    if (id) {
      loadedIdRef.current = id;
      loadRecordById(id);
    }
  }, [id, loadRecordById]);

  const openRecord = (recordId) => {
    setError('');
    setNotice('');
    setTab('form');
    if (id !== recordId) {
      navigate(`/inspections/target-charts/${recordId}`);
    }
    loadRecordById(recordId);
  };

  const startNew = () => {
    loadedIdRef.current = null;
    resetBlankForm('form');
    if (id) {
      navigate('/inspections/target-charts');
    }
  };

  const isLocked =
    activeRecord && !['Draft', 'Returned for Correction'].includes(activeRecord.approvalStatus);

  const handleSave = async (submitImmediately = false) => {
    setError('');
    setNotice('');
    if (!form.productionLineId) {
      setError('Please select a Production Line before saving.');
      return;
    }
    if (!form.inspectionDate) {
      setError('Please select an Inspection Date.');
      return;
    }
    setSaving(true);
    try {
      const isNew = !activeRecord?._id;
      const normalizedIndicators = form.indicators.map((ind) => ({
        ...ind,
        targetValue: Number(ind.targetValue || 0),
        actualValue: Number(ind.actualValue || 0),
      }));
      const payload = {
        ...form,
        indicators: normalizedIndicators,
        submitImmediately,
        submissionToken: isNew ? token : undefined,
      };
      const res = activeRecord?._id
        ? await api.patch(`/inspections/target-charts/${activeRecord._id}`, payload)
        : await api.post('/inspections/target-charts', payload);
      const saved = res.data?.data;
      if (isNew) setToken(createSubmissionToken());
      setNotice(submitImmediately ? 'Target chart saved and submitted.' : 'Target chart draft saved.');
      await loadListAndAnalytics();
      loadedIdRef.current = saved._id;
      navigate(`/inspections/target-charts/${saved._id}`);
      await loadRecordById(saved._id);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const liveTotals = form.indicators.reduce(
    (acc, item) => {
      if (item.isActive === false) return acc;
      const t = Number(item.targetValue || 0);
      const a = Number(item.actualValue || 0);
      acc.target += t;
      acc.achieved += a;
      acc.pending += Math.max(0, t - a);
      return acc;
    },
    { target: 0, achieved: 0, pending: 0 }
  );
  const livePct =
    liveTotals.target > 0 ? Math.round((liveTotals.achieved / liveTotals.target) * 10000) / 100 : 0;

  const selectedCircle =
    selectedCircleIdx !== null ? form.indicators[selectedCircleIdx] : null;

  const updateIndicatorAt = (index, patch) => {
    setForm((prev) => ({
      ...prev,
      indicators: prev.indicators.map((ind, i) => (i === index ? { ...ind, ...patch } : ind)),
    }));
  };

  const updateSelectedCircle = (patch) => {
    if (selectedCircleIdx === null) return;
    updateIndicatorAt(selectedCircleIdx, patch);
  };

  return (
    <div>
      <div className="card" style={{ paddingBottom: '0.5rem' }}>
        <div className="card-header">
          <div>
            <h1 className="card-title" style={{ fontSize: '1.15rem' }}>
              Module 1 — Production Line Target Chart (15 Concentric Indicators)
            </h1>
            <span className="muted">3×5 concentric circles highlighting 50%, 75%, and 100% achievement levels</span>
          </div>
          {hasPerm('targetChart', 'create') ? (
            <button type="button" className="btn btn-primary btn-sm" onClick={startNew}>
              <Plus size={15} aria-hidden="true" />
              <span>New Target Chart</span>
            </button>
          ) : null}
        </div>

        <div className="tablist" role="tablist" aria-label="Target Chart sections">
          <button
            type="button"
            role="tab"
            className="tab-btn"
            aria-selected={tab === 'list'}
            onClick={() => setTab('list')}
          >
            All Reports ({records.length})
          </button>
          {hasPerm('targetChart', 'create') ? (
            <button
              type="button"
              role="tab"
              className="tab-btn"
              aria-selected={tab === 'form' && !activeRecord}
              onClick={startNew}
            >
              <Plus size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
              New Target Chart
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
          <button
            type="button"
            role="tab"
            className="tab-btn"
            aria-selected={tab === 'analytics'}
            onClick={() => setTab('analytics')}
          >
            Line Target Dashboard
          </button>
        </div>
      </div>

      {error ? <div className="alert alert-error">{error}</div> : null}
      {notice ? <div className="alert alert-success">{notice}</div> : null}

      {tab === 'list' ? (
        <section className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <span className="muted" style={{ fontSize: '0.85rem' }}>
              Showing {records.length} production line target chart reports
            </span>
            {hasPerm('targetChart', 'create') ? (
              <button type="button" className="btn btn-primary btn-sm" onClick={startNew}>
                <Plus size={14} aria-hidden="true" />
                <span>Create New Target Chart</span>
              </button>
            ) : null}
          </div>

          {records.length === 0 ? (
            <p className="muted">No Target Chart records yet.</p>
          ) : (
            <div className="table-wrapper" tabIndex={0} role="region" aria-label="Production Line Target Chart table">
              <table className="qms-table responsive-stack">
                <thead>
                  <tr>
                    <th>Report #</th>
                    <th>Production Line</th>
                    <th>Date</th>
                    <th>Shift</th>
                    <th>Total Target</th>
                    <th>Achieved</th>
                    <th>Achievement %</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((r) => (
                    <tr key={r._id}>
                      <td data-label="Report #"><strong>{r.reportNumber}</strong></td>
                      <td data-label="Production Line">{r.productionLineName}</td>
                      <td data-label="Date">{new Date(r.inspectionDate).toISOString().slice(0, 10)}</td>
                      <td data-label="Shift">{r.shift}</td>
                      <td data-label="Total Target">{r.summary?.totalTarget ?? 0}</td>
                      <td data-label="Achieved">{r.summary?.totalAchieved ?? 0}</td>
                      <td data-label="Achievement %"><strong>{r.summary?.achievementPercentage ?? 0}%</strong></td>
                      <td data-label="Status"><StatusBadge value={r.approvalStatus} /></td>
                      <td data-label="Actions">
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
              <div>
                <div className="paper-form-code">
                  {company?.companyName || 'ESSTEE EXPORTS INDIA Pvt. Ltd.'} — PRODUCTION LINE TARGET CHART
                </div>
                <div className="muted">
                  {activeRecord ? `Report # ${activeRecord.reportNumber}` : 'New Target Sheet'}
                </div>
              </div>
              <div className="btn-row">
                {activeRecord ? <StatusBadge value={activeRecord.approvalStatus} /> : null}
                {isLocked && hasPerm('targetChart', 'create') ? (
                  <button type="button" className="btn btn-primary btn-sm" onClick={startNew}>
                    <Plus size={14} aria-hidden="true" />
                    <span>Start New Chart</span>
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
              endpointBase="/inspections/target-charts"
              moduleKey="targetChart"
              record={activeRecord}
              onUnlocked={() => {
                loadRecordById(activeRecord._id);
                loadListAndAnalytics();
              }}
            />

            <div className="grid-3" style={{ marginBottom: '0.65rem', alignItems: 'end' }}>
              <div className="field">
                <label htmlFor="tc-date">Inspection Date *</label>
                <input
                  id="tc-date"
                  type="date"
                  disabled={isLocked}
                  required
                  value={form.inspectionDate}
                  onChange={(e) => setForm({ ...form, inspectionDate: e.target.value })}
                />
              </div>
              <div className="field">
                <label htmlFor="tc-shift">Shift</label>
                <input
                  id="tc-shift"
                  type="text"
                  disabled={isLocked}
                  value={form.shift}
                  onChange={(e) => setForm({ ...form, shift: e.target.value })}
                />
              </div>
              <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'flex-end' }}>
                <div style={{ flex: 1 }}>
                  <SearchableSelect
                    label="Production Line"
                    options={lines}
                    value={form.productionLineId}
                    disabled={isLocked}
                    required
                    getOptionValue={(l) => l._id}
                    getOptionLabel={(l) => l.name}
                    getOptionSubLabel={(l) => l.code}
                    onChange={(val) => setForm({ ...form, productionLineId: val })}
                  />
                </div>
                {!isLocked && hasPerm('masterData', 'create') ? (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ marginBlockEnd: '0.85rem', minBlockSize: '42px', whiteSpace: 'nowrap' }}
                    title="Quick add Production Line"
                    onClick={() => setQuickLineOpen(true)}
                  >
                    <Plus size={14} aria-hidden="true" />
                    <span>Line</span>
                  </button>
                ) : null}
              </div>
            </div>

            <div className="kpi-grid" style={{ marginBottom: '0.65rem' }}>
              <div className="kpi-card">
                <span className="kpi-label">Total Target Value</span>
                <span className="kpi-value">{liveTotals.target}</span>
              </div>
              <div className="kpi-card">
                <span className="kpi-label">Achieved Value</span>
                <span className="kpi-value" style={{ color: 'var(--success)' }}>{liveTotals.achieved}</span>
              </div>
              <div className="kpi-card">
                <span className="kpi-label">Pending Value</span>
                <span className="kpi-value" style={{ color: 'var(--warning)' }}>{liveTotals.pending}</span>
              </div>
              <div className="kpi-card">
                <span className="kpi-label">Overall Achievement %</span>
                <span className="kpi-value" style={{ color: 'var(--primary)' }}>{livePct}%</span>
              </div>
            </div>

            <p className="muted" style={{ marginBottom: '0.5rem' }}>
              Enter Target &amp; Actual directly in any cell below, or click a circle to customize parameter name, unit, and remarks.
            </p>

            <div className="tc-paper-frame">
              {form.indicators.map((ind, idx) => (
                <ConcentricCircleGauge
                  key={ind.index || idx}
                  indicator={ind}
                  isLocked={isLocked}
                  onSelect={() => setSelectedCircleIdx(idx)}
                  onInlineChange={(patch) => updateIndicatorAt(idx, patch)}
                />
              ))}
            </div>

            <div className="field" style={{ marginTop: '1rem' }}>
              <label htmlFor="tc-remarks">Overall Remarks</label>
              <textarea
                id="tc-remarks"
                disabled={isLocked}
                value={form.remarks}
                onChange={(e) => setForm({ ...form, remarks: e.target.value })}
              />
            </div>

            {error ? <div className="alert alert-error">{error}</div> : null}
            {notice ? <div className="alert alert-success">{notice}</div> : null}

            {!isLocked && (hasPerm('targetChart', 'create') || hasPerm('targetChart', 'edit')) ? (
              <div className="btn-row">
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={saving}
                  onClick={() => handleSave(false)}
                >
                  <Save size={15} aria-hidden="true" />
                  <span>{saving ? 'Saving...' : 'Save Draft'}</span>
                </button>
                {hasPerm('targetChart', 'submit') ? (
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={saving}
                    onClick={() => handleSave(true)}
                  >
                    <span>Save &amp; Submit</span>
                  </button>
                ) : null}
              </div>
            ) : null}
          </section>

          {activeRecord ? (
            <ApprovalPanel
              endpointBase="/inspections/target-charts"
              moduleKey="targetChart"
              inspectionType="target_chart"
              record={activeRecord}
              onUpdated={() => {
                loadRecordById(activeRecord._id);
                loadListAndAnalytics();
              }}
            />
          ) : null}
        </>
      ) : null}

      {tab === 'analytics' ? (
        <div>
          <div className="kpi-grid">
            <div className="kpi-card">
              <span className="kpi-label">Total Target Indicators</span>
              <span className="kpi-value">{analytics?.totals?.totalTargets ?? 0}</span>
            </div>
            <div className="kpi-card">
              <span className="kpi-label">Achieved Indicators (≥100%)</span>
              <span className="kpi-value" style={{ color: 'var(--success)' }}>
                {analytics?.totals?.achievedTargets ?? 0}
              </span>
            </div>
            <div className="kpi-card">
              <span className="kpi-label">Pending Indicators (&lt;100%)</span>
              <span className="kpi-value" style={{ color: 'var(--warning)' }}>
                {analytics?.totals?.pendingTargets ?? 0}
              </span>
            </div>
            <div className="kpi-card">
              <span className="kpi-label">Overall Achievement %</span>
              <span className="kpi-value" style={{ color: 'var(--primary)' }}>
                {analytics?.totals?.achievementPercentage ?? 0}%
              </span>
            </div>
          </div>

          <div className="grid-2">
            <section className="card">
              <h2 className="card-title" style={{ marginBottom: '0.75rem' }}>
                Date-Wise Performance
              </h2>
              <div style={{ width: '100%', height: 260 }}>
                <ResponsiveContainer>
                  <LineChart data={analytics?.dateWise || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" fontSize={12} />
                    <YAxis fontSize={12} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="achievementPercentage" name="Achievement %" stroke="#1e3a5f" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </section>

            <section className="card">
              <h2 className="card-title" style={{ marginBottom: '0.75rem' }}>
                Line-Wise Performance
              </h2>
              <div style={{ width: '100%', height: 260 }}>
                <ResponsiveContainer>
                  <BarChart data={analytics?.lineWise || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="productionLineName" fontSize={12} />
                    <YAxis fontSize={12} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="achievementPercentage" name="Achievement %" fill="#15803d" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>
          </div>
        </div>
      ) : null}

      <ModalDialog
        open={Boolean(selectedCircle)}
        onClose={() => setSelectedCircleIdx(null)}
        title={selectedCircle ? `Indicator #${selectedCircle.index} — ${selectedCircle.name}` : ''}
        size="sm"
      >
        {selectedCircle ? (
          <div>
            <div className="field">
              <label htmlFor="ind-name">Indicator Parameter Name</label>
              <input
                id="ind-name"
                type="text"
                disabled={isLocked}
                value={selectedCircle.name}
                onChange={(e) => updateSelectedCircle({ name: e.target.value })}
              />
            </div>
            <div className="grid-2">
              <div className="field">
                <label htmlFor="ind-target">Target Value</label>
                <input
                  id="ind-target"
                  type="number"
                  min={0}
                  step="any"
                  disabled={isLocked}
                  value={selectedCircle.targetValue ?? ''}
                  onChange={(e) =>
                    updateSelectedCircle({ targetValue: e.target.value === '' ? '' : Number(e.target.value) })
                  }
                />
              </div>
              <div className="field">
                <label htmlFor="ind-actual">Actual Achievement</label>
                <input
                  id="ind-actual"
                  type="number"
                  min={0}
                  step="any"
                  disabled={isLocked}
                  value={selectedCircle.actualValue ?? ''}
                  onChange={(e) =>
                    updateSelectedCircle({ actualValue: e.target.value === '' ? '' : Number(e.target.value) })
                  }
                />
              </div>
            </div>
            <div className="grid-2">
              <div className="field">
                <label htmlFor="ind-unit">Unit</label>
                <input
                  id="ind-unit"
                  type="text"
                  disabled={isLocked}
                  value={selectedCircle.unit}
                  onChange={(e) => updateSelectedCircle({ unit: e.target.value })}
                />
              </div>
              <div className="field">
                <label>Calculated Achievement %</label>
                <input
                  type="text"
                  readOnly
                  value={`${
                    selectedCircle.targetValue > 0
                      ? Math.round((selectedCircle.actualValue / selectedCircle.targetValue) * 10000) / 100
                      : 0
                  }%`}
                />
              </div>
            </div>
            <div className="field">
              <label htmlFor="ind-remarks">Remarks</label>
              <textarea
                id="ind-remarks"
                disabled={isLocked}
                value={selectedCircle.remarks || ''}
                onChange={(e) => updateSelectedCircle({ remarks: e.target.value })}
              />
            </div>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setSelectedCircleIdx(null)}
            >
              Done
            </button>
          </div>
        ) : null}
      </ModalDialog>

      <PdfPreviewModal
        open={pdfOpen}
        onClose={() => setPdfOpen(false)}
        moduleSlug="target-charts"
        reportId={activeRecord?._id}
        reportNumber={activeRecord?.reportNumber}
      />

      <QuickLineModal
        open={quickLineOpen}
        onClose={() => setQuickLineOpen(false)}
        onCreated={(created) => {
          setLines((prev) => [created, ...prev]);
          setForm((prev) => ({ ...prev, productionLineId: created._id }));
        }}
      />
    </div>
  );
}
