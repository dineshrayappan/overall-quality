import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Filter, RefreshCw } from 'lucide-react';
import { api, getErrorMessage } from '../api/client.js';
import StatusBadge from '../components/common/StatusBadge.jsx';

const PIE_COLORS = ['#15803d', '#b91c1c'];

export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [masters, setMasters] = useState({
    buyers: [],
    styles: [],
    orders: [],
    lines: [],
  });
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

  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([k, v]) => {
        if (v) params.set(k, v);
      });
      const res = await api.get(`/dashboard/analytics?${params.toString()}`);
      setData(res.data?.data || null);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load dashboard analytics.'));
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  const cards = data?.summaryCards || {};
  const charts = data?.charts || {};

  const routeForModule = (mod, id) => {
    if (mod === 'Target Chart') return `/inspections/target-charts/${id}`;
    if (mod === 'Size Set / In-line') return `/inspections/size-sets/${id}`;
    if (mod === '7 Point') return `/inspections/seven-points/${id}`;
    return `/inspections/measurements/${id}`;
  };

  return (
    <div>
      <section className="card">
        <div className="card-header">
          <div>
            <h1 className="card-title" style={{ fontSize: '1.15rem' }}>
              Quality Performance Dashboard
            </h1>
            <span className="muted">
              Live analytics computed directly from MongoDB inspection records
            </span>
          </div>
          <div className="btn-row">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() =>
                setFilters({
                  dateFrom: '',
                  dateTo: '',
                  buyerId: '',
                  styleId: '',
                  orderId: '',
                  productionLineId: '',
                  inspectionStage: '',
                  approvalStatus: '',
                })
              }
            >
              <Filter size={14} aria-hidden="true" />
              <span>Reset Filters</span>
            </button>
            <button type="button" className="btn btn-primary btn-sm" onClick={loadAnalytics}>
              <RefreshCw size={14} aria-hidden="true" />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        <div className="grid-4">
          <div className="field">
            <label htmlFor="dash-from">Date From</label>
            <input
              id="dash-from"
              type="date"
              value={filters.dateFrom}
              onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
            />
          </div>
          <div className="field">
            <label htmlFor="dash-to">Date To</label>
            <input
              id="dash-to"
              type="date"
              value={filters.dateTo}
              onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
            />
          </div>
          <div className="field">
            <label htmlFor="dash-buyer">Buyer</label>
            <select
              id="dash-buyer"
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
            <label htmlFor="dash-style">Style Number</label>
            <select
              id="dash-style"
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
            <label htmlFor="dash-order">Order Number</label>
            <select
              id="dash-order"
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
            <label htmlFor="dash-line">Production Line</label>
            <select
              id="dash-line"
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
            <label htmlFor="dash-stage">Inspection Stage</label>
            <select
              id="dash-stage"
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
            <label htmlFor="dash-status">Report Status</label>
            <select
              id="dash-status"
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

      <div className="kpi-grid">
        <div className="kpi-card">
          <span className="kpi-label">Total Inspections</span>
          <span className="kpi-value">{cards.totalInspections ?? 0}</span>
          <span className="kpi-sub">Across active scoped modules</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">Completed Inspections</span>
          <span className="kpi-value" style={{ color: 'var(--success)' }}>
            {cards.completedInspections ?? 0}
          </span>
          <span className="kpi-sub">Approved or Finalized</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">Pending Inspections</span>
          <span className="kpi-value" style={{ color: 'var(--info)' }}>
            {cards.pendingInspections ?? 0}
          </span>
          <span className="kpi-sub">Draft / Pending / Returned</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">Accepted Reports</span>
          <span className="kpi-value" style={{ color: 'var(--success)' }}>
            {cards.acceptedReports ?? 0}
          </span>
          <span className="kpi-sub">Passed &amp; accepted checks</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">Rework Reports</span>
          <span className="kpi-value" style={{ color: 'var(--warning)' }}>
            {cards.reworkReports ?? 0}
          </span>
          <span className="kpi-sub">Marked Rework or Returned</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">Hold Reports</span>
          <span className="kpi-value" style={{ color: 'var(--danger)' }}>
            {cards.holdReports ?? 0}
          </span>
          <span className="kpi-sub">Hold or Rejected</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">Rejection Percentage</span>
          <span className="kpi-value" style={{ color: 'var(--danger)' }}>
            {cards.rejectionPercentage ?? 0}%
          </span>
          <span className="kpi-sub">Rejected pieces / hold rate</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">Overall Quality Score</span>
          <span className="kpi-value" style={{ color: 'var(--primary)' }}>
            {cards.overallQualityScore ?? 0}%
          </span>
          <span className="kpi-sub">Composite average score</span>
        </div>
      </div>

      {loading && !data ? (
        <div className="card"><p className="muted">Loading dashboard analytics...</p></div>
      ) : (
        <>
          <div className="grid-2">
            <section className="card">
              <h2 className="card-title" style={{ marginBottom: '0.75rem' }}>
                1. Daily Inspection Trend
              </h2>
              <div style={{ width: '100%', height: 250 }}>
                <ResponsiveContainer>
                  <LineChart data={charts.dailyTrend || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" fontSize={12} />
                    <YAxis fontSize={12} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="count" name="Inspections" stroke="#1e3a5f" strokeWidth={2} />
                    <Line type="monotone" dataKey="qualityScore" name="Avg Score %" stroke="#15803d" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </section>

            <section className="card">
              <h2 className="card-title" style={{ marginBottom: '0.75rem' }}>
                2. Weekly Inspection Trend
              </h2>
              <div style={{ width: '100%', height: 250 }}>
                <ResponsiveContainer>
                  <BarChart data={charts.weeklyTrend || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" fontSize={12} />
                    <YAxis fontSize={12} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="count" name="Inspections" fill="#1e3a5f" />
                    <Bar dataKey="qualityScore" name="Avg Score %" fill="#0284c7" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>

            <section className="card">
              <h2 className="card-title" style={{ marginBottom: '0.75rem' }}>
                3. Monthly Inspection Trend
              </h2>
              <div style={{ width: '100%', height: 250 }}>
                <ResponsiveContainer>
                  <BarChart data={charts.monthlyTrend || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" fontSize={12} />
                    <YAxis fontSize={12} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="count" name="Inspections" fill="#1d4ed8" />
                    <Bar dataKey="qualityScore" name="Avg Score %" fill="#15803d" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>

            <section className="card">
              <h2 className="card-title" style={{ marginBottom: '0.75rem' }}>
                4. Production Line-Wise Quality Performance
              </h2>
              <div style={{ width: '100%', height: 250 }}>
                <ResponsiveContainer>
                  <BarChart data={charts.linePerformance || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" fontSize={12} />
                    <YAxis fontSize={12} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="qualityScore" name="Avg Quality %" fill="#15803d" />
                    <Bar dataKey="count" name="Report Count" fill="#1e3a5f" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>

            <section className="card">
              <h2 className="card-title" style={{ marginBottom: '0.75rem' }}>
                5. Defect Category Analysis
              </h2>
              <div style={{ width: '100%', height: 250 }}>
                <ResponsiveContainer>
                  <BarChart data={charts.defectCategoryAnalysis || []} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" fontSize={12} />
                    <YAxis dataKey="category" type="category" width={150} fontSize={11} />
                    <Tooltip />
                    <Bar dataKey="count" name="Defect Count" fill="#b91c1c" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>

            <section className="card">
              <h2 className="card-title" style={{ marginBottom: '0.75rem' }}>
                6. OK vs Not OK Comparison ({charts.okVsNotOkSummary?.okRate ?? 0}% OK Rate)
              </h2>
              <div style={{ width: '100%', height: 250 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={charts.okVsNotOk || []}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={82}
                      label
                    >
                      {(charts.okVsNotOk || []).map((_, idx) => (
                        <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </section>

            <section className="card">
              <h2 className="card-title" style={{ marginBottom: '0.75rem' }}>
                7. Rework &amp; Rejection Analysis (%)
              </h2>
              <div style={{ width: '100%', height: 250 }}>
                <ResponsiveContainer>
                  <LineChart data={charts.reworkAndRejectionAnalysis || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" fontSize={12} />
                    <YAxis fontSize={12} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="reworkPercentage" name="Rework %" stroke="#d97706" strokeWidth={2} />
                    <Line type="monotone" dataKey="rejectionPercentage" name="Rejection %" stroke="#b91c1c" strokeWidth={2} />
                    <Line type="monotone" dataKey="oilPercentage" name="Oil %" stroke="#475569" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </section>

            <section className="card">
              <h2 className="card-title" style={{ marginBottom: '0.75rem' }}>
                8. Inspection Stage-Wise Comparison
              </h2>
              <div style={{ width: '100%', height: 250 }}>
                <ResponsiveContainer>
                  <BarChart data={charts.stageComparison || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" fontSize={12} />
                    <YAxis fontSize={12} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="qualityScore" name="Quality %" fill="#0284c7" />
                    <Bar dataKey="count" name="Reports" fill="#64748b" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>
          </div>

          <section className="card">
            <h2 className="card-title" style={{ marginBottom: '0.75rem' }}>
              9. Employee / Process-Wise Defect Analysis (7 Point Production)
            </h2>
            {(charts.employeeProcessAnalysis || []).length === 0 ? (
              <p className="muted">No 7 Point production entries match the active filters yet.</p>
            ) : (
              <div className="table-wrapper" tabIndex={0} role="region" aria-label="Dashboard breakdown table">
                <table className="qms-table responsive-stack">
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>Code</th>
                      <th>Process</th>
                      <th>Pieces Checked</th>
                      <th>OK</th>
                      <th>Rework</th>
                      <th>Rejected</th>
                      <th>Oil</th>
                      <th>Defect Rate %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(charts.employeeProcessAnalysis || []).map((row) => (
                      <tr key={row.label}>
                        <td data-label="Employee"><strong>{row.employeeName}</strong></td>
                        <td data-label="Code">{row.employeeCode}</td>
                        <td data-label="Process">{row.processName}</td>
                        <td data-label="Pieces Checked">{row.piecesChecked}</td>
                        <td data-label="OK">{row.okPieces}</td>
                        <td data-label="Rework">{row.reworkPieces}</td>
                        <td data-label="Rejected">{row.rejectedPieces}</td>
                        <td data-label="Oil">{row.oilDefects}</td>
                        <td data-label="Defect Rate %">
                          <span className={`badge ${row.defectRate > 5 ? 'badge-danger' : 'badge-success'}`}>
                            {row.defectRate}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="card">
            <h2 className="card-title" style={{ marginBottom: '0.75rem' }}>
              Recent Inspection Activity
            </h2>
            {(data?.recentInspections || []).length === 0 ? (
              <p className="muted">No inspections recorded yet. Start by adding Master Data and creating a report.</p>
            ) : (
              <div className="table-wrapper" tabIndex={0} role="region" aria-label="Dashboard breakdown table">
                <table className="qms-table responsive-stack">
                  <thead>
                    <tr>
                      <th>Report #</th>
                      <th>Module</th>
                      <th>Stage</th>
                      <th>Date</th>
                      <th>Line</th>
                      <th>Inspector</th>
                      <th>Score %</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recentInspections.map((item) => (
                      <tr key={item.id}>
                        <td data-label="Report #"><strong>{item.reportNumber}</strong></td>
                        <td data-label="Module">{item.module}</td>
                        <td data-label="Stage">{item.stage}</td>
                        <td data-label="Date">{new Date(item.date).toISOString().slice(0, 10)}</td>
                        <td data-label="Line">{item.lineName}</td>
                        <td data-label="Inspector">{item.inspectorName}</td>
                        <td data-label="Score %">{item.qualityScore}%</td>
                        <td data-label="Status"><StatusBadge value={item.approvalStatus} /></td>
                        <td data-label="Action">
                          <Link className="btn btn-secondary btn-sm" to={routeForModule(item.module, item.id)}>
                            Open
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
