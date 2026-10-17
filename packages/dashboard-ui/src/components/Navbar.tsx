'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Package,
  ShoppingCart,
  LayoutDashboard,
  Plus,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Palette,
  Check,
} from 'lucide-react';

export type DashboardView = 'overview' | 'inventory' | 'orders';
export type ThemePalette = 'zinc' | 'stone' | 'forest' | 'obsidian' | 'classic';

interface ThemeOption {
  id: ThemePalette;
  name: string;
  previewColor: string;
  badge: string;
}

const THEME_OPTIONS: ThemeOption[] = [
  { id: 'zinc', name: 'Zinc & Amber', previewColor: '#18181b', badge: 'Linear' },
  { id: 'stone', name: 'Stone & Terracotta', previewColor: '#c2410c', badge: 'Notion' },
  { id: 'forest', name: 'Evergreen & Sage', previewColor: '#155e42', badge: 'Wise' },
  { id: 'obsidian', name: 'Obsidian Matte', previewColor: '#f59e0b', badge: 'Raycast' },
  { id: 'classic', name: 'Classic Slate', previewColor: '#2563eb', badge: 'SaaS' },
];

interface NavbarProps {
  currentView: DashboardView;
  onViewChange: (view: DashboardView) => void;
  onOpenNewOrder: () => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  servicesOnline: { orders: boolean; inventory: boolean };
  currentTheme: ThemePalette;
  onSelectTheme: (theme: ThemePalette) => void;
}

export function Navbar({
  currentView,
  onViewChange,
  onOpenNewOrder,
  onRefresh,
  isRefreshing,
  servicesOnline,
  currentTheme,
  onSelectTheme,
}: NavbarProps) {
  const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false);
  const themeMenuRef = useRef<HTMLDivElement>(null);
  const allServicesHealthy = servicesOnline.orders && servicesOnline.inventory;

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (themeMenuRef.current && !themeMenuRef.current.contains(e.target as Node)) {
        setIsThemeMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const activeThemeMeta = THEME_OPTIONS.find((t) => t.id === currentTheme) || THEME_OPTIONS[0];

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
          height: '60px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        {/* Brand & Context */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-inverse)',
              }}
            >
              <Package size={18} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-main)', letterSpacing: '-0.01em' }}>
                Streamz
              </span>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  color: 'var(--text-secondary)',
                  backgroundColor: 'var(--bg-subtle)',
                  padding: '2px 8px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-default)',
                }}
              >
                Operations
              </span>
            </div>
          </div>

          <div style={{ width: '1px', height: '24px', backgroundColor: 'var(--border-default)' }} />

          {/* Segmented Navigation Tabs */}
          <nav style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <button
              onClick={() => onViewChange('overview')}
              className={`btn btn-sm ${currentView === 'overview' ? 'btn-secondary' : 'btn-ghost'}`}
              style={{
                fontWeight: currentView === 'overview' ? 600 : 500,
                color: currentView === 'overview' ? 'var(--text-main)' : 'var(--text-secondary)',
                backgroundColor: currentView === 'overview' ? 'var(--bg-subtle)' : 'transparent',
              }}
            >
              <LayoutDashboard size={14} />
              Overview
            </button>
            <button
              onClick={() => onViewChange('inventory')}
              className={`btn btn-sm ${currentView === 'inventory' ? 'btn-secondary' : 'btn-ghost'}`}
              style={{
                fontWeight: currentView === 'inventory' ? 600 : 500,
                color: currentView === 'inventory' ? 'var(--text-main)' : 'var(--text-secondary)',
                backgroundColor: currentView === 'inventory' ? 'var(--bg-subtle)' : 'transparent',
              }}
            >
              <Package size={14} />
              Inventory Stock
            </button>
            <button
              onClick={() => onViewChange('orders')}
              className={`btn btn-sm ${currentView === 'orders' ? 'btn-secondary' : 'btn-ghost'}`}
              style={{
                fontWeight: currentView === 'orders' ? 600 : 500,
                color: currentView === 'orders' ? 'var(--text-main)' : 'var(--text-secondary)',
                backgroundColor: currentView === 'orders' ? 'var(--bg-subtle)' : 'transparent',
              }}
            >
              <ShoppingCart size={14} />
              Orders Ledger
            </button>
          </nav>
        </div>

        {/* Right Side Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Service Status Indicator */}
          <div
            title={`Orders API: ${servicesOnline.orders ? 'Online' : 'Offline'} | Inventory API: ${servicesOnline.inventory ? 'Online' : 'Offline'}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              borderRadius: '20px',
              backgroundColor: allServicesHealthy ? 'var(--success-subtle)' : 'var(--warning-subtle)',
              border: `1px solid ${allServicesHealthy ? 'var(--success-border)' : 'var(--warning-border)'}`,
              fontSize: '11px',
              fontWeight: 600,
              color: allServicesHealthy ? 'var(--success-text)' : 'var(--warning-text)',
            }}
          >
            {allServicesHealthy ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
            <span>{allServicesHealthy ? 'Operational' : 'Degraded'}</span>
          </div>

          {/* Theme Palette Switcher Dropdown */}
          <div ref={themeMenuRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setIsThemeMenuOpen(!isThemeMenuOpen)}
              className="btn btn-secondary btn-sm"
              title="Change theme palette"
              style={{ padding: '6px 10px', display: 'flex', alignItems: 'center', gap: '7px' }}
            >
              <div
                style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  backgroundColor: activeThemeMeta.previewColor,
                  border: '1px solid var(--border-default)',
                }}
              />
              <span style={{ fontSize: '12px' }}>{activeThemeMeta.name}</span>
            </button>

            {isThemeMenuOpen && (
              <div
                className="card"
                style={{
                  position: 'absolute',
                  right: 0,
                  top: '100%',
                  marginTop: '6px',
                  width: '230px',
                  backgroundColor: 'var(--bg-surface)',
                  border: '1px solid var(--border-default)',
                  boxShadow: 'var(--shadow-md)',
                  borderRadius: 'var(--radius-md)',
                  padding: '6px',
                  zIndex: 50,
                }}
              >
                <div
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    color: 'var(--text-muted)',
                    padding: '6px 8px 4px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  Opaque Color Palettes
                </div>
                {THEME_OPTIONS.map((theme) => {
                  const isSelected = theme.id === currentTheme;
                  return (
                    <button
                      key={theme.id}
                      onClick={() => {
                        onSelectTheme(theme.id);
                        setIsThemeMenuOpen(false);
                      }}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        backgroundColor: isSelected ? 'var(--bg-subtle)' : 'transparent',
                        border: 'none',
                        borderRadius: 'var(--radius-sm)',
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div
                          style={{
                            width: '12px',
                            height: '12px',
                            borderRadius: '50%',
                            backgroundColor: theme.previewColor,
                            border: '1px solid var(--border-strong)',
                            flexShrink: 0,
                          }}
                        />
                        <div>
                          <div style={{ fontSize: '12px', fontWeight: isSelected ? 600 : 500, color: 'var(--text-main)' }}>
                            {theme.name}
                          </div>
                          <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                            {theme.badge} style
                          </div>
                        </div>
                      </div>
                      {isSelected && <Check size={14} color="var(--primary-text)" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Refresh Action */}
          <button
            onClick={onRefresh}
            className="btn btn-secondary btn-sm"
            title="Refresh inventory and orders data"
            style={{ padding: '6px 10px' }}
          >
            <RefreshCw size={13} className={isRefreshing ? 'animate-spin' : ''} />
            <span>Sync</span>
          </button>

          {/* Create Order Button */}
          <button
            onClick={onOpenNewOrder}
            className="btn btn-primary btn-sm"
            style={{ padding: '6px 14px', fontWeight: 600 }}
          >
            <Plus size={14} />
            <span>New Order</span>
          </button>
        </div>
      </div>
    </header>
  );
}
