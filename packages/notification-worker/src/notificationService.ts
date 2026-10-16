import { randomUUID } from 'crypto';
import { pool } from './db.js';
import {
  EventEnvelope,
  OrderConfirmedPayload,
  OrderRejectedPayload,
} from '@streamz/contracts';

export class NotificationService {
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

  public async listNotifications() {
    const res = await pool.query('SELECT * FROM notifications ORDER BY created_at DESC LIMIT 50');
    return res.rows;
  }

  public async getNotificationsForOrder(orderId: string) {
    const res = await pool.query('SELECT * FROM notifications WHERE order_id = $1', [orderId]);
    return res.rows;
  }

  public async handleOrderConfirmed(envelope: EventEnvelope<OrderConfirmedPayload>) {
    const { orderId, customerId, totalPrice, confirmedAt } = envelope.payload;
    const consumerGroup = 'notification-worker-group';

    // 1. Idempotency Check
    if (await this.isEventProcessed(envelope.eventId, consumerGroup)) {
      console.log(`[NotificationService] Event ${envelope.eventId} already processed, skipping.`);
      return;
    }

    const notifId = `notif-${randomUUID().slice(0, 8)}`;
    const notificationPayload = {
      message: `Dear customer, your order ${orderId} has been confirmed! Total: $${totalPrice}`,
      orderId,
      customerId,
      totalPrice,
      confirmedAt,
      correlationId: envelope.correlationId,
    };

    // 2. Persist notification and mark event processed
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      await client.query(
        `INSERT INTO notifications (id, order_id, type, recipient, status, payload)
         VALUES ($1, $2, 'ORDER_CONFIRMED', $3, 'SENT', $4)`,
        [notifId, orderId, customerId, JSON.stringify(notificationPayload)]
      );

      await client.query(
        `INSERT INTO processed_events (event_id, consumer_group)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [envelope.eventId, consumerGroup]
      );

      await client.query('COMMIT');
      console.log(`[NotificationService] Created ORDER_CONFIRMED notification ${notifId} for ${orderId}`);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  public async handleOrderRejected(envelope: EventEnvelope<OrderRejectedPayload>) {
    const { orderId, customerId, reason, rejectedAt } = envelope.payload;
    const consumerGroup = 'notification-worker-group';

    // 1. Idempotency Check
    if (await this.isEventProcessed(envelope.eventId, consumerGroup)) {
      console.log(`[NotificationService] Event ${envelope.eventId} already processed, skipping.`);
      return;
    }

    const notifId = `notif-${randomUUID().slice(0, 8)}`;
    const notificationPayload = {
      message: `Dear customer, unfortunately your order ${orderId} was rejected. Reason: ${reason}`,
      orderId,
      customerId,
      reason,
      rejectedAt,
      correlationId: envelope.correlationId,
    };

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      await client.query(
        `INSERT INTO notifications (id, order_id, type, recipient, status, payload)
         VALUES ($1, $2, 'ORDER_REJECTED', $3, 'SENT', $4)`,
        [notifId, orderId, customerId, JSON.stringify(notificationPayload)]
      );

      await client.query(
        `INSERT INTO processed_events (event_id, consumer_group)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [envelope.eventId, consumerGroup]
      );

      await client.query('COMMIT');
      console.log(`[NotificationService] Created ORDER_REJECTED notification ${notifId} for ${orderId}`);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}
