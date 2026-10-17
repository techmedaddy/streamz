'use client';

import React, { useState } from 'react';
import {
  Layers,
  Hash,
  ArrowRight,
  Database,
  Info,
  CheckCircle2,
  HardDrive,
  Cpu,
  RefreshCw,
} from 'lucide-react';
import { computePartition } from '../../hooks/useInventoryApi';

export function TopicInspector() {
  const [calculatorInput, setCalculatorInput] = useState<string>('ord-d9f7896f');
  const [numPartitions, setNumPartitions] = useState<number>(3);

  const { hash, partition } = computePartition(calculatorInput, numPartitions);

  const topics = [
    {
      name: 'orders',
      partitions: 3,
      replicationFactor: 1,
      retentionPolicy: 'delete (7 days)',
      producerService: 'Order Service (:3001)',
      consumerGroup: 'inventory-workers',
      purpose: 'Inbound customer order requests dispatched from REST API.',
      eventTypes: ['OrderCreated'],
      segmentSize: '1 GB',
    },
    {
      name: 'inventory-events',
      partitions: 3,
      replicationFactor: 1,
      retentionPolicy: 'delete (7 days)',
      producerService: 'Inventory Service (:3002)',
      consumerGroup: 'order-workers',
      purpose: 'Stock reservation and rejection outcomes produced after atomic row locks.',
      eventTypes: ['InventoryReserved', 'InventoryRejected'],
      segmentSize: '1 GB',
    },
    {
      name: 'order-events',
      partitions: 3,
      replicationFactor: 1,
      retentionPolicy: 'delete (7 days)',
      producerService: 'Order Service (:3001)',
      consumerGroup: 'notification-workers',
      purpose: 'Final order state transitions published for downstream notification and fulfillment.',
      eventTypes: ['OrderConfirmed', 'OrderRejected'],
      segmentSize: '1 GB',
    },
    {
      name: 'notifications-dlq',
      partitions: 1,
      replicationFactor: 1,
      retentionPolicy: 'compact (Indefinite)',
      producerService: 'Notification Worker (:3003)',
      consumerGroup: 'admin-audit',
      purpose: 'Dead Letter Queue storing failed notifications, poison pills, and unrecoverable errors.',
      eventTypes: ['NotificationFailed', 'PoisonPillDetected'],
      segmentSize: '512 MB',
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      {/* ── Title & Intro ──────────────────────────────────────────────── */}
      <div>
        <p className="kicker">CLUSTER METADATA & PARTITIONING</p>
        <h1
          style={{
            fontSize: '24px',
            fontWeight: 700,
            color: 'var(--text-main)',
            letterSpacing: '-0.02em',
            marginTop: '4px',
          }}
        >
          Kafka Cluster Topics & Partition Inspector
        </h1>
        <p
          style={{
            fontSize: '13px',
            color: 'var(--text-secondary)',
            marginTop: '4px',
            maxWidth: '840px',
            lineHeight: 1.5,
          }}
        >
          Inspect the physical topic sharding, partition counts, consumer group subscriptions, and Murmur2 key routing logic governing the Streamz cluster.
        </p>
      </div>

      {/* ── Interactive Murmur2 Calculator ─────────────────────────────── */}
      <div
        className="card"
        style={{
          padding: '24px',
          borderLeftWidth: '4px',
          borderLeftColor: 'var(--emerald-solid)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <Hash size={18} color="var(--emerald-solid)" />
          <h2 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-main)' }}>
            Live Murmur2 Partition Calculator
          </h2>
        </div>
        <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginBottom: '18px', lineHeight: 1.5 }}>
          In Kafka, records with the same partition key always land on the exact same partition. Type any key below to test the exact 32-bit Murmur2 hashing algorithm used by KafkaJS and Java Kafka clients.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px', marginBottom: '20px' }}>
          <div>
            <label
              style={{
                fontSize: '11.5px',
                fontWeight: 600,
                color: 'var(--text-secondary)',
                display: 'block',
                marginBottom: '6px',
              }}
            >
              Test Partition Key (e.g., Order ID, Customer ID, SKU)
            </label>
            <input
              type="text"
              value={calculatorInput}
              onChange={(e) => setCalculatorInput(e.target.value)}
              placeholder="e.g. ord-d9f7896f"
              className="font-mono"
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-default)',
                fontSize: '13px',
                backgroundColor: '#ffffff',
              }}
            />
          </div>

          <div>
            <label
              style={{
                fontSize: '11.5px',
                fontWeight: 600,
                color: 'var(--text-secondary)',
                display: 'block',
                marginBottom: '6px',
              }}
            >
              Target Topic Partitions
            </label>
            <select
              value={numPartitions}
              onChange={(e) => setNumPartitions(parseInt(e.target.value) || 3)}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-default)',
                fontSize: '13px',
                backgroundColor: '#ffffff',
              }}
            >
              <option value={1}>1 Partition (Single Shard)</option>
              <option value={3}>3 Partitions (Default Streamz)</option>
              <option value={6}>6 Partitions (High Scale)</option>
              <option value={12}>12 Partitions (Enterprise)</option>
            </select>
          </div>
        </div>

        {/* Calculation Result Breakdown */}
        <div
          style={{
            backgroundColor: 'var(--bg-subtle)',
            borderRadius: 'var(--radius-sm)',
            padding: '16px',
            border: '1px solid var(--border-default)',
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '16px',
          }}
        >
          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Serialized Key
            </div>
            <div className="font-mono" style={{ fontSize: '13px', fontWeight: 600, marginTop: '4px' }}>
              &quot;{calculatorInput}&quot;
            </div>
          </div>

          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Murmur2 Hash (Hex)
            </div>
            <div className="font-mono" style={{ fontSize: '13px', fontWeight: 600, marginTop: '4px', color: 'var(--text-main)' }}>
              0x{hash.toString(16).toUpperCase()}
            </div>
          </div>

          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Positive Int32
            </div>
            <div className="font-mono" style={{ fontSize: '13px', fontWeight: 600, marginTop: '4px' }}>
              {hash}
            </div>
          </div>

          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Assigned Partition
            </div>
            <div
              className="font-mono"
              style={{
                fontSize: '14px',
                fontWeight: 700,
                marginTop: '4px',
                color: 'var(--emerald-text)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <span>Partition {partition}</span>
              <span
                style={{
                  fontSize: '10px',
                  backgroundColor: 'var(--emerald-subtle)',
                  padding: '1px 6px',
                  borderRadius: '3px',
                  border: '1px solid var(--border-emerald)',
                }}
              >
                P{partition}
              </span>
            </div>
          </div>
        </div>

        {/* Partition Target Visualizer */}
        <div style={{ marginTop: '16px', display: 'flex', gap: '8px' }}>
          {Array.from({ length: numPartitions }).map((_, pIdx) => {
            const isTarget = pIdx === partition;
            return (
              <div
                key={pIdx}
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-sm)',
                  border: isTarget ? '2px solid var(--emerald-solid)' : '1px solid var(--border-default)',
                  backgroundColor: isTarget ? 'var(--emerald-subtle)' : '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <HardDrive size={14} color={isTarget ? 'var(--emerald-solid)' : 'var(--text-muted)'} />
                  <span
                    className="font-mono"
                    style={{
                      fontSize: '12px',
                      fontWeight: isTarget ? 700 : 500,
                      color: isTarget ? 'var(--emerald-text)' : 'var(--text-secondary)',
                    }}
                  >
                    Partition {pIdx}
                  </span>
                </div>
                {isTarget && (
                  <span
                    style={{
                      fontSize: '10px',
                      fontWeight: 700,
                      color: 'var(--emerald-text)',
                      textTransform: 'uppercase',
                    }}
                  >
                    Target Shard
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Cluster Topics Roster ──────────────────────────────────────── */}
      <div>
        <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '14px' }}>
          Streamz Active Cluster Topics (4 Topics)
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {topics.map((t) => (
            <div key={t.name} className="card" style={{ padding: '20px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '10px',
                  flexWrap: 'wrap',
                  gap: '8px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span
                    className="font-mono"
                    style={{
                      fontSize: '14px',
                      fontWeight: 700,
                      color: 'var(--text-main)',
                      backgroundColor: 'var(--bg-subtle)',
                      padding: '3px 8px',
                      borderRadius: '4px',
                      border: '1px solid var(--border-default)',
                    }}
                  >
                    {t.name}
                  </span>
                  <span
                    className="badge font-mono"
                    style={{
                      backgroundColor: '#eff6ff',
                      color: '#1d4ed8',
                      border: '1px solid #bfdbfe',
                    }}
                  >
                    {t.partitions} Partitions
                  </span>
                  <span
                    className="badge font-mono"
                    style={{
                      backgroundColor: 'var(--bg-subtle)',
                      color: 'var(--text-secondary)',
                      border: '1px solid var(--border-default)',
                    }}
                  >
                    RF={t.replicationFactor}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', color: 'var(--text-muted)' }}>
                  <span>Cleanup:</span>
                  <code className="font-mono" style={{ color: 'var(--text-main)', fontWeight: 600 }}>{t.retentionPolicy}</code>
                </div>
              </div>

              <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginBottom: '14px', lineHeight: 1.5 }}>
                {t.purpose}
              </p>

              {/* Grid Metadata */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '12px',
                  backgroundColor: 'var(--bg-subtle)',
                  padding: '12px 14px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '12px',
                }}
              >
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase' }}>
                    Producer Service
                  </div>
                  <div style={{ fontWeight: 500, color: 'var(--text-main)', marginTop: '2px' }}>
                    {t.producerService}
                  </div>
                </div>

                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase' }}>
                    Consumer Group
                  </div>
                  <div className="font-mono" style={{ fontWeight: 600, color: 'var(--emerald-text)', marginTop: '2px' }}>
                    {t.consumerGroup}
                  </div>
                </div>

                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase' }}>
                    Wire Events
                  </div>
                  <div style={{ marginTop: '2px', display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                    {t.eventTypes.map((e) => (
                      <span
                        key={e}
                        className="font-mono"
                        style={{
                          fontSize: '10px',
                          backgroundColor: '#ffffff',
                          padding: '1px 5px',
                          borderRadius: '3px',
                          border: '1px solid var(--border-default)',
                        }}
                      >
                        {e}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
