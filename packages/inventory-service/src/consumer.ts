import { Consumer } from 'kafkajs';
import { ResilientKafkaClient } from '@streamz/kafka-client';
import { TOPICS, EventEnvelope, OrderCreatedPayload } from '@streamz/contracts';
import { InventoryService } from './inventoryService.js';

export interface ConsumerOptions {
  autoCommit?: boolean;
}

export async function startInventoryServiceConsumer(
  kafkaClient: ResilientKafkaClient,
  inventoryService: InventoryService,
  options: ConsumerOptions = { autoCommit: false }
): Promise<Consumer> {
  const consumer = await kafkaClient.createConsumer('inventory-service-group');
  await consumer.subscribe({ topic: TOPICS.ORDERS, fromBeginning: false });

  const autoCommit = options.autoCommit ?? false;
  console.log(
    `[InventoryConsumer] Subscribed to topic: orders with group: inventory-service-group (autoCommit: ${autoCommit})`
  );

  await consumer.run({
    autoCommit,
    eachMessage: async ({ topic, partition, message }) => {
      try {
        if (!message.value) return;
        const envelope = JSON.parse(message.value.toString()) as EventEnvelope<any>;

        if (envelope.eventType === 'OrderCreated') {
          console.log(
            `[InventoryConsumer] Received OrderCreated for ${envelope.aggregateId} (partition: ${partition}, offset: ${message.offset})`
          );
          // 1. Process database transaction & emit outcome
          await inventoryService.processOrderCreated(envelope as EventEnvelope<OrderCreatedPayload>);

          // 2. Explicit manual offset commit after DB success
          if (!autoCommit) {
            await kafkaClient.commitMessageOffset(consumer, topic, partition, message.offset);
            console.log(
              `[InventoryConsumer] Committed offset ${BigInt(message.offset) + 1n} for partition ${partition}`
            );
          }
        }
      } catch (err) {
        console.error('[InventoryConsumer] Error processing message (offset uncommitted):', err);
        // Do NOT commit offset on error - at-least-once delivery preserves message
        throw err;
      }
    },
  });

  return consumer;
}
