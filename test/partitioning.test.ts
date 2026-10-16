import { ResilientKafkaClient } from '@streamz/kafka-client';
import { TOPICS, createEventEnvelope, OrderCreatedPayload } from '@streamz/contracts';

interface CapturedRecord {
  key: string;
  partition: number;
  offset: string;
  sequence: number;
  eventId: string;
}

async function runPartitioningTest() {
  console.log('=== Kafka Partitioning & Key Hashing Verification ===\n');

  const kafkaClient = new ResilientKafkaClient({
    clientId: 'partitioning-test-client',
    brokers: [process.env.KAFKA_BROKERS || 'localhost:9094'],
  });

  const admin = await kafkaClient.getAdmin();

  // 1. Inspect topic metadata
  console.log('1. Checking partition layout for topic "orders"...');
  const metadata = await admin.fetchTopicMetadata({ topics: [TOPICS.ORDERS] });
  const ordersTopic = metadata.topics.find((t) => t.name === TOPICS.ORDERS);

  if (!ordersTopic) {
    throw new Error('Topic "orders" not found in Kafka cluster!');
  }

  const partitionsCount = ordersTopic.partitions.length;
  console.log(`✓ Topic "orders" verified with ${partitionsCount} partitions:`);
  ordersTopic.partitions.forEach((p) => {
    console.log(`  - Partition ${p.partitionId} (Leader: Broker ${p.leader}, Replicas: [${p.replicas.join(', ')}], ISR: [${p.isr.join(', ')}])`);
  });

  if (partitionsCount < 3) {
    throw new Error(`Expected at least 3 partitions on orders topic, found ${partitionsCount}`);
  }

  // 2. Setup a dedicated consumer to capture all produced test messages
  const consumerGroupId = `partitioning-test-group-${Date.now()}`;
  const consumer = await kafkaClient.createConsumer(consumerGroupId);
  await consumer.subscribe({ topic: TOPICS.ORDERS, fromBeginning: false });

  const capturedRecords: CapturedRecord[] = [];
  const testBatchId = `batch-${Date.now()}`;

  consumer.run({
    eachMessage: async ({ partition, message }) => {
      if (!message.value || !message.key) return;
      try {
        const envelope = JSON.parse(message.value.toString());
        if (envelope.correlationId === testBatchId) {
          capturedRecords.push({
            key: message.key.toString(),
            partition,
            offset: message.offset,
            sequence: (envelope.payload as any).sequence,
            eventId: envelope.eventId,
          });
        }
      } catch {
        // ignore other messages
      }
    },
  });

  console.log('\n2. Waiting for consumer group assignment to initialize...');
  await new Promise((r) => setTimeout(r, 4000));

  // 3. Define 5 unique order keys and produce 5 sequential events each
  const testKeys = [
    'order-alpha-US',
    'order-beta-EU',
    'order-gamma-APAC',
    'order-delta-LATAM',
    'order-epsilon-AFR',
  ];
  const sequencesPerKey = 5;
  const totalExpected = testKeys.length * sequencesPerKey;

  console.log(`\n3. Producing ${totalExpected} messages across 5 distinct order keys (${sequencesPerKey} sequential steps per key)...`);

  for (const key of testKeys) {
    for (let seq = 1; seq <= sequencesPerKey; seq++) {
      const payload: OrderCreatedPayload & { sequence: number } = {
        orderId: key,
        customerId: `customer-${key}`,
        productId: 'prod-keyboard-rgb',
        quantity: seq,
        totalPrice: Number((seq * 99.99).toFixed(2)),
        sequence: seq,
      };

      const envelope = createEventEnvelope({
        eventType: 'OrderCreated',
        aggregateId: key,
        correlationId: testBatchId,
        payload,
      });

      await kafkaClient.sendEvent(TOPICS.ORDERS, envelope);
    }
  }

  console.log('✓ All messages sent with aggregateId as message key.');

  // 4. Wait for consumer to ingest all messages
  console.log('\n4. Collecting consumed messages and analyzing partition assignments...');
  const startWait = Date.now();
  while (capturedRecords.length < totalExpected && Date.now() - startWait < 8000) {
    await new Promise((r) => setTimeout(r, 200));
  }

  console.log(`Captured ${capturedRecords.length}/${totalExpected} messages.\n`);

  if (capturedRecords.length < totalExpected) {
    throw new Error(`Timeout! Only captured ${capturedRecords.length} of ${totalExpected} messages.`);
  }

  // 5. Evaluate assertions:
  console.log('5. Asserting Deterministic Key Hashing and Partition Affinity:');
  const keyToPartitionMap = new Map<string, Set<number>>();
  const partitionCounts = new Map<number, number>();

  for (const record of capturedRecords) {
    if (!keyToPartitionMap.has(record.key)) {
      keyToPartitionMap.set(record.key, new Set());
    }
    keyToPartitionMap.get(record.key)!.add(record.partition);
    partitionCounts.set(record.partition, (partitionCounts.get(record.partition) || 0) + 1);
  }

  const summaryTable: any[] = [];
  const assignedPartitions = new Set<number>();

  for (const key of testKeys) {
    const partitions = Array.from(keyToPartitionMap.get(key) || []);
    if (partitions.length !== 1) {
      throw new Error(`Key ${key} was partitioned inconsistently across multiple partitions: [${partitions.join(', ')}]`);
    }

    const assignedPartition = partitions[0];
    assignedPartitions.add(assignedPartition);

    const recordsForKey = capturedRecords.filter((r) => r.key === key);
    const offsets = recordsForKey.map((r) => BigInt(r.offset));
    for (let i = 1; i < offsets.length; i++) {
      if (offsets[i] <= offsets[i - 1]) {
        throw new Error(`Non-monotonic offsets detected for key ${key}: ${offsets[i - 1]} >= ${offsets[i]}`);
      }
    }

    const sequences = recordsForKey.map((r) => r.sequence);
    const expectedSequences = [1, 2, 3, 4, 5];
    const isOrdered = JSON.stringify(sequences) === JSON.stringify(expectedSequences);

    if (!isOrdered) {
      throw new Error(`Sequence out-of-order for key ${key}: got [${sequences.join(', ')}]`);
    }

    summaryTable.push({
      Key: key,
      'Target Partition': assignedPartition,
      'Total Msgs': recordsForKey.length,
      'Min Offset': offsets[0].toString(),
      'Max Offset': offsets[offsets.length - 1].toString(),
      'Sequence Flow': sequences.join(' -> '),
      'Order Status': 'STRICTLY PRESERVED ✓',
    });
  }

  console.table(summaryTable);

  console.log(`✓ Partition Affinity: Every key was deterministically pinned to 1 partition 100% of the time.`);
  console.log(`✓ Strict Ordering: Every key preserved sequence [1 -> 2 -> 3 -> 4 -> 5] with monotonically increasing offsets.`);
  console.log(`✓ Distribution: Keys spread across partitions [${Array.from(assignedPartitions).sort().join(', ')}].`);

  await consumer.disconnect();
  await kafkaClient.disconnectAll();

  console.log('\n=== Partitioning & Key Hashing Test Complete and Successful! ===');
  process.exit(0);
}

runPartitioningTest().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
