'use client';

import React, { useState, useEffect } from 'react';
import {
  Play,
  RotateCcw,
  FastForward,
  CheckCircle2,
  AlertCircle,
  Database,
  Cpu,
  Layers,
  ArrowRight,
  Info,
  Zap,
} from 'lucide-react';
import { Product } from '../../hooks/useInventoryApi';

interface KafkaSimulatorProps {
  products: Product[];
  onPlaceLiveOrder?: (data: { customerId: string; productId: string; quantity: number }) => Promise<any>;
}

interface SimStep {
  step: number;
  phase: string;
  component: string;
  topic?: string;
  partition?: number;
  title: string;
  explanation: string;
  codeSnippet?: string;
  wireRecord?: {
    key: string;
    partition: number;
    offset: number;
    value: Record<string, any>;
  };
}

export function KafkaSimulator({ products, onPlaceLiveOrder }: KafkaSimulatorProps) {
  const [scenario, setScenario] = useState<'happy' | 'reject'>('happy');
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [selectedProductId, setSelectedProductId] = useState<string>(
    products[0]?.id || 'prod-monitor-4k'
  );
  const [customQty, setCustomQty] = useState<number>(1);
  const [isLiveExecuting, setIsLiveExecuting] = useState<boolean>(false);
  const [liveSuccessMessage, setLiveSuccessMessage] = useState<string | null>(null);

  const selectedProduct = products.find((p) => p.id === selectedProductId) || products[0];

  // Steps definition based on scenario
  const steps: SimStep[] = scenario === 'happy'
    ? [
        {
          step: 1,
          phase: 'Inbound Request',
          component: 'Client → Order Service (Port 3001)',
          title: 'HTTP POST /orders Request',
          explanation:
            'A customer submits a checkout request. The Order Service receives the JSON payload, generates a unique Order ID, and persists the record into PostgreSQL with status = PENDING.',
          codeSnippet: `// Order Service: HTTP Ingestion
const orderId = 'ord-' + crypto.randomBytes(4).toString('hex');
await pool.query(
  'INSERT INTO orders (id, customer_id, product_id, quantity, status) VALUES ($1, $2, $3, $4, $5)',
  [orderId, 'cust-enterprise-01', '${selectedProduct?.id || 'prod-monitor-4k'}', ${customQty}, 'PENDING']
);`,
        },
        {
          step: 2,
          phase: 'Partition Key Hashing',
          component: 'KafkaJS Producer Partitioner',
          title: 'Murmur2 Partition Key Computation',
          explanation:
            'Kafka deterministically assigns messages with the same key to the same partition using the 32-bit Murmur2 hashing algorithm. This guarantees that all state transitions for this specific order are processed in strict chronological order.',
          codeSnippet: `// Kafka Murmur2 Hashing Algorithm
const key = orderId; // e.g. "ord-8fa2b109"
const hash = murmur2(key);
const partition = (hash & 0x7fffffff) % 3; // Modulo number of partitions (3)
// Result: Partition 1 assigned!`,
          wireRecord: {
            key: 'ord-8fa2b109',
            partition: 1,
            offset: 412,
            value: {
              eventType: 'OrderCreated',
              orderId: 'ord-8fa2b109',
              customerId: 'cust-enterprise-01',
              productId: selectedProduct?.id || 'prod-monitor-4k',
              quantity: customQty,
              timestamp: new Date().toISOString(),
            },
          },
        },
        {
          step: 3,
          phase: 'Cluster Append',
          component: 'Kafka KRaft Cluster (Port 9092)',
          topic: 'orders',
          partition: 1,
          title: 'Sequential Append to Commit Log',
          explanation:
            'The active KRaft partition leader broker appends the record sequentially to the orders-1 segment file on disk and replicates it to in-sync replicas (ISR). The Log End Offset (LEO) increments from 412 to 413.',
          codeSnippet: `# Linux Zero-Copy Broker Write
# Broker appends directly to /var/lib/kafka/data/orders-1/00000000000000000000.log
# High Watermark advances -> message is now visible to consumers!`,
        },
        {
          step: 4,
          phase: 'Consumer Polling',
          component: 'Inventory Service (Group: inventory-workers)',
          topic: 'orders',
          partition: 1,
          title: 'Batch Poll & Deserialization',
          explanation:
            'A worker in consumer group "inventory-workers" polls the partition via TCP, fetches the batch of new records, and decodes the OrderCreated JSON payload.',
          codeSnippet: `// Inventory Service: Consumer Poll Loop
await consumer.run({
  eachMessage: async ({ topic, partition, message }) => {
    const event = JSON.parse(message.value.toString());
    // event.eventType === "OrderCreated"
  }
});`,
        },
        {
          step: 5,
          phase: 'Atomic State Locking',
          component: 'PostgreSQL Database (Port 5434)',
          title: 'Pessimistic Row Lock (SELECT FOR UPDATE)',
          explanation:
            'To prevent flash-sale race conditions and overselling, Inventory Service starts a PostgreSQL transaction and acquires an exclusive row-level lock on the product SKU record before checking stock.',
          codeSnippet: `BEGIN;
-- Exclusive lock acquired: other transactions wait here
SELECT stock_quantity, reserved_quantity 
FROM products 
WHERE id = '${selectedProduct?.id || 'prod-monitor-4k'}' 
FOR UPDATE;

-- Available = stock_quantity - reserved_quantity (${(selectedProduct?.stock_quantity ?? 10) - (selectedProduct?.reserved_quantity ?? 0)} units available)
-- Stock check PASSED: Increment reserved_quantity by ${customQty}
UPDATE products SET reserved_quantity = reserved_quantity + ${customQty} WHERE id = '${selectedProduct?.id || 'prod-monitor-4k'}';
COMMIT;`,
        },
        {
          step: 6,
          phase: 'Event Choreography',
          component: 'Inventory Service Producer',
          topic: 'inventory-events',
          partition: 1,
          title: 'Produce InventoryReserved Event',
          explanation:
            'Because stock was successfully allocated, Inventory Service produces an "InventoryReserved" event to the inventory-events topic. No direct HTTP call is made to Order Service — choreography is 100% decoupled.',
          codeSnippet: `await producer.send({
  topic: 'inventory-events',
  messages: [{
    key: orderId,
    value: JSON.stringify({
      eventType: 'InventoryReserved',
      orderId,
      productId: '${selectedProduct?.id || 'prod-monitor-4k'}',
      reservedQuantity: ${customQty},
      status: 'RESERVED'
    })
  }]
});`,
          wireRecord: {
            key: 'ord-8fa2b109',
            partition: 1,
            offset: 89,
            value: {
              eventType: 'InventoryReserved',
              orderId: 'ord-8fa2b109',
              status: 'RESERVED',
              reservedQuantity: customQty,
            },
          },
        },
        {
          step: 7,
          phase: 'Order Fulfillment',
          component: 'Order Service Consumer',
          topic: 'inventory-events',
          partition: 1,
          title: 'Status Transition to CONFIRMED',
          explanation:
            'Order Service consumes the InventoryReserved event. It updates the order status in PostgreSQL from PENDING to CONFIRMED and publishes an OrderConfirmed event to order-events for downstream invoicing and shipping.',
          codeSnippet: `await pool.query(
  'UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2',
  ['CONFIRMED', orderId]
);`,
        },
        {
          step: 8,
          phase: 'Offset Commit',
          component: 'Kafka Consumer Group Coordinator',
          topic: '__consumer_offsets',
          title: 'Commit Offset to __consumer_offsets',
          explanation:
            'The consumer group coordinator commits the processed offset back to Kafka internal topic __consumer_offsets. The consumer lag returns to 0. Processing is complete!',
          codeSnippet: `// Offset safely committed after all database side-effects succeed!
// At-least-once processing guarantee fulfilled.`,
        },
      ]
    : [
        // SAGA REJECTION FLOW
        {
          step: 1,
          phase: 'Inbound Request',
          component: 'Client → Order Service (Port 3001)',
          title: 'HTTP POST /orders Request (Excessive Quantity)',
          explanation:
            'A customer requests 99 units of a limited-stock item (e.g. GeForce RTX 4090 OC) when the warehouse only holds 2 units in stock.',
          codeSnippet: `// Order Service: Persist Order as PENDING
await pool.query(
  'INSERT INTO orders (id, customer_id, product_id, quantity, status) VALUES ($1, $2, $3, $4, $5)',
  [orderId, 'cust-flash-buyer', 'prod-limited-edition-gpu', 99, 'PENDING']
);`,
        },
        {
          step: 2,
          phase: 'Partition Key Hashing',
          component: 'KafkaJS Producer Partitioner',
          topic: 'orders',
          partition: 2,
          title: 'Murmur2 Key Hash & Routing',
          explanation:
            'The OrderCreated event is routed to Partition 2 based on Murmur2(orderId).',
          codeSnippet: `// Key="ord-reject-demo" -> Hash % 3 = Partition 2
await producer.send({
  topic: 'orders',
  messages: [{ key: orderId, value: JSON.stringify({ orderId, quantity: 99 }) }]
});`,
        },
        {
          step: 3,
          phase: 'Atomic Stock Check',
          component: 'PostgreSQL Database (Port 5434)',
          title: 'Pessimistic Row Lock & Out-of-Stock Detection',
          explanation:
            'Inventory Service acquires an exclusive lock via SELECT FOR UPDATE on the SKU. It compares requested quantity (99) against available units (2). The check FAILS.',
          codeSnippet: `BEGIN;
SELECT stock_quantity, reserved_quantity FROM products WHERE id = 'prod-limited-edition-gpu' FOR UPDATE;
-- Available: 2 units. Requested: 99 units.
-- INSUFFICIENT STOCK! Transaction rolled back. Zero units reserved.
ROLLBACK;`,
        },
        {
          step: 4,
          phase: 'Compensating Event',
          component: 'Inventory Service Producer',
          topic: 'inventory-events',
          partition: 2,
          title: 'Produce InventoryRejected (Saga Compensating Event)',
          explanation:
            'Instead of failing silently, the Inventory Service emits an InventoryRejected event detailing the rejection reason ("Insufficient stock: requested 99, available 2").',
          codeSnippet: `await producer.send({
  topic: 'inventory-events',
  messages: [{
    key: orderId,
    value: JSON.stringify({
      eventType: 'InventoryRejected',
      orderId,
      status: 'REJECTED',
      rejectionReason: 'Insufficient stock: requested 99, available 2'
    })
  }]
});`,
          wireRecord: {
            key: 'ord-reject-demo',
            partition: 2,
            offset: 94,
            value: {
              eventType: 'InventoryRejected',
              orderId: 'ord-reject-demo',
              status: 'REJECTED',
              rejectionReason: 'Insufficient stock: requested 99, available 2',
            },
          },
        },
        {
          step: 5,
          phase: 'Compensating Transaction',
          component: 'Order Service Consumer',
          title: 'Rollback & Status Transition to REJECTED',
          explanation:
            'Order Service consumes the InventoryRejected event. It updates the order status to REJECTED and records the rejection reason. The customer can be notified of stock exhaustion with zero corrupt data.',
          codeSnippet: `await pool.query(
  'UPDATE orders SET status = $1, rejection_reason = $2 WHERE id = $3',
  ['REJECTED', 'Insufficient stock: requested 99, available 2', orderId]
);`,
        },
      ];

  // Auto-play timer
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isPlaying) {
      timer = setInterval(() => {
        setCurrentStepIndex((prev) => {
          if (prev < steps.length - 1) {
            return prev + 1;
          } else {
            setIsPlaying(false);
            return prev;
          }
        });
      }, 2000);
    }
    return () => clearInterval(timer);
  }, [isPlaying, steps.length]);

  const activeStep = steps[currentStepIndex];

  const handleLiveDispatch = async () => {
    if (!onPlaceLiveOrder) return;
    setIsLiveExecuting(true);
    setLiveSuccessMessage(null);
    try {
      const order = await onPlaceLiveOrder({
        customerId: scenario === 'happy' ? 'cust-sim-tester' : 'cust-oversell-tester',
        productId: scenario === 'happy' ? selectedProductId : 'prod-limited-edition-gpu',
        quantity: scenario === 'happy' ? customQty : 99,
      });
      setLiveSuccessMessage(
        `Live dispatch confirmed! Order ${order.id} sent to Kafka. Check the Dispatch Stream tab.`
      );
    } catch (err: any) {
      setLiveSuccessMessage(`Dispatch triggered: ${err.message || 'Complete'}`);
    } finally {
      setIsLiveExecuting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* ── Header & Kicker ────────────────────────────────────────────── */}
      <div>
        <p className="kicker">INTERACTIVE ARCHITECTURE SANDBOX</p>
        <h1
          style={{
            fontSize: '24px',
            fontWeight: 700,
            color: 'var(--text-main)',
            letterSpacing: '-0.02em',
            marginTop: '4px',
          }}
        >
          Kafka Event-Driven Choreography Simulator
        </h1>
        <p
          style={{
            fontSize: '13px',
            color: 'var(--text-secondary)',
            marginTop: '4px',
            maxWidth: '820px',
            lineHeight: 1.5,
          }}
        >
          Explore step-by-step how an event travels from an inbound HTTP request, through Murmur2 partition hashing, sequential commit log append, PostgreSQL atomic row locks, and event choreography.
        </p>
      </div>

      {/* ── Scenario Selection Bar ─────────────────────────────────────── */}
      <div
        className="card"
        style={{
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '14px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>
            SCENARIO:
          </span>
          <button
            onClick={() => {
              setScenario('happy');
              setCurrentStepIndex(0);
              setIsPlaying(false);
            }}
            style={{
              padding: '6px 12px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '12px',
              fontWeight: 500,
              cursor: 'pointer',
              border: '1px solid',
              backgroundColor: scenario === 'happy' ? 'var(--emerald-subtle)' : '#ffffff',
              borderColor: scenario === 'happy' ? 'var(--border-emerald)' : 'var(--border-default)',
              color: scenario === 'happy' ? 'var(--emerald-text)' : 'var(--text-main)',
            }}
          >
            1. Standard Order (Happy Path)
          </button>
          <button
            onClick={() => {
              setScenario('reject');
              setCurrentStepIndex(0);
              setIsPlaying(false);
            }}
            style={{
              padding: '6px 12px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '12px',
              fontWeight: 500,
              cursor: 'pointer',
              border: '1px solid',
              backgroundColor: scenario === 'reject' ? 'var(--danger-subtle)' : '#ffffff',
              borderColor: scenario === 'reject' ? 'var(--danger-border)' : 'var(--border-default)',
              color: scenario === 'reject' ? '#b91c1c' : 'var(--text-main)',
            }}
          >
            2. Out-of-Stock Rejection (Saga Rollback)
          </button>
        </div>

        {/* Playback Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={() => {
              if (currentStepIndex >= steps.length - 1) {
                setCurrentStepIndex(0);
              }
              setIsPlaying(!isPlaying);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              backgroundColor: isPlaying ? '#374151' : 'var(--emerald-solid)',
              color: '#ffffff',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {isPlaying ? (
              <>
                <span>Pause</span>
              </>
            ) : (
              <>
                <Play size={13} fill="currentColor" />
                <span>Auto Play</span>
              </>
            )}
          </button>

          <button
            disabled={currentStepIndex >= steps.length - 1 || isPlaying}
            onClick={() => setCurrentStepIndex((prev) => Math.min(steps.length - 1, prev + 1))}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-default)',
              backgroundColor: '#ffffff',
              color: currentStepIndex >= steps.length - 1 ? 'var(--text-muted)' : 'var(--text-main)',
              fontSize: '12px',
              fontWeight: 500,
              cursor: currentStepIndex >= steps.length - 1 ? 'not-allowed' : 'pointer',
            }}
          >
            <span>Next Step</span>
            <FastForward size={13} />
          </button>

          <button
            onClick={() => {
              setCurrentStepIndex(0);
              setIsPlaying(false);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '6px 10px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-default)',
              backgroundColor: '#ffffff',
              color: 'var(--text-muted)',
              fontSize: '12px',
              cursor: 'pointer',
            }}
          >
            <RotateCcw size={13} />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* ── Step Progress Indicator ────────────────────────────────────── */}
      <div
        className="card"
        style={{
          padding: '16px 20px',
          display: 'grid',
          gridTemplateColumns: `repeat(${steps.length}, 1fr)`,
          gap: '8px',
        }}
      >
        {steps.map((s, idx) => {
          const isDone = idx < currentStepIndex;
          const isCurrent = idx === currentStepIndex;
          return (
            <button
              key={s.step}
              onClick={() => {
                setCurrentStepIndex(idx);
                setIsPlaying(false);
              }}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                padding: '8px',
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                backgroundColor: isCurrent
                  ? 'var(--emerald-subtle)'
                  : isDone
                  ? 'var(--bg-subtle)'
                  : 'transparent',
                borderBottom: isCurrent
                  ? '2px solid var(--emerald-solid)'
                  : isDone
                  ? '2px solid #cbd5e1'
                  : '2px solid transparent',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span
                  className="font-mono"
                  style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    color: isCurrent
                      ? 'var(--emerald-text)'
                      : isDone
                      ? 'var(--text-muted)'
                      : '#94a3b8',
                  }}
                >
                  STEP {s.step}
                </span>
                {isDone && <CheckCircle2 size={11} color="var(--emerald-text)" />}
              </div>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: isCurrent ? 600 : 500,
                  color: isCurrent ? 'var(--text-main)' : 'var(--text-secondary)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {s.phase}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Active Step Visualization Canvas ───────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '20px' }}>
        {/* Left: Step Details & Explanation */}
        <div className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span
                className="badge font-mono"
                style={{
                  backgroundColor: 'var(--emerald-subtle)',
                  color: 'var(--emerald-text)',
                  border: '1px solid var(--border-emerald)',
                }}
              >
                Step {activeStep.step} of {steps.length}
              </span>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                {activeStep.component}
              </span>
            </div>

            <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-main)', letterSpacing: '-0.01em' }}>
              {activeStep.title}
            </h2>
          </div>

          <p style={{ fontSize: '13px', lineHeight: 1.65, color: 'var(--text-secondary)' }}>
            {activeStep.explanation}
          </p>

          {/* Wire Record Metadata if present */}
          {activeStep.wireRecord && (
            <div
              style={{
                backgroundColor: 'var(--bg-subtle)',
                borderRadius: 'var(--radius-sm)',
                padding: '12px 14px',
                border: '1px solid var(--border-default)',
              }}
            >
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  color: 'var(--text-muted)',
                  marginBottom: '8px',
                }}
              >
                Kafka Wire Record Header
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', fontSize: '12px' }}>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Key: </span>
                  <code className="font-mono" style={{ fontWeight: 600 }}>{activeStep.wireRecord.key}</code>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Partition: </span>
                  <code className="font-mono" style={{ fontWeight: 600 }}>P{activeStep.wireRecord.partition}</code>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Offset: </span>
                  <code className="font-mono" style={{ fontWeight: 600 }}>#{activeStep.wireRecord.offset}</code>
                </div>
              </div>
            </div>
          )}

          {/* Code/SQL Implementation Snippet */}
          {activeStep.codeSnippet && (
            <div>
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  color: 'var(--text-muted)',
                  marginBottom: '6px',
                }}
              >
                Under the Hood: Engine Execution
              </div>
              <pre
                className="font-mono"
                style={{
                  backgroundColor: '#111827',
                  color: '#e5e7eb',
                  padding: '14px 16px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '11.5px',
                  lineHeight: 1.6,
                  overflowX: 'auto',
                  margin: 0,
                  border: '1px solid #374151',
                }}
              >
                <code>{activeStep.codeSnippet}</code>
              </pre>
            </div>
          )}
        </div>

        {/* Right: Live Interactive Dispatch Sandbox */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <Zap size={16} color="var(--emerald-solid)" />
              <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-main)' }}>
                Dispatch Live to Local Kafka Cluster
              </h3>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: 1.5 }}>
              Trigger this exact scenario live against your running Fastify Order Service (3001) and Kafka KRaft cluster (9092) to see it reflect in the database and UI in under 500ms.
            </p>

            {scenario === 'happy' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
                <div>
                  <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                    Select Product SKU
                  </label>
                  <select
                    value={selectedProductId}
                    onChange={(e) => setSelectedProductId(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-default)',
                      fontSize: '12.5px',
                      backgroundColor: '#ffffff',
                    }}
                  >
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.sku}) — ${p.price} | Stock: {p.stock_quantity - p.reserved_quantity} avail
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                    Order Quantity
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={customQty}
                    onChange={(e) => setCustomQty(parseInt(e.target.value) || 1)}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-default)',
                      fontSize: '12.5px',
                    }}
                  />
                </div>
              </div>
            ) : (
              <div
                style={{
                  padding: '12px',
                  backgroundColor: 'var(--danger-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--danger-border)',
                  marginBottom: '16px',
                  fontSize: '12px',
                  color: '#991b1b',
                  lineHeight: 1.5,
                }}
              >
                <strong>Out-of-Stock Simulation:</strong> Will dispatch 99 units of the Limited Edition GPU (only 2 in stock). This will trigger the PostgreSQL row check rollback and publish an InventoryRejected event.
              </div>
            )}

            <button
              disabled={isLiveExecuting}
              onClick={handleLiveDispatch}
              style={{
                width: '100%',
                padding: '9px 16px',
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                backgroundColor: scenario === 'happy' ? 'var(--emerald-solid)' : '#b91c1c',
                color: '#ffffff',
                fontSize: '12.5px',
                fontWeight: 600,
                cursor: isLiveExecuting ? 'wait' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
            >
              <Zap size={14} />
              <span>{isLiveExecuting ? 'Publishing to Kafka...' : 'Dispatch Live Event Now'}</span>
            </button>

            {liveSuccessMessage && (
              <div
                style={{
                  marginTop: '12px',
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'var(--emerald-subtle)',
                  border: '1px solid var(--border-emerald)',
                  fontSize: '12px',
                  color: 'var(--emerald-text)',
                }}
              >
                {liveSuccessMessage}
              </div>
            )}
          </div>

          {/* Quick Mental Model Tip */}
          <div
            className="card"
            style={{
              padding: '16px 20px',
              backgroundColor: 'var(--bg-subtle)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <Info size={14} color="var(--text-muted)" />
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-main)' }}>
                Key Learning Takeaway
              </span>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
              Notice how the Order Service never directly contacts the Inventory Service via HTTP or SQL. All coordination happens through Kafka event topics (`orders` and `inventory-events`). This loose coupling means that even if the Inventory Service goes offline temporarily, incoming orders are safely buffered in Kafka without dropping a single sale.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
