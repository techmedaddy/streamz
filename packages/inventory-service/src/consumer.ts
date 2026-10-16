import { ResilientKafkaClient } from '@streamz/kafka-client';
import { TOPICS, EventEnvelope, OrderCreatedPayload } from '@streamz/contracts';
import { InventoryService } from './inventoryService.js';

export async function startInventoryServiceConsumer(
  kafkaClient: ResilientKafkaClient,
  inventoryService: InventoryService
) {
  const consumer = await kafkaClient.createConsumer('inventory-service-group');
  await consumer.subscribe({ topic: TOPICS.ORDERS, fromBeginning: false });

  console.log('[InventoryConsumer] Subscribed to topic: orders with group: inventory-service-group');

  await consumer.run({
    autoCommit: true,
    eachMessage: async ({ topic, partition, message }) => {
      try {
        if (!message.value) return;
        const envelope = JSON.parse(message.value.toString()) as EventEnvelope<any>;

        if (envelope.eventType === 'OrderCreated') {
          console.log(
            `[InventoryConsumer] Received OrderCreated for ${envelope.aggregateId} on partition ${partition}`
          );
          await inventoryService.processOrderCreated(envelope as EventEnvelope<OrderCreatedPayload>);
        }
      } catch (err) {
        console.error('[InventoryConsumer] Error processing message:', err);
      }
    },
  });
}
