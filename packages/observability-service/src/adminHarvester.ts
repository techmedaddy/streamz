import { Admin } from 'kafkajs';
import { ResilientKafkaClient } from '@streamz/kafka-client';

export interface BrokerInfo {
  nodeId: number;
  host: string;
  port: number;
  isController: boolean;
}

export interface PartitionMetadata {
  partitionId: number;
  leader: number;
  replicas: number[];
  isr: number[];
  offlineReplicas: number[];
  highWatermark?: string;
}

export interface TopicSummary {
  name: string;
  isInternal: boolean;
  partitionCount: number;
  partitions: PartitionMetadata[];
}

export interface ClusterOverview {
  clusterId: string;
  controllerBrokerId: number | null;
  brokers: BrokerInfo[];
  topics: TopicSummary[];
  totalPartitions: number;
  healthy: boolean;
  timestamp: string;
}

export interface GroupMemberInfo {
  memberId: string;
  clientId: string;
  clientHost: string;
  assignedPartitions: Array<{ topic: string; partitions: number[] }>;
}

export interface ConsumerGroupOverview {
  groupId: string;
  protocolType: string;
  protocol: string;
  state: string;
  membersCount: number;
  members: GroupMemberInfo[];
}

/**
 * Decodes standard Kafka binary member assignment payload.
 */
export function decodeMemberAssignment(buffer: Buffer): Array<{ topic: string; partitions: number[] }> {
  try {
    if (!buffer || buffer.length < 6) return [];
    let offset = 0;
    // version: int16
    offset += 2;
    // topicsCount: int32
    const topicsCount = buffer.readInt32BE(offset);
    offset += 4;

    const assignments: Array<{ topic: string; partitions: number[] }> = [];
    for (let i = 0; i < topicsCount && offset < buffer.length; i++) {
      const topicLength = buffer.readInt16BE(offset);
      offset += 2;
      const topic = buffer.toString('utf8', offset, offset + topicLength);
      offset += topicLength;

      const partitionsCount = buffer.readInt32BE(offset);
      offset += 4;

      const partitions: number[] = [];
      for (let p = 0; p < partitionsCount && offset < buffer.length; p++) {
        partitions.push(buffer.readInt32BE(offset));
        offset += 4;
      }
      assignments.push({ topic, partitions: partitions.sort((a, b) => a - b) });
    }
    return assignments;
  } catch {
    return [];
  }
}

export class KafkaAdminHarvester {
  public readonly kafkaClient: ResilientKafkaClient;

  constructor(kafkaClient: ResilientKafkaClient) {
    this.kafkaClient = kafkaClient;
  }

  public async getAdmin(): Promise<Admin> {
    return await this.kafkaClient.getAdmin();
  }

  /**
   * Harvests top-level cluster topology: brokers, controller, topics and partition metadata.
   */
  public async getClusterOverview(): Promise<ClusterOverview> {
    const admin = await this.getAdmin();
    const cluster = await admin.describeCluster();
    const rawTopics = await admin.listTopics();

    // Exclude internal offsets topic from standard metrics if needed, but report with isInternal flag
    const topicMetadata = rawTopics.length > 0 
      ? await admin.fetchTopicMetadata({ topics: rawTopics })
      : { topics: [] };

    let totalPartitions = 0;
    const topics: TopicSummary[] = [];

    for (const t of topicMetadata.topics) {
      const isInternal = t.name.startsWith('__');
      totalPartitions += t.partitions.length;

      // Attempt to enrich with high watermarks
      let topicOffsets: Array<{ partition: number; offset: string }> = [];
      try {
        topicOffsets = await admin.fetchTopicOffsets(t.name);
      } catch {
        // Topic might be empty or in transient state
      }

      const offsetMap = new Map(topicOffsets.map((o) => [o.partition, o.offset]));

      const partitions: PartitionMetadata[] = t.partitions.map((p) => ({
        partitionId: p.partitionId,
        leader: p.leader,
        replicas: p.replicas,
        isr: p.isr,
        offlineReplicas: p.offlineReplicas || [],
        highWatermark: offsetMap.get(p.partitionId) || '0',
      })).sort((a, b) => a.partitionId - b.partitionId);

      topics.push({
        name: t.name,
        isInternal,
        partitionCount: partitions.length,
        partitions,
      });
    }

    topics.sort((a, b) => a.name.localeCompare(b.name));

    const brokers: BrokerInfo[] = cluster.brokers.map((b) => ({
      nodeId: b.nodeId,
      host: b.host,
      port: b.port,
      isController: b.nodeId === cluster.controller,
    }));

    return {
      clusterId: cluster.clusterId,
      controllerBrokerId: cluster.controller,
      brokers,
      topics,
      totalPartitions,
      healthy: brokers.length > 0 && cluster.controller !== null,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Harvests all registered consumer groups and their real-time state and member assignments.
   */
  public async getConsumerGroupsOverview(): Promise<ConsumerGroupOverview[]> {
    const admin = await this.getAdmin();
    const { groups: listedGroups } = await admin.listGroups();

    if (!listedGroups || listedGroups.length === 0) {
      return [];
    }

    const groupIds = listedGroups.map((g) => g.groupId);
    const described = await admin.describeGroups(groupIds);

    const result: ConsumerGroupOverview[] = described.groups.map((g) => {
      const members: GroupMemberInfo[] = (g.members || []).map((m) => {
        const assignedPartitions = m.memberAssignment 
          ? decodeMemberAssignment(m.memberAssignment as Buffer)
          : [];

        return {
          memberId: m.memberId,
          clientId: m.clientId,
          clientHost: m.clientHost,
          assignedPartitions,
        };
      });

      return {
        groupId: g.groupId,
        protocolType: g.protocolType,
        protocol: g.protocol,
        state: g.state,
        membersCount: members.length,
        members,
      };
    });

    return result.sort((a, b) => a.groupId.localeCompare(b.groupId));
  }

  /**
   * Harvests detailed metadata and partition metrics for a single topic.
   */
  public async getTopicDetails(topicName: string): Promise<TopicSummary | null> {
    const admin = await this.getAdmin();
    try {
      const metadata = await admin.fetchTopicMetadata({ topics: [topicName] });
      const topicData = metadata.topics.find((t) => t.name === topicName);
      if (!topicData) return null;

      const topicOffsets = await admin.fetchTopicOffsets(topicName);
      const offsetMap = new Map(topicOffsets.map((o) => [o.partition, o.offset]));

      const partitions: PartitionMetadata[] = topicData.partitions.map((p) => ({
        partitionId: p.partitionId,
        leader: p.leader,
        replicas: p.replicas,
        isr: p.isr,
        offlineReplicas: p.offlineReplicas || [],
        highWatermark: offsetMap.get(p.partitionId) || '0',
      })).sort((a, b) => a.partitionId - b.partitionId);

      return {
        name: topicName,
        isInternal: topicName.startsWith('__'),
        partitionCount: partitions.length,
        partitions,
      };
    } catch {
      return null;
    }
  }
}
