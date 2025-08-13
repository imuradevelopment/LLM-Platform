import type { CoreMessage } from 'ai';

export type ChatRole = 'system' | 'user' | 'assistant';

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface BuildMessagesOptions {
  includeTitleInstruction?: boolean;
  systemPrompt?: string;
  summary?: string; // 将来: 長期要約
  ragSnippets?: string[]; // 将来: RAG で得た断片
}

// 単純な合成。将来的に短期記憶/要約/RAG をここに差し込む。
export function buildMessages(messages: ChatMessage[], opts?: BuildMessagesOptions): CoreMessage[] {
  const out: CoreMessage[] = [];

  if (opts?.systemPrompt) {
    out.push({ role: 'system', content: opts.systemPrompt });
  }
  if (opts?.summary) {
    out.push({ role: 'system', content: `[Conversation summary]\n${opts.summary}` });
  }
  if (opts?.ragSnippets && opts.ragSnippets.length > 0) {
    const joined = opts.ragSnippets.map((s, i) => `#${i + 1}: ${s}`).join('\n\n');
    out.push({ role: 'system', content: `[Retrieved knowledge]\n${joined}` });
  }

  for (const m of messages) {
    out.push({ role: m.role, content: m.content });
  }
  return out;
}


