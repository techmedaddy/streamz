import Fastify from 'fastify';
import { ResilientKafkaClient } from '@streamz/kafka-client';
import { NotificationService } from './notificationService.js';
import { startNotificationWorkerConsumer } from './consumer.js';
import { pool } from './db.js';

const fastify = Fastify({ logger: true });

const kafkaClient = new ResilientKafkaClient({
  clientId: 'notification-worker',
  brokers: [process.env.KAFKA_BROKERS || 'localhost:9094'],
});

const notificationService = new NotificationService();

// Healthcheck
fastify.get('/health', async () => {
  return { status: 'ok', service: 'notification-worker' };
});

// List notifications
fastify.get('/notifications', async () => {
  return await notificationService.listNotifications();
});

// Get notifications for order
fastify.get('/notifications/order/:orderId', async (request) => {
  const { orderId } = request.params as { orderId: string };
  return await notificationService.getNotificationsForOrder(orderId);
});

const PORT = Number(process.env.PORT) || 3003;

async function start() {
  try {
    // Check DB connection
    await pool.query('SELECT 1');
    console.log('[NotificationWorker] Connected to PostgreSQL notifications_db');

    // Start background consumer
    await startNotificationWorkerConsumer(kafkaClient, notificationService);

    await fastify.listen({ port: PORT, host: '0.0.0.0' });
    console.log(`[NotificationWorker] HTTP server running on port ${PORT}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

start();
