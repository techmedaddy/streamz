'use client';

import React from 'react';
import {
  Boxes,
  ShoppingCart,
  LayoutDashboard,
  Plus,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Layers,
} from 'lucide-react';

export type DashboardView = 'overview' | 'inventory' | 'orders';

interface NavbarProps {
  currentView: DashboardView;
  onViewChange: (view: DashboardView) => void;
  onOpenNewOrder: () => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  servicesOnline: { orders: boolean; inventory: boolean };
}

export function Navbar({
  currentView,
  onViewChange,
  onOpenNewOrder,
  onRefresh,
  isRefreshing,
  servicesOnline,
}: NavbarProps) {
  const allServicesHealthy = servicesOnline.orders && servicesOnline.inventory;

  return (
    <header
      style={{
        borderBottom: '1px solid var(--border-default)',
        backgroundColor: 'var(--bg-surface)',
        position: 'sticky',
        top: 0,
        zIndex: 40,
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <div
        style={{
          maxWidth: '1440px',
          margin: '0 auto',
          padding: '0 24px',
          height: '56px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        {/* Brand & Industrial Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '30px',
                height: '30px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#0d0e12',
                fontWeight: 700,
              }}
            >
              <Boxes size={17} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                className="font-mono"
                style={{
                  fontSize: '14px',
                  fontWeight: 700,
                  color: 'var(--text-main)',
                  letterSpacing: '0.04em',
                }}
              >
                STREAMZ
              </span>
              <span
                className="badge badge-amber"
                style={{
                  fontSize: '10px',
                  fontFamily: 'var(--font-mono)',
                  letterSpacing: '0.06em',
                  fontWeight: 700,
                }}
              >
                LOGISTICS
              </span>
            </div>
          </div>

          <div style={{ width: '1px', height: '20px', backgroundColor: 'var(--border-default)' }} />

          {/* Segmented Industrial Tabs */}
          <nav style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <button
              onClick={() => onViewChange('overview')}
              className={`btn btn-sm ${currentView === 'overview' ? 'btn-secondary' : 'btn-ghost'}`}
              style={{
                color: currentView === 'overview' ? 'var(--text-main)' : 'var(--text-secondary)',
                backgroundColor: currentView === 'overview' ? 'var(--bg-subtle)' : 'transparent',
                borderColor: currentView === 'overview' ? 'var(--border-strong)' : 'transparent',
              }}
            >
              <LayoutDashboard size={13} />
              Operations Overview
            </button>
            <button
              onClick={() => onViewChange('inventory')}
              className={`btn btn-sm ${currentView === 'inventory' ? 'btn-secondary' : 'btn-ghost'}`}
              style={{
                color: currentView === 'inventory' ? 'var(--text-main)' : 'var(--text-secondary)',
                backgroundColor: currentView === 'inventory' ? 'var(--bg-subtle)' : 'transparent',
                borderColor: currentView === 'inventory' ? 'var(--border-strong)' : 'transparent',
              }}
            >
              <Layers size={13} />
              Warehouse SKUs
            </button>
            <button
              onClick={() => onViewChange('orders')}
              className={`btn btn-sm ${currentView === 'orders' ? 'btn-secondary' : 'btn-ghost'}`}
              style={{
                color: currentView === 'orders' ? 'var(--text-main)' : 'var(--text-secondary)',
                backgroundColor: currentView === 'orders' ? 'var(--bg-subtle)' : 'transparent',
                borderColor: currentView === 'orders' ? 'var(--border-strong)' : 'transparent',
              }}
            >
              <ShoppingCart size={13} />
              Dispatch Stream
            </button>
          </nav>
        </div>

        {/* Right Side Industrial Status & Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Service Status Badge */}
          <div
            title={`Orders Service: ${servicesOnline.orders ? 'Online' : 'Offline'} | Inventory Service: ${servicesOnline.inventory ? 'Online' : 'Offline'}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '3px 8px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: allServicesHealthy ? 'var(--success-subtle)' : 'var(--danger-subtle)',
              border: `1px solid ${allServicesHealthy ? 'var(--success-border)' : 'var(--danger-border)'}`,
              fontSize: '11px',
              fontFamily: 'var(--font-mono)',
              fontWeight: 600,
              color: allServicesHealthy ? 'var(--success-text)' : 'var(--danger-text)',
            }}
          >
            {allServicesHealthy ? <CheckCircle2 size={11} /> : <AlertCircle size={11} />}
            <span>{allServicesHealthy ? 'SERVICES ONLINE' : 'SERVICES DEGRADED'}</span>
          </div>

          {/* Sync Button */}
          <button
            onClick={onRefresh}
            className="btn btn-secondary btn-sm"
            title="Poll database & Kafka state"
            style={{ padding: '6px 9px' }}
          >
            <RefreshCw size={12} className={isRefreshing ? 'animate-spin' : ''} />
            <span style={{ fontSize: '11px' }}>Sync</span>
          </button>

          {/* Primary Dispatch Action in Industrial Safety Amber */}
          <button
            onClick={onOpenNewOrder}
            className="btn btn-primary btn-sm"
            style={{ padding: '6px 13px', fontWeight: 700, letterSpacing: '0.02em' }}
          >
            <Plus size={13} />
            <span>Dispatch Order</span>
          </button>
        </div>
      </div>
    </header>
  );
}
