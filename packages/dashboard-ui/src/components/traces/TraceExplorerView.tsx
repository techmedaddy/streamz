'use client';

import React, { useState, useMemo } from 'react';
import {
  Activity,
  AlertCircle,
  ArrowRight,
  Clock,
  Cpu,
  Database,
  Filter,
  Layers,
  Search,
  Server,
  Zap,
  CheckCircle2,
  XCircle,
  ChevronRight,
  Radio,
  Share2,
  ExternalLink,
  Info,
  Maximize2,
  RefreshCw,
} from 'lucide-react';
import { EventTraceSpan } from '../../hooks/useTelemetryStream';

interface TraceExplorerViewProps {
  recentSpans: EventTraceSpan[];
}

export function TraceExplorerView({ recentSpans }: TraceExplorerViewProps) {
  const [selectedCorrelationId, setSelectedCorrelationId] = useState<string | null>(null);
  const [selectedSpan, setSelectedSpan] = useState<EventTraceSpan | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [serviceFilter, setServiceFilter] = useState('ALL');
  const [stageFilter, setStageFilter] = useState('ALL');
  const [onlyErrors, setOnlyErrors] = useState(false);

  // Group spans by correlationId to reconstruct end-to-end distributed traces
  const tracesMap = useMemo(() => {
    const map = new Map<string, EventTraceSpan[]>();
    for (const span of recentSpans) {
      const key = span.correlationId || span.traceId || 'unknown';
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key)!.push(span);
    }
    // Sort spans within each trace chronologically
    for (const [key, spans] of map.entries()) {
      spans.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    }
    return map;
  }, [recentSpans]);

  // Available unique correlation IDs
  const traceKeys = useMemo(() => {
    return Array.from(tracesMap.keys());
  }, [tracesMap]);

  // Default to latest correlation ID if none explicitly selected
  const activeCorrelationId = selectedCorrelationId || (traceKeys.length > 0 ? traceKeys[0] : null);

  // Get spans for currently active trace
  const activeTraceSpans = useMemo(() => {
    if (!activeCorrelationId) return [];
    return tracesMap.get(activeCorrelationId) || [];
  }, [tracesMap, activeCorrelationId]);

  // Compute waterfall timing offsets relative to first span in the active trace
  const waterfallData = useMemo(() => {
    if (activeTraceSpans.length === 0) return { spansWithOffsets: [], totalTraceDurationMs: 0 };
    const rootTime = new Date(activeTraceSpans[0].timestamp).getTime();
    let maxEndTime = rootTime;

    const spansWithOffsets = activeTraceSpans.map((span) => {
      const startTime = new Date(span.timestamp).getTime();
      const offsetMs = Math.max(0, startTime - rootTime);
      const duration = span.durationMs && span.durationMs > 0 ? span.durationMs : 4;
      const endTime = startTime + duration;
      if (endTime > maxEndTime) maxEndTime = endTime;

      return {
        ...span,
        offsetMs,
        computedDuration: duration,
      };
    });

    const totalTraceDurationMs = Math.max(1, maxEndTime - rootTime);
    return { spansWithOffsets, totalTraceDurationMs };
  }, [activeTraceSpans]);

  // Filtered Spans for the tabular log view
  const filteredSpans = useMemo(() => {
    return recentSpans.filter((span) => {
      if (onlyErrors && span.stage !== 'FAILED') return false;
      if (serviceFilter !== 'ALL' && span.service !== serviceFilter) return false;
      if (stageFilter !== 'ALL' && span.stage !== stageFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesCorr = span.correlationId?.toLowerCase().includes(q);
        const matchesAgg = span.aggregateId?.toLowerCase().includes(q);
        const matchesType = span.eventType?.toLowerCase().includes(q);
        const matchesService = span.service?.toLowerCase().includes(q);
        if (!matchesCorr && !matchesAgg && !matchesType && !matchesService) return false;
      }
      return true;
    });
  }, [recentSpans, onlyErrors, serviceFilter, stageFilter, searchQuery]);

  // Overall KPI statistics
  const stats = useMemo(() => {
    const total = recentSpans.length;
    const failed = recentSpans.filter((s) => s.stage === 'FAILED').length;
    const successRate = total > 0 ? Math.round(((total - failed) / total) * 100) : 100;
    const durations = recentSpans.filter((s) => s.durationMs).map((s) => s.durationMs!);
    const avgDuration = durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0;

    return {
      totalSpans: total,
      uniqueTraces: tracesMap.size,
      successRate,
      avgDuration,
      failedCount: failed,
    };
  }, [recentSpans, tracesMap]);

  // Helper color for services
  const getServiceColor = (service: string) => {
    switch (service) {
      case 'order-service':
        return { text: '#818cf8', bg: 'rgba(99, 102, 241, 0.15)', border: 'rgba(99, 102, 241, 0.35)' };
      case 'inventory-service':
        return { text: '#34d399', bg: 'rgba(16, 185, 129, 0.15)', border: 'rgba(16, 185, 129, 0.35)' };
      case 'notification-worker':
        return { text: '#38bdf8', bg: 'rgba(6, 182, 212, 0.15)', border: 'rgba(6, 182, 212, 0.35)' };
      case 'observability-service':
        return { text: '#c084fc', bg: 'rgba(168, 85, 247, 0.15)', border: 'rgba(168, 85, 247, 0.35)' };
      default:
        return { text: '#94a3b8', bg: 'rgba(255, 255, 255, 0.08)', border: 'rgba(255, 255, 255, 0.15)' };
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* View Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#ffffff' }}>
            Distributed Trace Explorer & Choreography Waterfall
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            Real-time correlation tracking across asynchronous Kafka producers, consumers, and message handlers.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="badge badge-indigo">
            <Share2 size={13} /> W3C Trace Context
          </span>
          <span className="badge badge-emerald">
            <span className="pulse-emerald" style={{ width: '6px', height: '6px' }} />
            Streaming Telemetry Active
          </span>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '16px',
        }}
      >
        <div className="glass-panel" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Tracked Traces</span>
            <Share2 size={18} color="#818cf8" />
          </div>
          <div style={{ fontSize: '26px', fontWeight: 800, color: '#ffffff' }}>
            {stats.uniqueTraces}
            <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-muted)', marginLeft: '6px' }}>
              choreographies
            </span>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Unique end-to-end flows captured
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Total Event Spans</span>
            <Layers size={18} color="#22d3ee" />
          </div>
          <div style={{ fontSize: '26px', fontWeight: 800, color: '#22d3ee' }}>
            {stats.totalSpans}
            <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-muted)', marginLeft: '6px' }}>
              recorded
            </span>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Produce & Consume checkpoints
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>End-to-End Success Rate</span>
            {stats.successRate === 100 ? (
              <CheckCircle2 size={18} color="#34d399" />
            ) : (
              <AlertCircle size={18} color="#f87171" />
            )}
          </div>
          <div
            style={{
              fontSize: '26px',
              fontWeight: 800,
              color: stats.successRate === 100 ? '#34d399' : '#f87171',
            }}
          >
            {stats.successRate}%
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            {stats.failedCount === 0 ? 'Zero pipeline failures' : `${stats.failedCount} failures / DLQ routed`}
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Avg Span Latency</span>
            <Clock size={18} color="#a855f7" />
          </div>
          <div style={{ fontSize: '26px', fontWeight: 800, color: '#a855f7' }}>
            {stats.avgDuration}
            <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-muted)', marginLeft: '6px' }}>
              ms
            </span>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Handler & persistence duration
          </div>
        </div>
      </div>

      {/* END-TO-END TRACE WATERFALL VISUALIZATION */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '16px',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Zap size={18} color="#818cf8" />
            <div>
              <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#ffffff' }}>
                Trace Execution Waterfall Timeline
              </h2>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Correlation ID:{' '}
                <span style={{ fontFamily: 'var(--font-mono)', color: '#38bdf8', fontWeight: 600 }}>
                  {activeCorrelationId || 'No active trace selected'}
                </span>
              </div>
            </div>
          </div>

          {/* Trace selector dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Select Trace:</span>
            <select
              value={activeCorrelationId || ''}
              onChange={(e) => setSelectedCorrelationId(e.target.value)}
              style={{
                background: 'rgba(0, 0, 0, 0.4)',
                color: '#ffffff',
                border: '1px solid var(--border-subtle)',
                borderRadius: '6px',
                padding: '6px 12px',
                fontSize: '12px',
                fontFamily: 'var(--font-mono)',
                cursor: 'pointer',
                maxWidth: '260px',
              }}
            >
              {traceKeys.map((key) => (
                <option key={key} value={key}>
                  {key} ({tracesMap.get(key)?.length || 0} spans)
                </option>
              ))}
            </select>
          </div>
        </div>

        {activeTraceSpans.length === 0 ? (
          <div style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)' }}>
            No trace spans recorded yet. Trigger an order to generate an end-to-end event choreography.
          </div>
        ) : (
          <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {/* Timeline Ruler */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '10px',
                fontFamily: 'var(--font-mono)',
                color: 'var(--text-muted)',
                paddingLeft: '280px',
                paddingBottom: '4px',
                borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              }}
            >
              <span>0ms (T0)</span>
              <span>{Math.round(waterfallData.totalTraceDurationMs / 2)}ms</span>
              <span>{waterfallData.totalTraceDurationMs}ms</span>
            </div>

            {/* Waterfall Span Rows */}
            {waterfallData.spansWithOffsets.map((span, idx) => {
              const sColor = getServiceColor(span.service);
              const leftPercent = (span.offsetMs / waterfallData.totalTraceDurationMs) * 100;
              const widthPercent = Math.max(
                4,
                (span.computedDuration / waterfallData.totalTraceDurationMs) * 100
              );

              return (
                <div
                  key={span.spanId}
                  onClick={() => setSelectedSpan(span)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    background: 'rgba(0, 0, 0, 0.25)',
                    border: '1px solid var(--border-subtle)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(0, 0, 0, 0.25)';
                    e.currentTarget.style.borderColor = 'var(--border-subtle)';
                  }}
                >
                  {/* Left Label column */}
                  <div style={{ width: '270px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span
                      style={{
                        width: '18px',
                        height: '18px',
                        borderRadius: '4px',
                        background: 'rgba(255, 255, 255, 0.08)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '10px',
                        fontFamily: 'var(--font-mono)',
                        color: 'var(--text-muted)',
                      }}
                    >
                      {idx + 1}
                    </span>
                    <span
                      className="badge"
                      style={{
                        fontSize: '10px',
                        padding: '2px 6px',
                        background: sColor.bg,
                        color: sColor.text,
                        borderColor: sColor.border,
                      }}
                    >
                      {span.service}
                    </span>
                    <span
                      style={{
                        fontSize: '12px',
                        fontWeight: 600,
                        color: '#ffffff',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {span.eventType}
                    </span>
                  </div>

                  {/* Gantt Bar Visualization */}
                  <div style={{ flex: 1, position: 'relative', height: '24px', display: 'flex', alignItems: 'center' }}>
                    {/* Background track line */}
                    <div
                      style={{
                        position: 'absolute',
                        left: 0,
                        right: 0,
                        height: '1px',
                        background: 'rgba(255, 255, 255, 0.05)',
                      }}
                    />

                    {/* Active span duration bar */}
                    <div
                      style={{
                        position: 'absolute',
                        left: `${leftPercent}%`,
                        width: `${Math.min(100 - leftPercent, widthPercent)}%`,
                        height: '16px',
                        borderRadius: '4px',
                        background:
                          span.stage === 'FAILED'
                            ? 'linear-gradient(90deg, #ef4444 0%, #b91c1c 100%)'
                            : span.stage === 'PRODUCED'
                            ? 'linear-gradient(90deg, #6366f1 0%, #818cf8 100%)'
                            : 'linear-gradient(90deg, #10b981 0%, #34d399 100%)',
                        boxShadow: `0 0 10px ${
                          span.stage === 'FAILED' ? 'rgba(239, 68, 68, 0.4)' : 'rgba(99, 102, 241, 0.3)'
                        }`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'flex-end',
                        paddingRight: '6px',
                        transition: 'all 0.3s ease',
                      }}
                    >
                      <span
                        style={{
                          fontSize: '9px',
                          fontWeight: 700,
                          color: '#ffffff',
                          fontFamily: 'var(--font-mono)',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {span.durationMs ? `${span.durationMs}ms` : '<1ms'}
                      </span>
                    </div>
                  </div>

                  {/* Right Stage Badge */}
                  <div style={{ width: '100px', textAlign: 'right' }}>
                    <span
                      className={`badge ${
                        span.stage === 'PROCESSED'
                          ? 'badge-emerald'
                          : span.stage === 'FAILED'
                          ? 'badge-crimson'
                          : span.stage === 'PRODUCED'
                          ? 'badge-indigo'
                          : 'badge-cyan'
                      }`}
                      style={{ fontSize: '10px' }}
                    >
                      {span.stage}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* FILTER & SEARCH BAR */}
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: '280px' }}>
          <Search size={16} color="var(--text-muted)" />
          <input
            type="text"
            placeholder="Search by Correlation ID, Order ID, Service, or Event Type..."
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
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Service:</span>
            <select
              value={serviceFilter}
              onChange={(e) => setServiceFilter(e.target.value)}
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
              <option value="ALL">All Services</option>
              <option value="order-service">order-service</option>
              <option value="inventory-service">inventory-service</option>
              <option value="notification-worker">notification-worker</option>
              <option value="observability-service">observability-service</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Stage:</span>
            <select
              value={stageFilter}
              onChange={(e) => setStageFilter(e.target.value)}
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
              <option value="ALL">All Stages</option>
              <option value="PRODUCED">PRODUCED</option>
              <option value="CONSUMING">CONSUMING</option>
              <option value="PROCESSED">PROCESSED</option>
              <option value="FAILED">FAILED</option>
            </select>
          </div>

          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12px',
              color: onlyErrors ? '#f87171' : 'var(--text-muted)',
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={onlyErrors}
              onChange={(e) => setOnlyErrors(e.target.checked)}
              style={{ accentColor: '#ef4444' }}
            />
            Errors Only
          </label>
        </div>
      </div>

      {/* LIVE EVENT SPANS TABLE */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Activity size={18} color="#06b6d4" />
            <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#ffffff' }}>
              Streaming Distributed Event Log ({filteredSpans.length} spans)
            </h2>
          </div>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Click row to view waterfall timeline or inspect metadata
          </span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
                <th style={{ padding: '12px 14px' }}>Timestamp</th>
                <th style={{ padding: '12px 14px' }}>Service</th>
                <th style={{ padding: '12px 14px' }}>Event Type</th>
                <th style={{ padding: '12px 14px' }}>Stage</th>
                <th style={{ padding: '12px 14px' }}>Duration</th>
                <th style={{ padding: '12px 14px' }}>Correlation ID</th>
                <th style={{ padding: '12px 14px' }}>Aggregate / Order</th>
                <th style={{ padding: '12px 14px', textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredSpans.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No matching event spans captured. Dispatch orders to observe live distributed choreography.
                  </td>
                </tr>
              ) : (
                filteredSpans.map((span) => {
                  const sColor = getServiceColor(span.service);

                  return (
                    <tr
                      key={span.spanId}
                      onClick={() => {
                        setSelectedCorrelationId(span.correlationId);
                        setSelectedSpan(span);
                      }}
                      style={{
                        borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                        cursor: 'pointer',
                        transition: 'background 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.03)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    >
                      <td
                        style={{
                          padding: '12px 14px',
                          fontFamily: 'var(--font-mono)',
                          fontSize: '11px',
                          color: 'var(--text-muted)',
                        }}
                      >
                        {new Date(span.timestamp).toLocaleTimeString()}
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <span
                          className="badge"
                          style={{
                            fontSize: '11px',
                            background: sColor.bg,
                            color: sColor.text,
                            borderColor: sColor.border,
                          }}
                        >
                          {span.service}
                        </span>
                      </td>
                      <td style={{ padding: '12px 14px', fontWeight: 600, color: '#ffffff' }}>
                        {span.eventType}
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <span
                          className={`badge ${
                            span.stage === 'PROCESSED'
                              ? 'badge-emerald'
                              : span.stage === 'FAILED'
                              ? 'badge-crimson'
                              : span.stage === 'PRODUCED'
                              ? 'badge-indigo'
                              : 'badge-cyan'
                          }`}
                          style={{ fontSize: '11px' }}
                        >
                          {span.stage}
                        </span>
                      </td>
                      <td
                        style={{
                          padding: '12px 14px',
                          fontFamily: 'var(--font-mono)',
                          color: '#38bdf8',
                          fontWeight: 600,
                        }}
                      >
                        {span.durationMs ? `${span.durationMs}ms` : '-'}
                      </td>
                      <td
                        style={{
                          padding: '12px 14px',
                          fontFamily: 'var(--font-mono)',
                          fontSize: '11px',
                          color: 'var(--text-secondary)',
                        }}
                      >
                        {span.correlationId}
                      </td>
                      <td
                        style={{
                          padding: '12px 14px',
                          fontFamily: 'var(--font-mono)',
                          color: '#ffffff',
                          fontWeight: 500,
                        }}
                      >
                        {span.aggregateId}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                        <button
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#818cf8',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '11px',
                            fontWeight: 600,
                          }}
                        >
                          Inspect <ChevronRight size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* DETAILED SPAN INSPECTION MODAL */}
      {selectedSpan && (
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
          onClick={() => setSelectedSpan(null)}
        >
          <div
            className="glass-panel"
            style={{
              maxWidth: '600px',
              width: '100%',
              padding: '28px',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.8)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              maxHeight: '90vh',
              overflowY: 'auto',
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
                    Span Telemetry Inspector
                  </h3>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    Span ID: <span style={{ fontFamily: 'var(--font-mono)' }}>{selectedSpan.spanId}</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSelectedSpan(null)}
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
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '12px',
                }}
              >
                <div style={{ padding: '12px', background: 'rgba(0, 0, 0, 0.3)', borderRadius: '8px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Service</div>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: '#ffffff' }}>
                    {selectedSpan.service}
                  </div>
                </div>
                <div style={{ padding: '12px', background: 'rgba(0, 0, 0, 0.3)', borderRadius: '8px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Stage</div>
                  <span
                    className={`badge ${
                      selectedSpan.stage === 'PROCESSED'
                        ? 'badge-emerald'
                        : selectedSpan.stage === 'FAILED'
                        ? 'badge-crimson'
                        : selectedSpan.stage === 'PRODUCED'
                        ? 'badge-indigo'
                        : 'badge-cyan'
                    }`}
                    style={{ marginTop: '4px' }}
                  >
                    {selectedSpan.stage}
                  </span>
                </div>
              </div>

              <div style={{ padding: '12px', background: 'rgba(0, 0, 0, 0.3)', borderRadius: '8px' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Event Type / Operation</div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#ffffff' }}>
                  {selectedSpan.eventType}
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
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Duration</div>
                  <div style={{ fontSize: '16px', fontWeight: 700, fontFamily: 'var(--font-mono)', color: '#38bdf8' }}>
                    {selectedSpan.durationMs ? `${selectedSpan.durationMs}ms` : '<1ms'}
                  </div>
                </div>
                <div style={{ padding: '12px', background: 'rgba(0, 0, 0, 0.3)', borderRadius: '8px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Timestamp</div>
                  <div style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: '#ffffff' }}>
                    {new Date(selectedSpan.timestamp).toISOString()}
                  </div>
                </div>
              </div>

              <div style={{ padding: '12px', background: 'rgba(0, 0, 0, 0.3)', borderRadius: '8px' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Correlation ID</div>
                <div style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: '#ffffff' }}>
                  {selectedSpan.correlationId}
                </div>
              </div>

              <div style={{ padding: '12px', background: 'rgba(0, 0, 0, 0.3)', borderRadius: '8px' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Aggregate / Entity ID</div>
                <div style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: '#ffffff' }}>
                  {selectedSpan.aggregateId}
                </div>
              </div>

              {selectedSpan.error && (
                <div
                  style={{
                    padding: '12px',
                    background: 'rgba(239, 68, 68, 0.15)',
                    borderRadius: '8px',
                    border: '1px solid rgba(239, 68, 68, 0.35)',
                  }}
                >
                  <div style={{ fontSize: '11px', color: '#fca5a5', fontWeight: 600 }}>Error Stack</div>
                  <pre
                    style={{
                      fontSize: '11px',
                      fontFamily: 'var(--font-mono)',
                      color: '#f87171',
                      marginTop: '6px',
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {selectedSpan.error}
                  </pre>
                </div>
              )}

              {selectedSpan.metadata && Object.keys(selectedSpan.metadata).length > 0 && (
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px' }}>
                    Span Metadata / Headers
                  </div>
                  <pre
                    style={{
                      padding: '12px',
                      background: 'rgba(0, 0, 0, 0.5)',
                      borderRadius: '8px',
                      fontSize: '11px',
                      fontFamily: 'var(--font-mono)',
                      color: '#94a3b8',
                      overflowX: 'auto',
                      maxHeight: '160px',
                    }}
                  >
                    {JSON.stringify(selectedSpan.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setSelectedSpan(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
