'use client';

import React, { useState, useEffect } from 'react';
import {
  Search,
  X,
  Layers,
  ShoppingCart,
  GitBranch,
  ArrowRight,
  Zap,
  Hash,
  BookOpen,
} from 'lucide-react';
import { Product, Order } from '../hooks/useInventoryApi';
import { NavSection } from './Sidebar';
import { KAFKA_DOCS } from './docs/kafkaContent';

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

  const filteredDocs = KAFKA_DOCS.filter(
    (d) =>
      d.title.toLowerCase().includes(query.toLowerCase()) ||
      d.summary.toLowerCase().includes(query.toLowerCase()) ||
      d.subtitle.toLowerCase().includes(query.toLowerCase())
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
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '580px',
          backgroundColor: '#ffffff',
          borderRadius: 'var(--radius-lg)',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
          border: '1px solid var(--border-default)',
          overflow: 'hidden',
        }}
      >
        {/* Search Input Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '14px 16px',
            borderBottom: '1px solid var(--border-default)',
          }}
        >
          <Search size={16} color="var(--text-muted)" />
          <input
            autoFocus
            type="text"
            placeholder="Search docs, Kafka modules, SKUs, dispatches..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              fontSize: '13.5px',
              color: 'var(--text-main)',
              backgroundColor: 'transparent',
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
        <div style={{ maxHeight: '400px', overflowY: 'auto', padding: '8px' }}>
          {/* Quick Jump Sections */}
          {!query && (
            <div style={{ marginBottom: '8px' }}>
              <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', padding: '6px 8px', textTransform: 'uppercase' }}>
                Interactive & Learning Tools
              </div>
              <button
                onClick={() => {
                  onSelectSection('simulator');
                  onClose();
                }}
                className="btn btn-ghost"
                style={{ width: '100%', justifyContent: 'space-between', padding: '6px 10px', fontSize: '12.5px' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Zap size={14} color="var(--emerald-solid)" />
                  <span>Kafka Event Step Simulator</span>
                </div>
                <ArrowRight size={13} color="var(--text-muted)" />
              </button>
              <button
                onClick={() => {
                  onSelectSection('topics');
                  onClose();
                }}
                className="btn btn-ghost"
                style={{ width: '100%', justifyContent: 'space-between', padding: '6px 10px', fontSize: '12.5px' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Hash size={14} color="var(--emerald-solid)" />
                  <span>Topics, Partitions & Murmur2 Calculator</span>
                </div>
                <ArrowRight size={13} color="var(--text-muted)" />
              </button>
              <button
                onClick={() => {
                  onSelectSection('overview');
                  onClose();
                }}
                className="btn btn-ghost"
                style={{ width: '100%', justifyContent: 'space-between', padding: '6px 10px', fontSize: '12.5px' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Layers size={14} color="var(--text-muted)" />
                  <span>Live Operations Console</span>
                </div>
                <ArrowRight size={13} color="var(--text-muted)" />
              </button>
            </div>
          )}

          {/* Docs Search Match */}
          {filteredDocs.length > 0 && (
            <div style={{ marginBottom: '8px' }}>
              <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', padding: '6px 8px', textTransform: 'uppercase' }}>
                Kafka Masterclass Modules ({filteredDocs.length})
              </div>
              {filteredDocs.slice(0, 3).map((d) => (
                <button
                  key={d.id}
                  onClick={() => {
                    onSelectSection(d.id as NavSection);
                    onClose();
                  }}
                  className="btn btn-ghost"
                  style={{ width: '100%', justifyContent: 'space-between', padding: '6px 10px', textAlign: 'left' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <BookOpen size={13} color="var(--emerald-solid)" />
                    <div>
                      <div style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text-main)' }}>
                        Module {d.number}: {d.title}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{d.badge}</div>
                    </div>
                  </div>
                  <ArrowRight size={13} color="var(--text-muted)" />
                </button>
              ))}
            </div>
          )}

          {/* Products Search Match */}
          {filteredProducts.length > 0 && (
            <div style={{ marginBottom: '8px' }}>
              <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', padding: '6px 8px', textTransform: 'uppercase' }}>
                Warehouse SKUs ({filteredProducts.length})
              </div>
              {filteredProducts.slice(0, 3).map((p) => (
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
                    <Layers size={13} color="var(--emerald-solid)" />
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
              {filteredOrders.slice(0, 3).map((o) => (
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
                      <div className="font-mono" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-main)' }}>{o.id}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{o.customer_id} • ${o.total_amount}</div>
                    </div>
                  </div>
                  <span className={`badge ${o.status === 'CONFIRMED' ? 'badge-success' : o.status === 'REJECTED' ? 'badge-danger' : 'badge-neutral'} font-mono`}>
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
