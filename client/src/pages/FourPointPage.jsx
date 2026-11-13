import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Download,
  FileSpreadsheet,
  Filter,
  Plus,
  RotateCcw,
  Save,
  Send,
  Trash2,
  XCircle,
} from 'lucide-react';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import OrderAutoFillHeader from '../components/common/OrderAutoFillHeader.jsx';
import PdfPreviewModal from '../components/common/PdfPreviewModal.jsx';
import ReportLockBanner from '../components/common/ReportLockBanner.jsx';
import StatusBadge from '../components/common/StatusBadge.jsx';

export default function FourPointPage() {
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
  const [batchFilter, setBatchFilter] = useState('');

  // PDF Preview
  const [pdfPreviewOpen, setPdfPreviewOpen] = useState(false);
  const [previewPdfUrl, setPreviewPdfUrl] = useState('');
  const [previewPdfFilename, setPreviewPdfFilename] = useState('');

  // Active Report State
  const [currentReport, setCurrentReport] = useState(null);
  const [orderId, setOrderId] = useState('');
  const [headerSnapshot, setHeaderSnapshot] = useState({
    orderNumber: '',
    buyerName: '',
    styleNumber: '',
    fabricDescription: '',
    colourName: '',
    requiredGsm: 180,
    yarnMill: '',
    knittingName: '',
    countDia: '',
    dcNumber: '',
    rollNumberSummary: '',
    totalReceivedWeight: 0,
    inspectionQuantityYards: 100,
  });

  const [isTubularFabric, setIsTubularFabric] = useState(true);
  const [acceptanceCriteria, setAcceptanceCriteria] = useState({
    rollMaxPointsPer100SqYds: 28,
    batchMaxPointsPer100SqYds: 20,
  });

  const [expandedRollDefects, setExpandedRollDefects] = useState({});

  const [rolls, setRolls] = useState([
    {
      rollNo: 'R-01',
      ropeNo: '1',
      widthCm: 76,
      diaInches: 30,
      gsm: 180,
      rollWeight: 25,
      inspectedYards: 100,
      defectsUpTo3Inches: 0,
      defects3To6Inches: 0,
      defects6To9Inches: 0,
      defectsOver9Inches: 0,
      defects: {},
      remarks: '',
    },
  ]);

  const [inspectorRemarks, setInspectorRemarks] = useState('');
  const [checkerSignature, setCheckerSignature] = useState('');
  const [labIcSignature, setLabIcSignature] = useState('');

  const loadReports = async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      if (search) q.append('search', search);
      if (statusFilter) q.append('approvalStatus', statusFilter);
      if (batchFilter) q.append('finalBatchResult', batchFilter);
      const res = await api.get(`/inspections/four-point?${q.toString()}`);
      setReports(res.data?.data || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load four point reports.');
    } finally {
      setLoading(false);
    }
  };

  const loadReportById = async (reportId) => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get(`/inspections/four-point/${reportId}`);
      const r = res.data?.data;
      if (!r) return;
      setCurrentReport(r);
      setOrderId(r.orderId?._id || r.orderId || '');
      setHeaderSnapshot(r.headerSnapshot || {});
      setIsTubularFabric(r.isTubularFabric !== false);
      setAcceptanceCriteria(r.acceptanceCriteria || { rollMaxPointsPer100SqYds: 28, batchMaxPointsPer100SqYds: 20 });
      setRolls(r.rolls || []);
      setInspectorRemarks(r.inspectorRemarks || '');
      setCheckerSignature(r.checkerSignature || '');
      setLabIcSignature(r.labIcSignature || '');
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
        fabricDescription: autoFilled.fabricName || '',
        colourName: autoFilled.colourName || '',
        requiredGsm: autoFilled.gsmValue || 180,
      }));

      // Fetch buyer approved 4-point specifications
      if (autoFilled.buyerId) {
        try {
          const specRes = await api.get(
            `/specifications/resolve?buyerId=${autoFilled.buyerId}&fabricId=${autoFilled.fabricId || ''}&styleId=${autoFilled.styleId || ''}`
          );
          if (specRes.data?.data?.fourPoint) {
            const fp = specRes.data.data.fourPoint;
            setAcceptanceCriteria({
              rollMaxPointsPer100SqYds: fp.rollPointsMax ?? 28,
              batchMaxPointsPer100SqYds: fp.batchPointsMax ?? 20,
            });
          }
        } catch (_) {}
      }
    }
  };

  const handleResetForm = () => {
    setCurrentReport(null);
    setOrderId('');
    setHeaderSnapshot({
      orderNumber: '',
      buyerName: '',
      styleNumber: '',
      fabricDescription: '',
      colourName: '',
      requiredGsm: 180,
      yarnMill: '',
      knittingName: '',
      countDia: '',
      dcNumber: '',
      rollNumberSummary: '',
      totalReceivedWeight: 0,
      inspectionQuantityYards: 100,
    });
    setRolls([
      {
        rollNo: 'R-01',
        ropeNo: '1',
        widthCm: 76,
        diaInches: 30,
        gsm: 180,
        rollWeight: 25,
        inspectedYards: 100,
        defectsUpTo3Inches: 0,
        defects3To6Inches: 0,
        defects6To9Inches: 0,
        defectsOver9Inches: 0,
        defects: {},
        remarks: '',
      },
    ]);
    setInspectorRemarks('');
    setActiveTab('new');
    navigate('/inspections/four-point');
  };

  const isLocked = currentReport && ['Approved', 'Pending Approval'].includes(currentReport.approvalStatus);

  // Live calculation for a single roll
  const computeRollCalculations = (r) => {
    const inspectedYards = Number(r.inspectedYards || 100);
    const diaInches = Number(r.diaInches || 30);
    const d1 = Number(r.defectsUpTo3Inches || 0);
    const d2 = Number(r.defects3To6Inches || 0);
    const d3 = Number(r.defects6To9Inches || 0);
    const d4 = Number(r.defectsOver9Inches || 0);

    const sizePts = d1 * 1 + d2 * 2 + d3 * 3 + d4 * 4;
    const catTotal = Object.values(r.defects || {}).reduce((s, v) => s + (Number(v) || 0), 0);
    const totalPoints = sizePts > 0 ? sizePts : catTotal;

    const openWidth = isTubularFabric ? diaInches * 2 : diaInches;
    const denominator = openWidth * inspectedYards;
    const pointsPer100 = denominator > 0 ? Math.round(((totalPoints * 3600) / denominator) * 100) / 100 : 0;
    const isPass = pointsPer100 <= acceptanceCriteria.rollMaxPointsPer100SqYds;

    return { totalPoints, pointsPer100, isPass };
  };

  // Live Batch Calculation
  const batchCalc = rolls.reduce(
    (acc, r) => {
      const { totalPoints, pointsPer100, isPass } = computeRollCalculations(r);
      acc.totalRolls += 1;
      acc.totalYards += Number(r.inspectedYards || 0);
      acc.totalPoints += totalPoints;
      if (isPass) acc.accepted += 1;
      else acc.rejected += 1;
      return acc;
    },
    { totalRolls: 0, totalYards: 0, totalPoints: 0, accepted: 0, rejected: 0 }
  );

  const avgPoints =
    batchCalc.totalYards > 0
      ? Math.round(((batchCalc.totalPoints * 3600) / (60 * batchCalc.totalYards)) * 100) / 100
      : 0;
  const isBatchPass =
    rolls.length > 0 && avgPoints <= acceptanceCriteria.batchMaxPointsPer100SqYds && batchCalc.rejected === 0;

  const handleRollChange = (idx, field, val) => {
    setRolls((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [field]: val };
      return copy;
    });
  };

  const handleDefectChange = (rollIdx, defectKey, val) => {
    setRolls((prev) => {
      const copy = [...prev];
      const curDefects = { ...(copy[rollIdx].defects || {}) };
      curDefects[defectKey] = Number(val) || 0;
      copy[rollIdx] = { ...copy[rollIdx], defects: curDefects };
      return copy;
    });
  };

  const addRoll = () => {
    setRolls((prev) => [
      ...prev,
      {
        rollNo: `R-${String(prev.length + 1).padStart(2, '0')}`,
        ropeNo: String(prev.length + 1),
        widthCm: 76,
        diaInches: 30,
        gsm: 180,
        rollWeight: 25,
        inspectedYards: 100,
        defectsUpTo3Inches: 0,
        defects3To6Inches: 0,
        defects6To9Inches: 0,
        defectsOver9Inches: 0,
        defects: {},
        remarks: '',
      },
    ]);
  };

  const removeRoll = (idx) => {
    setRolls((prev) => prev.filter((_, i) => i !== idx));
  };

  const toggleRollDefects = (idx) => {
    setExpandedRollDefects((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  const handleSave = async (submitNow = false) => {
    if (!orderId && !headerSnapshot.orderNumber) {
      setError('Please select or enter an Order Number.');
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
        isTubularFabric,
        acceptanceCriteria,
        rolls,
        inspectorRemarks,
        checkerSignature,
        labIcSignature,
      };

      let savedDoc = null;
      if (currentReport?._id) {
        const res = await api.patch(`/inspections/four-point/${currentReport._id}`, payload);
        savedDoc = res.data?.data;
      } else {
        const res = await api.post('/inspections/four-point', payload);
        savedDoc = res.data?.data;
      }

      if (submitNow && savedDoc?._id) {
        const subRes = await api.post(`/inspections/four-point/${savedDoc._id}/submit`);
        savedDoc = subRes.data?.data;
      }

      setCurrentReport(savedDoc);
      setSuccess(submitNow ? 'Report submitted for checker verification!' : 'Inspection report saved successfully!');
      loadReports();
    } catch (err) {
      setError(err.response?.data?.message || 'Error saving inspection.');
    } finally {
      setSaving(false);
    }
  };

  const handleApprovalAction = async (action) => {
    if (!currentReport?._id) return;
    setSaving(true);
    setError('');
    try {
      const res = await api.post(`/inspections/four-point/${currentReport._id}/${action}`, {
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

  const handleOpenPdf = (rep) => {
    const reportDoc = rep || currentReport;
    if (!reportDoc?._id) return;
    setPreviewPdfUrl(`/api/exports/pdf/four-point/${reportDoc._id}?inline=true`);
    setPreviewPdfFilename(`${reportDoc.reportNumber}.pdf`);
    setPdfPreviewOpen(true);
  };

  const handleExportExcel = (rep) => {
    const reportDoc = rep || currentReport;
    if (!reportDoc?._id) return;
    window.open(`/api/exports/excel/individual/four-point/${reportDoc._id}`, '_blank');
  };

  return (
    <div style={{ padding: '0.5rem 0' }}>
      {/* Title & Tabs */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-color, #0f172a)', margin: 0 }}>
            Fabric Inspection Report – Dyed (Four Point System) (QF-30)
          </h1>
          <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>
            ESSTEE EXPORTS INDIA PVT LTD • Roll-wise Defect Penalty Scoring & Batch Grading
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
            <select value={batchFilter} onChange={(e) => setBatchFilter(e.target.value)}>
              <option value="">All Batch Results</option>
              <option value="PASS">PASS</option>
              <option value="FAIL">FAIL</option>
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
                  <th>Buyer</th>
                  <th>Fabric Description</th>
                  <th>Inspected Rolls</th>
                  <th>Total Yards</th>
                  <th>Avg Pts/100yd²</th>
                  <th>Batch Result</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={11} style={{ textAlign: 'center', padding: '2rem' }}>
                      Loading reports...
                    </td>
                  </tr>
                ) : reports.length === 0 ? (
                  <tr>
                    <td colSpan={11} style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                      No 4-point fabric inspection reports found. Click "+ New Report" to create one.
                    </td>
                  </tr>
                ) : (
                  reports.map((r) => {
                    const b = r.batchSummary || {};
                    const isPass = b.finalBatchResult === 'PASS';
                    return (
                      <tr key={r._id}>
                        <td style={{ fontWeight: 600 }}>{r.reportNumber}</td>
                        <td>{r.inspectionDate ? new Date(r.inspectionDate).toISOString().slice(0, 10) : '-'}</td>
                        <td>{r.headerSnapshot?.orderNumber || '-'}</td>
                        <td>{r.headerSnapshot?.buyerName || '-'}</td>
                        <td>{r.headerSnapshot?.fabricDescription || '-'}</td>
                        <td>{b.totalRolls ?? 0} rolls</td>
                        <td>{b.totalInspectedYards ?? 0} yds</td>
                        <td>{b.averagePointsPer100SqYds ?? 0}</td>
                        <td>
                          <span className={`tag ${isPass ? 'tag-success' : 'tag-danger'}`} style={{ fontWeight: 700 }}>
                            {b.finalBatchResult || 'PASS'}
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
                              onClick={() => handleOpenPdf(r)}
                            >
                              <Download size={14} /> PDF
                            </button>
                            <button
                              type="button"
                              className="btn btn-sm btn-outline"
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

      {/* Tab 2 & 3: Form View */}
      {(activeTab === 'new' || activeTab === 'report') && (
        <div>
          <ReportLockBanner
            endpointBase="/inspections/four-point"
            moduleKey="fourPoint"
            record={currentReport}
            onUnlocked={() => {
              if (currentReport?._id) {
                loadReportById(currentReport._id);
                loadReports();
              }
            }}
          />

          {/* Paper Style Container */}
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
                  FABRIC INSPECTION REPORT – DYED (FOUR POINT SYSTEM)
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#b91c1c' }}>
                  FORM QF - 30
                </div>
                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0f172a' }}>
                  S.No: {currentReport?.reportNumber || 'AUTO GENERATED'}
                </div>
              </div>
            </div>

            {/* General Information Header */}
            <OrderAutoFillHeader
              orderId={orderId}
              onOrderSelect={handleOrderSelect}
              snapshot={headerSnapshot}
              onSnapshotChange={setHeaderSnapshot}
              disabled={isLocked}
            />

            <div className="grid-4" style={{ marginBottom: '1rem', marginTop: '0.5rem' }}>
              <div className="field">
                <label>Date</label>
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
                <label>Yarn Mill</label>
                <input
                  type="text"
                  disabled={isLocked}
                  value={headerSnapshot.yarnMill || ''}
                  onChange={(e) => setHeaderSnapshot({ ...headerSnapshot, yarnMill: e.target.value })}
                  placeholder="e.g. Sivanadha Mills"
                />
              </div>
              <div className="field">
                <label>Knitting Name</label>
                <input
                  type="text"
                  disabled={isLocked}
                  value={headerSnapshot.knittingName || ''}
                  onChange={(e) => setHeaderSnapshot({ ...headerSnapshot, knittingName: e.target.value })}
                  placeholder="e.g. Esstee Unit II"
                />
              </div>
              <div className="field">
                <label>Count / Dia</label>
                <input
                  type="text"
                  disabled={isLocked}
                  value={headerSnapshot.countDia || ''}
                  onChange={(e) => setHeaderSnapshot({ ...headerSnapshot, countDia: e.target.value })}
                  placeholder="e.g. 30s Cbt / 30 Dia"
                />
              </div>
              <div className="field">
                <label>DC Number</label>
                <input
                  type="text"
                  disabled={isLocked}
                  value={headerSnapshot.dcNumber || ''}
                  onChange={(e) => setHeaderSnapshot({ ...headerSnapshot, dcNumber: e.target.value })}
                  placeholder="Delivery Challan No"
                />
              </div>
              <div className="field">
                <label>Total Received Wt (kg)</label>
                <input
                  type="number"
                  disabled={isLocked}
                  value={headerSnapshot.totalReceivedWeight || ''}
                  onChange={(e) => setHeaderSnapshot({ ...headerSnapshot, totalReceivedWeight: Number(e.target.value) })}
                />
              </div>
              <div className="field">
                <label>Roll Numbers / Lot Summary</label>
                <input
                  type="text"
                  disabled={isLocked}
                  value={headerSnapshot.rollNumberSummary || ''}
                  onChange={(e) => setHeaderSnapshot({ ...headerSnapshot, rollNumberSummary: e.target.value })}
                  placeholder="e.g. Rolls 1-12"
                />
              </div>
              <div className="field">
                <label>Fabric Construction Type</label>
                <select
                  disabled={isLocked}
                  value={isTubularFabric ? 'tubular' : 'open_width'}
                  onChange={(e) => setIsTubularFabric(e.target.value === 'tubular')}
                >
                  <option value="tubular">Tubular Knit (Formula: Dia × 2)</option>
                  <option value="open_width">Open Width / Flat (Formula: Width)</option>
                </select>
              </div>
            </div>

            {/* Criteria Specs bar */}
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
              <div>
                <strong>Four-Point Scoring:</strong> Up to 3" = <strong>1 pt</strong> | 3" to 6" = <strong>2 pts</strong> | 6" to 9" = <strong>3 pts</strong> | &gt;9" = <strong>4 pts</strong>
              </div>
              <div>
                Roll Acceptance Limit: <strong>≤ {acceptanceCriteria.rollMaxPointsPer100SqYds} pts / 100 yd²</strong>
              </div>
              <div>
                Batch Acceptance Limit: <strong>≤ {acceptanceCriteria.batchMaxPointsPer100SqYds} pts / 100 yd²</strong>
              </div>
            </div>

            {/* Roll-Wise Dynamic Table */}
            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#1e3a5f', textTransform: 'uppercase' }}>
                  Roll-Wise Four Point Inspection ({rolls.length} Rolls)
                </h3>
                {!isLocked && (
                  <button type="button" className="btn btn-sm btn-outline" onClick={addRoll}>
                    <Plus size={14} /> Add Roll Row
                  </button>
                )}
              </div>

              <div className="table-responsive">
                <table className="table" style={{ fontSize: '0.85rem' }}>
                  <thead style={{ backgroundColor: '#e2e8f0' }}>
                    <tr>
                      <th style={{ width: 80 }}>Roll #</th>
                      <th style={{ width: 60 }}>Rope #</th>
                      <th style={{ width: 70 }}>Width (cm)</th>
                      <th style={{ width: 70 }}>Dia (in)</th>
                      <th style={{ width: 65 }}>GSM</th>
                      <th style={{ width: 75 }}>Roll Wt(kg)</th>
                      <th style={{ width: 75 }}>Inspected Yds</th>
                      <th style={{ width: 65, backgroundColor: '#fef3c7' }} title="Up to 3 inches: 1 pt">≤3" (1pt)</th>
                      <th style={{ width: 65, backgroundColor: '#fef3c7' }} title="Above 3 to 6 inches: 2 pts">3-6" (2pt)</th>
                      <th style={{ width: 65, backgroundColor: '#fef3c7' }} title="Above 6 to 9 inches: 3 pts">6-9" (3pt)</th>
                      <th style={{ width: 65, backgroundColor: '#fef3c7' }} title="Above 9 inches: 4 pts">&gt;9" (4pt)</th>
                      <th style={{ width: 75 }}>Total Pts</th>
                      <th style={{ width: 100 }}>Pts/100yd²</th>
                      <th style={{ width: 80 }}>Roll Status</th>
                      <th style={{ width: 110 }}>Defects Matrix</th>
                      {!isLocked && <th style={{ width: 45 }}></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {rolls.map((roll, idx) => {
                      const { totalPoints, pointsPer100, isPass } = computeRollCalculations(roll);
                      const isDefectsExpanded = expandedRollDefects[idx];

                      return (
                        <React.Fragment key={idx}>
                          <tr>
                            <td>
                              <input
                                type="text"
                                disabled={isLocked}
                                value={roll.rollNo}
                                onChange={(e) => handleRollChange(idx, 'rollNo', e.target.value)}
                                style={{ fontWeight: 600 }}
                              />
                            </td>
                            <td>
                              <input
                                type="text"
                                disabled={isLocked}
                                value={roll.ropeNo || ''}
                                onChange={(e) => handleRollChange(idx, 'ropeNo', e.target.value)}
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                disabled={isLocked}
                                value={roll.widthCm || ''}
                                onChange={(e) => handleRollChange(idx, 'widthCm', e.target.value)}
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                disabled={isLocked}
                                value={roll.diaInches || ''}
                                onChange={(e) => handleRollChange(idx, 'diaInches', e.target.value)}
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                disabled={isLocked}
                                value={roll.gsm || ''}
                                onChange={(e) => handleRollChange(idx, 'gsm', e.target.value)}
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                step="0.1"
                                disabled={isLocked}
                                value={roll.rollWeight || ''}
                                onChange={(e) => handleRollChange(idx, 'rollWeight', e.target.value)}
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                disabled={isLocked}
                                value={roll.inspectedYards || ''}
                                onChange={(e) => handleRollChange(idx, 'inspectedYards', e.target.value)}
                              />
                            </td>
                            <td style={{ backgroundColor: '#fffbeb' }}>
                              <input
                                type="number"
                                disabled={isLocked}
                                value={roll.defectsUpTo3Inches || ''}
                                onChange={(e) => handleRollChange(idx, 'defectsUpTo3Inches', e.target.value)}
                              />
                            </td>
                            <td style={{ backgroundColor: '#fffbeb' }}>
                              <input
                                type="number"
                                disabled={isLocked}
                                value={roll.defects3To6Inches || ''}
                                onChange={(e) => handleRollChange(idx, 'defects3To6Inches', e.target.value)}
                              />
                            </td>
                            <td style={{ backgroundColor: '#fffbeb' }}>
                              <input
                                type="number"
                                disabled={isLocked}
                                value={roll.defects6To9Inches || ''}
                                onChange={(e) => handleRollChange(idx, 'defects6To9Inches', e.target.value)}
                              />
                            </td>
                            <td style={{ backgroundColor: '#fffbeb' }}>
                              <input
                                type="number"
                                disabled={isLocked}
                                value={roll.defectsOver9Inches || ''}
                                onChange={(e) => handleRollChange(idx, 'defectsOver9Inches', e.target.value)}
                              />
                            </td>
                            <td style={{ fontWeight: 700 }}>{totalPoints}</td>
                            <td style={{ fontWeight: 800, color: isPass ? '#15803d' : '#b91c1c' }}>
                              {pointsPer100}
                            </td>
                            <td>
                              <span className={`tag ${isPass ? 'tag-success' : 'tag-danger'}`} style={{ fontWeight: 700 }}>
                                {isPass ? 'PASS' : 'FAIL'}
                              </span>
                            </td>
                            <td>
                              <button
                                type="button"
                                className="btn btn-sm btn-outline"
                                onClick={() => toggleRollDefects(idx)}
                              >
                                {isDefectsExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />} Defects
                              </button>
                            </td>
                            {!isLocked && (
                              <td>
                                <button
                                  type="button"
                                  className="btn btn-sm btn-icon"
                                  style={{ color: '#ef4444' }}
                                  onClick={() => removeRoll(idx)}
                                >
                                  <Trash2 size={14} />
                                </button>
                              </td>
                            )}
                          </tr>

                          {/* Expanded Defect Breakdown for this roll */}
                          {isDefectsExpanded && (
                            <tr>
                              <td colSpan={16} style={{ backgroundColor: '#f8fafc', padding: '0.75rem 1rem' }}>
                                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '0.5rem' }}>
                                  Specific Fabric Defect Quantities for Roll {roll.rollNo}:
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '0.5rem' }}>
                                  {[
                                    ['unevenDyeingPatches', 'Uneven Dyeing'],
                                    ['migration', 'Migration'],
                                    ['dyeSpots', 'Dye Spots'],
                                    ['softenerStains', 'Softener Stains'],
                                    ['cutsJoints', 'Cuts / Joints'],
                                    ['stains', 'Stains'],
                                    ['knittingHoles', 'Knitting Holes'],
                                    ['processingHoles', 'Processing Holes'],
                                    ['compactingStorageMarks', 'Compacting Marks'],
                                    ['stenterStopperMarks', 'Stenter Marks'],
                                    ['layerToLayerShadeVariation', 'Shade Variation'],
                                    ['abrasionMarks', 'Abrasion Marks'],
                                    ['oilStains', 'Oil Stains'],
                                    ['whiteMarks', 'White Marks'],
                                    ['otherDefects', 'Other Defects'],
                                  ].map(([key, label]) => (
                                    <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                      <span style={{ fontSize: '0.75rem', color: '#64748b', flex: 1 }}>{label}:</span>
                                      <input
                                        type="number"
                                        disabled={isLocked}
                                        value={roll.defects?.[key] || ''}
                                        onChange={(e) => handleDefectChange(idx, key, e.target.value)}
                                        style={{ width: 55, fontSize: '0.75rem', padding: '0.2rem' }}
                                      />
                                    </div>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Batch Summary Box */}
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
                <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block' }}>Total Rolls Inspected</span>
                    <strong style={{ fontSize: '1.15rem' }}>{batchCalc.totalRolls} rolls</strong>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block' }}>Total Yards</span>
                    <strong style={{ fontSize: '1.15rem' }}>{batchCalc.totalYards} yds</strong>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block' }}>Accepted / Rejected Rolls</span>
                    <strong style={{ fontSize: '1.15rem' }}>
                      <span style={{ color: '#4ade80' }}>{batchCalc.accepted}</span> / <span style={{ color: '#f87171' }}>{batchCalc.rejected}</span>
                    </strong>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block' }}>Total Defect Points</span>
                    <strong style={{ fontSize: '1.15rem' }}>{batchCalc.totalPoints} pts</strong>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block' }}>Average Pts / 100 yd²</span>
                    <strong style={{ fontSize: '1.15rem', color: isBatchPass ? '#4ade80' : '#f87171' }}>
                      {avgPoints}
                    </strong>
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block' }}>FINAL BATCH RESULT</span>
                  <span
                    style={{
                      fontSize: '1.25rem',
                      fontWeight: 900,
                      padding: '0.35rem 1.25rem',
                      borderRadius: 4,
                      backgroundColor: isBatchPass ? '#16a34a' : '#dc2626',
                      color: '#fff',
                      letterSpacing: 1,
                      display: 'inline-block',
                    }}
                  >
                    {isBatchPass ? 'PASS' : 'FAIL'}
                  </span>
                </div>
              </div>
            </div>

            {/* Remarks & Signatures */}
            <div className="field" style={{ marginBottom: '1rem' }}>
              <label>Inspector Remarks & Shade Notes</label>
              <textarea
                rows={2}
                disabled={isLocked}
                value={inspectorRemarks}
                onChange={(e) => setInspectorRemarks(e.target.value)}
                placeholder="Mention general fabric handfeel, slubs, selvedge condition, shade variation across rolls..."
              />
            </div>

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
                <strong>Inspector:</strong> {currentReport?.inspectorName || `${user?.fullName || 'QC Inspector'}`}
              </div>
              <div>
                <strong>Checker:</strong> {currentReport?.checkerSignature || (currentReport?.approvalStatus === 'Approved' ? 'Verified by Supervisor' : 'Pending Verification')}
              </div>
              <div>
                <strong>Lab IC:</strong> {currentReport?.labIcSignature || 'QAD Laboratory Head'}
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
                    <Download size={16} /> Printable PDF (QF-30)
                  </button>
                  <button type="button" className="btn btn-outline" onClick={() => handleExportExcel()}>
                    <FileSpreadsheet size={16} /> Excel Sheet
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

              {currentReport?.approvalStatus === 'Pending Approval' && hasPerm('fourPoint', 'approve') && (
                <>
                  <button
                    type="button"
                    className="btn btn-outline"
                    style={{ color: '#ef4444', borderColor: '#ef4444' }}
                    onClick={() => handleApprovalAction('reject')}
                  >
                    <XCircle size={16} /> Reject Batch
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ backgroundColor: '#16a34a', borderColor: '#16a34a' }}
                    onClick={() => handleApprovalAction('approve')}
                  >
                    <CheckCircle2 size={16} /> Approve Inspection
                  </button>
                </>
              )}
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
