import { pool } from '../src/db.js';
import { ResilientKafkaClient } from '@streamz/kafka-client';
import { OrderService } from '../src/orderService.js';
import { TOPICS } from '@streamz/contracts';

async function verifySubphase2_2() {
  console.log('--- Verifying Sub-phase 2.2: Order Service (POST /orders & Event Emitter) ---');

  const kafkaClient = new ResilientKafkaClient({
    clientId: 'verify-subphase-2-2',
    brokers: [process.env.KAFKA_BROKERS || 'localhost:9094'],
  });

  const orderService = new OrderService(kafkaClient);

  // 1. Create order in OrderService
  console.log('Creating test order...');
  const order = await orderService.createOrder({
    customerId: 'cust-verify-subphase-2-2',
    productId: 'prod-keyboard-rgb',
    quantity: 1,
    unitPrice: 99.99,
  });

  console.log('Order created in DB:', {
    id: order.id,
    customer_id: order.customer_id,
    status: order.status,
    total_amount: order.total_amount,
  });

  // 2. Verify DB state
  const dbOrder = await orderService.getOrder(order.id);
  if (!dbOrder || dbOrder.status !== 'PENDING') {
    throw new Error(`DB verification failed: expected status PENDING, got ${dbOrder?.status}`);
  }
  console.log('✓ Database verification passed: Order exists with status PENDING.');

  // 3. Verify event on Kafka
  console.log('Verifying event delivery on Kafka "orders" topic...');
  const consumer = await kafkaClient.createConsumer(`verify-group-${Date.now()}`);
  await consumer.subscribe({ topic: TOPICS.ORDERS, fromBeginning: true });

  let capturedEvent: any = null;
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Timeout waiting for matching Kafka event')), 10000)
  );

  const eventPromise = new Promise<void>((resolve) => {
    consumer.run({
      eachMessage: async ({ message }) => {
        if (!message.value) return;
        const parsed = JSON.parse(message.value.toString());
        if (parsed.payload?.orderId === order.id) {
          capturedEvent = parsed;
          resolve();
        }
      },
    });
  });

  await Promise.race([eventPromise, timeoutPromise]);

  console.log('✓ Kafka event verification passed: Received OrderCreated event:');
  console.log('  Event ID:', capturedEvent.eventId);
  console.log('  Event Type:', capturedEvent.eventType);
  console.log('  Aggregate ID:', capturedEvent.aggregateId);
  console.log('  Correlation ID:', capturedEvent.correlationId);
  console.log('  Payload:', capturedEvent.payload);

  await consumer.disconnect();
  await kafkaClient.disconnectAll();
  await pool.end();

  console.log('--- Sub-phase 2.2 Verification Complete and 100% Successful! ---');
  process.exit(0);
}

verifySubphase2_2().catch((err) => {
  console.error('Verification failed:', err);
  process.exit(1);
});
