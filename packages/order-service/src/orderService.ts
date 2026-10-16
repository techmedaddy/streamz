import { randomUUID } from 'crypto';
import { pool } from './db.js';
import { ResilientKafkaClient, executeIdempotentTransaction } from '@streamz/kafka-client';
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

    // Atomic Idempotent Transaction
    const idempResult = await executeIdempotentTransaction(
      pool,
      envelope.eventId,
      'order-service-group',
      async (client) => {
        const updateRes = await client.query(
          `UPDATE orders 
           SET status = 'CONFIRMED', updated_at = NOW() 
           WHERE id = $1 AND status = 'PENDING'
           RETURNING *`,
          [orderId]
        );
        return updateRes.rows[0] || null;
      }
    );

    if (!idempResult.executed) {
      console.log(`[OrderService] Duplicate event ${envelope.eventId} skipped via inbox table.`);
      return;
    }

    const order = idempResult.result;
    if (!order) {
      console.log(`[OrderService] Order ${orderId} is not in PENDING state, skipping transition.`);
      return;
    }

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

    // Atomic Idempotent Transaction
    const idempResult = await executeIdempotentTransaction(
      pool,
      envelope.eventId,
      'order-service-group',
      async (client) => {
        const updateRes = await client.query(
          `UPDATE orders 
           SET status = 'REJECTED', rejection_reason = $2, updated_at = NOW() 
           WHERE id = $1 AND status = 'PENDING'
           RETURNING *`,
          [orderId, reason]
        );
        return updateRes.rows[0] || null;
      }
    );

    if (!idempResult.executed) {
      console.log(`[OrderService] Duplicate event ${envelope.eventId} skipped via inbox table.`);
      return;
    }

    const order = idempResult.result;
    if (!order) {
      return;
    }

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
