'use client';

import React, { useState } from 'react';
import { AlertCircle, RefreshCw, GitBranch, Layers, ShoppingCart, BookOpen, Server, FileCode, CheckCircle2 } from 'lucide-react';
import { Header } from '../components/Header';
import { Sidebar, NavSection } from '../components/Sidebar';
import { KpiMetrics } from '../components/KpiMetrics';
import { InventoryTable } from '../components/InventoryTable';
import { OrdersTable } from '../components/OrdersTable';
import { OrderDetailDrawer } from '../components/OrderDetailDrawer';
import { CreateOrderModal } from '../components/CreateOrderModal';
import { CommandPalette } from '../components/CommandPalette';
import { MermaidChart } from '../components/MermaidChart';
import { useInventoryApi, Product, Order } from '../hooks/useInventoryApi';
import { KafkaSimulator } from '../components/explorer/KafkaSimulator';
import { TopicInspector } from '../components/explorer/TopicInspector';

const TOPOLOGY_MERMAID = `graph TD
    Client[Client Dashboard] -->|HTTP POST /orders| OS[Order Service<br/>Port 3001]
    OS -->|Topic: orders<br/>Event: OrderCreated| Kafka[(Apache Kafka KRaft Cluster<br/>Port 9092)]
    Kafka -->|Topic: orders| IS[Inventory Service<br/>Port 3002]
    IS -->|Topic: inventory-events<br/>InventoryReserved / Rejected| Kafka
    Kafka -->|Topic: inventory-events| OS
    OS -->|Topic: order-events<br/>OrderConfirmed / Rejected| Kafka
    Kafka -->|Topic: order-events| NW[Notification Worker<br/>Port 3003]
    NW -.->|Failures| DLQ[(notifications-dlq)]
`;

export default function DashboardHome() {
  const [currentSection, setCurrentSection] = useState<NavSection>('overview');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isNewOrderModalOpen, setIsNewOrderModalOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [orderModalProduct, setOrderModalProduct] = useState<Product | null>(null);
  const [isManualRefreshing, setIsManualRefreshing] = useState(false);

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

  const selectedOrderProduct = selectedOrder
    ? products.find((p) => p.id === selectedOrder.product_id)
    : undefined;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-page)' }}>
      {/* Top Header matching Nextra & TrackOpenSource */}
      <Header
        onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
        onOpenNewOrder={handleOpenGeneralOrderModal}
        onRefresh={handleRefresh}
        isRefreshing={isManualRefreshing || loading}
        servicesOnline={servicesOnline}
      />

      {/* Main Portal Viewport: Sidebar + Content Canvas */}
      <div style={{ display: 'flex', flex: 1, maxWidth: '1600px', margin: '0 auto', width: '100%' }}>
        {/* Left Collapsible Navigation Hierarchy */}
        <Sidebar
          currentSection={currentSection}
          onSelectSection={setCurrentSection}
          skuCount={products.length}
          orderCount={orders.length}
        />

        {/* Center Content Reading & Operations Canvas */}
        <main style={{ flex: 1, padding: '28px 32px', minWidth: 0 }}>
          {/* Offline Warning Banner */}
          {(!servicesOnline.orders || !servicesOnline.inventory) && (
            <div
              style={{
                padding: '11px 16px',
                marginBottom: '20px',
                backgroundColor: 'var(--danger-subtle)',
                border: '1px solid var(--danger-border)',
                borderRadius: 'var(--radius-sm)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '12.5px',
                color: 'var(--danger-text)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertCircle size={15} />
                <span>
                  Microservices notice: {!servicesOnline.orders && 'Order Service (3001) is offline. '}
                  {!servicesOnline.inventory && 'Inventory Service (3002) is offline. '}
                  Run <code className="font-mono">npm run dev</code> or <code className="font-mono">npm run docker:up</code>.
                </span>
              </div>
              <button
                onClick={handleRefresh}
                className="btn btn-secondary btn-sm"
                style={{ fontSize: '11px', padding: '3px 8px' }}
              >
                <RefreshCw size={11} />
                Retry
              </button>
            </div>
          )}

          {/* Section 1: OVERVIEW */}
          {currentSection === 'overview' && (
            <div>
              {/* TrackOpenSource Headline Kicker */}
              <div style={{ marginBottom: '22px' }}>
                <p className="kicker">DISTRIBUTED INVENTORY & KAFKA ENGINE</p>
                <h1 style={{ fontSize: '26px', fontWeight: 700, color: 'var(--text-main)', marginTop: '4px', letterSpacing: '-0.02em' }}>
                  Operations Console
                </h1>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px', maxWidth: '720px' }}>
                  Real-time warehouse stock tracking, distributed Kafka KRaft event choreography, and atomic PostgreSQL row-locks.
                </p>
              </div>

              {/* Stat KPI Cards */}
              <KpiMetrics products={products} orders={orders} />

              {/* Main Operations Split */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
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
            </div>
          )}

          {/* Section 2: WAREHOUSE SKUS */}
          {currentSection === 'inventory' && (
            <div>
              <div style={{ marginBottom: '20px' }}>
                <p className="kicker">INVENTORY MANAGEMENT</p>
                <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-main)', marginTop: '4px' }}>
                  Warehouse Stock Catalog
                </h1>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  Active SKUs, current on-hand units, reserved quantities, and atomic locking status.
                </p>
              </div>
              <InventoryTable
                products={products}
                onOrderProduct={handleOpenOrderWithProduct}
                isLoading={loading}
              />
            </div>
          )}

          {/* Section 3: ORDERS LEDGER */}
          {currentSection === 'orders' && (
            <div>
              <div style={{ marginBottom: '20px' }}>
                <p className="kicker">TRANSACTIONAL DISPATCH</p>
                <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-main)', marginTop: '4px' }}>
                  Orders & Dispatches Ledger
                </h1>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  Chronological event log of all placed orders, inventory reservation states, and client notifications.
                </p>
              </div>
              <OrdersTable
                orders={orders}
                products={products}
                onSelectOrder={setSelectedOrder}
                isLoading={loading}
              />
            </div>
          )}

          {/* Section 4: TOPOLOGY MAP (Mermaid) */}
          {currentSection === 'topology' && (
            <div>
              <div style={{ marginBottom: '20px' }}>
                <p className="kicker">KAFKA CLUSTER ARCHITECTURE</p>
                <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-main)', marginTop: '4px' }}>
                  System Topology & Event Flow
                </h1>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  Decoupled microservice architecture communicating asynchronously via Apache Kafka KRaft broker topics.
                </p>
              </div>

              {/* Rendered Mermaid Flowchart */}
              <div style={{ marginBottom: '24px' }}>
                <MermaidChart chart={TOPOLOGY_MERMAID} id="streamz-arch-chart" />
              </div>

              {/* Architectural Highlights Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
                <div className="card" style={{ padding: '16px 18px' }}>
                  <h3 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '4px' }}>
                    1. Order Ingestion
                  </h3>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    Client initiates HTTP POST to Order Service. Service commits order with status PENDING and produces <code className="font-mono">OrderCreated</code> to <code className="font-mono">orders</code> topic.
                  </p>
                </div>

                <div className="card" style={{ padding: '16px 18px' }}>
                  <h3 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '4px' }}>
                    2. Inventory Reservation
                  </h3>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    Inventory consumer group acquires <code className="font-mono">SELECT ... FOR UPDATE</code> row lock. Evaluates available units and produces <code className="font-mono">InventoryReserved</code> or <code className="font-mono">InventoryRejected</code>.
                  </p>
                </div>

                <div className="card" style={{ padding: '16px 18px' }}>
                  <h3 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '4px' }}>
                    3. Notification Dispatch
                  </h3>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    Order Service updates status to CONFIRMED and produces to <code className="font-mono">order-events</code>. Notification worker dispatches customer email.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Section 5: EVENT SCHEMAS */}
          {currentSection === 'contracts' && (
            <div>
              <div style={{ marginBottom: '20px' }}>
                <p className="kicker">DATA CONTRACTS</p>
                <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-main)', marginTop: '4px' }}>
                  Kafka Event Contracts Specification
                </h1>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  Strict TypeScript interfaces and TypeBox runtime schemas enforced across all Kafka topic envelopes.
                </p>
              </div>

              <div className="card" style={{ padding: '20px', marginBottom: '18px' }}>
                <h3 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '8px' }}>
                  Standard Event Envelope Structure
                </h3>
                <pre
                  className="font-mono"
                  style={{
                    backgroundColor: 'var(--bg-subtle)',
                    padding: '14px',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '11.5px',
                    color: 'var(--text-main)',
                    overflowX: 'auto',
                    border: '1px solid var(--border-default)',
                  }}
                >
{`{
  "eventId": "evt-b87c14a2-9923",
  "eventType": "OrderCreated",
  "eventVersion": 1,
  "aggregateId": "ord-2026-00129",
  "correlationId": "req-9a8f23",
  "occurredAt": "2026-10-17T11:00:00.000Z",
  "payload": {
    "orderId": "ord-2026-00129",
    "customerId": "cust_enterprise_01",
    "productId": "prod-mechanical-keyboard",
    "quantity": 2,
    "unitPrice": 149.00
  }
}`}
                </pre>
              </div>

              <div className="card" style={{ padding: '20px' }}>
                <h3 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '8px' }}>
                  Topic Mapping Table
                </h3>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Topic</th>
                      <th>Producer</th>
                      <th>Consumer Group</th>
                      <th>Partition Key</th>
                      <th>Payload Schema</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="font-mono" style={{ fontWeight: 600 }}>orders</td>
                      <td>Order Service</td>
                      <td>inventory-service-group</td>
                      <td className="font-mono">orderId</td>
                      <td>OrderCreatedEvent</td>
                    </tr>
                    <tr>
                      <td className="font-mono" style={{ fontWeight: 600 }}>inventory-events</td>
                      <td>Inventory Service</td>
                      <td>order-service-group</td>
                      <td className="font-mono">orderId</td>
                      <td>InventoryReservedEvent / InventoryRejectedEvent</td>
                    </tr>
                    <tr>
                      <td className="font-mono" style={{ fontWeight: 600 }}>order-events</td>
                      <td>Order Service</td>
                      <td>notification-worker-group</td>
                      <td className="font-mono">orderId</td>
                      <td>OrderConfirmedEvent / OrderRejectedEvent</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Section: INTERACTIVE EVENT STEP SIMULATOR */}
          {currentSection === 'simulator' && (
            <KafkaSimulator
              products={products}
              onPlaceLiveOrder={placeOrder}
            />
          )}

          {/* Section: TOPICS & PARTITIONS INSPECTOR */}
          {currentSection === 'topics' && (
            <TopicInspector />
          )}

          {/* Section 6: SPECS */}
          {currentSection === 'specs' && (
            <div>
              <div style={{ marginBottom: '20px' }}>
                <p className="kicker">DOCUMENTATION</p>
                <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-main)', marginTop: '4px' }}>
                  Project Architecture Specifications
                </h1>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  Technical specifications, distributed database isolation, and idempotency guarantees.
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div className="card" style={{ padding: '20px' }}>
                  <h3 style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px' }}>
                    1. Database-per-Service Isolation
                  </h3>
                  <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                    Following strict microservice patterns, each service owns its dedicated PostgreSQL database schema. No direct cross-database queries or foreign keys exist between services. All state transitions propagate asynchronously through Kafka event choreographies.
                  </p>
                </div>

                <div className="card" style={{ padding: '20px' }}>
                  <h3 style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px' }}>
                    2. Idempotency Inbox Pattern
                  </h3>
                  <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                    Every consumer maintains an inbox table storing processed event IDs. If a network blip causes Kafka to redeliver an event, the consumer checks the inbox within the same database transaction. Duplicate events are acknowledged without repeating side-effects.
                  </p>
                </div>

                <div className="card" style={{ padding: '20px' }}>
                  <h3 style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px' }}>
                    3. Atomic Stock Row-Locks
                  </h3>
                  <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                    The Inventory Service acquires exclusive pessimistic row-level locks (<code className="font-mono">SELECT ... FOR UPDATE</code>) on product records during reservation. This guarantees zero race conditions or overselling even under high concurrency.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Section 7: REST API */}
          {currentSection === 'api' && (
            <div>
              <div style={{ marginBottom: '20px' }}>
                <p className="kicker">API REFERENCE</p>
                <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-main)', marginTop: '4px' }}>
                  Fastify REST Endpoints
                </h1>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  HTTP API specification for Order Service (Port 3001) and Inventory Service (Port 3002).
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div className="card" style={{ padding: '16px 20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                    <span className="badge badge-success font-mono">POST</span>
                    <span className="font-mono" style={{ fontWeight: 600, fontSize: '13px' }}>http://localhost:3001/orders</span>
                  </div>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '10px' }}>
                    Submits a new customer order and produces an OrderCreated event to Kafka.
                  </p>
                  <pre
                    className="font-mono"
                    style={{
                      backgroundColor: 'var(--bg-subtle)',
                      padding: '10px 12px',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '11px',
                      color: 'var(--text-main)',
                      border: '1px solid var(--border-default)',
                    }}
                  >
{`// Request Body
{
  "customerId": "cust_enterprise_01",
  "productId": "prod-mechanical-keyboard",
  "quantity": 2,
  "unitPrice": 149.00
}`}
                  </pre>
                </div>

                <div className="card" style={{ padding: '16px 20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                    <span className="badge badge-neutral font-mono">GET</span>
                    <span className="font-mono" style={{ fontWeight: 600, fontSize: '13px' }}>http://localhost:3001/orders</span>
                  </div>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    Returns a list of all historical orders with current fulfillment status.
                  </p>
                </div>

                <div className="card" style={{ padding: '16px 20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                    <span className="badge badge-neutral font-mono">GET</span>
                    <span className="font-mono" style={{ fontWeight: 600, fontSize: '13px' }}>http://localhost:3002/products</span>
                  </div>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    Returns all warehouse inventory products with total stock and active reservations.
                  </p>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Slide-over Order Detail Drawer (TrackOpenSource RepoSideSheet style) */}
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

      {/* Command Palette (⌘K) */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        products={products}
        orders={orders}
        onSelectProduct={handleOpenOrderWithProduct}
        onSelectOrder={setSelectedOrder}
        onSelectSection={setCurrentSection}
      />
    </div>
  );
}
