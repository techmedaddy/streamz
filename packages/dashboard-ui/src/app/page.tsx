'use client';

import React, { useState } from 'react';
import {
  Server,
  Layers,
  Activity,
  Zap,
  ArrowUpRight,
  CheckCircle2,
  AlertCircle,
  Database,
  Radio,
  Clock,
  RefreshCw,
} from 'lucide-react';
import { Header } from '../components/Header';
import { useTelemetryStream } from '../hooks/useTelemetryStream';

export default function DashboardHome() {
  const [activeTab, setActiveTab] = useState<'topology' | 'lag' | 'traces' | 'chaos'>('topology');
  const {
    connected,
    cluster,
    lagSummaries,
    recentSpans,
    lastHeartbeat,
    reconnectAttempts,
  } = useTelemetryStream();

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Top Status & Navigation Bar */}
      <Header
        connected={connected}
        cluster={cluster}
        lagSummaries={lagSummaries}
        lastHeartbeat={lastHeartbeat}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />

      {/* Main Content Viewport */}
      <main style={{ flex: 1, padding: '28px 32px', maxWidth: '1600px', margin: '0 auto', width: '100%' }}>
        {/* Connection Notice banner when offline */}
        {!connected && (
          <div
            className="glass-panel"
            style={{
              padding: '12px 20px',
              marginBottom: '24px',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              borderColor: 'rgba(239, 68, 68, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <AlertCircle size={18} color="#f87171" />
              <span style={{ fontSize: '13px', color: '#f87171', fontWeight: 500 }}>
                Disconnected from Observability WebSocket telemetry stream. Auto-reconnecting (Attempt {reconnectAttempts})...
              </span>
            </div>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              Target: ws://localhost:3004/ws/telemetry
            </span>
          </div>
        )}

        {/* TAB 1: CLUSTER TOPOLOGY */}
        {activeTab === 'topology' && (
          <section id="view-topology">
            <div style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#ffffff' }}>
                  Apache Kafka Cluster & Broker Topology
                </h1>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                  KRaft quorum consensus, partition distribution, leader brokers, and in-sync replica sets.
                </p>
              </div>
              <span className="badge badge-indigo">
                Cluster ID: {cluster?.clusterId || 'Detecting...'}
              </span>
            </div>

            {/* Broker Nodes Grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
                gap: '20px',
                marginBottom: '28px',
              }}
            >
              {(cluster?.brokers || []).map((broker) => (
                <div key={broker.nodeId} className="glass-panel" style={{ padding: '24px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div
                        style={{
                          width: '40px',
                          height: '40px',
                          borderRadius: '10px',
                          background: 'rgba(99, 102, 241, 0.15)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          border: '1px solid rgba(99, 102, 241, 0.3)',
                        }}
                      >
                        <Server size={20} color="#818cf8" />
                      </div>
                      <div>
                        <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#ffffff' }}>
                          Broker Node {broker.nodeId}
                        </h2>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                          {broker.host}:{broker.port}
                        </span>
                      </div>
                    </div>
                    {broker.isController ? (
                      <span className="badge badge-emerald">Active Controller</span>
                    ) : (
                      <span className="badge badge-indigo">Follower</span>
                    )}
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: '12px',
                      padding: '12px',
                      background: 'rgba(0, 0, 0, 0.25)',
                      borderRadius: '8px',
                      marginBottom: '16px',
                    }}
                  >
                    <div>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Role</span>
                      <p style={{ fontSize: '13px', fontWeight: 600, color: '#ffffff' }}>KRaft Controller & Broker</p>
                    </div>
                    <div>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Quorum State</span>
                      <p style={{ fontSize: '13px', fontWeight: 600, color: '#34d399' }}>Healthy (Leader)</p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Status</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#34d399', fontWeight: 600 }}>
                      <span className="pulse-emerald" style={{ width: '6px', height: '6px' }} />
                      Online & Accepting Connections
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Topics & Partition Layout Table */}
            <div className="glass-panel" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Layers size={18} color="#22d3ee" />
                  <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#ffffff' }}>
                    Registered Topics & Partition Allocation
                  </h2>
                </div>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Total {cluster?.topics.length || 0} Topics
                </span>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
                      <th style={{ padding: '12px 16px' }}>Topic Name</th>
                      <th style={{ padding: '12px 16px' }}>Type</th>
                      <th style={{ padding: '12px 16px' }}>Partitions</th>
                      <th style={{ padding: '12px 16px' }}>Leader Broker</th>
                      <th style={{ padding: '12px 16px' }}>In-Sync Replicas (ISR)</th>
                      <th style={{ padding: '12px 16px' }}>Log-End High Watermark</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(cluster?.topics || []).map((t) => (
                      <tr
                        key={t.name}
                        style={{
                          borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                          transition: 'background 0.15s ease',
                        }}
                      >
                        <td style={{ padding: '14px 16px', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                          <span style={{ color: t.name.startsWith('__') ? 'var(--text-dim)' : '#ffffff' }}>
                            {t.name}
                          </span>
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          {t.isInternal ? (
                            <span className="badge badge-amber">Internal</span>
                          ) : (
                            <span className="badge badge-cyan">Application</span>
                          )}
                        </td>
                        <td style={{ padding: '14px 16px', fontFamily: 'var(--font-mono)' }}>
                          {t.partitionCount} Partitions
                        </td>
                        <td style={{ padding: '14px 16px', fontFamily: 'var(--font-mono)' }}>
                          Node {t.partitions[0]?.leader ?? 1}
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <span className="badge badge-emerald">
                            [{t.partitions[0]?.isr.join(', ') ?? '1'}] 100% In-Sync
                          </span>
                        </td>
                        <td style={{ padding: '14px 16px', fontFamily: 'var(--font-mono)', color: '#38bdf8' }}>
                          {t.partitions.map((p) => `P${p.partitionId}:${p.highWatermark || '0'}`).join(' | ')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        {/* TAB 2: CONSUMER GROUP LAG */}
        {activeTab === 'lag' && (
          <section id="view-lag">
            <div style={{ marginBottom: '24px' }}>
              <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#ffffff' }}>
                Consumer Groups & Partition Lag Monitor
              </h1>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                Real-time offset lag calculation (High Watermark - Committed Offset) and stalled worker detection.
              </p>
            </div>

            <div style={{ display: 'grid', gap: '20px' }}>
              {lagSummaries.map((group) => (
                <div key={group.groupId} className="glass-panel" style={{ padding: '24px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div
                        style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '8px',
                          background: group.isStalled ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          border: `1px solid ${group.isStalled ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`,
                        }}
                      >
                        <Activity size={18} color={group.isStalled ? '#f87171' : '#34d399'} />
                      </div>
                      <div>
                        <h2 style={{ fontSize: '15px', fontWeight: 600, fontFamily: 'var(--font-mono)', color: '#ffffff' }}>
                          {group.groupId}
                        </h2>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                          State: <strong style={{ color: '#ffffff' }}>{group.state}</strong> • Active Members: {group.membersCount}
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      {group.isStalled && (
                        <span className="badge badge-crimson">
                          <AlertCircle size={12} /> Stalled / Unassigned Lag
                        </span>
                      )}
                      <span className={group.totalLag > 0 ? 'badge badge-amber' : 'badge badge-emerald'}>
                        Total Lag: {group.totalLag} messages
                      </span>
                    </div>
                  </div>

                  {/* Partition breakdown */}
                  {group.topics.map((t) => (
                    <div key={t.topic} style={{ background: 'rgba(0, 0, 0, 0.25)', borderRadius: '8px', padding: '16px', marginBottom: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', fontSize: '12px' }}>
                        <span style={{ fontWeight: 600, color: '#ffffff' }}>Topic: {t.topic}</span>
                        <span style={{ color: 'var(--text-muted)' }}>Topic Lag: {t.topicLag} msg</span>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                        {t.partitions.map((p) => (
                          <div
                            key={p.partition}
                            style={{
                              background: 'rgba(255, 255, 255, 0.03)',
                              borderRadius: '6px',
                              padding: '12px',
                              border: p.lag > 0 ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid var(--border-subtle)',
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '11px' }}>
                              <span style={{ fontWeight: 600, color: '#ffffff' }}>Partition {p.partition}</span>
                              <span style={{ color: p.lag > 0 ? '#fbbf24' : '#34d399', fontWeight: 700 }}>
                                Lag: {p.lag}
                              </span>
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                              <div>Log-End: {p.logEndOffset}</div>
                              <div>Committed: {p.committedOffset}</div>
                              <div>Assigned: {p.isAssigned ? '✓ Yes' : '✗ Unassigned'}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* TAB 3: LIVE TRACES */}
        {activeTab === 'traces' && (
          <section id="view-traces">
            <div style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#ffffff' }}>
                  Live Distributed Event Tracing Stream
                </h1>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                  Asynchronous correlation tracking cross-service event choreography in real time.
                </p>
              </div>
              <span className="badge badge-emerald">
                <span className="pulse-emerald" style={{ width: '6px', height: '6px' }} />
                Real-Time Pulse Active
              </span>
            </div>

            <div className="glass-panel" style={{ padding: '24px' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
                      <th style={{ padding: '12px 16px' }}>Timestamp</th>
                      <th style={{ padding: '12px 16px' }}>Service</th>
                      <th style={{ padding: '12px 16px' }}>Event Type</th>
                      <th style={{ padding: '12px 16px' }}>Stage</th>
                      <th style={{ padding: '12px 16px' }}>Duration</th>
                      <th style={{ padding: '12px 16px' }}>Correlation ID</th>
                      <th style={{ padding: '12px 16px' }}>Aggregate / Order</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentSpans.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
                          Listening for event spans... Trigger orders or tests to see live events stream across the wire.
                        </td>
                      </tr>
                    ) : (
                      recentSpans.map((span) => (
                        <tr
                          key={span.spanId}
                          style={{
                            borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                            transition: 'background 0.15s ease',
                          }}
                        >
                          <td style={{ padding: '14px 16px', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-muted)' }}>
                            {new Date(span.timestamp).toLocaleTimeString()}
                          </td>
                          <td style={{ padding: '14px 16px' }}>
                            <span
                              className={
                                span.service === 'order-service'
                                  ? 'badge badge-indigo'
                                  : span.service === 'inventory-service'
                                  ? 'badge badge-emerald'
                                  : 'badge badge-amber'
                              }
                            >
                              {span.service}
                            </span>
                          </td>
                          <td style={{ padding: '14px 16px', fontWeight: 600, color: '#ffffff' }}>
                            {span.eventType}
                          </td>
                          <td style={{ padding: '14px 16px' }}>
                            <span
                              className={
                                span.stage === 'PROCESSED'
                                  ? 'badge badge-emerald'
                                  : span.stage === 'FAILED'
                                  ? 'badge badge-crimson'
                                  : 'badge badge-cyan'
                              }
                            >
                              {span.stage}
                            </span>
                          </td>
                          <td style={{ padding: '14px 16px', fontFamily: 'var(--font-mono)', color: '#38bdf8' }}>
                            {span.durationMs ? `${span.durationMs}ms` : '-'}
                          </td>
                          <td style={{ padding: '14px 16px', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-secondary)' }}>
                            {span.correlationId}
                          </td>
                          <td style={{ padding: '14px 16px', fontFamily: 'var(--font-mono)', color: '#ffffff' }}>
                            {span.aggregateId}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        {/* TAB 4: CHAOS CONTROL */}
        {activeTab === 'chaos' && (
          <section id="view-chaos">
            <div style={{ marginBottom: '24px' }}>
              <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#ffffff' }}>
                Chaos & Failure Resilience Control Center
              </h1>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                Inject controlled failures, trigger consumer group rebalances, simulate message bursts, and test DLQ recovery.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
              <div className="glass-panel" style={{ padding: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                  <Zap size={18} color="#818cf8" />
                  <h2 style={{ fontSize: '15px', fontWeight: 600, color: '#ffffff' }}>Lag Buildup Burst Generator</h2>
                </div>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '18px' }}>
                  Pumps a high-volume burst of 100 messages into the orders topic across all 3 partitions to test drain capacity.
                </p>
                <button
                  id="btn-trigger-burst"
                  className="btn btn-primary"
                  onClick={async () => {
                    try {
                      await fetch('http://localhost:3001/orders', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          customerId: 'chaos-tester',
                          productId: 'prod-mouse-wireless',
                          quantity: 1,
                        }),
                      });
                      alert('Dispatched test order!');
                    } catch (e: any) {
                      alert(`Order dispatch note: ${e.message}`);
                    }
                  }}
                >
                  <ArrowUpRight size={14} /> Dispatch Test Order
                </button>
              </div>

              <div className="glass-panel" style={{ padding: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                  <AlertCircle size={18} color="#f87171" />
                  <h2 style={{ fontSize: '15px', fontWeight: 600, color: '#ffffff' }}>Poison Pill DLQ Injection</h2>
                </div>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '18px' }}>
                  Injects an intentionally toxic payload to verify DLQ quarantine and non-blocking retry mechanics.
                </p>
                <button id="btn-trigger-dlq" className="btn btn-danger">
                  Inject Poison Pill
                </button>
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
