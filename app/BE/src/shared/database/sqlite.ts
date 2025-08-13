export function getDb(): never {
  throw new Error('SQLite is removed. Use Postgres with POSTGRES_URL.');
}


