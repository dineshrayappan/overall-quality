import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Eye, Plus, Save, Trash2 } from 'lucide-react';
import { api, createSubmissionToken, getErrorMessage } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import SearchableSelect from '../components/common/SearchableSelect.jsx';
import PhotoUploader from '../components/common/PhotoUploader.jsx';
import StatusBadge from '../components/common/StatusBadge.jsx';
import ApprovalPanel from '../components/common/ApprovalPanel.jsx';
import PdfPreviewModal from '../components/common/PdfPreviewModal.jsx';
import ModalDialog from '../components/common/ModalDialog.jsx';
import ReportLockBanner from '../components/common/ReportLockBanner.jsx';
import { QuickOrderModal } from '../components/common/QuickMasterModals.jsx';

export default function MeasurementPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, company, hasPerm } = useAuth();

  const [tab, setTab] = useState(id ? 'form' : 'list');
  const [records, setRecords] = useState([]);
  const [masters, setMasters] = useState({
    orders: [],
    styles: [],
    buyers: [],
    suppliers: [],
    lines: [],
  });
  const [availableSpecs, setAvailableSpecs] = useState([]);
  const [selectedSize, setSelectedSize] = useState('');
  const [activeRecord, setActiveRecord] = useState(null);
  const [pdfOpen, setPdfOpen] = useState(false);
  const [quickOrderOpen, setQuickOrderOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [customPoint, setCustomPoint] = useState({
    size: 'M',
    measurementPoint: '',
    measurementDescription: '',
    unit: 'cm',
    approvedSpec: '',
    upperTolerance: 0.5,
    lowerTolerance: -0.5,
    pieces: 2,
  });

  const [form, setForm] = useState({
    orderId: '',
    buyerId: '',
    styleId: '',
    supplierId: '',
    fabricId: '',
    gsmId: '',
    colourId: '',
    productionLineId: '',
    inspectionDate: new Date().toISOString().slice(0, 10),
    inspectionStage: 'In-line',
    headerSnapshot: {},
    rows: [],
    remarks: '',
    specialComments: '',
    attachmentIds: [],
  });
  const [token, setToken] = useState(() => createSubmissionToken());
  const loadedIdRef = useRef(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadList = useCallback(async () => {
    try {
      const res = await api.get('/inspections/measurements?limit=50');
      setRecords(res.data?.data || []);
    } catch {
      // ignore
    }
  }, []);

  const loadById = useCallback(async (recordId) => {
    if (!recordId) return;
    try {
      const res = await api.get(`/inspections/measurements/${recordId}`);
      const doc = res.data?.data;
      setActiveRecord(doc);
      setForm({
        orderId: doc.orderId?._id || doc.orderId || '',
        buyerId: doc.buyerId?._id || doc.buyerId || '',
        styleId: doc.styleId?._id || doc.styleId || '',
        supplierId: doc.supplierId?._id || doc.supplierId || '',
        fabricId: doc.fabricId?._id || doc.fabricId || '',
        gsmId: doc.gsmId?._id || doc.gsmId || '',
        colourId: doc.colourId?._id || doc.colourId || '',
        productionLineId: doc.productionLineId?._id || doc.productionLineId || '',
        inspectionDate: new Date(doc.inspectionDate).toISOString().slice(0, 10),
        inspectionStage: doc.inspectionStage || 'In-line',
        headerSnapshot: doc.headerSnapshot || {},
        rows: doc.rows || [],
        remarks: doc.remarks || '',
        specialComments: doc.specialComments || '',
        attachmentIds: doc.attachmentIds || [],
      });
      setTab('form');
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }, []);

  useEffect(() => {
    Promise.all([
      api.get('/masters/orders?activeOnly=true&limit=200'),
      api.get('/masters/styles?activeOnly=true&limit=200'),
      api.get('/masters/buyers?activeOnly=true&limit=200'),
      api.get('/masters/suppliers?activeOnly=true&limit=200'),
      api.get('/masters/production-lines?activeOnly=true&limit=200'),
    ])
      .then(([o, s, b, sup, l]) => {
        setMasters({
          orders: o.data?.data || [],
          styles: s.data?.data || [],
          buyers: b.data?.data || [],
          suppliers: sup.data?.data || [],
          lines: l.data?.data || [],
        });
      })
      .catch(() => {});
    loadList();
  }, [loadList]);

  const resetBlankForm = useCallback((nextTab = 'form') => {
    setActiveRecord(null);
    setError('');
    setNotice('');
    setSelectedSize('');
    setToken(createSubmissionToken());
    setForm({
      orderId: '',
      buyerId: '',
      styleId: '',
      supplierId: '',
      fabricId: '',
      gsmId: '',
      colourId: '',
      productionLineId: '',
      inspectionDate: new Date().toISOString().slice(0, 10),
      inspectionStage: 'In-line',
      headerSnapshot: {},
      rows: [],
      remarks: '',
      specialComments: '',
      attachmentIds: [],
    });
    setTab(nextTab);
  }, []);

  useEffect(() => {
    if (id) {
      loadedIdRef.current = id;
      loadById(id);
    }
  }, [id, loadById]);

  useEffect(() => {
    if (!form.styleId) {
      setAvailableSpecs([]);
      setSelectedSize('');
      return;
    }
    api
      .get(`/masters/measurement-specs/for-style?styleId=${form.styleId}`)
      .then((res) => {
        const specs = res.data?.data || [];
        setAvailableSpecs(specs);
        const sizes = [...new Set(specs.map((s) => s.size).filter(Boolean))];
        setSelectedSize((prev) => (prev && sizes.includes(prev) ? prev : sizes[0] || ''));

        // If creating a new report or if rows are empty, auto-populate initial rows from specs
        setForm((prev) => {
          if (prev.rows && prev.rows.length > 0) return prev;
          if (!specs.length) return prev;
          const initialRows = [];
          for (const sz of sizes) {
            const sizeSpecs = specs.filter((s) => s.size === sz);
            for (const sn of [1, 2]) {
              initialRows.push(
                ...sizeSpecs.map((spec) => ({
                  specId: spec._id,
                  size: spec.size,
                  sampleIndex: sn,
                  measurementPoint: spec.measurementPoint,
                  measurementDescription: spec.measurementDescription || '',
                  unit: spec.unit || 'cm',
                  approvedSpec: spec.approvedSpec,
                  upperTolerance: spec.upperTolerance,
                  lowerTolerance: spec.lowerTolerance,
                  actualMeasurement: spec.approvedSpec,
                  remarks: '',
                }))
              );
            }
          }
          return initialRows.length ? { ...prev, rows: initialRows } : prev;
        });
      })
      .catch(() => {
        setAvailableSpecs([]);
        setSelectedSize('');
      });
  }, [form.styleId]);

  const openRecord = (recordId) => {
    setError('');
    setNotice('');
    setTab('form');
    if (id !== recordId) {
      navigate(`/inspections/measurements/${recordId}`);
    }
    loadById(recordId);
  };

  const startNew = () => {
    loadedIdRef.current = null;
    resetBlankForm('form');
    if (id) {
      navigate('/inspections/measurements');
    }
  };

  const isLocked =
    activeRecord && !['Draft', 'Returned for Correction'].includes(activeRecord.approvalStatus);

  const distinctSizes = [...new Set(availableSpecs.map((s) => s.size))];

  const buildSampleRows = (specs, sampleNumber) =>
    specs.map((spec) => ({
      specId: spec._id,
      size: spec.size,
      sampleIndex: sampleNumber,
      measurementPoint: spec.measurementPoint,
      measurementDescription: spec.measurementDescription || '',
      unit: spec.unit || 'cm',
      approvedSpec: spec.approvedSpec,
      upperTolerance: spec.upperTolerance,
      lowerTolerance: spec.lowerTolerance,
      actualMeasurement: spec.approvedSpec,
      remarks: '',
    }));

  const addSpecsForSize = (sizeToLoad) => {
    const specs = availableSpecs.filter((s) => s.size === sizeToLoad);
    if (specs.length === 0) {
      setError(`No Measurement Specification Master records found for size '${sizeToLoad}'.`);
      return;
    }
    setError('');
    const existingSamples = form.rows
      .filter((r) => r.size === sizeToLoad)
      .map((r) => Number(r.sampleIndex || 1));

    // Match paper Image 4 (2 pieces side-by-side under DIFFERENCE) on initial size load
    const samplesToCreate = existingSamples.length === 0 ? [1, 2] : [Math.max(...existingSamples) + 1];
    const newRows = samplesToCreate.flatMap((sn) => buildSampleRows(specs, sn));
    setForm((prev) => ({ ...prev, rows: [...prev.rows, ...newRows] }));
  };

  const loadAllSizes = () => {
    if (distinctSizes.length === 0) return;
    setError('');
    setForm((prev) => {
      const additions = [];
      for (const sz of distinctSizes) {
        const hasSz = prev.rows.some((r) => r.size === sz);
        if (!hasSz) {
          const specs = availableSpecs.filter((s) => s.size === sz);
          additions.push(...buildSampleRows(specs, 1), ...buildSampleRows(specs, 2));
        }
      }
      return additions.length ? { ...prev, rows: [...prev.rows, ...additions] } : prev;
    });
  };

  const addStandardPoints = (sizesToUse) => {
    setError('');
    let sizes = sizesToUse;
    if (!sizes || sizes.length === 0) {
      const orderSizes = form.headerSnapshot?.sizeRange?.sizes;
      if (Array.isArray(orderSizes) && orderSizes.length) {
        sizes = orderSizes;
      } else {
        sizes = ['S', 'M', 'L'];
      }
    }
    const standardSpecs = [
      { pt: 'Chest Width', desc: '1" below armhole across chest', spec: 52, u: 0.5, l: -0.5 },
      { pt: 'Body Length HPS', desc: 'High point shoulder to bottom hem', spec: 71, u: 1.0, l: -0.5 },
      { pt: 'Across Shoulder', desc: 'Shoulder seam to shoulder seam', spec: 45, u: 0.5, l: -0.5 },
      { pt: 'Sleeve Length', desc: 'Shoulder seam to cuff edge', spec: 22, u: 0.5, l: -0.5 },
      { pt: 'Bottom Hem Sweep', desc: 'Straight across bottom hem', spec: 50.5, u: 0.5, l: -0.5 },
    ];
    setForm((prev) => {
      const additions = [];
      for (const sz of sizes) {
        const hasSz = prev.rows.some((r) => r.size === sz);
        if (!hasSz) {
          for (const sn of [1, 2]) {
            for (const item of standardSpecs) {
              additions.push({
                specId: null,
                size: sz,
                sampleIndex: sn,
                measurementPoint: item.pt,
                measurementDescription: item.desc,
                unit: 'cm',
                approvedSpec: item.spec,
                upperTolerance: item.u,
                lowerTolerance: item.l,
                actualMeasurement: item.spec,
                remarks: '',
              });
            }
          }
        }
      }
      return additions.length ? { ...prev, rows: [...prev.rows, ...additions] } : prev;
    });
  };

  const handleOrderSelect = async (newOrderId) => {
    if (!newOrderId) {
      setForm((prev) => ({
        ...prev,
        orderId: '',
        buyerId: '',
        styleId: '',
        supplierId: '',
        fabricId: '',
        gsmId: '',
        colourId: '',
        headerSnapshot: {},
        rows: activeRecord ? prev.rows : [],
      }));
      return;
    }
    try {
      const res = await api.get(`/masters/orders/${newOrderId}/populated`);
      const autoFilled = res.data?.data?.autoFilled || {};
      setForm((prev) => {
        const styleChanged = prev.styleId && autoFilled.styleId && prev.styleId !== autoFilled.styleId;
        return {
          ...prev,
          orderId: newOrderId,
          buyerId: autoFilled.buyerId || prev.buyerId,
          styleId: autoFilled.styleId || prev.styleId,
          supplierId: autoFilled.supplierId || prev.supplierId,
          fabricId: autoFilled.fabricId || prev.fabricId,
          gsmId: autoFilled.gsmId || prev.gsmId,
          colourId: autoFilled.colourId || prev.colourId,
          headerSnapshot: autoFilled,
          rows: !activeRecord && styleChanged ? [] : prev.rows,
        };
      });
    } catch {
      setForm((prev) => ({ ...prev, orderId: newOrderId }));
    }
  };

  const addCustomMeasurementRow = (e) => {
    e.preventDefault();
    const sz = customPoint.size.trim();
    const pt = customPoint.measurementPoint.trim();
    const spec = Number(customPoint.approvedSpec);
    const upper = Number(customPoint.upperTolerance);
    const lower = Number(customPoint.lowerTolerance);
    const pieces = Math.max(1, Math.min(10, Number(customPoint.pieces || 2)));

    if (!sz || !pt || !Number.isFinite(spec) || !Number.isFinite(upper) || !Number.isFinite(lower)) {
      setError('Size, Measurement Point, Approved Spec, and Tolerances are required.');
      return;
    }
    if (lower > upper) {
      setError('Lower tolerance cannot exceed Upper tolerance.');
      return;
    }
    setError('');
    const existingSamples = form.rows
      .filter((r) => r.size === sz)
      .map((r) => Number(r.sampleIndex || 1));
    const sampleNums = existingSamples.length
      ? [...new Set(existingSamples)].sort((a, b) => a - b)
      : Array.from({ length: pieces }, (_, i) => i + 1);

    const newRows = sampleNums.map((sn) => ({
      specId: null,
      size: sz,
      sampleIndex: sn,
      measurementPoint: pt,
      measurementDescription: customPoint.measurementDescription.trim(),
      unit: customPoint.unit || 'cm',
      approvedSpec: spec,
      upperTolerance: upper,
      lowerTolerance: lower,
      actualMeasurement: spec,
      remarks: '',
    }));

    setForm((prev) => ({ ...prev, rows: [...prev.rows, ...newRows] }));
    setCustomPoint((prev) => ({ ...prev, measurementPoint: '', measurementDescription: '', approvedSpec: '' }));
    setCustomOpen(false);
  };

  const updateRow = (idx, patch) => {
    setForm((prev) => ({
      ...prev,
      rows: prev.rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)),
    }));
  };

  const removeSizeColumn = (sizeToRemove) => {
    setForm((prev) => ({
      ...prev,
      rows: prev.rows.filter((r) => r.size !== sizeToRemove),
    }));
  };

  const removeSampleColumn = (sz, sampleNum) => {
    setForm((prev) => ({
      ...prev,
      rows: prev.rows.filter((r) => !(r.size === sz && Number(r.sampleIndex || 1) === sampleNum)),
    }));
  };

  const handleSave = async (submitImmediately = false) => {
    setError('');
    setNotice('');
    if (!form.buyerId || !form.styleId) {
      setError('Please select an Order (or Buyer and Style) before saving.');
      return;
    }
    if (!form.inspectionDate) {
      setError('Please select an Inspection Date.');
      return;
    }
    if (form.rows.length === 0) {
      setError('Please click "+ Standard Points", "Add Size / Piece", or "+ Custom Point" to add at least one measurement row before saving.');
      return;
    }
    setSaving(true);
    try {
      const isNew = !activeRecord?._id;
      const payload = {
        ...form,
        orderId: form.orderId || null,
        supplierId: form.supplierId || null,
        fabricId: form.fabricId || null,
        gsmId: form.gsmId || null,
        colourId: form.colourId || null,
        productionLineId: form.productionLineId || null,
        submitImmediately,
        submissionToken: isNew ? token : undefined,
      };
      const res = activeRecord?._id
        ? await api.patch(`/inspections/measurements/${activeRecord._id}`, payload)
        : await api.post('/inspections/measurements', payload);
      const saved = res.data?.data;
      if (isNew) setToken(createSubmissionToken());
      setNotice(submitImmediately ? 'Measurement report submitted for approval.' : 'Draft saved.');
      await loadList();
      loadedIdRef.current = saved._id;
      navigate(`/inspections/measurements/${saved._id}`);
      await loadById(saved._id);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const evaluatedRows = form.rows.map((r) => {
    const spec = Number(r.approvedSpec);
    const actual = Number(r.actualMeasurement);
    const upper = Number(r.upperTolerance);
    const lower = Number(r.lowerTolerance);
    const validNums = [spec, actual, upper, lower].every(Number.isFinite);
    const diff = validNums ? Math.round((actual - spec) * 1000) / 1000 : 0;
    const within = validNums && diff >= lower && diff <= upper;
    return { ...r, diff, within };
  });
  const totalChecked = evaluatedRows.length;
  const passedCount = evaluatedRows.filter((r) => r.within).length;
  const failedCount = totalChecked - passedCount;
  const passPct = totalChecked > 0 ? Math.round((passedCount / totalChecked) * 10000) / 100 : 0;

  return (
    <div>
      <div className="card" style={{ paddingBottom: '0.5rem' }}>
        <div className="card-header">
          <div>
            <h1 className="card-title" style={{ fontSize: '1.15rem' }}>
              Module 4 — Garment Measurement Inspection Report
            </h1>
            <span className="muted">
              Loads Style &amp; Size tolerances automatically and calculates exact measurement variance
            </span>
          </div>
          {hasPerm('measurement', 'create') ? (
            <button type="button" className="btn btn-primary btn-sm" onClick={startNew}>
              <Plus size={15} aria-hidden="true" />
              <span>New Measurement Report</span>
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
          {hasPerm('measurement', 'create') ? (
            <button
              type="button"
              role="tab"
              className="tab-btn"
              aria-selected={tab === 'form' && !activeRecord}
              onClick={startNew}
            >
              <Plus size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
              New Measurement Report
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
              Showing {records.length} garment measurement inspection reports
            </span>
            {hasPerm('measurement', 'create') ? (
              <button type="button" className="btn btn-primary btn-sm" onClick={startNew}>
                <Plus size={14} aria-hidden="true" />
                <span>Create New Measurement Report</span>
              </button>
            ) : null}
          </div>

          {records.length === 0 ? (
            <p className="muted">No measurement inspection reports recorded yet.</p>
          ) : (
            <div className="table-wrapper" tabIndex={0} role="region" aria-label="Measurement inspection table">
              <table className="qms-table responsive-stack">
                <thead>
                  <tr>
                    <th>Report #</th>
                    <th>Date</th>
                    <th>Stage</th>
                    <th>Buyer</th>
                    <th>Style</th>
                    <th>Points</th>
                    <th>Pass %</th>
                    <th>Result</th>
                    <th>Approval</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((r) => (
                    <tr key={r._id}>
                      <td data-label="Report #"><strong>{r.reportNumber}</strong></td>
                      <td data-label="Date">{new Date(r.inspectionDate).toISOString().slice(0, 10)}</td>
                      <td data-label="Stage">{r.inspectionStage}</td>
                      <td data-label="Buyer">{r.headerSnapshot?.buyerName}</td>
                      <td data-label="Style">{r.headerSnapshot?.styleNumber}</td>
                      <td data-label="Points">{r.summary?.totalPointsChecked ?? 0}</td>
                      <td data-label="Pass %"><strong>{r.summary?.passPercentage ?? 0}%</strong></td>
                      <td data-label="Result"><StatusBadge value={r.summary?.overallResult || 'Pending'} /></td>
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
        (() => {
          const matrixSizes = [...new Set(evaluatedRows.map((r) => r.size))];
          const samplesBySize = {};
          for (const sz of matrixSizes) {
            samplesBySize[sz] = [
              ...new Set(
                evaluatedRows
                  .filter((r) => r.size === sz)
                  .map((r) => Number(r.sampleIndex || 1))
              ),
            ].sort((a, b) => a - b);
          }

          const pointMap = new Map();
          evaluatedRows.forEach((row, idx) => {
            const key = `${row.measurementPoint}||${row.unit}`;
            if (!pointMap.has(key)) {
              pointMap.set(key, {
                key,
                measurementPoint: row.measurementPoint,
                measurementDescription: row.measurementDescription,
                unit: row.unit,
                lowerTolerance: row.lowerTolerance,
                upperTolerance: row.upperTolerance,
                cells: new Map(),
                specsBySize: new Map(),
              });
            }
            const pt = pointMap.get(key);
            if (!pt.specsBySize.has(row.size)) pt.specsBySize.set(row.size, row.approvedSpec);
            pt.cells.set(`${row.size}__${Number(row.sampleIndex || 1)}`, { ...row, rowIndex: idx });
          });
          const matrixPoints = [...pointMap.values()];
          const h = form.headerSnapshot || {};
          const stageButtons = ['Size Set', 'On Line', 'Mid', 'Pre-Final', 'Final'];

          return (
            <>
              <section className="paper-sheet">
                <div className="paper-topbar">
                  <div className="btn-row">
                    {activeRecord ? <StatusBadge value={activeRecord.approvalStatus} /> : null}
                    <span className="muted">
                      Points Checked: <strong>{totalChecked}</strong> · Passed: <strong style={{ color: 'var(--success)' }}>{passedCount} ({passPct}%)</strong> · Failed: <strong style={{ color: 'var(--danger)' }}>{failedCount}</strong>
                    </span>
                  </div>
                  <div className="btn-row">
                    {isLocked && hasPerm('measurement', 'create') ? (
                      <button type="button" className="btn btn-primary btn-sm" onClick={startNew}>
                        <Plus size={14} aria-hidden="true" />
                        <span>New Measurement Report</span>
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
                  endpointBase="/inspections/measurements"
                  moduleKey="measurement"
                  record={activeRecord}
                  onUnlocked={() => {
                    loadById(activeRecord._id);
                    loadList();
                  }}
                />

                {/* Image 4 Formal 3-Zone Header */}
                <table className="paper-kv-table">
                  <tbody>
                    <tr>
                      <td style={{ width: '34%', verticalAlign: 'top' }}>
                        <div style={{ display: 'grid', gap: '0.3rem' }}>
                          <div>
                            <span className="paper-kv-label" style={{ background: 'transparent', paddingRight: 4 }}>ORDER No. :</span>
                            <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                              <div style={{ flex: 1 }}>
                                <SearchableSelect
                                  label=""
                                  placeholder="Select Order (Auto-fill)..."
                                  options={masters.orders}
                                  value={form.orderId}
                                  disabled={isLocked}
                                  getOptionValue={(o) => o._id}
                                  getOptionLabel={(o) => `${o.orderNumber} (${o.styleId?.styleNumber || ''})`}
                                  getOptionSubLabel={(o) => o.buyerId?.name}
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
                          </div>
                          <div>
                            <span className="paper-kv-label" style={{ background: 'transparent' }}>STYLE No. * :</span>
                            {form.orderId ? (
                              <strong style={{ marginLeft: 4 }}>{h.styleNumber || '-'}</strong>
                            ) : (
                              <SearchableSelect
                                label=""
                                placeholder="Select Style..."
                                options={masters.styles}
                                value={form.styleId}
                                disabled={isLocked}
                                getOptionValue={(s) => s._id}
                                getOptionLabel={(s) => `${s.styleNumber} — ${s.name}`}
                                getOptionSubLabel={(s) => s.code}
                                onChange={(val) => setForm({ ...form, styleId: val })}
                              />
                            )}
                          </div>
                          <div>
                            <span className="paper-kv-label" style={{ background: 'transparent' }}>STYLE DESCRIPTION :</span>{' '}
                            <span>{h.styleDescription || h.description || '-'}</span>
                          </div>
                        </div>
                      </td>

                      <td style={{ width: '32%', textAlign: 'center', verticalAlign: 'middle' }}>
                        <div style={{ fontWeight: 800, fontSize: '1.15rem', color: '#1e3a5f', letterSpacing: '0.03em' }}>
                          {company?.companyName || 'esstee'}
                        </div>
                        <div style={{ fontWeight: 700, fontSize: '0.88rem', marginTop: 2 }}>
                          INSPECTION REPORT
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.25rem', flexWrap: 'wrap', marginTop: '0.4rem' }}>
                          {stageButtons.map((st) => {
                            const active =
                              form.inspectionStage.toLowerCase() === st.toLowerCase() ||
                              (st === 'On Line' && form.inspectionStage === 'In-line') ||
                              (st === 'Mid' && form.inspectionStage === 'Mid-line');
                            return (
                              <button
                                key={st}
                                type="button"
                                disabled={isLocked}
                                onClick={() => setForm({ ...form, inspectionStage: st })}
                                className={`btn btn-sm ${active ? 'btn-primary' : 'btn-secondary'}`}
                                style={{ minBlockSize: '24px', padding: '0.1rem 0.4rem', fontSize: '0.72rem' }}
                              >
                                {st.toUpperCase()}
                              </button>
                            );
                          })}
                        </div>
                      </td>

                      <td style={{ width: '16%', verticalAlign: 'top' }}>
                        <div style={{ display: 'grid', gap: '0.35rem' }}>
                          <div>
                            <span className="paper-kv-label" style={{ background: 'transparent' }}>FABRIC :</span>{' '}
                            <span>{h.fabricName || '-'}</span>
                          </div>
                          <div>
                            <span className="paper-kv-label" style={{ background: 'transparent' }}>GSM :</span>{' '}
                            <span>{h.gsmLabel || '-'}</span>
                          </div>
                          <div>
                            <span className="paper-kv-label" style={{ background: 'transparent' }}>COLOUR :</span>{' '}
                            <span>{h.colourName || '-'}</span>
                          </div>
                        </div>
                      </td>

                      <td style={{ width: '18%', verticalAlign: 'top' }}>
                        <div style={{ display: 'grid', gap: '0.3rem' }}>
                          <div>
                            <span className="paper-kv-label" style={{ background: 'transparent' }}>ORDER QTY :</span>{' '}
                            <strong>{h.orderQuantity ?? '-'}</strong>
                          </div>
                          <div>
                            <span className="paper-kv-label" style={{ background: 'transparent' }}>BUYER * :</span>
                            {form.orderId ? (
                              <strong style={{ marginLeft: 4 }}>{h.buyerName || '-'}</strong>
                            ) : (
                              <SearchableSelect
                                label=""
                                placeholder="Buyer..."
                                options={masters.buyers}
                                value={form.buyerId}
                                disabled={isLocked}
                                getOptionValue={(b) => b._id}
                                getOptionLabel={(b) => b.name}
                                getOptionSubLabel={(b) => b.code}
                                onChange={(val) => setForm({ ...form, buyerId: val })}
                              />
                            )}
                          </div>
                          <div>
                            <span className="paper-kv-label" style={{ background: 'transparent' }}>SUPPLIER :</span>{' '}
                            <span>{h.supplierName || '-'}</span>
                          </div>
                          <div>
                            <span className="paper-kv-label" style={{ background: 'transparent' }}>DATE * :</span>
                            <input
                              type="date"
                              disabled={isLocked}
                              value={form.inspectionDate}
                              onChange={(e) => setForm({ ...form, inspectionDate: e.target.value })}
                              style={{ minBlockSize: '26px', padding: '0.1rem 0.25rem', fontSize: '0.76rem' }}
                            />
                          </div>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>

                {/* Size Column Loader Bar */}
                {!isLocked ? (
                  <div className="btn-row" style={{ marginBottom: '0.6rem', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                    <div className="btn-row">
                      <select
                        aria-label="Select size to load specs"
                        value={selectedSize}
                        onChange={(e) => setSelectedSize(e.target.value)}
                        style={{ width: 150, minBlockSize: '30px' }}
                      >
                        <option value="">Choose Size...</option>
                        {distinctSizes.map((sz) => (
                          <option key={sz} value={sz}>{sz}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        disabled={!selectedSize}
                        onClick={() => addSpecsForSize(selectedSize)}
                      >
                        <Plus size={14} aria-hidden="true" />
                        <span>Add Size / Piece</span>
                      </button>
                      {distinctSizes.length > 1 ? (
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={loadAllSizes}
                        >
                          <Plus size={14} aria-hidden="true" />
                          <span>Load All Sizes ({distinctSizes.join(', ')})</span>
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => addStandardPoints()}
                        title="Auto-populate standard garment measurement points (Chest, Length, Shoulder, Sleeve, Sweep)"
                      >
                        <Plus size={14} aria-hidden="true" />
                        <span>+ Standard Points</span>
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => setCustomOpen(true)}
                      >
                        <Plus size={14} aria-hidden="true" />
                        <span>Custom Point</span>
                      </button>
                    </div>
                    <span className="muted" style={{ fontSize: '0.76rem' }}>
                      Enter actual garment readings below; Difference (Actual − Spec) &amp; Tolerance Pass/Fail calculate live.
                    </span>
                  </div>
                ) : null}

                {form.styleId && distinctSizes.length === 0 ? (
                  <div className="alert alert-info" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div>
                      No pre-saved Measurement Specs found for this Style in master data.
                    </div>
                    <div className="btn-row">
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => addStandardPoints()}
                      >
                        <Plus size={14} aria-hidden="true" />
                        <span>Auto-Add Standard Points</span>
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => setCustomOpen(true)}
                      >
                        <Plus size={14} aria-hidden="true" />
                        <span>+ Custom Point</span>
                      </button>
                    </div>
                  </div>
                ) : null}

                {/* Image 4 Multi-Size Side-by-Side Matrix */}
                {matrixPoints.length === 0 ? (
                  <p className="muted" style={{ padding: '0.75rem', border: '1px dashed #cbd5e1', textAlign: 'center' }}>
                    Select an Order / Style above, then click <strong>Add Size / Piece</strong>, <strong>+ Standard Points</strong>, or <strong>Custom Point</strong> to generate the measurement sheet.
                  </p>
                ) : (
                  <div className="qf40-scroll">
                    <table className="ms-matrix-table" aria-label="Multi-size measurement matrix">
                      <thead>
                        <tr>
                          <th style={{ minWidth: 185, textAlign: 'left' }}>SIZE</th>
                          {matrixSizes.map((sz) => {
                            const sampleNums = samplesBySize[sz] || [1];
                            return (
                              <th key={sz} colSpan={1 + sampleNums.length}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 4 }}>
                                  <span>Size: {sz}</span>
                                  {!isLocked ? (
                                    <span style={{ display: 'inline-flex', gap: 3 }}>
                                      <button
                                        type="button"
                                        className="btn btn-secondary btn-sm"
                                        title={`Add another sample piece for size ${sz}`}
                                        style={{ minBlockSize: '20px', padding: '0 0.3rem', fontSize: '0.68rem' }}
                                        onClick={() => addSpecsForSize(sz)}
                                      >
                                        +Pc
                                      </button>
                                      <button
                                        type="button"
                                        className="btn btn-secondary btn-sm"
                                        title={`Remove size ${sz} column`}
                                        style={{ minBlockSize: '20px', padding: '0 0.3rem', fontSize: '0.68rem' }}
                                        onClick={() => removeSizeColumn(sz)}
                                      >
                                        ×
                                      </button>
                                    </span>
                                  ) : null}
                                </div>
                              </th>
                            );
                          })}
                        </tr>
                        <tr>
                          <th style={{ textAlign: 'left', fontSize: '0.7rem' }}>MEASUREMENT POINT (TOLERANCE)</th>
                          {matrixSizes.map((sz) => {
                            const sampleNums = samplesBySize[sz] || [1];
                            return (
                              <React.Fragment key={sz}>
                                <th style={{ width: 54 }}>SPEC</th>
                                {sampleNums.map((sn) => (
                                  <th key={`${sz}-${sn}`} style={{ minWidth: 84 }}>
                                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 3 }}>
                                      <span>DIFF #{sn}</span>
                                      {!isLocked && sampleNums.length > 1 ? (
                                        <button
                                          type="button"
                                          onClick={() => removeSampleColumn(sz, sn)}
                                          title={`Remove Piece #${sn} for ${sz}`}
                                          style={{ border: 0, background: 'transparent', cursor: 'pointer', color: '#64748b', fontWeight: 700, padding: 0 }}
                                        >
                                          ×
                                        </button>
                                      ) : null}
                                    </div>
                                  </th>
                                ))}
                              </React.Fragment>
                            );
                          })}
                        </tr>
                      </thead>
                      <tbody>
                        {matrixPoints.map((pt) => (
                          <tr key={pt.key}>
                            <td>
                              <strong>{pt.measurementPoint}</strong>{' '}
                              <span className="muted" style={{ fontSize: '0.7rem' }}>
                                ({pt.unit}, {pt.lowerTolerance}/+{pt.upperTolerance})
                              </span>
                              {pt.measurementDescription ? (
                                <div className="muted" style={{ fontSize: '0.68rem' }}>
                                  {pt.measurementDescription}
                                </div>
                              ) : null}
                            </td>
                            {matrixSizes.map((sz) => {
                              const sampleNums = samplesBySize[sz] || [1];
                              const specVal = pt.specsBySize.get(sz);
                              return (
                                <React.Fragment key={`${pt.key}-${sz}`}>
                                  <td className="ms-spec-cell">
                                    {specVal !== undefined ? specVal : '-'}
                                  </td>
                                  {sampleNums.map((sn) => {
                                    const cell = pt.cells.get(`${sz}__${sn}`);
                                    if (!cell) return <td key={`${sz}-${sn}`} className="ms-sample-cell">-</td>;
                                    const diffText = cell.diff > 0 ? `+${cell.diff}` : String(cell.diff);
                                    return (
                                      <td key={`${sz}-${sn}`} className="ms-sample-cell">
                                        <input
                                          type="number"
                                          step="any"
                                          disabled={isLocked}
                                          aria-label={`${pt.measurementPoint} ${sz} Piece #${sn} Actual`}
                                          value={cell.actualMeasurement}
                                          onChange={(e) =>
                                            updateRow(cell.rowIndex, { actualMeasurement: e.target.value })
                                          }
                                        />
                                        <span className={`ms-diff-pill ${cell.within ? 'pass' : 'fail'}`}>
                                          {diffText} {cell.within ? '✓' : '✕'}
                                        </span>
                                      </td>
                                    );
                                  })}
                                </React.Fragment>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Image 4 Footer: REMARKS (left) | SPECIAL COMMENTS (right) */}
                <table className="paper-kv-table" style={{ marginTop: '0.75rem', marginBottom: 0 }}>
                  <tbody>
                    <tr>
                      <td style={{ width: '58%', verticalAlign: 'top' }}>
                        <label htmlFor="ms-remarks" className="paper-kv-label" style={{ display: 'block', marginBottom: 4 }}>
                          REMARKS :
                        </label>
                        <textarea
                          id="ms-remarks"
                          rows={3}
                          disabled={isLocked}
                          value={form.remarks}
                          onChange={(e) => setForm({ ...form, remarks: e.target.value })}
                        />
                      </td>
                      <td style={{ width: '42%', verticalAlign: 'top' }}>
                        <label htmlFor="ms-special" className="paper-kv-label" style={{ display: 'block', marginBottom: 4 }}>
                          SPECIAL COMMENTS
                        </label>
                        <textarea
                          id="ms-special"
                          rows={3}
                          disabled={isLocked}
                          value={form.specialComments}
                          onChange={(e) => setForm({ ...form, specialComments: e.target.value })}
                        />
                      </td>
                    </tr>
                  </tbody>
                </table>

                <div className="field" style={{ marginTop: '0.65rem' }}>
                  <label>Supporting Photographs</label>
                  <PhotoUploader
                    moduleName="measurement"
                    inspectionId={activeRecord?._id || ''}
                    attachmentIds={form.attachmentIds}
                    disabled={isLocked}
                    onChange={(ids) => setForm({ ...form, attachmentIds: ids })}
                  />
                </div>

                {/* Image 4 Footer Signatures: Q.C. | IC.Q.A.D | SUPPLIER */}
                <div className="paper-sig-row">
                  <div className="paper-sig-cell">
                    <strong>Q.C.</strong>
                    <span className="muted">{activeRecord?.inspectorName || user?.fullName || '-'}</span>
                  </div>
                  <div className="paper-sig-cell">
                    <strong>IC.Q.A.D</strong>
                    <span className="muted">
                      {activeRecord?.workflowStages?.find((s) => s.status === 'Approved')?.actionByName || activeRecord?.approvalStatus || '-'}
                    </span>
                  </div>
                  <div className="paper-sig-cell">
                    <strong>SUPPLIER</strong>
                    <span className="muted">{h.supplierName || '-'}</span>
                  </div>
                </div>

                {error ? <div className="alert alert-error" style={{ marginTop: '0.65rem' }}>{error}</div> : null}
                {notice ? <div className="alert alert-success" style={{ marginTop: '0.65rem' }}>{notice}</div> : null}

                {!isLocked && (hasPerm('measurement', 'create') || hasPerm('measurement', 'edit')) ? (
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
                    {hasPerm('measurement', 'submit') ? (
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
                  endpointBase="/inspections/measurements"
                  moduleKey="measurement"
                  inspectionType="measurement"
                  record={activeRecord}
                  onUpdated={() => {
                    loadById(activeRecord._id);
                    loadList();
                  }}
                />
              ) : null}
            </>
          );
        })()
      ) : null}

      <PdfPreviewModal
        open={pdfOpen}
        onClose={() => setPdfOpen(false)}
        moduleSlug="measurements"
        reportId={activeRecord?._id}
        reportNumber={activeRecord?.reportNumber}
      />

      <QuickOrderModal
        open={quickOrderOpen}
        onClose={() => setQuickOrderOpen(false)}
        onCreated={async (created) => {
          const [oRes, sRes, bRes] = await Promise.all([
            api.get('/masters/orders?activeOnly=true&limit=200'),
            api.get('/masters/styles?activeOnly=true&limit=200'),
            api.get('/masters/buyers?activeOnly=true&limit=200'),
          ]).catch(() => [null, null, null]);
          setMasters((prev) => ({
            ...prev,
            orders: oRes?.data?.data || prev.orders,
            styles: sRes?.data?.data || prev.styles,
            buyers: bRes?.data?.data || prev.buyers,
          }));
          await handleOrderSelect(created._id);
        }}
      />

      <ModalDialog open={customOpen} onClose={() => setCustomOpen(false)} title="Add Custom Measurement Point">
        <form onSubmit={addCustomMeasurementRow}>
          <div className="grid-2">
            <div className="field">
              <label htmlFor="cm-size">Size *</label>
              <input
                id="cm-size"
                type="text"
                placeholder="e.g. M, L, XL"
                value={customPoint.size}
                onChange={(e) => setCustomPoint({ ...customPoint, size: e.target.value })}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="cm-unit">Unit</label>
              <select
                id="cm-unit"
                value={customPoint.unit}
                onChange={(e) => setCustomPoint({ ...customPoint, unit: e.target.value })}
              >
                <option value="cm">cm</option>
                <option value="inch">inch</option>
                <option value="mm">mm</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="cm-point">Measurement Point *</label>
              <input
                id="cm-point"
                type="text"
                placeholder="e.g. Chest Width"
                value={customPoint.measurementPoint}
                onChange={(e) => setCustomPoint({ ...customPoint, measurementPoint: e.target.value })}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="cm-spec">Approved Spec *</label>
              <input
                id="cm-spec"
                type="number"
                step="any"
                placeholder="e.g. 52"
                value={customPoint.approvedSpec}
                onChange={(e) => setCustomPoint({ ...customPoint, approvedSpec: e.target.value })}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="cm-ltol">Lower Tolerance</label>
              <input
                id="cm-ltol"
                type="number"
                step="any"
                value={customPoint.lowerTolerance}
                onChange={(e) => setCustomPoint({ ...customPoint, lowerTolerance: e.target.value })}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="cm-utol">Upper Tolerance</label>
              <input
                id="cm-utol"
                type="number"
                step="any"
                value={customPoint.upperTolerance}
                onChange={(e) => setCustomPoint({ ...customPoint, upperTolerance: e.target.value })}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="cm-pieces">Sample Pieces</label>
              <input
                id="cm-pieces"
                type="number"
                min={1}
                max={10}
                value={customPoint.pieces}
                onChange={(e) => setCustomPoint({ ...customPoint, pieces: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="cm-desc">Description (Optional)</label>
              <input
                id="cm-desc"
                type="text"
                value={customPoint.measurementDescription}
                onChange={(e) => setCustomPoint({ ...customPoint, measurementDescription: e.target.value })}
              />
            </div>
          </div>
          <div className="btn-row">
            <button type="submit" className="btn btn-primary btn-sm">Add to Measurement Sheet</button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setCustomOpen(false)}>Cancel</button>
          </div>
        </form>
      </ModalDialog>
    </div>
  );
}
