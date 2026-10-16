-- Notifications Database Schema

CREATE TABLE IF NOT EXISTS notifications (
  id VARCHAR(64) PRIMARY KEY,
  order_id VARCHAR(64) NOT NULL,
  type VARCHAR(32) NOT NULL,
  recipient VARCHAR(128) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'SENT',
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_order ON notifications(order_id);

-- Idempotency / Deduplication Inbox
CREATE TABLE IF NOT EXISTS processed_events (
  event_id VARCHAR(64) NOT NULL,
  consumer_group VARCHAR(64) NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (event_id, consumer_group)
);
