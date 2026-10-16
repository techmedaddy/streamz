'use client';

import React from 'react';
import {
  Activity,
  Server,
  Layers,
  Radio,
  Clock,
  AlertTriangle,
  Zap,
} from 'lucide-react';
import { ClusterOverview, ConsumerGroupLagSummary } from '../hooks/useTelemetryStream';

interface HeaderProps {
  connected: boolean;
  cluster: ClusterOverview | null;
  lagSummaries: ConsumerGroupLagSummary[];
  lastHeartbeat: string | null;
  activeTab: 'topology' | 'lag' | 'traces' | 'chaos';
  setActiveTab: (tab: 'topology' | 'lag' | 'traces' | 'chaos') => void;
}

export function Header({
  connected,
  cluster,
  lagSummaries,
  lastHeartbeat,
  activeTab,
  setActiveTab,
}: HeaderProps) {
  const totalClusterLag = lagSummaries.reduce((sum, g) => sum + g.totalLag, 0);
  const stalledGroups = lagSummaries.filter((g) => g.isStalled);

  return (
    <header
      id="main-header"
      style={{
        borderBottom: '1px solid var(--border-subtle)',
        backgroundColor: 'rgba(10, 13, 20, 0.85)',
        backdropFilter: 'blur(16px)',
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}
    >
      {/* Top Status Ribbon */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 24px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
        }}
      >
        {/* Logo and Platform Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #4f46e5 0%, #06b6d4 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 20px rgba(99, 102, 241, 0.35)',
            }}
          >
            <Zap size={20} color="#ffffff" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                style={{
                  fontSize: '16px',
                  fontWeight: 700,
                  letterSpacing: '0.05em',
                  fontFamily: 'var(--font-mono)',
                  color: '#ffffff',
                }}
              >
                STREAMZ
              </span>
              <span className="badge badge-indigo">KAFKA KRaft</span>
            </div>
            <span
              style={{
                fontSize: '11px',
                color: 'var(--text-muted)',
                letterSpacing: '0.02em',
              }}
            >
              Real-Time Event Choreography & Internal Observability Engine
            </span>
          </div>
        </div>

        {/* Live Cluster Status Cards */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {/* WebSocket Status Indicator */}
          <div
            className="glass-panel"
            style={{
              padding: '6px 12px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <span
              className={connected ? 'pulse-emerald' : 'pulse-crimson'}
            />
            <span
              style={{
                fontSize: '12px',
                fontFamily: 'var(--font-mono)',
                color: connected ? '#34d399' : '#f87171',
                fontWeight: 600,
              }}
            >
              {connected ? 'WS LIVE' : 'RECONNECTING'}
            </span>
          </div>

          {/* Broker Node Pill */}
          <div
            className="glass-panel"
            style={{
              padding: '6px 12px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <Server size={14} color="#818cf8" />
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              Broker:
            </span>
            <span
              style={{
                fontSize: '12px',
                fontFamily: 'var(--font-mono)',
                color: '#ffffff',
                fontWeight: 600,
              }}
            >
              {cluster ? `${cluster.brokers.length} Node (ID: ${cluster.controllerBrokerId})` : 'Scanning...'}
            </span>
          </div>

          {/* Partitions & Topics Pill */}
          <div
            className="glass-panel"
            style={{
              padding: '6px 12px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <Layers size={14} color="#22d3ee" />
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              Topology:
            </span>
            <span
              style={{
                fontSize: '12px',
                fontFamily: 'var(--font-mono)',
                color: '#ffffff',
                fontWeight: 600,
              }}
            >
              {cluster ? `${cluster.totalPartitions} Partitions / ${cluster.topics.length} Topics` : '-'}
            </span>
          </div>

          {/* Global Lag Indicator */}
          <div
            className="glass-panel"
            style={{
              padding: '6px 12px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              borderColor:
                totalClusterLag > 0
                  ? 'rgba(245, 158, 11, 0.4)'
                  : 'var(--border-subtle)',
            }}
          >
            <Activity
              size={14}
              color={totalClusterLag > 0 ? '#fbbf24' : '#34d399'}
            />
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              Total Lag:
            </span>
            <span
              style={{
                fontSize: '12px',
                fontFamily: 'var(--font-mono)',
                color: totalClusterLag > 0 ? '#fbbf24' : '#34d399',
                fontWeight: 700,
              }}
            >
              {totalClusterLag} msg
            </span>
            {stalledGroups.length > 0 && (
              <span className="badge badge-crimson" title="Stalled consumer groups detected">
                <AlertTriangle size={10} />
                {stalledGroups.length} Stalled
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Navigation Tabs Bar */}
      <nav
        aria-label="Observability navigation tabs"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 24px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {[
            { id: 'topology', label: 'Cluster Topology & Nodes', icon: Server },
            { id: 'lag', label: 'Consumer Lag & Partition Heatmap', icon: Layers },
            { id: 'traces', label: 'Live Distributed Traces', icon: Activity },
            { id: 'chaos', label: 'Chaos & Operational Control', icon: Zap },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                id={`tab-${tab.id}`}
                onClick={() =>
                  setActiveTab(tab.id as 'topology' | 'lag' | 'traces' | 'chaos')
                }
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '12px 18px',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: isActive
                    ? '2px solid var(--accent-indigo)'
                    : '2px solid transparent',
                  color: isActive ? '#ffffff' : 'var(--text-secondary)',
                  fontWeight: isActive ? 600 : 500,
                  fontSize: '13px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  backgroundColor: isActive
                    ? 'rgba(99, 102, 241, 0.08)'
                    : 'transparent',
                }}
              >
                <Icon
                  size={15}
                  color={isActive ? 'var(--accent-indigo)' : 'var(--text-muted)'}
                />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Last Heartbeat Timestamp */}
        {lastHeartbeat && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '11px',
              color: 'var(--text-muted)',
              fontFamily: 'var(--font-mono)',
            }}
          >
            <Clock size={12} />
            <span>Telemetry: {new Date(lastHeartbeat).toLocaleTimeString()}</span>
          </div>
        )}
      </nav>
    </header>
  );
}
