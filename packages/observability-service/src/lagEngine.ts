import { Admin } from 'kafkajs';
import { ResilientKafkaClient } from '@streamz/kafka-client';
import { KafkaAdminHarvester, decodeMemberAssignment } from './adminHarvester.js';

export interface PartitionLagDetail {
  partition: number;
  logEndOffset: string;
  committedOffset: string;
  lag: number;
  isAssigned: boolean;
  assignedMemberId?: string;
  assignedClientId?: string;
}

export interface TopicLagDetail {
  topic: string;
  partitions: PartitionLagDetail[];
  topicLag: number;
}

export interface ConsumerGroupLagSummary {
  groupId: string;
  state: string;
  membersCount: number;
  totalLag: number;
  isStalled: boolean;
  hasUnassignedPartitionsWithLag: boolean;
  topics: TopicLagDetail[];
}

export class PartitionLagEngine {
  private kafkaClient: ResilientKafkaClient;
  private harvester: KafkaAdminHarvester;

  constructor(kafkaClient: ResilientKafkaClient, harvester: KafkaAdminHarvester) {
    this.kafkaClient = kafkaClient;
    this.harvester = harvester;
  }

  public async getAdmin(): Promise<Admin> {
    return await this.kafkaClient.getAdmin();
  }

  /**
   * Computes partition-level lag for a specific consumer group across all its associated topics.
   */
  public async getConsumerGroupLag(
    groupId: string,
    targetTopics?: string[]
  ): Promise<ConsumerGroupLagSummary | null> {
    const admin = await this.getAdmin();
    const groupDescriptions = await admin.describeGroups([groupId]);
    const group = groupDescriptions.groups[0];

    if (!group) {
      return null;
    }

    // Map active members and their partition assignments
    const partitionMemberMap = new Map<string, { memberId: string; clientId: string }>();
    const assignedTopicsSet = new Set<string>();

    for (const member of group.members || []) {
      const assignments = member.memberAssignment
        ? decodeMemberAssignment(member.memberAssignment as Buffer)
        : [];

      for (const assignment of assignments) {
        assignedTopicsSet.add(assignment.topic);
        for (const p of assignment.partitions) {
          partitionMemberMap.set(`${assignment.topic}:${p}`, {
            memberId: member.memberId,
            clientId: member.clientId,
          });
        }
      }
    }

    // Determine relevant topics
    let topicsToCheck: string[];
    if (targetTopics && targetTopics.length > 0) {
      topicsToCheck = targetTopics;
    } else {
      const allClusterTopics = await admin.listTopics();
      topicsToCheck = allClusterTopics.filter((t) => !t.startsWith('__'));
    }

    // Fetch committed offsets for all candidate topics
    const groupOffsets = await admin.fetchOffsets({
      groupId,
      topics: topicsToCheck,
    });

    const topicLagDetails: TopicLagDetail[] = [];
    let groupTotalLag = 0;
    let hasUnassignedWithLag = false;

    for (const topic of topicsToCheck) {
      const isAssigned = assignedTopicsSet.has(topic);
      const targetGroupOffset = groupOffsets.find((g) => g.topic === topic);

      // Check if group has committed any offsets on this topic
      const hasCommittedOffsets = (targetGroupOffset?.partitions || []).some(
        (p) => p.offset !== '-1' && p.offset !== ''
      );

      // If targetTopics was not explicitly specified, ignore topics without assignments or prior commits
      if (!targetTopics && !isAssigned && !hasCommittedOffsets) {
        continue;
      }

      let topicLogEndOffsets: Array<{ partition: number; offset: string }> = [];
      try {
        topicLogEndOffsets = await admin.fetchTopicOffsets(topic);
      } catch {
        continue;
      }

      let topicTotalLag = 0;
      const partitions: PartitionLagDetail[] = [];

      for (const tOffset of topicLogEndOffsets) {
        const partitionId = tOffset.partition;
        const gOffset = targetGroupOffset?.partitions.find((p) => p.partition === partitionId);

        const highWatermark = BigInt(tOffset.offset);
        const committedOffsetStr = gOffset?.offset ?? '-1';
        const committed = committedOffsetStr !== '-1' && committedOffsetStr !== ''
          ? BigInt(committedOffsetStr)
          : 0n;

        const lag = Number(highWatermark >= committed ? highWatermark - committed : 0n);
        topicTotalLag += lag;

        const assignmentKey = `${topic}:${partitionId}`;
        const assignmentInfo = partitionMemberMap.get(assignmentKey);
        const isPartitionAssigned = Boolean(assignmentInfo);

        if (!isPartitionAssigned && lag > 0) {
          hasUnassignedWithLag = true;
        }

        partitions.push({
          partition: partitionId,
          logEndOffset: tOffset.offset,
          committedOffset: committedOffsetStr,
          lag,
          isAssigned: isPartitionAssigned,
          assignedMemberId: assignmentInfo?.memberId,
          assignedClientId: assignmentInfo?.clientId,
        });
      }

      partitions.sort((a, b) => a.partition - b.partition);

      groupTotalLag += topicTotalLag;
      topicLagDetails.push({
        topic,
        partitions,
        topicLag: topicTotalLag,
      });
    }

    const membersCount = group.members?.length || 0;
    const isStalled = (groupTotalLag > 0 && membersCount === 0) || hasUnassignedWithLag;

    return {
      groupId,
      state: group.state,
      membersCount,
      totalLag: groupTotalLag,
      isStalled,
      hasUnassignedPartitionsWithLag: hasUnassignedWithLag,
      topics: topicLagDetails.sort((a, b) => a.topic.localeCompare(b.topic)),
    };
  }

  /**
   * Computes lag summaries across all known consumer groups in the Kafka cluster.
   */
  public async getAllConsumerGroupsLag(): Promise<ConsumerGroupLagSummary[]> {
    const admin = await this.getAdmin();
    const { groups: listedGroups } = await admin.listGroups();

    if (!listedGroups || listedGroups.length === 0) {
      return [];
    }

    const summaries: ConsumerGroupLagSummary[] = [];

    for (const g of listedGroups) {
      try {
        const lagSummary = await this.getConsumerGroupLag(g.groupId);
        if (lagSummary && lagSummary.topics.length > 0) {
          summaries.push(lagSummary);
        }
      } catch {
        // Skip inaccessible groups
      }
    }

    return summaries.sort((a, b) => b.totalLag - a.totalLag);
  }
}
