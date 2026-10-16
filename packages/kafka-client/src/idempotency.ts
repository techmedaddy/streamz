import pg from 'pg';
const { Pool } = pg;
type PoolClient = pg.PoolClient;

export interface IdempotentResult<T> {
  executed: boolean;
  result?: T;
}

/**
 * Executes a database operation with atomic inbox deduplication.
 * Ensures the business operation and the event record are committed together in one transaction.
 * If the event has already been processed by this consumer group, the operation is skipped.
 */
export async function executeIdempotentTransaction<T>(
  pool: pg.Pool,
  eventId: string,
  consumerGroup: string,
  operation: (client: PoolClient) => Promise<T>
): Promise<IdempotentResult<T>> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Atomic insertion check in processed_events
    const dedupeRes = await client.query(
      `INSERT INTO processed_events (event_id, consumer_group, processed_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (event_id, consumer_group) DO NOTHING
       RETURNING event_id`,
      [eventId, consumerGroup]
    );

    // If rowCount === 0, another consumer/thread has already processed this event
    if ((dedupeRes.rowCount ?? 0) === 0) {
      await client.query('ROLLBACK');
      return { executed: false };
    }

    // 2. Execute business logic inside the same transaction
    const result = await operation(client);

    // 3. Atomically commit both business effect and deduplication entry
    await client.query('COMMIT');
    return { executed: true, result };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
