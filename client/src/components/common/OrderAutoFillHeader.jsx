import React, { useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import SearchableSelect from './SearchableSelect.jsx';

export default function OrderAutoFillHeader({
  orderId,
  onOrderSelect,
  snapshot = {},
  disabled = false,
  required = true,
  compact = false,
}) {
  const [orders, setOrders] = useState([]);
  const [loadingOrder, setLoadingOrder] = useState(false);

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
      onOrderSelect(newOrderId, res.data?.data?.autoFilled || null);
    } finally {
      setLoadingOrder(false);
    }
  };

  return (
    <div>
      <SearchableSelect
        label={loadingOrder ? 'Order Number (Loading details...)' : 'Order Number (Auto-fills master details)'}
        options={orders}
        value={orderId}
        disabled={disabled}
        required={required}
        placeholder="Search by order number..."
        getOptionValue={(o) => o._id}
        getOptionLabel={(o) =>
          `${o.orderNumber}${o.styleId?.styleNumber ? ` — ${o.styleId.styleNumber}` : ''}${
            o.buyerId?.name ? ` (${o.buyerId.name})` : ''
          }`
        }
        getOptionSubLabel={(o) => `Qty: ${o.orderQuantity}`}
        onChange={handleSelect}
      />

      {orderId ? (
        <div className="grid-4" style={{ marginBlockEnd: '0.75rem' }}>
          <div className="field" style={{ marginBlockEnd: 0 }}>
            <label>Buyer</label>
            <input type="text" readOnly value={snapshot.buyerName || '-'} />
          </div>
          <div className="field" style={{ marginBlockEnd: 0 }}>
            <label>Style Number</label>
            <input type="text" readOnly value={snapshot.styleNumber || '-'} />
          </div>
          <div className="field" style={{ marginBlockEnd: 0 }}>
            <label>Order Quantity</label>
            <input type="text" readOnly value={snapshot.orderQuantity ?? '-'} />
          </div>
          <div className="field" style={{ marginBlockEnd: 0 }}>
            <label>Fabric / GSM</label>
            <input
              type="text"
              readOnly
              value={`${snapshot.fabricName || '-'}${snapshot.gsmLabel ? ` / ${snapshot.gsmLabel}` : ''}`}
            />
          </div>
          {!compact ? (
            <>
              <div className="field" style={{ marginBlockEnd: 0 }}>
                <label>Style Description</label>
                <input
                  type="text"
                  readOnly
                  value={snapshot.description || snapshot.styleDescription || snapshot.styleName || '-'}
                />
              </div>
              <div className="field" style={{ marginBlockEnd: 0 }}>
                <label>Colour</label>
                <input type="text" readOnly value={snapshot.colourName || '-'} />
              </div>
              <div className="field" style={{ marginBlockEnd: 0 }}>
                <label>Supplier</label>
                <input type="text" readOnly value={snapshot.supplierName || '-'} />
              </div>
              <div className="field" style={{ marginBlockEnd: 0 }}>
                <label>Size Range</label>
                <input type="text" readOnly value={snapshot.sizeRangeName || '-'} />
              </div>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

