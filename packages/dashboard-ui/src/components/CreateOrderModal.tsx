'use client';

import React, { useState, useEffect } from 'react';
import { X, Boxes, AlertCircle, Minus, Plus } from 'lucide-react';
import { Product } from '../hooks/useInventoryApi';

interface CreateOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  initialProduct?: Product | null;
  onSubmit: (data: { customerId: string; productId: string; quantity: number }) => Promise<void>;
  isSubmitting: boolean;
}

const PRESET_CUSTOMERS = [
  'cust_enterprise_01',
  'cust_retail_04',
  'cust_wholesale_09',
  'cust_acme_corp',
  'cust_individual_42',
];

export function CreateOrderModal({
  isOpen,
  onClose,
  products,
  initialProduct,
  onSubmit,
  isSubmitting,
}: CreateOrderModalProps) {
  const [customerId, setCustomerId] = useState(PRESET_CUSTOMERS[0]);
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState<string | null>(null);

  // Sync initial product if provided
  useEffect(() => {
    if (initialProduct) {
      setProductId(initialProduct.id);
    } else if (products.length > 0 && !productId) {
      setProductId(products[0].id);
    }
  }, [initialProduct, products, productId]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const selectedProduct = products.find((p) => p.id === productId);
  const unitPrice = selectedProduct ? parseFloat(selectedProduct.price) : 0;
  const availableStock = selectedProduct
    ? Math.max(0, selectedProduct.stock_quantity - selectedProduct.reserved_quantity)
    : 0;
  const totalAmount = (unitPrice * quantity).toFixed(2);
  const isOutOfStock = availableStock === 0;
  const isExceedingStock = quantity > availableStock;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productId) {
      setError('Please select a SKU product.');
      return;
    }
    if (quantity <= 0) {
      setError('Quantity must be at least 1.');
      return;
    }

    try {
      setError(null);
      await onSubmit({ customerId, productId, quantity });
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to submit dispatch order.');
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: 'rgba(23, 23, 23, 0.4)',
        }}
      />

      {/* Modal Dialog */}
      <div
        className="card"
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '480px',
          backgroundColor: '#ffffff',
          border: '1px solid var(--border-default)',
          boxShadow: 'var(--shadow-lg)',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
          zIndex: 10,
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-default)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#ffffff',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '30px',
                height: '30px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--primary)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Boxes size={16} />
            </div>
            <div>
              <h2 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-main)' }}>Create Dispatch Order</h2>
              <p style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                Ingests OrderCreated event into orders Kafka topic
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="btn btn-ghost btn-sm"
            style={{ padding: '6px', color: 'var(--text-secondary)' }}
          >
            <X size={15} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit}>
          <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', backgroundColor: '#ffffff' }}>
            {error && (
              <div
                style={{
                  backgroundColor: 'var(--danger-subtle)',
                  border: '1px solid var(--danger-border)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '9px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '12px',
                  color: 'var(--danger-text)',
                }}
              >
                <AlertCircle size={14} />
                <span>{error}</span>
              </div>
            )}

            {/* Customer Select */}
            <div>
              <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '5px' }}>
                Customer Account
              </label>
              <select
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                className="form-select font-mono"
              >
                {PRESET_CUSTOMERS.map((cust) => (
                  <option key={cust} value={cust}>
                    {cust}
                  </option>
                ))}
              </select>
            </div>

            {/* Product Select */}
            <div>
              <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '5px' }}>
                Warehouse SKU
              </label>
              <select
                value={productId}
                onChange={(e) => {
                  setProductId(e.target.value);
                  setQuantity(1);
                }}
                className="form-select"
              >
                {products.map((p) => {
                  const avail = Math.max(0, p.stock_quantity - p.reserved_quantity);
                  return (
                    <option key={p.id} value={p.id}>
                      {p.name} (${parseFloat(p.price).toFixed(2)}) — {avail} available
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Quantity Stepper */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-main)' }}>
                  Order Quantity
                </label>
                <span className="font-mono" style={{ fontSize: '11px', color: availableStock > 0 ? 'var(--text-muted)' : 'var(--danger-text)' }}>
                  Available in stock: <strong>{availableStock} units</strong>
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  className="btn btn-secondary"
                  style={{ width: '34px', height: '34px', padding: 0 }}
                  disabled={quantity <= 1}
                >
                  <Minus size={13} />
                </button>
                <input
                  type="number"
                  min="1"
                  max="999"
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  className="form-input font-mono"
                  style={{ textAlign: 'center', fontWeight: 700, height: '34px' }}
                />
                <button
                  type="button"
                  onClick={() => setQuantity((q) => q + 1)}
                  className="btn btn-secondary"
                  style={{ width: '34px', height: '34px', padding: 0 }}
                >
                  <Plus size={13} />
                </button>
              </div>

              {isExceedingStock && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', fontSize: '11px', color: 'var(--warning-text)' }}>
                  <AlertCircle size={12} />
                  <span>
                    Warning: Requested quantity ({quantity}) exceeds available stock ({availableStock}). This order will be rejected.
                  </span>
                </div>
              )}
            </div>

            {/* Price & Summary Box */}
            <div
              style={{
                backgroundColor: 'var(--bg-subtle)',
                borderRadius: 'var(--radius-sm)',
                padding: '12px 14px',
                border: '1px solid var(--border-default)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', color: 'var(--text-secondary)', marginBottom: '5px' }}>
                <span>Unit Price</span>
                <span className="font-mono">${unitPrice.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', color: 'var(--text-secondary)', marginBottom: '7px' }}>
                <span>Quantity</span>
                <span className="font-mono">× {quantity}</span>
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '13.5px',
                  fontWeight: 700,
                  color: 'var(--text-main)',
                  paddingTop: '7px',
                  borderTop: '1px solid var(--border-default)',
                }}
              >
                <span>Estimated Total</span>
                <span className="font-mono" style={{ color: 'var(--emerald)' }}>
                  ${totalAmount}
                </span>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div
            style={{
              padding: '14px 20px',
              borderTop: '1px solid var(--border-default)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '10px',
              backgroundColor: 'var(--bg-subtle)',
            }}
          >
            <button type="button" onClick={onClose} className="btn btn-ghost btn-sm" disabled={isSubmitting}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary btn-sm"
              disabled={isSubmitting || !productId}
              style={{ minWidth: '120px' }}
            >
              {isSubmitting ? 'Placing Order...' : 'Dispatch Order'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
