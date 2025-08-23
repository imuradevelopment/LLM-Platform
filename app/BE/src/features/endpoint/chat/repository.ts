import { isPostgres } from '../../../shared/database';
import { getPgPool } from '../../../shared/database/postgres';
import { debugLog } from '../../../shared/logger';

export interface ChatRecord {
  id: number;
  user_id: number | null;
  title: string | null;
  summary?: string | null;
  created_at: string;
  updated_at?: string;
}

export interface MessageRecord {
  id: number;
  chat_id: number;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at: string;
}

export async function createChatIfNotExists(userId?: number | null, chatId?: number | null): Promise<number> {
  const pool = getPgPool();
  // Validate userId if provided
  if (userId != null) {
    const u = await pool.query('SELECT 1 FROM users WHERE id = $1', [userId]);
    if (u.rowCount === 0) {
      const err = new Error('USER_NOT_FOUND');
      (err as any).code = 'USER_NOT_FOUND';
      throw err;
    }
  }
  if (chatId) {
    const { rows } = await pool.query('SELECT id FROM chats WHERE id = $1 AND (user_id IS NULL OR user_id = $2) LIMIT 1', [
      Number(chatId),
      userId ?? null,
    ]);
    if (rows.length > 0) return Number(chatId);
  }
  const { rows } = await pool.query('INSERT INTO chats (user_id, title) VALUES ($1, $2) RETURNING id', [userId ?? null, null]);
  debugLog('repository: chat created', { userId, id: rows[0]?.id });
  return Number(rows[0]?.id || 0);
}

export async function insertMessage(chatId: number, role: 'user' | 'assistant' | 'system', content: string): Promise<number> {
  const pool = getPgPool();
  const { rows } = await pool.query('INSERT INTO messages (chat_id, role, content) VALUES ($1, $2, $3) RETURNING id', [
    Number(chatId),
    role,
    content,
  ]);
  // touch chats.updated_at if column exists (best-effort)
  try {
    await pool.query('UPDATE chats SET updated_at = CURRENT_TIMESTAMP WHERE id = $1', [Number(chatId)]);
  } catch {}
  debugLog('repository: message inserted', { chatId, role, length: content.length, id: rows[0]?.id });
  return Number(rows[0]?.id || 0);
}

export async function setTitleIfEmpty(chatId: number, title: string): Promise<void> {
  const pool = getPgPool();
  if (!title) return;
  await pool.query("UPDATE chats SET title = $1 WHERE id = $2 AND (title IS NULL OR title = '')", [title, chatId]);
}

export async function listChatsByUser(userId: number): Promise<ChatRecord[]> {
  const pool = getPgPool();
  const { rows } = await pool.query(
    'SELECT id, user_id, title, summary, created_at FROM chats WHERE user_id = $1 ORDER BY id DESC',
    [userId]
  );
  return rows as ChatRecord[];
}

export async function getMessagesByChat(chatId: number, userId: number): Promise<MessageRecord[]> {
  const pool = getPgPool();
  const ok = await pool.query('SELECT 1 FROM chats WHERE id = $1 AND user_id = $2', [chatId, userId]);
  if (!ok.rows.length) return [];
  const { rows } = await pool.query(
    'SELECT id, chat_id, role, content, created_at FROM messages WHERE chat_id = $1 ORDER BY id ASC',
    [chatId]
  );
  return rows as MessageRecord[];
}


export async function renameChat(chatId: number, userId: number, title: string): Promise<boolean> {
  const pool = getPgPool();
  const result = await pool.query('UPDATE chats SET title = $1 WHERE id = $2 AND user_id = $3', [
    title,
    chatId,
    userId,
  ]);
  return (result.rowCount ?? 0) > 0;
}

export async function deleteChat(chatId: number, userId: number): Promise<boolean> {
  const pool = getPgPool();
  const ok = await pool.query('SELECT 1 FROM chats WHERE id = $1 AND user_id = $2', [chatId, userId]);
  if (!ok.rows.length) return false;
  await pool.query('DELETE FROM messages WHERE chat_id = $1', [chatId]);
  const result = await pool.query('DELETE FROM chats WHERE id = $1', [chatId]);
  return (result.rowCount ?? 0) > 0;
}

export async function getChatSummary(chatId: number, userId: number): Promise<string | null> {
  const pool = getPgPool();
  const { rows } = await pool.query('SELECT summary FROM chats WHERE id = $1 AND user_id = $2 LIMIT 1', [chatId, userId]);
  if (!rows.length) return null;
  const value = rows[0]?.summary;
  return typeof value === 'string' ? value : (value == null ? null : String(value));
}

export async function setChatSummary(chatId: number, userId: number, summary: string): Promise<boolean> {
  const pool = getPgPool();
  const result = await pool.query('UPDATE chats SET summary = $1 WHERE id = $2 AND user_id = $3', [summary, chatId, userId]);
  return (result.rowCount ?? 0) > 0;
}



