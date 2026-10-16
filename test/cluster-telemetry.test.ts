import { ResilientKafkaClient } from '../packages/kafka-client/src/index.js';
import { KafkaAdminHarvester, createObservabilityServer } from '../packages/observability-service/src/index.js';
import { TOPICS } from '../packages/contracts/src/index.js';

async function runClusterTelemetryTest() {
  console.log('=============================================================');
  console.log('KAFKA ADMIN TELEMETRY & CLUSTER HARVESTER TEST');
  console.log('=============================================================\n');

  const kafkaClient = new ResilientKafkaClient({
    clientId: 'cluster-telemetry-test',
    brokers: [process.env.KAFKA_BROKERS || 'localhost:9094'],
  });

  const harvester = new KafkaAdminHarvester(kafkaClient);
  const server = await createObservabilityServer(harvester);

  try {
    // 1. Direct Harvester: Cluster Overview
    console.log('Step 1: Harvesting Kafka Cluster Overview...');
    const cluster = await harvester.getClusterOverview();

    console.log(`  Cluster ID: ${cluster.clusterId}`);
    console.log(`  Brokers: ${cluster.brokers.map((b) => `${b.host}:${b.port} (Node ${b.nodeId}, Controller: ${b.isController})`).join(', ')}`);
    console.log(`  Total Topics: ${cluster.topics.length}`);
    console.log(`  Total Partitions: ${cluster.totalPartitions}`);
    console.log(`  Cluster Healthy: ${cluster.healthy}`);

    if (!cluster.clusterId) {
      throw new Error('Cluster ID was empty');
    }
    if (cluster.brokers.length === 0) {
      throw new Error('No brokers found');
    }
    if (!cluster.healthy) {
      throw new Error('Cluster reported unhealthy');
    }

    const ordersTopic = cluster.topics.find((t) => t.name === TOPICS.ORDERS);
    if (!ordersTopic) {
      throw new Error(`Topic '${TOPICS.ORDERS}' not found in cluster`);
    }
    if (ordersTopic.partitionCount !== 3) {
      throw new Error(`Expected 3 partitions for '${TOPICS.ORDERS}', found ${ordersTopic.partitionCount}`);
    }
    console.log(`✓ Cluster topology validated: Broker detected, '${TOPICS.ORDERS}' has ${ordersTopic.partitionCount} partitions.\n`);

    // 2. Direct Harvester: Active Consumer Group Detection
    const probeGroupId = `telemetry-probe-group-${Date.now()}`;
    console.log(`Step 2: Spinning up active consumer in group '${probeGroupId}'...`);

    const probeConsumer = await kafkaClient.createConsumer(probeGroupId, {
      sessionTimeout: 6000,
      heartbeatInterval: 1000,
    });
    await probeConsumer.subscribe({ topic: TOPICS.ORDERS, fromBeginning: false });
    await probeConsumer.run({ eachMessage: async () => {} });

    // Allow consumer to stabilize in group
    await new Promise((r) => setTimeout(r, 3000));

    console.log('Step 3: Harvesting Consumer Groups Telemetry...');
    const groups = await harvester.getConsumerGroupsOverview();
    const probeGroup = groups.find((g) => g.groupId === probeGroupId);

    if (!probeGroup) {
      throw new Error(`Consumer group '${probeGroupId}' was not returned by harvester`);
    }

    console.log(`  Group ID: ${probeGroup.groupId}`);
    console.log(`  State: ${probeGroup.state}`);
    console.log(`  Members: ${probeGroup.membersCount}`);
    for (const m of probeGroup.members) {
      console.log(`    Member: ${m.memberId} (${m.clientId} on ${m.clientHost})`);
      for (const a of m.assignedPartitions) {
        console.log(`      Assigned Topic: ${a.topic} -> Partitions: [${a.partitions.join(', ')}]`);
      }
    }

    if (probeGroup.state !== 'Stable') {
      throw new Error(`Expected group state 'Stable', got '${probeGroup.state}'`);
    }
    if (probeGroup.membersCount !== 1) {
      throw new Error(`Expected 1 member, got ${probeGroup.membersCount}`);
    }

    const member = probeGroup.members[0];
    const ordersAssignment = member.assignedPartitions.find((a) => a.topic === TOPICS.ORDERS);
    if (!ordersAssignment || ordersAssignment.partitions.length !== 3) {
      throw new Error(`Expected member to have all 3 partitions of orders assigned`);
    }
    console.log(`✓ Active consumer group telemetry validated: 1 member, Stable state, partitions [${ordersAssignment.partitions.join(', ')}] assigned.\n`);

    // 3. Direct Harvester: Topic Details
    console.log('Step 4: Fetching single topic details for topic: orders...');
    const topicDetails = await harvester.getTopicDetails(TOPICS.ORDERS);
    if (!topicDetails || topicDetails.partitionCount !== 3) {
      throw new Error('Failed to retrieve topic details for orders');
    }
    console.log(`✓ Topic details verified: ${topicDetails.name} has ${topicDetails.partitions.length} partitions.\n`);

    // 4. REST API Endpoint Injections
    console.log('Step 5: Testing Fastify REST Endpoints...');

    // GET /health
    const healthRes = await server.inject({ method: 'GET', url: '/health' });
    if (healthRes.statusCode !== 200) {
      throw new Error(`GET /health failed with status ${healthRes.statusCode}`);
    }
    console.log('  GET /health -> 200 OK');

    // GET /api/kafka/cluster
    const clusterRes = await server.inject({ method: 'GET', url: '/api/kafka/cluster' });
    if (clusterRes.statusCode !== 200) {
      throw new Error(`GET /api/kafka/cluster failed with status ${clusterRes.statusCode}`);
    }
    const clusterPayload = JSON.parse(clusterRes.payload);
    if (!clusterPayload.clusterId || !clusterPayload.brokers) {
      throw new Error('Invalid /api/kafka/cluster response payload');
    }
    console.log(`  GET /api/kafka/cluster -> 200 OK (Cluster ID: ${clusterPayload.clusterId})`);

    // GET /api/kafka/topics
    const topicsRes = await server.inject({ method: 'GET', url: '/api/kafka/topics' });
    if (topicsRes.statusCode !== 200) {
      throw new Error(`GET /api/kafka/topics failed with status ${topicsRes.statusCode}`);
    }
    const topicsPayload = JSON.parse(topicsRes.payload);
    console.log(`  GET /api/kafka/topics -> 200 OK (${topicsPayload.length} topics returned)`);

    // GET /api/kafka/topics/orders
    const singleTopicRes = await server.inject({ method: 'GET', url: `/api/kafka/topics/${TOPICS.ORDERS}` });
    if (singleTopicRes.statusCode !== 200) {
      throw new Error(`GET /api/kafka/topics/orders failed with status ${singleTopicRes.statusCode}`);
    }
    console.log(`  GET /api/kafka/topics/orders -> 200 OK`);

    // GET /api/kafka/groups
    const groupsRes = await server.inject({ method: 'GET', url: '/api/kafka/groups' });
    if (groupsRes.statusCode !== 200) {
      throw new Error(`GET /api/kafka/groups failed with status ${groupsRes.statusCode}`);
    }
    const groupsPayload = JSON.parse(groupsRes.payload);
    console.log(`  GET /api/kafka/groups -> 200 OK (${groupsPayload.length} groups returned)`);

    // GET /api/kafka/groups/:groupId
    const singleGroupRes = await server.inject({ method: 'GET', url: `/api/kafka/groups/${probeGroupId}` });
    if (singleGroupRes.statusCode !== 200) {
      throw new Error(`GET /api/kafka/groups/${probeGroupId} failed with status ${singleGroupRes.statusCode}`);
    }
    const singleGroupPayload = JSON.parse(singleGroupRes.payload);
    console.log(`  GET /api/kafka/groups/${probeGroupId} -> 200 OK (State: ${singleGroupPayload.state})`);

    console.log('\n✓ All REST endpoints verified successfully!\n');

    // Clean up
    await probeConsumer.disconnect();
    await server.close();
    await kafkaClient.disconnectAll();

    console.log('=== Kafka Admin Telemetry Harvester Verified Successfully! ===\n');
  } catch (error) {
    console.error('Test failed with error:', error);
    await server.close();
    await kafkaClient.disconnectAll();
    process.exit(1);
  }
}

runClusterTelemetryTest();
