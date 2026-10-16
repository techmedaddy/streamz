import { WebSocket } from 'ws';
import { randomUUID } from 'crypto';
import { ResilientKafkaClient } from '../packages/kafka-client/src/index.js';
import {
  KafkaAdminHarvester,
  PartitionLagEngine,
  TraceCollector,
  TelemetryBroadcaster,
  createObservabilityServer,
  TelemetryMessage,
} from '../packages/observability-service/src/index.js';

async function runWebSocketStreamTest() {
  console.log('=============================================================');
  console.log('WEBSOCKET LIVE TELEMETRY STREAM & EVENT PULSE TEST');
  console.log('=============================================================\n');

  const testPort = 3899;
  const kafkaClient = new ResilientKafkaClient({
    clientId: 'websocket-stream-test',
    brokers: [process.env.KAFKA_BROKERS || 'localhost:9094'],
  });

  const harvester = new KafkaAdminHarvester(kafkaClient);
  const lagEngine = new PartitionLagEngine(kafkaClient, harvester);
  const traceCollector = new TraceCollector();
  const broadcaster = new TelemetryBroadcaster(harvester, lagEngine, traceCollector);

  const server = await createObservabilityServer(harvester, lagEngine, traceCollector, broadcaster);

  try {
    // 1. Start Server on test port
    console.log(`Step 1: Starting Observability Fastify server on port ${testPort}...`);
    await server.listen({ port: testPort, host: '127.0.0.1' });
    console.log(`✓ Server listening on http://127.0.0.1:${testPort}`);

    // 2. Connect Client 1 to WebSocket endpoint
    console.log('\nStep 2: Connecting WebSocket Client 1 to ws://127.0.0.1:3899/ws/telemetry...');
    const receivedMessagesClient1: TelemetryMessage[] = [];

    const ws1 = new WebSocket(`ws://127.0.0.1:${testPort}/ws/telemetry`);

    ws1.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString()) as TelemetryMessage;
        receivedMessagesClient1.push(msg);
      } catch {}
    });

    await new Promise<void>((resolve, reject) => {
      ws1.on('open', () => {
        console.log('✓ WebSocket Client 1 connected successfully!');
        resolve();
      });
      ws1.on('error', reject);
    });

    // 3. Await Initial Welcome & Immediate Snapshot
    console.log('\nStep 3: Awaiting handshake and initial cluster snapshot...');
    const handshakeDeadline = Date.now() + 5000;
    while (receivedMessagesClient1.length < 2 && Date.now() < handshakeDeadline) {
      await new Promise((r) => setTimeout(r, 200));
    }

    const connectedMsg = receivedMessagesClient1.find((m) => m.type === 'CONNECTED');
    const initialSnapshotMsg = receivedMessagesClient1.find((m) => m.type === 'CLUSTER_SNAPSHOT');

    if (!connectedMsg) {
      throw new Error('Did not receive CONNECTED handshake frame on WebSocket');
    }
    console.log(`✓ Handshake frame received: type = ${connectedMsg.type}, clientCount = ${connectedMsg.payload.clientCount}`);

    if (!initialSnapshotMsg) {
      throw new Error('Did not receive initial CLUSTER_SNAPSHOT frame on WebSocket');
    }
    console.log(`✓ Initial cluster snapshot frame received:`);
    console.log(`    Cluster ID: ${initialSnapshotMsg.payload.cluster.clusterId}`);
    console.log(`    Brokers: ${initialSnapshotMsg.payload.cluster.brokers.length}`);
    console.log(`    Topics: ${initialSnapshotMsg.payload.cluster.topics.length}`);
    console.log(`    Lag Groups tracked: ${initialSnapshotMsg.payload.lagSummaries.length}`);

    // 4. Test Immediate Event Span Pulse
    console.log('\nStep 4: Emitting immediate event trace pulse...');
    const testCorrelationId = `ws-pulse-${Date.now()}`;
    const testSpan = {
      spanId: randomUUID(),
      traceId: testCorrelationId,
      correlationId: testCorrelationId,
      aggregateId: 'ord-pulse-100',
      eventType: 'OrderCreated',
      service: 'order-service',
      stage: 'PRODUCED' as const,
      timestamp: new Date().toISOString(),
      metadata: { priority: 'high', channel: 'websocket-test' },
    };

    traceCollector.recordSpan(testSpan);

    // Wait for EVENT_SPAN frame on WebSocket
    const spanWaitDeadline = Date.now() + 3000;
    let eventSpanMsg: TelemetryMessage | undefined;
    while (Date.now() < spanWaitDeadline) {
      eventSpanMsg = receivedMessagesClient1.find(
        (m) => m.type === 'EVENT_SPAN' && m.payload.correlationId === testCorrelationId
      );
      if (eventSpanMsg) break;
      await new Promise((r) => setTimeout(r, 100));
    }

    if (!eventSpanMsg) {
      throw new Error('Did not receive real-time EVENT_SPAN pulse on WebSocket');
    }
    console.log(`✓ Real-time event span pulse delivered immediately to WebSocket:`);
    console.log(`    Event: ${eventSpanMsg.payload.eventType} from ${eventSpanMsg.payload.service}`);
    console.log(`    Stage: ${eventSpanMsg.payload.stage} (Correlation: ${eventSpanMsg.payload.correlationId})`);

    // 5. Test Periodic Snapshot Broadcasting
    console.log('\nStep 5: Testing periodic heartbeat snapshots (500ms cadence)...');
    broadcaster.startPeriodicBroadcast(500);

    const snapshotCountBefore = receivedMessagesClient1.filter(
      (m) => m.type === 'CLUSTER_SNAPSHOT'
    ).length;

    await new Promise((r) => setTimeout(r, 1600));

    const snapshotCountAfter = receivedMessagesClient1.filter(
      (m) => m.type === 'CLUSTER_SNAPSHOT'
    ).length;

    console.log(`  Snapshots received before: ${snapshotCountBefore}, after: ${snapshotCountAfter}`);
    if (snapshotCountAfter <= snapshotCountBefore) {
      throw new Error('Periodic heartbeat did not broadcast periodic snapshots');
    }
    console.log('✓ Periodic cluster snapshot broadcasting verified!');

    // 6. Test Multi-client Concurrency & Disconnect Cleanup
    console.log('\nStep 6: Testing multi-client concurrency (Client 2 connects)...');
    const ws2 = new WebSocket(`ws://127.0.0.1:${testPort}/ws/telemetry`);

    await new Promise<void>((resolve, reject) => {
      ws2.on('open', resolve);
      ws2.on('error', reject);
    });

    console.log(`  Active clients recorded in broadcaster: ${broadcaster.getConnectedClientsCount()}`);
    if (broadcaster.getConnectedClientsCount() !== 2) {
      throw new Error(`Expected 2 connected clients, got ${broadcaster.getConnectedClientsCount()}`);
    }
    console.log('✓ Multi-client registration verified.');

    // Disconnect Client 2
    console.log('  Disconnecting Client 2...');
    ws2.close();
    await new Promise((r) => setTimeout(r, 300));

    console.log(`  Active clients after disconnect: ${broadcaster.getConnectedClientsCount()}`);
    if (broadcaster.getConnectedClientsCount() !== 1) {
      throw new Error(`Expected 1 client after disconnect, got ${broadcaster.getConnectedClientsCount()}`);
    }
    console.log('✓ Client disconnection lifecycle verified!\n');

    // Clean up
    broadcaster.stop();
    ws1.close();
    await server.close();
    await kafkaClient.disconnectAll();

    console.log('=== WebSocket Live Telemetry Stream Verified Successfully! ===\n');
    process.exit(0);
  } catch (err) {
    console.error('Test failed with error:', err);
    broadcaster.stop();
    await server.close();
    await kafkaClient.disconnectAll();
    process.exit(1);
  }
}

runWebSocketStreamTest();
