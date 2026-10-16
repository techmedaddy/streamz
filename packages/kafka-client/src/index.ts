import { Kafka, logLevel, Producer, Consumer, EachMessagePayload, Admin, Partitioners } from 'kafkajs';
import { EventEnvelope } from '@streamz/contracts';

export * from './idempotency.js';
export * from './dlq.js';

export interface KafkaConfigOptions {
  clientId: string;
  brokers?: string[];
}

export class ResilientKafkaClient {
  public readonly kafka: Kafka;
  public readonly clientId: string;
  private producer: Producer | null = null;
  private consumers: Consumer[] = [];
  private admin: Admin | null = null;

  constructor(options: KafkaConfigOptions) {
    this.clientId = options.clientId;
    const brokers = options.brokers ?? [process.env.KAFKA_BROKERS || 'localhost:9094'];

    this.kafka = new Kafka({
      clientId: this.clientId,
      brokers,
      logLevel: logLevel.INFO,
      retry: {
        initialRetryTime: 300,
        retries: 8,
      },
    });

    this.setupGracefulShutdown();
  }

  public async getProducer(): Promise<Producer> {
    if (!this.producer) {
      this.producer = this.kafka.producer({
        createPartitioner: Partitioners.DefaultPartitioner,
        allowAutoTopicCreation: true,
        idempotent: true, // Kafka producer idempotence
      });
      await this.producer.connect();
    }
    return this.producer;
  }

  public async getAdmin(): Promise<Admin> {
    if (!this.admin) {
      this.admin = this.kafka.admin();
      await this.admin.connect();
    }
    return this.admin;
  }

  public async sendEvent<T>(topic: string, envelope: EventEnvelope<T>): Promise<void> {
    const producer = await this.getProducer();
    const key = envelope.aggregateId;
    const value = JSON.stringify(envelope);

    await producer.send({
      topic,
      messages: [
        {
          key,
          value,
          headers: {
            eventId: envelope.eventId,
            eventType: envelope.eventType,
            correlationId: envelope.correlationId,
            occurredAt: envelope.occurredAt,
          },
        },
      ],
    });
  }

  public async createConsumer(
    groupId: string,
    options?: { sessionTimeout?: number; heartbeatInterval?: number }
  ): Promise<Consumer> {
    const consumer = this.kafka.consumer({
      groupId,
      sessionTimeout: options?.sessionTimeout ?? 30000,
      heartbeatInterval: options?.heartbeatInterval ?? 3000,
      allowAutoTopicCreation: true,
    });
    await consumer.connect();
    this.consumers.push(consumer);
    return consumer;
  }

  public async commitMessageOffset(
    consumer: Consumer,
    topic: string,
    partition: number,
    offset: string
  ): Promise<void> {
    const nextOffset = (BigInt(offset) + 1n).toString();
    await consumer.commitOffsets([
      {
        topic,
        partition,
        offset: nextOffset,
      },
    ]);
  }

  public async fetchCommittedOffset(
    groupId: string,
    topic: string,
    partition: number
  ): Promise<string | null> {
    const admin = await this.getAdmin();
    const offsets = await admin.fetchOffsets({ groupId, topics: [topic] });
    const topicOffsets = offsets.find((o) => o.topic === topic);
    const partitionOffset = topicOffsets?.partitions.find((p) => p.partition === partition);
    return partitionOffset?.offset ?? null;
  }

  public async fetchConsumerGroupLag(
    groupId: string,
    topic: string
  ): Promise<{
    partitions: Array<{
      partition: number;
      logEndOffset: string;
      committedOffset: string;
      lag: number;
    }>;
    totalLag: number;
  }> {
    const admin = await this.getAdmin();
    const topicOffsets = await admin.fetchTopicOffsets(topic);
    const groupOffsets = await admin.fetchOffsets({ groupId, topics: [topic] });
    const targetGroupOffsets = groupOffsets.find((t) => t.topic === topic);

    let totalLag = 0;
    const partitions = topicOffsets.map((tOffset) => {
      const gOffset = targetGroupOffsets?.partitions.find((p) => p.partition === tOffset.partition);
      const highWatermark = BigInt(tOffset.offset);
      const committed = gOffset?.offset && gOffset.offset !== '-1' ? BigInt(gOffset.offset) : 0n;
      const lag = Number(highWatermark >= committed ? highWatermark - committed : 0n);
      totalLag += lag;

      return {
        partition: tOffset.partition,
        logEndOffset: tOffset.offset,
        committedOffset: gOffset?.offset ?? '-1',
        lag,
      };
    });

    return { partitions, totalLag };
  }

  public async disconnectAll(): Promise<void> {
    if (this.producer) {
      await this.producer.disconnect();
      this.producer = null;
    }
    for (const consumer of this.consumers) {
      await consumer.disconnect();
    }
    this.consumers = [];
    if (this.admin) {
      await this.admin.disconnect();
      this.admin = null;
    }
  }

  private setupGracefulShutdown(): void {
    const shutdown = async () => {
      console.log(`[${this.clientId}] Shutting down Kafka connections gracefully...`);
      await this.disconnectAll();
    };

    process.once('SIGINT', shutdown);
    process.once('SIGTERM', shutdown);
  }
}
