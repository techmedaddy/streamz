'use client';

import React from 'react';
import { Boxes, CheckCircle2, TrendingUp, Layers } from 'lucide-react';
import { Product, Order } from '../hooks/useInventoryApi';

interface KpiMetricsProps {
  products: Product[];
  orders: Order[];
}

export function KpiMetrics({ products, orders }: KpiMetricsProps) {
  // Compute metric numbers
  const totalSkus = products.length;
  const totalStock = products.reduce((acc, p) => acc + (p.stock_quantity || 0), 0);
  const totalReserved = products.reduce((acc, p) => acc + (p.reserved_quantity || 0), 0);
  const availableStock = Math.max(0, totalStock - totalReserved);

  const totalOrders = orders.length;
  const confirmedOrders = orders.filter((o) => o.status === 'CONFIRMED').length;
  const rejectedOrders = orders.filter((o) => o.status === 'REJECTED').length;
  const pendingOrders = orders.filter((o) => o.status === 'PENDING').length;

  const fulfillmentRate =
    totalOrders > 0
      ? Math.round((confirmedOrders / (totalOrders - pendingOrders || 1)) * 100)
      : 100;

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
        gap: '14px',
        marginBottom: '24px',
      }}
    >
      {/* Metric 1: Total SKUs in Catalog */}
      <div className="card" style={{ padding: '16px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span
            className="font-mono"
            style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: '0.04em' }}
          >
            CATALOG SKUs
          </span>
          <div style={{ color: 'var(--text-muted)' }}>
            <Boxes size={15} />
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
          <span className="font-mono" style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-main)' }}>
            {totalSkus}
          </span>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>active products</span>
        </div>
        <div style={{ marginTop: '8px', fontSize: '11px', color: 'var(--text-secondary)' }}>
          <span className="font-mono" style={{ color: 'var(--text-main)', fontWeight: 600 }}>{totalStock.toLocaleString()}</span> units gross inventory
        </div>
      </div>

      {/* Metric 2: Available Stock */}
      <div className="card" style={{ padding: '16px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span
            className="font-mono"
            style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: '0.04em' }}
          >
            DISPATCH READY
          </span>
          <div style={{ color: 'var(--primary)' }}>
            <Layers size={15} />
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
          <span className="font-mono" style={{ fontSize: '24px', fontWeight: 700, color: 'var(--primary)' }}>
            {availableStock.toLocaleString()}
          </span>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>unreserved units</span>
        </div>
        <div style={{ marginTop: '8px', fontSize: '11px', color: 'var(--text-secondary)' }}>
          <span className="font-mono" style={{ color: 'var(--warning-text)', fontWeight: 600 }}>
            {totalReserved.toLocaleString()} units
          </span>{' '}
          locked in reservation queue
        </div>
      </div>

      {/* Metric 3: Orders Processed */}
      <div className="card" style={{ padding: '16px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span
            className="font-mono"
            style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: '0.04em' }}
          >
            DISPATCH VOLUME
          </span>
          <div style={{ color: 'var(--success-text)' }}>
            <TrendingUp size={15} />
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
          <span className="font-mono" style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-main)' }}>
            {totalOrders}
          </span>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>total placed</span>
        </div>
        <div style={{ marginTop: '8px', fontSize: '11px', color: 'var(--text-secondary)', display: 'flex', gap: '6px' }}>
          <span style={{ color: 'var(--success-text)', fontWeight: 600 }}>{confirmedOrders} confirmed</span>
          <span style={{ color: 'var(--border-strong)' }}>/</span>
          <span style={{ color: 'var(--danger-text)', fontWeight: 600 }}>{rejectedOrders} rejected</span>
          {pendingOrders > 0 && (
            <>
              <span style={{ color: 'var(--border-strong)' }}>/</span>
              <span style={{ color: 'var(--warning-text)', fontWeight: 600 }}>{pendingOrders} in-flight</span>
            </>
          )}
        </div>
      </div>

      {/* Metric 4: Fulfillment Success Rate */}
      <div className="card" style={{ padding: '16px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span
            className="font-mono"
            style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: '0.04em' }}
          >
            FULFILLMENT RATE
          </span>
          <div style={{ color: 'var(--success-text)' }}>
            <CheckCircle2 size={15} />
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
          <span className="font-mono" style={{ fontSize: '24px', fontWeight: 700, color: 'var(--success-text)' }}>
            {fulfillmentRate}%
          </span>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>stock match</span>
        </div>
        <div style={{ marginTop: '8px', fontSize: '11px', color: 'var(--text-secondary)' }}>
          Guaranteed atomic PostgreSQL row-locks
        </div>
      </div>
    </div>
  );
}
