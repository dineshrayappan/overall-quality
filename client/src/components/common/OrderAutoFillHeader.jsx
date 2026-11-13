import React, { useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import SearchableSelect from './SearchableSelect.jsx';
import { Edit2, ListFilter } from 'lucide-react';

export default function OrderAutoFillHeader({
  orderId,
  onOrderSelect,
  snapshot = {},
  onSnapshotChange,
  disabled = false,
  required = true,
  compact = false,
}) {
  const [orders, setOrders] = useState([]);
  const [loadingOrder, setLoadingOrder] = useState(false);
  const [manualMode, setManualMode] = useState(!orderId && Boolean(snapshot?.orderNumber));

  useEffect(() => {
    api
      .get('/masters/orders?activeOnly=true&limit=200')
      .then((res) => setOrders(res.data?.data || []))
      .catch(() => {});
  }, []);

  const handleSelect = async (newOrderId) => {
    if (!newOrderId) {
      onOrderSelect('', null);
      return;
    }
    setLoadingOrder(true);
    try {
      const res = await api.get(`/masters/orders/${newOrderId}/populated`);
      const auto = res.data?.data?.autoFilled || null;
      onOrderSelect(newOrderId, auto);
      if (auto && onSnapshotChange) {
        onSnapshotChange((prev) => ({
          ...prev,
          orderNumber: auto.orderNumber || prev.orderNumber || '',
          buyerName: auto.buyerName || prev.buyerName || '',
          styleNumber: auto.styleNumber || prev.styleNumber || '',
          fabricName: auto.fabricName || prev.fabricName || '',
          fabricDescription: auto.fabricName || prev.fabricDescription || '',
          supplierName: auto.supplierName || prev.supplierName || '',
          colourName: auto.colourName || prev.colourName || '',
          requiredGsm: auto.gsmValue || prev.requiredGsm || 180,
          orderQuantity: auto.orderQuantity || prev.orderQuantity || 0,
          description: auto.description || auto.styleDescription || prev.description || '',
          sizeRangeName: auto.sizeRangeName || prev.sizeRangeName || '',
        }));
      }
    } finally {
      setLoadingOrder(false);
    }
  };

  const handleFieldChange = (field, val) => {
    if (onSnapshotChange) {
      onSnapshotChange((prev) => ({ ...prev, [field]: val }));
    }
  };

  return (
    <div style={{ marginBottom: '1rem', border: '1px solid #cbd5e1', borderRadius: 6, padding: '0.75rem', background: '#f8fafc' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem' }}>
        <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1e3a5f', textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Order &amp; Header Information
        </div>
        {!disabled && (
          <button
            type="button"
            className="btn btn-sm btn-outline"
            style={{ fontSize: '0.75rem', padding: '0.15rem 0.5rem' }}
            onClick={() => {
              setManualMode(!manualMode);
            }}
          >
            {manualMode ? (
              <>
                <ListFilter size={13} style={{ marginRight: 4 }} /> Select from Master Orders
              </>
            ) : (
              <>
                <Edit2 size={13} style={{ marginRight: 4 }} /> Manual Order Entry / Edit
              </>
            )}
          </button>
        )}
      </div>

      {!manualMode ? (
        <div style={{ marginBottom: '0.65rem' }}>
          <SearchableSelect
            label={loadingOrder ? 'Select Order (Loading details...)' : 'Select Order from Master Data (Auto-populates fields)'}
            options={orders}
            value={orderId}
            disabled={disabled}
            required={required}
            placeholder="Search by order number, style, or buyer..."
            getOptionValue={(o) => o._id}
            getOptionLabel={(o) =>
              `${o.orderNumber}${o.styleId?.styleNumber ? ` — ${o.styleId.styleNumber}` : ''}${
                o.buyerId?.name ? ` (${o.buyerId.name})` : ''
              }`
            }
            getOptionSubLabel={(o) => `Qty: ${o.orderQuantity || '-'}`}
            onChange={handleSelect}
          />
        </div>
      ) : (
        <div className="grid-2" style={{ marginBottom: '0.65rem' }}>
          <div className="field" style={{ marginBlockEnd: 0 }}>
            <label>Order Number (OR. No.) *</label>
            <input
              type="text"
              disabled={disabled}
              value={snapshot.orderNumber || ''}
              onChange={(e) => handleFieldChange('orderNumber', e.target.value)}
              placeholder="e.g. OR-25550 or ORD-1001"
              required
            />
          </div>
          <div className="field" style={{ marginBlockEnd: 0 }}>
            <label>Customer / Buyer Name *</label>
            <input
              type="text"
              disabled={disabled}
              value={snapshot.buyerName || ''}
              onChange={(e) => handleFieldChange('buyerName', e.target.value)}
              placeholder="e.g. NEXT, M&S, H&M"
            />
          </div>
        </div>
      )}

      {/* Detail Fields (Always editable or filled) */}
      <div className="grid-4" style={{ gap: '0.6rem' }}>
        <div className="field" style={{ marginBlockEnd: 0 }}>
          <label>Style Number</label>
          <input
            type="text"
            disabled={disabled}
            value={snapshot.styleNumber || ''}
            onChange={(e) => handleFieldChange('styleNumber', e.target.value)}
            placeholder="e.g. ST-2024-TEE"
          />
        </div>

        <div className="field" style={{ marginBlockEnd: 0 }}>
          <label>Fabric / Description</label>
          <input
            type="text"
            disabled={disabled}
            value={snapshot.fabricName || snapshot.fabricDescription || ''}
            onChange={(e) => {
              handleFieldChange('fabricName', e.target.value);
              handleFieldChange('fabricDescription', e.target.value);
            }}
            placeholder="e.g. 100% Cotton Single Jersey"
          />
        </div>

        <div className="field" style={{ marginBlockEnd: 0 }}>
          <label>Supplier Name</label>
          <input
            type="text"
            disabled={disabled}
            value={snapshot.supplierName || ''}
            onChange={(e) => handleFieldChange('supplierName', e.target.value)}
            placeholder="e.g. Vardhman Textiles"
          />
        </div>

        <div className="field" style={{ marginBlockEnd: 0 }}>
          <label>Required GSM</label>
          <input
            type="number"
            disabled={disabled}
            value={snapshot.requiredGsm || 180}
            onChange={(e) => handleFieldChange('requiredGsm', Number(e.target.value || 0))}
            placeholder="180"
          />
        </div>

        {!compact && (
          <>
            <div className="field" style={{ marginBlockEnd: 0 }}>
              <label>Colour Name / Code</label>
              <input
                type="text"
                disabled={disabled}
                value={snapshot.colourName || ''}
                onChange={(e) => handleFieldChange('colourName', e.target.value)}
                placeholder="e.g. Navy Blue / PANTONE 19-4024"
              />
            </div>

            <div className="field" style={{ marginBlockEnd: 0 }}>
              <label>Order Qty (Pcs / Yds)</label>
              <input
                type="number"
                disabled={disabled}
                value={snapshot.orderQuantity ?? ''}
                onChange={(e) => handleFieldChange('orderQuantity', Number(e.target.value || 0))}
                placeholder="5000"
              />
            </div>

            <div className="field" style={{ marginBlockEnd: 0 }}>
              <label>Buyer Name</label>
              <input
                type="text"
                disabled={disabled}
                value={snapshot.buyerName || ''}
                onChange={(e) => handleFieldChange('buyerName', e.target.value)}
                placeholder="Buyer Name"
              />
            </div>

            <div className="field" style={{ marginBlockEnd: 0 }}>
              <label>Order Number</label>
              <input
                type="text"
                disabled={disabled}
                value={snapshot.orderNumber || ''}
                onChange={(e) => handleFieldChange('orderNumber', e.target.value)}
                placeholder="Order Number"
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
