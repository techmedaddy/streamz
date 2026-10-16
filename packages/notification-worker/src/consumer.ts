import { Consumer } from 'kafkajs';
import { ResilientKafkaClient } from '@streamz/kafka-client';
import {
  TOPICS,
  EventEnvelope,
  OrderConfirmedPayload,
  OrderRejectedPayload,
  createEventEnvelope,
  NotificationDlqPayload,
} from '@streamz/contracts';
import { NotificationService } from './notificationService.js';

const MAX_RETRIES = 3;

export async function startNotificationWorkerConsumer(
  kafkaClient: ResilientKafkaClient,
  notificationService: NotificationService
): Promise<Consumer> {
  const consumer = await kafkaClient.createConsumer('notification-worker-group');
  await consumer.subscribe({ topic: TOPICS.ORDER_EVENTS, fromBeginning: false });

  console.log('[NotificationWorker] Subscribed to topic: order-events with group: notification-worker-group');

  await consumer.run({
    autoCommit: true,
    eachMessage: async ({ topic, partition, message }) => {
      const rawValue = message.value?.toString();
      const messageKey = message.key?.toString() || null;

      if (!rawValue) return;

      let envelope: EventEnvelope<any>;
      try {
        envelope = JSON.parse(rawValue);
      } catch (parseErr: any) {
        console.error('[NotificationWorker] Poison pill detected (invalid JSON). Routing to DLQ.');
        await routeToDlq(kafkaClient, topic, messageKey, rawValue, parseErr.message, 0);
        return;
      }

      console.log(
        `[NotificationWorker] Processing event: ${envelope.eventType} for order: ${envelope.aggregateId} (partition: ${partition}, offset: ${message.offset})`
      );

      let attempts = 0;
      let lastError: any = null;

      while (attempts <= MAX_RETRIES) {
        try {
          if (envelope.eventType === 'OrderConfirmed') {
            await notificationService.handleOrderConfirmed(envelope as EventEnvelope<OrderConfirmedPayload>);
          } else if (envelope.eventType === 'OrderRejected') {
            await notificationService.handleOrderRejected(envelope as EventEnvelope<OrderRejectedPayload>);
          }
          // Success!
          return;
        } catch (err: any) {
          attempts++;
          lastError = err;
          console.warn(
            `[NotificationWorker] Attempt ${attempts}/${MAX_RETRIES} failed for event ${envelope.eventId}: ${err.message}`
          );

          if (attempts <= MAX_RETRIES) {
            // Exponential backoff
            const delay = attempts * 300;
            await new Promise((r) => setTimeout(r, delay));
          }
        }
      }

      // If all retries exhausted, send to Dead Letter Queue
      console.error(
        `[NotificationWorker] Max retries (${MAX_RETRIES}) exhausted for event ${envelope.eventId}. Sending to DLQ.`
      );
      await routeToDlq(
        kafkaClient,
        topic,
        messageKey,
        envelope,
        lastError?.message || 'Unknown processing error',
        attempts,
        lastError?.stack
      );
    },
  });

  return consumer;
}

async function routeToDlq(
  kafkaClient: ResilientKafkaClient,
  originalTopic: string,
  originalKey: string | null,
  originalPayload: any,
  errorMessage: string,
  retryCount: number,
  errorStack?: string
): Promise<void> {
  const dlqPayload: NotificationDlqPayload = {
    originalTopic,
    originalKey,
    originalPayload,
    errorMessage,
    errorStack,
    retryCount,
    failedAt: new Date().toISOString(),
  };

  const dlqEnvelope = createEventEnvelope<NotificationDlqPayload>({
    eventType: 'NotificationFailed',
    aggregateId: originalKey || 'unknown',
    payload: dlqPayload,
  });

  await kafkaClient.sendEvent(TOPICS.NOTIFICATIONS_DLQ, dlqEnvelope);
  console.log(`[NotificationWorker] Event routed to ${TOPICS.NOTIFICATIONS_DLQ} with key: ${dlqEnvelope.aggregateId}`);
}
