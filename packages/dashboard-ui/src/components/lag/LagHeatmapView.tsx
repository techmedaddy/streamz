'use client';

import React, { useState, useMemo } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Filter,
  Layers,
  Search,
  Users,
  Cpu,
  Flame,
  ArrowUpRight,
  TrendingUp,
  Server,
  Info,
} from 'lucide-react';
import {
  ConsumerGroupLagSummary,
  ClusterOverview,
  PartitionLagDetail,
} from '../../hooks/useTelemetryStream';

interface LagHeatmapViewProps {
  lagSummaries: ConsumerGroupLagSummary[];
  cluster: ClusterOverview | null;
}

export function LagHeatmapView({ lagSummaries, cluster }: LagHeatmapViewProps) {
  const [filterGroup, setFilterGroup] = useState<string>('ALL');
  const [filterSeverity, setFilterSeverity] = useState<'ALL' | 'HEALTHY' | 'LAGGING'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPartition, setSelectedPartition] = useState<{
    groupId: string;
    topic: string;
    partition: PartitionLagDetail;
  } | null>(null);

  // Compute Aggregate Stats
  const totalClusterLag = useMemo(() => {
    return lagSummaries.reduce((sum, g) => sum + g.totalLag, 0);
  }, [lagSummaries]);

  const stalledGroupsCount = useMemo(() => {
    return lagSummaries.filter((g) => g.isStalled || g.hasUnassignedPartitionsWithLag).length;
  }, [lagSummaries]);

  const totalAssignedPartitions = useMemo(() => {
    let count = 0;
    for (const g of lagSummaries) {
      for (const t of g.topics) {
        count += t.partitions.filter((p) => p.isAssigned).length;
      }
    }
    return count;
  }, [lagSummaries]);

  // Filter groups
  const filteredSummaries = useMemo(() => {
    return lagSummaries.filter((g) => {
      if (filterGroup !== 'ALL' && g.groupId !== filterGroup) return false;
      if (filterSeverity === 'HEALTHY' && g.totalLag > 0) return false;
      if (filterSeverity === 'LAGGING' && g.totalLag === 0) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesGroup = g.groupId.toLowerCase().includes(q);
        const matchesTopic = g.topics.some((t) => t.topic.toLowerCase().includes(q));
        if (!matchesGroup && !matchesTopic) return false;
      }
      return true;
    });
  }, [lagSummaries, filterGroup, filterSeverity, searchQuery]);

  // Color helper for lag severity
  const getLagColorMeta = (lag: number) => {
    if (lag === 0) {
      return {
        bg: 'rgba(16, 185, 129, 0.1)',
        border: 'rgba(16, 185, 129, 0.3)',
        text: '#34d399',
        badge: 'badge-emerald',
        label: 'Optimal',
      };
    }
    if (lag <= 10) {
      return {
        bg: 'rgba(245, 158, 11, 0.12)',
        border: 'rgba(245, 158, 11, 0.35)',
        text: '#fbbf24',
        badge: 'badge-amber',
        label: 'Moderate Lag',
      };
    }
    return {
      bg: 'rgba(239, 68, 68, 0.18)',
      border: 'rgba(239, 68, 68, 0.5)',
      text: '#f87171',
      badge: 'badge-crimson',
      label: 'High Backlog',
    };
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top Header & Overview */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#ffffff' }}>
            Consumer Group Lag & Partition Heatmap
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            Real-time differential tracking between Kafka Log-End High Watermarks and Consumer Committed Offsets.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="badge badge-indigo">
            <Layers size={13} /> Kafka Log Engine
          </span>
          <span className={`badge ${totalClusterLag === 0 ? 'badge-emerald' : 'badge-amber'}`}>
            <span className="pulse-emerald" style={{ width: '6px', height: '6px' }} />
            {totalClusterLag === 0 ? 'All Consumers Caught Up' : `${totalClusterLag} Messages Pending`}
          </span>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '16px',
        }}
      >
        <div className="glass-panel" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Total Unprocessed Lag</span>
            <Activity size={18} color={totalClusterLag === 0 ? '#34d399' : '#fbbf24'} />
          </div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: totalClusterLag === 0 ? '#34d399' : '#fbbf24' }}>
            {totalClusterLag}
            <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-muted)', marginLeft: '6px' }}>
              messages
            </span>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Across all consumer group partitions
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Monitored Consumer Groups</span>
            <Users size={18} color="#818cf8" />
          </div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: '#ffffff' }}>
            {lagSummaries.length}
            <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-muted)', marginLeft: '6px' }}>
              active groups
            </span>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Coordinated via Kafka Group Coordinator
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Rebalance & Stall Health</span>
            <CheckCircle2 size={18} color={stalledGroupsCount === 0 ? '#34d399' : '#f87171'} />
          </div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: stalledGroupsCount === 0 ? '#34d399' : '#f87171' }}>
            {stalledGroupsCount === 0 ? '100% Stable' : `${stalledGroupsCount} Stalled`}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            {stalledGroupsCount === 0 ? 'Zero unassigned backlog partitions' : 'Immediate attention required'}
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Partition Distribution</span>
            <Cpu size={18} color="#22d3ee" />
          </div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: '#22d3ee' }}>
            {totalAssignedPartitions}
            <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-muted)', marginLeft: '6px' }}>
              active partitions
            </span>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            RoundRobin / Range assignment
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div
        className="glass-panel"
        style={{
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: '280px' }}>
          <Search size={16} color="var(--text-muted)" />
          <input
            type="text"
            placeholder="Filter by group ID or topic name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: '#ffffff',
              fontSize: '13px',
              width: '100%',
              fontFamily: 'var(--font-sans)',
            }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Group:</span>
            <select
              value={filterGroup}
              onChange={(e) => setFilterGroup(e.target.value)}
              style={{
                background: 'rgba(0, 0, 0, 0.4)',
                color: '#ffffff',
                border: '1px solid var(--border-subtle)',
                borderRadius: '6px',
                padding: '6px 10px',
                fontSize: '12px',
                cursor: 'pointer',
              }}
            >
              <option value="ALL">All Consumer Groups</option>
              {lagSummaries.map((g) => (
                <option key={g.groupId} value={g.groupId}>
                  {g.groupId}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Severity:</span>
            <select
              value={filterSeverity}
              onChange={(e) => setFilterSeverity(e.target.value as any)}
              style={{
                background: 'rgba(0, 0, 0, 0.4)',
                color: '#ffffff',
                border: '1px solid var(--border-subtle)',
                borderRadius: '6px',
                padding: '6px 10px',
                fontSize: '12px',
                cursor: 'pointer',
              }}
            >
              <option value="ALL">All Severities</option>
              <option value="HEALTHY">Healthy (0 Lag)</option>
              <option value="LAGGING">Lagging (&gt; 0)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Consumer Group Lag & Heatmap Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {filteredSummaries.length === 0 ? (
          <div
            className="glass-panel"
            style={{
              padding: '48px',
              textAlign: 'center',
              color: 'var(--text-muted)',
            }}
          >
            <Activity size={36} color="var(--text-muted)" style={{ margin: '0 auto 12px' }} />
            <p style={{ fontSize: '14px', fontWeight: 500, color: '#ffffff' }}>No matching consumer groups</p>
            <p style={{ fontSize: '12px', marginTop: '4px' }}>
              Ensure microservices are actively polling or adjust filter criteria.
            </p>
          </div>
        ) : (
          filteredSummaries.map((group) => {
            const isGroupLagging = group.totalLag > 0;
            const groupColor = getLagColorMeta(group.totalLag);

            return (
              <div
                key={group.groupId}
                className="glass-panel"
                style={{
                  padding: '24px',
                  borderLeft: `4px solid ${groupColor.text}`,
                }}
              >
                {/* Group Summary Row */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '18px',
                    flexWrap: 'wrap',
                    gap: '12px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div
                      style={{
                        width: '42px',
                        height: '42px',
                        borderRadius: '10px',
                        background: groupColor.bg,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: `1px solid ${groupColor.border}`,
                      }}
                    >
                      <Users size={20} color={groupColor.text} />
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <h2
                          style={{
                            fontSize: '16px',
                            fontWeight: 700,
                            fontFamily: 'var(--font-mono)',
                            color: '#ffffff',
                          }}
                        >
                          {group.groupId}
                        </h2>
                        <span className="badge badge-indigo" style={{ fontSize: '11px' }}>
                          State: {group.state}
                        </span>
                        {group.isStalled && (
                          <span className="badge badge-crimson" style={{ fontSize: '11px' }}>
                            <AlertTriangle size={12} /> Stalled Group
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        Active Members: <strong style={{ color: '#ffffff' }}>{group.membersCount}</strong> • Subscribed
                        Topics: <strong style={{ color: '#ffffff' }}>{group.topics.length}</strong>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Total Group Lag</div>
                      <div style={{ fontSize: '20px', fontWeight: 800, color: groupColor.text }}>
                        {group.totalLag} <span style={{ fontSize: '12px', fontWeight: 500 }}>msgs</span>
                      </div>
                    </div>
                    <span className={`badge ${groupColor.badge}`}>{groupColor.label}</span>
                  </div>
                </div>

                {/* Topics Heatmap Grids */}
                {group.topics.map((topicDetail) => (
                  <div
                    key={topicDetail.topic}
                    style={{
                      background: 'rgba(0, 0, 0, 0.28)',
                      borderRadius: '10px',
                      padding: '18px',
                      marginTop: '12px',
                      border: '1px solid rgba(255, 255, 255, 0.05)',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: '14px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Layers size={16} color="#06b6d4" />
                        <span
                          style={{
                            fontSize: '13px',
                            fontWeight: 600,
                            fontFamily: 'var(--font-mono)',
                            color: '#ffffff',
                          }}
                        >
                          {topicDetail.topic}
                        </span>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          ({topicDetail.partitions.length} partitions)
                        </span>
                      </div>
                      <span
                        style={{
                          fontSize: '12px',
                          color: topicDetail.topicLag > 0 ? '#fbbf24' : '#34d399',
                          fontWeight: 600,
                        }}
                      >
                        Topic Lag: {topicDetail.topicLag} msgs
                      </span>
                    </div>

                    {/* Partition Heatmap Matrix */}
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                        gap: '12px',
                      }}
                    >
                      {topicDetail.partitions.map((p) => {
                        const pColor = getLagColorMeta(p.lag);
                        const logEnd = parseInt(p.logEndOffset, 10) || 0;
                        const committed = parseInt(p.committedOffset, 10) || 0;
                        const percentage = logEnd > 0 ? Math.min(100, Math.round((committed / logEnd) * 100)) : 100;

                        return (
                          <div
                            key={p.partition}
                            onClick={() =>
                              setSelectedPartition({
                                groupId: group.groupId,
                                topic: topicDetail.topic,
                                partition: p,
                              })
                            }
                            style={{
                              background: pColor.bg,
                              border: `1px solid ${pColor.border}`,
                              borderRadius: '8px',
                              padding: '14px',
                              cursor: 'pointer',
                              transition: 'all 0.15s ease',
                              position: 'relative',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.transform = 'translateY(-2px)';
                              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.transform = 'none';
                              e.currentTarget.style.borderColor = pColor.border;
                            }}
                          >
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                marginBottom: '10px',
                              }}
                            >
                              <span
                                style={{
                                  fontSize: '12px',
                                  fontWeight: 700,
                                  color: '#ffffff',
                                  fontFamily: 'var(--font-mono)',
                                }}
                              >
                                Partition {p.partition}
                              </span>
                              <span
                                className={`badge ${pColor.badge}`}
                                style={{ fontSize: '10px', padding: '2px 6px' }}
                              >
                                Lag: {p.lag}
                              </span>
                            </div>

                            {/* Consumption Progress Gauge */}
                            <div style={{ marginBottom: '8px' }}>
                              <div
                                style={{
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  fontSize: '10px',
                                  color: 'var(--text-muted)',
                                  marginBottom: '3px',
                                }}
                              >
                                <span>Consumption</span>
                                <span style={{ fontWeight: 600, color: pColor.text }}>{percentage}%</span>
                              </div>
                              <div
                                style={{
                                  width: '100%',
                                  height: '4px',
                                  background: 'rgba(255, 255, 255, 0.08)',
                                  borderRadius: '2px',
                                  overflow: 'hidden',
                                }}
                              >
                                <div
                                  style={{
                                    width: `${percentage}%`,
                                    height: '100%',
                                    background: pColor.text,
                                    borderRadius: '2px',
                                    transition: 'width 0.3s ease',
                                  }}
                                />
                              </div>
                            </div>

                            {/* Offset stats */}
                            <div
                              style={{
                                fontSize: '11px',
                                fontFamily: 'var(--font-mono)',
                                color: 'var(--text-secondary)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '2px',
                              }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: 'var(--text-muted)' }}>High Watermark:</span>
                                <span style={{ color: '#ffffff' }}>{p.logEndOffset}</span>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: 'var(--text-muted)' }}>Committed Offset:</span>
                                <span style={{ color: '#ffffff' }}>{p.committedOffset}</span>
                              </div>
                            </div>

                            {/* Assignment Indicator */}
                            <div
                              style={{
                                marginTop: '10px',
                                paddingTop: '8px',
                                borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                fontSize: '10px',
                              }}
                            >
                              <span style={{ color: 'var(--text-muted)' }}>Assigned:</span>
                              {p.isAssigned ? (
                                <span style={{ color: '#34d399', fontWeight: 600 }}>✓ Active Worker</span>
                              ) : (
                                <span style={{ color: '#f87171', fontWeight: 600 }}>✗ Unassigned</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            );
          })
        )}
      </div>

      {/* Selected Partition Detail Modal / Inspector */}
      {selectedPartition && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(8px)',
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
          onClick={() => setSelectedPartition(null)}
        >
          <div
            className="glass-panel"
            style={{
              maxWidth: '520px',
              width: '100%',
              padding: '28px',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.8)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    padding: '8px',
                    borderRadius: '8px',
                    background: 'rgba(99, 102, 241, 0.2)',
                  }}
                >
                  <Info size={20} color="#818cf8" />
                </div>
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#ffffff' }}>
                    Partition Telemetry Inspector
                  </h3>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    Detailed partition offset & consumer allocation
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSelectedPartition(null)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  fontSize: '18px',
                  cursor: 'pointer',
                }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ padding: '12px', background: 'rgba(0, 0, 0, 0.3)', borderRadius: '8px' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Consumer Group</div>
                <div style={{ fontSize: '14px', fontWeight: 600, fontFamily: 'var(--font-mono)', color: '#ffffff' }}>
                  {selectedPartition.groupId}
                </div>
              </div>

              <div style={{ padding: '12px', background: 'rgba(0, 0, 0, 0.3)', borderRadius: '8px' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Topic & Partition</div>
                <div style={{ fontSize: '14px', fontWeight: 600, fontFamily: 'var(--font-mono)', color: '#06b6d4' }}>
                  {selectedPartition.topic} — Partition {selectedPartition.partition.partition}
                </div>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '12px',
                }}
              >
                <div style={{ padding: '12px', background: 'rgba(0, 0, 0, 0.3)', borderRadius: '8px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Log-End High Watermark</div>
                  <div style={{ fontSize: '18px', fontWeight: 700, fontFamily: 'var(--font-mono)', color: '#ffffff' }}>
                    {selectedPartition.partition.logEndOffset}
                  </div>
                </div>
                <div style={{ padding: '12px', background: 'rgba(0, 0, 0, 0.3)', borderRadius: '8px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Committed Offset</div>
                  <div style={{ fontSize: '18px', fontWeight: 700, fontFamily: 'var(--font-mono)', color: '#ffffff' }}>
                    {selectedPartition.partition.committedOffset}
                  </div>
                </div>
              </div>

              <div style={{ padding: '12px', background: 'rgba(0, 0, 0, 0.3)', borderRadius: '8px' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Current Unprocessed Lag</div>
                <div
                  style={{
                    fontSize: '22px',
                    fontWeight: 800,
                    color: selectedPartition.partition.lag === 0 ? '#34d399' : '#f87171',
                  }}
                >
                  {selectedPartition.partition.lag} messages
                </div>
              </div>

              <div style={{ padding: '12px', background: 'rgba(0, 0, 0, 0.3)', borderRadius: '8px' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Assigned Worker Client</div>
                <div style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: '#ffffff', marginTop: '2px' }}>
                  {selectedPartition.partition.assignedMemberId || 'N/A (Unassigned)'}
                </div>
              </div>
            </div>

            <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setSelectedPartition(null)}>
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
