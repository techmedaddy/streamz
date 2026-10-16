import { ResilientKafkaClient } from '@streamz/kafka-client';
import { TOPICS, createEventEnvelope, OrderCreatedPayload } from '@streamz/contracts';

async function runChaosScenarios() {
  console.log('=== Kafka Chaos & Operational Reliability Scenarios ===\n');

  const kafkaClient = new ResilientKafkaClient({
    clientId: 'chaos-scenarios-client',
    brokers: [process.env.KAFKA_BROKERS || 'localhost:9094'],
  });

  const admin = await kafkaClient.getAdmin();

  // =========================================================================
  // EXPERIMENT 1: Consumer Lag Buildup & Drain Measurement
  // =========================================================================
  console.log('-------------------------------------------------------------');
  console.log('EXPERIMENT 1: Consumer Lag Buildup & Drain Measurement');
  console.log('-------------------------------------------------------------\n');

  const lagGroupId = `lag-buildup-group-${Date.now()}`;
  const testTopic = TOPICS.ORDERS;

  // 1. Initialize consumer group and commit initial baseline offsets
  console.log('1. Initializing baseline offset for consumer group...');
  const initConsumer = await kafkaClient.createConsumer(lagGroupId);
  await initConsumer.subscribe({ topic: testTopic, fromBeginning: false });

  await initConsumer.run({
    autoCommit: false,
    eachMessage: async () => {},
  });

  // Allow group to register
  await new Promise((r) => setTimeout(r, 3500));

  // Sync committed offsets to current high-watermarks so starting lag is 0
  const topicOffsets = await admin.fetchTopicOffsets(testTopic);
  await initConsumer.commitOffsets(
    topicOffsets.map((to) => ({
      topic: testTopic,
      partition: to.partition,
      offset: to.offset,
    }))
  );

  console.log('✓ Baseline committed offsets synchronized.');
  await initConsumer.disconnect();

  // Verify initial lag is 0
  const initialLag = await kafkaClient.fetchConsumerGroupLag(lagGroupId, testTopic);
  console.log(`Starting Total Lag: ${initialLag.totalLag}`);

  // 2. Simulate consumer offline: Produce a burst of 30 messages across all 3 partitions
  console.log('\n2. Consumer is offline. Ingesting burst of 30 messages across partitions...');
  const burstKeys = ['key-alpha', 'key-beta', 'key-gamma', 'key-delta', 'key-epsilon'];
  const totalBurstMessages = 30;

  for (let i = 0; i < totalBurstMessages; i++) {
    const key = burstKeys[i % burstKeys.length];
    const envelope = createEventEnvelope<OrderCreatedPayload>({
      eventType: 'OrderCreated',
      aggregateId: key,
      payload: {
        orderId: `order-burst-${i}`,
        customerId: `cust-${key}`,
        productId: 'prod-keyboard-rgb',
        quantity: 1,
        totalPrice: 99.99,
      },
    });

    await kafkaClient.sendEvent(testTopic, envelope);
  }

  console.log(`✓ 30 messages published to ${testTopic}.`);

  // 3. Measure accumulated lag via Kafka Admin API
  console.log('\n3. Measuring accumulated consumer lag via Kafka Admin API:');
  const accumulatedLag = await kafkaClient.fetchConsumerGroupLag(lagGroupId, testTopic);

  console.table(
    accumulatedLag.partitions.map((p) => ({
      'Partition ID': p.partition,
      'Log End Offset (HighWatermark)': p.logEndOffset,
      'Committed Offset': p.committedOffset,
      'Partition Lag': p.lag,
    }))
  );

  console.log(`Measured Total Lag: ${accumulatedLag.totalLag} messages.`);

  if (accumulatedLag.totalLag !== totalBurstMessages) {
    throw new Error(
      `Lag calculation mismatch: expected total lag of ${totalBurstMessages}, got ${accumulatedLag.totalLag}`
    );
  }
  console.log('✓ Lag Buildup Verified: Lag curve accurately reflects unconsumed backlog.');

  // 4. Resume consumer and drain lag to zero
  console.log('\n4. Starting consumer to drain the accumulated backlog...');
  const drainConsumer = await kafkaClient.createConsumer(lagGroupId);
  await drainConsumer.subscribe({ topic: testTopic, fromBeginning: false });

  let processedCount = 0;
  const drainPromise = new Promise<void>((resolve) => {
    drainConsumer.run({
      autoCommit: false,
      eachMessage: async ({ topic, partition, message }) => {
        processedCount++;
        await kafkaClient.commitMessageOffset(drainConsumer, topic, partition, message.offset);
        if (processedCount === totalBurstMessages) {
          resolve();
        }
      },
    });
  });

  await drainPromise;
  console.log(`✓ Consumer ingested and committed all ${processedCount} messages.`);

  // 5. Measure final lag after drain
  const drainedLag = await kafkaClient.fetchConsumerGroupLag(lagGroupId, testTopic);
  console.log(`\nFinal Total Lag after drain: ${drainedLag.totalLag}`);

  console.table(
    drainedLag.partitions.map((p) => ({
      'Partition ID': p.partition,
      'Log End Offset': p.logEndOffset,
      'Committed Offset': p.committedOffset,
      'Partition Lag': p.lag,
    }))
  );

  if (drainedLag.totalLag !== 0) {
    throw new Error(`Expected zero lag after drain, got ${drainedLag.totalLag}`);
  }
  console.log('✓ Lag Drain Verified: Lag successfully reduced to exactly 0!\n');

  await drainConsumer.disconnect();

  // =========================================================================
  // EXPERIMENT 2: Dynamic Consumer Group Rebalancing & Parallelism
  // =========================================================================
  console.log('-------------------------------------------------------------');
  console.log('EXPERIMENT 2: Dynamic Consumer Group Rebalancing & Parallelism');
  console.log('-------------------------------------------------------------\n');

  const rebalanceGroupId = `rebalance-group-${Date.now()}`;
  const rebalanceOptions = { sessionTimeout: 6000, heartbeatInterval: 1000 };

  // Member 1 joins
  console.log('Step 1: Member 1 joins the consumer group...');
  const member1 = await kafkaClient.createConsumer(rebalanceGroupId, rebalanceOptions);
  let member1Assignments: number[] = [];

  member1.on(member1.events.GROUP_JOIN, (e) => {
    member1Assignments = (e.payload.memberAssignment[testTopic] || []).sort();
    console.log(`  [Event: Group Join] Member 1 assigned partitions: [${member1Assignments.join(', ')}]`);
  });

  await member1.subscribe({ topic: testTopic, fromBeginning: false });
  await member1.run({ eachMessage: async () => {} });

  await new Promise((r) => setTimeout(r, 3500));

  console.log(`✓ Single Consumer Phase: Member 1 owns all ${member1Assignments.length} partitions: [${member1Assignments.join(', ')}]`);
  if (member1Assignments.length !== 3) {
    throw new Error(`Expected Member 1 to own 3 partitions, got ${member1Assignments.length}`);
  }

  // Member 2 joins
  console.log('\nStep 2: Member 2 joins the consumer group (scaling from 1 to 2 consumers)...');
  const member2 = await kafkaClient.createConsumer(rebalanceGroupId, rebalanceOptions);
  let member2Assignments: number[] = [];

  member2.on(member2.events.GROUP_JOIN, (e) => {
    member2Assignments = (e.payload.memberAssignment[testTopic] || []).sort();
    console.log(`  [Event: Group Join] Member 2 assigned partitions: [${member2Assignments.join(', ')}]`);
  });

  await member2.subscribe({ topic: testTopic, fromBeginning: false });
  await member2.run({ eachMessage: async () => {} });

  await new Promise((r) => setTimeout(r, 3500));

  console.log(
    `✓ Two Consumer Phase: Partitions divided -> Member 1: [${member1Assignments.join(', ')}], Member 2: [${member2Assignments.join(', ')}]`
  );

  const totalAssigned2 = member1Assignments.length + member2Assignments.length;
  if (totalAssigned2 !== 3 || member1Assignments.length === 0 || member2Assignments.length === 0) {
    throw new Error(`Rebalance partition split failure: Member 1 (${member1Assignments}), Member 2 (${member2Assignments})`);
  }

  // Member 3 joins (1 consumer per partition!)
  console.log('\nStep 3: Member 3 joins the consumer group (scaling to 3 consumers — 1:1 partition mapping)...');
  const member3 = await kafkaClient.createConsumer(rebalanceGroupId, rebalanceOptions);
  let member3Assignments: number[] = [];

  member3.on(member3.events.GROUP_JOIN, (e) => {
    member3Assignments = (e.payload.memberAssignment[testTopic] || []).sort();
    console.log(`  [Event: Group Join] Member 3 assigned partitions: [${member3Assignments.join(', ')}]`);
  });

  await member3.subscribe({ topic: testTopic, fromBeginning: false });
  await member3.run({ eachMessage: async () => {} });

  await new Promise((r) => setTimeout(r, 3500));

  console.log(
    `✓ Maximum Parallelism Phase: Member 1: [${member1Assignments.join(', ')}], Member 2: [${member2Assignments.join(', ')}], Member 3: [${member3Assignments.join(', ')}]`
  );

  if (member1Assignments.length !== 1 || member2Assignments.length !== 1 || member3Assignments.length !== 1) {
    throw new Error('Expected each of the 3 members to have exactly 1 partition!');
  }
  console.log('✓ 1-to-1 Partition-to-Consumer Parallelism achieved!');

  // Member 3 leaves (failover test)
  console.log('\nStep 4: Simulating Member 3 crash/exit (failover rebalance)...');
  await member3.disconnect();

  console.log('Waiting for consumer group failover rebalance to complete...');
  const failoverStart = Date.now();
  while (member1Assignments.length + member2Assignments.length < 3 && Date.now() - failoverStart < 15000) {
    await new Promise((r) => setTimeout(r, 500));
  }

  console.log(
    `✓ Failover Rebalance Phase: Remaining members re-absorbed partition -> Member 1: [${member1Assignments.join(', ')}], Member 2: [${member2Assignments.join(', ')}]`
  );

  const totalAssignedAfterFailover = member1Assignments.length + member2Assignments.length;
  if (totalAssignedAfterFailover !== 3) {
    throw new Error(`Expected all 3 partitions to be retained after failover, found ${totalAssignedAfterFailover}`);
  }
  console.log('✓ Failover Rebalance Verified: Zero unassigned partitions after worker exit!');

  // Cleanup
  await member1.disconnect();
  await member2.disconnect();
  await kafkaClient.disconnectAll();

  console.log('\n=== All Chaos & Operational Reliability Scenarios Complete and 100% Successful! ===');
  process.exit(0);
}

runChaosScenarios().catch((err) => {
  console.error('Chaos scenario failed:', err);
  process.exit(1);
});
