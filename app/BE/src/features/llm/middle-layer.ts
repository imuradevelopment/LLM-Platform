import { getContextWindow, estimatePromptTokens } from './provider-hub';
import type { BuildMessagesOptions, ChatMessage } from './build-messages';
import { getChatSummary } from '../endpoint/chat/repository';
import { retrieveRagSnippets } from './rag';

export interface PrepareModelInputArgs {
  messages: ChatMessage[];
  provider?: 'gemini' | 'azure-openai' | 'openai';
  modelId?: string;
  context?: { chatId?: number | null; userId?: number | null };
}

export interface PrepareModelInputResult {
  messages: ChatMessage[];
  buildOptions: BuildMessagesOptions;
}

export function prepareModelInput(args: PrepareModelInputArgs): PrepareModelInputResult {
  const providerKey: 'gemini' | 'azure-openai' = args.provider === 'azure-openai' ? 'azure-openai' : 'gemini';
  const processed = trimHistoryForTokenBudget(args.messages, providerKey, args.modelId);

  const buildOptions: BuildMessagesOptions = {};
  // 可能ならランニング要約を注入
  // 注入は system role に入るため、プロンプト圧縮に寄与
  if (args.context?.chatId && args.context?.userId) {
    // 非同期を避け、ここでは getChatSummary を同期的に扱うため設計上は同期APIにしたいが、
    // repository は非同期のため、呼び出し元で await できない。中間層は純関数にしたい設計。
    // よって prepareModelInputAsync を用意するのが理想だが、現状はサマリは stream-text 側で注入する。
  }

  return { messages: processed, buildOptions };
}

// 非同期版（summary/RAG取得を行う）。必要箇所から明示的に await して使用する。
export async function prepareModelInputAsync(args: PrepareModelInputArgs): Promise<PrepareModelInputResult> {
  const providerKey: 'gemini' | 'azure-openai' = args.provider === 'azure-openai' ? 'azure-openai' : 'gemini';
  const processed = trimHistoryForTokenBudget(args.messages, providerKey, args.modelId);
  const buildOptions: BuildMessagesOptions = {};
  if (args.context?.chatId && args.context?.userId) {
    try {
      const summary = await getChatSummary(args.context.chatId, args.context.userId);
      if (summary) buildOptions.summary = summary;
    } catch {}
  }
  try {
    const lastUser = [...args.messages].reverse().find((m) => m.role === 'user')?.content || '';
    const rag = await retrieveRagSnippets({
      userId: args.context?.userId || null,
      chatId: args.context?.chatId || null,
      query: lastUser,
      provider: args.provider === 'azure-openai' ? 'azure-openai' : 'gemini',
      modelId: process.env.LLM_PROVIDER === 'azure-openai' ? process.env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT : (process.env.GEMINI_EMBEDDING_MODEL || 'text-embedding-004'),
      topK: 5,
      minScore: 0.2,
    });
    if (rag.length) buildOptions.ragSnippets = rag;
  } catch {}
  return { messages: processed, buildOptions };
}

export function trimHistoryForTokenBudget(
  original: ChatMessage[],
  provider: 'gemini' | 'azure-openai',
  modelIdRaw: string | undefined
): ChatMessage[] {
  const contextWindow = getContextWindow(provider, modelIdRaw);
  const SAFE_MARGIN = 256;
  // ここでは MAX_TOKENS は依存せず、概算で prompt 2/3, output 1/3 を確保する保守的分配に寄せる
  const promptBudget = Math.max(1, Math.floor((contextWindow * 2) / 3) - SAFE_MARGIN);

  const messages = [...original];
  const within = () => estimatePromptTokens(provider, modelIdRaw, messages.map((m) => m.content)) <= promptBudget || messages.length <= 2;

  const lastUserIndex = (() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) if (messages[i].role === 'user') return i;
    return -1;
  })();
  if (lastUserIndex < 0) return messages;

  while (!within()) {
    let dropUser = -1;
    for (let i = 0; i < messages.length; i += 1) {
      if (messages[i].role !== 'user') continue;
      if (i === lastUserIndex) break;
      dropUser = i;
      break;
    }
    if (dropUser === -1) break;
    const toRemove: number[] = [dropUser];
    if (messages[dropUser + 1]?.role === 'assistant') toRemove.push(dropUser + 1);
    toRemove.sort((a, b) => b - a).forEach((idx) => messages.splice(idx, 1));
  }
  return messages;
}


