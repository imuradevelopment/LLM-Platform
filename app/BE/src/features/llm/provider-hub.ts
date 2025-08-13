import type { CoreMessage } from 'ai';

export type Provider = 'gemini' | 'azure-openai';

// 簡易コンテキスト長テーブル（将来は最新情報に更新する）
const CONTEXT_WINDOW_TABLE: Record<string, number> = {
  // Azure OpenAI (gpt-4o 系)
  'azure-openai:gpt-4o': 128_000,
  'azure-openai:gpt-4o-2': 128_000,
  // Gemini
  'gemini:gemini-2.5-pro': 1_000_000,
  'gemini:gemini-2.5-flash': 1_000_000,
  'gemini:gemini-1.5-flash': 1_000_000,
};

export function getContextWindow(provider: Provider, modelIdRaw?: string): number {
  const model = (modelIdRaw || '').replace(/^models\//, '');
  const key = `${provider}:${model || (provider === 'azure-openai' ? 'gpt-4o' : 'gemini-2.5-pro')}`;
  return CONTEXT_WINDOW_TABLE[key] || (provider === 'azure-openai' ? 128_000 : 1_000_000);
}

// トークン見積もり（軽量近似）。可能なら将来、各SDKの countTokens を使用。
export function estimatePromptTokens(provider: Provider, modelIdRaw: string | undefined, texts: string[]): number {
  const text = texts.join('\n');
  const length = text.length;
  if (provider === 'azure-openai') {
    // gpt-4o 近似: 1 token ≈ 4 chars
    return Math.ceil(length / 4);
  }
  // Gemini 近似: 1 token ≈ 3 chars（暫定）
  return Math.ceil(length / 3);
}

export function computeMaxOutputTokens(args: {
  contextWindow: number;
  promptTokens: number;
  ratioCap?: number; // 0.25 など
  absCap?: number; // 8192 など
  safeMargin?: number; // 256 など
  minGuarantee?: number; // 512 など
}): number {
  const contextWindow = Math.max(1, Math.floor(args.contextWindow || 0));
  const promptTokens = Math.max(0, Math.floor(args.promptTokens || 0));
  const ratioCap = Number.isFinite(args.ratioCap as number) ? (args.ratioCap as number) : 0.25;
  const absCap = Math.max(1, Math.floor((args.absCap as number) || 8192));
  const safeMargin = Math.max(0, Math.floor((args.safeMargin as number) || 256));
  const minGuarantee = Math.max(1, Math.floor((args.minGuarantee as number) || 512));

  const remaining = Math.max(0, contextWindow - promptTokens - safeMargin);
  const byRatio = Math.floor(contextWindow * ratioCap);
  const maxTokens = Math.max(minGuarantee, Math.min(remaining, absCap, byRatio));
  return maxTokens;
}

export function normalizeGenParams(provider: Provider, base: { temperature?: number; topP?: number; topK?: number }) {
  const out: Record<string, number> = {};
  if (typeof base.temperature === 'number') out.temperature = base.temperature;
  if (typeof base.topP === 'number') out.topP = base.topP;
  if (provider === 'gemini' && typeof base.topK === 'number') out.topK = base.topK; // Azureはtop_k非対応
  return out;
}


