'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface Product {
  id: string;
  sku: string;
  name: string;
  price: string;
  stock_quantity: number;
  reserved_quantity: number;
  created_at: string;
  updated_at: string;
}

export interface Order {
  id: string;
  customer_id: string;
  product_id: string;
  quantity: number;
  total_amount: string;
  status: 'PENDING' | 'CONFIRMED' | 'REJECTED';
  rejection_reason?: string;
  created_at: string;
  updated_at: string;
}

export interface KafkaPipelineStep {
  id: string;
  orderId: string;
  step: number;
  label: string;
  detail: string;
  status: 'pending' | 'active' | 'done' | 'error';
  timestamp: number;
  topic?: string;
  partition?: number;
  eventType?: string;
}

// ── Murmur2 Partition Hash (matching KafkaJS default partitioner) ─────────────

function murmur2(str: string): number {
  let h = 0x9747b28c;
  const len = str.length;
  for (let i = 0; i < len; i++) {
    const k = str.charCodeAt(i);
    h = Math.imul(h ^ k, 0x5bd1e995);
    h ^= h >>> 13;
    h = Math.imul(h, 0x5bd1e995);
  }
  h ^= len;
  h ^= h >>> 13;
  h = Math.imul(h, 0x5bd1e995);
  h ^= h >>> 15;
  return h >>> 0;
}

export function computePartition(key: string, numPartitions = 3): { hash: number; partition: number } {
  const hash = murmur2(key);
  const partition = hash % numPartitions;
  return { hash, partition };
}

// ── API Base URLs ──────────────────────────────────────────────────────────────

const ORDER_SERVICE_URL = process.env.NEXT_PUBLIC_ORDER_SERVICE_URL || (typeof window !== 'undefined' ? '/api' : 'http://localhost:3001');
const INVENTORY_SERVICE_URL = process.env.NEXT_PUBLIC_INVENTORY_SERVICE_URL || (typeof window !== 'undefined' ? '/api' : 'http://localhost:3002');

// ── Hook ───────────────────────────────────────────────────────────────────────

export function useInventoryApi() {
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [pipelineSteps, setPipelineSteps] = useState<KafkaPipelineStep[]>([]);
  const [loading, setLoading] = useState(false);
  const [orderPlacing, setOrderPlacing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [servicesOnline, setServicesOnline] = useState({ orders: false, inventory: false });

  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const pipelineIdRef = useRef(0);

  // Fetch products from inventory-service
  const fetchProducts = useCallback(async () => {
    try {
      const res = await fetch(`${INVENTORY_SERVICE_URL}/products`);
      if (res.ok) {
        const data = await res.json();
        setProducts(data);
        setServicesOnline((prev) => ({ ...prev, inventory: true }));
      }
    } catch {
      setServicesOnline((prev) => ({ ...prev, inventory: false }));
    }
  }, []);

  // Fetch orders from order-service
  const fetchOrders = useCallback(async () => {
    try {
      const res = await fetch(`${ORDER_SERVICE_URL}/orders`);
      if (res.ok) {
        const data = await res.json();
        setOrders(data);
        setServicesOnline((prev) => ({ ...prev, orders: true }));
      }
    } catch {
      setServicesOnline((prev) => ({ ...prev, orders: false }));
    }
  }, []);

  // Poll both services
  const refreshAll = useCallback(async () => {
    await Promise.allSettled([fetchProducts(), fetchOrders()]);
  }, [fetchProducts, fetchOrders]);

  // Initial load and polling
  useEffect(() => {
    refreshAll();
    pollRef.current = setInterval(refreshAll, 2500);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [refreshAll]);

  // Add a pipeline step for Kafka visualization
  const addPipelineStep = useCallback(
    (
      orderId: string,
      step: number,
      label: string,
      detail: string,
      status: KafkaPipelineStep['status'],
      extras?: Partial<KafkaPipelineStep>
    ) => {
      const id = `pipe-${++pipelineIdRef.current}`;
      const newStep: KafkaPipelineStep = {
        id,
        orderId,
        step,
        label,
        detail,
        status,
        timestamp: Date.now(),
        ...extras,
      };
      setPipelineSteps((prev) => [newStep, ...prev.slice(0, 99)]);
      return id;
    },
    []
  );

  // Update a pipeline step status
  const updatePipelineStep = useCallback((id: string, status: KafkaPipelineStep['status'], detail?: string) => {
    setPipelineSteps((prev) =>
      prev.map((s) => (s.id === id ? { ...s, status, ...(detail ? { detail } : {}) } : s))
    );
  }, []);

  // Place an order — the main action with pipeline visualization
  const placeOrder = useCallback(
    async (data: { customerId: string; productId: string; quantity: number }) => {
      setOrderPlacing(true);
      setError(null);

      const product = products.find((p) => p.id === data.productId);
      const productName = product?.name || data.productId;
      const unitPrice = product ? parseFloat(product.price) : 99.99;

      // Step 1: HTTP POST to Order Service
      const step1Id = addPipelineStep(
        '...',
        1,
        'HTTP POST → Order Service',
        `POST /orders { customer: "${data.customerId}", product: "${productName}", qty: ${data.quantity} }`,
        'active',
        { eventType: 'HTTP Request' }
      );

      try {
        const res = await fetch(`${ORDER_SERVICE_URL}/orders`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customerId: data.customerId,
            productId: data.productId,
            quantity: data.quantity,
            unitPrice,
          }),
        });

        if (!res.ok) {
          const errBody = await res.json().catch(() => ({ error: 'Unknown error' }));
          throw new Error(errBody.error || `HTTP ${res.status}`);
        }

        const order = await res.json();
        const orderId = order.id;
        const { hash, partition } = computePartition(orderId);

        updatePipelineStep(
          step1Id,
          'done',
          `Order ${orderId} persisted → status: PENDING, total: $${order.total_amount}`
        );

        // Step 2: Murmur2 partition routing
        addPipelineStep(
          orderId,
          2,
          'Murmur2 Partition Hash',
          `Key="${orderId}" → Murmur2(key)=0x${hash.toString(16).toUpperCase()} mod 3 = Partition ${partition}`,
          'done',
          { partition, eventType: 'Partitioning' }
        );

        // Step 3: Kafka produce → orders topic
        addPipelineStep(
          orderId,
          3,
          'Produce → orders topic',
          `OrderCreated event published to "orders" P${partition}`,
          'done',
          { topic: 'orders', partition, eventType: 'OrderCreated' }
        );

        // Step 4: Consumer group polls
        const step4Id = addPipelineStep(
          orderId,
          4,
          'inventory-service-group consumes',
          `Consumer polls P${partition}, checks processed_events inbox (idempotency), acquires SELECT...FOR UPDATE row lock on product`,
          'active',
          { topic: 'orders', eventType: 'Consuming' }
        );

        // Step 5: Stock evaluation (pending — will resolve when we see order status change)
        const step5Id = addPipelineStep(
          orderId,
          5,
          'Stock Evaluation & Reservation',
          `Evaluating: available = stock_quantity - reserved_quantity ≥ ${data.quantity}?`,
          'active',
          { eventType: 'StockCheck' }
        );

        // Step 6: Response event (pending)
        const step6Id = addPipelineStep(
          orderId,
          6,
          'Response → inventory-events',
          'Waiting for InventoryReserved or InventoryRejected event...',
          'pending',
          { topic: 'inventory-events', eventType: 'Pending' }
        );

        // Step 7: Order status transition (pending)
        const step7Id = addPipelineStep(
          orderId,
          7,
          'Order Status Transition',
          'Waiting for order-service-group to consume inventory response...',
          'pending',
          { eventType: 'Pending' }
        );

        // Step 8: Notification dispatch (pending)
        const step8Id = addPipelineStep(
          orderId,
          8,
          'Notification Dispatch',
          'Waiting for notification-worker-group to dispatch notification...',
          'pending',
          { eventType: 'Pending' }
        );

        // Now poll for order status resolution
        let resolved = false;
        let pollCount = 0;

        const statusPoll = setInterval(async () => {
          pollCount++;
          if (pollCount > 30 || resolved) {
            clearInterval(statusPoll);
            return;
          }

          try {
            const orderRes = await fetch(`${ORDER_SERVICE_URL}/orders/${orderId}`);
            if (orderRes.ok) {
              const updatedOrder = await orderRes.json();

              if (updatedOrder.status === 'CONFIRMED') {
                resolved = true;
                clearInterval(statusPoll);

                updatePipelineStep(step4Id, 'done', `Consumer processed OrderCreated from P${partition}`);
                updatePipelineStep(
                  step5Id,
                  'done',
                  `Stock sufficient → reserved ${data.quantity} units of "${productName}"`
                );
                updatePipelineStep(
                  step6Id,
                  'done',
                  `InventoryReserved published to "inventory-events"`
                );
                updatePipelineStep(
                  step7Id,
                  'done',
                  `Order ${orderId} → CONFIRMED (OrderConfirmed published to "order-events")`
                );
                updatePipelineStep(
                  step8Id,
                  'done',
                  `ORDER_CONFIRMED notification dispatched to customer "${data.customerId}"`
                );
                await refreshAll();
              } else if (updatedOrder.status === 'REJECTED') {
                resolved = true;
                clearInterval(statusPoll);

                const reason = updatedOrder.rejection_reason || 'Insufficient stock';
                updatePipelineStep(step4Id, 'done', `Consumer processed OrderCreated from P${partition}`);
                updatePipelineStep(step5Id, 'error', `Stock insufficient → ${reason}`);
                updatePipelineStep(
                  step6Id,
                  'error',
                  `InventoryRejected published: "${reason}"`
                );
                updatePipelineStep(
                  step7Id,
                  'error',
                  `Order ${orderId} → REJECTED (OrderRejected published to "order-events")`
                );
                updatePipelineStep(
                  step8Id,
                  'done',
                  `ORDER_REJECTED notification dispatched to customer "${data.customerId}"`
                );
                await refreshAll();
              }
            }
          } catch {
            // polling error, continue
          }
        }, 800);

        setOrderPlacing(false);
        return order;
      } catch (err: any) {
        updatePipelineStep(step1Id, 'error', `Failed: ${err.message}`);
        setError(err.message);
        setOrderPlacing(false);
        return null;
      }
    },
    [products, addPipelineStep, updatePipelineStep, refreshAll]
  );

  const clearPipeline = useCallback(() => {
    setPipelineSteps([]);
  }, []);

  return {
    products,
    orders,
    pipelineSteps,
    loading,
    orderPlacing,
    error,
    servicesOnline,
    placeOrder,
    refreshAll,
    clearPipeline,
  };
}
