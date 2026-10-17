'use client';

import React, { useState, useEffect } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Navbar, DashboardView, ThemePalette } from '../components/Navbar';
import { KpiMetrics } from '../components/KpiMetrics';
import { InventoryTable } from '../components/InventoryTable';
import { OrdersTable } from '../components/OrdersTable';
import { OrderDetailDrawer } from '../components/OrderDetailDrawer';
import { CreateOrderModal } from '../components/CreateOrderModal';
import { useInventoryApi, Product, Order } from '../hooks/useInventoryApi';

export default function DashboardHome() {
  const [currentView, setCurrentView] = useState<DashboardView>('overview');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isNewOrderModalOpen, setIsNewOrderModalOpen] = useState(false);
  const [orderModalProduct, setOrderModalProduct] = useState<Product | null>(null);
  const [isManualRefreshing, setIsManualRefreshing] = useState(false);
  const [currentTheme, setCurrentTheme] = useState<ThemePalette>('zinc');

  // Initialize theme from document or localStorage (default: 'zinc' - Linear style, non-blue)
  useEffect(() => {
    const savedTheme = localStorage.getItem('streamz_opaque_theme') as ThemePalette | null;
    const themeToApply = savedTheme || 'zinc';
    setCurrentTheme(themeToApply);
    document.documentElement.setAttribute('data-theme', themeToApply);
  }, []);

  const handleSelectTheme = (theme: ThemePalette) => {
    setCurrentTheme(theme);
    localStorage.setItem('streamz_opaque_theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
  };

  const {
    products,
    orders,
    loading,
    orderPlacing,
    servicesOnline,
    refreshAll,
    placeOrder,
  } = useInventoryApi();

  const handleRefresh = async () => {
    setIsManualRefreshing(true);
    await refreshAll();
    setTimeout(() => setIsManualRefreshing(false), 500);
  };

  const handleOpenOrderWithProduct = (product: Product) => {
    setOrderModalProduct(product);
    setIsNewOrderModalOpen(true);
  };

  const handleOpenGeneralOrderModal = () => {
    setOrderModalProduct(null);
    setIsNewOrderModalOpen(true);
  };

  // Find product for selected order drawer
  const selectedOrderProduct = selectedOrder
    ? products.find((p) => p.id === selectedOrder.product_id)
    : undefined;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-page)' }}>
      {/* Top Navigation with Palette Selector */}
      <Navbar
        currentView={currentView}
        onViewChange={setCurrentView}
        onOpenNewOrder={handleOpenGeneralOrderModal}
        onRefresh={handleRefresh}
        isRefreshing={isManualRefreshing || loading}
        servicesOnline={servicesOnline}
        currentTheme={currentTheme}
        onSelectTheme={handleSelectTheme}
      />

      {/* Main Content Area */}
      <main style={{ flex: 1, padding: '28px 24px', maxWidth: '1440px', margin: '0 auto', width: '100%' }}>
        {/* Connection Notice banner when offline */}
        {(!servicesOnline.orders || !servicesOnline.inventory) && (
          <div
            style={{
              padding: '12px 18px',
              marginBottom: '24px',
              backgroundColor: 'var(--danger-subtle)',
              border: '1px solid var(--danger-border)',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '13px',
              color: 'var(--danger-text)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertCircle size={16} />
              <span>
                Microservices notice: {!servicesOnline.orders && 'Order Service is offline. '}
                {!servicesOnline.inventory && 'Inventory Service is offline. '}
                Run <code className="font-mono">npm run dev</code> or <code className="font-mono">npm run docker:up</code>.
              </span>
            </div>
            <button
              onClick={handleRefresh}
              className="btn btn-secondary btn-sm"
              style={{ fontSize: '11px', padding: '4px 8px' }}
            >
              <RefreshCw size={11} />
              Retry
            </button>
          </div>
        )}

        {/* Top Key Metric Cards */}
        <KpiMetrics products={products} orders={orders} />

        {/* Tab 1: OVERVIEW */}
        {currentView === 'overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
            <InventoryTable
              products={products.slice(0, 5)}
              onOrderProduct={handleOpenOrderWithProduct}
              isLoading={loading}
            />
            <OrdersTable
              orders={orders.slice(0, 10)}
              products={products}
              onSelectOrder={setSelectedOrder}
              isLoading={loading}
            />
          </div>
        )}

        {/* Tab 2: INVENTORY STOCK */}
        {currentView === 'inventory' && (
          <InventoryTable
            products={products}
            onOrderProduct={handleOpenOrderWithProduct}
            isLoading={loading}
          />
        )}

        {/* Tab 3: ORDERS LEDGER */}
        {currentView === 'orders' && (
          <OrdersTable
            orders={orders}
            products={products}
            onSelectOrder={setSelectedOrder}
            isLoading={loading}
          />
        )}
      </main>

      {/* Slide-over Order Detail Drawer */}
      <OrderDetailDrawer
        order={selectedOrder}
        product={selectedOrderProduct}
        onClose={() => setSelectedOrder(null)}
      />

      {/* Place Order Modal */}
      <CreateOrderModal
        isOpen={isNewOrderModalOpen}
        onClose={() => setIsNewOrderModalOpen(false)}
        products={products}
        initialProduct={orderModalProduct}
        onSubmit={placeOrder}
        isSubmitting={orderPlacing}
      />
    </div>
  );
}
