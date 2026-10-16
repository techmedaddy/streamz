import { randomUUID } from 'crypto';
import { ResilientKafkaClient } from '../packages/kafka-client/src/index.js';
import {
  KafkaAdminHarvester,
  PartitionLagEngine,
  TraceCollector,
  createObservabilityServer,
} from '../packages/observability-service/src/index.js';
import { OrderService } from '../packages/order-service/src/orderService.js';
import { InventoryService } from '../packages/inventory-service/src/inventoryService.js';
import { NotificationService } from '../packages/notification-worker/src/notificationService.js';
import { TOPICS, EventEnvelope } from '../packages/contracts/src/index.js';

async function runEventTracingTest() {
  console.log('=============================================================');
  console.log('APPLICATION EVENT TRACING & TELEMETRY LIFECYCLE TEST');
  console.log('=============================================================\n');

  const testId = Date.now();
  const kafkaClient = new ResilientKafkaClient({
    clientId: 'event-tracing-test',
    brokers: [process.env.KAFKA_BROKERS || 'localhost:9094'],
  });

  const harvester = new KafkaAdminHarvester(kafkaClient);
  const lagEngine = new PartitionLagEngine(kafkaClient, harvester);
  const traceCollector = new TraceCollector();
  const server = await createObservabilityServer(harvester, lagEngine, traceCollector);

  // 1. Start Telemetry Trace Consumer
  console.log('Step 1: Starting TraceCollector telemetry consumer...');
  await traceCollector.startConsumer(kafkaClient, `tracing-test-collector-${testId}`);

  // 2. Instantiate Microservice Domain Services
  const orderService = new OrderService(kafkaClient);
  const inventoryService = new InventoryService(kafkaClient);
  const notificationService = new NotificationService(kafkaClient);

  // 3. Start Test Consumers for Event Choreography
  console.log('Step 2: Initializing test consumers for event choreography...');
  const inventoryConsumer = await kafkaClient.createConsumer(`tracing-inv-group-${testId}`);
  await inventoryConsumer.subscribe({ topic: TOPICS.ORDERS, fromBeginning: false });
  await inventoryConsumer.run({
    eachMessage: async ({ message }) => {
      if (!message.value) return;
      const env = JSON.parse(message.value.toString()) as EventEnvelope<any>;
      if (env.eventType === 'OrderCreated') {
        await inventoryService.processOrderCreated(env);
      }
    },
  });

  const reconciliationConsumer = await kafkaClient.createConsumer(`tracing-recon-group-${testId}`);
  await reconciliationConsumer.subscribe({ topic: TOPICS.INVENTORY_EVENTS, fromBeginning: false });
  await reconciliationConsumer.run({
    eachMessage: async ({ message }) => {
      if (!message.value) return;
      const env = JSON.parse(message.value.toString()) as EventEnvelope<any>;
      if (env.eventType === 'InventoryReserved') {
        await orderService.handleInventoryReserved(env);
      } else if (env.eventType === 'InventoryRejected') {
        await orderService.handleInventoryRejected(env);
      }
    },
  });

  const notificationConsumer = await kafkaClient.createConsumer(`tracing-notif-group-${testId}`);
  await notificationConsumer.subscribe({ topic: TOPICS.ORDER_EVENTS, fromBeginning: false });
  await notificationConsumer.run({
    eachMessage: async ({ message }) => {
      if (!message.value) return;
      const env = JSON.parse(message.value.toString()) as EventEnvelope<any>;
      if (env.eventType === 'OrderConfirmed') {
        await notificationService.handleOrderConfirmed(env);
      } else if (env.eventType === 'OrderRejected') {
        await notificationService.handleOrderRejected(env);
      }
    },
  });

  // Give consumer groups time to join and assign partitions
  await new Promise((r) => setTimeout(r, 4000));

  try {
    // 4. Place Order with unique Correlation ID
    const correlationId = `trace-order-${testId}`;
    const targetProductId = 'prod-mouse-wireless';
    console.log(`Step 3: Placing order with correlationId: ${correlationId}...`);

    const order = await orderService.createOrder({
      customerId: 'cust-observability-tester',
      productId: targetProductId,
      quantity: 1,
      unitPrice: 149.99,
      correlationId,
    });
    console.log(`  Order created: ${order.id} (Status: ${order.status})`);

    // 5. Await distributed event propagation across all 3 services
    console.log('\nStep 4: Waiting for end-to-end event choreography and trace collection...');
    const deadline = Date.now() + 15000;
    let trace = traceCollector.getTrace(correlationId);

    while (Date.now() < deadline) {
      trace = traceCollector.getTrace(correlationId);
      if (trace && trace.status === 'COMPLETED' && trace.spans.length >= 4) {
        break;
      }
      await new Promise((r) => setTimeout(r, 500));
    }

    if (!trace) {
      throw new Error(`Trace not found for correlationId: ${correlationId}`);
    }

    console.log(`\n✓ Trace captured successfully!`);
    console.log(`  Correlation ID: ${trace.correlationId}`);
    console.log(`  Aggregate ID: ${trace.aggregateId}`);
    console.log(`  Status: ${trace.status}`);
    console.log(`  Total Duration: ${trace.totalDurationMs} ms`);
    console.log(`  Services Involved: ${trace.servicesInvolved.join(', ')}`);
    console.log(`  Total Spans: ${trace.totalSpans}`);

    console.table(
      trace.spans.map((s, idx) => ({
        Span: idx + 1,
        Service: s.service,
        Event: s.eventType,
        Stage: s.stage,
        DurationMs: s.durationMs ?? '-',
        Timestamp: s.timestamp.slice(11, 23),
      }))
    );

    if (trace.status !== 'COMPLETED') {
      throw new Error(`Expected trace status COMPLETED, got ${trace.status}`);
    }
    if (!trace.servicesInvolved.includes('order-service')) {
      throw new Error('order-service missing from trace services');
    }
    if (!trace.servicesInvolved.includes('inventory-service')) {
      throw new Error('inventory-service missing from trace services');
    }
    if (!trace.servicesInvolved.includes('notification-worker')) {
      throw new Error('notification-worker missing from trace services');
    }

    // 6. Test REST API Endpoints via Fastify Server
    console.log('\nStep 5: Testing Trace REST API Endpoints...');

    // GET /api/traces
    const tracesListRes = await server.inject({ method: 'GET', url: '/api/traces' });
    if (tracesListRes.statusCode !== 200) {
      throw new Error(`GET /api/traces failed with status ${tracesListRes.statusCode}`);
    }
    const tracesList = JSON.parse(tracesListRes.payload);
    const targetInList = tracesList.traces.find((t: any) => t.correlationId === correlationId);
    if (!targetInList) {
      throw new Error('Target trace not present in GET /api/traces');
    }
    console.log(`  GET /api/traces -> 200 OK (${tracesList.total} traces recorded)`);

    // GET /api/traces/:correlationId
    const singleTraceRes = await server.inject({
      method: 'GET',
      url: `/api/traces/${correlationId}`,
    });
    if (singleTraceRes.statusCode !== 200) {
      throw new Error(`GET /api/traces/:id failed with status ${singleTraceRes.statusCode}`);
    }
    const singleTracePayload = JSON.parse(singleTraceRes.payload);
    if (singleTracePayload.spans.length < 4 || singleTracePayload.status !== 'COMPLETED') {
      throw new Error('Invalid trace payload from GET /api/traces/:id');
    }
    console.log(`  GET /api/traces/${correlationId} -> 200 OK (${singleTracePayload.spans.length} spans, status: ${singleTracePayload.status})`);

    // POST /api/traces (Direct Ingest Test)
    const directSpan = {
      spanId: randomUUID(),
      traceId: `direct-test-${testId}`,
      correlationId: `direct-test-${testId}`,
      aggregateId: 'agg-direct-001',
      eventType: 'DiagnosticTestEvent',
      service: 'test-runner',
      stage: 'PROCESSED',
      timestamp: new Date().toISOString(),
      metadata: { source: 'api-inject' },
    };

    const postTraceRes = await server.inject({
      method: 'POST',
      url: '/api/traces',
      payload: directSpan,
    });
    if (postTraceRes.statusCode !== 201) {
      throw new Error(`POST /api/traces failed with status ${postTraceRes.statusCode}`);
    }
    console.log('  POST /api/traces -> 201 Created (direct span ingested)');

    console.log('\n✓ All REST trace endpoints validated successfully!\n');

    // Clean up
    await traceCollector.stopConsumer();
    await inventoryConsumer.disconnect();
    await reconciliationConsumer.disconnect();
    await notificationConsumer.disconnect();
    await server.close();
    await kafkaClient.disconnectAll();

    console.log('=== Application Event Tracing Verified Successfully! ===\n');
    process.exit(0);
  } catch (err) {
    console.error('Test failed with error:', err);
    await traceCollector.stopConsumer();
    await inventoryConsumer.disconnect();
    await reconciliationConsumer.disconnect();
    await notificationConsumer.disconnect();
    await server.close();
    await kafkaClient.disconnectAll();
    process.exit(1);
  }
}

runEventTracingTest();
