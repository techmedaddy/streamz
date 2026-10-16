import { ResilientKafkaClient } from './index.js';
import {
  TOPICS,
  createEventEnvelope,
  NotificationDlqPayload,
  EventEnvelope,
} from '@streamz/contracts';

export interface DlqRouteOptions {
  originalTopic: string;
  originalKey: string | null;
  originalPayload: unknown;
  error: Error | string;
  retryCount: number;
}

export class DlqManager {
  constructor(private kafkaClient: ResilientKafkaClient) {}

  /**
   * Routes a failed message to the designated Dead Letter Queue topic.
   */
  public async sendToDlq(options: DlqRouteOptions): Promise<EventEnvelope<NotificationDlqPayload>> {
    const errorMessage = typeof options.error === 'string' ? options.error : options.error.message;
    const errorStack = typeof options.error === 'string' ? undefined : options.error.stack;

    const dlqPayload: NotificationDlqPayload = {
      originalTopic: options.originalTopic,
      originalKey: options.originalKey,
      originalPayload: options.originalPayload,
      errorMessage,
      errorStack,
      retryCount: options.retryCount,
      failedAt: new Date().toISOString(),
    };

    const dlqEnvelope = createEventEnvelope<NotificationDlqPayload>({
      eventType: 'DeadLetterEncountered',
      aggregateId: options.originalKey || 'unassigned',
      payload: dlqPayload,
    });

    const producer = await this.kafkaClient.getProducer();
    await producer.send({
      topic: TOPICS.NOTIFICATIONS_DLQ,
      messages: [
        {
          key: dlqEnvelope.aggregateId,
          value: JSON.stringify(dlqEnvelope),
          headers: {
            'x-original-topic': options.originalTopic,
            'x-original-key': options.originalKey ?? '',
            'x-exception-message': errorMessage,
            'x-retry-count': options.retryCount.toString(),
            'x-failed-at': dlqPayload.failedAt,
          },
        },
      ],
    });

    console.log(
      `[DlqManager] Quarantined message for ${options.originalKey} to ${TOPICS.NOTIFICATIONS_DLQ} (retries: ${options.retryCount})`
    );
    return dlqEnvelope;
  }

  /**
   * Replays a quarantined message from DLQ back to its original or target topic.
   */
  public async replayMessage(
    dlqEnvelope: EventEnvelope<NotificationDlqPayload>,
    overrideTopic?: string
  ): Promise<void> {
    const targetTopic = overrideTopic || dlqEnvelope.payload.originalTopic;
    const targetKey = dlqEnvelope.payload.originalKey || dlqEnvelope.aggregateId;
    const originalPayload = dlqEnvelope.payload.originalPayload;

    const producer = await this.kafkaClient.getProducer();
    const value =
      typeof originalPayload === 'string'
        ? originalPayload
        : JSON.stringify(originalPayload);

    await producer.send({
      topic: targetTopic,
      messages: [
        {
          key: targetKey,
          value,
          headers: {
            'x-replayed-from-dlq': 'true',
            'x-replayed-at': new Date().toISOString(),
            'x-dlq-event-id': dlqEnvelope.eventId,
          },
        },
      ],
    });

    console.log(`[DlqManager] Replayed message ${targetKey} back to ${targetTopic}`);
  }
}
