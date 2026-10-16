import { Consumer } from 'kafkajs';
import { ResilientKafkaClient, DlqManager } from '@streamz/kafka-client';
import {
  TOPICS,
  EventEnvelope,
  OrderConfirmedPayload,
  OrderRejectedPayload,
} from '@streamz/contracts';
import { NotificationService } from './notificationService.js';

const MAX_RETRIES = 3;

export interface NotificationConsumerOptions {
  autoCommit?: boolean;
}

export async function startNotificationWorkerConsumer(
  kafkaClient: ResilientKafkaClient,
  notificationService: NotificationService,
  options: NotificationConsumerOptions = { autoCommit: false }
): Promise<Consumer> {
  const consumer = await kafkaClient.createConsumer('notification-worker-group');
  await consumer.subscribe({ topic: TOPICS.ORDER_EVENTS, fromBeginning: false });

  const dlqManager = new DlqManager(kafkaClient);
  const autoCommit = options.autoCommit ?? false;

  console.log(
    `[NotificationWorker] Subscribed to topic: order-events with group: notification-worker-group (autoCommit: ${autoCommit})`
  );

  await consumer.run({
    autoCommit,
    eachMessage: async ({ topic, partition, message }) => {
      const rawValue = message.value?.toString();
      const messageKey = message.key?.toString() || null;

      if (!rawValue) return;

      let envelope: EventEnvelope<any>;
      try {
        envelope = JSON.parse(rawValue);
      } catch (parseErr: any) {
        console.error('[NotificationWorker] Poison pill detected (invalid JSON). Routing to DLQ.');
        await dlqManager.sendToDlq({
          originalTopic: topic,
          originalKey: messageKey,
          originalPayload: rawValue,
          error: parseErr,
          retryCount: 0,
        });

        // Commit poison offset so partition is not blocked
        if (!autoCommit) {
          await kafkaClient.commitMessageOffset(consumer, topic, partition, message.offset);
        }
        return;
      }

      console.log(
        `[NotificationWorker] Ingested event: ${envelope.eventType} for order: ${envelope.aggregateId} (partition: ${partition}, offset: ${message.offset})`
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

          // Processing succeeded! Commit offset
          if (!autoCommit) {
            await kafkaClient.commitMessageOffset(consumer, topic, partition, message.offset);
          }
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

      // Max retries exhausted: Quarantine to DLQ and advance offset to prevent pipeline stall
      console.error(
        `[NotificationWorker] Max retries (${MAX_RETRIES}) exhausted for event ${envelope.eventId}. Routing to DLQ.`
      );

      await dlqManager.sendToDlq({
        originalTopic: topic,
        originalKey: messageKey,
        originalPayload: envelope,
        error: lastError || new Error('Unknown processing failure'),
        retryCount: attempts,
      });

      if (!autoCommit) {
        await kafkaClient.commitMessageOffset(consumer, topic, partition, message.offset);
        console.log(`[NotificationWorker] Advanced offset past failed message ${message.offset}`);
      }
    },
  });

  return consumer;
}
