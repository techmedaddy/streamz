import { randomUUID } from 'crypto';
import { pool } from './db.js';
import { executeIdempotentTransaction } from '@streamz/kafka-client';
import {
  EventEnvelope,
  OrderConfirmedPayload,
  OrderRejectedPayload,
} from '@streamz/contracts';

export class NotificationService {
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

    const notifId = `notif-${randomUUID().slice(0, 8)}`;
    const notificationPayload = {
      message: `Dear customer, your order ${orderId} has been confirmed! Total: $${totalPrice}`,
      orderId,
      customerId,
      totalPrice,
      confirmedAt,
      correlationId: envelope.correlationId,
    };

    const idempResult = await executeIdempotentTransaction(
      pool,
      envelope.eventId,
      consumerGroup,
      async (client) => {
        await client.query(
          `INSERT INTO notifications (id, order_id, type, recipient, status, payload)
           VALUES ($1, $2, 'ORDER_CONFIRMED', $3, 'SENT', $4)`,
          [notifId, orderId, customerId, JSON.stringify(notificationPayload)]
        );
        return notifId;
      }
    );

    if (!idempResult.executed) {
      console.log(`[NotificationService] Duplicate event ${envelope.eventId} skipped via inbox table.`);
      return;
    }

    console.log(`[NotificationService] Created ORDER_CONFIRMED notification ${notifId} for ${orderId}`);
  }

  public async handleOrderRejected(envelope: EventEnvelope<OrderRejectedPayload>) {
    const { orderId, customerId, reason, rejectedAt } = envelope.payload;
    const consumerGroup = 'notification-worker-group';

    const notifId = `notif-${randomUUID().slice(0, 8)}`;
    const notificationPayload = {
      message: `Dear customer, unfortunately your order ${orderId} was rejected. Reason: ${reason}`,
      orderId,
      customerId,
      reason,
      rejectedAt,
      correlationId: envelope.correlationId,
    };

    const idempResult = await executeIdempotentTransaction(
      pool,
      envelope.eventId,
      consumerGroup,
      async (client) => {
        await client.query(
          `INSERT INTO notifications (id, order_id, type, recipient, status, payload)
           VALUES ($1, $2, 'ORDER_REJECTED', $3, 'SENT', $4)`,
          [notifId, orderId, customerId, JSON.stringify(notificationPayload)]
        );
        return notifId;
      }
    );

    if (!idempResult.executed) {
      console.log(`[NotificationService] Duplicate event ${envelope.eventId} skipped via inbox table.`);
      return;
    }

    console.log(`[NotificationService] Created ORDER_REJECTED notification ${notifId} for ${orderId}`);
  }
}
