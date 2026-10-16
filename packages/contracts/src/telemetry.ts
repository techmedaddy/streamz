import { z } from 'zod';

export const EventTraceSpanStageSchema = z.enum(['PRODUCED', 'CONSUMING', 'PROCESSED', 'FAILED']);
export type EventTraceSpanStage = z.infer<typeof EventTraceSpanStageSchema>;

export const EventTraceSpanSchema = z.object({
  spanId: z.string().min(1),
  traceId: z.string().min(1),
  correlationId: z.string().min(1),
  aggregateId: z.string().min(1),
  eventType: z.string().min(1),
  service: z.string().min(1),
  stage: EventTraceSpanStageSchema,
  durationMs: z.number().nonnegative().optional(),
  error: z.string().optional(),
  timestamp: z.string().datetime(),
  metadata: z.record(z.any()).optional(),
});

export type EventTraceSpan = z.infer<typeof EventTraceSpanSchema>;

export interface TraceSummary {
  correlationId: string;
  aggregateId: string;
  rootEventType: string;
  servicesInvolved: string[];
  totalSpans: number;
  status: 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  startedAt: string;
  lastUpdatedAt: string;
  totalDurationMs: number;
  spans: EventTraceSpan[];
}
