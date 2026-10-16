import { randomUUID } from 'crypto';
import { pool } from './db.js';
import { ResilientKafkaClient } from '@streamz/kafka-client';
import {
  TOPICS,
  createEventEnvelope,
  OrderCreatedPayload,
  OrderConfirmedPayload,
  OrderRejectedPayload,
  InventoryReservedPayload,
  InventoryRejectedPayload,
  EventEnvelope,
} from '@streamz/contracts';

export class OrderService {
  constructor(private kafkaClient: ResilientKafkaClient) {}

  public async isEventProcessed(eventId: string, consumerGroup: string): Promise<boolean> {
    const res = await pool.query(
      'SELECT 1 FROM processed_events WHERE event_id = $1 AND consumer_group = $2',
      [eventId, consumerGroup]
    );
    return (res.rowCount ?? 0) > 0;
  }

  public async markEventProcessed(eventId: string, consumerGroup: string): Promise<void> {
    await pool.query(
      'INSERT INTO processed_events (event_id, consumer_group) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [eventId, consumerGroup]
    );
  }

  public async createOrder(data: {
    customerId: string;
    productId: string;
    quantity: number;
    unitPrice: number;
    correlationId?: string;
  }) {
    const orderId = `ord-${randomUUID().slice(0, 8)}`;
    const totalAmount = Number((data.quantity * data.unitPrice).toFixed(2));
    const correlationId = data.correlationId || randomUUID();

    // 1. Persist order with PENDING state
    const insertRes = await pool.query(
      `INSERT INTO orders (id, customer_id, product_id, quantity, total_amount, status)
       VALUES ($1, $2, $3, $4, $5, 'PENDING')
       RETURNING *`,
      [orderId, data.customerId, data.productId, data.quantity, totalAmount]
    );

    const order = insertRes.rows[0];

    // 2. Publish OrderCreated event to Kafka
    const payload: OrderCreatedPayload = {
      orderId,
      customerId: data.customerId,
      productId: data.productId,
      quantity: data.quantity,
      totalPrice: totalAmount,
    };

    const envelope = createEventEnvelope<OrderCreatedPayload>({
      eventType: 'OrderCreated',
      aggregateId: orderId,
      correlationId,
      payload,
    });

    await this.kafkaClient.sendEvent(TOPICS.ORDERS, envelope);
    console.log(`[OrderService] Published OrderCreated for ${orderId} (correlation: ${correlationId})`);

    return order;
  }

  public async getOrder(id: string) {
    const res = await pool.query('SELECT * FROM orders WHERE id = $1', [id]);
    return res.rows[0] || null;
  }

  public async listOrders() {
    const res = await pool.query('SELECT * FROM orders ORDER BY created_at DESC LIMIT 50');
    return res.rows;
  }

  public async handleInventoryReserved(envelope: EventEnvelope<InventoryReservedPayload>) {
    const { orderId } = envelope.payload;

    // Idempotency check
    if (await this.isEventProcessed(envelope.eventId, 'order-service-group')) {
      console.log(`[OrderService] Event ${envelope.eventId} already processed, skipping.`);
      return;
    }

    const updateRes = await pool.query(
      `UPDATE orders 
       SET status = 'CONFIRMED', updated_at = NOW() 
       WHERE id = $1 AND status = 'PENDING'
       RETURNING *`,
      [orderId]
    );

    if (updateRes.rowCount === 0) {
      console.log(`[OrderService] Order ${orderId} is not in PENDING state, skipping transition.`);
      await this.markEventProcessed(envelope.eventId, 'order-service-group');
      return;
    }

    const order = updateRes.rows[0];
    await this.markEventProcessed(envelope.eventId, 'order-service-group');

    // Publish OrderConfirmed event
    const confirmedPayload: OrderConfirmedPayload = {
      orderId,
      customerId: order.customer_id,
      totalPrice: Number(order.total_amount),
      confirmedAt: new Date().toISOString(),
    };

    const confirmedEnvelope = createEventEnvelope<OrderConfirmedPayload>({
      eventType: 'OrderConfirmed',
      aggregateId: orderId,
      correlationId: envelope.correlationId,
      payload: confirmedPayload,
    });

    await this.kafkaClient.sendEvent(TOPICS.ORDER_EVENTS, confirmedEnvelope);
    console.log(`[OrderService] Order ${orderId} CONFIRMED and OrderConfirmed event published.`);
  }

  public async handleInventoryRejected(envelope: EventEnvelope<InventoryRejectedPayload>) {
    const { orderId, reason } = envelope.payload;

    if (await this.isEventProcessed(envelope.eventId, 'order-service-group')) {
      console.log(`[OrderService] Event ${envelope.eventId} already processed, skipping.`);
      return;
    }

    const updateRes = await pool.query(
      `UPDATE orders 
       SET status = 'REJECTED', rejection_reason = $2, updated_at = NOW() 
       WHERE id = $1 AND status = 'PENDING'
       RETURNING *`,
      [orderId, reason]
    );

    if (updateRes.rowCount === 0) {
      await this.markEventProcessed(envelope.eventId, 'order-service-group');
      return;
    }

    const order = updateRes.rows[0];
    await this.markEventProcessed(envelope.eventId, 'order-service-group');

    // Publish OrderRejected event
    const rejectedPayload: OrderRejectedPayload = {
      orderId,
      customerId: order.customer_id,
      reason,
      rejectedAt: new Date().toISOString(),
    };

    const rejectedEnvelope = createEventEnvelope<OrderRejectedPayload>({
      eventType: 'OrderRejected',
      aggregateId: orderId,
      correlationId: envelope.correlationId,
      payload: rejectedPayload,
    });

    await this.kafkaClient.sendEvent(TOPICS.ORDER_EVENTS, rejectedEnvelope);
    console.log(`[OrderService] Order ${orderId} REJECTED (${reason}) and OrderRejected event published.`);
  }
}
