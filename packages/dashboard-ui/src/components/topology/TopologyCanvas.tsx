'use client';

import React, { useMemo, useState, useEffect } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Panel,
  Node,
  Edge,
  BackgroundVariant,
  NodeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import {
  ServiceNode,
  TopicNode,
  ConsumerGroupNode,
  DlqNode,
  ClientNode,
  TopicPartitionInfo,
} from './CustomNodes';
import {
  Layers,
  Activity,
  Zap,
  Info,
  X,
  Server,
  Database,
  Users,
  AlertTriangle,
  RotateCcw,
  Maximize2,
} from 'lucide-react';
import {
  ClusterOverview,
  ConsumerGroupLagSummary,
  EventTraceSpan,
} from '../../hooks/useTelemetryStream';

interface TopologyCanvasProps {
  cluster: ClusterOverview | null;
  lagSummaries: ConsumerGroupLagSummary[];
  recentSpans: EventTraceSpan[];
}

const nodeTypes: NodeTypes = {
  serviceNode: ServiceNode,
  topicNode: TopicNode,
  consumerGroupNode: ConsumerGroupNode,
  dlqNode: DlqNode,
  clientNode: ClientNode,
};

export function TopologyCanvas({ cluster, lagSummaries, recentSpans }: TopologyCanvasProps) {
  const [selectedNodeData, setSelectedNodeData] = useState<{
    id: string;
    type: string;
    data: any;
  } | null>(null);

  const [currentTime, setCurrentTime] = useState<number | null>(null);

  useEffect(() => {
    setCurrentTime(Date.now());
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Check recent span activities in last 6 seconds
  const activeTopics = useMemo(() => {
    if (!currentTime) return new Set<string>();
    const set = new Set<string>();
    for (const span of recentSpans) {
      const spanAge = currentTime - new Date(span.timestamp).getTime();
      if (spanAge < 6000) {
        if (span.metadata?.topic) {
          set.add(span.metadata.topic);
        } else if (span.eventType?.startsWith('Order')) {
          set.add('orders.events');
        } else if (span.eventType?.startsWith('Inventory')) {
          set.add('inventory.events');
        } else if (span.eventType?.includes('Dlq') || span.stage === 'FAILED') {
          set.add('notifications.dlq');
        }
      }
    }
    return set;
  }, [recentSpans, currentTime]);

  const activeServices = useMemo(() => {
    if (!currentTime) return new Set<string>();
    const set = new Set<string>();
    for (const span of recentSpans) {
      const spanAge = currentTime - new Date(span.timestamp).getTime();
      if (spanAge < 6000 && span.service) {
        set.add(span.service);
      }
    }
    return set;
  }, [recentSpans, currentTime]);

  // Construct Nodes based on dynamic cluster and lag state
  const nodes: Node[] = useMemo(() => {
    const n: Node[] = [];

    // Helper to find lag for a group
    const getGroupLagSummary = (groupId: string) => {
      return lagSummaries.find((l) => l.groupId === groupId);
    };

    // Helper to get partition high watermarks for topic
    const getTopicPartitions = (topicName: string): TopicPartitionInfo[] => {
      const match = cluster?.topics.find((t) => t.name === topicName);
      if (!match) {
        return [
          { partitionId: 0, leader: 1, highWatermark: '0' },
          { partitionId: 1, leader: 1, highWatermark: '0' },
          { partitionId: 2, leader: 1, highWatermark: '0' },
        ];
      }
      return match.partitions.map((p) => ({
        partitionId: p.partitionId,
        leader: p.leader,
        highWatermark: p.highWatermark || '0',
        isPulsing: activeTopics.has(topicName),
      }));
    };

    // 1. Ingress Client Node
    n.push({
      id: 'node-client',
      type: 'clientNode',
      position: { x: 40, y: 190 },
      data: {
        label: 'Client Apps & Webhooks',
        activeRequests: activeServices.has('order-service') ? 1 : 0,
      },
    });

    // 2. Order Service
    n.push({
      id: 'node-order-service',
      type: 'serviceNode',
      position: { x: 300, y: 175 },
      data: {
        title: 'Order Service',
        role: 'producer',
        database: 'orders_db (PostgreSQL)',
        status: 'healthy',
        description: 'Receives HTTP order requests, generates UUIDs, and produces Murmur2 keyed events to Kafka.',
        isPulsing: activeServices.has('order-service'),
        lastEvent: activeServices.has('order-service') ? 'order.created → published' : undefined,
      },
    });

    // 3. Kafka Topic: orders.events
    const ordersPartitions = getTopicPartitions('orders.events');
    n.push({
      id: 'node-topic-orders',
      type: 'topicNode',
      position: { x: 620, y: 155 },
      data: {
        topic: 'orders.events',
        partitions: ordersPartitions,
        isPulsing: activeTopics.has('orders.events'),
      },
    });

    // 4. Consumer Group: inventory-service-group
    const invSummary = getGroupLagSummary('inventory-service-group');
    const invLag = invSummary?.totalLag || 0;
    n.push({
      id: 'node-group-inventory',
      type: 'consumerGroupNode',
      position: { x: 990, y: 165 },
      data: {
        groupId: 'inventory-service-group',
        topic: 'orders.events',
        state: invSummary?.state || 'Stable',
        membersCount: invSummary?.membersCount || 1,
        totalLag: invLag,
        isPulsing: activeTopics.has('orders.events'),
      },
    });

    // 5. Inventory Service
    n.push({
      id: 'node-inventory-service',
      type: 'serviceNode',
      position: { x: 1300, y: 175 },
      data: {
        title: 'Inventory Service',
        role: 'consumer',
        database: 'inventory_db (PostgreSQL)',
        status: invLag > 10 ? 'degraded' : 'healthy',
        description: 'Processes orders with transactional inbox deduplication, reserves stock, and publishes reservation results.',
        isPulsing: activeServices.has('inventory-service'),
        lastEvent: activeServices.has('inventory-service') ? 'inventory.reserved → published' : undefined,
      },
    });

    // 6. Kafka Topic: inventory.events
    const invPartitions = getTopicPartitions('inventory.events');
    n.push({
      id: 'node-topic-inventory',
      type: 'topicNode',
      position: { x: 1620, y: 155 },
      data: {
        topic: 'inventory.events',
        partitions: invPartitions,
        isPulsing: activeTopics.has('inventory.events'),
      },
    });

    // 7. Consumer Group: notification-worker-group
    const notifSummary = getGroupLagSummary('notification-worker-group');
    const notifLag = notifSummary?.totalLag || 0;
    n.push({
      id: 'node-group-notification',
      type: 'consumerGroupNode',
      position: { x: 1990, y: 165 },
      data: {
        groupId: 'notification-worker-group',
        topic: 'inventory.events',
        state: notifSummary?.state || 'Stable',
        membersCount: notifSummary?.membersCount || 1,
        totalLag: notifLag,
        isPulsing: activeTopics.has('inventory.events'),
      },
    });

    // 8. Notification Worker
    n.push({
      id: 'node-notification-worker',
      type: 'serviceNode',
      position: { x: 2300, y: 175 },
      data: {
        title: 'Notification Worker',
        role: 'consumer',
        database: 'notifications_db (PostgreSQL)',
        status: notifLag > 10 ? 'degraded' : 'healthy',
        description: 'Dispatches customer notifications with bounded exponential backoff retries and DLQ routing.',
        isPulsing: activeServices.has('notification-worker'),
        lastEvent: activeServices.has('notification-worker') ? 'notification.dispatched' : undefined,
      },
    });

    // 9. Dead Letter Queue: notifications.dlq
    const dlqPartitions = getTopicPartitions('notifications.dlq');
    const dlqTotalMessages = dlqPartitions.reduce((acc, p) => acc + parseInt(p.highWatermark || '0', 10), 0);
    n.push({
      id: 'node-dlq',
      type: 'dlqNode',
      position: { x: 2620, y: 280 },
      data: {
        topic: 'notifications.dlq',
        deadLetterCount: dlqTotalMessages,
        isPulsing: activeTopics.has('notifications.dlq'),
      },
    });

    // 10. Observability Service & Spans Topic
    const spanPartitions = getTopicPartitions('telemetry.spans');
    n.push({
      id: 'node-topic-spans',
      type: 'topicNode',
      position: { x: 1620, y: 390 },
      data: {
        topic: 'telemetry.spans',
        partitions: spanPartitions,
        isInternal: true,
        isPulsing: activeTopics.has('telemetry.spans'),
      },
    });

    n.push({
      id: 'node-observability-service',
      type: 'serviceNode',
      position: { x: 1990, y: 400 },
      data: {
        title: 'Observability Harvester',
        role: 'orchestrator',
        status: 'healthy',
        description: 'Collects distributed traces, calculates lag, and streams live metrics over WebSocket & Prometheus.',
        isPulsing: activeServices.has('observability-service') || recentSpans.length > 0,
      },
    });

    return n;
  }, [cluster, lagSummaries, activeTopics, activeServices, recentSpans.length]);

  // Construct Edges with dynamic pulse animation
  const edges: Edge[] = useMemo(() => {
    const isOrderActive = activeServices.has('order-service') || activeTopics.has('orders.events');
    const isInvActive = activeServices.has('inventory-service') || activeTopics.has('inventory.events');
    const isNotifActive = activeServices.has('notification-worker') || activeTopics.has('inventory.events');
    const isDlqActive = activeTopics.has('notifications.dlq');

    return [
      {
        id: 'e-client-order',
        source: 'node-client',
        target: 'node-order-service',
        animated: isOrderActive,
        label: 'HTTP POST /orders',
        style: { stroke: isOrderActive ? '#a855f7' : '#475569', strokeWidth: isOrderActive ? 3 : 1.5 },
      },
      {
        id: 'e-order-topic',
        source: 'node-order-service',
        target: 'node-topic-orders',
        animated: isOrderActive,
        label: 'Murmur2 Partition Hash',
        style: { stroke: isOrderActive ? '#06b6d4' : '#475569', strokeWidth: isOrderActive ? 3 : 1.5 },
      },
      {
        id: 'e-topic-invgroup',
        source: 'node-topic-orders',
        target: 'node-group-inventory',
        animated: isInvActive,
        label: 'Consume P0, P1, P2',
        style: { stroke: isInvActive ? '#10b981' : '#475569', strokeWidth: isInvActive ? 3 : 1.5 },
      },
      {
        id: 'e-invgroup-invsvc',
        source: 'node-group-inventory',
        target: 'node-inventory-service',
        animated: isInvActive,
        label: 'Inbox Deduplication',
        style: { stroke: isInvActive ? '#10b981' : '#475569', strokeWidth: isInvActive ? 3 : 1.5 },
      },
      {
        id: 'e-invsvc-invtopic',
        source: 'node-inventory-service',
        target: 'node-topic-inventory',
        animated: isInvActive,
        label: 'InventoryReserved',
        style: { stroke: isInvActive ? '#06b6d4' : '#475569', strokeWidth: isInvActive ? 3 : 1.5 },
      },
      {
        id: 'e-invtopic-notifgroup',
        source: 'node-topic-inventory',
        target: 'node-group-notification',
        animated: isNotifActive,
        label: 'Consume Partitions',
        style: { stroke: isNotifActive ? '#10b981' : '#475569', strokeWidth: isNotifActive ? 3 : 1.5 },
      },
      {
        id: 'e-notifgroup-notifsvc',
        source: 'node-group-notification',
        target: 'node-notification-worker',
        animated: isNotifActive,
        label: 'Dispatch Event',
        style: { stroke: isNotifActive ? '#10b981' : '#475569', strokeWidth: isNotifActive ? 3 : 1.5 },
      },
      {
        id: 'e-notifsvc-dlq',
        source: 'node-notification-worker',
        target: 'node-dlq',
        animated: isDlqActive,
        label: '3 Retries Failed → DLQ',
        style: { stroke: '#ef4444', strokeWidth: isDlqActive ? 3 : 1.5, strokeDasharray: '5,5' },
      },
      {
        id: 'e-spans-obs',
        source: 'node-topic-spans',
        target: 'node-observability-service',
        animated: true,
        label: 'Trace Harvest',
        style: { stroke: '#818cf8', strokeWidth: 1.5 },
      },
    ];
  }, [activeServices, activeTopics]);

  return (
    <div
      className="glass-panel"
      style={{
        position: 'relative',
        width: '100%',
        height: '620px',
        overflow: 'hidden',
        border: '1px solid var(--border-subtle)',
        borderRadius: '12px',
      }}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        minZoom={0.2}
        maxZoom={1.5}
        onNodeClick={(_, node) => {
          setSelectedNodeData({
            id: node.id,
            type: node.type || 'unknown',
            data: node.data,
          });
        }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="rgba(255, 255, 255, 0.08)" />
        <Controls
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '8px',
            fill: '#ffffff',
          }}
        />
        <MiniMap
          nodeStrokeWidth={3}
          zoomable
          pannable
          style={{
            background: 'rgba(7, 9, 14, 0.85)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '8px',
          }}
          nodeColor={(n) => {
            if (n.type === 'topicNode') return '#06b6d4';
            if (n.type === 'serviceNode') return '#818cf8';
            if (n.type === 'consumerGroupNode') return '#10b981';
            if (n.type === 'dlqNode') return '#ef4444';
            return '#a855f7';
          }}
        />

        {/* Top Control Bar Panel */}
        <Panel position="top-left">
          <div
            className="glass-panel"
            style={{
              padding: '8px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              fontSize: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span className="pulse-emerald" style={{ width: '8px', height: '8px' }} />
              <span style={{ fontWeight: 600, color: '#ffffff' }}>KRaft Quorum Active</span>
            </div>
            <span style={{ color: 'var(--border-subtle)' }}>|</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
              <Layers size={14} color="#06b6d4" />
              <span>{cluster?.topics.length || 0} Registered Topics</span>
            </div>
            <span style={{ color: 'var(--border-subtle)' }}>|</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
              <Users size={14} color="#10b981" />
              <span>{lagSummaries.length || 0} Monitored Groups</span>
            </div>
          </div>
        </Panel>

        {/* Legend Panel */}
        <Panel position="bottom-left">
          <div
            className="glass-panel"
            style={{
              padding: '8px 12px',
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              fontSize: '11px',
              color: 'var(--text-secondary)',
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#a855f7' }} />
              Client Ingress
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#818cf8' }} />
              Microservice
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#06b6d4' }} />
              Kafka Topic
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }} />
              Consumer Group
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444' }} />
              Dead Letter Queue
            </span>
          </div>
        </Panel>
      </ReactFlow>

      {/* Interactive Inspector Drawer (when node is clicked) */}
      {selectedNodeData && (
        <aside
          className="glass-panel"
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            bottom: '16px',
            width: '380px',
            zIndex: 10,
            padding: '20px',
            overflowY: 'auto',
            boxShadow: '0 10px 40px rgba(0, 0, 0, 0.6)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Info size={18} color="#818cf8" />
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#ffffff' }}>Node Telemetry Inspector</h3>
            </div>
            <button
              onClick={() => setSelectedNodeData(null)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '4px',
              }}
            >
              <X size={18} />
            </button>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Node Identifier</span>
            <p style={{ fontSize: '13px', fontWeight: 600, fontFamily: 'var(--font-mono)', color: '#ffffff' }}>
              {selectedNodeData.id}
            </p>
            <span className="badge badge-indigo" style={{ marginTop: '4px' }}>
              {selectedNodeData.type}
            </span>
          </div>

          {/* Detailed Inspector Breakdown */}
          <div style={{ flex: 1 }}>
            {selectedNodeData.type === 'topicNode' && (
              <div>
                <h4 style={{ fontSize: '12px', fontWeight: 600, color: '#94a3b8', marginBottom: '8px' }}>
                  Partitions & High Watermarks
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {selectedNodeData.data.partitions.map((p: any) => (
                    <div
                      key={p.partitionId}
                      style={{
                        padding: '10px',
                        background: 'rgba(0, 0, 0, 0.3)',
                        borderRadius: '8px',
                        border: '1px solid var(--border-subtle)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ color: '#38bdf8', fontWeight: 700 }}>Partition {p.partitionId}</span>
                        <span style={{ color: 'var(--text-muted)' }}>Leader: Broker {p.leader}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Log-End High Watermark:</span>
                        <span style={{ fontFamily: 'var(--font-mono)', color: '#ffffff', fontWeight: 600 }}>
                          {p.highWatermark || '0'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selectedNodeData.type === 'consumerGroupNode' && (
              <div>
                <h4 style={{ fontSize: '12px', fontWeight: 600, color: '#94a3b8', marginBottom: '8px' }}>
                  Consumer Group Metrics
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ padding: '10px', background: 'rgba(0, 0, 0, 0.3)', borderRadius: '8px' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Subscribed Topic</div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#ffffff', fontFamily: 'var(--font-mono)' }}>
                      {selectedNodeData.data.topic}
                    </div>
                  </div>
                  <div style={{ padding: '10px', background: 'rgba(0, 0, 0, 0.3)', borderRadius: '8px' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Current Unprocessed Lag</div>
                    <div style={{ fontSize: '18px', fontWeight: 700, color: selectedNodeData.data.totalLag === 0 ? '#34d399' : '#f87171' }}>
                      {selectedNodeData.data.totalLag} messages
                    </div>
                  </div>
                  <div style={{ padding: '10px', background: 'rgba(0, 0, 0, 0.3)', borderRadius: '8px' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Rebalance Protocol State</div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#ffffff' }}>
                      {selectedNodeData.data.state}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {selectedNodeData.type === 'serviceNode' && (
              <div>
                <h4 style={{ fontSize: '12px', fontWeight: 600, color: '#94a3b8', marginBottom: '8px' }}>
                  Service Architecture
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    {selectedNodeData.data.description}
                  </p>
                  {selectedNodeData.data.database && (
                    <div style={{ padding: '10px', background: 'rgba(0, 0, 0, 0.3)', borderRadius: '8px' }}>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Backing Database</div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: '#60a5fa', fontFamily: 'var(--font-mono)' }}>
                        {selectedNodeData.data.database}
                      </div>
                    </div>
                  )}
                  <div style={{ padding: '10px', background: 'rgba(0, 0, 0, 0.3)', borderRadius: '8px' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Execution Health</div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#34d399' }}>
                      {selectedNodeData.data.status.toUpperCase()}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {selectedNodeData.type === 'dlqNode' && (
              <div>
                <h4 style={{ fontSize: '12px', fontWeight: 600, color: '#ef4444', marginBottom: '8px' }}>
                  Dead-Letter Quarantine
                </h4>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                  Messages routed here exceeded bounded retries (3 attempts with exponential backoff) due to fatal parsing
                  or processing errors.
                </p>
                <div style={{ padding: '10px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                  <div style={{ fontSize: '11px', color: '#fca5a5' }}>Quarantined Poison Pills</div>
                  <div style={{ fontSize: '20px', fontWeight: 800, color: '#ef4444' }}>
                    {selectedNodeData.data.deadLetterCount} messages
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Raw JSON viewer */}
          <details style={{ marginTop: '16px' }}>
            <summary style={{ fontSize: '11px', color: 'var(--text-muted)', cursor: 'pointer', marginBottom: '8px' }}>
              Raw Node State JSON
            </summary>
            <pre
              style={{
                fontSize: '10px',
                fontFamily: 'var(--font-mono)',
                color: '#94a3b8',
                background: 'rgba(0, 0, 0, 0.5)',
                padding: '10px',
                borderRadius: '6px',
                overflowX: 'auto',
                maxHeight: '180px',
              }}
            >
              {JSON.stringify(selectedNodeData.data, null, 2)}
            </pre>
          </details>
        </aside>
      )}
    </div>
  );
}
