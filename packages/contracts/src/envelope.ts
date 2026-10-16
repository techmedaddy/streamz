import { z } from 'zod';
import { randomUUID } from 'crypto';

export const EventEnvelopeSchema = <T extends z.ZodTypeAny>(payloadSchema: T) =>
  z.object({
    eventId: z.string().uuid(),
    eventType: z.string().min(1),
    eventVersion: z.number().int().positive().default(1),
    aggregateId: z.string().min(1),
    correlationId: z.string().min(1),
    occurredAt: z.string().datetime(),
    payload: payloadSchema,
  });

export type EventEnvelope<T> = {
  eventId: string;
  eventType: string;
  eventVersion: number;
  aggregateId: string;
  correlationId: string;
  occurredAt: string;
  payload: T;
};

export interface CreateEnvelopeOptions<T> {
  eventType: string;
  aggregateId: string;
  correlationId?: string;
  eventVersion?: number;
  payload: T;
}

export function createEventEnvelope<T>(options: CreateEnvelopeOptions<T>): EventEnvelope<T> {
  return {
    eventId: randomUUID(),
    eventType: options.eventType,
    eventVersion: options.eventVersion ?? 1,
    aggregateId: options.aggregateId,
    correlationId: options.correlationId ?? randomUUID(),
    occurredAt: new Date().toISOString(),
    payload: options.payload,
  };
}
