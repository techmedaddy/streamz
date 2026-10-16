import { ResilientKafkaClient } from '@streamz/kafka-client';
import { TOPICS, createEventEnvelope, OrderCreatedPayload } from '@streamz/contracts';

async function runManualCommitsTest() {
  console.log('=== Kafka Manual Offset Commits & At-Least-Once Delivery ===\n');

  const kafkaClient = new ResilientKafkaClient({
    clientId: 'manual-commits-test-client',
    brokers: [process.env.KAFKA_BROKERS || 'localhost:9094'],
  });

  const testGroupId = `manual-commit-group-${Date.now()}`;
  const fixedKey = `order-dedupe-key-${Date.now()}`; // Same key guarantees same partition
  const testTopic = TOPICS.ORDERS;

  // --- Scenario 1: Verify Manual Offset Commit Post-Processing ---
  console.log('1. Starting Consumer 1 with manual commits (autoCommit: false)...');
  const consumer1 = await kafkaClient.createConsumer(testGroupId);
  await consumer1.subscribe({ topic: testTopic, fromBeginning: false });

  let message1Partition: number = -1;
  let message1Offset: string = '';

  const message1Promise = new Promise<void>((resolve) => {
    consumer1.run({
      autoCommit: false, // Explicitly disabled
      eachMessage: async ({ topic, partition, message }) => {
        if (!message.value) return;
        const env = JSON.parse(message.value.toString());

        if (env.aggregateId === fixedKey && (env.payload as any).step === 'STEP_1') {
          console.log(`[Consumer 1] Ingested message 1 at partition ${partition}, offset ${message.offset}`);
          message1Partition = partition;
          message1Offset = message.offset;

          // Perform explicit manual commit
          await kafkaClient.commitMessageOffset(consumer1, topic, partition, message.offset);
          console.log(`[Consumer 1] Successfully committed offset ${BigInt(message.offset) + 1n} manually.`);
          resolve();
        }
      },
    });
  });

  console.log('Waiting for Consumer 1 to join consumer group...');
  await new Promise((r) => setTimeout(r, 4000));

  console.log('Producing Message 1 (step: STEP_1)...');
  const envelope1 = createEventEnvelope<OrderCreatedPayload & { step: string }>({
    eventType: 'OrderCreated',
    aggregateId: fixedKey,
    payload: {
      orderId: fixedKey,
      customerId: 'cust-manual-1',
      productId: 'prod-keyboard-rgb',
      quantity: 1,
      totalPrice: 99.99,
      step: 'STEP_1',
    },
  });

  await kafkaClient.sendEvent(testTopic, envelope1);
  await message1Promise;

  // Verify Kafka Admin committed offset
  const committedAfterMsg1 = await kafkaClient.fetchCommittedOffset(testGroupId, testTopic, message1Partition);
  const expectedOffset1 = (BigInt(message1Offset) + 1n).toString();
  console.log(`[Kafka Admin Check] Committed offset for partition ${message1Partition}: ${committedAfterMsg1}`);

  if (committedAfterMsg1 !== expectedOffset1) {
    throw new Error(`Expected committed offset ${expectedOffset1}, got ${committedAfterMsg1}`);
  }
  console.log('✓ Scenario 1 Verified: Explicit manual offset commit correctly recorded in Kafka.\n');

  await consumer1.disconnect();

  // --- Scenario 2: Simulate Consumer Crash Before Commit & Verify Re-delivery ---
  console.log('2. Starting Consumer 2 to simulate crash before commit...');
  const consumer2 = await kafkaClient.createConsumer(testGroupId);
  await consumer2.subscribe({ topic: testTopic, fromBeginning: false });

  let message2Offset: string = '';

  const crashPromise = new Promise<void>((resolve) => {
    consumer2.run({
      autoCommit: false,
      eachMessage: async ({ partition, message }) => {
        if (!message.value) return;
        const env = JSON.parse(message.value.toString());

        if (env.aggregateId === fixedKey && (env.payload as any).step === 'STEP_2') {
          console.log(`[Consumer 2] Ingested message 2 at partition ${partition}, offset ${message.offset}`);
          message2Offset = message.offset;
          console.log('[Consumer 2] *** SIMULATING CRASH: Exiting handler WITHOUT committing offset ***');
          resolve();
        }
      },
    });
  });

  console.log('Waiting for Consumer 2 to join group...');
  await new Promise((r) => setTimeout(r, 4000));

  console.log('Producing Message 2 (step: STEP_2)...');
  const envelope2 = createEventEnvelope<OrderCreatedPayload & { step: string }>({
    eventType: 'OrderCreated',
    aggregateId: fixedKey,
    payload: {
      orderId: fixedKey,
      customerId: 'cust-manual-2',
      productId: 'prod-keyboard-rgb',
      quantity: 2,
      totalPrice: 199.98,
      step: 'STEP_2',
    },
  });

  await kafkaClient.sendEvent(testTopic, envelope2);
  await crashPromise;

  // Disconnect Consumer 2 to simulate worker death
  await consumer2.disconnect();
  console.log('[Consumer 2] Worker process terminated/disconnected.');

  // Verify Kafka Admin: offset for partition MUST STILL BE offset1 because commit was withheld
  const committedAfterCrash = await kafkaClient.fetchCommittedOffset(testGroupId, testTopic, message1Partition);
  console.log(`[Kafka Admin Check] Committed offset after worker crash: ${committedAfterCrash}`);

  if (committedAfterCrash !== expectedOffset1) {
    throw new Error(`Expected uncommitted offset to remain ${expectedOffset1}, got ${committedAfterCrash}`);
  }
  console.log('✓ Verified: Offset was NOT advanced because commit was withheld prior to crash.');

  // --- Scenario 3: Start Consumer 3 (Recovery) and verify Message 2 is re-delivered ---
  console.log('\n3. Starting Consumer 3 (Replacement Worker) in same consumer group...');
  const consumer3 = await kafkaClient.createConsumer(testGroupId);
  await consumer3.subscribe({ topic: testTopic, fromBeginning: false });

  let message2ReDelivered = false;

  const recoveryPromise = new Promise<void>((resolve) => {
    consumer3.run({
      autoCommit: false,
      eachMessage: async ({ topic, partition, message }) => {
        if (!message.value) return;
        const env = JSON.parse(message.value.toString());

        if (env.aggregateId === fixedKey && (env.payload as any).step === 'STEP_2') {
          console.log(`[Consumer 3 - Recovery] Successfully re-delivered message 2 at offset ${message.offset}!`);
          message2ReDelivered = true;

          // Now complete processing and commit offset
          await kafkaClient.commitMessageOffset(consumer3, topic, partition, message.offset);
          console.log(`[Consumer 3 - Recovery] Committed offset ${BigInt(message.offset) + 1n} successfully.`);
          resolve();
        }
      },
    });
  });

  console.log('Waiting for Consumer 3 to recover partition assignment and resume from last committed offset...');
  await recoveryPromise;

  const finalCommitted = await kafkaClient.fetchCommittedOffset(testGroupId, testTopic, message1Partition);
  const expectedOffset2 = (BigInt(message2Offset) + 1n).toString();
  console.log(`[Kafka Admin Check] Final committed offset after recovery: ${finalCommitted}`);

  if (finalCommitted !== expectedOffset2) {
    throw new Error(`Expected final offset ${expectedOffset2}, got ${finalCommitted}`);
  }

  console.log('✓ Scenario 2 & 3 Verified: At-least-once delivery guaranteed — zero message loss on worker crash!');

  await consumer3.disconnect();
  await kafkaClient.disconnectAll();

  console.log('\n=== Manual Offset Commits Test Complete and Successful! ===');
  process.exit(0);
}

runManualCommitsTest().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
