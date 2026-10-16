import Fastify, { FastifyInstance } from 'fastify';
import { ResilientKafkaClient } from '@streamz/kafka-client';
import { KafkaAdminHarvester } from './adminHarvester.js';
import { PartitionLagEngine } from './lagEngine.js';
import { TraceCollector, TraceQueryOptions } from './traceCollector.js';

export function createObservabilityServer(
  harvester: KafkaAdminHarvester,
  lagEngine?: PartitionLagEngine,
  traceCollector?: TraceCollector
): FastifyInstance {
  const engine = lagEngine || new PartitionLagEngine(harvester.kafkaClient, harvester);
  const collector = traceCollector || new TraceCollector();
  const fastify = Fastify({ logger: false });

  // CORS headers
  fastify.addHook('onRequest', async (_request, reply) => {
    reply.header('Access-Control-Allow-Origin', '*');
    reply.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    reply.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  });

  fastify.options('/*', async (_request, reply) => {
    return reply.status(200).send();
  });

  // Healthcheck
  fastify.get('/health', async () => {
    return { status: 'ok', service: 'observability-service' };
  });

  // Kafka Cluster Overview
  fastify.get('/api/kafka/cluster', async (_request, reply) => {
    try {
      const cluster = await harvester.getClusterOverview();
      return reply.send(cluster);
    } catch (err) {
      return reply.status(500).send({
        error: 'Failed to harvest cluster overview',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  });

  // Kafka Topics
  fastify.get('/api/kafka/topics', async (_request, reply) => {
    try {
      const cluster = await harvester.getClusterOverview();
      return reply.send(cluster.topics);
    } catch (err) {
      return reply.status(500).send({
        error: 'Failed to harvest topics',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  });

  // Single Topic Details
  fastify.get('/api/kafka/topics/:topic', async (request, reply) => {
    const { topic } = request.params as { topic: string };
    try {
      const topicDetails = await harvester.getTopicDetails(topic);
      if (!topicDetails) {
        return reply.status(404).send({ error: `Topic '${topic}' not found` });
      }
      return reply.send(topicDetails);
    } catch (err) {
      return reply.status(500).send({
        error: `Failed to fetch topic details for '${topic}'`,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  });

  // Consumer Groups Overview
  fastify.get('/api/kafka/groups', async (_request, reply) => {
    try {
      const groups = await harvester.getConsumerGroupsOverview();
      return reply.send(groups);
    } catch (err) {
      return reply.status(500).send({
        error: 'Failed to harvest consumer groups',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  });

  // Single Consumer Group
  fastify.get('/api/kafka/groups/:groupId', async (request, reply) => {
    const { groupId } = request.params as { groupId: string };
    try {
      const groups = await harvester.getConsumerGroupsOverview();
      const group = groups.find((g) => g.groupId === groupId);
      if (!group) {
        return reply.status(404).send({ error: `Consumer group '${groupId}' not found` });
      }
      return reply.send(group);
    } catch (err) {
      return reply.status(500).send({
        error: `Failed to fetch group '${groupId}'`,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  });

  // All Consumer Groups Lag
  fastify.get('/api/kafka/lag', async (_request, reply) => {
    try {
      const lagSummaries = await engine.getAllConsumerGroupsLag();
      return reply.send(lagSummaries);
    } catch (err) {
      return reply.status(500).send({
        error: 'Failed to compute consumer groups lag',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  });

  // Single Consumer Group Lag
  fastify.get('/api/kafka/lag/:groupId', async (request, reply) => {
    const { groupId } = request.params as { groupId: string };
    try {
      const lagSummary = await engine.getConsumerGroupLag(groupId);
      if (!lagSummary) {
        return reply.status(404).send({ error: `Consumer group '${groupId}' not found or inaccessible` });
      }
      return reply.send(lagSummary);
    } catch (err) {
      return reply.status(500).send({
        error: `Failed to compute lag for consumer group '${groupId}'`,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  });

  // List Traces
  fastify.get('/api/traces', async (request, reply) => {
    const query = request.query as {
      limit?: string;
      offset?: string;
      service?: string;
      status?: 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
      search?: string;
    };

    const options: TraceQueryOptions = {
      limit: query.limit ? Number(query.limit) : undefined,
      offset: query.offset ? Number(query.offset) : undefined,
      service: query.service,
      status: query.status,
      search: query.search,
    };

    return reply.send(collector.getTraces(options));
  });

  // Single Trace by Correlation ID
  fastify.get('/api/traces/:correlationId', async (request, reply) => {
    const { correlationId } = request.params as { correlationId: string };
    const trace = collector.getTrace(correlationId);
    if (!trace) {
      return reply.status(404).send({ error: `Trace '${correlationId}' not found` });
    }
    return reply.send(trace);
  });

  // Direct Ingest Trace Span
  fastify.post('/api/traces', async (request, reply) => {
    try {
      const span = collector.recordSpan(request.body);
      return reply.status(201).send(span);
    } catch (err) {
      return reply.status(400).send({
        error: 'Invalid trace span payload',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  });

  return fastify;
}

export * from './adminHarvester.js';
export * from './lagEngine.js';
export * from './traceCollector.js';

const PORT = Number(process.env.PORT) || 3004;

async function start() {
  const kafkaClient = new ResilientKafkaClient({
    clientId: 'observability-service',
    brokers: [process.env.KAFKA_BROKERS || 'localhost:9094'],
  });

  const harvester = new KafkaAdminHarvester(kafkaClient);
  const lagEngine = new PartitionLagEngine(kafkaClient, harvester);
  const traceCollector = new TraceCollector();

  // Start background Kafka telemetry consumer
  try {
    await traceCollector.startConsumer(kafkaClient);
    console.log('[ObservabilityService] Telemetry trace consumer started');
  } catch (err) {
    console.warn('[ObservabilityService] Telemetry consumer initialization note:', err);
  }

  const server = createObservabilityServer(harvester, lagEngine, traceCollector);

  try {
    await server.listen({ port: PORT, host: '0.0.0.0' });
    console.log(`[ObservabilityService] API running on port ${PORT}`);
  } catch (err) {
    console.error('[ObservabilityService] Failed to start:', err);
    process.exit(1);
  }
}

// Auto-start if executed directly
if (process.argv[1] && process.argv[1].endsWith('index.ts')) {
  start();
}
