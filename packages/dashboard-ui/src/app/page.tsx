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
import { TopologyCanvas } from '../components/topology/TopologyCanvas';
import { LagHeatmapView } from '../components/lag/LagHeatmapView';
import { TraceExplorerView } from '../components/traces/TraceExplorerView';
import { ChaosControlView } from '../components/chaos/ChaosControlView';

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

            {/* Interactive Live Topology Flow Canvas */}
            <div style={{ marginBottom: '28px' }}>
              <TopologyCanvas
                cluster={cluster}
                lagSummaries={lagSummaries}
                recentSpans={recentSpans}
              />
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
            <LagHeatmapView lagSummaries={lagSummaries} cluster={cluster} />
          </section>
        )}

        {/* TAB 3: LIVE TRACES */}
        {activeTab === 'traces' && (
          <section id="view-traces">
            <TraceExplorerView recentSpans={recentSpans} />
          </section>
        )}

        {/* TAB 4: CHAOS CONTROL */}
        {activeTab === 'chaos' && (
          <section id="view-chaos">
            <ChaosControlView />
          </section>
        )}
      </main>
    </div>
  );
}
