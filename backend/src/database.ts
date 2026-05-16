import { Pool, PoolClient } from 'pg';
import { config } from './config';

export const db = new Pool({
  connectionString: config.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Transaction helper
export async function withTransaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// Query helper with logging
export async function query(text: string, params?: any[]) {
  const start = Date.now();
  const result = await db.query(text, params);
  const duration = Date.now() - start;
  
  if (duration > 100) {
    console.log('Slow query:', { text: text.substring(0, 100), duration, rows: result.rowCount });
  }
  
  return result;
}

// Listen for notifications (for real-time features)
export async function listen(channel: string, callback: (payload: string) => void) {
  const client = await db.connect();
  await client.query(`LISTEN ${channel}`);
  
  client.on('notification', (msg) => {
    if (msg.channel === channel && msg.payload) {
      callback(msg.payload);
    }
  });
  
  return () => {
    client.query(`UNLISTEN ${channel}`);
    client.release();
  };
}
