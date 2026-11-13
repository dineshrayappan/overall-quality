import React, { useState } from 'react';
import ModalDialog from './ModalDialog.jsx';
import { api, getErrorMessage } from '../../api/client.js';

async function findOrCreateByName(endpoint, items = [], matchFn, payload) {
  const existing = items.find(matchFn);
  if (existing) return existing;
  const res = await api.post(endpoint, payload);
  return res.data?.data;
}

export function QuickLineModal({ open, onClose, onCreated }) {
  const [name, setName] = useState('');
  const [floor, setFloor] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Production Line name is required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const res = await api.post('/masters/production-lines', {
        name: name.trim(),
        floor: floor.trim(),
      });
      const created = res.data?.data;
      setName('');
      setFloor('');
      onCreated?.(created);
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalDialog open={open} onClose={onClose} title="Quick Add Production Line" size="sm">
      <form onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="ql-name">Production Line Name *</label>
          <input
            id="ql-name"
            type="text"
            placeholder="e.g. Production Line - 4"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="ql-floor">Floor (Optional)</label>
          <input
            id="ql-floor"
            type="text"
            placeholder="e.g. Floor 1"
            value={floor}
            onChange={(e) => setFloor(e.target.value)}
          />
        </div>
        {error ? <div className="alert alert-error">{error}</div> : null}
        <div className="btn-row">
          <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
            {saving ? 'Saving...' : 'Create & Select'}
          </button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </ModalDialog>
  );
}

export function QuickOrderModal({ open, onClose, onCreated }) {
  const [form, setForm] = useState({
    orderNumber: '',
    buyerName: '',
    styleNumber: '',
    styleDescription: '',
    orderQuantity: 1000,
    fabricName: '',
    gsmValue: '',
    colourName: '',
    supplierName: '',
    sizeRangeName: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.orderNumber.trim() || !form.buyerName.trim() || !form.styleNumber.trim()) {
      setError('Order No., Buyer, and Style No. are required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const [buyersRes, stylesRes, fabricsRes, gsmsRes, coloursRes, suppliersRes, sizesRes] =
        await Promise.all([
          api.get('/masters/buyers?limit=200'),
          api.get('/masters/styles?limit=200'),
          api.get('/masters/fabrics?limit=200'),
          api.get('/masters/gsms?limit=200'),
          api.get('/masters/colours?limit=200'),
          api.get('/masters/suppliers?limit=200'),
          api.get('/masters/size-ranges?limit=200'),
        ]);

      const buyer = await findOrCreateByName(
        '/masters/buyers',
        buyersRes.data?.data || [],
        (b) => b.name.toLowerCase() === form.buyerName.trim().toLowerCase(),
        { name: form.buyerName.trim() }
      );

      const style = await findOrCreateByName(
        '/masters/styles',
        stylesRes.data?.data || [],
        (s) => s.styleNumber.toLowerCase() === form.styleNumber.trim().toLowerCase(),
        {
          styleNumber: form.styleNumber.trim(),
          name: form.styleDescription.trim() || form.styleNumber.trim(),
          description: form.styleDescription.trim(),
          buyerId: buyer._id,
        }
      );

      const fabric = form.fabricName.trim()
        ? await findOrCreateByName(
            '/masters/fabrics',
            fabricsRes.data?.data || [],
            (f) => f.name.toLowerCase() === form.fabricName.trim().toLowerCase(),
            { name: form.fabricName.trim() }
          )
        : null;

      const gsmNum = Number(form.gsmValue);
      const gsm =
        form.gsmValue && Number.isFinite(gsmNum) && gsmNum > 0
          ? await findOrCreateByName(
              '/masters/gsms',
              gsmsRes.data?.data || [],
              (g) => Number(g.value) === gsmNum,
              { value: gsmNum, name: `${gsmNum} GSM` }
            )
          : null;

      const colour = form.colourName.trim()
        ? await findOrCreateByName(
            '/masters/colours',
            coloursRes.data?.data || [],
            (c) => c.name.toLowerCase() === form.colourName.trim().toLowerCase(),
            { name: form.colourName.trim() }
          )
        : null;

      const supplier = form.supplierName.trim()
        ? await findOrCreateByName(
            '/masters/suppliers',
            suppliersRes.data?.data || [],
            (s) => s.name.toLowerCase() === form.supplierName.trim().toLowerCase(),
            { name: form.supplierName.trim() }
          )
        : null;

      const sizeRange = form.sizeRangeName.trim()
        ? await findOrCreateByName(
            '/masters/size-ranges',
            sizesRes.data?.data || [],
            (sr) => sr.name.toLowerCase() === form.sizeRangeName.trim().toLowerCase(),
            {
              name: form.sizeRangeName.trim(),
              sizes: form.sizeRangeName
                .split(/[,/]/)
                .map((x) => x.trim())
                .filter(Boolean),
            }
          )
        : null;

      const orderRes = await api.post('/masters/orders', {
        orderNumber: form.orderNumber.trim(),
        buyerId: buyer._id,
        styleId: style._id,
        styleDescription: form.styleDescription.trim(),
        orderQuantity: Number(form.orderQuantity || 1),
        fabricId: fabric?._id || null,
        gsmId: gsm?._id || null,
        colourId: colour?._id || null,
        supplierId: supplier?._id || null,
        sizeRangeId: sizeRange?._id || null,
        status: 'In Production',
      });

      const created = orderRes.data?.data;
      setForm({
        orderNumber: '',
        buyerName: '',
        styleNumber: '',
        styleDescription: '',
        orderQuantity: 1000,
        fabricName: '',
        gsmValue: '',
        colourName: '',
        supplierName: '',
        sizeRangeName: '',
      });
      onCreated?.(created);
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalDialog open={open} onClose={onClose} title="Quick Add Order & Style Details">
      <form onSubmit={handleSubmit}>
        <div className="grid-2">
          <div className="field">
            <label htmlFor="qo-order">Order No. *</label>
            <input
              id="qo-order"
              type="text"
              placeholder="e.g. PO-2026-001"
              value={form.orderNumber}
              onChange={(e) => setForm({ ...form, orderNumber: e.target.value })}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="qo-buyer">Buyer *</label>
            <input
              id="qo-buyer"
              type="text"
              placeholder="e.g. H&M / Zara"
              value={form.buyerName}
              onChange={(e) => setForm({ ...form, buyerName: e.target.value })}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="qo-style">Style No. *</label>
            <input
              id="qo-style"
              type="text"
              placeholder="e.g. ST-104"
              value={form.styleNumber}
              onChange={(e) => setForm({ ...form, styleNumber: e.target.value })}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="qo-qty">Order Qty</label>
            <input
              id="qo-qty"
              type="number"
              min="1"
              value={form.orderQuantity}
              onChange={(e) => setForm({ ...form, orderQuantity: e.target.value })}
            />
          </div>
          <div className="field">
            <label htmlFor="qo-desc">Description</label>
            <input
              id="qo-desc"
              type="text"
              placeholder="e.g. Mens Polo Shirt"
              value={form.styleDescription}
              onChange={(e) => setForm({ ...form, styleDescription: e.target.value })}
            />
          </div>
          <div className="field">
            <label htmlFor="qo-fabric">Fabric</label>
            <input
              id="qo-fabric"
              type="text"
              placeholder="e.g. 100% Cotton Pique"
              value={form.fabricName}
              onChange={(e) => setForm({ ...form, fabricName: e.target.value })}
            />
          </div>
          <div className="field">
            <label htmlFor="qo-gsm">GSM</label>
            <input
              id="qo-gsm"
              type="number"
              min="1"
              placeholder="e.g. 220"
              value={form.gsmValue}
              onChange={(e) => setForm({ ...form, gsmValue: e.target.value })}
            />
          </div>
          <div className="field">
            <label htmlFor="qo-colour">Colour</label>
            <input
              id="qo-colour"
              type="text"
              placeholder="e.g. Navy Blue"
              value={form.colourName}
              onChange={(e) => setForm({ ...form, colourName: e.target.value })}
            />
          </div>
          <div className="field">
            <label htmlFor="qo-supplier">Supplier</label>
            <input
              id="qo-supplier"
              type="text"
              placeholder="e.g. Esstee Exports"
              value={form.supplierName}
              onChange={(e) => setForm({ ...form, supplierName: e.target.value })}
            />
          </div>
          <div className="field">
            <label htmlFor="qo-size">Size Range</label>
            <input
              id="qo-size"
              type="text"
              placeholder="e.g. S, M, L, XL"
              value={form.sizeRangeName}
              onChange={(e) => setForm({ ...form, sizeRangeName: e.target.value })}
            />
          </div>
        </div>
        {error ? <div className="alert alert-error">{error}</div> : null}
        <div className="btn-row">
          <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
            {saving ? 'Creating...' : 'Create Order & Auto-Fill'}
          </button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </ModalDialog>
  );
}

export function QuickSimpleMasterModal({ open, onClose, type, onCreated }) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const configMap = {
    employee: { title: 'Quick Add Employee / Operator', endpoint: '/masters/employees', codeLabel: 'Employee ID No. *', nameLabel: 'Employee Name *' },
    process: { title: 'Quick Add Process', endpoint: '/masters/processes', codeLabel: null, nameLabel: 'Process Name *' },
    machine: { title: 'Quick Add Machine', endpoint: '/masters/machines', codeLabel: 'Machine No. *', nameLabel: 'Machine Name *' },
    needle: { title: 'Quick Add Needle', endpoint: '/masters/needles', codeLabel: 'Needle No. *', nameLabel: 'Needle Name' },
  };
  const cfg = configMap[type] || configMap.process;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() && type !== 'needle') {
      setError(`${cfg.nameLabel} is required.`);
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payload =
        type === 'employee'
          ? { employeeCode: code.trim(), name: name.trim() }
          : type === 'machine'
            ? { machineNumber: code.trim(), name: name.trim() }
            : type === 'needle'
              ? { needleNumber: code.trim(), name: name.trim() || code.trim() }
              : { name: name.trim() };
      const res = await api.post(cfg.endpoint, payload);
      setCode('');
      setName('');
      onCreated?.(res.data?.data);
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalDialog open={open} onClose={onClose} title={cfg.title} size="sm">
      <form onSubmit={handleSubmit}>
        {cfg.codeLabel ? (
          <div className="field">
            <label htmlFor="qm-code">{cfg.codeLabel}</label>
            <input
              id="qm-code"
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
            />
          </div>
        ) : null}
        <div className="field">
          <label htmlFor="qm-name">{cfg.nameLabel}</label>
          <input
            id="qm-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required={type !== 'needle'}
          />
        </div>
        {error ? <div className="alert alert-error">{error}</div> : null}
        <div className="btn-row">
          <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
            {saving ? 'Saving...' : 'Create'}
          </button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </ModalDialog>
  );
}

