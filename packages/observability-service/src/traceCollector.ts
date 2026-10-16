import { EventEmitter } from 'events';
import { Consumer } from 'kafkajs';
import { EventTraceSpan, EventTraceSpanSchema, TraceSummary, TOPICS } from '@streamz/contracts';
import { ResilientKafkaClient } from '@streamz/kafka-client';

export interface TraceQueryOptions {
  limit?: number;
  offset?: number;
  service?: string;
  status?: 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  search?: string;
}

export class TraceCollector extends EventEmitter {
  private traces = new Map<string, EventTraceSpan[]>();
  private traceKeys: string[] = []; // Chronological list of correlationIds for FIFO eviction
  private maxTraces: number;
  private consumer: Consumer | null = null;

  constructor(maxTraces = 5000) {
    super();
    this.maxTraces = maxTraces;
  }

  /**
   * Ingests and stores an EventTraceSpan in memory, broadcasting to event listeners.
   */
  public recordSpan(rawSpan: unknown): EventTraceSpan {
    const parseResult = EventTraceSpanSchema.safeParse(rawSpan);
    if (!parseResult.success) {
      throw new Error(`Invalid trace span: ${parseResult.error.message}`);
    }

    const span = parseResult.data;
    const { correlationId } = span;

    if (!this.traces.has(correlationId)) {
      // Evict oldest trace if capacity exceeded
      if (this.traceKeys.length >= this.maxTraces) {
        const oldestKey = this.traceKeys.shift();
        if (oldestKey) {
          this.traces.delete(oldestKey);
        }
      }
      this.traces.set(correlationId, []);
      this.traceKeys.push(correlationId);
    }

    const spanList = this.traces.get(correlationId)!;
    spanList.push(span);

    // Sort spans chronologically by timestamp
    spanList.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    // Emit event for real-time WebSocket consumers
    this.emit('span', span);

    return span;
  }

  /**
   * Starts a dedicated background consumer listening to the Kafka telemetry-spans topic.
   */
  public async startConsumer(
    kafkaClient: ResilientKafkaClient,
    groupId = 'observability-trace-collector'
  ): Promise<Consumer> {
    if (this.consumer) {
      return this.consumer;
    }

    // Ensure topic exists with 3 partitions before consumer subscription
    const admin = await kafkaClient.getAdmin();
    const existingTopics = await admin.listTopics();
    if (!existingTopics.includes(TOPICS.TELEMETRY_SPANS)) {
      await admin.createTopics({
        topics: [{ topic: TOPICS.TELEMETRY_SPANS, numPartitions: 3, replicationFactor: 1 }],
      });
      // Short delay to allow metadata propagation
      await new Promise((r) => setTimeout(r, 1000));
    }

    this.consumer = await kafkaClient.createConsumer(groupId, {
      sessionTimeout: 10000,
      heartbeatInterval: 2000,
    });

    await this.consumer.subscribe({
      topic: TOPICS.TELEMETRY_SPANS,
      fromBeginning: false,
    });

    await this.consumer.run({
      eachMessage: async ({ message }) => {
        if (!message.value) return;
        try {
          const raw = JSON.parse(message.value.toString());
          this.recordSpan(raw);
        } catch {
          // Ignore invalid frames
        }
      },
    });

    return this.consumer;
  }

  public async stopConsumer(): Promise<void> {
    if (this.consumer) {
      await this.consumer.disconnect();
      this.consumer = null;
    }
  }

  /**
   * Returns a detailed summary of a trace by correlationId.
   */
  public getTrace(correlationId: string): TraceSummary | null {
    const spans = this.traces.get(correlationId);
    if (!spans || spans.length === 0) {
      return null;
    }

    return this.buildTraceSummary(correlationId, spans);
  }

  /**
   * Returns paginated and filtered trace summaries.
   */
  public getTraces(options?: TraceQueryOptions): {
    total: number;
    traces: TraceSummary[];
  } {
    const limit = options?.limit ?? 50;
    const offset = options?.offset ?? 0;
    const serviceFilter = options?.service?.toLowerCase();
    const statusFilter = options?.status;
    const searchFilter = options?.search?.toLowerCase();

    // Iterate in reverse chronological order (newest first)
    const allSummaries: TraceSummary[] = [];

    for (let i = this.traceKeys.length - 1; i >= 0; i--) {
      const key = this.traceKeys[i];
      const spans = this.traces.get(key);
      if (!spans || spans.length === 0) continue;

      const summary = this.buildTraceSummary(key, spans);

      if (serviceFilter && !summary.servicesInvolved.some((s) => s.toLowerCase() === serviceFilter)) {
        continue;
      }

      if (statusFilter && summary.status !== statusFilter) {
        continue;
      }

      if (
        searchFilter &&
        !summary.correlationId.toLowerCase().includes(searchFilter) &&
        !summary.aggregateId.toLowerCase().includes(searchFilter)
      ) {
        continue;
      }

      allSummaries.push(summary);
    }

    const paginated = allSummaries.slice(offset, offset + limit);

    return {
      total: allSummaries.length,
      traces: paginated,
    };
  }

  public clear(): void {
    this.traces.clear();
    this.traceKeys = [];
  }

  private buildTraceSummary(correlationId: string, spans: EventTraceSpan[]): TraceSummary {
    const sorted = [...spans].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const aggregateId = first.aggregateId;
    const rootEventType = first.eventType;

    const servicesInvolved = Array.from(new Set(sorted.map((s) => s.service)));

    let status: 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' = 'IN_PROGRESS';
    const hasFailure = sorted.some((s) => s.stage === 'FAILED' || Boolean(s.error));

    if (hasFailure) {
      status = 'FAILED';
    } else {
      // Completed if notification worker finalized the event or terminal rejection occurred
      const hasNotification = sorted.some(
        (s) => s.service === 'notification-worker' && s.stage === 'PROCESSED'
      );
      const isTerminalRejection = sorted.some(
        (s) => s.eventType === 'OrderRejected' && s.stage === 'PROCESSED'
      );

      if (hasNotification || isTerminalRejection) {
        status = 'COMPLETED';
      }
    }

    const startTime = new Date(first.timestamp).getTime();
    const endTime = new Date(last.timestamp).getTime();
    const totalDurationMs = Math.max(0, endTime - startTime);

    return {
      correlationId,
      aggregateId,
      rootEventType,
      servicesInvolved,
      totalSpans: sorted.length,
      status,
      startedAt: first.timestamp,
      lastUpdatedAt: last.timestamp,
      totalDurationMs,
      spans: sorted,
    };
  }
}
