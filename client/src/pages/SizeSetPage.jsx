import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Camera, Check, Eye, Plus, Save, X } from 'lucide-react';
import { api, createSubmissionToken, getErrorMessage } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import SearchableSelect from '../components/common/SearchableSelect.jsx';
import PhotoUploader from '../components/common/PhotoUploader.jsx';
import StatusBadge from '../components/common/StatusBadge.jsx';
import ModalDialog from '../components/common/ModalDialog.jsx';
import ApprovalPanel from '../components/common/ApprovalPanel.jsx';
import PdfPreviewModal from '../components/common/PdfPreviewModal.jsx';
import ReportLockBanner from '../components/common/ReportLockBanner.jsx';
import { QuickLineModal, QuickOrderModal } from '../components/common/QuickMasterModals.jsx';

function computeClientStats(items = []) {
  const total = items.length;
  const ok = items.filter((i) => i.status === 'OK').length;
  const notOk = items.filter((i) => i.status === 'Not OK').length;
  const na = items.filter((i) => i.status === 'N/A').length;
  const pending = items.filter((i) => !['OK', 'Not OK', 'N/A'].includes(i.status)).length;
  const applicable = total - na;
  const inspected = ok + notOk;
  return {
    total,
    applicable,
    inspected,
    ok,
    notOk,
    na,
    pending,
    okPct: inspected > 0 ? Math.round((ok / inspected) * 10000) / 100 : 0,
    notOkPct: inspected > 0 ? Math.round((notOk / inspected) * 10000) / 100 : 0,
  };
}

export default function SizeSetPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, company, hasPerm } = useAuth();

  const [tab, setTab] = useState(id ? 'form' : 'list');
  const [records, setRecords] = useState([]);
  const [lines, setLines] = useState([]);
  const [orders, setOrders] = useState([]);
  const [config, setConfig] = useState(null);
  const [activeRecord, setActiveRecord] = useState(null);
  const [pdfOpen, setPdfOpen] = useState(false);
  const [itemDetail, setItemDetail] = useState(null); // { sectionKey, idx }
  const [stageFilter, setStageFilter] = useState('');
  const [quickOrderOpen, setQuickOrderOpen] = useState(false);
  const [quickLineOpen, setQuickLineOpen] = useState(false);

  const [form, setForm] = useState({
    inspectionStage: 'Size Set',
    inspectionDate: new Date().toISOString().slice(0, 10),
    orderId: '',
    productionLineId: '',
    headerSnapshot: {},
    accessories: [],
    workmanship: [],
    labelling: [],
    ppsTopStatus: '',
    productionStatus: '',
    finalDecision: 'Pending',
    comments: '',
  });
  const [token, setToken] = useState(() => createSubmissionToken());
  const loadedIdRef = useRef(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const buildChecklistFromCfg = useCallback((cfg) => {
    const defaultAcc = [
      { itemKey: 'acc_button', label: 'Button / Button Holes' },
      { itemKey: 'acc_zipper', label: 'Zipper & Puller' },
      { itemKey: 'acc_snaps', label: 'Snaps & Fasteners' },
      { itemKey: 'acc_labels', label: 'Main / Care / Size Label' },
      { itemKey: 'acc_thread', label: 'Sewing Thread Matching' },
      { itemKey: 'acc_interlining', label: 'Interlining / Fusing' },
    ];
    const defaultWrk = [
      { itemKey: 'wrk_stitching', label: 'Stitching / Seam Construction', isCritical: true },
      { itemKey: 'wrk_tension', label: 'Thread Tension & SPI' },
      { itemKey: 'wrk_puckering', label: 'Seam Puckering & Waviness' },
      { itemKey: 'wrk_ironing', label: 'Pressing / Ironing Marks' },
      { itemKey: 'wrk_alignment', label: 'Collar & Placket Alignment', isCritical: true },
      { itemKey: 'wrk_cleanliness', label: 'Oil, Stain & Dirt Free', isCritical: true },
    ];
    const defaultLbl = [
      { itemKey: 'lbl_main', label: 'Main Label Placement' },
      { itemKey: 'lbl_care', label: 'Care Instructions & Fiber Content' },
      { itemKey: 'lbl_size', label: 'Size Label Accuracy' },
      { itemKey: 'lbl_barcode', label: 'Barcode / Hangtag Matching' },
    ];

    const mapSection = (arr, fallback) => {
      const src = Array.isArray(arr) && arr.length > 0 ? arr : fallback;
      return src
        .filter((i) => i.isActive !== false)
        .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
        .map((i, idx) => ({
          itemKey: i.itemKey || `item_${idx + 1}`,
          label: i.label || `Item ${idx + 1}`,
          status: 'Pending',
          isCritical: Boolean(i.isCritical),
          remarks: '',
          attachmentIds: [],
        }));
    };

    return {
      accessories: mapSection(cfg?.accessoriesChecklist, defaultAcc),
      workmanship: mapSection(cfg?.workmanshipChecklist, defaultWrk),
      labelling: mapSection(cfg?.labellingChecklist, defaultLbl),
    };
  }, []);

  const loadList = useCallback(async () => {
    try {
      const qs = new URLSearchParams({ limit: '50' });
      if (stageFilter) qs.set('inspectionStage', stageFilter);
      const res = await api.get(`/inspections/size-sets?${qs.toString()}`);
      setRecords(res.data?.data || []);
    } catch {
      // ignore
    }
  }, [stageFilter]);

  const loadById = useCallback(async (recordId) => {
    if (!recordId) return;
    try {
      const res = await api.get(`/inspections/size-sets/${recordId}`);
      const doc = res.data?.data;
      setActiveRecord(doc);
      setForm({
        inspectionStage: doc.inspectionStage,
        inspectionDate: new Date(doc.inspectionDate).toISOString().slice(0, 10),
        orderId: doc.orderId?._id || doc.orderId || '',
        productionLineId: doc.productionLineId?._id || doc.productionLineId || '',
        headerSnapshot: doc.headerSnapshot || {},
        accessories: doc.accessories || [],
        workmanship: doc.workmanship || [],
        labelling: doc.labelling || [],
        ppsTopStatus: doc.ppsTopStatus || '',
        productionStatus: doc.productionStatus || '',
        finalDecision: doc.finalDecision || 'Pending',
        comments: doc.comments || '',
      });
      setTab('form');
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }, []);

  useEffect(() => {
    Promise.all([
      api.get('/masters/production-lines?activeOnly=true&limit=200'),
      api.get('/masters/orders?activeOnly=true&limit=200'),
      api.get('/config/inspections/size_set'),
    ])
      .then(([linesRes, ordersRes, cfgRes]) => {
        setLines(linesRes.data?.data || []);
        setOrders(ordersRes.data?.data || []);
        const cfg = cfgRes.data?.data;
        setConfig(cfg);
        setForm((prev) => {
          if (prev.accessories.length || prev.workmanship.length || prev.labelling.length) {
            return prev;
          }
          return { ...prev, ...buildChecklistFromCfg(cfg) };
        });
      })
      .catch(() => {});
  }, [buildChecklistFromCfg]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  const resetBlankForm = useCallback(
    (nextTab = 'form') => {
      setActiveRecord(null);
      setError('');
      setNotice('');
      setToken(createSubmissionToken());
      const lists = buildChecklistFromCfg(config);
      setForm({
        inspectionStage: 'Size Set',
        inspectionDate: new Date().toISOString().slice(0, 10),
        orderId: '',
        productionLineId: '',
        headerSnapshot: {},
        ...lists,
        ppsTopStatus: '',
        productionStatus: '',
        finalDecision: 'Pending',
        comments: '',
      });
      setTab(nextTab);
    },
    [buildChecklistFromCfg, config]
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
      navigate(`/inspections/size-sets/${recordId}`);
    }
    loadById(recordId);
  };

  const startNew = () => {
    loadedIdRef.current = null;
    resetBlankForm('form');
    if (id) {
      navigate('/inspections/size-sets');
    }
  };

  const allowNA =
    user?.role === 'Admin' ||
    hasPerm('sizeSet', 'markNA') ||
    (Array.isArray(config?.allowNAForRoles) && config.allowNAForRoles.includes(user?.role));

  const isLocked =
    activeRecord && !['Draft', 'Returned for Correction'].includes(activeRecord.approvalStatus);

  const updateItem = (sectionKey, index, patch) => {
    setForm((prev) => ({
      ...prev,
      [sectionKey]: prev[sectionKey].map((item, i) => (i === index ? { ...item, ...patch } : item)),
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
    setSaving(true);
    try {
      const isNew = !activeRecord?._id;
      const payload = {
        ...form,
        productionLineId: form.productionLineId || null,
        submitImmediately,
        submissionToken: isNew ? token : undefined,
      };
      const res = activeRecord?._id
        ? await api.patch(`/inspections/size-sets/${activeRecord._id}`, payload)
        : await api.post('/inspections/size-sets', payload);
      const saved = res.data?.data;
      if (isNew) setToken(createSubmissionToken());
      setNotice(submitImmediately ? 'Report saved and submitted for approval.' : 'Draft saved.');
      await loadList();
      loadedIdRef.current = saved._id;
      navigate(`/inspections/size-sets/${saved._id}`);
      await loadById(saved._id);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const accStats = computeClientStats(form.accessories);
  const wrkStats = computeClientStats(form.workmanship);
  const lblStats = computeClientStats(form.labelling);
  const totalApplicable = accStats.applicable + wrkStats.applicable + lblStats.applicable;
  const totalInspected = accStats.inspected + wrkStats.inspected + lblStats.inspected;
  const totalOk = accStats.ok + wrkStats.ok + lblStats.ok;
  const totalNotOk = accStats.notOk + wrkStats.notOk + lblStats.notOk;
  const totalNa = accStats.na + wrkStats.na + lblStats.na;
  const completionPct =
    totalApplicable > 0 ? Math.round((totalInspected / totalApplicable) * 10000) / 100 : 100;
  const okPct = totalInspected > 0 ? Math.round((totalOk / totalInspected) * 10000) / 100 : 0;
  const notOkPct =
    totalInspected > 0 ? Math.round((totalNotOk / totalInspected) * 10000) / 100 : 0;

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

  const toggleItemStatus = (sectionKey, index, targetStatus) => {
    if (isLocked) return;
    const current = form[sectionKey]?.[index]?.status;
    updateItem(sectionKey, index, { status: current === targetStatus ? 'Pending' : targetStatus });
  };

  const activeModalItem = itemDetail ? form[itemDetail.sectionKey]?.[itemDetail.idx] : null;
  const maxGridRows = Math.max(
    (form.accessories?.length || 0) + 2, // + Approval Status & PPS/TOP rows in Col 1
    form.workmanship?.length || 0,
    form.labelling?.length || 0
  );
  const h = form.headerSnapshot || {};
  const accCount = form.accessories?.length || 0;
  const approvedSigner = activeRecord?.workflowStages?.find((s) => s.status === 'Approved');

  return (
    <div>
      <div className="card" style={{ paddingBottom: '0.5rem' }}>
        <div className="card-header">
          <div>
            <h1 className="card-title" style={{ fontSize: '1.15rem' }}>
              Module 2 — Size Set / Pilot Run / In-line / Mid-line Inspection Report
            </h1>
            <span className="muted">
              Auto-populated order details with Accessories, Workmanship &amp; Labelling checklists
            </span>
          </div>
          {hasPerm('sizeSet', 'create') ? (
            <button type="button" className="btn btn-primary btn-sm" onClick={startNew}>
              <Plus size={15} aria-hidden="true" />
              <span>New Inspection</span>
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
          {hasPerm('sizeSet', 'create') ? (
            <button
              type="button"
              role="tab"
              className="tab-btn"
              aria-selected={tab === 'form' && !activeRecord}
              onClick={startNew}
            >
              <Plus size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
              New Inspection
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
            <div className="field" style={{ marginBlockEnd: 0, minWidth: 200 }}>
              <label htmlFor="ss-stage-filter">Filter by Stage</label>
              <select
                id="ss-stage-filter"
                value={stageFilter}
                onChange={(e) => setStageFilter(e.target.value)}
              >
                <option value="">All Stages</option>
                <option value="Size Set">Size Set</option>
                <option value="Pilot Run">Pilot Run</option>
                <option value="In-line">In-line</option>
                <option value="Mid-line">Mid-line</option>
              </select>
            </div>
            {hasPerm('sizeSet', 'create') ? (
              <button type="button" className="btn btn-primary btn-sm" onClick={startNew}>
                <Plus size={14} aria-hidden="true" />
                <span>Create New Inspection</span>
              </button>
            ) : null}
          </div>

          {records.length === 0 ? (
            <p className="muted">No inspection reports found.</p>
          ) : (
            <div className="table-wrapper" tabIndex={0} role="region" aria-label="Size Set inspection table">
              <table className="qms-table responsive-stack">
                <thead>
                  <tr>
                    <th>Report #</th>
                    <th>Stage</th>
                    <th>Date</th>
                    <th>Buyer</th>
                    <th>Style</th>
                    <th>Order</th>
                    <th>OK %</th>
                    <th>Decision</th>
                    <th>Approval</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((r) => (
                    <tr key={r._id}>
                      <td data-label="Report #"><strong>{r.reportNumber}</strong></td>
                      <td data-label="Stage">{r.inspectionStage}</td>
                      <td data-label="Date">{new Date(r.inspectionDate).toISOString().slice(0, 10)}</td>
                      <td data-label="Buyer">{r.headerSnapshot?.buyerName}</td>
                      <td data-label="Style">{r.headerSnapshot?.styleNumber}</td>
                      <td data-label="Order">{r.headerSnapshot?.orderNumber}</td>
                      <td data-label="OK %"><strong>{r.calculations?.overallOkPercentage ?? 0}%</strong></td>
                      <td data-label="Decision"><StatusBadge value={r.finalDecision} /></td>
                      <td data-label="Approval"><StatusBadge value={r.approvalStatus} /></td>
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
                <span className="muted">
                  Applicable: <strong>{totalApplicable}</strong> · OK: <strong style={{ color: 'var(--success)' }}>{totalOk} ({okPct}%)</strong> · Not OK: <strong style={{ color: 'var(--danger)' }}>{totalNotOk} ({notOkPct}%)</strong> · Completion: <strong>{completionPct}%</strong>
                </span>
              </div>
              <div className="btn-row">
                <span className="paper-form-code">QF - 40</span>
                {isLocked && hasPerm('sizeSet', 'create') ? (
                  <button type="button" className="btn btn-primary btn-sm" onClick={startNew}>
                    <Plus size={14} aria-hidden="true" />
                    <span>New Inspection</span>
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

            <div className="paper-company-banner">
              <h2>{company?.companyName || 'ESSTEE EXPORTS INDIA Pvt. Ltd.,'}</h2>
              <div
                className="paper-subtitle"
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}
              >
                <span className="muted" style={{ fontSize: '0.78rem' }}>
                  {activeRecord ? `Report #: ${activeRecord.reportNumber}` : 'Select Order No. below to auto-fill buyer, style & fabric details'}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                  <span>STAGE:</span>
                  {['Size Set', 'Pilot Run', 'In-line', 'Mid-line'].map((st) => (
                    <button
                      key={st}
                      type="button"
                      disabled={isLocked}
                      onClick={() => setForm({ ...form, inspectionStage: st })}
                      className={`btn btn-sm ${form.inspectionStage === st ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ minBlockSize: '26px', padding: '0.1rem 0.5rem', fontSize: '0.75rem' }}
                    >
                      {st.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <ReportLockBanner
              endpointBase="/inspections/size-sets"
              moduleKey="sizeSet"
              record={activeRecord}
              onUnlocked={() => {
                loadById(activeRecord._id);
                loadList();
              }}
            />

            <table className="paper-kv-table">
              <tbody>
                <tr>
                  <td className="paper-kv-label" style={{ width: '16%' }}>ORDER No. *</td>
                  <td style={{ width: '34%' }}>
                    <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                      <div style={{ flex: 1 }}>
                        <SearchableSelect
                          label=""
                          placeholder="Select Order No..."
                          options={orders}
                          value={form.orderId}
                          disabled={isLocked}
                          getOptionValue={(o) => o._id}
                          getOptionLabel={(o) => `${o.orderNumber} (${o.buyerId?.name || ''})`}
                          getOptionSubLabel={(o) => o.styleId?.styleNumber}
                          onChange={handleOrderSelect}
                        />
                      </div>
                      {!isLocked && hasPerm('masterData', 'create') ? (
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          style={{ marginBlockEnd: '0.85rem', minBlockSize: '42px', padding: '0 0.45rem' }}
                          title="Quick Add Order"
                          onClick={() => setQuickOrderOpen(true)}
                        >
                          <Plus size={14} aria-hidden="true" />
                        </button>
                      ) : null}
                    </div>
                  </td>
                  <td className="paper-kv-label" style={{ width: '16%' }}>LINE (Optional)</td>
                  <td style={{ width: '34%' }}>
                    <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                      <div style={{ flex: 1 }}>
                        <SearchableSelect
                          label=""
                          placeholder="Select Line..."
                          options={lines}
                          value={form.productionLineId}
                          disabled={isLocked}
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
                          style={{ marginBlockEnd: '0.85rem', minBlockSize: '42px', padding: '0 0.45rem' }}
                          title="Quick Add Production Line"
                          onClick={() => setQuickLineOpen(true)}
                        >
                          <Plus size={14} aria-hidden="true" />
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
                <tr>
                  <td className="paper-kv-label">BUYER :</td>
                  <td><strong>{h.buyerName || '-'}</strong></td>
                  <td className="paper-kv-label">FABRIC :</td>
                  <td>{h.fabricName || '-'}</td>
                </tr>
                <tr>
                  <td className="paper-kv-label">INSPECTION DATE :</td>
                  <td>
                    <input
                      type="date"
                      disabled={isLocked}
                      value={form.inspectionDate}
                      onChange={(e) => setForm({ ...form, inspectionDate: e.target.value })}
                      style={{ minBlockSize: '28px', padding: '0.15rem 0.35rem' }}
                    />
                  </td>
                  <td className="paper-kv-label">GSM :</td>
                  <td>{h.gsmLabel || '-'}</td>
                </tr>
                <tr>
                  <td className="paper-kv-label">DESCRIPTION. :</td>
                  <td>{h.description || h.styleDescription || '-'}</td>
                  <td className="paper-kv-label">ORDER QTY :</td>
                  <td>{h.orderQuantity ?? '-'}</td>
                </tr>
                <tr>
                  <td className="paper-kv-label">STYLE No. :</td>
                  <td><strong>{h.styleNumber || '-'}</strong></td>
                  <td className="paper-kv-label">COLOUR :</td>
                  <td>{h.colourName || '-'}</td>
                </tr>
                <tr>
                  <td className="paper-kv-label">SUPPLIER :</td>
                  <td>{h.supplierName || '-'}</td>
                  <td className="paper-kv-label">SIZE RANGE :</td>
                  <td>{h.sizeRangeName || '-'}</td>
                </tr>
              </tbody>
            </table>

            {/* QF-40 Unified 3-Column Paper Grid */}
            <div className="qf40-scroll">
              <table className="qf40-grid-table" aria-label="QF-40 3-column checklist">
                <thead>
                  <tr>
                    <th style={{ width: '21%' }}>1. ACCESSORIES ({accStats.ok}/{accStats.applicable})</th>
                    <th style={{ width: '5%', textAlign: 'center' }}>OK</th>
                    <th style={{ width: '6%', textAlign: 'center' }}>NOT OK</th>
                    <th style={{ width: '22%' }}>2. WORKMANSHIP ({wrkStats.ok}/{wrkStats.applicable})</th>
                    <th style={{ width: '5%', textAlign: 'center' }}>OK</th>
                    <th style={{ width: '6%', textAlign: 'center' }}>NOT OK</th>
                    <th style={{ width: '24%' }}>3. LABELING ({lblStats.ok}/{lblStats.applicable})</th>
                    <th style={{ width: '5%', textAlign: 'center' }}>OK</th>
                    <th style={{ width: '6%', textAlign: 'center' }}>NOT OK</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: maxGridRows }, (_, rowIdx) => {
                    const acc = form.accessories?.[rowIdx];
                    const wrk = form.workmanship?.[rowIdx];
                    const lbl = form.labelling?.[rowIdx];

                    const renderPairCells = (sectionKey, item, idx) => {
                      if (!item) {
                        if (sectionKey === 'accessories' && idx === accCount) {
                          return (
                            <>
                              <td colSpan={3} style={{ background: '#f8fafc', fontWeight: 700, color: '#1e3a5f' }}>
                                Approval Status: {activeRecord?.approvalStatus || 'Draft'}
                              </td>
                            </>
                          );
                        }
                        if (sectionKey === 'accessories' && idx === accCount + 1) {
                          return (
                            <td colSpan={3}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                <strong style={{ fontSize: '0.73rem', color: '#1e3a5f', whiteSpace: 'nowrap' }}>PPS/TOP:</strong>
                                <input
                                  type="text"
                                  disabled={isLocked}
                                  value={form.ppsTopStatus}
                                  placeholder="Approved / Submitted"
                                  onChange={(e) => setForm({ ...form, ppsTopStatus: e.target.value })}
                                  style={{ minBlockSize: '24px', padding: '0.1rem 0.3rem', fontSize: '0.75rem' }}
                                />
                              </div>
                            </td>
                          );
                        }
                        return (
                          <>
                            <td />
                            <td />
                            <td />
                          </>
                        );
                      }

                      const prefix = sectionKey === 'accessories' ? '1' : sectionKey === 'workmanship' ? '2' : '3';
                      const hasNoteOrPhoto = Boolean(item.remarks || item.attachmentIds?.length);
                      return (
                        <>
                          <td>
                            <div className="qf40-item-cell">
                              <span>
                                <strong>{prefix}.{idx + 1}</strong> {item.label}
                                {item.isCritical ? <span style={{ color: 'var(--danger)', fontWeight: 800 }}> *</span> : null}
                                {item.status === 'N/A' ? <span className="badge badge-neutral" style={{ marginLeft: 4 }}>N/A</span> : null}
                              </span>
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                title="Remarks, N/A & Defect Photo"
                                onClick={() => setItemDetail({ sectionKey, idx })}
                                style={{
                                  minBlockSize: '20px',
                                  padding: '0 0.25rem',
                                  fontSize: '0.68rem',
                                  background: hasNoteOrPhoto ? '#dbeafe' : undefined,
                                }}
                              >
                                <Camera size={11} aria-hidden="true" />
                                {item.attachmentIds?.length ? <span>{item.attachmentIds.length}</span> : null}
                              </button>
                            </div>
                          </td>
                          <td style={{ padding: '2px' }}>
                            <button
                              type="button"
                              disabled={isLocked}
                              className={`qf40-check-btn ${item.status === 'OK' ? 'ok-active' : ''}`}
                              aria-label={`${item.label} OK`}
                              onClick={() => toggleItemStatus(sectionKey, idx, 'OK')}
                            >
                              {item.status === 'OK' ? <Check size={15} aria-hidden="true" /> : ''}
                            </button>
                          </td>
                          <td style={{ padding: '2px' }}>
                            <button
                              type="button"
                              disabled={isLocked}
                              className={`qf40-check-btn ${item.status === 'Not OK' ? 'notok-active' : ''}`}
                              aria-label={`${item.label} Not OK`}
                              onClick={() => toggleItemStatus(sectionKey, idx, 'Not OK')}
                            >
                              {item.status === 'Not OK' ? <X size={15} aria-hidden="true" /> : ''}
                            </button>
                          </td>
                        </>
                      );
                    };

                    return (
                      <tr key={rowIdx}>
                        {renderPairCells('accessories', acc, rowIdx)}
                        {renderPairCells('workmanship', wrk, rowIdx)}
                        {renderPairCells('labelling', lbl, rowIdx)}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* QF-40 Production Status & Comments */}
            <table className="paper-kv-table" style={{ marginTop: '0.65rem', marginBottom: 0 }}>
              <tbody>
                <tr>
                  <td className="paper-kv-label" style={{ width: '20%' }}>PRODUCTION STATUS</td>
                  <td>
                    <input
                      type="text"
                      disabled={isLocked}
                      value={form.productionStatus}
                      placeholder="Enter Production Status (e.g. Cleared / Hold)..."
                      onChange={(e) => setForm({ ...form, productionStatus: e.target.value })}
                      style={{ minBlockSize: '28px', padding: '0.15rem 0.4rem' }}
                    />
                  </td>
                </tr>
              </tbody>
            </table>

            <div style={{ marginTop: '0.45rem' }}>
              <label htmlFor="ss-comments" className="paper-kv-label" style={{ display: 'block', marginBottom: '0.2rem' }}>
                Comments
              </label>
              <textarea
                id="ss-comments"
                className="qf40-comments-box"
                disabled={isLocked}
                value={form.comments}
                onChange={(e) => setForm({ ...form, comments: e.target.value })}
              />
            </div>

            {activeRecord?.calculations?.acceptanceRuleEvaluation?.failedRules?.length ? (
              <div className="alert alert-warning" style={{ marginTop: '0.5rem' }}>
                <strong>Configurable Quality Rules Alert:</strong>{' '}
                {activeRecord.calculations.acceptanceRuleEvaluation.failedRules.join(' ')}
              </div>
            ) : null}

            {/* QF-40 Bottom Checkbox Strip: ACCEPTED / RE WORK / HOLD */}
            <div className="qf40-decision-row">
              {[
                { val: 'Accepted', label: 'ACCEPTED' },
                { val: 'Rework', label: 'RE WORK' },
                { val: 'Hold', label: 'HOLD' },
              ].map((opt) => (
                <button
                  key={opt.val}
                  type="button"
                  disabled={isLocked}
                  className={`qf40-decision-box ${form.finalDecision === opt.val ? 'active' : ''}`}
                  onClick={() => setForm({ ...form, finalDecision: opt.val })}
                >
                  <span>{opt.label}</span>
                  <span className="box-mark">
                    {form.finalDecision === opt.val ? <Check size={16} aria-hidden="true" /> : ''}
                  </span>
                </button>
              ))}
            </div>

            {/* QF-40 Footer Signatures */}
            <div className="paper-sig-row">
              <div className="paper-sig-cell">
                <strong>FACTORY</strong>
                <span className="muted">{h.supplierName || '-'}</span>
              </div>
              <div className="paper-sig-cell">
                <strong>QC</strong>
                <span className="muted">{activeRecord?.inspectorName || user?.fullName || '-'}</span>
              </div>
              <div className="paper-sig-cell">
                <strong>QAM</strong>
                <span className="muted">{approvedSigner?.actionByName || activeRecord?.approvalStatus || '-'}</span>
              </div>
            </div>

            {error ? <div className="alert alert-error" style={{ marginTop: '0.65rem' }}>{error}</div> : null}
            {notice ? <div className="alert alert-success" style={{ marginTop: '0.65rem' }}>{notice}</div> : null}

            {!isLocked && (hasPerm('sizeSet', 'create') || hasPerm('sizeSet', 'edit')) ? (
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
                {hasPerm('sizeSet', 'submit') ? (
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
              endpointBase="/inspections/size-sets"
              moduleKey="sizeSet"
              inspectionType="size_set"
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
        open={Boolean(activeModalItem)}
        title={activeModalItem ? `Item Details — ${activeModalItem.label}` : 'Item Details'}
        onClose={() => setItemDetail(null)}
      >
        {activeModalItem ? (
          <div>
            <div className="field" style={{ marginBottom: '0.75rem' }}>
              <label htmlFor="ss-item-status">Status</label>
              <select
                id="ss-item-status"
                disabled={isLocked}
                value={activeModalItem.status}
                onChange={(e) => updateItem(itemDetail.sectionKey, itemDetail.idx, { status: e.target.value })}
              >
                <option value="Pending">Pending</option>
                <option value="OK">OK</option>
                <option value="Not OK">Not OK</option>
                <option value="N/A" disabled={!allowNA}>
                  {allowNA ? 'N/A' : 'N/A (Restricted)'}
                </option>
              </select>
            </div>
            <div className="field" style={{ marginBottom: '0.75rem' }}>
              <label htmlFor="ss-item-remarks">Remarks</label>
              <textarea
                id="ss-item-remarks"
                disabled={isLocked}
                value={activeModalItem.remarks || ''}
                onChange={(e) => updateItem(itemDetail.sectionKey, itemDetail.idx, { remarks: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Defect Photographs</label>
              <PhotoUploader
                moduleName="size_set"
                itemKey={activeModalItem.itemKey}
                inspectionId={activeRecord?._id || ''}
                attachmentIds={activeModalItem.attachmentIds || []}
                disabled={isLocked}
                onChange={(ids) => updateItem(itemDetail.sectionKey, itemDetail.idx, { attachmentIds: ids })}
              />
            </div>
          </div>
        ) : null}
      </ModalDialog>

      <PdfPreviewModal
        open={pdfOpen}
        onClose={() => setPdfOpen(false)}
        moduleSlug="size-sets"
        reportId={activeRecord?._id}
        reportNumber={activeRecord?.reportNumber}
      />

      <QuickOrderModal
        open={quickOrderOpen}
        onClose={() => setQuickOrderOpen(false)}
        onCreated={async (created) => {
          const ordersRes = await api.get('/masters/orders?activeOnly=true&limit=200').catch(() => null);
          if (ordersRes?.data?.data) setOrders(ordersRes.data.data);
          else setOrders((prev) => [created, ...prev]);
          await handleOrderSelect(created._id);
        }}
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
