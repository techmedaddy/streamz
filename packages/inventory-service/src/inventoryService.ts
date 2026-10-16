import { randomUUID } from 'crypto';
import { pool } from './db.js';
import { ResilientKafkaClient, EventTracer } from '@streamz/kafka-client';
import {
  TOPICS,
  createEventEnvelope,
  OrderCreatedPayload,
  InventoryReservedPayload,
  InventoryRejectedPayload,
  EventEnvelope,
} from '@streamz/contracts';

export class InventoryService {
  private tracer: EventTracer;

  constructor(private kafkaClient: ResilientKafkaClient) {
    this.tracer = new EventTracer(kafkaClient, 'inventory-service');
  }

  public async listProducts() {
    const res = await pool.query('SELECT * FROM products ORDER BY name ASC');
    return res.rows;
  }

  public async getProduct(id: string) {
    const res = await pool.query('SELECT * FROM products WHERE id = $1', [id]);
    return res.rows[0] || null;
  }

  public async listReservations() {
    const res = await pool.query('SELECT * FROM reservations ORDER BY created_at DESC LIMIT 50');
    return res.rows;
  }

  public async processOrderCreated(envelope: EventEnvelope<OrderCreatedPayload>): Promise<void> {
    const { orderId, productId, quantity } = envelope.payload;
    const consumerGroup = 'inventory-service-group';
    const startTime = Date.now();

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Idempotency Check using processed_events table
      const dedupeRes = await client.query(
        `INSERT INTO processed_events (event_id, consumer_group)
         VALUES ($1, $2)
         ON CONFLICT (event_id, consumer_group) DO NOTHING
         RETURNING event_id`,
        [envelope.eventId, consumerGroup]
      );

      if ((dedupeRes.rowCount ?? 0) === 0) {
        console.log(`[InventoryService] Event ${envelope.eventId} already processed, skipping.`);
        await client.query('ROLLBACK');
        return;
      }

      // 2. Lock product row to prevent race conditions & overselling
      const productRes = await client.query(
        `SELECT id, sku, name, stock_quantity, reserved_quantity
         FROM products
         WHERE id = $1
         FOR UPDATE`,
        [productId]
      );

      if (productRes.rowCount === 0) {
        // Product does not exist
        await client.query('COMMIT');

        const rejectedPayload: InventoryRejectedPayload = {
          orderId,
          productId,
          requestedQuantity: quantity,
          availableQuantity: 0,
          reason: `Product ${productId} not found`,
          rejectedAt: new Date().toISOString(),
        };

        const rejectedEnvelope = createEventEnvelope<InventoryRejectedPayload>({
          eventType: 'InventoryRejected',
          aggregateId: orderId,
          correlationId: envelope.correlationId,
          payload: rejectedPayload,
        });

        await this.kafkaClient.sendEvent(TOPICS.INVENTORY_EVENTS, rejectedEnvelope);
        await this.tracer.recordSpan({
          correlationId: envelope.correlationId,
          aggregateId: orderId,
          eventType: 'InventoryRejected',
          stage: 'FAILED',
          durationMs: Date.now() - startTime,
          metadata: { productId, reason: rejectedPayload.reason },
        });
        console.log(`[InventoryService] Rejected order ${orderId}: product not found.`);
        return;
      }

      const product = productRes.rows[0];
      const availableStock = product.stock_quantity - product.reserved_quantity;

      // 3. Evaluate stock availability
      if (availableStock >= quantity) {
        // Sufficient stock: Reserve stock
        const reservationId = `res-${randomUUID().slice(0, 8)}`;

        await client.query(
          `UPDATE products 
           SET reserved_quantity = reserved_quantity + $1, updated_at = NOW() 
           WHERE id = $2`,
          [quantity, productId]
        );

        await client.query(
          `INSERT INTO reservations (id, order_id, product_id, quantity, status)
           VALUES ($1, $2, $3, $4, 'RESERVED')`,
          [reservationId, orderId, productId, quantity]
        );

        await client.query('COMMIT');

        // Publish InventoryReserved event
        const reservedPayload: InventoryReservedPayload = {
          orderId,
          productId,
          quantity,
          reservationId,
          reservedAt: new Date().toISOString(),
        };

        const reservedEnvelope = createEventEnvelope<InventoryReservedPayload>({
          eventType: 'InventoryReserved',
          aggregateId: orderId,
          correlationId: envelope.correlationId,
          payload: reservedPayload,
        });

        await this.kafkaClient.sendEvent(TOPICS.INVENTORY_EVENTS, reservedEnvelope);
        await this.tracer.recordSpan({
          correlationId: envelope.correlationId,
          aggregateId: orderId,
          eventType: 'InventoryReserved',
          stage: 'PROCESSED',
          durationMs: Date.now() - startTime,
          metadata: { productId, quantity, reservationId },
        });
        console.log(
          `[InventoryService] Reserved ${quantity} of ${product.sku} for order ${orderId} (remaining available: ${availableStock - quantity})`
        );
      } else {
        // Insufficient stock: Reject reservation
        await client.query('COMMIT');

        const reason = `Insufficient stock: requested ${quantity}, available ${availableStock}`;
        const rejectedPayload: InventoryRejectedPayload = {
          orderId,
          productId,
          requestedQuantity: quantity,
          availableQuantity: availableStock,
          reason,
          rejectedAt: new Date().toISOString(),
        };

        const rejectedEnvelope = createEventEnvelope<InventoryRejectedPayload>({
          eventType: 'InventoryRejected',
          aggregateId: orderId,
          correlationId: envelope.correlationId,
          payload: rejectedPayload,
        });

        await this.kafkaClient.sendEvent(TOPICS.INVENTORY_EVENTS, rejectedEnvelope);
        await this.tracer.recordSpan({
          correlationId: envelope.correlationId,
          aggregateId: orderId,
          eventType: 'InventoryRejected',
          stage: 'PROCESSED',
          durationMs: Date.now() - startTime,
          metadata: { productId, requestedQuantity: quantity, reason },
        });
        console.log(`[InventoryService] Rejected order ${orderId}: ${reason}`);
      }
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(`[InventoryService] Error reserving stock for order ${orderId}:`, err);
      throw err;
    } finally {
      client.release();
    }
  }
}
