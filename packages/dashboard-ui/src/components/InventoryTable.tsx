'use client';

import React, { useState } from 'react';
import { Search, Boxes, Plus, AlertTriangle } from 'lucide-react';
import { Product } from '../hooks/useInventoryApi';

interface InventoryTableProps {
  products: Product[];
  onOrderProduct: (product: Product) => void;
  isLoading?: boolean;
}

export function InventoryTable({ products, onOrderProduct, isLoading }: InventoryTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'IN_STOCK' | 'LOW_STOCK'>('ALL');

  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchTerm.toLowerCase());

    const available = p.stock_quantity - p.reserved_quantity;
    if (statusFilter === 'IN_STOCK') return matchesSearch && available > 10;
    if (statusFilter === 'LOW_STOCK') return matchesSearch && available <= 10;
    return matchesSearch;
  });

  return (
    <div className="card">
      {/* Table Header Controls */}
      <div
        style={{
          padding: '14px 18px',
          borderBottom: '1px solid var(--border-default)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h2 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-main)' }}>Warehouse SKU Inventory</h2>
            <span
              className="font-mono"
              style={{
                fontSize: '11px',
                color: 'var(--text-muted)',
                backgroundColor: 'var(--bg-subtle)',
                padding: '1px 6px',
                borderRadius: '3px',
                border: '1px solid var(--border-default)',
              }}
            >
              {products.length} SKUs
            </span>
          </div>
          <p style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
            Real-time warehouse stock tracking and atomic reservation allocations
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Search Input */}
          <div style={{ position: 'relative', width: '210px' }}>
            <Search
              size={13}
              style={{
                position: 'absolute',
                left: '9px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)',
              }}
            />
            <input
              type="text"
              placeholder="Filter SKU or name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="form-input"
              style={{ paddingLeft: '28px', fontSize: '12px', height: '32px' }}
            />
          </div>

          {/* Filter Pills */}
          <div
            style={{
              display: 'flex',
              gap: '2px',
              backgroundColor: 'var(--bg-subtle)',
              padding: '2px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-default)',
            }}
          >
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`btn btn-sm ${statusFilter === 'ALL' ? 'btn-secondary' : 'btn-ghost'}`}
              style={{
                padding: '3px 8px',
                fontSize: '11px',
                backgroundColor: statusFilter === 'ALL' ? '#ffffff' : 'transparent',
                color: statusFilter === 'ALL' ? 'var(--text-main)' : 'var(--text-secondary)',
                fontWeight: statusFilter === 'ALL' ? 600 : 500,
              }}
            >
              All
            </button>
            <button
              onClick={() => setStatusFilter('IN_STOCK')}
              className={`btn btn-sm ${statusFilter === 'IN_STOCK' ? 'btn-secondary' : 'btn-ghost'}`}
              style={{
                padding: '3px 8px',
                fontSize: '11px',
                backgroundColor: statusFilter === 'IN_STOCK' ? '#ffffff' : 'transparent',
                color: statusFilter === 'IN_STOCK' ? 'var(--text-main)' : 'var(--text-secondary)',
                fontWeight: statusFilter === 'IN_STOCK' ? 600 : 500,
              }}
            >
              In Stock
            </button>
            <button
              onClick={() => setStatusFilter('LOW_STOCK')}
              className={`btn btn-sm ${statusFilter === 'LOW_STOCK' ? 'btn-secondary' : 'btn-ghost'}`}
              style={{
                padding: '3px 8px',
                fontSize: '11px',
                backgroundColor: statusFilter === 'LOW_STOCK' ? '#ffffff' : 'transparent',
                color: statusFilter === 'LOW_STOCK' ? 'var(--text-main)' : 'var(--text-secondary)',
                fontWeight: statusFilter === 'LOW_STOCK' ? 600 : 500,
              }}
            >
              Low Stock
            </button>
          </div>
        </div>
      </div>

      {/* Table Data */}
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>SKU / Product Name</th>
              <th>Unit Price</th>
              <th>Total Stock</th>
              <th>Reserved</th>
              <th>Available Units</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredProducts.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                  {isLoading ? 'Polling catalog SKUs...' : 'No products found matching your search.'}
                </td>
              </tr>
            ) : (
              filteredProducts.map((p) => {
                const total = p.stock_quantity;
                const reserved = p.reserved_quantity;
                const available = Math.max(0, total - reserved);
                const percentAvailable = total > 0 ? Math.min(100, Math.round((available / total) * 100)) : 0;

                let badgeClass = 'badge-success';
                let statusLabel = 'In Stock';
                if (available === 0) {
                  badgeClass = 'badge-danger';
                  statusLabel = 'Out of Stock';
                } else if (available <= 10) {
                  badgeClass = 'badge-warning';
                  statusLabel = 'Low Stock';
                }

                return (
                  <tr key={p.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div
                          style={{
                            width: '28px',
                            height: '28px',
                            borderRadius: 'var(--radius-sm)',
                            backgroundColor: 'var(--bg-subtle)',
                            border: '1px solid var(--border-default)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'var(--text-secondary)',
                          }}
                        >
                          <Boxes size={14} />
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{p.name}</div>
                          <div className="font-mono" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            {p.sku}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="font-mono" style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                        ${parseFloat(p.price).toFixed(2)}
                      </span>
                    </td>
                    <td>
                      <span className="font-mono">{total}</span>
                    </td>
                    <td>
                      <span
                        className="font-mono"
                        style={{
                          color: reserved > 0 ? 'var(--warning-text)' : 'var(--text-muted)',
                          fontWeight: reserved > 0 ? 600 : 400,
                        }}
                      >
                        {reserved}
                      </span>
                    </td>
                    <td style={{ minWidth: '150px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div
                          style={{
                            flex: 1,
                            height: '5px',
                            backgroundColor: 'var(--bg-highlight)',
                            borderRadius: '3px',
                            overflow: 'hidden',
                          }}
                        >
                          <div
                            style={{
                              width: `${percentAvailable}%`,
                              height: '100%',
                              backgroundColor:
                                percentAvailable > 30 ? 'var(--emerald)' : percentAvailable > 0 ? 'var(--warning)' : 'var(--danger)',
                              borderRadius: '3px',
                            }}
                          />
                        </div>
                        <span className="font-mono" style={{ fontSize: '11.5px', fontWeight: 600, width: '32px' }}>
                          {available}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${badgeClass}`}>
                        {available <= 10 && available > 0 && <AlertTriangle size={10} />}
                        {statusLabel}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        onClick={() => onOrderProduct(p)}
                        className="btn btn-secondary btn-sm"
                        disabled={available === 0}
                        style={{ opacity: available === 0 ? 0.35 : 1, padding: '4px 9px' }}
                      >
                        <Plus size={12} />
                        <span>Order</span>
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
