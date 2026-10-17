'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  CheckCircle2,
  XCircle,
  Clock,
  Package,
  User,
  DollarSign,
  Calendar,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Send,
  ShieldCheck,
} from 'lucide-react';
import { Order, Product, computePartition } from '../hooks/useInventoryApi';

interface OrderDetailDrawerProps {
  order: Order | null;
  product?: Product;
  onClose: () => void;
}

export function OrderDetailDrawer({ order, product, onClose }: OrderDetailDrawerProps) {
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!order) return null;

  const isConfirmed = order.status === 'CONFIRMED';
  const isRejected = order.status === 'REJECTED';
  const isPending = order.status === 'PENDING';

  const { hash, partition } = computePartition(order.id);

  let statusBadgeClass = 'badge-warning';
  let StatusIcon = Clock;
  if (isConfirmed) {
    statusBadgeClass = 'badge-success';
    StatusIcon = CheckCircle2;
  } else if (isRejected) {
    statusBadgeClass = 'badge-danger';
    StatusIcon = XCircle;
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        display: 'flex',
        justifyContent: 'flex-end',
      }}
    >
      {/* Backdrop (Solid Opaque Dimmer, No Blur) */}
      <div
        onClick={onClose}
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: '#000000',
          opacity: 0.45,
        }}
      />

      {/* Drawer Container (100% Solid Opaque Surface) */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '480px',
          height: '100%',
          backgroundColor: 'var(--bg-surface)',
          borderLeft: '1px solid var(--border-default)',
          boxShadow: 'var(--shadow-lg)',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 10,
        }}
      >
        {/* Drawer Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid var(--border-default)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: 'var(--bg-surface)',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span className="font-mono" style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-main)' }}>
                Order #{order.id.slice(0, 8)}
              </span>
              <span className={`badge ${statusBadgeClass}`}>
                <StatusIcon size={12} />
                {order.status}
              </span>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
              Transaction ID: <span className="font-mono">{order.id}</span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="btn btn-ghost btn-sm"
            style={{ padding: '6px', color: 'var(--text-secondary)' }}
            title="Close drawer (Esc)"
          >
            <X size={18} />
          </button>
        </div>

        {/* Drawer Content Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px', backgroundColor: 'var(--bg-surface)' }}>
          {/* Rejection Alert if failed */}
          {isRejected && (
            <div
              style={{
                backgroundColor: 'var(--danger-subtle)',
                border: '1px solid var(--danger-border)',
                borderRadius: 'var(--radius-sm)',
                padding: '12px 16px',
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
              }}
            >
              <AlertTriangle size={16} color="var(--danger-text)" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <div style={{ fontWeight: 600, color: 'var(--danger-text)', fontSize: '13px' }}>
                  Fulfillment Rejected
                </div>
                <div style={{ fontSize: '12px', color: 'var(--danger-text)', marginTop: '2px' }}>
                  {order.rejection_reason || 'Insufficient warehouse stock available to fulfill this order.'}
                </div>
              </div>
            </div>
          )}

          {/* Key Summary Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '12px',
              marginBottom: '24px',
            }}
          >
            <div
              style={{
                padding: '14px',
                backgroundColor: 'var(--bg-subtle)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-sm)',
              }}
            >
              <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
                Customer
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, color: 'var(--text-main)' }}>
                <User size={14} color="var(--text-secondary)" />
                <span>{order.customer_id}</span>
              </div>
            </div>

            <div
              style={{
                padding: '14px',
                backgroundColor: 'var(--bg-subtle)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-sm)',
              }}
            >
              <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
                Total Amount
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, color: 'var(--text-main)' }}>
                <DollarSign size={14} color="var(--success-text)" />
                <span className="font-mono">${parseFloat(order.total_amount).toFixed(2)}</span>
              </div>
            </div>

            <div
              style={{
                padding: '14px',
                backgroundColor: 'var(--bg-subtle)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-sm)',
              }}
            >
              <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
                Product
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, color: 'var(--text-main)' }}>
                <Package size={14} color="var(--text-secondary)" />
                <span>{product ? product.name : order.product_id}</span>
              </div>
              <div className="font-mono" style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                Quantity: {order.quantity} units
              </div>
            </div>

            <div
              style={{
                padding: '14px',
                backgroundColor: 'var(--bg-subtle)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-sm)',
              }}
            >
              <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
                Placed Date
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-main)' }}>
                <Calendar size={14} color="var(--text-secondary)" />
                <span>{new Date(order.created_at).toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Fulfillment Lifecycle Timeline */}
          <div style={{ marginBottom: '28px' }}>
            <h3 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '14px' }}>
              Fulfillment Lifecycle
            </h3>

            <div style={{ position: 'relative', paddingLeft: '24px' }}>
              {/* Stepper Vertical Line */}
              <div
                style={{
                  position: 'absolute',
                  left: '7px',
                  top: '6px',
                  bottom: '12px',
                  width: '2px',
                  backgroundColor: 'var(--border-default)',
                }}
              />

              {/* Step 1: Order Submitted */}
              <div style={{ position: 'relative', marginBottom: '20px' }}>
                <div
                  style={{
                    position: 'absolute',
                    left: '-24px',
                    top: '2px',
                    width: '16px',
                    height: '16px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--success)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <CheckCircle2 size={12} color="#ffffff" />
                </div>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)' }}>Order Submitted</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    Received by Order Service and stored with status PENDING.
                  </div>
                </div>
              </div>

              {/* Step 2: Stock Check */}
              <div style={{ position: 'relative', marginBottom: '20px' }}>
                <div
                  style={{
                    position: 'absolute',
                    left: '-24px',
                    top: '2px',
                    width: '16px',
                    height: '16px',
                    borderRadius: '50%',
                    backgroundColor: isPending ? 'var(--warning)' : isRejected ? 'var(--danger)' : 'var(--success)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {isPending ? (
                    <Clock size={10} color="#ffffff" />
                  ) : isRejected ? (
                    <XCircle size={12} color="#ffffff" />
                  ) : (
                    <ShieldCheck size={12} color="#ffffff" />
                  )}
                </div>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)' }}>
                    {isRejected ? 'Stock Evaluation: Insufficient' : 'Stock Evaluation & Reservation'}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    {isPending
                      ? 'Inventory worker checking stock availability...'
                      : isRejected
                      ? 'Requested quantity exceeded warehouse stock.'
                      : `Successfully reserved ${order.quantity} units under row-lock.`}
                  </div>
                </div>
              </div>

              {/* Step 3: Order State Finalized */}
              <div style={{ position: 'relative', marginBottom: '20px' }}>
                <div
                  style={{
                    position: 'absolute',
                    left: '-24px',
                    top: '2px',
                    width: '16px',
                    height: '16px',
                    borderRadius: '50%',
                    backgroundColor: isPending ? 'var(--bg-highlight)' : isRejected ? 'var(--danger)' : 'var(--success)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {isConfirmed ? (
                    <CheckCircle2 size={12} color="#ffffff" />
                  ) : isRejected ? (
                    <XCircle size={12} color="#ffffff" />
                  ) : (
                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--text-muted)' }} />
                  )}
                </div>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)' }}>
                    Order {isPending ? 'Confirmation (Pending)' : order.status}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    {isConfirmed
                      ? 'Order confirmed. Stock permanently deducted.'
                      : isRejected
                      ? 'Order marked REJECTED. No stock deducted.'
                      : 'Awaiting event confirmation from Order Service.'}
                  </div>
                </div>
              </div>

              {/* Step 4: Notification Dispatched */}
              <div style={{ position: 'relative' }}>
                <div
                  style={{
                    position: 'absolute',
                    left: '-24px',
                    top: '2px',
                    width: '16px',
                    height: '16px',
                    borderRadius: '50%',
                    backgroundColor: isConfirmed ? 'var(--success)' : 'var(--bg-highlight)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {isConfirmed ? (
                    <Send size={10} color="#ffffff" />
                  ) : (
                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--text-muted)' }} />
                  )}
                </div>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)' }}>Customer Notification</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    {isConfirmed
                      ? 'Notification worker sent confirmation email & SMS.'
                      : isRejected
                      ? 'Rejection notification recorded.'
                      : 'Pending order resolution.'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Collapsible Technical Details */}
          <div
            style={{
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-sm)',
              overflow: 'hidden',
              backgroundColor: 'var(--bg-surface)',
            }}
          >
            <button
              onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
              style={{
                width: '100%',
                padding: '10px 14px',
                backgroundColor: 'var(--bg-subtle)',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                color: 'var(--text-secondary)',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <span>Event Pipeline Details</span>
              {showTechnicalDetails ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>

            {showTechnicalDetails && (
              <div style={{ padding: '12px 14px', fontSize: '12px', color: 'var(--text-secondary)', backgroundColor: 'var(--bg-surface)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '6px', marginBottom: '8px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Partition Key:</span>
                  <span className="font-mono" style={{ color: 'var(--text-main)' }}>{order.id}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '6px', marginBottom: '8px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Murmur2 Hash:</span>
                  <span className="font-mono" style={{ color: 'var(--text-main)' }}>0x{hash.toString(16).toUpperCase()}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '6px', marginBottom: '8px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Kafka Partition:</span>
                  <span className="font-mono" style={{ color: 'var(--primary)', fontWeight: 600 }}>
                    Partition {partition}
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '6px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Topic Flow:</span>
                  <span className="font-mono" style={{ fontSize: '11px', color: 'var(--text-main)' }}>
                    orders → inventory-events → order-events
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Drawer Footer Actions */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid var(--border-default)',
            display: 'flex',
            justifyContent: 'flex-end',
            backgroundColor: 'var(--bg-subtle)',
          }}
        >
          <button onClick={onClose} className="btn btn-secondary btn-sm">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
