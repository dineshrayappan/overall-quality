import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Edit2,
  FileText,
  Plus,
  Save,
  Search,
  Sliders,
  X,
} from 'lucide-react';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import SearchableSelect from '../components/common/SearchableSelect.jsx';

export default function SpecificationPage() {
  const { user, hasPerm } = useAuth();
  const [specs, setSpecs] = useState([]);
  const [buyers, setBuyers] = useState([]);
  const [fabrics, setFabrics] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    title: '',
    buyerId: '',
    buyerName: '',
    fabricId: '',
    fabricName: '',
    styleNumber: '',
    shrinkage: { allowedRangeMin: -5, allowedRangeMax: 2, spiralityMaxPercent: 4 },
    gsmTolerance: { tolerancePercent: 5 },
    colourFastness: {
      changeInShadeMin: 4,
      stainingOnCottonMin: 3,
      crockingFabricWetMin: 3,
      crockingFabricDryMin: 4,
      crockingArtworkWetMin: 4,
      crockingArtworkDryMin: 4,
    },
    physicalTesting: { attachmentMinNewton: 70, burstingStrengthMinKpa: 250 },
    fourPoint: { rollPointsMax: 28, batchPointsMax: 20 },
    remarks: '',
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [specRes, buyerRes, fabricRes] = await Promise.all([
        api.get(`/specifications?search=${encodeURIComponent(search)}`),
        api.get('/masters/buyers?activeOnly=true&limit=200'),
        api.get('/masters/fabrics?activeOnly=true&limit=200'),
      ]);
      setSpecs(specRes.data?.data || []);
      setBuyers(buyerRes.data?.data || []);
      setFabrics(fabricRes.data?.data || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load specifications.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [search]);

  const handleOpenNew = () => {
    setEditingId(null);
    setForm({
      title: '',
      buyerId: buyers[0]?._id || '',
      buyerName: buyers[0]?.name || '',
      fabricId: '',
      fabricName: '',
      styleNumber: '',
      shrinkage: { allowedRangeMin: -5, allowedRangeMax: 2, spiralityMaxPercent: 4 },
      gsmTolerance: { tolerancePercent: 5 },
      colourFastness: {
        changeInShadeMin: 4,
        stainingOnCottonMin: 3,
        crockingFabricWetMin: 3,
        crockingFabricDryMin: 4,
        crockingArtworkWetMin: 4,
        crockingArtworkDryMin: 4,
      },
      physicalTesting: { attachmentMinNewton: 70, burstingStrengthMinKpa: 250 },
      fourPoint: { rollPointsMax: 28, batchPointsMax: 20 },
      remarks: '',
    });
    setModalOpen(true);
  };

  const handleOpenEdit = (spec) => {
    setEditingId(spec._id);
    setForm({
      title: spec.title || '',
      buyerId: spec.buyerId?._id || spec.buyerId || '',
      buyerName: spec.buyerName || spec.buyerId?.name || '',
      fabricId: spec.fabricId?._id || spec.fabricId || '',
      fabricName: spec.fabricName || spec.fabricId?.name || '',
      styleNumber: spec.styleNumber || '',
      shrinkage: spec.shrinkage || { allowedRangeMin: -5, allowedRangeMax: 2, spiralityMaxPercent: 4 },
      gsmTolerance: spec.gsmTolerance || { tolerancePercent: 5 },
      colourFastness: spec.colourFastness || {},
      physicalTesting: spec.physicalTesting || { attachmentMinNewton: 70, burstingStrengthMinKpa: 250 },
      fourPoint: spec.fourPoint || { rollPointsMax: 28, batchPointsMax: 20 },
      remarks: spec.remarks || '',
    });
    setModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.buyerId) {
      setError('Buyer is required.');
      return;
    }
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      if (editingId) {
        await api.patch(`/specifications/${editingId}`, form);
        setSuccess('Quality specification updated (version incremented)!');
      } else {
        await api.post('/specifications', form);
        setSuccess('New quality specification created successfully!');
      }
      setModalOpen(false);
      loadData();
    } catch (err) {
      setError(err.response?.data?.message || 'Error saving specification.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ padding: '0.5rem 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-color, #0f172a)', margin: 0 }}>
            Quality Specifications Master
          </h1>
          <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>
            Buyer-approved tolerances, shrinkage limits, 4-point penalty thresholds, and fastness criteria
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button type="button" className="btn btn-primary" onClick={handleOpenNew}>
            <Plus size={16} /> + New Specification
          </button>
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

      <div className="card">
        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <input
              type="text"
              placeholder="Search by Code, Title, Buyer..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: '100%', paddingLeft: '2rem' }}
            />
            <Search size={16} style={{ position: 'absolute', left: 10, top: 10, color: '#94a3b8' }} />
          </div>
        </div>

        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Title / Scope</th>
                <th>Buyer</th>
                <th>Shrinkage Allowed</th>
                <th>GSM Tolerance</th>
                <th>4-Point Roll / Batch</th>
                <th>Attachment Min</th>
                <th>Version</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '2rem' }}>
                    Loading specifications...
                  </td>
                </tr>
              ) : specs.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                    No quality specifications defined yet. Click "+ New Specification" to add one.
                  </td>
                </tr>
              ) : (
                specs.map((s) => (
                  <tr key={s._id}>
                    <td style={{ fontWeight: 700, color: '#1e3a5f' }}>{s.code}</td>
                    <td>
                      <strong>{s.title}</strong>
                      {s.styleNumber && <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>Style: {s.styleNumber}</span>}
                    </td>
                    <td>{s.buyerName || s.buyerId?.name || 'All Buyers'}</td>
                    <td>
                      <span className="tag tag-neutral" style={{ fontWeight: 700 }}>
                        +{s.shrinkage?.allowedRangeMax ?? 2}% to {s.shrinkage?.allowedRangeMin ?? -5}%
                      </span>
                    </td>
                    <td>±{s.gsmTolerance?.tolerancePercent ?? 5}%</td>
                    <td>
                      Roll: ≤{s.fourPoint?.rollPointsMax ?? 28} | Batch: ≤{s.fourPoint?.batchPointsMax ?? 20}
                    </td>
                    <td>≥{s.physicalTesting?.attachmentMinNewton ?? 70} N</td>
                    <td>
                      <span className="tag tag-neutral">v{s.version || 1}</span>
                    </td>
                    <td>
                      <button type="button" className="btn btn-sm btn-outline" onClick={() => handleOpenEdit(s)}>
                        <Edit2 size={14} /> Edit
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit/Create Modal */}
      {modalOpen && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: 680, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid #cbd5e1', paddingBottom: '0.5rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#1e3a5f' }}>
                {editingId ? `Edit Specification (${form.title})` : 'New Quality Specification'}
              </h3>
              <button type="button" className="btn btn-icon" onClick={() => setModalOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSave}>
              <div className="field">
                <label>Specification Title *</label>
                <input
                  type="text"
                  required
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g. M&S Standard Knitwear Spec 2026"
                />
              </div>

              <div className="grid-2">
                <div className="field">
                  <label>Buyer *</label>
                  <select
                    required
                    value={form.buyerId}
                    onChange={(e) => {
                      const bId = e.target.value;
                      const sel = buyers.find((b) => b._id === bId);
                      setForm({ ...form, buyerId: bId, buyerName: sel?.name || '' });
                    }}
                  >
                    <option value="">-- Select Buyer --</option>
                    {buyers.map((b) => (
                      <option key={b._id} value={b._id}>
                        {b.name} ({b.code})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>Applicable Fabric (Optional)</label>
                  <select
                    value={form.fabricId}
                    onChange={(e) => {
                      const fId = e.target.value;
                      const sel = fabrics.find((f) => f._id === fId);
                      setForm({ ...form, fabricId: fId, fabricName: sel?.name || '' });
                    }}
                  >
                    <option value="">-- All Fabrics (General) --</option>
                    {fabrics.map((f) => (
                      <option key={f._id} value={f._id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Shrinkage & GSM Section */}
              <div style={{ backgroundColor: '#f8fafc', padding: '0.75rem', borderRadius: 4, marginBottom: '0.75rem', border: '1px solid #e2e8f0' }}>
                <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: '#1e3a5f' }}>
                  Shrinkage (QF-29) & GSM Tolerances
                </h4>
                <div className="grid-3" style={{ gap: '0.5rem' }}>
                  <div className="field">
                    <label>Max Allowed Shrinkage (%)</label>
                    <input
                      type="number"
                      step="0.5"
                      value={form.shrinkage.allowedRangeMax ?? 2}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          shrinkage: { ...form.shrinkage, allowedRangeMax: Number(e.target.value) },
                        })
                      }
                    />
                  </div>
                  <div className="field">
                    <label>Min Allowed Growth (%)</label>
                    <input
                      type="number"
                      step="0.5"
                      value={form.shrinkage.allowedRangeMin ?? -5}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          shrinkage: { ...form.shrinkage, allowedRangeMin: Number(e.target.value) },
                        })
                      }
                    />
                  </div>
                  <div className="field">
                    <label>GSM Tolerance (±%)</label>
                    <input
                      type="number"
                      step="0.5"
                      value={form.gsmTolerance.tolerancePercent ?? 5}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          gsmTolerance: { tolerancePercent: Number(e.target.value) },
                        })
                      }
                    />
                  </div>
                </div>
              </div>

              {/* Four-Point Fabric Section */}
              <div style={{ backgroundColor: '#f8fafc', padding: '0.75rem', borderRadius: 4, marginBottom: '0.75rem', border: '1px solid #e2e8f0' }}>
                <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: '#1e3a5f' }}>
                  Fabric 4-Point Inspection Limits (QF-30)
                </h4>
                <div className="grid-2" style={{ gap: '0.5rem' }}>
                  <div className="field">
                    <label>Roll Max Points / 100 yd²</label>
                    <input
                      type="number"
                      value={form.fourPoint.rollPointsMax ?? 28}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          fourPoint: { ...form.fourPoint, rollPointsMax: Number(e.target.value) },
                        })
                      }
                    />
                  </div>
                  <div className="field">
                    <label>Batch Max Points / 100 yd²</label>
                    <input
                      type="number"
                      value={form.fourPoint.batchPointsMax ?? 20}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          fourPoint: { ...form.fourPoint, batchPointsMax: Number(e.target.value) },
                        })
                      }
                    />
                  </div>
                </div>
              </div>

              {/* Fastness & Physical Testing Section */}
              <div style={{ backgroundColor: '#f8fafc', padding: '0.75rem', borderRadius: 4, marginBottom: '0.75rem', border: '1px solid #e2e8f0' }}>
                <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: '#1e3a5f' }}>
                  Colour Fastness & Physical Requirements
                </h4>
                <div className="grid-3" style={{ gap: '0.5rem' }}>
                  <div className="field">
                    <label>Change in Shade (Min)</label>
                    <input
                      type="number"
                      step="0.5"
                      value={form.colourFastness.changeInShadeMin ?? 4}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          colourFastness: { ...form.colourFastness, changeInShadeMin: Number(e.target.value) },
                        })
                      }
                    />
                  </div>
                  <div className="field">
                    <label>Cotton Staining (Min)</label>
                    <input
                      type="number"
                      step="0.5"
                      value={form.colourFastness.stainingOnCottonMin ?? 3}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          colourFastness: { ...form.colourFastness, stainingOnCottonMin: Number(e.target.value) },
                        })
                      }
                    />
                  </div>
                  <div className="field">
                    <label>Attachment Min (N)</label>
                    <input
                      type="number"
                      value={form.physicalTesting.attachmentMinNewton ?? 70}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          physicalTesting: { ...form.physicalTesting, attachmentMinNewton: Number(e.target.value) },
                        })
                      }
                    />
                  </div>
                </div>
              </div>

              <div className="field">
                <label>Remarks / Version Notes</label>
                <textarea
                  rows={2}
                  value={form.remarks}
                  onChange={(e) => setForm({ ...form, remarks: e.target.value })}
                  placeholder="Reason for revision, test standard references..."
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
                <button type="button" className="btn btn-outline" onClick={() => setModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  <Save size={16} /> Save Specification
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

