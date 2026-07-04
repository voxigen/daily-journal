import 'server-only';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from './schema';

// Reuse the pool across Next.js hot reloads in dev so we don't leak connections.
const globalForDb = globalThis as unknown as { _pgPool?: Pool };

const pool =
  globalForDb._pgPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5,
  });

if (process.env.NODE_ENV !== 'production') globalForDb._pgPool = pool;

export const db = drizzle(pool, { schema });
export { schema };
