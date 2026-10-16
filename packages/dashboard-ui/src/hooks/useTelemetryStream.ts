'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

export interface BrokerInfo {
  nodeId: number;
  host: string;
  port: number;
  isController: boolean;
}

export interface PartitionMetadata {
  partitionId: number;
  leader: number;
  replicas: number[];
  isr: number[];
  offlineReplicas: number[];
  highWatermark?: string;
}

export interface TopicSummary {
  name: string;
  isInternal: boolean;
  partitionCount: number;
  partitions: PartitionMetadata[];
}

export interface ClusterOverview {
  clusterId: string;
  controllerBrokerId: number | null;
  brokers: BrokerInfo[];
  topics: TopicSummary[];
  totalPartitions: number;
  healthy: boolean;
  timestamp: string;
}

export interface PartitionLagDetail {
  partition: number;
  logEndOffset: string;
  committedOffset: string;
  lag: number;
  isAssigned: boolean;
  assignedMemberId?: string;
  assignedClientId?: string;
}

export interface TopicLagDetail {
  topic: string;
  partitions: PartitionLagDetail[];
  topicLag: number;
}

export interface ConsumerGroupLagSummary {
  groupId: string;
  state: string;
  membersCount: number;
  totalLag: number;
  isStalled: boolean;
  hasUnassignedPartitionsWithLag: boolean;
  topics: TopicLagDetail[];
}

export interface EventTraceSpan {
  spanId: string;
  traceId: string;
  correlationId: string;
  aggregateId: string;
  eventType: string;
  service: string;
  stage: 'PRODUCED' | 'CONSUMING' | 'PROCESSED' | 'FAILED';
  durationMs?: number;
  error?: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

export function useTelemetryStream(
  url = process.env.NEXT_PUBLIC_OBSERVABILITY_WS_URL || 'ws://localhost:3004/ws/telemetry'
) {
  const [connected, setConnected] = useState(false);
  const [cluster, setCluster] = useState<ClusterOverview | null>(null);
  const [lagSummaries, setLagSummaries] = useState<ConsumerGroupLagSummary[]>([]);
  const [recentSpans, setRecentSpans] = useState<EventTraceSpan[]>([]);
  const [lastHeartbeat, setLastHeartbeat] = useState<string | null>(null);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(() => {
    if (typeof window === 'undefined') return;

    try {
      const socket = new WebSocket(url);
      wsRef.current = socket;

      socket.onopen = () => {
        setConnected(true);
        setReconnectAttempts(0);
      };

      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);

          if (message.type === 'CONNECTED') {
            setConnected(true);
          } else if (message.type === 'CLUSTER_SNAPSHOT') {
            setCluster(message.payload.cluster);
            setLagSummaries(message.payload.lagSummaries || []);
            setLastHeartbeat(message.timestamp);
          } else if (message.type === 'EVENT_SPAN') {
            setRecentSpans((prev) => [message.payload, ...prev.slice(0, 49)]);
          }
        } catch {
          // Ignore invalid frames
        }
      };

      socket.onclose = () => {
        setConnected(false);
        wsRef.current = null;
        // Schedule auto-reconnect with 2s delay
        reconnectTimerRef.current = setTimeout(() => {
          setReconnectAttempts((a) => a + 1);
          connect();
        }, 2000);
      };

      socket.onerror = () => {
        setConnected(false);
        try {
          socket.close();
        } catch {}
      };
    } catch {
      setConnected(false);
      reconnectTimerRef.current = setTimeout(() => {
        setReconnectAttempts((a) => a + 1);
        connect();
      }, 3000);
    }
  }, [url]);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect]);

  const clearSpans = useCallback(() => {
    setRecentSpans([]);
  }, []);

  return {
    connected,
    cluster,
    lagSummaries,
    recentSpans,
    lastHeartbeat,
    reconnectAttempts,
    clearSpans,
  };
}
