import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

// DBML -> SQL generator using @dbml/cli
// Dialect: postgres

function main() {
  const dbmlPath = path.resolve(process.cwd(), 'db', 'database.dbml');
  const outPath = path.resolve(process.cwd(), 'db', 'migrations', '000_init.sql');

  if (!fs.existsSync(dbmlPath)) {
    console.error(`DBML not found: ${dbmlPath}`);
    process.exit(1);
  }

  fs.mkdirSync(path.dirname(outPath), { recursive: true });

  // Prefer local binary
  const bin = path.resolve(process.cwd(), 'node_modules', '.bin', process.platform === 'win32' ? 'dbml2sql.cmd' : 'dbml2sql');
  const args = ['-o', outPath, '-t', 'postgresql', dbmlPath];

  let result = spawnSync(bin, args, { stdio: 'inherit' });

  if (result.error) {
    // Fallback to npx if local bin failed
    console.warn('[dbml-generate] Local dbml2sql not found or failed. Falling back to npx...');
    result = spawnSync('npx', ['-y', '@dbml/cli', 'dbml2sql', ...args], { stdio: 'inherit', shell: true });
  }

  if ((result.status ?? 0) !== 0) {
    console.error('[dbml-generate] Failed to generate SQL from DBML. Using minimal fallback SQL.');
    const fallback = `CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE,
  password_hash TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS chats (
  id SERIAL PRIMARY KEY,
  user_id INTEGER,
  title TEXT,
  summary TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS messages (
  id SERIAL PRIMARY KEY,
  chat_id INTEGER NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  meta JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (chat_id) REFERENCES chats(id)
);

CREATE TABLE IF NOT EXISTS documents (
  id SERIAL PRIMARY KEY,
  user_id INTEGER,
  title TEXT,
  source TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS doc_chunks (
  id SERIAL PRIMARY KEY,
  document_id INTEGER,
  idx INTEGER,
  content TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (document_id) REFERENCES documents(id)
);

CREATE TABLE IF NOT EXISTS doc_embeddings (
  id SERIAL PRIMARY KEY,
  chunk_id INTEGER,
  provider TEXT,
  model TEXT,
  dims INTEGER,
  embedding JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (chunk_id) REFERENCES doc_chunks(id)
);

CREATE INDEX IF NOT EXISTS idx_chats_user_id ON chats(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_documents_user_id ON documents(user_id);
CREATE INDEX IF NOT EXISTS idx_doc_chunks_document_id ON doc_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_doc_embeddings_chunk_id ON doc_embeddings(chunk_id);
CREATE INDEX IF NOT EXISTS idx_doc_embeddings_provider_model ON doc_embeddings(provider, model);
`;
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, fallback);
    console.log(`[dbml-generate] Wrote fallback SQL: ${outPath}`);
    return;
  }

  // Post-process: normalize types for Postgres (in case generator outputs dialect-agnostic types)
  try {
    let sql = fs.readFileSync(outPath, 'utf-8');
    // Normalize DATETIME -> TIMESTAMP
    sql = sql.replace(/\bDATETIME\b/gi, 'TIMESTAMP');
    // Ensure CURRENT_TIMESTAMP is acceptable (already fine for Postgres)
    fs.writeFileSync(outPath, sql);
  } catch (e) {
    console.warn('[dbml-generate] Post-process failed (non-fatal):', (e as Error)?.message || e);
  }

  console.log(`Generated (postgres): ${outPath}`);
}

main();


