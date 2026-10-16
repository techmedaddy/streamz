import { pool } from '../src/db.js';
import { ResilientKafkaClient } from '@streamz/kafka-client';
import { InventoryService } from '../src/inventoryService.js';
import {
  TOPICS,
  createEventEnvelope,
  OrderCreatedPayload,
  InventoryReservedPayload,
  InventoryRejectedPayload,
} from '@streamz/contracts';

async function verifySubphase2_3() {
  console.log('--- Verifying Sub-phase 2.3: Inventory Service (Reservation & Concurrency Guard) ---');

  const kafkaClient = new ResilientKafkaClient({
    clientId: 'verify-subphase-2-3',
    brokers: [process.env.KAFKA_BROKERS || 'localhost:9094'],
  });

  const inventoryService = new InventoryService(kafkaClient);
  const productId = 'prod-monitor-4k'; // Initial stock is 5

  // 1. Setup consumer to intercept events on inventory-events topic
  const consumer = await kafkaClient.createConsumer(`verify-inv-${Date.now()}`);
  await consumer.subscribe({ topic: TOPICS.INVENTORY_EVENTS, fromBeginning: true });

  const capturedEvents: any[] = [];
  consumer.run({
    eachMessage: async ({ message }) => {
      if (!message.value) return;
      capturedEvents.push(JSON.parse(message.value.toString()));
    },
  });

  // Wait briefly for consumer to establish partition assignment
  await new Promise((r) => setTimeout(r, 2000));

  // 2. Scenario 1: Successful Stock Reservation (request 2 units of 5)
  console.log('\n[Scenario 1] Testing Successful Reservation (2 units)...');
  const orderId1 = `ord-test-success-${Date.now()}`;
  const envelope1 = createEventEnvelope<OrderCreatedPayload>({
    eventType: 'OrderCreated',
    aggregateId: orderId1,
    correlationId: 'corr-subphase-2-3-a',
    payload: {
      orderId: orderId1,
      customerId: 'cust-verify-2-3',
      productId,
      quantity: 2,
      totalPrice: 999.98,
    },
  });

  await inventoryService.processOrderCreated(envelope1);

  // Verify DB state
  const productAfter1 = await inventoryService.getProduct(productId);
  console.log(`Product stock: ${productAfter1.stock_quantity}, reserved: ${productAfter1.reserved_quantity}`);
  if (Number(productAfter1.reserved_quantity) !== 2) {
    throw new Error(`Expected reserved_quantity to be 2, got ${productAfter1.reserved_quantity}`);
  }
  console.log('✓ Database verified: reserved_quantity updated to 2.');

  // 3. Scenario 2: Overselling Prevention & Rejection (request 10 units, available is 3)
  console.log('\n[Scenario 2] Testing Concurrency Guard / Insufficient Stock Rejection (request 10 units)...');
  const orderId2 = `ord-test-reject-${Date.now()}`;
  const envelope2 = createEventEnvelope<OrderCreatedPayload>({
    eventType: 'OrderCreated',
    aggregateId: orderId2,
    correlationId: 'corr-subphase-2-3-b',
    payload: {
      orderId: orderId2,
      customerId: 'cust-verify-2-3',
      productId,
      quantity: 10,
      totalPrice: 4999.90,
    },
  });

  await inventoryService.processOrderCreated(envelope2);

  const productAfter2 = await inventoryService.getProduct(productId);
  if (Number(productAfter2.reserved_quantity) !== 2) {
    throw new Error(`Overselling guard failed! Reserved quantity changed to ${productAfter2.reserved_quantity}`);
  }
  console.log('✓ Database verified: Overselling prevented! Reserved quantity safely held at 2.');

  // 4. Scenario 3: Idempotency Check (re-send envelope1)
  console.log('\n[Scenario 3] Testing Idempotency Guard (replaying duplicate event)...');
  await inventoryService.processOrderCreated(envelope1);

  const productAfter3 = await inventoryService.getProduct(productId);
  if (Number(productAfter3.reserved_quantity) !== 2) {
    throw new Error(`Idempotency check failed! Duplicate event caused reserved_quantity to change`);
  }
  console.log('✓ Idempotency verified: Duplicate event safely ignored via processed_events table.');

  // 5. Verify Kafka events on inventory-events topic
  console.log('\nVerifying Kafka events published to "inventory-events"...');
  // Wait up to 5 seconds for both events to arrive
  const startWait = Date.now();
  while (capturedEvents.length < 2 && Date.now() - startWait < 5000) {
    await new Promise((r) => setTimeout(r, 200));
  }

  const reservedEvent = capturedEvents.find((e) => e.aggregateId === orderId1);
  const rejectedEvent = capturedEvents.find((e) => e.aggregateId === orderId2);

  if (!reservedEvent || reservedEvent.eventType !== 'InventoryReserved') {
    throw new Error('Expected InventoryReserved event not found on Kafka!');
  }
  console.log('✓ Received InventoryReserved event on Kafka:', {
    eventType: reservedEvent.eventType,
    orderId: reservedEvent.payload.orderId,
    reservationId: reservedEvent.payload.reservationId,
    quantity: reservedEvent.payload.quantity,
  });

  if (!rejectedEvent || rejectedEvent.eventType !== 'InventoryRejected') {
    throw new Error('Expected InventoryRejected event not found on Kafka!');
  }
  console.log('✓ Received InventoryRejected event on Kafka:', {
    eventType: rejectedEvent.eventType,
    orderId: rejectedEvent.payload.orderId,
    reason: rejectedEvent.payload.reason,
    availableQuantity: rejectedEvent.payload.availableQuantity,
  });

  // Cleanup test reservations to reset stock
  await pool.query('UPDATE products SET reserved_quantity = 0 WHERE id = $1', [productId]);
  await pool.query('DELETE FROM reservations WHERE order_id IN ($1, $2)', [orderId1, orderId2]);
  await pool.query('DELETE FROM processed_events WHERE event_id IN ($1, $2)', [envelope1.eventId, envelope2.eventId]);

  await consumer.disconnect();
  await kafkaClient.disconnectAll();
  await pool.end();

  console.log('\n--- Sub-phase 2.3 Verification Complete and 100% Successful! ---');
  process.exit(0);
}

verifySubphase2_3().catch((err) => {
  console.error('Verification failed:', err);
  process.exit(1);
});
