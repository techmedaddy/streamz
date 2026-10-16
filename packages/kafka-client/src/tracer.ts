import { randomUUID } from 'crypto';
import { EventTraceSpan, EventTraceSpanStage, TOPICS } from '@streamz/contracts';
import { ResilientKafkaClient } from './index.js';

export interface RecordSpanOptions {
  correlationId: string;
  aggregateId: string;
  eventType: string;
  stage: EventTraceSpanStage;
  durationMs?: number;
  error?: string;
  metadata?: Record<string, any>;
}

export class EventTracer {
  private kafkaClient: ResilientKafkaClient;
  public readonly serviceName: string;

  constructor(kafkaClient: ResilientKafkaClient, serviceName: string) {
    this.kafkaClient = kafkaClient;
    this.serviceName = serviceName;
  }

  /**
   * Records a business event trace span and emits it asynchronously to Kafka.
   */
  public async recordSpan(options: RecordSpanOptions): Promise<EventTraceSpan> {
    const span: EventTraceSpan = {
      spanId: randomUUID(),
      traceId: options.correlationId,
      correlationId: options.correlationId,
      aggregateId: options.aggregateId,
      eventType: options.eventType,
      service: this.serviceName,
      stage: options.stage,
      durationMs: options.durationMs,
      error: options.error,
      timestamp: new Date().toISOString(),
      metadata: options.metadata,
    };

    // Asynchronously dispatch to Kafka telemetry topic without blocking main execution thread
    this.emitToKafka(span).catch((err) => {
      // Non-fatal telemetry dispatch warning
      if (process.env.DEBUG_TELEMETRY) {
        console.warn(`[EventTracer:${this.serviceName}] Telemetry span dispatch warning:`, err);
      }
    });

    return span;
  }

  private async emitToKafka(span: EventTraceSpan): Promise<void> {
    try {
      const producer = await this.kafkaClient.getProducer();
      await producer.send({
        topic: TOPICS.TELEMETRY_SPANS,
        messages: [
          {
            key: span.correlationId,
            value: JSON.stringify(span),
            headers: {
              correlationId: span.correlationId,
              service: span.service,
              stage: span.stage,
            },
          },
        ],
      });
    } catch {
      // Fire-and-forget fallback
    }
  }
}
