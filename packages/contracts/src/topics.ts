export const TOPICS = {
  ORDERS: 'orders',
  INVENTORY_EVENTS: 'inventory-events',
  ORDER_EVENTS: 'order-events',
  NOTIFICATIONS_DLQ: 'notifications-dlq',
  TELEMETRY_SPANS: 'telemetry-spans',
} as const;

export type TopicName = (typeof TOPICS)[keyof typeof TOPICS];
