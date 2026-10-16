import Fastify from 'fastify';
import { ResilientKafkaClient } from '@streamz/kafka-client';
import { InventoryService } from './inventoryService.js';
import { startInventoryServiceConsumer } from './consumer.js';
import { pool } from './db.js';

const fastify = Fastify({ logger: true });

const kafkaClient = new ResilientKafkaClient({
  clientId: 'inventory-service',
  brokers: [process.env.KAFKA_BROKERS || 'localhost:9094'],
});

const inventoryService = new InventoryService(kafkaClient);

// Healthcheck
fastify.get('/health', async () => {
  return { status: 'ok', service: 'inventory-service' };
});

// List all products and their stock/reserved levels
fastify.get('/products', async () => {
  return await inventoryService.listProducts();
});

// Get product details by ID
fastify.get('/products/:id', async (request, reply) => {
  const { id } = request.params as { id: string };
  const product = await inventoryService.getProduct(id);
  if (!product) {
    return reply.status(404).send({ error: 'Product not found' });
  }
  return product;
});

// List recent reservations
fastify.get('/reservations', async () => {
  return await inventoryService.listReservations();
});

const PORT = Number(process.env.PORT) || 3002;

async function start() {
  try {
    // Check DB connection
    await pool.query('SELECT 1');
    console.log('[InventoryService] Connected to PostgreSQL inventory_db');

    // Start background Kafka consumer
    await startInventoryServiceConsumer(kafkaClient, inventoryService);

    await fastify.listen({ port: PORT, host: '0.0.0.0' });
    console.log(`[InventoryService] HTTP server running on port ${PORT}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

start();
