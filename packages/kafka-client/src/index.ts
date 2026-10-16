import { Kafka, logLevel, Producer, Consumer, EachMessagePayload, Admin } from 'kafkajs';
import { EventEnvelope } from '@streamz/contracts';

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

  public async createConsumer(groupId: string): Promise<Consumer> {
    const consumer = this.kafka.consumer({
      groupId,
      sessionTimeout: 30000,
      heartbeatInterval: 3000,
      allowAutoTopicCreation: true,
    });
    await consumer.connect();
    this.consumers.push(consumer);
    return consumer;
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
