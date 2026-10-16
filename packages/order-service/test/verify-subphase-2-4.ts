import { pool } from '../src/db.js';
import { ResilientKafkaClient } from '@streamz/kafka-client';
import { OrderService } from '../src/orderService.js';
import { startOrderServiceConsumer } from '../src/consumer.js';
import {
  TOPICS,
  createEventEnvelope,
  InventoryReservedPayload,
  InventoryRejectedPayload,
} from '@streamz/contracts';

async function verifySubphase2_4() {
  console.log('--- Verifying Sub-phase 2.4: Order Status Reconciliation Consumer ---');

  const kafkaClient = new ResilientKafkaClient({
    clientId: 'verify-subphase-2-4',
    brokers: [process.env.KAFKA_BROKERS || 'localhost:9094'],
  });

  const orderService = new OrderService(kafkaClient);

  // 1. Start the order reconciliation consumer
  const orderConsumer = await startOrderServiceConsumer(kafkaClient, orderService);

  // 2. Setup a test consumer listening to `order-events` topic
  const testConsumer = await kafkaClient.createConsumer(`verify-order-events-${Date.now()}`);
  await testConsumer.subscribe({ topic: TOPICS.ORDER_EVENTS, fromBeginning: false });

  const orderEvents: any[] = [];
  testConsumer.run({
    eachMessage: async ({ message }) => {
      if (!message.value) return;
      orderEvents.push(JSON.parse(message.value.toString()));
    },
  });

  // Give consumers time to join consumer groups
  console.log('Waiting for consumer groups to stabilize...');
  await new Promise((r) => setTimeout(r, 4000));

  // --- Scenario 1: Order Confirmation Reconciliation ---
  console.log('\n[Scenario 1] Testing Order Confirmation Flow...');
  const order1 = await orderService.createOrder({
    customerId: 'cust-reconcile-01',
    productId: 'prod-keyboard-rgb',
    quantity: 1,
    unitPrice: 99.99,
  });

  console.log(`Created Order 1 (id: ${order1.id}, status: ${order1.status})`);

  // Synthesize and publish InventoryReserved event to inventory-events topic
  const reservedEnvelope = createEventEnvelope<InventoryReservedPayload>({
    eventType: 'InventoryReserved',
    aggregateId: order1.id,
    correlationId: 'corr-reconcile-01',
    payload: {
      orderId: order1.id,
      productId: 'prod-keyboard-rgb',
      quantity: 1,
      reservationId: 'res-test-rec-1',
      reservedAt: new Date().toISOString(),
    },
  });

  await kafkaClient.sendEvent(TOPICS.INVENTORY_EVENTS, reservedEnvelope);
  console.log(`Published InventoryReserved event for order: ${order1.id}`);

  // Poll database until order1 transitions to CONFIRMED
  let confirmedOrder: any = null;
  for (let i = 0; i < 20; i++) {
    const o = await orderService.getOrder(order1.id);
    if (o && o.status === 'CONFIRMED') {
      confirmedOrder = o;
      break;
    }
    await new Promise((r) => setTimeout(r, 300));
  }

  if (!confirmedOrder) {
    const current = await orderService.getOrder(order1.id);
    throw new Error(`Order 1 did not transition to CONFIRMED! Current status: ${current?.status}`);
  }
  console.log('✓ Database verified: Order status transitioned to CONFIRMED!');

  // --- Scenario 2: Order Rejection Reconciliation ---
  console.log('\n[Scenario 2] Testing Order Rejection Flow...');
  const order2 = await orderService.createOrder({
    customerId: 'cust-reconcile-02',
    productId: 'prod-limited-edition-gpu',
    quantity: 5,
    unitPrice: 899.99,
  });

  console.log(`Created Order 2 (id: ${order2.id}, status: ${order2.status})`);

  // Synthesize and publish InventoryRejected event to inventory-events topic
  const rejectReason = 'Insufficient stock: requested 5, available 2';
  const rejectedEnvelope = createEventEnvelope<InventoryRejectedPayload>({
    eventType: 'InventoryRejected',
    aggregateId: order2.id,
    correlationId: 'corr-reconcile-02',
    payload: {
      orderId: order2.id,
      productId: 'prod-limited-edition-gpu',
      requestedQuantity: 5,
      availableQuantity: 2,
      reason: rejectReason,
      rejectedAt: new Date().toISOString(),
    },
  });

  await kafkaClient.sendEvent(TOPICS.INVENTORY_EVENTS, rejectedEnvelope);
  console.log(`Published InventoryRejected event for order: ${order2.id}`);

  // Poll database until order2 transitions to REJECTED
  let rejectedOrder: any = null;
  for (let i = 0; i < 20; i++) {
    const o = await orderService.getOrder(order2.id);
    if (o && o.status === 'REJECTED') {
      rejectedOrder = o;
      break;
    }
    await new Promise((r) => setTimeout(r, 300));
  }

  if (!rejectedOrder) {
    const current = await orderService.getOrder(order2.id);
    throw new Error(`Order 2 did not transition to REJECTED! Current status: ${current?.status}`);
  }
  if (rejectedOrder.rejection_reason !== rejectReason) {
    throw new Error(`Rejection reason mismatch: expected "${rejectReason}", got "${rejectedOrder.rejection_reason}"`);
  }
  console.log('✓ Database verified: Order status transitioned to REJECTED with correct rejection reason!');

  // --- Scenario 3: Verify downstream Kafka events on order-events topic ---
  console.log('\n[Scenario 3] Verifying emitted events on "order-events" topic...');
  for (let i = 0; i < 20 && orderEvents.length < 2; i++) {
    await new Promise((r) => setTimeout(r, 300));
  }

  const confirmedEvent = orderEvents.find((e) => e.aggregateId === order1.id);
  const rejectedEvent = orderEvents.find((e) => e.aggregateId === order2.id);

  if (!confirmedEvent || confirmedEvent.eventType !== 'OrderConfirmed') {
    throw new Error(`OrderConfirmed event not received for order ${order1.id}`);
  }
  console.log('✓ Received OrderConfirmed event on Kafka:', {
    eventType: confirmedEvent.eventType,
    orderId: confirmedEvent.payload.orderId,
    totalPrice: confirmedEvent.payload.totalPrice,
  });

  if (!rejectedEvent || rejectedEvent.eventType !== 'OrderRejected') {
    throw new Error(`OrderRejected event not received for order ${order2.id}`);
  }
  console.log('✓ Received OrderRejected event on Kafka:', {
    eventType: rejectedEvent.eventType,
    orderId: rejectedEvent.payload.orderId,
    reason: rejectedEvent.payload.reason,
  });

  // --- Scenario 4: Idempotency Protection ---
  console.log('\n[Scenario 4] Testing Idempotent Reconciliation Guard...');
  const orderEventsCountBefore = orderEvents.length;
  // Re-publish the reserved event
  await kafkaClient.sendEvent(TOPICS.INVENTORY_EVENTS, reservedEnvelope);
  await new Promise((r) => setTimeout(r, 1500));

  const order1After = await orderService.getOrder(order1.id);
  if (order1After.status !== 'CONFIRMED') {
    throw new Error(`Order 1 state mutated unexpectedly to ${order1After.status}`);
  }
  if (orderEvents.length > orderEventsCountBefore) {
    throw new Error('Duplicate OrderConfirmed event was published on replayed event!');
  }
  console.log('✓ Idempotency verified: Replayed event did not alter DB state or re-emit duplicate event.');

  // Cleanup
  await pool.query('DELETE FROM orders WHERE id IN ($1, $2)', [order1.id, order2.id]);
  await pool.query('DELETE FROM processed_events WHERE event_id IN ($1, $2)', [reservedEnvelope.eventId, rejectedEnvelope.eventId]);

  await orderConsumer.disconnect();
  await testConsumer.disconnect();
  await kafkaClient.disconnectAll();
  await pool.end();

  console.log('\n--- Sub-phase 2.4 Verification Complete and 100% Successful! ---');
  process.exit(0);
}

verifySubphase2_4().catch((err) => {
  console.error('Verification failed:', err);
  process.exit(1);
});
