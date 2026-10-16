-- Inventory Database Schema

CREATE TABLE IF NOT EXISTS products (
  id VARCHAR(64) PRIMARY KEY,
  sku VARCHAR(64) UNIQUE NOT NULL,
  name VARCHAR(128) NOT NULL,
  price NUMERIC(10, 2) NOT NULL CHECK (price > 0),
  stock_quantity INT NOT NULL CHECK (stock_quantity >= 0),
  reserved_quantity INT NOT NULL DEFAULT 0 CHECK (reserved_quantity >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT check_available_stock CHECK (stock_quantity >= reserved_quantity)
);

CREATE TABLE IF NOT EXISTS reservations (
  id VARCHAR(64) PRIMARY KEY,
  order_id VARCHAR(64) NOT NULL,
  product_id VARCHAR(64) NOT NULL REFERENCES products(id),
  quantity INT NOT NULL CHECK (quantity > 0),
  status VARCHAR(32) NOT NULL DEFAULT 'RESERVED' CHECK (status IN ('RESERVED', 'RELEASED', 'FULFILLED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reservations_order ON reservations(order_id);
CREATE INDEX IF NOT EXISTS idx_reservations_product ON reservations(product_id);

-- Idempotency / Deduplication Inbox
CREATE TABLE IF NOT EXISTS processed_events (
  event_id VARCHAR(64) NOT NULL,
  consumer_group VARCHAR(64) NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (event_id, consumer_group)
);

-- Seed Initial Inventory Products for testing
INSERT INTO products (id, sku, name, price, stock_quantity, reserved_quantity)
VALUES 
  ('prod-keyboard-rgb', 'KB-RGB-001', 'Pro Mechanical RGB Keyboard', 99.99, 10, 0),
  ('prod-mouse-wireless', 'MS-WLS-002', 'Ultra Precision Wireless Mouse', 49.99, 25, 0),
  ('prod-monitor-4k', 'MN-4K-003', '32-inch 4K Gaming Monitor', 499.99, 5, 0),
  ('prod-limited-edition-gpu', 'GPU-LTD-004', 'Limited Edition RTX GPU', 899.99, 2, 0)
ON CONFLICT (id) DO NOTHING;
