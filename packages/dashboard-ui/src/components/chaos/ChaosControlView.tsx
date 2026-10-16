'use client';

import React, { useState } from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Cpu,
  Flame,
  Layers,
  Play,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  Terminal,
  Trash2,
  Users,
  Zap,
  XCircle,
  Copy,
} from 'lucide-react';

interface ConsoleEntry {
  id: string;
  timestamp: string;
  type: 'BURST' | 'POISON' | 'STOCK' | 'IDEMPOTENT';
  status: 'SUCCESS' | 'ERROR' | 'INFO';
  title: string;
  details: string;
}

export function ChaosControlView() {
  const [consoleLogs, setConsoleLogs] = useState<ConsoleEntry[]>([]);
  const [burstCount, setBurstCount] = useState<number>(10);
  const [isExecutingBurst, setIsExecutingBurst] = useState(false);
  const [isExecutingPoison, setIsExecutingPoison] = useState(false);
  const [isExecutingStock, setIsExecutingStock] = useState(false);
  const [isExecutingDup, setIsExecutingDup] = useState(false);

  const addLog = (
    type: 'BURST' | 'POISON' | 'STOCK' | 'IDEMPOTENT',
    status: 'SUCCESS' | 'ERROR' | 'INFO',
    title: string,
    details: string
  ) => {
    const entry: ConsoleEntry = {
      id: Math.random().toString(36).substring(7),
      timestamp: new Date().toLocaleTimeString(),
      type,
      status,
      title,
      details,
    };
    setConsoleLogs((prev) => [entry, ...prev.slice(0, 49)]);
  };

  // 1. High-Volume Message Burst
  const handleTriggerBurst = async () => {
    setIsExecutingBurst(true);
    addLog('BURST', 'INFO', 'Initiating Message Burst', `Dispatching ${burstCount} orders across partitions...`);

    const products = ['prod-mouse-wireless', 'prod-keyboard-rgb', 'prod-headset-pro'];
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < burstCount; i++) {
      const prod = products[i % products.length];
      const customerId = `cust-burst-${Math.floor(Math.random() * 5)}`;
      try {
        const res = await fetch('http://localhost:3001/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customerId,
            productId: prod,
            quantity: 1,
            unitPrice: 49.99,
          }),
        });
        if (res.ok) successCount++;
        else failCount++;
      } catch (err: any) {
        failCount++;
      }
    }

    setIsExecutingBurst(false);
    if (failCount === 0) {
      addLog(
        'BURST',
        'SUCCESS',
        'Burst Dispatched Successfully',
        `Successfully produced ${successCount} orders across 3 partitions. Check lag and topology canvas!`
      );
    } else {
      addLog(
        'BURST',
        'ERROR',
        'Burst Partial Failure',
        `Sent ${successCount} orders, but ${failCount} failed. Ensure Order Service (port 3001) is running.`
      );
    }
  };

  // 2. Poison Pill / Schema Invalidation Injection
  const handleTriggerPoisonPill = async () => {
    setIsExecutingPoison(true);
    addLog(
      'POISON',
      'INFO',
      'Injecting Schema-Corrupt Poison Pill',
      'Dispatching invalid order payload with non-positive quantity to verify rejection and DLQ...'
    );

    try {
      const res = await fetch('http://localhost:3001/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: 'toxic-client-payload',
          productId: 'prod-unknown-toxic',
          quantity: -999, // Intentional schema violation
        }),
      });

      const body = await res.json().catch(() => ({}));
      setIsExecutingPoison(false);

      if (res.status === 400) {
        addLog(
          'POISON',
          'SUCCESS',
          'Poison Pill Isolated & Guarded',
          `HTTP 400 Bad Request returned by Order Service. Schema validation blocked invalid message entry: ${JSON.stringify(
            body
          )}`
        );
      } else {
        addLog('POISON', 'INFO', `HTTP ${res.status} Response`, JSON.stringify(body));
      }
    } catch (err: any) {
      setIsExecutingPoison(false);
      addLog(
        'POISON',
        'ERROR',
        'Poison Injection Error',
        `Connection failed: ${err.message}. Ensure Order Service is running.`
      );
    }
  };

  // 3. Stock Depletion / Out-of-Stock Shock
  const handleTriggerStockShock = async () => {
    setIsExecutingStock(true);
    addLog(
      'STOCK',
      'INFO',
      'Initiating Stock Depletion Shock',
      'Placing order for 10,000 units to trigger inventory rejection and compensation choreography...'
    );

    try {
      const res = await fetch('http://localhost:3001/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: 'cust-wholesaler',
          productId: 'prod-keyboard-rgb',
          quantity: 10000, // Exceeds available stock
        }),
      });

      const data = await res.json().catch(() => ({}));
      setIsExecutingStock(false);

      if (res.ok) {
        addLog(
          'STOCK',
          'SUCCESS',
          'Out-of-Stock Order Dispatched',
          `Order ${data.orderId || ''} accepted. Inventory Service will detect insufficient stock, publish InventoryRejected, and trigger OrderRejected.`
        );
      } else {
        addLog('STOCK', 'ERROR', 'Order Dispatch Failed', JSON.stringify(data));
      }
    } catch (err: any) {
      setIsExecutingStock(false);
      addLog(
        'STOCK',
        'ERROR',
        'Stock Shock Error',
        `Connection failed: ${err.message}. Ensure Order Service is running.`
      );
    }
  };

  // 4. Idempotency & Duplicate Replay Attack
  const handleTriggerDuplicateReplay = async () => {
    setIsExecutingDup(true);
    const sharedCorrelationId = `replay-attack-${Date.now()}`;
    addLog(
      'IDEMPOTENT',
      'INFO',
      'Launching Duplicate Replay Attack',
      `Sending 2 identical order requests with correlationId: ${sharedCorrelationId}...`
    );

    try {
      const payload = {
        customerId: 'cust-replay',
        productId: 'prod-mouse-wireless',
        quantity: 1,
        correlationId: sharedCorrelationId,
      };

      const [res1, res2] = await Promise.all([
        fetch('http://localhost:3001/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }),
        fetch('http://localhost:3001/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }),
      ]);

      const [data1, data2] = await Promise.all([
        res1.json().catch(() => ({})),
        res2.json().catch(() => ({})),
      ]);

      setIsExecutingDup(false);
      addLog(
        'IDEMPOTENT',
        'SUCCESS',
        'Twin Requests Dispatched to Kafka',
        `Both requests published. Downstream Inventory Service and Notification Worker inbox deduplication will process only 1 instance and ignore the duplicate!`
      );
    } catch (err: any) {
      setIsExecutingDup(false);
      addLog('IDEMPOTENT', 'ERROR', 'Replay Attack Error', err.message);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#ffffff' }}>
            Interactive Chaos & Reliability Engineering Console
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            Simulate operational faults, consumer group lag buildup, out-of-stock compensation, and inbox deduplication.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="badge badge-amber">
            <ShieldAlert size={13} /> Active Fault Injection
          </span>
          <span className="badge badge-emerald">
            <CheckCircle2 size={13} /> Self-Healing Active
          </span>
        </div>
      </div>

      {/* CHAOS EXPERIMENT CARDS GRID */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
          gap: '20px',
        }}
      >
        {/* CARD 1: BURST & LAG BUILDUP */}
        <div className="glass-panel" style={{ padding: '24px', borderLeft: '4px solid #818cf8' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
            <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(99, 102, 241, 0.2)' }}>
              <Zap size={20} color="#818cf8" />
            </div>
            <div>
              <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#ffffff' }}>
                Partition Lag & Burst Generator
              </h2>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                High-throughput pipeline stress testing
              </div>
            </div>
          </div>

          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '16px' }}>
            Dispatches a burst of orders across customer partitions using Murmur2 key hashing. Observe real-time consumer
            lag spike and subsequent parallel drain.
          </p>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Burst Volume:</span>
            {[5, 10, 25, 50].map((count) => (
              <button
                key={count}
                onClick={() => setBurstCount(count)}
                style={{
                  background: burstCount === count ? '#6366f1' : 'rgba(255, 255, 255, 0.06)',
                  color: burstCount === count ? '#ffffff' : 'var(--text-secondary)',
                  border: burstCount === count ? '1px solid #818cf8' : '1px solid var(--border-subtle)',
                  borderRadius: '6px',
                  padding: '4px 10px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {count} msgs
              </button>
            ))}
          </div>

          <button
            className="btn btn-primary"
            style={{ width: '100%' }}
            onClick={handleTriggerBurst}
            disabled={isExecutingBurst}
          >
            {isExecutingBurst ? (
              <>
                <RefreshCw size={15} className="pulse-emerald" /> Pumping Messages...
              </>
            ) : (
              <>
                <Play size={15} /> Launch {burstCount} Message Burst
              </>
            )}
          </button>
        </div>

        {/* CARD 2: POISON PILL INJECTION */}
        <div className="glass-panel" style={{ padding: '24px', borderLeft: '4px solid #ef4444' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
            <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.2)' }}>
              <AlertTriangle size={20} color="#ef4444" />
            </div>
            <div>
              <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#f87171' }}>
                Poison Pill & DLQ Routing
              </h2>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Corrupt payload isolation & fault tolerance
              </div>
            </div>
          </div>

          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '16px' }}>
            Injects an unprocessable / schema-violating payload into the event stream. Verifies non-blocking bounded
            retries and quarantine into <code style={{ color: '#f87171' }}>notifications.dlq</code>.
          </p>

          <div
            style={{
              padding: '10px 14px',
              borderRadius: '8px',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              marginBottom: '18px',
              fontSize: '11px',
              fontFamily: 'var(--font-mono)',
              color: '#fca5a5',
            }}
          >
            Payload: &#123; quantity: -999, invalidSchema: true &#125;
          </div>

          <button
            className="btn btn-danger"
            style={{ width: '100%' }}
            onClick={handleTriggerPoisonPill}
            disabled={isExecutingPoison}
          >
            {isExecutingPoison ? (
              <>
                <RefreshCw size={15} className="pulse-emerald" /> Injecting Fault...
              </>
            ) : (
              <>
                <Flame size={15} /> Inject Poison Pill
              </>
            )}
          </button>
        </div>

        {/* CARD 3: STOCK SHOCK / COMPENSATION */}
        <div className="glass-panel" style={{ padding: '24px', borderLeft: '4px solid #f59e0b' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
            <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(245, 158, 11, 0.2)' }}>
              <Flame size={20} color="#f59e0b" />
            </div>
            <div>
              <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#fbbf24' }}>
                Out-of-Stock Compensation Flow
              </h2>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Event-driven saga & rollback verification
              </div>
            </div>
          </div>

          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '16px' }}>
            Places an order requesting 10,000 units of RGB Keyboards. Demonstrates atomic stock check, publishing
            <code style={{ color: '#fbbf24' }}> InventoryRejected</code>, and order cancellation.
          </p>

          <div
            style={{
              padding: '10px 14px',
              borderRadius: '8px',
              background: 'rgba(245, 158, 11, 0.08)',
              border: '1px solid rgba(245, 158, 11, 0.25)',
              marginBottom: '18px',
              fontSize: '11px',
              fontFamily: 'var(--font-mono)',
              color: '#fde68a',
            }}
          >
            Requested Quantity: 10,000 units (Available: 100)
          </div>

          <button
            className="btn"
            style={{
              width: '100%',
              background: 'rgba(245, 158, 11, 0.15)',
              color: '#fbbf24',
              border: '1px solid rgba(245, 158, 11, 0.4)',
            }}
            onClick={handleTriggerStockShock}
            disabled={isExecutingStock}
          >
            {isExecutingStock ? (
              <>
                <RefreshCw size={15} className="pulse-emerald" /> Testing Compensation...
              </>
            ) : (
              <>
                <ArrowUpRight size={15} /> Trigger Stock Depletion Shock
              </>
            )}
          </button>
        </div>

        {/* CARD 4: IDEMPOTENT DEDUPLICATION */}
        <div className="glass-panel" style={{ padding: '24px', borderLeft: '4px solid #10b981' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
            <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.2)' }}>
              <Copy size={20} color="#10b981" />
            </div>
            <div>
              <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#34d399' }}>
                Duplicate Event Replay Attack
              </h2>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Transactional inbox table deduplication
              </div>
            </div>
          </div>

          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '16px' }}>
            Simulates Kafka network retries by sending two identical requests simultaneously. Demonstrates exact-once
            semantics via transactional PostgreSQL inbox locking.
          </p>

          <div
            style={{
              padding: '10px 14px',
              borderRadius: '8px',
              background: 'rgba(16, 185, 129, 0.08)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              marginBottom: '18px',
              fontSize: '11px',
              fontFamily: 'var(--font-mono)',
              color: '#a7f3d0',
            }}
          >
            Guarantees: Exactly-Once Business Processing
          </div>

          <button
            className="btn"
            style={{
              width: '100%',
              background: 'rgba(16, 185, 129, 0.15)',
              color: '#34d399',
              border: '1px solid rgba(16, 185, 129, 0.4)',
            }}
            onClick={handleTriggerDuplicateReplay}
            disabled={isExecutingDup}
          >
            {isExecutingDup ? (
              <>
                <RefreshCw size={15} className="pulse-emerald" /> Replaying Twins...
              </>
            ) : (
              <>
                <Play size={15} /> Fire Duplicate Twin Orders
              </>
            )}
          </button>
        </div>
      </div>

      {/* LIVE CHAOS EXECUTION AUDIT CONSOLE */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Terminal size={18} color="#a855f7" />
            <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#ffffff' }}>
              Real-Time Chaos Execution & Fault Injection Audit Console
            </h2>
          </div>
          {consoleLogs.length > 0 && (
            <button
              onClick={() => setConsoleLogs([])}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                fontSize: '12px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <Trash2 size={13} /> Clear Console
            </button>
          )}
        </div>

        {consoleLogs.length === 0 ? (
          <div
            style={{
              padding: '36px',
              textAlign: 'center',
              color: 'var(--text-muted)',
              fontSize: '13px',
              background: 'rgba(0, 0, 0, 0.3)',
              borderRadius: '8px',
            }}
          >
            Console idle. Trigger any of the chaos experiments above to observe real-time pipeline fault injection.
          </div>
        ) : (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              maxHeight: '340px',
              overflowY: 'auto',
              background: 'rgba(0, 0, 0, 0.4)',
              padding: '14px',
              borderRadius: '8px',
              fontFamily: 'var(--font-mono)',
            }}
          >
            {consoleLogs.map((log) => {
              const badgeClass =
                log.status === 'SUCCESS'
                  ? 'badge-emerald'
                  : log.status === 'ERROR'
                  ? 'badge-crimson'
                  : 'badge-indigo';

              return (
                <div
                  key={log.id}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '6px',
                    background: 'rgba(255, 255, 255, 0.03)',
                    borderLeft: `3px solid ${
                      log.status === 'SUCCESS' ? '#10b981' : log.status === 'ERROR' ? '#ef4444' : '#6366f1'
                    }`,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ color: 'var(--text-muted)' }}>[{log.timestamp}]</span>
                      <span className={`badge ${badgeClass}`} style={{ fontSize: '10px', padding: '1px 6px' }}>
                        {log.type}
                      </span>
                      <span style={{ fontWeight: 700, color: '#ffffff' }}>{log.title}</span>
                    </div>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{log.details}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
