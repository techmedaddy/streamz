'use client';

import React from 'react';
import { Package, CheckCircle2, TrendingUp, Layers } from 'lucide-react';
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
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: '16px',
        marginBottom: '28px',
      }}
    >
      {/* Metric 1: Total SKUs in Catalog */}
      <div className="card" style={{ padding: '18px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
            Active Catalog SKUs
          </span>
          <div style={{ color: 'var(--text-muted)' }}>
            <Package size={16} />
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
          <span style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-main)' }}>
            {totalSkus}
          </span>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>products tracked</span>
        </div>
        <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
          {totalStock.toLocaleString()} total units across all warehouses
        </div>
      </div>

      {/* Metric 2: Available Stock */}
      <div className="card" style={{ padding: '18px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
            Available for Sale
          </span>
          <div style={{ color: 'var(--success-text)' }}>
            <Layers size={16} />
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
          <span style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-main)' }}>
            {availableStock.toLocaleString()}
          </span>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>units unreserved</span>
        </div>
        <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
          <span style={{ color: 'var(--warning-text)', fontWeight: 600 }}>
            {totalReserved.toLocaleString()} units
          </span>{' '}
          currently reserved in active carts
        </div>
      </div>

      {/* Metric 3: Orders Processed */}
      <div className="card" style={{ padding: '18px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
            Orders Processed
          </span>
          <div style={{ color: 'var(--primary)' }}>
            <TrendingUp size={16} />
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
          <span style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-main)' }}>
            {totalOrders}
          </span>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>total placed</span>
        </div>
        <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', gap: '8px' }}>
          <span style={{ color: 'var(--success-text)', fontWeight: 600 }}>{confirmedOrders} confirmed</span>
          <span>•</span>
          <span style={{ color: 'var(--danger-text)', fontWeight: 600 }}>{rejectedOrders} rejected</span>
          {pendingOrders > 0 && (
            <>
              <span>•</span>
              <span style={{ color: 'var(--warning-text)', fontWeight: 600 }}>{pendingOrders} in-flight</span>
            </>
          )}
        </div>
      </div>

      {/* Metric 4: Fulfillment Success Rate */}
      <div className="card" style={{ padding: '18px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
            Fulfillment Rate
          </span>
          <div style={{ color: 'var(--success-text)' }}>
            <CheckCircle2 size={16} />
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
          <span style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-main)' }}>
            {fulfillmentRate}%
          </span>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>inventory match</span>
        </div>
        <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
          Zero stock overselling guaranteed by atomic locks
        </div>
      </div>
    </div>
  );
}
