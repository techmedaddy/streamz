import { z } from 'zod';
import { EventEnvelope, EventEnvelopeSchema } from './envelope.js';

// --- Order Created Event ---
export const OrderCreatedPayloadSchema = z.object({
  orderId: z.string().min(1),
  customerId: z.string().min(1),
  productId: z.string().min(1),
  quantity: z.number().int().positive(),
  totalPrice: z.number().positive(),
});
export type OrderCreatedPayload = z.infer<typeof OrderCreatedPayloadSchema>;
export const OrderCreatedEventSchema = EventEnvelopeSchema(OrderCreatedPayloadSchema);
export type OrderCreatedEvent = EventEnvelope<OrderCreatedPayload>;

// --- Inventory Reserved Event ---
export const InventoryReservedPayloadSchema = z.object({
  orderId: z.string().min(1),
  productId: z.string().min(1),
  quantity: z.number().int().positive(),
  reservationId: z.string().min(1),
  reservedAt: z.string().datetime(),
});
export type InventoryReservedPayload = z.infer<typeof InventoryReservedPayloadSchema>;
export const InventoryReservedEventSchema = EventEnvelopeSchema(InventoryReservedPayloadSchema);
export type InventoryReservedEvent = EventEnvelope<InventoryReservedPayload>;

// --- Inventory Rejected Event ---
export const InventoryRejectedPayloadSchema = z.object({
  orderId: z.string().min(1),
  productId: z.string().min(1),
  requestedQuantity: z.number().int().positive(),
  availableQuantity: z.number().int().nonnegative(),
  reason: z.string().min(1),
  rejectedAt: z.string().datetime(),
});
export type InventoryRejectedPayload = z.infer<typeof InventoryRejectedPayloadSchema>;
export const InventoryRejectedEventSchema = EventEnvelopeSchema(InventoryRejectedPayloadSchema);
export type InventoryRejectedEvent = EventEnvelope<InventoryRejectedPayload>;

// --- Stock Updated Event ---
export const StockUpdatedPayloadSchema = z.object({
  productId: z.string().min(1),
  previousStock: z.number().int(),
  newStock: z.number().int(),
  updatedAt: z.string().datetime(),
});
export type StockUpdatedPayload = z.infer<typeof StockUpdatedPayloadSchema>;
export const StockUpdatedEventSchema = EventEnvelopeSchema(StockUpdatedPayloadSchema);
export type StockUpdatedEvent = EventEnvelope<StockUpdatedPayload>;

// --- Order Confirmed Event ---
export const OrderConfirmedPayloadSchema = z.object({
  orderId: z.string().min(1),
  customerId: z.string().min(1),
  totalPrice: z.number().positive(),
  confirmedAt: z.string().datetime(),
});
export type OrderConfirmedPayload = z.infer<typeof OrderConfirmedPayloadSchema>;
export const OrderConfirmedEventSchema = EventEnvelopeSchema(OrderConfirmedPayloadSchema);
export type OrderConfirmedEvent = EventEnvelope<OrderConfirmedPayload>;

// --- Order Rejected Event ---
export const OrderRejectedPayloadSchema = z.object({
  orderId: z.string().min(1),
  customerId: z.string().min(1),
  reason: z.string().min(1),
  rejectedAt: z.string().datetime(),
});
export type OrderRejectedPayload = z.infer<typeof OrderRejectedPayloadSchema>;
export const OrderRejectedEventSchema = EventEnvelopeSchema(OrderRejectedPayloadSchema);
export type OrderRejectedEvent = EventEnvelope<OrderRejectedPayload>;

// --- Dead Letter Queue Event ---
export const NotificationDlqPayloadSchema = z.object({
  originalTopic: z.string().min(1),
  originalKey: z.string().nullable(),
  originalPayload: z.unknown(),
  errorMessage: z.string().min(1),
  errorStack: z.string().optional(),
  retryCount: z.number().int().nonnegative(),
  failedAt: z.string().datetime(),
});
export type NotificationDlqPayload = z.infer<typeof NotificationDlqPayloadSchema>;
export const NotificationDlqEventSchema = EventEnvelopeSchema(NotificationDlqPayloadSchema);
export type NotificationDlqEvent = EventEnvelope<NotificationDlqPayload>;
