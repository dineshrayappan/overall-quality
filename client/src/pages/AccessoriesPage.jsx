import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Filter,
  Plus,
  RotateCcw,
  Save,
  Send,
  XCircle,
} from 'lucide-react';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import OrderAutoFillHeader from '../components/common/OrderAutoFillHeader.jsx';
import PdfPreviewModal from '../components/common/PdfPreviewModal.jsx';
import PhotoUploader from '../components/common/PhotoUploader.jsx';
import ReportLockBanner from '../components/common/ReportLockBanner.jsx';
import StatusBadge from '../components/common/StatusBadge.jsx';

const DEFAULT_13_CHECKLIST = [
  { parameterKey: 'material', label: 'Material', isMandatory: true },
  { parameterKey: 'colour_matching', label: 'Colour matching', isMandatory: true },
  { parameterKey: 'content_text', label: 'Content / Text', isMandatory: true },
  { parameterKey: 'design', label: 'Design', isMandatory: true },
  { parameterKey: 'position_design', label: 'Position of design', isMandatory: false },
  { parameterKey: 'size_material', label: 'Size of material', isMandatory: true },
  { parameterKey: 'uniformity', label: 'Uniformity', isMandatory: false },
  { parameterKey: 'fibre_composition', label: 'Fibre composition details', isMandatory: true },
  { parameterKey: 'wash_care_symbol', label: 'Wash care symbol marking', isMandatory: true },
  { parameterKey: 'weight_material', label: 'Weight of material (GSM or thickness)', isMandatory: false },
  { parameterKey: 'breaking_strength', label: 'Breaking strength (if hanger)', isMandatory: false },
  { parameterKey: 'physical_testing', label: 'Physical testing, if any', isMandatory: false },
  { parameterKey: 'lab_testing', label: 'Lab testing, if required', isMandatory: false },
];

export default function AccessoriesPage() {
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
  const [inOrNo, setInOrNo] = useState('');
  const [orderId, setOrderId] = useState('');
  const [headerSnapshot, setHeaderSnapshot] = useState({
    buyerName: '',
    orderNumber: '',
    styleNumber: '',
    supplierName: '',
    accessoryDescription: '',
    poNumber: '',
    dcNumber: '',
  });

  const [receivedDate, setReceivedDate] = useState(new Date().toISOString().slice(0, 10));
  const [receivedQuantity, setReceivedQuantity] = useState(1000);
  const [inspectedQuantity, setInspectedQuantity] = useState(80);

  const [checklist, setChecklist] = useState(
    DEFAULT_13_CHECKLIST.map((param) => ({
      parameterKey: param.parameterKey,
      label: param.label,
      isMandatory: param.isMandatory,
      status: 'OK',
      comments: '',
      attachmentIds: [],
    }))
  );

  const [remarks, setRemarks] = useState('');
  const [correctiveAction, setCorrectiveAction] = useState('');

  const loadReports = async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      if (search) q.append('search', search);
      if (statusFilter) q.append('approvalStatus', statusFilter);
      if (resultFilter) q.append('finalResult', resultFilter);
      const res = await api.get(`/inspections/accessories?${q.toString()}`);
      setReports(res.data?.data || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load accessories reports.');
    } finally {
      setLoading(false);
    }
  };

  const loadReportById = async (reportId) => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get(`/inspections/accessories/${reportId}`);
      const r = res.data?.data;
      if (!r) return;
      setCurrentReport(r);
      setInOrNo(r.inOrNo || '');
      setOrderId(r.orderId?._id || r.orderId || '');
      setHeaderSnapshot(r.headerSnapshot || {});
      setReceivedDate(r.receivedDate ? new Date(r.receivedDate).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10));
      setReceivedQuantity(r.receivedQuantity || 0);
      setInspectedQuantity(r.inspectedQuantity || 0);
      setChecklist(r.checklist || []);
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
        supplierName: autoFilled.supplierName || '',
      }));
    }
  };

  const handleResetForm = () => {
    setCurrentReport(null);
    setInOrNo('');
    setOrderId('');
    setHeaderSnapshot({
      buyerName: '',
      orderNumber: '',
      styleNumber: '',
      supplierName: '',
      accessoryDescription: '',
      poNumber: '',
      dcNumber: '',
    });
    setReceivedQuantity(1000);
    setInspectedQuantity(80);
    setChecklist(
      DEFAULT_13_CHECKLIST.map((param) => ({
        parameterKey: param.parameterKey,
        label: param.label,
        isMandatory: param.isMandatory,
        status: 'OK',
        comments: '',
        attachmentIds: [],
      }))
    );
    setRemarks('');
    setCorrectiveAction('');
    setActiveTab('new');
    navigate('/inspections/accessories');
  };

  const isLocked = currentReport && ['Approved', 'Pending Approval'].includes(currentReport.approvalStatus);

  // Live calculations
  const inspPct =
    Number(receivedQuantity) > 0
      ? Math.round((Number(inspectedQuantity) / Number(receivedQuantity)) * 10000) / 100
      : 0;

  const notOkCount = checklist.filter((c) => c.status === 'NOT OK').length;
  const okCount = checklist.filter((c) => c.status === 'OK').length;
  const naCount = checklist.filter((c) => c.status === 'NOT APPLICABLE' || c.status === 'N/A').length;
  const pendingCount = checklist.filter((c) => c.status === 'Pending').length;

  let liveFinalResult = 'ACCEPT';
  if (notOkCount > 0) liveFinalResult = 'REJECT';
  else if (pendingCount > 0) liveFinalResult = 'HOLD';

  const handleItemStatusChange = (idx, status) => {
    setChecklist((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], status };
      return copy;
    });
  };

  const handleItemCommentChange = (idx, comments) => {
    setChecklist((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], comments };
      return copy;
    });
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
        inOrNo,
        orderId: orderId || null,
        inspectionDate: currentReport?.inspectionDate || new Date().toISOString(),
        headerSnapshot,
        receivedDate,
        receivedQuantity: Number(receivedQuantity || 0),
        inspectedQuantity: Number(inspectedQuantity || 0),
        checklist,
        remarks,
        correctiveAction,
      };

      let savedDoc = null;
      if (currentReport?._id) {
        const res = await api.patch(`/inspections/accessories/${currentReport._id}`, payload);
        savedDoc = res.data?.data;
      } else {
        const res = await api.post('/inspections/accessories', payload);
        savedDoc = res.data?.data;
      }

      if (submitNow && savedDoc?._id) {
        const subRes = await api.post(`/inspections/accessories/${savedDoc._id}/submit`);
        savedDoc = subRes.data?.data;
      }

      setCurrentReport(savedDoc);
      setSuccess(submitNow ? 'Accessories inspection submitted for verification!' : 'Inspection saved successfully!');
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
      const res = await api.post(`/inspections/accessories/${currentReport._id}/${action}`, {
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
    setPreviewPdfUrl(`/api/exports/pdf/accessories/${reportDoc._id}?inline=true`);
    setPreviewPdfFilename(`${reportDoc.reportNumber}.pdf`);
    setPdfPreviewOpen(true);
  };

  const handleExportExcel = (rep) => {
    const reportDoc = rep || currentReport;
    if (!reportDoc?._id) return;
    window.open(`/api/exports/excel/individual/accessories/${reportDoc._id}`, '_blank');
  };

  return (
    <div style={{ padding: '0.5rem 0' }}>
      {/* Title & Tabs */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-color, #0f172a)', margin: 0 }}>
            Inspection Report – Accessories (Form QAD-5)
          </h1>
          <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>
            ESSTEE EXPORTS INDIA PVT LTD • Quality Assurance Division • 13-Point Check
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
              placeholder="Search by Report#, IN.OR.NO, Buyer, Style..."
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
              <option value="">All Verdicts</option>
              <option value="ACCEPT">ACCEPT</option>
              <option value="REJECT">REJECT</option>
              <option value="HOLD">HOLD</option>
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
                  <th>IN.OR.NO</th>
                  <th>Order #</th>
                  <th>Buyer</th>
                  <th>Accessory Description</th>
                  <th>Received Qty</th>
                  <th>Inspected Qty</th>
                  <th>Result</th>
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
                      No accessories inspection reports found. Click "+ New Report" to create one.
                    </td>
                  </tr>
                ) : (
                  reports.map((r) => {
                    const isAccept = r.finalResult === 'ACCEPT';
                    const isReject = r.finalResult === 'REJECT';
                    return (
                      <tr key={r._id}>
                        <td style={{ fontWeight: 600 }}>{r.reportNumber}</td>
                        <td>{r.inspectionDate ? new Date(r.inspectionDate).toISOString().slice(0, 10) : '-'}</td>
                        <td>{r.inOrNo || '-'}</td>
                        <td>{r.headerSnapshot?.orderNumber || '-'}</td>
                        <td>{r.headerSnapshot?.buyerName || '-'}</td>
                        <td>{r.headerSnapshot?.accessoryDescription || '-'}</td>
                        <td>{r.receivedQuantity}</td>
                        <td>
                          {r.inspectedQuantity} ({r.inspectionPercentage}%)
                        </td>
                        <td>
                          <span
                            className={`tag ${isAccept ? 'tag-success' : isReject ? 'tag-danger' : 'tag-warning'}`}
                            style={{ fontWeight: 700 }}
                          >
                            {r.finalResult || 'ACCEPT'}
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
            endpointBase="/inspections/accessories"
            moduleKey="accessories"
            record={currentReport}
            onUnlocked={() => {
              if (currentReport?._id) {
                loadReportById(currentReport._id);
                loadReports();
              }
            }}
          />

          {/* Form QAD-5 Paper Style Container */}
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
                  INSPECTION REPORT – ACCESSORIES
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#b91c1c' }}>
                  FORM QAD - 5
                </div>
                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0f172a' }}>
                  INSP NO: {currentReport?.reportNumber || 'AUTO GENERATED'}
                </div>
              </div>
            </div>

            {/* General Information */}
            <OrderAutoFillHeader
              orderId={orderId}
              onOrderSelect={handleOrderSelect}
              snapshot={headerSnapshot}
              onSnapshotChange={setHeaderSnapshot}
              disabled={isLocked}
            />

            <div className="grid-4" style={{ marginBottom: '1rem', marginTop: '0.5rem' }}>
              <div className="field">
                <label>IN.OR.NO</label>
                <input
                  type="text"
                  disabled={isLocked}
                  value={inOrNo}
                  onChange={(e) => setInOrNo(e.target.value)}
                  placeholder="Internal Order No"
                />
              </div>
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
                <label>Accessories Description</label>
                <input
                  type="text"
                  disabled={isLocked}
                  value={headerSnapshot.accessoryDescription || ''}
                  onChange={(e) => setHeaderSnapshot({ ...headerSnapshot, accessoryDescription: e.target.value })}
                  placeholder="e.g. 20L 4-Hole Poly Buttons"
                />
              </div>
              <div className="field">
                <label>Supplier</label>
                <input
                  type="text"
                  disabled={isLocked}
                  value={headerSnapshot.supplierName || ''}
                  onChange={(e) => setHeaderSnapshot({ ...headerSnapshot, supplierName: e.target.value })}
                />
              </div>
              <div className="field">
                <label>Our PO Number</label>
                <input
                  type="text"
                  disabled={isLocked}
                  value={headerSnapshot.poNumber || ''}
                  onChange={(e) => setHeaderSnapshot({ ...headerSnapshot, poNumber: e.target.value })}
                />
              </div>
              <div className="field">
                <label>Received Date</label>
                <input
                  type="date"
                  disabled={isLocked}
                  value={receivedDate}
                  onChange={(e) => setReceivedDate(e.target.value)}
                />
              </div>
              <div className="field">
                <label>DC Number</label>
                <input
                  type="text"
                  disabled={isLocked}
                  value={headerSnapshot.dcNumber || ''}
                  onChange={(e) => setHeaderSnapshot({ ...headerSnapshot, dcNumber: e.target.value })}
                />
              </div>
              <div className="field">
                <label>Received Quantity</label>
                <input
                  type="number"
                  disabled={isLocked}
                  value={receivedQuantity}
                  onChange={(e) => setReceivedQuantity(Number(e.target.value))}
                />
              </div>
              <div className="field">
                <label>Inspected Quantity</label>
                <input
                  type="number"
                  disabled={isLocked}
                  value={inspectedQuantity}
                  onChange={(e) => setInspectedQuantity(Number(e.target.value))}
                />
              </div>
              <div className="field">
                <label>Inspection Percentage</label>
                <input type="text" readOnly value={`${inspPct}%`} style={{ fontWeight: 700, backgroundColor: '#f1f5f9' }} />
              </div>
            </div>

            {/* 13-Point Checklist Table */}
            <div style={{ marginBottom: '1.25rem' }}>
              <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '0.95rem', fontWeight: 700, color: '#1e3a5f', textTransform: 'uppercase' }}>
                Accessories Quality Inspection Checklist (13 Parameters)
              </h3>

              <div className="table-responsive">
                <table className="table" style={{ fontSize: '0.85rem' }}>
                  <thead style={{ backgroundColor: '#e2e8f0' }}>
                    <tr>
                      <th style={{ width: 45 }}>S.No</th>
                      <th style={{ width: 220 }}>Inspection Parameter</th>
                      <th style={{ width: 180 }}>Status Evaluation</th>
                      <th>Comments / Observations</th>
                      <th style={{ width: 140 }}>Photo Defect</th>
                    </tr>
                  </thead>
                  <tbody>
                    {checklist.map((item, idx) => {
                      const isOk = item.status === 'OK';
                      const isNotOk = item.status === 'NOT OK';
                      const isNa = item.status === 'NOT APPLICABLE' || item.status === 'N/A';

                      return (
                        <tr key={item.parameterKey}>
                          <td style={{ fontWeight: 700, color: '#64748b' }}>{idx + 1}</td>
                          <td>
                            <strong>{item.label}</strong>
                            {item.isMandatory && (
                              <span style={{ color: '#b91c1c', marginLeft: 4, fontSize: '0.75rem' }}>*Mandatory</span>
                            )}
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: '0.35rem' }}>
                              <button
                                type="button"
                                disabled={isLocked}
                                className={`btn btn-sm ${isOk ? 'btn-primary' : 'btn-outline'}`}
                                style={isOk ? { backgroundColor: '#15803d', borderColor: '#15803d' } : {}}
                                onClick={() => handleItemStatusChange(idx, 'OK')}
                              >
                                OK
                              </button>
                              <button
                                type="button"
                                disabled={isLocked}
                                className={`btn btn-sm ${isNotOk ? 'btn-primary' : 'btn-outline'}`}
                                style={isNotOk ? { backgroundColor: '#dc2626', borderColor: '#dc2626' } : {}}
                                onClick={() => handleItemStatusChange(idx, 'NOT OK')}
                              >
                                NOT OK
                              </button>
                              <button
                                type="button"
                                disabled={isLocked}
                                className={`btn btn-sm ${isNa ? 'btn-primary' : 'btn-outline'}`}
                                style={isNa ? { backgroundColor: '#64748b', borderColor: '#64748b' } : {}}
                                onClick={() => handleItemStatusChange(idx, 'NOT APPLICABLE')}
                              >
                                N/A
                              </button>
                            </div>
                          </td>
                          <td>
                            <input
                              type="text"
                              disabled={isLocked}
                              value={item.comments || ''}
                              onChange={(e) => handleItemCommentChange(idx, e.target.value)}
                              placeholder="Remarks, measurements, shades, lab ref..."
                            />
                          </td>
                          <td>
                            <PhotoUploader
                              disabled={isLocked}
                              attachmentIds={item.attachmentIds || []}
                              onAttachmentsChange={(ids) => {
                                setChecklist((prev) => {
                                  const copy = [...prev];
                                  copy[idx] = { ...copy[idx], attachmentIds: ids };
                                  return copy;
                                });
                              }}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Final Result Card */}
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
                    <span style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block' }}>Received / Inspected</span>
                    <strong style={{ fontSize: '1.1rem' }}>{receivedQuantity} / {inspectedQuantity} ({inspPct}%)</strong>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block' }}>OK / Failed / N/A</span>
                    <strong style={{ fontSize: '1.1rem' }}>
                      <span style={{ color: '#4ade80' }}>{okCount} OK</span> • <span style={{ color: '#f87171' }}>{notOkCount} Failed</span> • <span>{naCount} N/A</span>
                    </strong>
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block' }}>FINAL DECISION</span>
                  <span
                    style={{
                      fontSize: '1.25rem',
                      fontWeight: 900,
                      padding: '0.35rem 1.25rem',
                      borderRadius: 4,
                      backgroundColor:
                        liveFinalResult === 'ACCEPT'
                          ? '#16a34a'
                          : liveFinalResult === 'REJECT'
                          ? '#dc2626'
                          : '#ca8a04',
                      color: '#fff',
                      letterSpacing: 1,
                      display: 'inline-block',
                    }}
                  >
                    {liveFinalResult}
                  </span>
                </div>
              </div>
            </div>

            {/* Remarks, Corrective Action & Digital Signatures */}
            <div className="grid-2" style={{ marginBottom: '1.25rem', gap: '1rem' }}>
              <div className="field">
                <label>Remarks</label>
                <textarea
                  rows={2}
                  disabled={isLocked}
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="General accessories inspection notes..."
                />
              </div>
              <div className="field">
                <label>Corrective Action</label>
                <textarea
                  rows={2}
                  disabled={isLocked}
                  value={correctiveAction}
                  onChange={(e) => setCorrectiveAction(e.target.value)}
                  placeholder="Supplier debit note, re-packing, replacement required..."
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
                <strong>Inspected By:</strong> {currentReport?.inspectedBy || `${user?.fullName || 'QC Inspector'}`}
              </div>
              <div>
                <strong>Verified By:</strong> {currentReport?.verifiedBy || (currentReport?.approvalStatus === 'Approved' ? 'QC Supervisor' : 'Pending Verification')}
              </div>
              <div>
                <strong>Approved By:</strong> {currentReport?.approvedBy || (currentReport?.approvalStatus === 'Approved' ? 'QA Manager' : 'Pending Approval')}
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
                    <Download size={16} /> Printable PDF (QAD-5)
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

              {currentReport?.approvalStatus === 'Pending Approval' && hasPerm('accessories', 'approve') && (
                <>
                  <button
                    type="button"
                    className="btn btn-outline"
                    style={{ color: '#ef4444', borderColor: '#ef4444' }}
                    onClick={() => handleApprovalAction('reject')}
                  >
                    <XCircle size={16} /> Reject Lot
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ backgroundColor: '#16a34a', borderColor: '#16a34a' }}
                    onClick={() => handleApprovalAction('approve')}
                  >
                    <CheckCircle2 size={16} /> Approve Accessories
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
