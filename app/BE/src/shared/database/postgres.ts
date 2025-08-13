import { Pool } from 'pg';

let pgPool: Pool | null = null;

export function getPgPool(): Pool {
  if (pgPool) return pgPool;
  const connectionString = process.env.POSTGRES_URL;
  if (!connectionString) throw new Error('Missing required env: POSTGRES_URL');
  pgPool = new Pool({ connectionString });
  return pgPool;
}


