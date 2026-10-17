'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  CheckCircle2,
  XCircle,
  Clock,
  Boxes,
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
      {/* Backdrop (TrackOpenSource style) */}
      <div
        onClick={onClose}
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: 'rgba(23, 23, 23, 0.3)',
        }}
      />

      {/* Slide-out panel (RepoSideSheet style) */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '520px',
          height: '100%',
          backgroundColor: '#ffffff',
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
            padding: '18px 24px',
            borderBottom: '1px solid var(--border-default)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#ffffff',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-main)' }}>
                Order #{order.id.slice(0, 8)}
              </span>
              <span className={`badge ${statusBadgeClass}`}>
                <StatusIcon size={11} />
                {order.status}
              </span>
            </div>
            <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
              Kafka Aggregate ID: <span className="font-mono">{order.id}</span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="btn btn-ghost btn-sm"
            style={{ padding: '6px', color: 'var(--text-secondary)' }}
            title="Close drawer (Esc)"
          >
            <X size={16} />
          </button>
        </div>

        {/* Drawer Content Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px', backgroundColor: '#ffffff' }}>
          {/* Rejection Alert if failed */}
          {isRejected && (
            <div
              style={{
                backgroundColor: 'var(--danger-subtle)',
                border: '1px solid var(--danger-border)',
                borderRadius: 'var(--radius-sm)',
                padding: '12px 14px',
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
              }}
            >
              <AlertTriangle size={15} color="var(--danger-text)" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <div style={{ fontWeight: 600, color: 'var(--danger-text)', fontSize: '12.5px' }}>
                  Fulfillment Rejected
                </div>
                <div style={{ fontSize: '11.5px', color: 'var(--danger-text)', marginTop: '2px' }}>
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
              gap: '10px',
              marginBottom: '24px',
            }}
          >
            <div
              style={{
                padding: '12px',
                backgroundColor: 'var(--bg-subtle)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-sm)',
              }}
            >
              <div style={{ fontSize: '10.5px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '3px' }}>
                Customer Account
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, color: 'var(--text-main)', fontSize: '13px' }}>
                <User size={13} color="var(--text-secondary)" />
                <span>{order.customer_id}</span>
              </div>
            </div>

            <div
              style={{
                padding: '12px',
                backgroundColor: 'var(--bg-subtle)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-sm)',
              }}
            >
              <div style={{ fontSize: '10.5px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '3px' }}>
                Total Amount
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 700, color: 'var(--text-main)', fontSize: '13px' }}>
                <DollarSign size={13} color="var(--emerald)" />
                <span className="font-mono">${parseFloat(order.total_amount).toFixed(2)}</span>
              </div>
            </div>

            <div
              style={{
                padding: '12px',
                backgroundColor: 'var(--bg-subtle)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-sm)',
              }}
            >
              <div style={{ fontSize: '10.5px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '3px' }}>
                Allocated Product
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, color: 'var(--text-main)', fontSize: '12.5px' }}>
                <Boxes size={13} color="var(--text-secondary)" />
                <span>{product ? product.name : order.product_id}</span>
              </div>
              <div className="font-mono" style={{ fontSize: '10.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                Quantity: {order.quantity} units
              </div>
            </div>

            <div
              style={{
                padding: '12px',
                backgroundColor: 'var(--bg-subtle)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-sm)',
              }}
            >
              <div style={{ fontSize: '10.5px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '3px' }}>
                Placed Timestamp
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', color: 'var(--text-main)' }}>
                <Calendar size={12} color="var(--text-secondary)" />
                <span className="font-mono">{new Date(order.created_at).toLocaleTimeString()}</span>
              </div>
            </div>
          </div>

          {/* Fulfillment Lifecycle Timeline */}
          <div style={{ marginBottom: '24px' }}>
            <h3 style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '12px' }}>
              Fulfillment Lifecycle Flow
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
              <div style={{ position: 'relative', marginBottom: '18px' }}>
                <div
                  style={{
                    position: 'absolute',
                    left: '-24px',
                    top: '2px',
                    width: '16px',
                    height: '16px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--emerald)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <CheckCircle2 size={11} color="#ffffff" />
                </div>
                <div>
                  <div style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text-main)' }}>Order Placed → orders Topic</div>
                  <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    Published to Kafka cluster and stored with status PENDING.
                  </div>
                </div>
              </div>

              {/* Step 2: Stock Check */}
              <div style={{ position: 'relative', marginBottom: '18px' }}>
                <div
                  style={{
                    position: 'absolute',
                    left: '-24px',
                    top: '2px',
                    width: '16px',
                    height: '16px',
                    borderRadius: '50%',
                    backgroundColor: isPending ? 'var(--warning)' : isRejected ? 'var(--danger)' : 'var(--emerald)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {isPending ? (
                    <Clock size={10} color="#ffffff" />
                  ) : isRejected ? (
                    <XCircle size={11} color="#ffffff" />
                  ) : (
                    <ShieldCheck size={11} color="#ffffff" />
                  )}
                </div>
                <div>
                  <div style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text-main)' }}>
                    {isRejected ? 'Inventory Evaluation: Insufficient' : 'Atomic Stock Row-Lock Acquired'}
                  </div>
                  <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    {isPending
                      ? 'Inventory consumer evaluating available stock...'
                      : isRejected
                      ? 'Stock check failed: requested quantity exceeds warehouse stock.'
                      : `SELECT ... FOR UPDATE lock held; reserved ${order.quantity} units.`}
                  </div>
                </div>
              </div>

              {/* Step 3: Order State Finalized */}
              <div style={{ position: 'relative', marginBottom: '18px' }}>
                <div
                  style={{
                    position: 'absolute',
                    left: '-24px',
                    top: '2px',
                    width: '16px',
                    height: '16px',
                    borderRadius: '50%',
                    backgroundColor: isPending ? 'var(--bg-highlight)' : isRejected ? 'var(--danger)' : 'var(--emerald)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {isConfirmed ? (
                    <CheckCircle2 size={11} color="#ffffff" />
                  ) : isRejected ? (
                    <XCircle size={11} color="#ffffff" />
                  ) : (
                    <div style={{ width: '4px', height: '4px', backgroundColor: 'var(--text-muted)' }} />
                  )}
                </div>
                <div>
                  <div style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text-main)' }}>
                    Dispatch {isPending ? 'Pending' : order.status}
                  </div>
                  <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    {isConfirmed
                      ? 'OrderConfirmed event produced to order-events. Stock finalized.'
                      : isRejected
                      ? 'OrderRejected event produced. No stock deducted.'
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
                    backgroundColor: isConfirmed ? 'var(--emerald)' : 'var(--bg-highlight)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {isConfirmed ? (
                    <Send size={10} color="#ffffff" />
                  ) : (
                    <div style={{ width: '4px', height: '4px', backgroundColor: 'var(--text-muted)' }} />
                  )}
                </div>
                <div>
                  <div style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text-main)' }}>Notification Worker</div>
                  <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    {isConfirmed
                      ? 'Notification worker dispatched confirmation email & webhook.'
                      : isRejected
                      ? 'Rejection recorded; notification worker alerted.'
                      : 'Pending final status.'}
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
              backgroundColor: '#ffffff',
            }}
          >
            <button
              onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
              style={{
                width: '100%',
                padding: '9px 12px',
                backgroundColor: 'var(--bg-subtle)',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                color: 'var(--text-secondary)',
                fontSize: '11.5px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <span>Kafka Event Envelope Details</span>
              {showTechnicalDetails ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>

            {showTechnicalDetails && (
              <div style={{ padding: '12px', fontSize: '11.5px', color: 'var(--text-secondary)', backgroundColor: '#ffffff' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: '6px', marginBottom: '6px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Partition Key:</span>
                  <span className="font-mono" style={{ color: 'var(--text-main)' }}>{order.id}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: '6px', marginBottom: '6px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Murmur2 Hash:</span>
                  <span className="font-mono" style={{ color: 'var(--text-main)' }}>0x{hash.toString(16).toUpperCase()}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: '6px', marginBottom: '6px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Partition:</span>
                  <span className="font-mono" style={{ color: 'var(--emerald)', fontWeight: 600 }}>
                    Partition {partition}
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: '6px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Topic Flow:</span>
                  <span className="font-mono" style={{ fontSize: '10.5px', color: 'var(--text-main)' }}>
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
            padding: '14px 24px',
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
