import { pool as notificationsPool } from '../packages/notification-worker/src/db.js';
import { ResilientKafkaClient, DlqManager } from '@streamz/kafka-client';
import { NotificationService } from '../packages/notification-worker/src/notificationService.js';
import { startNotificationWorkerConsumer } from '../packages/notification-worker/src/consumer.js';
import {
  TOPICS,
  createEventEnvelope,
  OrderConfirmedPayload,
  NotificationDlqPayload,
  EventEnvelope,
} from '@streamz/contracts';

async function runDlqResilienceTest() {
  console.log('=== Kafka Bounded Retries & Dead Letter Queue (DLQ) Resilience Test ===\n');

  const kafkaClient = new ResilientKafkaClient({
    clientId: 'dlq-test-client',
    brokers: [process.env.KAFKA_BROKERS || 'localhost:9094'],
  });

  const dlqManager = new DlqManager(kafkaClient);
  const notificationService = new NotificationService();

  // 1. Start Notification Worker with manual commits enabled
  const workerConsumer = await startNotificationWorkerConsumer(kafkaClient, notificationService, {
    autoCommit: false,
  });

  // 2. Start a test consumer monitoring notifications-dlq
  const dlqTestGroup = `dlq-inspector-group-${Date.now()}`;
  const dlqConsumer = await kafkaClient.createConsumer(dlqTestGroup);
  await dlqConsumer.subscribe({ topic: TOPICS.NOTIFICATIONS_DLQ, fromBeginning: false });

  const dlqCapturedEvents: EventEnvelope<NotificationDlqPayload>[] = [];
  dlqConsumer.run({
    eachMessage: async ({ message }) => {
      if (!message.value) return;
      try {
        const parsed = JSON.parse(message.value.toString());
        dlqCapturedEvents.push(parsed);
      } catch {
        // ignore
      }
    },
  });

  console.log('Waiting for consumer groups to stabilize...');
  await new Promise((r) => setTimeout(r, 4000));

  // --- Scenario 1: Poison Pill Routing to DLQ & Pipeline Non-Blocking Check ---
  console.log('\n1. Testing Poison Pill Quarantine and Non-Blocking Pipeline...');
  const producer = await kafkaClient.getProducer();

  const poisonKey = `poison-order-${Date.now()}`;
  const validKeyAfterPoison = `valid-order-after-${Date.now()}`;

  // Send a poison pill (corrupted non-JSON payload)
  await producer.send({
    topic: TOPICS.ORDER_EVENTS,
    messages: [
      {
        key: poisonKey,
        value: 'CORRUPTED_NON_JSON_POISON_PILL_PAYLOAD',
      },
    ],
  });
  console.log(`Sent corrupt message (${poisonKey}) to order-events.`);

  // Send a valid message immediately following the poison pill on the same partition/topic
  const validEnvelope = createEventEnvelope<OrderConfirmedPayload>({
    eventType: 'OrderConfirmed',
    aggregateId: validKeyAfterPoison,
    payload: {
      orderId: validKeyAfterPoison,
      customerId: 'cust-post-poison',
      totalPrice: 249.99,
      confirmedAt: new Date().toISOString(),
    },
  });

  await kafkaClient.sendEvent(TOPICS.ORDER_EVENTS, validEnvelope);
  console.log(`Sent valid message (${validKeyAfterPoison}) right after poison pill.`);

  // Verify:
  // A. Poison pill arrived in notifications-dlq
  console.log('Waiting for poison pill to arrive in notifications-dlq...');
  const startWait = Date.now();
  while (dlqCapturedEvents.length === 0 && Date.now() - startWait < 8000) {
    await new Promise((r) => setTimeout(r, 200));
  }

  if (dlqCapturedEvents.length === 0) {
    throw new Error('Poison message was not captured in DLQ!');
  }

  const capturedDlq = dlqCapturedEvents[0];
  console.log('✓ DLQ Ingestion Verified:');
  console.log('  Event ID:', capturedDlq.eventId);
  console.log('  Original Topic:', capturedDlq.payload.originalTopic);
  console.log('  Original Key:', capturedDlq.payload.originalKey);
  console.log('  Diagnostic Error:', capturedDlq.payload.errorMessage);

  // B. Subsequent valid message was NOT blocked and was successfully persisted in notifications_db
  let validOrderNotif: any = null;
  for (let i = 0; i < 25; i++) {
    const records = await notificationService.getNotificationsForOrder(validKeyAfterPoison);
    if (records.length > 0) {
      validOrderNotif = records[0];
      break;
    }
    await new Promise((r) => setTimeout(r, 200));
  }

  if (!validOrderNotif) {
    throw new Error('Pipeline Blocked! Valid message following poison pill was not processed.');
  }
  console.log('✓ Pipeline Non-Blocking Verified: Subsequent valid message was successfully processed despite preceding poison pill!');

  // --- Scenario 2: Dead Letter Queue Replay Recovery ---
  console.log('\n2. Testing Dead Letter Queue Replay Tool...');
  const replayOrderId = `order-replay-${Date.now()}`;

  // Synthesize a valid event that had been routed to DLQ due to downstream outage
  const mockDlqItem = await dlqManager.sendToDlq({
    originalTopic: TOPICS.ORDER_EVENTS,
    originalKey: replayOrderId,
    originalPayload: createEventEnvelope<OrderConfirmedPayload>({
      eventType: 'OrderConfirmed',
      aggregateId: replayOrderId,
      payload: {
        orderId: replayOrderId,
        customerId: 'cust-replayed-01',
        totalPrice: 150.0,
        confirmedAt: new Date().toISOString(),
      },
    }),
    error: new Error('Simulated upstream gateway timeout (now resolved)'),
    retryCount: 3,
  });

  console.log(`Replaying message ${replayOrderId} from DLQ back to origin topic...`);
  await dlqManager.replayMessage(mockDlqItem);

  // Verify that the replayed message is picked up by the Notification Worker and stored in DB
  let replayedNotif: any = null;
  for (let i = 0; i < 25; i++) {
    const records = await notificationService.getNotificationsForOrder(replayOrderId);
    if (records.length > 0) {
      replayedNotif = records[0];
      break;
    }
    await new Promise((r) => setTimeout(r, 200));
  }

  if (!replayedNotif) {
    throw new Error(`Replayed DLQ message for order ${replayOrderId} was not processed into notifications_db`);
  }

  console.log('✓ DLQ Replay Verified: Replayed message was successfully consumed and persisted:', {
    id: replayedNotif.id,
    orderId: replayedNotif.order_id,
    type: replayedNotif.type,
    recipient: replayedNotif.recipient,
  });

  // Cleanup
  await notificationsPool.query('DELETE FROM notifications WHERE order_id IN ($1, $2)', [
    validKeyAfterPoison,
    replayOrderId,
  ]);
  await notificationsPool.query('DELETE FROM processed_events WHERE event_id = $1', [
    validEnvelope.eventId,
  ]);

  await workerConsumer.disconnect();
  await dlqConsumer.disconnect();
  await kafkaClient.disconnectAll();
  await notificationsPool.end();

  console.log('\n=== Bounded Retries & DLQ Resilience Test Complete and 100% Successful! ===');
  process.exit(0);
}

runDlqResilienceTest().catch((err) => {
  console.error('DLQ Resilience test failed:', err);
  process.exit(1);
});
