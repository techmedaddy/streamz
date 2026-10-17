'use client';

import React, { useState, useEffect } from 'react';
import { Search, X, Layers, ShoppingCart, GitBranch, ArrowRight } from 'lucide-react';
import { Product, Order } from '../hooks/useInventoryApi';
import { NavSection } from './Sidebar';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  orders: Order[];
  onSelectProduct: (product: Product) => void;
  onSelectOrder: (order: Order) => void;
  onSelectSection: (section: NavSection) => void;
}

export function CommandPalette({
  isOpen,
  onClose,
  products,
  orders,
  onSelectProduct,
  onSelectOrder,
  onSelectSection,
}: CommandPaletteProps) {
  const [query, setQuery] = useState('');

  // Listen to ⌘K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(query.toLowerCase()) ||
      p.sku.toLowerCase().includes(query.toLowerCase())
  );

  const filteredOrders = orders.filter(
    (o) =>
      o.id.toLowerCase().includes(query.toLowerCase()) ||
      o.customer_id.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 60,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '80px',
      }}
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.4)',
        }}
      />

      {/* Palette Container */}
      <div
        className="card"
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '560px',
          backgroundColor: '#ffffff',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-lg)',
          overflow: 'hidden',
          zIndex: 10,
        }}
      >
        {/* Search Input Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '12px 16px',
            borderBottom: '1px solid var(--border-default)',
            gap: '10px',
          }}
        >
          <Search size={16} color="var(--text-muted)" />
          <input
            type="text"
            autoFocus
            placeholder="Search SKUs, orders, documentation..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              fontSize: '13.5px',
              color: 'var(--text-main)',
              fontFamily: 'var(--font-sans)',
            }}
          />
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
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div style={{ maxHeight: '360px', overflowY: 'auto', padding: '8px' }}>
          {/* Quick Jump Sections */}
          {!query && (
            <div style={{ marginBottom: '8px' }}>
              <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', padding: '6px 8px', textTransform: 'uppercase' }}>
                Navigation
              </div>
              <button
                onClick={() => {
                  onSelectSection('overview');
                  onClose();
                }}
                className="btn btn-ghost"
                style={{ width: '100%', justifyContent: 'space-between', padding: '6px 10px', fontSize: '12.5px' }}
              >
                <span>Live Operations Console</span>
                <ArrowRight size={13} color="var(--text-muted)" />
              </button>
              <button
                onClick={() => {
                  onSelectSection('topology');
                  onClose();
                }}
                className="btn btn-ghost"
                style={{ width: '100%', justifyContent: 'space-between', padding: '6px 10px', fontSize: '12.5px' }}
              >
                <span>System Architecture Topology (Mermaid)</span>
                <ArrowRight size={13} color="var(--text-muted)" />
              </button>
              <button
                onClick={() => {
                  onSelectSection('contracts');
                  onClose();
                }}
                className="btn btn-ghost"
                style={{ width: '100%', justifyContent: 'space-between', padding: '6px 10px', fontSize: '12.5px' }}
              >
                <span>Kafka Event Contracts Specification</span>
                <ArrowRight size={13} color="var(--text-muted)" />
              </button>
            </div>
          )}

          {/* Products Search Match */}
          {filteredProducts.length > 0 && (
            <div style={{ marginBottom: '8px' }}>
              <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', padding: '6px 8px', textTransform: 'uppercase' }}>
                Warehouse SKUs ({filteredProducts.length})
              </div>
              {filteredProducts.slice(0, 4).map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    onSelectProduct(p);
                    onClose();
                  }}
                  className="btn btn-ghost"
                  style={{ width: '100%', justifyContent: 'space-between', padding: '6px 10px', textAlign: 'left' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Layers size={13} color="var(--emerald)" />
                    <div>
                      <div style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text-main)' }}>{p.name}</div>
                      <div className="font-mono" style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>{p.sku} • ${p.price}</div>
                    </div>
                  </div>
                  <span className="badge badge-neutral font-mono">{p.stock_quantity - p.reserved_quantity} available</span>
                </button>
              ))}
            </div>
          )}

          {/* Orders Search Match */}
          {filteredOrders.length > 0 && (
            <div>
              <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', padding: '6px 8px', textTransform: 'uppercase' }}>
                Dispatched Orders ({filteredOrders.length})
              </div>
              {filteredOrders.slice(0, 4).map((o) => (
                <button
                  key={o.id}
                  onClick={() => {
                    onSelectOrder(o);
                    onClose();
                  }}
                  className="btn btn-ghost"
                  style={{ width: '100%', justifyContent: 'space-between', padding: '6px 10px', textAlign: 'left' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <ShoppingCart size={13} color="var(--text-muted)" />
                    <div>
                      <div className="font-mono" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-main)' }}>#{o.id.slice(0, 8)}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{o.customer_id} • ${parseFloat(o.total_amount).toFixed(2)}</div>
                    </div>
                  </div>
                  <span className={`badge ${o.status === 'CONFIRMED' ? 'badge-success' : o.status === 'REJECTED' ? 'badge-danger' : 'badge-warning'}`}>
                    {o.status}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
