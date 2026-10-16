import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { ResilientKafkaClient } from '@streamz/kafka-client';
import { OrderService } from '../packages/order-service/src/orderService.js';
import { startOrderServiceConsumer } from '../packages/order-service/src/consumer.js';
import { pool as ordersPool } from '../packages/order-service/src/db.js';

import { InventoryService } from '../packages/inventory-service/src/inventoryService.js';
import { startInventoryServiceConsumer } from '../packages/inventory-service/src/consumer.js';
import { pool as inventoryPool } from '../packages/inventory-service/src/db.js';

import { NotificationService } from '../packages/notification-worker/src/notificationService.js';
import { startNotificationWorkerConsumer } from '../packages/notification-worker/src/consumer.js';
import { pool as notificationsPool } from '../packages/notification-worker/src/db.js';

describe('Phase 2.6: End-to-End Baseline Integration Choreography', () => {
  let kafkaClient: ResilientKafkaClient;
  let orderService: OrderService;
  let inventoryService: InventoryService;
  let notificationService: NotificationService;

  let orderConsumer: any;
  let inventoryConsumer: any;
  let notificationConsumer: any;

  beforeAll(async () => {
    kafkaClient = new ResilientKafkaClient({
      clientId: 'e2e-test-suite',
      brokers: [process.env.KAFKA_BROKERS || 'localhost:9094'],
    });

    orderService = new OrderService(kafkaClient);
    inventoryService = new InventoryService(kafkaClient);
    notificationService = new NotificationService();

    // Start all 3 consumers
    console.log('[E2E Setup] Starting all 3 microservice consumers...');
    inventoryConsumer = await startInventoryServiceConsumer(kafkaClient, inventoryService);
    orderConsumer = await startOrderServiceConsumer(kafkaClient, orderService);
    notificationConsumer = await startNotificationWorkerConsumer(kafkaClient, notificationService);

    // Wait for consumer groups to coordinate and rebalance
    console.log('[E2E Setup] Waiting for consumer groups to stabilize...');
    await new Promise((r) => setTimeout(r, 5000));
  }, 20000);

  afterAll(async () => {
    console.log('[E2E Teardown] Stopping consumers and closing connections...');
    if (inventoryConsumer) await inventoryConsumer.disconnect();
    if (orderConsumer) await orderConsumer.disconnect();
    if (notificationConsumer) await notificationConsumer.disconnect();

    await kafkaClient.disconnectAll();
    await ordersPool.end();
    await inventoryPool.end();
    await notificationsPool.end();
  }, 15000);

  it('Scenario 1: Happy Path — Successful order placement, stock reservation, confirmation, and notification', async () => {
    const productId = 'prod-mouse-wireless'; // Seeded with stock_quantity = 25

    // Get starting stock
    const initialProduct = await inventoryService.getProduct(productId);
    const startReserved = Number(initialProduct.reserved_quantity);

    // Step 1: Create Order via OrderService
    const quantity = 3;
    const order = await orderService.createOrder({
      customerId: 'customer-e2e-happy',
      productId,
      quantity,
      unitPrice: 49.99,
      correlationId: 'corr-e2e-happy-01',
    });

    expect(order.id).toBeDefined();
    expect(order.status).toBe('PENDING');

    // Step 2: Poll orders_db until status is CONFIRMED (reconciled by InventoryService & OrderService)
    let confirmedOrder: any = null;
    for (let i = 0; i < 30; i++) {
      const o = await orderService.getOrder(order.id);
      if (o && o.status === 'CONFIRMED') {
        confirmedOrder = o;
        break;
      }
      await new Promise((r) => setTimeout(r, 400));
    }

    expect(confirmedOrder).not.toBeNull();
    expect(confirmedOrder.status).toBe('CONFIRMED');

    // Step 3: Verify inventory_db state (stock reserved)
    const productAfter = await inventoryService.getProduct(productId);
    expect(Number(productAfter.reserved_quantity)).toBe(startReserved + quantity);

    const reservations = await inventoryPool.query(
      'SELECT * FROM reservations WHERE order_id = $1',
      [order.id]
    );
    expect(reservations.rows.length).toBe(1);
    expect(reservations.rows[0].status).toBe('RESERVED');
    expect(reservations.rows[0].quantity).toBe(quantity);

    // Step 4: Verify notifications_db state (Notification Worker consumed OrderConfirmed)
    let notification: any = null;
    for (let i = 0; i < 30; i++) {
      const notifs = await notificationService.getNotificationsForOrder(order.id);
      if (notifs.length > 0) {
        notification = notifs[0];
        break;
      }
      await new Promise((r) => setTimeout(r, 400));
    }

    expect(notification).not.toBeNull();
    expect(notification.type).toBe('ORDER_CONFIRMED');
    expect(notification.recipient).toBe('customer-e2e-happy');
    expect(notification.status).toBe('SENT');
  }, 25000);

  it('Scenario 2: Out-of-Stock Path — Insufficient inventory triggers rejection and notification without overselling', async () => {
    const productId = 'prod-limited-edition-gpu'; // Seeded with stock_quantity = 2

    const initialProduct = await inventoryService.getProduct(productId);
    const startReserved = Number(initialProduct.reserved_quantity);

    // Step 1: Request 99 units (far exceeds stock of 2)
    const order = await orderService.createOrder({
      customerId: 'customer-e2e-reject',
      productId,
      quantity: 99,
      unitPrice: 899.99,
      correlationId: 'corr-e2e-reject-02',
    });

    expect(order.id).toBeDefined();
    expect(order.status).toBe('PENDING');

    // Step 2: Poll orders_db until status is REJECTED
    let rejectedOrder: any = null;
    for (let i = 0; i < 30; i++) {
      const o = await orderService.getOrder(order.id);
      if (o && o.status === 'REJECTED') {
        rejectedOrder = o;
        break;
      }
      await new Promise((r) => setTimeout(r, 400));
    }

    expect(rejectedOrder).not.toBeNull();
    expect(rejectedOrder.status).toBe('REJECTED');
    expect(rejectedOrder.rejection_reason).toContain('Insufficient stock');

    // Step 3: Verify inventory_db state (reserved_quantity NOT changed)
    const productAfter = await inventoryService.getProduct(productId);
    expect(Number(productAfter.reserved_quantity)).toBe(startReserved);

    // Step 4: Verify notifications_db state (Notification Worker consumed OrderRejected)
    let notification: any = null;
    for (let i = 0; i < 30; i++) {
      const notifs = await notificationService.getNotificationsForOrder(order.id);
      if (notifs.length > 0) {
        notification = notifs[0];
        break;
      }
      await new Promise((r) => setTimeout(r, 400));
    }

    expect(notification).not.toBeNull();
    expect(notification.type).toBe('ORDER_REJECTED');
    expect(notification.recipient).toBe('customer-e2e-reject');
  }, 25000);
});
