import type { Provider } from './provider-hub';
import { embedTexts, cosineSimilarity } from './embeddings';
import { getPgPool } from '../../shared/database/postgres';

interface RetrieveArgs {
  userId: number | null;
  chatId: number | null;
  query: string;
  provider: Exclude<Provider, 'openai'>;
  modelId?: string;
  topK?: number;
  minScore?: number; // 0..1
}

export async function retrieveRagSnippets(args: RetrieveArgs): Promise<string[]> {
  const pool = getPgPool();
  const ownerId = args.userId ?? null;
  const topK = Math.max(1, Math.floor(args.topK ?? 5));
  const minScore = Math.max(0, Math.min(1, Number(args.minScore ?? 0.2)));

  // 1) クエリの埋め込み
  const queryEmbed = await embedTexts({ texts: [args.query], kind: 'query', provider: args.provider, modelId: args.modelId });
  const q = queryEmbed.vectors[0];
  const provider = queryEmbed.provider;
  const model = queryEmbed.model;
  const dims = queryEmbed.dims;

  // 2) 対応する埋め込みをDBから取得（同一 provider, model, dims）
  const res = await pool.query(
    `SELECT c.id as chunk_id, c.content, e.embedding
     FROM doc_embeddings e
     JOIN doc_chunks c ON c.id = e.chunk_id
     JOIN documents d ON d.id = c.document_id
     WHERE d.user_id = $1 AND e.provider = $2 AND e.model = $3 AND e.dims = $4
    `,
    [ownerId, provider, model, dims]
  );

  const rows = res.rows as { chunk_id: number; content: string; embedding: number[] }[];
  if (!rows.length) return [];

  // 3) スコアリング
  const scored = rows.map((r) => ({ content: r.content, score: cosineSimilarity(q, r.embedding || []) }));
  scored.sort((a, b) => b.score - a.score);
  const filtered = scored.filter((s) => s.score >= minScore).slice(0, topK);
  return filtered.map((f) => f.content);
}


