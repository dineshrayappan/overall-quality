import React, { useEffect, useState } from 'react';
import { FileSpreadsheet } from 'lucide-react';
import { api, downloadProtectedFile, getErrorMessage } from '../api/client.js';

const REPORT_TYPES = [
  { key: 'combined', label: 'Combined Inspection Export', desc: 'All 4 modules in one unified spreadsheet.' },
  { key: 'daily', label: 'Daily Report', desc: 'Filtered daily inspection summary.' },
  { key: 'weekly', label: 'Weekly Report', desc: 'Weekly inspection records.' },
  { key: 'monthly', label: 'Monthly Report (Single Worksheet)', desc: 'All monthly records consolidated on a single worksheet.' },
  { key: 'line_wise', label: 'Production Line-Wise Report', desc: 'Line performance summary + detailed records.' },
  { key: 'buyer_wise', label: 'Buyer-Wise Report', desc: 'Buyer quality metrics + detailed records.' },
  { key: 'style_wise', label: 'Style-Wise Report', desc: 'Style quality metrics + detailed records.' },
  { key: 'defect_analysis', label: 'Defect Analysis Report', desc: 'Extracted Not OK items, Rework, Rejection, Oil & Out-of-Tolerance points.' },
];

export default function ExcelExportPage() {
  const [masters, setMasters] = useState({ buyers: [], styles: [], orders: [], lines: [] });
  const [filters, setFilters] = useState({
    dateFrom: '',
    dateTo: '',
    buyerId: '',
    styleId: '',
    orderId: '',
    productionLineId: '',
    inspectionStage: '',
    approvalStatus: '',
  });
  const [busyKey, setBusyKey] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      api.get('/masters/buyers?activeOnly=true&limit=200'),
      api.get('/masters/styles?activeOnly=true&limit=200'),
      api.get('/masters/orders?activeOnly=true&limit=200'),
      api.get('/masters/production-lines?activeOnly=true&limit=200'),
    ])
      .then(([b, s, o, l]) => {
        setMasters({
          buyers: b.data?.data || [],
          styles: s.data?.data || [],
          orders: o.data?.data || [],
          lines: l.data?.data || [],
        });
      })
      .catch(() => {});
  }, []);

  const handleDownload = async (reportType) => {
    setError('');
    setBusyKey(reportType);
    try {
      const qs = new URLSearchParams({ reportType });
      Object.entries(filters).forEach(([k, v]) => {
        if (v) qs.set(k, v);
      });
      await downloadProtectedFile(
        `/exports/excel?${qs.toString()}`,
        `qms-${reportType}-${new Date().toISOString().slice(0, 10)}.xlsx`
      );
    } catch (err) {
      setError(getErrorMessage(err, 'Excel download failed.'));
    } finally {
      setBusyKey('');
    }
  };

  return (
    <div>
      <section className="card">
        <div className="card-header">
          <div>
            <h1 className="card-title" style={{ fontSize: '1.15rem' }}>
              Automated Excel Export Center
            </h1>
            <span className="muted">
              Apply filters below; exported totals match the Dashboard and MongoDB records
            </span>
          </div>
        </div>

        <div className="grid-4">
          <div className="field">
            <label htmlFor="ex-from">Date From</label>
            <input
              id="ex-from"
              type="date"
              value={filters.dateFrom}
              onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
            />
          </div>
          <div className="field">
            <label htmlFor="ex-to">Date To</label>
            <input
              id="ex-to"
              type="date"
              value={filters.dateTo}
              onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
            />
          </div>
          <div className="field">
            <label htmlFor="ex-buyer">Buyer</label>
            <select
              id="ex-buyer"
              value={filters.buyerId}
              onChange={(e) => setFilters({ ...filters, buyerId: e.target.value })}
            >
              <option value="">All Buyers</option>
              {masters.buyers.map((b) => (
                <option key={b._id} value={b._id}>{b.name}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="ex-style">Style</label>
            <select
              id="ex-style"
              value={filters.styleId}
              onChange={(e) => setFilters({ ...filters, styleId: e.target.value })}
            >
              <option value="">All Styles</option>
              {masters.styles.map((s) => (
                <option key={s._id} value={s._id}>{s.styleNumber} — {s.name}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="ex-order">Order</label>
            <select
              id="ex-order"
              value={filters.orderId}
              onChange={(e) => setFilters({ ...filters, orderId: e.target.value })}
            >
              <option value="">All Orders</option>
              {masters.orders.map((o) => (
                <option key={o._id} value={o._id}>{o.orderNumber}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="ex-line">Production Line</label>
            <select
              id="ex-line"
              value={filters.productionLineId}
              onChange={(e) => setFilters({ ...filters, productionLineId: e.target.value })}
            >
              <option value="">All Lines</option>
              {masters.lines.map((l) => (
                <option key={l._id} value={l._id}>{l.name}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="ex-stage">Inspection Stage</label>
            <select
              id="ex-stage"
              value={filters.inspectionStage}
              onChange={(e) => setFilters({ ...filters, inspectionStage: e.target.value })}
            >
              <option value="">All Stages</option>
              <option value="Size Set">Size Set</option>
              <option value="Pilot Run">Pilot Run</option>
              <option value="In-line">In-line</option>
              <option value="Mid-line">Mid-line</option>
              <option value="Final">Final</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="ex-status">Approval Status</label>
            <select
              id="ex-status"
              value={filters.approvalStatus}
              onChange={(e) => setFilters({ ...filters, approvalStatus: e.target.value })}
            >
              <option value="">All Statuses</option>
              <option value="Draft">Draft</option>
              <option value="Pending Approval">Pending Approval</option>
              <option value="Approved">Approved</option>
              <option value="Rejected">Rejected</option>
              <option value="Returned for Correction">Returned for Correction</option>
            </select>
          </div>
        </div>
      </section>

      {error ? <div className="alert alert-error">{error}</div> : null}

      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
        {REPORT_TYPES.map((rt) => (
          <div className="card" key={rt.key} style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', marginBottom: 0 }}>
            <div>
              <h2 className="card-title">{rt.label}</h2>
              <p className="muted" style={{ marginTop: '0.4rem' }}>{rt.desc}</p>
            </div>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={busyKey === rt.key}
              onClick={() => handleDownload(rt.key)}
            >
              <FileSpreadsheet size={15} aria-hidden="true" />
              <span>{busyKey === rt.key ? 'Generating...' : 'Download .xlsx'}</span>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

