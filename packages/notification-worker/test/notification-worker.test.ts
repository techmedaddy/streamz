import { pool } from '../src/db.js';
import { ResilientKafkaClient } from '@streamz/kafka-client';
import { NotificationService } from '../src/notificationService.js';
import { startNotificationWorkerConsumer } from '../src/consumer.js';
import {
  TOPICS,
  createEventEnvelope,
  OrderConfirmedPayload,
  OrderRejectedPayload,
} from '@streamz/contracts';

async function testNotificationWorker() {
  console.log('--- Testing Notification Worker Service (Events, Retries & DLQ) ---');

  const kafkaClient = new ResilientKafkaClient({
    clientId: 'notification-worker-test-client',
    brokers: [process.env.KAFKA_BROKERS || 'localhost:9094'],
  });

  const notificationService = new NotificationService();

  // 1. Start the Notification Worker Consumer
  const workerConsumer = await startNotificationWorkerConsumer(kafkaClient, notificationService);

  // 2. Setup a test consumer listening to `notifications-dlq` topic
  const dlqConsumer = await kafkaClient.createConsumer(`test-dlq-${Date.now()}`);
  await dlqConsumer.subscribe({ topic: TOPICS.NOTIFICATIONS_DLQ, fromBeginning: false });

  const dlqMessages: any[] = [];
  dlqConsumer.run({
    eachMessage: async ({ message }) => {
      if (!message.value) return;
      dlqMessages.push(JSON.parse(message.value.toString()));
    },
  });

  console.log('Waiting for consumer groups to stabilize...');
  await new Promise((r) => setTimeout(r, 4000));

  // --- Scenario 1: Order Confirmed Notification ---
  console.log('\n[Scenario 1] Testing OrderConfirmed Notification Processing...');
  const orderId1 = `ord-notif-confirm-${Date.now()}`;
  const confirmedEnvelope = createEventEnvelope<OrderConfirmedPayload>({
    eventType: 'OrderConfirmed',
    aggregateId: orderId1,
    correlationId: 'corr-notif-01',
    payload: {
      orderId: orderId1,
      customerId: 'cust-notif-01',
      totalPrice: 199.98,
      confirmedAt: new Date().toISOString(),
    },
  });

  await kafkaClient.sendEvent(TOPICS.ORDER_EVENTS, confirmedEnvelope);
  console.log(`Published OrderConfirmed event for: ${orderId1}`);

  let notif1: any = null;
  for (let i = 0; i < 20; i++) {
    const records = await notificationService.getNotificationsForOrder(orderId1);
    if (records.length > 0) {
      notif1 = records[0];
      break;
    }
    await new Promise((r) => setTimeout(r, 300));
  }

  if (!notif1) {
    throw new Error(`Notification not created in DB for confirmed order ${orderId1}`);
  }
  if (notif1.type !== 'ORDER_CONFIRMED' || notif1.recipient !== 'cust-notif-01') {
    throw new Error(`Notification record mismatch: type=${notif1.type}, recipient=${notif1.recipient}`);
  }
  console.log('✓ Database verified: Stored ORDER_CONFIRMED notification:', {
    id: notif1.id,
    orderId: notif1.order_id,
    type: notif1.type,
    recipient: notif1.recipient,
  });

  // --- Scenario 2: Order Rejected Notification ---
  console.log('\n[Scenario 2] Testing OrderRejected Notification Processing...');
  const orderId2 = `ord-notif-reject-${Date.now()}`;
  const rejectedEnvelope = createEventEnvelope<OrderRejectedPayload>({
    eventType: 'OrderRejected',
    aggregateId: orderId2,
    correlationId: 'corr-notif-02',
    payload: {
      orderId: orderId2,
      customerId: 'cust-notif-02',
      reason: 'Payment authorization timeout',
      rejectedAt: new Date().toISOString(),
    },
  });

  await kafkaClient.sendEvent(TOPICS.ORDER_EVENTS, rejectedEnvelope);
  console.log(`Published OrderRejected event for: ${orderId2}`);

  let notif2: any = null;
  for (let i = 0; i < 20; i++) {
    const records = await notificationService.getNotificationsForOrder(orderId2);
    if (records.length > 0) {
      notif2 = records[0];
      break;
    }
    await new Promise((r) => setTimeout(r, 300));
  }

  if (!notif2) {
    throw new Error(`Notification not created in DB for rejected order ${orderId2}`);
  }
  if (notif2.type !== 'ORDER_REJECTED') {
    throw new Error(`Notification record mismatch: type=${notif2.type}`);
  }
  console.log('✓ Database verified: Stored ORDER_REJECTED notification:', {
    id: notif2.id,
    orderId: notif2.order_id,
    type: notif2.type,
    recipient: notif2.recipient,
  });

  // --- Scenario 3: Idempotency Protection ---
  console.log('\n[Scenario 3] Testing Idempotent Delivery Guard (replaying confirmed event)...');
  await kafkaClient.sendEvent(TOPICS.ORDER_EVENTS, confirmedEnvelope);
  await new Promise((r) => setTimeout(r, 1500));

  const allRecords1 = await notificationService.getNotificationsForOrder(orderId1);
  if (allRecords1.length !== 1) {
    throw new Error(`Idempotency failure! Found ${allRecords1.length} notifications for order ${orderId1}, expected 1`);
  }
  console.log('✓ Idempotency verified: Replayed event safely skipped, exactly 1 notification retained.');

  // --- Scenario 4: Poison Pill / DLQ Routing ---
  console.log('\n[Scenario 4] Testing Poison Pill / Dead Letter Queue (DLQ) Routing...');
  const producer = await kafkaClient.getProducer();
  await producer.send({
    topic: TOPICS.ORDER_EVENTS,
    messages: [
      {
        key: 'toxic-key-99',
        value: 'THIS_IS_CORRUPT_NON_JSON_DATA_POISON_PILL',
      },
    ],
  });
  console.log('Sent malformed payload to order-events topic.');

  for (let i = 0; i < 20 && dlqMessages.length === 0; i++) {
    await new Promise((r) => setTimeout(r, 300));
  }

  if (dlqMessages.length === 0) {
    throw new Error('Poison message was not routed to notifications-dlq!');
  }

  const dlqEvent = dlqMessages[0];
  console.log('✓ DLQ Routing verified: Captured event from "notifications-dlq":', {
    eventType: dlqEvent.eventType,
    originalTopic: dlqEvent.payload.originalTopic,
    originalKey: dlqEvent.payload.originalKey,
    errorMessage: dlqEvent.payload.errorMessage,
  });

  // Cleanup
  await pool.query('DELETE FROM notifications WHERE order_id IN ($1, $2)', [orderId1, orderId2]);
  await pool.query('DELETE FROM processed_events WHERE event_id IN ($1, $2)', [confirmedEnvelope.eventId, rejectedEnvelope.eventId]);

  await workerConsumer.disconnect();
  await dlqConsumer.disconnect();
  await kafkaClient.disconnectAll();
  await pool.end();

  console.log('\n--- Notification Worker Verification Complete and Successful! ---');
  process.exit(0);
}

testNotificationWorker().catch((err) => {
  console.error('Verification failed:', err);
  process.exit(1);
});
