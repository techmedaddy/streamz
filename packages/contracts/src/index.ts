export * from './topics.js';
export * from './envelope.js';
export * from './events.js';

// Helper to determine partition key
export function getEventPartitionKey(envelope: { aggregateId: string }): string {
  return envelope.aggregateId;
}
