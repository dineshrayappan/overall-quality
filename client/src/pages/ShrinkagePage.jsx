import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  History,
  Lock,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Send,
  ShieldAlert,
  Trash2,
  XCircle,
} from 'lucide-react';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import OrderAutoFillHeader from '../components/common/OrderAutoFillHeader.jsx';
import PdfPreviewModal from '../components/common/PdfPreviewModal.jsx';
import ReportLockBanner from '../components/common/ReportLockBanner.jsx';
import StatusBadge from '../components/common/StatusBadge.jsx';

const DEFAULT_POINTS = ['CHEST', 'BOTTOM', 'CBL', 'HPS', 'S.LENGTH'];

export default function ShrinkagePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, hasPerm } = useAuth();

  const [activeTab, setActiveTab] = useState(id ? 'report' : 'all');
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [resultFilter, setResultFilter] = useState('');

  // PDF Preview
  const [pdfPreviewOpen, setPdfPreviewOpen] = useState(false);
  const [previewPdfUrl, setPreviewPdfUrl] = useState('');
  const [previewPdfFilename, setPreviewPdfFilename] = useState('');

  // Active Report State
  const [currentReport, setCurrentReport] = useState(null);
  const [orderId, setOrderId] = useState('');
  const [headerSnapshot, setHeaderSnapshot] = useState({
    buyerName: '',
    orderNumber: '',
    styleNumber: '',
    fabricName: '',
    supplierName: '',
    colourName: '',
    requiredGsm: 180,
    lotNumber: '',
    sampleIdentification: '',
    allowedShrinkage: '+2% -5%',
  });

  const [toleranceConfig, setToleranceConfig] = useState({
    minShrinkage: -5,
    maxShrinkage: 2,
    gsmTolerancePercent: 5,
    attachmentMinNewton: 70,
    spiralityMaxPercent: 4,
  });

  const [garmentRows, setGarmentRows] = useState(
    DEFAULT_POINTS.map((p) => ({ point: p, bw: 0, aw: 0, kDia: '', fid: '', actualGsm: 0, spec: '+2% to -5%' }))
  );
  const [fabricRows, setFabricRows] = useState(
    DEFAULT_POINTS.map((p) => ({ point: p, bw: 0, aw: 0, kDia: '', fid: '', actualGsm: 0, spec: '+2% to -5%' }))
  );

  const [gsmTesting, setGsmTesting] = useState({ actualGsm: 180 });
  const [colourFastness, setColourFastness] = useState({
    temperature: '60°C',
    changeInShade: { value: 4, requirement: 4 },
    stainingOnCotton: { value: 3, requirement: 3 },
    crockingFabricWet: { value: 3, requirement: 3 },
    crockingFabricDry: { value: 4, requirement: 4 },
    crockingArtworkWet: { value: 4, requirement: 4 },
    crockingArtworkDry: { value: 4, requirement: 4 },
  });

  const [processDetail, setProcessDetail] = useState({
    knitting: '',
    dyeing: '',
    compacting: '',
    fabricBurstingStrength: '',
    attachmentTests: [
      { testNumber: 1, valueNewton: 70 },
      { testNumber: 2, valueNewton: 70 },
      { testNumber: 3, valueNewton: 70 },
    ],
  });

  const [spirality, setSpirality] = useState({ spiralityPercent: 0 });
  const [remarks, setRemarks] = useState('');
  const [correctiveAction, setCorrectiveAction] = useState('');
  const [overrideModalOpen, setOverrideModalOpen] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');

  const loadReports = async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      if (search) q.append('search', search);
      if (statusFilter) q.append('approvalStatus', statusFilter);
      if (resultFilter) q.append('overallResult', resultFilter);
      const res = await api.get(`/inspections/shrinkage?${q.toString()}`);
      setReports(res.data?.data || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load shrinkage reports.');
    } finally {
      setLoading(false);
    }
  };

  const loadReportById = async (reportId) => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get(`/inspections/shrinkage/${reportId}`);
      const r = res.data?.data;
      if (!r) return;
      setCurrentReport(r);
      setOrderId(r.orderId?._id || r.orderId || '');
      setHeaderSnapshot(r.headerSnapshot || {});
      setToleranceConfig(r.toleranceConfig || { minShrinkage: -5, maxShrinkage: 2, gsmTolerancePercent: 5, attachmentMinNewton: 70, spiralityMaxPercent: 4 });
      setGarmentRows(r.garmentMeasurements || []);
      setFabricRows(r.fabricMeasurements || []);
      setGsmTesting(r.gsmTesting || { actualGsm: r.headerSnapshot?.requiredGsm || 180 });
      setColourFastness(r.colourFastness || {});
      setProcessDetail(r.processDetail || {});
      setSpirality(r.spirality || { spiralityPercent: 0 });
      setRemarks(r.remarks || '');
      setCorrectiveAction(r.correctiveAction || '');
      setActiveTab('report');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load report.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      loadReportById(id);
    } else {
      loadReports();
    }
  }, [id]);

  const handleOrderSelect = async (selectedOrderId, autoFilled) => {
    setOrderId(selectedOrderId);
    if (autoFilled) {
      setHeaderSnapshot((prev) => ({
        ...prev,
        buyerName: autoFilled.buyerName || '',
        orderNumber: autoFilled.orderNumber || '',
        styleNumber: autoFilled.styleNumber || '',
        fabricName: autoFilled.fabricName || '',
        supplierName: autoFilled.supplierName || '',
        colourName: autoFilled.colourName || '',
        requiredGsm: autoFilled.gsmValue || 180,
      }));
      setGsmTesting((prev) => ({ ...prev, actualGsm: autoFilled.gsmValue || 180 }));

      // Fetch buyer approved specification
      if (autoFilled.buyerId) {
        try {
          const specRes = await api.get(
            `/specifications/resolve?buyerId=${autoFilled.buyerId}&fabricId=${autoFilled.fabricId || ''}&styleId=${autoFilled.styleId || ''}`
          );
          if (specRes.data?.data) {
            const sp = specRes.data.data;
            if (sp.shrinkage) {
              setToleranceConfig((prev) => ({
                ...prev,
                minShrinkage: sp.shrinkage.allowedRangeMin ?? -5,
                maxShrinkage: sp.shrinkage.allowedRangeMax ?? 2,
                spiralityMaxPercent: sp.shrinkage.spiralityMaxPercent ?? 4,
              }));
              setHeaderSnapshot((prev) => ({
                ...prev,
                allowedShrinkage: `+${sp.shrinkage.allowedRangeMax ?? 2}% ${sp.shrinkage.allowedRangeMin ?? -5}%`,
              }));
            }
          }
        } catch (_) {}
      }
    }
  };

  const handleResetForm = () => {
    setCurrentReport(null);
    setOrderId('');
    setHeaderSnapshot({
      buyerName: '',
      orderNumber: '',
      styleNumber: '',
      fabricName: '',
      supplierName: '',
      colourName: '',
      requiredGsm: 180,
      lotNumber: '',
      sampleIdentification: '',
      allowedShrinkage: '+2% -5%',
    });
    setGarmentRows(DEFAULT_POINTS.map((p) => ({ point: p, bw: 0, aw: 0, kDia: '', fid: '', actualGsm: 0, spec: '+2% to -5%' })));
    setFabricRows(DEFAULT_POINTS.map((p) => ({ point: p, bw: 0, aw: 0, kDia: '', fid: '', actualGsm: 0, spec: '+2% to -5%' })));
    setGsmTesting({ actualGsm: 180 });
    setRemarks('');
    setCorrectiveAction('');
    setActiveTab('new');
    navigate('/inspections/shrinkage');
  };

  const isLocked = currentReport && ['Approved', 'Pending Approval'].includes(currentReport.approvalStatus);

  const calculateLiveShrinkage = (bw, aw) => {
    const b = Number(bw || 0);
    const a = Number(aw || 0);
    if (b <= 0) return { pct: 0, ok: true };
    const pct = Math.round(((b - a) / b) * 10000) / 100;
    const ok = pct >= toleranceConfig.minShrinkage && pct <= toleranceConfig.maxShrinkage;
    return { pct, ok };
  };

  const handleRowChange = (section, idx, field, val) => {
    const setter = section === 'garment' ? setGarmentRows : setFabricRows;
    setter((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [field]: val };
      return copy;
    });
  };

  const addRow = (section) => {
    const setter = section === 'garment' ? setGarmentRows : setFabricRows;
    setter((prev) => [...prev, { point: `POINT ${prev.length + 1}`, bw: 0, aw: 0, kDia: '', fid: '', actualGsm: 0, spec: '+2% to -5%' }]);
  };

  const removeRow = (section, idx) => {
    const setter = section === 'garment' ? setGarmentRows : setFabricRows;
    setter((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSave = async (submitNow = false) => {
    if (!orderId && !headerSnapshot.orderNumber) {
      setError('Please select or specify an Order Number.');
      return;
    }
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const payload = {
        orderId: orderId || null,
        inspectionDate: currentReport?.inspectionDate || new Date().toISOString(),
        headerSnapshot,
        toleranceConfig,
        garmentMeasurements: garmentRows,
        fabricMeasurements: fabricRows,
        gsmTesting: {
          requiredGsm: Number(headerSnapshot.requiredGsm || 180),
          actualGsm: Number(gsmTesting.actualGsm || 0),
        },
        colourFastness,
        processDetail,
        spirality,
        remarks,
        correctiveAction,
      };

      let savedDoc = null;
      if (currentReport?._id) {
        const res = await api.patch(`/inspections/shrinkage/${currentReport._id}`, payload);
        savedDoc = res.data?.data;
      } else {
        const res = await api.post('/inspections/shrinkage', payload);
        savedDoc = res.data?.data;
      }

      if (submitNow && savedDoc?._id) {
        const subRes = await api.post(`/inspections/shrinkage/${savedDoc._id}/submit`);
        savedDoc = subRes.data?.data;
      }

      setCurrentReport(savedDoc);
      setSuccess(submitNow ? 'Inspection report successfully submitted for approval!' : 'Inspection report saved successfully!');
      loadReports();
    } catch (err) {
      setError(err.response?.data?.message || 'Error saving report.');
    } finally {
      setSaving(false);
    }
  };

  const handleApprovalAction = async (action) => {
    if (!currentReport?._id) return;
    setSaving(true);
    setError('');
    try {
      const res = await api.post(`/inspections/shrinkage/${currentReport._id}/${action}`, {
        comments: `Action: ${action} by ${user?.fullName}`,
      });
      setCurrentReport(res.data?.data);
      setSuccess(`Report ${action}ed successfully.`);
      loadReports();
    } catch (err) {
      setError(err.response?.data?.message || `Failed to ${action} report.`);
    } finally {
      setSaving(false);
    }
  };

  const handleOverride = async () => {
    if (!overrideReason.trim()) {
      setError('A mandatory reason is required to override.');
      return;
    }
    try {
      const res = await api.post(`/inspections/shrinkage/${currentReport._id}/override`, {
        overrideReason: overrideReason.trim(),
        newResult: 'PASS',
      });
      setCurrentReport(res.data?.data);
      setOverrideModalOpen(false);
      setSuccess('Inspection result overridden to PASS with recorded justification.');
      loadReports();
    } catch (err) {
      setError(err.response?.data?.message || 'Override failed.');
    }
  };

  const handleCreateRetest = () => {
    if (!currentReport) return;
    const previous = currentReport;
    setCurrentReport(null);
    setOrderId(previous.orderId?._id || previous.orderId || '');
    setHeaderSnapshot({
      ...previous.headerSnapshot,
      lotNumber: `${previous.headerSnapshot?.lotNumber || ''} (Retest)`,
    });
    setGarmentRows(previous.garmentMeasurements || []);
    setFabricRows(previous.fabricMeasurements || []);
    setRemarks(`Retest of ${previous.reportNumber}. Reason: Previous failure.`);
    setActiveTab('new');
    setSuccess(`Ready to test re-sample for original report ${previous.reportNumber}.`);
    navigate('/inspections/shrinkage');
  };

  const handleOpenPdf = (rep) => {
    const reportDoc = rep || currentReport;
    if (!reportDoc?._id) return;
    setPreviewPdfUrl(`/api/exports/pdf/shrinkage/${reportDoc._id}?inline=true`);
    setPreviewPdfFilename(`${reportDoc.reportNumber}.pdf`);
    setPdfPreviewOpen(true);
  };

  const handleExportExcel = (rep) => {
    const reportDoc = rep || currentReport;
    if (!reportDoc?._id) return;
    window.open(`/api/exports/excel/individual/shrinkage/${reportDoc._id}`, '_blank');
  };

  return (
    <div style={{ padding: '0.5rem 0' }}>
      {/* Top Title & Tab Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-color, #0f172a)', margin: 0 }}>
            Fabric / Garment Shrinkage Test (QF-29)
          </h1>
          <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>
            ESSTEE EXPORTS INDIA PVT LTD • Digital QA & Shrinkage Evaluation Lab
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            type="button"
            className={activeTab === 'all' ? 'btn btn-primary' : 'btn btn-outline'}
            onClick={() => { setActiveTab('all'); loadReports(); }}
          >
            All Reports ({reports.length})
          </button>
          <button
            type="button"
            className={activeTab === 'new' ? 'btn btn-primary' : 'btn btn-outline'}
            onClick={handleResetForm}
          >
            <Plus size={16} /> + New Report
          </button>
          {currentReport && (
            <button
              type="button"
              className={activeTab === 'report' ? 'btn btn-primary' : 'btn btn-outline'}
              onClick={() => setActiveTab('report')}
            >
              Report: {currentReport.reportNumber}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="banner banner-danger" style={{ marginBottom: '1rem' }}>
          <AlertTriangle size={18} /> {error}
        </div>
      )}
      {success && (
        <div className="banner banner-success" style={{ marginBottom: '1rem' }}>
          <CheckCircle2 size={18} /> {success}
        </div>
      )}

      {/* Tab 1: All Reports Listing */}
      {activeTab === 'all' && (
        <div className="card">
          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              type="text"
              placeholder="Search by Report#, Order#, Buyer, Style..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ flex: 1, minWidth: 200 }}
            />
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">All Approval Status</option>
              <option value="Draft">Draft</option>
              <option value="Pending Approval">Pending Approval</option>
              <option value="Approved">Approved</option>
              <option value="Rejected">Rejected</option>
            </select>
            <select value={resultFilter} onChange={(e) => setResultFilter(e.target.value)}>
              <option value="">All Results</option>
              <option value="PASS">PASS</option>
              <option value="FAIL">FAIL</option>
              <option value="PENDING">PENDING</option>
            </select>
            <button type="button" className="btn btn-outline" onClick={loadReports}>
              <Filter size={16} /> Apply Filters
            </button>
          </div>

          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Report #</th>
                  <th>Date</th>
                  <th>Order #</th>
                  <th>Customer / Buyer</th>
                  <th>Fabric</th>
                  <th>Colour</th>
                  <th>Shrinkage Status</th>
                  <th>Overall Result</th>
                  <th>Approval Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={10} style={{ textAlign: 'center', padding: '2rem' }}>
                      Loading reports...
                    </td>
                  </tr>
                ) : reports.length === 0 ? (
                  <tr>
                    <td colSpan={10} style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                      No shrinkage test reports found. Click "+ New Report" to record a new test.
                    </td>
                  </tr>
                ) : (
                  reports.map((r) => {
                    const isPass = r.summaryResults?.overallResult === 'PASS';
                    const isFail = r.summaryResults?.overallResult === 'FAIL';
                    return (
                      <tr key={r._id}>
                        <td style={{ fontWeight: 600 }}>{r.reportNumber}</td>
                        <td>{r.inspectionDate ? new Date(r.inspectionDate).toISOString().slice(0, 10) : '-'}</td>
                        <td>{r.headerSnapshot?.orderNumber || '-'}</td>
                        <td>{r.headerSnapshot?.buyerName || '-'}</td>
                        <td>{r.headerSnapshot?.fabricName || '-'}</td>
                        <td>{r.headerSnapshot?.colourName || '-'}</td>
                        <td>
                          <span className={`tag ${r.summaryResults?.shrinkageResult === 'OK' ? 'tag-success' : r.summaryResults?.shrinkageResult === 'NOT OK' ? 'tag-danger' : 'tag-neutral'}`}>
                            {r.summaryResults?.shrinkageResult || '-'}
                          </span>
                        </td>
                        <td>
                          <span className={`tag ${isPass ? 'tag-success' : isFail ? 'tag-danger' : 'tag-warning'}`} style={{ fontWeight: 700 }}>
                            {r.summaryResults?.overallResult || 'PENDING'}
                          </span>
                        </td>
                        <td>
                          <StatusBadge status={r.approvalStatus} />
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '0.35rem' }}>
                            <button
                              type="button"
                              className={`btn btn-sm ${['Draft', 'Returned for Correction'].includes(r.approvalStatus) ? 'btn-primary' : 'btn-outline'}`}
                              onClick={() => loadReportById(r._id)}
                            >
                              {['Draft', 'Returned for Correction'].includes(r.approvalStatus) ? 'Edit' : 'View / Edit'}
                            </button>
                            <button
                              type="button"
                              className="btn btn-sm btn-outline"
                              title="PDF Preview"
                              onClick={() => handleOpenPdf(r)}
                            >
                              <Download size={14} /> PDF
                            </button>
                            <button
                              type="button"
                              className="btn btn-sm btn-outline"
                              title="Excel Export"
                              onClick={() => handleExportExcel(r)}
                            >
                              <FileSpreadsheet size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2 & 3: New / Edit Report Form */}
      {(activeTab === 'new' || activeTab === 'report') && (
        <div>
          <ReportLockBanner
            endpointBase="/inspections/shrinkage"
            moduleKey="shrinkage"
            record={currentReport}
            onUnlocked={() => {
              if (currentReport?._id) {
                loadReportById(currentReport._id);
                loadReports();
              }
            }}
          />

          {/* Form QF-29 Paper Style Container */}
          <div
            className="card"
            style={{
              border: '2px solid #1e3a5f',
              padding: '1.25rem',
              backgroundColor: '#fff',
              borderRadius: 6,
              boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
            }}
          >
            {/* Header branding */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                borderBottom: '2px solid #1e3a5f',
                paddingBottom: '0.75rem',
                marginBottom: '1rem',
              }}
            >
              <div>
                <h2 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 800, color: '#1e3a5f', letterSpacing: 0.5 }}>
                  ESSTEE EXPORTS INDIA PVT LTD
                </h2>
                <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#334155', marginTop: 3 }}>
                  TEST REPORT (FABRIC / GARMENT SHRINKAGE)
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#b91c1c' }}>
                  FORM QF - 29
                </div>
                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0f172a' }}>
                  R.No: {currentReport?.reportNumber || 'AUTO GENERATED'}
                </div>
              </div>
            </div>

            {/* General Information Grid */}
            <OrderAutoFillHeader
              orderId={orderId}
              onOrderSelect={handleOrderSelect}
              snapshot={headerSnapshot}
              onSnapshotChange={setHeaderSnapshot}
              disabled={isLocked}
            />

            <div className="grid-4" style={{ marginBottom: '1rem', marginTop: '0.5rem' }}>
              <div className="field">
                <label>Date of Testing</label>
                <input
                  type="date"
                  disabled={isLocked}
                  value={currentReport?.inspectionDate ? new Date(currentReport.inspectionDate).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10)}
                  onChange={(e) => {
                    const dt = e.target.value;
                    setCurrentReport((prev) => ({ ...prev, inspectionDate: dt }));
                  }}
                />
              </div>
              <div className="field">
                <label>Colour</label>
                <input
                  type="text"
                  disabled={isLocked}
                  value={headerSnapshot.colourName || ''}
                  onChange={(e) => setHeaderSnapshot({ ...headerSnapshot, colourName: e.target.value })}
                />
              </div>
              <div className="field">
                <label>Fabric Lot No</label>
                <input
                  type="text"
                  disabled={isLocked}
                  value={headerSnapshot.lotNumber || ''}
                  onChange={(e) => setHeaderSnapshot({ ...headerSnapshot, lotNumber: e.target.value })}
                  placeholder="e.g. LOT-4421"
                />
              </div>
              <div className="field">
                <label>Allowed Shrinkage (Spec)</label>
                <input
                  type="text"
                  disabled={isLocked}
                  value={headerSnapshot.allowedShrinkage || '+2% -5%'}
                  onChange={(e) => setHeaderSnapshot({ ...headerSnapshot, allowedShrinkage: e.target.value })}
                />
              </div>
            </div>

            {/* Configurable Specification Bar */}
            <div
              style={{
                backgroundColor: '#f1f5f9',
                padding: '0.6rem 0.85rem',
                borderRadius: 4,
                marginBottom: '1.25rem',
                borderLeft: '4px solid #3b82f6',
                display: 'flex',
                gap: '1.5rem',
                flexWrap: 'wrap',
                alignItems: 'center',
                fontSize: '0.85rem',
              }}
            >
              <div style={{ fontWeight: 700, color: '#1e3a5f' }}>Active Criteria:</div>
              <div>
                Allowed Shrinkage Range:{' '}
                <strong style={{ color: '#0f172a' }}>
                  +{toleranceConfig.maxShrinkage}% to {toleranceConfig.minShrinkage}%
                </strong>
              </div>
              <div>
                GSM Tolerance: <strong>±{toleranceConfig.gsmTolerancePercent}%</strong>
              </div>
              <div>
                Attachment Min: <strong>≥{toleranceConfig.attachmentMinNewton} N</strong>
              </div>
              <div>
                Spirality Max: <strong>≤{toleranceConfig.spiralityMaxPercent}%</strong>
              </div>
            </div>

            {/* Section 1: Garment Measurement Table */}
            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#1e3a5f', textTransform: 'uppercase' }}>
                  Garment Measurement Section (Sample 1)
                </h3>
                {!isLocked && (
                  <button type="button" className="btn btn-sm btn-outline" onClick={() => addRow('garment')}>
                    <Plus size={14} /> Add Row
                  </button>
                )}
              </div>

              <div className="table-responsive">
                <table className="table" style={{ fontSize: '0.85rem' }}>
                  <thead style={{ backgroundColor: '#e2e8f0' }}>
                    <tr>
                      <th style={{ width: 140 }}>Measurement Point</th>
                      <th style={{ width: 85 }}>B.W. (cm)</th>
                      <th style={{ width: 85 }}>A.W. (cm)</th>
                      <th style={{ width: 100 }}>Shrinkage %</th>
                      <th style={{ width: 80 }}>K.DIA</th>
                      <th style={{ width: 80 }}>FID</th>
                      <th style={{ width: 90 }}>Actual GSM</th>
                      <th style={{ width: 110 }}>Specification</th>
                      <th style={{ width: 85 }}>Result</th>
                      {!isLocked && <th style={{ width: 50 }}></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {garmentRows.map((row, idx) => {
                      const { pct, ok } = calculateLiveShrinkage(row.bw, row.aw);
                      const isEvaluated = Number(row.bw || 0) > 0;
                      return (
                        <tr key={idx}>
                          <td>
                            <input
                              type="text"
                              disabled={isLocked}
                              value={row.point}
                              onChange={(e) => handleRowChange('garment', idx, 'point', e.target.value)}
                              style={{ fontWeight: 600 }}
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              step="0.1"
                              disabled={isLocked}
                              value={row.bw || ''}
                              onChange={(e) => handleRowChange('garment', idx, 'bw', e.target.value)}
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              step="0.1"
                              disabled={isLocked}
                              value={row.aw || ''}
                              onChange={(e) => handleRowChange('garment', idx, 'aw', e.target.value)}
                            />
                          </td>
                          <td style={{ fontWeight: 700, color: ok ? '#15803d' : '#b91c1c' }}>
                            {isEvaluated ? `${pct > 0 ? `+${pct}` : pct}%` : '-'}
                          </td>
                          <td>
                            <input
                              type="text"
                              disabled={isLocked}
                              value={row.kDia || ''}
                              onChange={(e) => handleRowChange('garment', idx, 'kDia', e.target.value)}
                            />
                          </td>
                          <td>
                            <input
                              type="text"
                              disabled={isLocked}
                              value={row.fid || ''}
                              onChange={(e) => handleRowChange('garment', idx, 'fid', e.target.value)}
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              disabled={isLocked}
                              value={row.actualGsm || ''}
                              onChange={(e) => handleRowChange('garment', idx, 'actualGsm', e.target.value)}
                            />
                          </td>
                          <td style={{ color: '#64748b', fontSize: '0.8rem' }}>
                            {row.spec || `+${toleranceConfig.maxShrinkage}% ${toleranceConfig.minShrinkage}%`}
                          </td>
                          <td>
                            {isEvaluated ? (
                              <span className={`tag ${ok ? 'tag-success' : 'tag-danger'}`} style={{ fontWeight: 700 }}>
                                {ok ? 'OK' : 'NOT OK'}
                              </span>
                            ) : (
                              <span className="tag tag-neutral">-</span>
                            )}
                          </td>
                          {!isLocked && (
                            <td>
                              <button
                                type="button"
                                className="btn btn-sm btn-icon"
                                style={{ color: '#ef4444' }}
                                onClick={() => removeRow('garment', idx)}
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Section 2: Fabric Measurement Table */}
            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#1e3a5f', textTransform: 'uppercase' }}>
                  Fabric Measurement Section (Sample 2 / Replicate)
                </h3>
                {!isLocked && (
                  <button type="button" className="btn btn-sm btn-outline" onClick={() => addRow('fabric')}>
                    <Plus size={14} /> Add Row
                  </button>
                )}
              </div>

              <div className="table-responsive">
                <table className="table" style={{ fontSize: '0.85rem' }}>
                  <thead style={{ backgroundColor: '#e2e8f0' }}>
                    <tr>
                      <th style={{ width: 140 }}>Measurement Point</th>
                      <th style={{ width: 85 }}>B.W. (cm)</th>
                      <th style={{ width: 85 }}>A.W. (cm)</th>
                      <th style={{ width: 100 }}>Shrinkage %</th>
                      <th style={{ width: 80 }}>K.DIA</th>
                      <th style={{ width: 80 }}>FID</th>
                      <th style={{ width: 90 }}>Actual GSM</th>
                      <th style={{ width: 110 }}>Specification</th>
                      <th style={{ width: 85 }}>Result</th>
                      {!isLocked && <th style={{ width: 50 }}></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {fabricRows.map((row, idx) => {
                      const { pct, ok } = calculateLiveShrinkage(row.bw, row.aw);
                      const isEvaluated = Number(row.bw || 0) > 0;
                      return (
                        <tr key={idx}>
                          <td>
                            <input
                              type="text"
                              disabled={isLocked}
                              value={row.point}
                              onChange={(e) => handleRowChange('fabric', idx, 'point', e.target.value)}
                              style={{ fontWeight: 600 }}
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              step="0.1"
                              disabled={isLocked}
                              value={row.bw || ''}
                              onChange={(e) => handleRowChange('fabric', idx, 'bw', e.target.value)}
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              step="0.1"
                              disabled={isLocked}
                              value={row.aw || ''}
                              onChange={(e) => handleRowChange('fabric', idx, 'aw', e.target.value)}
                            />
                          </td>
                          <td style={{ fontWeight: 700, color: ok ? '#15803d' : '#b91c1c' }}>
                            {isEvaluated ? `${pct > 0 ? `+${pct}` : pct}%` : '-'}
                          </td>
                          <td>
                            <input
                              type="text"
                              disabled={isLocked}
                              value={row.kDia || ''}
                              onChange={(e) => handleRowChange('fabric', idx, 'kDia', e.target.value)}
                            />
                          </td>
                          <td>
                            <input
                              type="text"
                              disabled={isLocked}
                              value={row.fid || ''}
                              onChange={(e) => handleRowChange('fabric', idx, 'fid', e.target.value)}
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              disabled={isLocked}
                              value={row.actualGsm || ''}
                              onChange={(e) => handleRowChange('fabric', idx, 'actualGsm', e.target.value)}
                            />
                          </td>
                          <td style={{ color: '#64748b', fontSize: '0.8rem' }}>
                            {row.spec || `+${toleranceConfig.maxShrinkage}% ${toleranceConfig.minShrinkage}%`}
                          </td>
                          <td>
                            {isEvaluated ? (
                              <span className={`tag ${ok ? 'tag-success' : 'tag-danger'}`} style={{ fontWeight: 700 }}>
                                {ok ? 'OK' : 'NOT OK'}
                              </span>
                            ) : (
                              <span className="tag tag-neutral">-</span>
                            )}
                          </td>
                          {!isLocked && (
                            <td>
                              <button
                                type="button"
                                className="btn btn-sm btn-icon"
                                style={{ color: '#ef4444' }}
                                onClick={() => removeRow('fabric', idx)}
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Section 3: Colour Fastness & Process Detail Dual Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
              {/* Colour Fastness */}
              <div style={{ border: '1px solid #cbd5e1', borderRadius: 4, padding: '0.85rem', backgroundColor: '#f8fafc' }}>
                <h4 style={{ margin: '0 0 0.5rem 0', color: '#1e3a5f', fontSize: '0.9rem', fontWeight: 700 }}>
                  COLOUR FASTNESS TESTING
                </h4>
                <div className="grid-2" style={{ gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <div className="field">
                    <label>Temperature</label>
                    <input
                      type="text"
                      disabled={isLocked}
                      value={colourFastness.temperature || '60°C'}
                      onChange={(e) => setColourFastness({ ...colourFastness, temperature: e.target.value })}
                    />
                  </div>
                  <div className="field">
                    <label>Change in Shade (Req ≥4)</label>
                    <input
                      type="number"
                      step="0.5"
                      disabled={isLocked}
                      value={colourFastness.changeInShade?.value ?? 4}
                      onChange={(e) =>
                        setColourFastness({
                          ...colourFastness,
                          changeInShade: { ...colourFastness.changeInShade, value: Number(e.target.value) },
                        })
                      }
                    />
                  </div>
                  <div className="field">
                    <label>Staining on Cotton (Req ≥3)</label>
                    <input
                      type="number"
                      step="0.5"
                      disabled={isLocked}
                      value={colourFastness.stainingOnCotton?.value ?? 3}
                      onChange={(e) =>
                        setColourFastness({
                          ...colourFastness,
                          stainingOnCotton: { ...colourFastness.stainingOnCotton, value: Number(e.target.value) },
                        })
                      }
                    />
                  </div>
                  <div className="field">
                    <label>Crocking Fabric Wet (Req ≥3)</label>
                    <input
                      type="number"
                      step="0.5"
                      disabled={isLocked}
                      value={colourFastness.crockingFabricWet?.value ?? 3}
                      onChange={(e) =>
                        setColourFastness({
                          ...colourFastness,
                          crockingFabricWet: { ...colourFastness.crockingFabricWet, value: Number(e.target.value) },
                        })
                      }
                    />
                  </div>
                  <div className="field">
                    <label>Crocking Fabric Dry (Req ≥4)</label>
                    <input
                      type="number"
                      step="0.5"
                      disabled={isLocked}
                      value={colourFastness.crockingFabricDry?.value ?? 4}
                      onChange={(e) =>
                        setColourFastness({
                          ...colourFastness,
                          crockingFabricDry: { ...colourFastness.crockingFabricDry, value: Number(e.target.value) },
                        })
                      }
                    />
                  </div>
                  <div className="field">
                    <label>Crocking Artwork (Req ≥4)</label>
                    <input
                      type="number"
                      step="0.5"
                      disabled={isLocked}
                      value={colourFastness.crockingArtworkDry?.value ?? 4}
                      onChange={(e) =>
                        setColourFastness({
                          ...colourFastness,
                          crockingArtworkDry: { ...colourFastness.crockingArtworkDry, value: Number(e.target.value) },
                        })
                      }
                    />
                  </div>
                </div>
              </div>

              {/* Process Details & Attachment Test */}
              <div style={{ border: '1px solid #cbd5e1', borderRadius: 4, padding: '0.85rem', backgroundColor: '#f8fafc' }}>
                <h4 style={{ margin: '0 0 0.5rem 0', color: '#1e3a5f', fontSize: '0.9rem', fontWeight: 700 }}>
                  PROCESS DETAILS & ATTACHMENT TEST
                </h4>
                <div className="grid-2" style={{ gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <div className="field">
                    <label>Knitting Details</label>
                    <input
                      type="text"
                      disabled={isLocked}
                      value={processDetail.knitting || ''}
                      onChange={(e) => setProcessDetail({ ...processDetail, knitting: e.target.value })}
                      placeholder="e.g. 28 GG Single Jersey"
                    />
                  </div>
                  <div className="field">
                    <label>Dyeing Details</label>
                    <input
                      type="text"
                      disabled={isLocked}
                      value={processDetail.dyeing || ''}
                      onChange={(e) => setProcessDetail({ ...processDetail, dyeing: e.target.value })}
                      placeholder="e.g. Reactive Dyeing"
                    />
                  </div>
                  <div className="field">
                    <label>Compacting</label>
                    <input
                      type="text"
                      disabled={isLocked}
                      value={processDetail.compacting || ''}
                      onChange={(e) => setProcessDetail({ ...processDetail, compacting: e.target.value })}
                      placeholder="e.g. Tubular / Open Width"
                    />
                  </div>
                  <div className="field">
                    <label>Fabric Bursting Strength</label>
                    <input
                      type="text"
                      disabled={isLocked}
                      value={processDetail.fabricBurstingStrength || ''}
                      onChange={(e) => setProcessDetail({ ...processDetail, fabricBurstingStrength: e.target.value })}
                      placeholder="e.g. 260 kPa"
                    />
                  </div>
                </div>

                <div style={{ marginTop: '0.5rem', borderTop: '1px dashed #cbd5e1', paddingTop: '0.5rem' }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
                    Attachment Test (Requirement: ≥70 N)
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {[0, 1, 2].map((idx) => (
                      <div key={idx} style={{ flex: 1 }}>
                        <label style={{ fontSize: '0.75rem' }}>Test #{idx + 1} (N)</label>
                        <input
                          type="number"
                          disabled={isLocked}
                          value={processDetail.attachmentTests?.[idx]?.valueNewton ?? 70}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            const updated = [...(processDetail.attachmentTests || [])];
                            updated[idx] = { testNumber: idx + 1, valueNewton: val };
                            setProcessDetail({ ...processDetail, attachmentTests: updated });
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Section 4: GSM, Spirality & Overall Test Result Evaluation */}
            <div
              style={{
                backgroundColor: '#1e293b',
                color: '#fff',
                padding: '1rem',
                borderRadius: 6,
                marginBottom: '1rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block' }}>Required GSM</span>
                    <strong style={{ fontSize: '1rem' }}>{headerSnapshot.requiredGsm || 180}</strong>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block' }}>Actual GSM</span>
                    <input
                      type="number"
                      disabled={isLocked}
                      value={gsmTesting.actualGsm || ''}
                      onChange={(e) => setGsmTesting({ actualGsm: Number(e.target.value) })}
                      style={{ width: 85, color: '#0f172a', fontWeight: 700 }}
                    />
                  </div>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block' }}>GSM Result</span>
                    <strong
                      style={{
                        color:
                          Math.abs(Number(gsmTesting.actualGsm || 0) - Number(headerSnapshot.requiredGsm || 180)) <=
                          (Number(headerSnapshot.requiredGsm || 180) * toleranceConfig.gsmTolerancePercent) / 100
                            ? '#4ade80'
                            : '#f87171',
                      }}
                    >
                      {Math.abs(Number(gsmTesting.actualGsm || 0) - Number(headerSnapshot.requiredGsm || 180)) <=
                      (Number(headerSnapshot.requiredGsm || 180) * toleranceConfig.gsmTolerancePercent) / 100
                        ? 'OK'
                        : 'NOT OK'}
                    </strong>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block' }}>Spirality %</span>
                    <input
                      type="number"
                      step="0.1"
                      disabled={isLocked}
                      value={spirality.spiralityPercent || ''}
                      onChange={(e) => setSpirality({ spiralityPercent: Number(e.target.value) })}
                      style={{ width: 75, color: '#0f172a', fontWeight: 700 }}
                    />
                  </div>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block' }}>Spirality Result</span>
                    <strong
                      style={{
                        color: Math.abs(Number(spirality.spiralityPercent || 0)) <= toleranceConfig.spiralityMaxPercent ? '#4ade80' : '#f87171',
                      }}
                    >
                      {Math.abs(Number(spirality.spiralityPercent || 0)) <= toleranceConfig.spiralityMaxPercent ? 'OK' : 'NOT OK'}
                    </strong>
                  </div>
                </div>

                {/* Overall Verdict Badge */}
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block' }}>OVERALL TEST RESULT</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span
                      style={{
                        fontSize: '1.25rem',
                        fontWeight: 900,
                        padding: '0.35rem 1rem',
                        borderRadius: 4,
                        backgroundColor:
                          currentReport?.summaryResults?.overallResult === 'PASS'
                            ? '#16a34a'
                            : currentReport?.summaryResults?.overallResult === 'FAIL'
                            ? '#dc2626'
                            : '#ca8a04',
                        color: '#fff',
                        letterSpacing: 1,
                      }}
                    >
                      {currentReport?.summaryResults?.overallResult || 'PENDING CALC'}
                    </span>
                    {['Admin', 'Quality Manager'].includes(user?.role) && currentReport?._id && (
                      <button
                        type="button"
                        className="btn btn-sm btn-outline"
                        style={{ color: '#fbbf24', borderColor: '#fbbf24' }}
                        onClick={() => setOverrideModalOpen(true)}
                        title="Override Result"
                      >
                        Override
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Remarks, Corrective Action & Digital Signatures */}
            <div className="grid-2" style={{ marginBottom: '1.25rem', gap: '1rem' }}>
              <div className="field">
                <label>Remarks & Observations</label>
                <textarea
                  rows={2}
                  disabled={isLocked}
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Enter laboratory notes, wash cycle details, observations..."
                />
              </div>
              <div className="field">
                <label>Corrective Action (if shrinkage or fastness failed)</label>
                <textarea
                  rows={2}
                  disabled={isLocked}
                  value={correctiveAction}
                  onChange={(e) => setCorrectiveAction(e.target.value)}
                  placeholder="Compaction adjustment, finishing temperature revise, stenter feed..."
                />
              </div>
            </div>

            {/* Signatures Row */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr',
                gap: '1rem',
                borderTop: '1px solid #cbd5e1',
                paddingTop: '0.75rem',
                fontSize: '0.85rem',
                color: '#475569',
              }}
            >
              <div>
                <strong>IC LAB:</strong> {currentReport?.icLabSignature || `${user?.fullName || 'QC Lab'}`}
              </div>
              <div>
                <strong>IC QAD:</strong> {currentReport?.icQadSignature || (currentReport?.approvalStatus === 'Approved' ? 'Verified & Approved' : 'Pending Approval')}
              </div>
              <div>
                <strong>Received By:</strong> {currentReport?.receivedBySignature || headerSnapshot.supplierName || 'Production In-Charge'}
              </div>
            </div>
          </div>

          {/* Action Bar */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: '1.25rem',
              flexWrap: 'wrap',
              gap: '0.75rem',
            }}
          >
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {currentReport?._id && (
                <>
                  <button type="button" className="btn btn-outline" onClick={() => handleOpenPdf()}>
                    <Download size={16} /> Printable PDF (QF-29)
                  </button>
                  <button type="button" className="btn btn-outline" onClick={() => handleExportExcel()}>
                    <FileSpreadsheet size={16} /> Excel Sheet
                  </button>
                  <button type="button" className="btn btn-outline" onClick={handleCreateRetest}>
                    <RotateCcw size={16} /> Create Retest
                  </button>
                </>
              )}
            </div>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {!isLocked && (
                <>
                  <button type="button" className="btn btn-outline" disabled={saving} onClick={() => handleSave(false)}>
                    <Save size={16} /> Save Draft
                  </button>
                  <button type="button" className="btn btn-primary" disabled={saving} onClick={() => handleSave(true)}>
                    <Send size={16} /> Submit Report
                  </button>
                </>
              )}

              {currentReport?.approvalStatus === 'Pending Approval' && hasPerm('shrinkage', 'approve') && (
                <>
                  <button
                    type="button"
                    className="btn btn-outline"
                    style={{ color: '#ef4444', borderColor: '#ef4444' }}
                    onClick={() => handleApprovalAction('reject')}
                  >
                    <XCircle size={16} /> Reject
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ backgroundColor: '#16a34a', borderColor: '#16a34a' }}
                    onClick={() => handleApprovalAction('approve')}
                  >
                    <CheckCircle2 size={16} /> Approve Report
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Override Modal */}
      {overrideModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: 500 }}>
            <h3 style={{ margin: '0 0 0.75rem 0', color: '#b91c1c', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <ShieldAlert size={20} /> Management Override Justification
            </h3>
            <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '0 0 1rem 0' }}>
              Overriding a quality failure is logged in the permanent audit trail with your digital signature. A written technical reason is mandatory.
            </p>
            <div className="field">
              <label>Reason for Technical Acceptance Override</label>
              <textarea
                rows={3}
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder="e.g. Buyer concession received via email on 2026-11-13; fabric was tested after steam finish..."
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
              <button type="button" className="btn btn-outline" onClick={() => setOverrideModalOpen(false)}>
                Cancel
              </button>
              <button type="button" className="btn btn-primary" onClick={handleOverride}>
                Confirm Override to PASS
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PDF Preview Modal */}
      <PdfPreviewModal
        isOpen={pdfPreviewOpen}
        onClose={() => setPdfPreviewOpen(false)}
        pdfUrl={previewPdfUrl}
        filename={previewPdfFilename}
      />
    </div>
  );
}
