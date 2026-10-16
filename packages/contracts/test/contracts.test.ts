import { describe, it, expect } from 'vitest';
import {
  createEventEnvelope,
  OrderCreatedPayloadSchema,
  OrderCreatedEventSchema,
  getEventPartitionKey,
  TOPICS,
} from '../src/index.js';

describe('Contracts & Schemas', () => {
  it('should define correct Kafka topic names', () => {
    expect(TOPICS.ORDERS).toBe('orders');
    expect(TOPICS.INVENTORY_EVENTS).toBe('inventory-events');
    expect(TOPICS.ORDER_EVENTS).toBe('order-events');
    expect(TOPICS.NOTIFICATIONS_DLQ).toBe('notifications-dlq');
  });

  it('should create a valid event envelope and extract partition key', () => {
    const payload = {
      orderId: 'order-101',
      customerId: 'cust-42',
      productId: 'prod-keyboard-rgb',
      quantity: 2,
      totalPrice: 199.98,
    };

    const envelope = createEventEnvelope({
      eventType: 'OrderCreated',
      aggregateId: payload.orderId,
      correlationId: 'req-corr-999',
      payload,
    });

    expect(envelope.eventId).toBeDefined();
    expect(envelope.occurredAt).toBeDefined();
    expect(envelope.eventVersion).toBe(1);
    expect(envelope.correlationId).toBe('req-corr-999');

    // Runtime validation with Zod
    const validated = OrderCreatedEventSchema.parse(envelope);
    expect(validated.payload.orderId).toBe('order-101');

    // Partition key extraction
    const partitionKey = getEventPartitionKey(envelope);
    expect(partitionKey).toBe('order-101');
  });

  it('should fail validation on invalid payload', () => {
    const invalidEnvelope = {
      eventId: 'not-a-uuid',
      eventType: 'OrderCreated',
      eventVersion: 1,
      aggregateId: 'order-101',
      correlationId: 'corr-1',
      occurredAt: 'invalid-date',
      payload: {
        orderId: 'order-101',
        quantity: -5, // Invalid: must be positive
      },
    };

    expect(() => OrderCreatedEventSchema.parse(invalidEnvelope)).toThrow();
  });
});
