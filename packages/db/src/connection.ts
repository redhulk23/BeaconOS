import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema/index.js";

let _pool: pg.Pool | null = null;
let _db: NodePgDatabase<typeof schema> | null = null;

export function getPool(): pg.Pool {
  if (!_pool) {
    _pool = new pg.Pool({
      connectionString:
        process.env.DATABASE_URL ??
        "postgresql://beacon:beacon_dev@localhost:5432/beacon_os",
      max: 20,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });
  }
  return _pool;
}

export function getDb(): NodePgDatabase<typeof schema> {
  if (!_db) {
    _db = drizzle(getPool(), { schema });
  }
  return _db;
}

export async function closeDb(): Promise<void> {
  if (_pool) {
    await _pool.end();
    _pool = null;
    _db = null;
  }
}

export type Database = NodePgDatabase<typeof schema>;
