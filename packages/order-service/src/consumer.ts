import { ResilientKafkaClient } from '@streamz/kafka-client';
import { TOPICS, EventEnvelope, InventoryReservedPayload, InventoryRejectedPayload } from '@streamz/contracts';
import { OrderService } from './orderService.js';

export async function startOrderServiceConsumer(
  kafkaClient: ResilientKafkaClient,
  orderService: OrderService
) {
  const consumer = await kafkaClient.createConsumer('order-service-group');
  await consumer.subscribe({ topic: TOPICS.INVENTORY_EVENTS, fromBeginning: false });

  console.log('[OrderServiceConsumer] Subscribed to topic: inventory-events');

  await consumer.run({
    autoCommit: true,
    eachMessage: async ({ topic, partition, message }) => {
      try {
        if (!message.value) return;
        const envelope = JSON.parse(message.value.toString()) as EventEnvelope<any>;

        console.log(
          `[OrderServiceConsumer] Received event: ${envelope.eventType} for order: ${envelope.aggregateId} (partition: ${partition}, offset: ${message.offset})`
        );

        if (envelope.eventType === 'InventoryReserved') {
          await orderService.handleInventoryReserved(envelope as EventEnvelope<InventoryReservedPayload>);
        } else if (envelope.eventType === 'InventoryRejected') {
          await orderService.handleInventoryRejected(envelope as EventEnvelope<InventoryRejectedPayload>);
        }
      } catch (err) {
        console.error('[OrderServiceConsumer] Error processing message:', err);
      }
    },
  });
}
