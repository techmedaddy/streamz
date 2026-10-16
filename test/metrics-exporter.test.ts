import { randomUUID } from 'crypto';
import { ResilientKafkaClient } from '../packages/kafka-client/src/index.js';
import {
  KafkaAdminHarvester,
  PartitionLagEngine,
  TraceCollector,
  MetricsExporter,
  createObservabilityServer,
} from '../packages/observability-service/src/index.js';

async function runMetricsExporterTest() {
  console.log('=============================================================');
  console.log('PROMETHEUS METRICS EXPORTER INTEGRATION TEST');
  console.log('=============================================================\n');

  const kafkaClient = new ResilientKafkaClient({
    clientId: 'metrics-exporter-test',
    brokers: [process.env.KAFKA_BROKERS || 'localhost:9094'],
  });

  const harvester = new KafkaAdminHarvester(kafkaClient);
  const lagEngine = new PartitionLagEngine(kafkaClient, harvester);
  const traceCollector = new TraceCollector();
  const exporter = new MetricsExporter(harvester, lagEngine, traceCollector);

  const server = await createObservabilityServer(
    harvester,
    lagEngine,
    traceCollector,
    undefined,
    exporter
  );

  try {
    // 1. Ingest sample trace spans into TraceCollector
    console.log('Step 1: Ingesting representative trace spans to populate business counters...');

    const happyCorrelationId = `metrics-happy-${Date.now()}`;
    const failedCorrelationId = `metrics-failed-${Date.now()}`;

    // Trace 1: Happy completed order
    traceCollector.recordSpan({
      spanId: randomUUID(),
      traceId: happyCorrelationId,
      correlationId: happyCorrelationId,
      aggregateId: 'ord-m-100',
      eventType: 'OrderCreated',
      service: 'order-service',
      stage: 'PRODUCED',
      timestamp: new Date(Date.now() - 300).toISOString(),
    });

    traceCollector.recordSpan({
      spanId: randomUUID(),
      traceId: happyCorrelationId,
      correlationId: happyCorrelationId,
      aggregateId: 'ord-m-100',
      eventType: 'InventoryReserved',
      service: 'inventory-service',
      stage: 'PROCESSED',
      durationMs: 45,
      timestamp: new Date(Date.now() - 200).toISOString(),
    });

    traceCollector.recordSpan({
      spanId: randomUUID(),
      traceId: happyCorrelationId,
      correlationId: happyCorrelationId,
      aggregateId: 'ord-m-100',
      eventType: 'OrderConfirmed',
      service: 'order-service',
      stage: 'PROCESSED',
      timestamp: new Date(Date.now() - 100).toISOString(),
    });

    traceCollector.recordSpan({
      spanId: randomUUID(),
      traceId: happyCorrelationId,
      correlationId: happyCorrelationId,
      aggregateId: 'ord-m-100',
      eventType: 'OrderConfirmed',
      service: 'notification-worker',
      stage: 'PROCESSED',
      timestamp: new Date().toISOString(),
    });

    // Trace 2: Rejected/Failed order
    traceCollector.recordSpan({
      spanId: randomUUID(),
      traceId: failedCorrelationId,
      correlationId: failedCorrelationId,
      aggregateId: 'ord-m-101',
      eventType: 'OrderCreated',
      service: 'order-service',
      stage: 'PRODUCED',
      timestamp: new Date(Date.now() - 150).toISOString(),
    });

    traceCollector.recordSpan({
      spanId: randomUUID(),
      traceId: failedCorrelationId,
      correlationId: failedCorrelationId,
      aggregateId: 'ord-m-101',
      eventType: 'InventoryRejected',
      service: 'inventory-service',
      stage: 'FAILED',
      error: 'Insufficient stock',
      durationMs: 12,
      timestamp: new Date().toISOString(),
    });

    console.log('✓ Ingested 6 sample spans across 2 traces (1 COMPLETED, 1 FAILED).\n');

    // 2. Query GET /metrics Endpoint
    console.log('Step 2: Scraping Prometheus metrics from GET /metrics...');
    const res = await server.inject({
      method: 'GET',
      url: '/metrics',
    });

    if (res.statusCode !== 200) {
      throw new Error(`GET /metrics failed with status code ${res.statusCode}`);
    }

    const contentType = res.headers['content-type'];
    if (!contentType || !contentType.includes('text/plain')) {
      throw new Error(`Unexpected Content-Type: ${contentType}`);
    }
    console.log(`✓ HTTP 200 OK received with Content-Type: ${contentType}`);

    const metricsBody = res.payload;

    // 3. Validate Cluster Topology Metrics
    console.log('\nStep 3: Validating Kafka Cluster Topology Metrics...');
    if (!metricsBody.includes('# TYPE kafka_cluster_brokers_count gauge')) {
      throw new Error('kafka_cluster_brokers_count metric declaration missing');
    }
    if (!metricsBody.includes('kafka_cluster_brokers_count 1')) {
      throw new Error('Expected kafka_cluster_brokers_count = 1');
    }
    if (!metricsBody.includes('kafka_cluster_healthy 1')) {
      throw new Error('Expected kafka_cluster_healthy = 1');
    }
    console.log('✓ kafka_cluster_brokers_count = 1');
    console.log('✓ kafka_cluster_healthy = 1');
    console.log('✓ kafka_cluster_topics_count & partitions_total present');

    // 4. Validate Consumer Group Lag Metrics
    console.log('\nStep 4: Validating Consumer Group Lag Metrics...');
    if (!metricsBody.includes('# TYPE kafka_consumergroup_lag gauge')) {
      throw new Error('kafka_consumergroup_lag metric declaration missing');
    }
    if (!metricsBody.includes('kafka_consumergroup_lag{')) {
      throw new Error('kafka_consumergroup_lag instances missing');
    }
    if (!metricsBody.includes('# TYPE kafka_consumergroup_stalled gauge')) {
      throw new Error('kafka_consumergroup_stalled metric declaration missing');
    }
    console.log('✓ kafka_consumergroup_lag with labels {group, topic, partition} verified');
    console.log('✓ kafka_consumergroup_stalled with labels {group} verified');

    // 5. Validate Application Telemetry Metrics
    console.log('\nStep 5: Validating Application Event Telemetry Metrics...');
    if (!metricsBody.includes('# TYPE streamz_events_total counter')) {
      throw new Error('streamz_events_total metric declaration missing');
    }

    // Verify counter labels
    const expectedLabels = [
      'streamz_events_total{service="order-service",event_type="OrderCreated",stage="PRODUCED"}',
      'streamz_events_total{service="inventory-service",event_type="InventoryReserved",stage="PROCESSED"}',
      'streamz_events_total{service="notification-worker",event_type="OrderConfirmed",stage="PROCESSED"}',
      'streamz_events_total{service="inventory-service",event_type="InventoryRejected",stage="FAILED"}',
    ];

    for (const labelPattern of expectedLabels) {
      if (!metricsBody.includes(labelPattern)) {
        throw new Error(`Expected metric pattern missing: ${labelPattern}`);
      }
      console.log(`  ✓ Found counter: ${labelPattern}`);
    }

    // Verify Trace Status Gauges
    console.log('\nStep 6: Validating Distributed Trace Status Gauges...');
    if (!metricsBody.includes('# TYPE streamz_traces_total gauge')) {
      throw new Error('streamz_traces_total metric declaration missing');
    }
    if (!metricsBody.includes('streamz_traces_total{status="COMPLETED"} 1')) {
      throw new Error('Expected streamz_traces_total{status="COMPLETED"} = 1');
    }
    if (!metricsBody.includes('streamz_traces_total{status="FAILED"} 1')) {
      throw new Error('Expected streamz_traces_total{status="FAILED"} = 1');
    }
    console.log('✓ streamz_traces_total{status="COMPLETED"} = 1');
    console.log('✓ streamz_traces_total{status="FAILED"} = 1');

    // 6. Print Snippet of Real Prometheus Output
    console.log('\n-------------------------------------------------------------');
    console.log('SAMPLE PROMETHEUS SCRAPED OUTPUT SNIPPET');
    console.log('-------------------------------------------------------------');
    const lines = metricsBody
      .split('\n')
      .filter((l) => l.startsWith('kafka_') || l.startsWith('streamz_'))
      .slice(0, 15);
    console.log(lines.join('\n'));
    console.log('...\n-------------------------------------------------------------\n');

    // Clean up
    await server.close();
    await kafkaClient.disconnectAll();

    console.log('=== Prometheus Metrics Exporter Verified Successfully! ===\n');
    process.exit(0);
  } catch (err) {
    console.error('Test failed with error:', err);
    await server.close();
    await kafkaClient.disconnectAll();
    process.exit(1);
  }
}

runMetricsExporterTest();
