'use client';

import React, { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import {
  Server,
  Layers,
  Users,
  AlertTriangle,
  Database,
  Radio,
  CheckCircle2,
  Cpu,
  Globe,
  Flame,
  ArrowRight,
} from 'lucide-react';

export interface ServiceNodeData {
  title: string;
  role: 'producer' | 'consumer' | 'orchestrator';
  database?: string;
  status: 'healthy' | 'degraded' | 'offline';
  throughput?: string;
  description?: string;
  lastEvent?: string;
  isPulsing?: boolean;
}

export const ServiceNode = memo(({ data, selected }: NodeProps) => {
  const d = data as unknown as ServiceNodeData;
  const isPulsing = d.isPulsing;

  return (
    <div
      className={`glass-panel topology-node ${selected ? 'node-selected' : ''} ${
        isPulsing ? 'pulse-border' : ''
      }`}
      style={{
        padding: '16px',
        minWidth: '220px',
        borderLeft: `4px solid ${d.role === 'producer' ? '#818cf8' : '#34d399'}`,
        boxShadow: isPulsing
          ? '0 0 25px rgba(99, 102, 241, 0.45)'
          : selected
          ? '0 0 20px rgba(99, 102, 241, 0.3)'
          : undefined,
      }}
    >
      <Handle
        type="target"
        position={Position.Left}
        style={{ background: '#818cf8', width: 8, height: 8, border: '2px solid #0f172a' }}
      />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              padding: '6px',
              borderRadius: '8px',
              background: d.role === 'producer' ? 'rgba(99, 102, 241, 0.2)' : 'rgba(16, 185, 129, 0.2)',
            }}
          >
            {d.role === 'producer' ? <Server size={16} color="#818cf8" /> : <Cpu size={16} color="#34d399" />}
          </div>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#ffffff' }}>{d.title}</div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{d.role.toUpperCase()}</div>
          </div>
        </div>
        <span
          className={`badge ${
            d.status === 'healthy' ? 'badge-emerald' : d.status === 'degraded' ? 'badge-amber' : 'badge-crimson'
          }`}
          style={{ fontSize: '10px', padding: '2px 6px' }}
        >
          {d.status}
        </span>
      </div>

      {d.database && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '11px',
            color: 'var(--text-secondary)',
            fontFamily: 'var(--font-mono)',
            background: 'rgba(0, 0, 0, 0.3)',
            padding: '4px 8px',
            borderRadius: '6px',
            marginBottom: '8px',
          }}
        >
          <Database size={12} color="#60a5fa" />
          <span>{d.database}</span>
        </div>
      )}

      {d.lastEvent && (
        <div
          style={{
            fontSize: '10px',
            color: '#a5b4fc',
            fontFamily: 'var(--font-mono)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {d.lastEvent}
        </div>
      )}

      <Handle
        type="source"
        position={Position.Right}
        style={{ background: '#34d399', width: 8, height: 8, border: '2px solid #0f172a' }}
      />
    </div>
  );
});
ServiceNode.displayName = 'ServiceNode';

export interface TopicPartitionInfo {
  partitionId: number;
  leader: number;
  highWatermark: string;
  isPulsing?: boolean;
}

export interface TopicNodeData {
  topic: string;
  partitions: TopicPartitionInfo[];
  isInternal?: boolean;
  totalMessages?: number;
  isPulsing?: boolean;
}

export const TopicNode = memo(({ data, selected }: NodeProps) => {
  const d = data as unknown as TopicNodeData;
  const isPulsing = d.isPulsing;

  return (
    <div
      className={`glass-panel topology-node ${selected ? 'node-selected' : ''}`}
      style={{
        padding: '16px',
        minWidth: '260px',
        borderLeft: '4px solid #06b6d4',
        boxShadow: isPulsing ? '0 0 25px rgba(6, 182, 212, 0.45)' : undefined,
      }}
    >
      <Handle
        type="target"
        position={Position.Left}
        style={{ background: '#06b6d4', width: 8, height: 8, border: '2px solid #0f172a' }}
      />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ padding: '6px', borderRadius: '8px', background: 'rgba(6, 182, 212, 0.2)' }}>
            <Layers size={16} color="#06b6d4" />
          </div>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#ffffff', fontFamily: 'var(--font-mono)' }}>
              {d.topic}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Kafka Topic ({d.partitions.length} partitions)
            </div>
          </div>
        </div>
        {d.isInternal && (
          <span className="badge badge-amber" style={{ fontSize: '10px' }}>
            internal
          </span>
        )}
      </div>

      {/* Discrete Partitions Grid */}
      <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
        {d.partitions.map((p) => (
          <div
            key={p.partitionId}
            style={{
              flex: 1,
              padding: '8px',
              borderRadius: '8px',
              background: p.isPulsing ? 'rgba(6, 182, 212, 0.3)' : 'rgba(0, 0, 0, 0.35)',
              border: `1px solid ${p.isPulsing ? '#06b6d4' : 'rgba(255, 255, 255, 0.08)'}`,
              textAlign: 'center',
              transition: 'all 0.2s ease',
            }}
          >
            <div style={{ fontSize: '10px', color: '#38bdf8', fontWeight: 700 }}>P-{p.partitionId}</div>
            <div
              style={{
                fontSize: '11px',
                fontFamily: 'var(--font-mono)',
                color: '#ffffff',
                fontWeight: 600,
                marginTop: '2px',
              }}
            >
              HW: {p.highWatermark || '0'}
            </div>
            <div style={{ fontSize: '9px', color: 'var(--text-muted)', marginTop: '2px' }}>Node {p.leader}</div>
          </div>
        ))}
      </div>

      <Handle
        type="source"
        position={Position.Right}
        style={{ background: '#06b6d4', width: 8, height: 8, border: '2px solid #0f172a' }}
      />
    </div>
  );
});
TopicNode.displayName = 'TopicNode';

export interface ConsumerGroupNodeData {
  groupId: string;
  topic: string;
  state: string;
  membersCount: number;
  totalLag: number;
  isPulsing?: boolean;
}

export const ConsumerGroupNode = memo(({ data, selected }: NodeProps) => {
  const d = data as unknown as ConsumerGroupNodeData;
  const isHealthy = d.totalLag === 0;
  const isHighLag = d.totalLag > 10;

  return (
    <div
      className={`glass-panel topology-node ${selected ? 'node-selected' : ''}`}
      style={{
        padding: '16px',
        minWidth: '230px',
        borderLeft: `4px solid ${isHealthy ? '#10b981' : isHighLag ? '#ef4444' : '#f59e0b'}`,
        boxShadow: isHighLag ? '0 0 20px rgba(239, 68, 68, 0.35)' : undefined,
      }}
    >
      <Handle
        type="target"
        position={Position.Left}
        style={{ background: '#10b981', width: 8, height: 8, border: '2px solid #0f172a' }}
      />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ padding: '6px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.2)' }}>
            <Users size={16} color="#10b981" />
          </div>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#ffffff', fontFamily: 'var(--font-mono)' }}>
              {d.groupId}
            </div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Consumer Group ({d.state})</div>
          </div>
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 10px',
          borderRadius: '6px',
          background: 'rgba(0, 0, 0, 0.3)',
          marginTop: '6px',
        }}
      >
        <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Group Lag</span>
        <span
          className={`badge ${isHealthy ? 'badge-emerald' : isHighLag ? 'badge-crimson' : 'badge-amber'}`}
          style={{ fontSize: '11px', fontWeight: 700 }}
        >
          {d.totalLag} msgs
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '6px', fontSize: '11px' }}>
        <span style={{ color: 'var(--text-muted)' }}>Active Members</span>
        <span style={{ color: '#ffffff', fontWeight: 600 }}>{d.membersCount} consumer</span>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        style={{ background: '#10b981', width: 8, height: 8, border: '2px solid #0f172a' }}
      />
    </div>
  );
});
ConsumerGroupNode.displayName = 'ConsumerGroupNode';

export interface DlqNodeData {
  topic: string;
  deadLetterCount: number;
  isPulsing?: boolean;
}

export const DlqNode = memo(({ data, selected }: NodeProps) => {
  const d = data as unknown as DlqNodeData;

  return (
    <div
      className={`glass-panel topology-node ${selected ? 'node-selected' : ''}`}
      style={{
        padding: '16px',
        minWidth: '210px',
        borderLeft: '4px solid #ef4444',
        background: 'rgba(30, 10, 15, 0.75)',
        boxShadow: d.deadLetterCount > 0 ? '0 0 25px rgba(239, 68, 68, 0.4)' : undefined,
      }}
    >
      <Handle
        type="target"
        position={Position.Left}
        style={{ background: '#ef4444', width: 8, height: 8, border: '2px solid #0f172a' }}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
        <div style={{ padding: '6px', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.25)' }}>
          <AlertTriangle size={16} color="#ef4444" />
        </div>
        <div>
          <div style={{ fontSize: '13px', fontWeight: 700, color: '#f87171', fontFamily: 'var(--font-mono)' }}>
            {d.topic}
          </div>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Dead Letter Queue (DLQ)</div>
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 10px',
          borderRadius: '6px',
          background: 'rgba(0, 0, 0, 0.4)',
        }}
      >
        <span style={{ fontSize: '11px', color: '#fca5a5' }}>Poison Messages</span>
        <span className="badge badge-crimson" style={{ fontSize: '11px', fontWeight: 700 }}>
          {d.deadLetterCount}
        </span>
      </div>
    </div>
  );
});
DlqNode.displayName = 'DlqNode';

export interface ClientNodeData {
  label: string;
  activeRequests: number;
}

export const ClientNode = memo(({ data, selected }: NodeProps) => {
  const d = data as unknown as ClientNodeData;

  return (
    <div
      className={`glass-panel topology-node ${selected ? 'node-selected' : ''}`}
      style={{
        padding: '16px',
        minWidth: '180px',
        borderLeft: '4px solid #a855f7',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
        <div style={{ padding: '6px', borderRadius: '8px', background: 'rgba(168, 85, 247, 0.2)' }}>
          <Globe size={16} color="#c084fc" />
        </div>
        <div>
          <div style={{ fontSize: '13px', fontWeight: 700, color: '#ffffff' }}>{d.label}</div>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>HTTP Ingress / REST</div>
        </div>
      </div>
      <div style={{ fontSize: '11px', color: '#d8b4fe', fontFamily: 'var(--font-mono)', marginTop: '4px' }}>
        POST /api/orders
      </div>
      <Handle
        type="source"
        position={Position.Right}
        style={{ background: '#a855f7', width: 8, height: 8, border: '2px solid #0f172a' }}
      />
    </div>
  );
});
ClientNode.displayName = 'ClientNode';
