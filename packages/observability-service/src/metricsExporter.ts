import { Registry, Gauge, Counter, Histogram } from 'prom-client';
import { KafkaAdminHarvester } from './adminHarvester.js';
import { PartitionLagEngine } from './lagEngine.js';
import { TraceCollector } from './traceCollector.js';
import { EventTraceSpan } from '@streamz/contracts';

export class MetricsExporter {
  public readonly registry: Registry;

  // Cluster Metrics
  private brokersCountGauge: Gauge<string>;
  private topicsCountGauge: Gauge<string>;
  private partitionsTotalGauge: Gauge<string>;
  private clusterHealthyGauge: Gauge<string>;

  // Consumer Group Lag Metrics
  private consumerGroupLagGauge: Gauge<string>;
  private consumerGroupStalledGauge: Gauge<string>;

  // Business Event Telemetry Metrics
  private eventsTotalCounter: Counter<string>;
  private tracesTotalGauge: Gauge<string>;
  private traceDurationHistogram: Histogram<string>;

  constructor(
    private harvester: KafkaAdminHarvester,
    private lagEngine: PartitionLagEngine,
    private traceCollector: TraceCollector
  ) {
    this.registry = new Registry();

    // 1. Cluster Topology Gauges
    this.brokersCountGauge = new Gauge({
      name: 'kafka_cluster_brokers_count',
      help: 'Total number of active Kafka brokers in the cluster',
      registers: [this.registry],
    });

    this.topicsCountGauge = new Gauge({
      name: 'kafka_cluster_topics_count',
      help: 'Total number of topics registered in the Kafka cluster',
      registers: [this.registry],
    });

    this.partitionsTotalGauge = new Gauge({
      name: 'kafka_cluster_partitions_total',
      help: 'Total number of partitions across all topics in the Kafka cluster',
      registers: [this.registry],
    });

    this.clusterHealthyGauge = new Gauge({
      name: 'kafka_cluster_healthy',
      help: 'Cluster health indicator (1 = healthy, 0 = degraded)',
      registers: [this.registry],
    });

    // 2. Consumer Group Lag Gauges
    this.consumerGroupLagGauge = new Gauge({
      name: 'kafka_consumergroup_lag',
      help: 'Consumer group lag per topic partition',
      labelNames: ['group', 'topic', 'partition'],
      registers: [this.registry],
    });

    this.consumerGroupStalledGauge = new Gauge({
      name: 'kafka_consumergroup_stalled',
      help: 'Consumer group stall flag (1 = stalled/unassigned with lag, 0 = active/healthy)',
      labelNames: ['group'],
      registers: [this.registry],
    });

    // 3. Application Event Counters & Histograms
    this.eventsTotalCounter = new Counter({
      name: 'streamz_events_total',
      help: 'Total business event telemetry spans processed by stage',
      labelNames: ['service', 'event_type', 'stage'],
      registers: [this.registry],
    });

    this.tracesTotalGauge = new Gauge({
      name: 'streamz_traces_total',
      help: 'Total distributed traces by lifecycle status',
      labelNames: ['status'],
      registers: [this.registry],
    });

    this.traceDurationHistogram = new Histogram({
      name: 'streamz_trace_duration_seconds',
      help: 'End-to-end trace lifecycle execution duration in seconds',
      labelNames: ['root_event', 'status'],
      buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
      registers: [this.registry],
    });

    // Hook real-time event listener
    this.traceCollector.on('span', (span: EventTraceSpan) => {
      this.eventsTotalCounter.inc({
        service: span.service,
        event_type: span.eventType,
        stage: span.stage,
      });

      // If span completes a trace, observe total duration
      if (span.stage === 'PROCESSED' && (span.eventType === 'OrderConfirmed' || span.eventType === 'OrderRejected')) {
        const trace = this.traceCollector.getTrace(span.correlationId);
        if (trace && trace.totalDurationMs > 0) {
          this.traceDurationHistogram.observe(
            { root_event: trace.rootEventType, status: trace.status },
            trace.totalDurationMs / 1000
          );
        }
      }
    });
  }

  /**
   * Scrapes live cluster, consumer lag, and application metrics and returns Prometheus exposition text.
   */
  public async scrapeMetrics(): Promise<string> {
    try {
      // 1. Scrape Cluster Topology
      const cluster = await this.harvester.getClusterOverview();
      this.brokersCountGauge.set(cluster.brokers.length);
      this.topicsCountGauge.set(cluster.topics.length);
      this.partitionsTotalGauge.set(cluster.totalPartitions);
      this.clusterHealthyGauge.set(cluster.healthy ? 1 : 0);

      // 2. Scrape Consumer Group Lag
      const lagSummaries = await this.lagEngine.getAllConsumerGroupsLag();
      this.consumerGroupLagGauge.reset();
      this.consumerGroupStalledGauge.reset();

      for (const group of lagSummaries) {
        this.consumerGroupStalledGauge.set({ group: group.groupId }, group.isStalled ? 1 : 0);

        for (const topicLag of group.topics) {
          for (const p of topicLag.partitions) {
            this.consumerGroupLagGauge.set(
              {
                group: group.groupId,
                topic: topicLag.topic,
                partition: String(p.partition),
              },
              p.lag
            );
          }
        }
      }

      // 3. Scrape Trace Summaries
      const { traces } = this.traceCollector.getTraces({ limit: 1000 });
      let completedCount = 0;
      let inProgressCount = 0;
      let failedCount = 0;

      for (const t of traces) {
        if (t.status === 'COMPLETED') completedCount++;
        else if (t.status === 'FAILED') failedCount++;
        else inProgressCount++;
      }

      this.tracesTotalGauge.set({ status: 'COMPLETED' }, completedCount);
      this.tracesTotalGauge.set({ status: 'IN_PROGRESS' }, inProgressCount);
      this.tracesTotalGauge.set({ status: 'FAILED' }, failedCount);
    } catch {
      // Return currently recorded metrics if active harvest encounters transient issue
    }

    return await this.registry.metrics();
  }

  public get contentType(): string {
    return this.registry.contentType;
  }
}
