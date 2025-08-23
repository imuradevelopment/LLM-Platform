import { sseToPlainTextTransform } from '../../shared/streaming/sseToPlainText';
import { streamText } from './stream-text';
import type { ChatMessage } from './build-messages';
import { debugLog, debugError } from '../../shared/logger';
import { getChatSummary, setChatSummary } from '../endpoint/chat/repository';

interface UpdateSummaryArgs {
  chatId: number;
  userId: number;
  provider?: 'gemini' | 'azure-openai' | 'openai';
  model?: string;
  lastUserContent: string;
  lastAssistantContent: string;
}

export async function updateRunningSummary(args: UpdateSummaryArgs): Promise<void> {
  try {
    const prev = (await getChatSummary(args.chatId, args.userId)) || '';
    const sys: ChatMessage = {
      role: 'system',
      content:
        'You are a summarizer that maintains a concise Japanese running summary for a chat.\n' +
        '- Output only the updated summary text in Japanese, max 400 characters.\n' +
        '- Keep key facts, tasks, decisions, and user preferences.\n' +
        '- Overwrite the previous summary with a new one that incorporates recent turns.\n',
    };

    const user: ChatMessage = {
      role: 'user',
      content:
        `Previous summary (may be empty):\n${prev}\n\n` +
        `Recent conversation turns to incorporate:\n` +
        `- user: ${args.lastUserContent}\n` +
        `- assistant: ${args.lastAssistantContent}\n\n` +
        `Return only the updated summary text.`,
    };

    const result = await streamText([sys, user], { provider: args.provider, model: args.model }, {});
    const plain = result.toAIStream().pipeThrough(sseToPlainTextTransform());
    const summary = await readStreamToString(plain);
    const normalized = (summary || '').trim();
    if (!normalized) return;
    await setChatSummary(args.chatId, args.userId, normalized);
    debugLog('summary: updated', { chatId: args.chatId, bytes: normalized.length });
  } catch (e) {
    debugError('summary: update failed', e);
  }
}

async function readStreamToString(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let acc = '';
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { done, value } = await reader.read();
    if (value) acc += decoder.decode(value, { stream: true });
    if (done) break;
  }
  // flush
  try { acc += new TextDecoder().decode(); } catch {}
  return acc;
}


