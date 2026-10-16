import { pool as inventoryPool } from '../packages/inventory-service/src/db.js';
import { pool as notificationsPool } from '../packages/notification-worker/src/db.js';
import { ResilientKafkaClient, executeIdempotentTransaction } from '@streamz/kafka-client';
import { InventoryService } from '../packages/inventory-service/src/inventoryService.js';
import { NotificationService } from '../packages/notification-worker/src/notificationService.js';
import {
  createEventEnvelope,
  OrderCreatedPayload,
  OrderConfirmedPayload,
} from '@streamz/contracts';

async function runIdempotencyTests() {
  console.log('=== Kafka Consumer Idempotency & Inbox Deduplication Tests ===\n');

  const kafkaClient = new ResilientKafkaClient({
    clientId: 'idempotency-test-client',
    brokers: [process.env.KAFKA_BROKERS || 'localhost:9094'],
  });

  const inventoryService = new InventoryService(kafkaClient);
  const notificationService = new NotificationService();

  // --- Test 1: Concurrent Duplicate Bombardment (Race Condition Immunity) ---
  console.log('1. Testing High-Concurrency Duplicate Bombardment (10 parallel executions of same event)...');
  const productId = 'prod-mouse-wireless'; // initial stock 25
  const initialProduct = await inventoryService.getProduct(productId);
  const startReserved = Number(initialProduct.reserved_quantity);

  const orderId = `order-dedupe-${Date.now()}`;
  const envelope = createEventEnvelope<OrderCreatedPayload>({
    eventType: 'OrderCreated',
    aggregateId: orderId,
    payload: {
      orderId,
      customerId: 'cust-idempotent-01',
      productId,
      quantity: 2,
      totalPrice: 99.98,
    },
  });

  // Launch 10 parallel invocations of processOrderCreated with the exact same event
  console.log(`Firing 10 parallel calls for eventId: ${envelope.eventId}...`);
  const promises = Array.from({ length: 10 }, () =>
    inventoryService.processOrderCreated(envelope)
  );

  await Promise.all(promises);

  // Assert DB state
  const productAfter = await inventoryService.getProduct(productId);
  const endReserved = Number(productAfter.reserved_quantity);
  const diff = endReserved - startReserved;

  const reservationRows = await inventoryPool.query(
    'SELECT * FROM reservations WHERE order_id = $1',
    [orderId]
  );

  console.log(`Initial reserved: ${startReserved}, After 10 concurrent requests: ${endReserved}`);
  console.log(`Reservations count in DB: ${reservationRows.rows.length}`);

  if (diff !== 2) {
    throw new Error(`Concurrency deduplication failure! Expected exactly +2 reserved, got +${diff}`);
  }
  if (reservationRows.rows.length !== 1) {
    throw new Error(`Expected exactly 1 reservation row, got ${reservationRows.rows.length}`);
  }
  console.log('✓ Test 1 Passed: 10 concurrent duplicates processed exactly once without race conditions.\n');

  // --- Test 2: Sequential Duplicate Replay ---
  console.log('2. Testing Sequential Duplicate Replay (replaying identical event 5 times)...');
  const notifOrderId = `order-notif-dedupe-${Date.now()}`;
  const confirmedEnvelope = createEventEnvelope<OrderConfirmedPayload>({
    eventType: 'OrderConfirmed',
    aggregateId: notifOrderId,
    payload: {
      orderId: notifOrderId,
      customerId: 'cust-idempotent-02',
      totalPrice: 199.99,
      confirmedAt: new Date().toISOString(),
    },
  });

  // Call handleOrderConfirmed 5 times sequentially
  for (let i = 1; i <= 5; i++) {
    await notificationService.handleOrderConfirmed(confirmedEnvelope);
  }

  const notifRows = await notificationsPool.query(
    'SELECT * FROM notifications WHERE order_id = $1',
    [notifOrderId]
  );

  console.log(`Notifications stored for ${notifOrderId}: ${notifRows.rows.length}`);
  if (notifRows.rows.length !== 1) {
    throw new Error(`Expected exactly 1 notification stored, found ${notifRows.rows.length}`);
  }
  console.log('✓ Test 2 Passed: 5 sequential replays safely deduplicated, exactly 1 notification persisted.\n');

  // --- Test 3: Transactional Rollback Guarantee on Error ---
  console.log('3. Testing Transactional Rollback Guarantee (ensuring failed events are not permanently marked as processed)...');
  const failingEventId = `fail-event-${Date.now()}`;
  const consumerGroup = 'test-rollback-group';

  let caughtError = false;
  try {
    await executeIdempotentTransaction(
      inventoryPool,
      failingEventId,
      consumerGroup,
      async (client) => {
        // Deliberately trigger an error after inserting into processed_events
        throw new Error('Simulated database/business exception during transaction');
      }
    );
  } catch (err: any) {
    caughtError = true;
    console.log(`Caught expected transaction error: ${err.message}`);
  }

  if (!caughtError) {
    throw new Error('Expected transaction to fail but it succeeded');
  }

  // Verify that processed_events does NOT contain failingEventId (was rolled back)
  const dedupeCheck = await inventoryPool.query(
    'SELECT * FROM processed_events WHERE event_id = $1 AND consumer_group = $2',
    [failingEventId, consumerGroup]
  );

  if (dedupeCheck.rows.length > 0) {
    throw new Error('Rollback failure! processed_events entry was committed despite transaction failure!');
  }
  console.log('✓ Test 3 Passed: Transaction rollback verified — failed operations are not falsely recorded as processed, enabling safe retries.');

  // Cleanup
  await inventoryPool.query('UPDATE products SET reserved_quantity = reserved_quantity - 2 WHERE id = $1', [productId]);
  await inventoryPool.query('DELETE FROM reservations WHERE order_id = $1', [orderId]);
  await inventoryPool.query('DELETE FROM processed_events WHERE event_id = $1', [envelope.eventId]);
  await notificationsPool.query('DELETE FROM notifications WHERE order_id = $1', [notifOrderId]);
  await notificationsPool.query('DELETE FROM processed_events WHERE event_id = $1', [confirmedEnvelope.eventId]);

  await kafkaClient.disconnectAll();
  await inventoryPool.end();
  await notificationsPool.end();

  console.log('\n=== All Idempotency & Deduplication Tests Complete and Successful! ===');
  process.exit(0);
}

runIdempotencyTests().catch((err) => {
  console.error('Idempotency test failed:', err);
  process.exit(1);
});
