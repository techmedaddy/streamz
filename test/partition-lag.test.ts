import { ResilientKafkaClient } from '../packages/kafka-client/src/index.js';
import {
  KafkaAdminHarvester,
  PartitionLagEngine,
  createObservabilityServer,
} from '../packages/observability-service/src/index.js';
import { TOPICS } from '../packages/contracts/src/index.js';

async function runPartitionLagTest() {
  console.log('=============================================================');
  console.log('PARTITION LAG CALCULATION ENGINE & STALL DETECTION TEST');
  console.log('=============================================================\n');

  const kafkaClient = new ResilientKafkaClient({
    clientId: 'partition-lag-test',
    brokers: [process.env.KAFKA_BROKERS || 'localhost:9094'],
  });

  const harvester = new KafkaAdminHarvester(kafkaClient);
  const lagEngine = new PartitionLagEngine(kafkaClient, harvester);
  const server = createObservabilityServer(harvester, lagEngine);
  const admin = await kafkaClient.getAdmin();
  const producer = await kafkaClient.getProducer();

  const testTopic = TOPICS.ORDERS;
  const testGroupId = `lag-calc-group-${Date.now()}`;

  try {
    // 1. Establish initial committed baseline for group using admin.setOffsets
    console.log(`Step 1: Establishing initial consumer group '${testGroupId}' baseline...`);
    const currentOffsets = await admin.fetchTopicOffsets(testTopic);
    await admin.setOffsets({
      groupId: testGroupId,
      topic: testTopic,
      partitions: currentOffsets.map((o) => ({ partition: o.partition, offset: o.offset })),
    });

    // Verify baseline lag is 0
    console.log('Step 2: Checking baseline lag for synchronized group...');
    const initialLag = await lagEngine.getConsumerGroupLag(testGroupId);
    console.log(`  Initial Group Total Lag: ${initialLag?.totalLag ?? 'N/A'}`);
    console.log(`  Group State: ${initialLag?.state}`);
    console.log(`  Active Members: ${initialLag?.membersCount}`);
    console.log(`  Is Stalled: ${initialLag?.isStalled}`);

    if (initialLag?.totalLag !== 0) {
      throw new Error(`Expected initial totalLag = 0, got ${initialLag?.totalLag}`);
    }
    console.log('✓ Baseline lag verified at exactly 0.\n');

    // 2. Inject controlled message burst to topic partitions
    console.log('Step 3: Producing 15 unconsumed messages (5 per partition across 3 partitions)...');
    for (let p = 0; p < 3; p++) {
      for (let i = 0; i < 5; i++) {
        await producer.send({
          topic: testTopic,
          messages: [
            {
              partition: p,
              key: `lag-test-${p}-${i}`,
              value: JSON.stringify({ test: 'lag-burst', partition: p, index: i }),
            },
          ],
        });
      }
    }
    console.log('  15 messages successfully produced across partitions 0, 1, 2.\n');

    // 3. Calculate Lag via PartitionLagEngine while consumer is offline
    console.log('Step 4: Querying PartitionLagEngine for offline consumer group...');
    const offlineLag = await lagEngine.getConsumerGroupLag(testGroupId);

    if (!offlineLag) {
      throw new Error(`Failed to calculate lag for group '${testGroupId}'`);
    }

    console.log(`  Group: ${offlineLag.groupId}`);
    console.log(`  State: ${offlineLag.state}`);
    console.log(`  Members Count: ${offlineLag.membersCount}`);
    console.log(`  Total Lag: ${offlineLag.totalLag}`);
    console.log(`  Is Stalled: ${offlineLag.isStalled}`);
    console.log(`  Has Unassigned Partitions With Lag: ${offlineLag.hasUnassignedPartitionsWithLag}`);

    const topicLag = offlineLag.topics.find((t) => t.topic === testTopic);
    if (!topicLag) {
      throw new Error(`Topic '${testTopic}' not found in lag report`);
    }

    console.table(
      topicLag.partitions.map((p) => ({
        Partition: p.partition,
        'Log-End': p.logEndOffset,
        Committed: p.committedOffset,
        Lag: p.lag,
        Assigned: p.isAssigned,
      }))
    );

    if (offlineLag.totalLag !== 15) {
      throw new Error(`Expected exactly 15 messages of lag, got ${offlineLag.totalLag}`);
    }
    if (!offlineLag.isStalled) {
      throw new Error('Expected isStalled = true for offline consumer with pending lag');
    }
    if (!offlineLag.hasUnassignedPartitionsWithLag) {
      throw new Error('Expected hasUnassignedPartitionsWithLag = true when consumers are offline');
    }

    console.log('✓ Lag calculation verified: exactly 15 messages lag detected with stall flags active!\n');

    // 4. Test REST Endpoints via Fastify Server
    console.log('Step 5: Testing REST API Lag Endpoints...');

    // GET /api/kafka/lag
    const allLagRes = await server.inject({ method: 'GET', url: '/api/kafka/lag' });
    if (allLagRes.statusCode !== 200) {
      throw new Error(`GET /api/kafka/lag failed with status ${allLagRes.statusCode}`);
    }
    const allLagPayload = JSON.parse(allLagRes.payload);
    const targetGroupSummary = allLagPayload.find((g: any) => g.groupId === testGroupId);
    if (!targetGroupSummary || targetGroupSummary.totalLag !== 15) {
      throw new Error('GET /api/kafka/lag did not reflect target group lag of 15');
    }
    console.log(`  GET /api/kafka/lag -> 200 OK (${allLagPayload.length} groups reported, target lag = ${targetGroupSummary.totalLag})`);

    // GET /api/kafka/lag/:groupId
    const singleLagRes = await server.inject({ method: 'GET', url: `/api/kafka/lag/${testGroupId}` });
    if (singleLagRes.statusCode !== 200) {
      throw new Error(`GET /api/kafka/lag/${testGroupId} failed with status ${singleLagRes.statusCode}`);
    }
    const singleLagPayload = JSON.parse(singleLagRes.payload);
    if (singleLagPayload.totalLag !== 15 || !singleLagPayload.isStalled) {
      throw new Error('GET /api/kafka/lag/:groupId failed stall or lag assertion');
    }
    console.log(`  GET /api/kafka/lag/${testGroupId} -> 200 OK (totalLag: ${singleLagPayload.totalLag}, isStalled: ${singleLagPayload.isStalled})`);
    console.log('✓ REST API lag endpoints validated successfully!\n');

    // 5. Resume Consumer to drain lag
    console.log('Step 6: Starting consumer to drain lag...');
    let messagesDrained = 0;
    const drainConsumer = await kafkaClient.createConsumer(testGroupId, {
      sessionTimeout: 6000,
      heartbeatInterval: 1000,
    });

    await drainConsumer.subscribe({ topic: testTopic, fromBeginning: false });
    await drainConsumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        messagesDrained++;
        await kafkaClient.commitMessageOffset(drainConsumer, topic, partition, message.offset);
      },
    });

    // Wait for consumer to process all 15 messages
    const deadline = Date.now() + 12000;
    while (messagesDrained < 15 && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 400));
    }
    console.log(`  Drained ${messagesDrained} messages.`);

    if (messagesDrained < 15) {
      throw new Error(`Expected at least 15 drained messages, got ${messagesDrained}`);
    }

    // 6. Verify Lag Drained to 0
    await new Promise((r) => setTimeout(r, 1000));
    const finalLag = await lagEngine.getConsumerGroupLag(testGroupId);
    console.log(`  Post-drain Total Lag: ${finalLag?.totalLag}`);
    console.log(`  Post-drain Is Stalled: ${finalLag?.isStalled}`);

    if (finalLag?.totalLag !== 0) {
      throw new Error(`Expected totalLag = 0 after drain, got ${finalLag?.totalLag}`);
    }
    if (finalLag?.isStalled) {
      throw new Error('Expected isStalled = false after draining all lag');
    }

    console.log('✓ Lag drained and validated at 0!\n');

    // Clean up
    await drainConsumer.disconnect();
    await server.close();
    await kafkaClient.disconnectAll();

    console.log('=== Partition Lag Engine Verified Successfully! ===\n');
  } catch (error) {
    console.error('Test failed with error:', error);
    await server.close();
    await kafkaClient.disconnectAll();
    process.exit(1);
  }
}

runPartitionLagTest();
