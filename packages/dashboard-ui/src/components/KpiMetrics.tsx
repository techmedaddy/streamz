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
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '14px',
        marginBottom: '24px',
      }}
    >
      {/* Metric 1: Total SKUs in Catalog */}
      <div className="card" style={{ padding: '16px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
          <span style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)' }}>
            Active Catalog SKUs
          </span>
          <div style={{ color: 'var(--text-muted)' }}>
            <Boxes size={15} />
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
          <span style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
            {totalSkus}
          </span>
          <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>products tracked</span>
        </div>
        <div style={{ marginTop: '6px', fontSize: '11.5px', color: 'var(--text-secondary)' }}>
          <span className="font-mono" style={{ fontWeight: 600, color: 'var(--text-main)' }}>{totalStock.toLocaleString()}</span> units gross inventory
        </div>
      </div>

      {/* Metric 2: Available Stock */}
      <div className="card" style={{ padding: '16px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
          <span style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)' }}>
            Available for Sale
          </span>
          <div style={{ color: 'var(--emerald)' }}>
            <Layers size={15} />
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
          <span style={{ fontSize: '24px', fontWeight: 700, color: 'var(--emerald)', letterSpacing: '-0.02em' }}>
            {availableStock.toLocaleString()}
          </span>
          <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>unreserved units</span>
        </div>
        <div style={{ marginTop: '6px', fontSize: '11.5px', color: 'var(--text-secondary)' }}>
          <span className="font-mono" style={{ color: 'var(--warning-text)', fontWeight: 600 }}>
            {totalReserved.toLocaleString()} units
          </span>{' '}
          currently reserved in carts
        </div>
      </div>

      {/* Metric 3: Orders Processed */}
      <div className="card" style={{ padding: '16px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
          <span style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)' }}>
            Dispatches Processed
          </span>
          <div style={{ color: 'var(--text-main)' }}>
            <TrendingUp size={15} />
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
          <span style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
            {totalOrders}
          </span>
          <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>total placed</span>
        </div>
        <div style={{ marginTop: '6px', fontSize: '11.5px', color: 'var(--text-secondary)', display: 'flex', gap: '6px' }}>
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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
          <span style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)' }}>
            Fulfillment Rate
          </span>
          <div style={{ color: 'var(--emerald)' }}>
            <CheckCircle2 size={15} />
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
          <span style={{ fontSize: '24px', fontWeight: 700, color: 'var(--emerald)', letterSpacing: '-0.02em' }}>
            {fulfillmentRate}%
          </span>
          <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>stock match</span>
        </div>
        <div style={{ marginTop: '6px', fontSize: '11.5px', color: 'var(--text-secondary)' }}>
          Zero stock overselling with atomic row locks
        </div>
      </div>
    </div>
  );
}
