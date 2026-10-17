import Fastify from 'fastify';
import { ResilientKafkaClient } from '@streamz/kafka-client';
import { OrderService } from './orderService.js';
import { startOrderServiceConsumer } from './consumer.js';
import { pool } from './db.js';

const fastify = Fastify({ logger: true });

fastify.addHook('onRequest', async (request, reply) => {
  reply.header('Access-Control-Allow-Origin', '*');
  reply.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  reply.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (request.method === 'OPTIONS') {
    return reply.status(200).send();
  }
});

const kafkaClient = new ResilientKafkaClient({
  clientId: 'order-service',
  brokers: [process.env.KAFKA_BROKERS || 'localhost:9094'],
});

const orderService = new OrderService(kafkaClient);

// Healthcheck
fastify.get('/health', async () => {
  return { status: 'ok', service: 'order-service' };
});

// List orders
fastify.get('/orders', async () => {
  return await orderService.listOrders();
});

// Get order by ID
fastify.get('/orders/:id', async (request, reply) => {
  const { id } = request.params as { id: string };
  const order = await orderService.getOrder(id);
  if (!order) {
    return reply.status(404).send({ error: 'Order not found' });
  }
  return order;
});

// Create new order
fastify.post('/orders', async (request, reply) => {
  const body = request.body as {
    customerId: string;
    productId: string;
    quantity: number;
    unitPrice?: number;
    correlationId?: string;
  };

  if (!body.customerId || !body.productId || !body.quantity || body.quantity <= 0) {
    return reply.status(400).send({
      error: 'Invalid order input. Required: customerId, productId, quantity (> 0)',
    });
  }

  const unitPrice = body.unitPrice ?? 99.99;

  const order = await orderService.createOrder({
    customerId: body.customerId,
    productId: body.productId,
    quantity: body.quantity,
    unitPrice,
    correlationId: body.correlationId,
  });

  return reply.status(202).send(order);
});

const PORT = Number(process.env.PORT) || 3001;

async function start() {
  try {
    // Test DB connection
    await pool.query('SELECT 1');
    console.log('[OrderService] Connected to PostgreSQL orders_db');

    // Start background consumer
    await startOrderServiceConsumer(kafkaClient, orderService);

    await fastify.listen({ port: PORT, host: '0.0.0.0' });
    console.log(`[OrderService] HTTP server running on port ${PORT}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

start();
