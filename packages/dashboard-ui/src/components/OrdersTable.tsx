'use client';

import React, { useState } from 'react';
import { Search, ChevronRight, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { Order, Product } from '../hooks/useInventoryApi';

interface OrdersTableProps {
  orders: Order[];
  products: Product[];
  onSelectOrder: (order: Order) => void;
  isLoading?: boolean;
}

export function OrdersTable({ orders, products, onSelectOrder, isLoading }: OrdersTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'CONFIRMED' | 'PENDING' | 'REJECTED'>('ALL');

  const productMap = new Map(products.map((p) => [p.id, p]));

  const filteredOrders = orders.filter((o) => {
    const matchesSearch =
      o.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.customer_id.toLowerCase().includes(searchTerm.toLowerCase());

    if (statusFilter === 'ALL') return matchesSearch;
    return matchesSearch && o.status === statusFilter;
  });

  return (
    <div className="card">
      {/* Table Header Controls */}
      <div
        style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border-default)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div>
          <h2 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-main)' }}>Orders Ledger</h2>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            Chronological transactional log of customer orders and fulfillment states
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Search Input */}
          <div style={{ position: 'relative', width: '220px' }}>
            <Search
              size={14}
              style={{
                position: 'absolute',
                left: '10px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)',
              }}
            />
            <input
              type="text"
              placeholder="Search order or customer..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="form-input"
              style={{ paddingLeft: '30px', fontSize: '12px', height: '34px' }}
            />
          </div>

          {/* Filter Pills */}
          <div
            style={{
              display: 'flex',
              gap: '4px',
              backgroundColor: 'var(--bg-subtle)',
              padding: '3px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-default)',
            }}
          >
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`btn btn-sm ${statusFilter === 'ALL' ? 'btn-secondary' : 'btn-ghost'}`}
              style={{
                padding: '4px 10px',
                fontSize: '11px',
                backgroundColor: statusFilter === 'ALL' ? 'var(--bg-surface)' : 'transparent',
                color: statusFilter === 'ALL' ? 'var(--text-main)' : 'var(--text-secondary)',
                fontWeight: statusFilter === 'ALL' ? 600 : 500,
              }}
            >
              All ({orders.length})
            </button>
            <button
              onClick={() => setStatusFilter('CONFIRMED')}
              className={`btn btn-sm ${statusFilter === 'CONFIRMED' ? 'btn-secondary' : 'btn-ghost'}`}
              style={{
                padding: '4px 10px',
                fontSize: '11px',
                backgroundColor: statusFilter === 'CONFIRMED' ? 'var(--bg-surface)' : 'transparent',
                color: statusFilter === 'CONFIRMED' ? 'var(--text-main)' : 'var(--text-secondary)',
                fontWeight: statusFilter === 'CONFIRMED' ? 600 : 500,
              }}
            >
              Confirmed
            </button>
            <button
              onClick={() => setStatusFilter('PENDING')}
              className={`btn btn-sm ${statusFilter === 'PENDING' ? 'btn-secondary' : 'btn-ghost'}`}
              style={{
                padding: '4px 10px',
                fontSize: '11px',
                backgroundColor: statusFilter === 'PENDING' ? 'var(--bg-surface)' : 'transparent',
                color: statusFilter === 'PENDING' ? 'var(--text-main)' : 'var(--text-secondary)',
                fontWeight: statusFilter === 'PENDING' ? 600 : 500,
              }}
            >
              Pending
            </button>
            <button
              onClick={() => setStatusFilter('REJECTED')}
              className={`btn btn-sm ${statusFilter === 'REJECTED' ? 'btn-secondary' : 'btn-ghost'}`}
              style={{
                padding: '4px 10px',
                fontSize: '11px',
                backgroundColor: statusFilter === 'REJECTED' ? 'var(--bg-surface)' : 'transparent',
                color: statusFilter === 'REJECTED' ? 'var(--text-main)' : 'var(--text-secondary)',
                fontWeight: statusFilter === 'REJECTED' ? 600 : 500,
              }}
            >
              Rejected
            </button>
          </div>
        </div>
      </div>

      {/* Table Data */}
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Order ID</th>
              <th>Customer</th>
              <th>Product & Quantity</th>
              <th>Total Amount</th>
              <th>Status</th>
              <th>Placed At</th>
              <th style={{ textAlign: 'right' }}>Details</th>
            </tr>
          </thead>
          <tbody>
            {filteredOrders.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                  {isLoading ? 'Loading order transactions...' : 'No orders found matching filter criteria.'}
                </td>
              </tr>
            ) : (
              filteredOrders.map((order) => {
                const product = productMap.get(order.product_id);
                const productName = product ? product.name : order.product_id;

                let badgeClass = 'badge-warning';
                let Icon = Clock;
                if (order.status === 'CONFIRMED') {
                  badgeClass = 'badge-success';
                  Icon = CheckCircle2;
                } else if (order.status === 'REJECTED') {
                  badgeClass = 'badge-danger';
                  Icon = XCircle;
                }

                const formattedTime = new Date(order.created_at).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                });

                return (
                  <tr
                    key={order.id}
                    onClick={() => onSelectOrder(order)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td>
                      <span className="font-mono" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--primary)' }}>
                        #{order.id.slice(0, 8)}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{order.customer_id}</span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ color: 'var(--text-main)' }}>{productName}</span>
                        <span
                          className="font-mono"
                          style={{
                            fontSize: '11px',
                            fontWeight: 600,
                            color: 'var(--text-secondary)',
                            backgroundColor: 'var(--bg-subtle)',
                            border: '1px solid var(--border-default)',
                            padding: '1px 5px',
                            borderRadius: '3px',
                          }}
                        >
                          ×{order.quantity}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span className="font-mono" style={{ fontWeight: 700, color: 'var(--text-main)' }}>
                        ${parseFloat(order.total_amount).toFixed(2)}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${badgeClass}`}>
                        <Icon size={11} />
                        {order.status}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                        {formattedTime}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectOrder(order);
                        }}
                        className="btn btn-ghost btn-sm"
                        style={{ padding: '4px 8px' }}
                      >
                        <ChevronRight size={14} />
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
