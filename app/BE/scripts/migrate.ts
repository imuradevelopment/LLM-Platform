import { Pool } from 'pg';
import fs from 'node:fs';
import path from 'node:path';

const DIALECT = 'postgres';
const MIGRATIONS_DIR = path.resolve(process.cwd(), 'db', 'migrations');

function ensureDir(p: string) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

async function main() {
  ensureDir(MIGRATIONS_DIR);

  const migrations = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  const connectionString = process.env.POSTGRES_URL;
  if (!connectionString) throw new Error('Missing required env: POSTGRES_URL');
  const pool = new Pool({ connectionString });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // 1) migrations テーブルの確保
    await client.query('CREATE TABLE IF NOT EXISTS __migrations__ (id SERIAL PRIMARY KEY, name TEXT UNIQUE NOT NULL, applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)');
    const appliedRes = await client.query('SELECT name FROM __migrations__');
    const applied = new Set<string>(appliedRes.rows.map((r: any) => r.name));
    for (const file of migrations) {
      if (applied.has(file)) continue;
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf-8');
      await client.query(sql);
      await client.query('INSERT INTO __migrations__ (name) VALUES ($1)', [file]);
      // eslint-disable-next-line no-console
      console.log(`Applied migration: ${file}`);
    }
    // 2) ベーステーブル作成後の付加変更（前方互換）
    await client.query('ALTER TABLE IF EXISTS chats ADD COLUMN IF NOT EXISTS summary TEXT');
    await client.query('ALTER TABLE IF EXISTS messages ADD COLUMN IF NOT EXISTS meta JSONB');
    await client.query('CREATE TABLE IF NOT EXISTS documents (id SERIAL PRIMARY KEY, user_id INTEGER, title TEXT, source TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (user_id) REFERENCES users(id))');
    await client.query('CREATE INDEX IF NOT EXISTS idx_documents_user_id ON documents(user_id)');
    await client.query('CREATE TABLE IF NOT EXISTS doc_chunks (id SERIAL PRIMARY KEY, document_id INTEGER NOT NULL, idx INTEGER, content TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (document_id) REFERENCES documents(id))');
    await client.query('CREATE INDEX IF NOT EXISTS idx_doc_chunks_document_id ON doc_chunks(document_id)');
    await client.query('CREATE TABLE IF NOT EXISTS doc_embeddings (id SERIAL PRIMARY KEY, chunk_id INTEGER NOT NULL, provider TEXT, model TEXT, dims INTEGER, embedding JSONB, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (chunk_id) REFERENCES doc_chunks(id))');
    await client.query('CREATE INDEX IF NOT EXISTS idx_doc_embeddings_chunk_id ON doc_embeddings(chunk_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_doc_embeddings_provider_model ON doc_embeddings(provider, model)');
    // 3) 制約強化（NOT NULLやFKのCASCADE、インデックス追加）
    await client.query("ALTER TABLE IF EXISTS messages ALTER COLUMN role SET NOT NULL");
    await client.query("ALTER TABLE IF EXISTS messages ALTER COLUMN content SET NOT NULL");
    await client.query("ALTER TABLE IF EXISTS messages ALTER COLUMN chat_id SET NOT NULL");
    // FKを付け直すのは破壊的になり得るので、まず存在すれば一旦削除→再作成（ベストエフォート）
    try { await client.query('ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_chat_id_fkey'); } catch {}
    await client.query('ALTER TABLE messages ADD CONSTRAINT messages_chat_id_fkey FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE');
    // 取得クエリ最適化
    await client.query('CREATE INDEX IF NOT EXISTS idx_messages_chat_id_id ON messages(chat_id, id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_chats_user_id_id ON chats(user_id, id)');
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
    await pool.end();
  }
}

main();


