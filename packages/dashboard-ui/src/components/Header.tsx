'use client';

import React from 'react';
import {
  Boxes,
  Search,
  Plus,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  BookOpen,
} from 'lucide-react';
import Link from 'next/link';

interface HeaderProps {
  onOpenCommandPalette: () => void;
  onOpenNewOrder: () => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  servicesOnline: { orders: boolean; inventory: boolean };
}

export function Header({
  onOpenCommandPalette,
  onOpenNewOrder,
  onRefresh,
  isRefreshing,
  servicesOnline,
}: HeaderProps) {
  const allServicesHealthy = servicesOnline.orders && servicesOnline.inventory;

  return (
    <header
      style={{
        borderBottom: '1px solid var(--border-default)',
        backgroundColor: 'var(--bg-surface)',
        position: 'sticky',
        top: 0,
        zIndex: 40,
      }}
    >
      <div
        style={{
          maxWidth: '1600px',
          margin: '0 auto',
          padding: '0 24px',
          height: '56px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        {/* Left: Brand / Title in Nextra Style */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '28px',
              height: '28px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'var(--primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
            }}
          >
            <Boxes size={16} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-main)', letterSpacing: '-0.01em' }}>
              Streamz Engineering
            </span>
            <span
              style={{
                fontSize: '10px',
                fontWeight: 600,
                color: 'var(--text-muted)',
                backgroundColor: 'var(--bg-subtle)',
                padding: '2px 6px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-default)',
                letterSpacing: '0.04em',
              }}
            >
              KAFKA KRaft
            </span>
          </div>
        </div>

        {/* Center: Command Palette Trigger Button (TrackOpenSource style) */}
        <button
          onClick={onOpenCommandPalette}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            height: '32px',
            borderRadius: '20px',
            border: '1px solid var(--border-default)',
            backgroundColor: '#ffffff',
            padding: '0 14px',
            fontSize: '12px',
            color: 'var(--text-muted)',
            boxShadow: 'var(--shadow-sm)',
            cursor: 'pointer',
            minWidth: '260px',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Search size={13} color="var(--text-muted)" />
            <span>Search docs, SKUs, dispatches...</span>
          </div>
          <kbd
            className="font-mono"
            style={{
              fontSize: '10px',
              color: 'var(--text-muted)',
              backgroundColor: 'var(--bg-subtle)',
              border: '1px solid var(--border-default)',
              padding: '1px 5px',
              borderRadius: '3px',
            }}
          >
            ⌘K
          </kbd>
        </button>

        {/* Right Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Service Status Badge (TrackOpenSource pill) */}
          <div
            title={`Orders Service: ${servicesOnline.orders ? 'Online' : 'Offline'} | Inventory Service: ${servicesOnline.inventory ? 'Online' : 'Offline'}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              borderRadius: '20px',
              backgroundColor: allServicesHealthy ? 'var(--emerald-subtle)' : 'var(--danger-subtle)',
              border: `1px solid ${allServicesHealthy ? 'var(--emerald-border)' : 'var(--danger-border)'}`,
              fontSize: '11px',
              fontWeight: 600,
              color: allServicesHealthy ? 'var(--emerald-text)' : 'var(--danger-text)',
            }}
          >
            {allServicesHealthy ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
            <span>{allServicesHealthy ? 'Cluster Healthy' : 'Degraded'}</span>
          </div>

          {/* Dedicated Docs Portal Link (Dark Nextra style) */}
          <Link
            href="/docs"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '5px 12px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '12px',
              fontWeight: 600,
              color: '#ffffff',
              backgroundColor: '#171717',
              textDecoration: 'none',
              border: '1px solid #262626',
            }}
          >
            <BookOpen size={13} color="#10b981" />
            <span>Kafka Docs</span>
          </Link>

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

          {/* Primary Action Button (Neutral-900 like TrackOpenSource) */}
          <button
            onClick={onOpenNewOrder}
            className="btn btn-primary btn-sm"
            style={{ padding: '6px 12px', fontWeight: 600 }}
          >
            <Plus size={13} />
            <span>Dispatch Order</span>
          </button>
        </div>
      </div>
    </header>
  );
}
