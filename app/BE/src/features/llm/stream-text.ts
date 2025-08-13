import type { CoreMessage, LanguageModelV1 } from 'ai';
import { streamText as aiStreamText } from 'ai';
import { getLanguageModel } from './model';
import { MAX_TOKENS, TEMPERATURE, TOP_P, TOP_K } from './constants';
import { TITLE_INSTRUCTION } from './prompts';
import { debugLog } from '../../shared/logger';
import { buildMessages, type ChatMessage } from './build-messages';
import { computeMaxOutputTokens, estimatePromptTokens, getContextWindow, normalizeGenParams } from './provider-hub';

export type Role = 'system' | 'user' | 'assistant';

export type Message = ChatMessage;

export interface StreamingOptions {
  toolChoice?: 'none';
  onFinish?: (args: { text: string; finishReason?: string }) => Promise<void> | void;
  abortSignal?: AbortSignal;
}

export interface StreamTextResult {
  toAIStream(): ReadableStream<Uint8Array>;
}

export async function streamText(
  messages: Message[],
  env: { includeTitleInstruction?: boolean; provider?: 'gemini' | 'azure-openai' | 'openai'; model?: string; extra?: Record<string, string> } | undefined,
  options?: StreamingOptions
): Promise<StreamTextResult> {
  const model: LanguageModelV1 = getLanguageModel({ provider: env?.provider as any, model: env?.model, extra: env?.extra });

  // Simple approach: use all messages without middle layer processing
  const addTitle = Boolean(env?.includeTitleInstruction);
  const base: CoreMessage[] = buildMessages(messages, {});
  const vercelMessages: CoreMessage[] = addTitle
    ? ([{ role: 'system' as any, content: TITLE_INSTRUCTION }, ...base])
    : base;

  // Provider Hub: prompt token 計測 + maxTokens 自動算出
  const provider = (env?.provider === 'azure-openai' ? 'azure-openai' : 'gemini') as 'gemini' | 'azure-openai';
  const modelId = (env?.model || '').replace(/^models\//, '');
  const contextWindow = getContextWindow(provider, modelId);
  const promptTokens = estimatePromptTokens(provider, modelId, vercelMessages.map((m) => String((m as any).content || '')));
  const autoMaxTokens = computeMaxOutputTokens({
    contextWindow,
    promptTokens,
    ratioCap: process.env.LLM_OUTPUT_TOKENS_RATIO ? Number(process.env.LLM_OUTPUT_TOKENS_RATIO) : undefined,
    absCap: process.env.LLM_OUTPUT_TOKENS_ABS_MAX ? Number(process.env.LLM_OUTPUT_TOKENS_ABS_MAX) : undefined,
  });

  const genParams = normalizeGenParams(provider, {
    temperature: process.env.LLM_TEMPERATURE ? Number(process.env.LLM_TEMPERATURE) : TEMPERATURE,
    topP: process.env.LLM_TOP_P ? Number(process.env.LLM_TOP_P) : TOP_P,
    topK: process.env.LLM_TOP_K ? Number(process.env.LLM_TOP_K) : TOP_K,
  });

  debugLog('LLM: request', {
    provider,
    model: modelId || (provider === 'azure-openai' ? 'deployment' : 'gemini-2.5-pro'),
    contextWindow,
    promptTokens,
    maxTokens: autoMaxTokens,
    temperature: genParams.temperature,
    topP: genParams.topP,
    topK: genParams.topK,
    includeTitleInstruction: Boolean(env?.includeTitleInstruction),
    messagesCount: vercelMessages.length,
  });

  const result = await aiStreamText({
    model,
    messages: vercelMessages,
    maxTokens: autoMaxTokens,
    ...(genParams.temperature !== undefined ? { temperature: genParams.temperature } : {}),
    ...(genParams.topP !== undefined ? { topP: genParams.topP } : {}),
    ...(genParams.topK !== undefined ? { topK: genParams.topK } : {}),
    ...(options?.abortSignal ? { abortSignal: options.abortSignal } : {}),
    onFinish: async (event: { text: string; finishReason?: string }) => {
      debugLog('LLM: onFinish', { finishReason: event.finishReason, textLength: (event.text || '').length });
      await options?.onFinish?.({ text: event.text, finishReason: event.finishReason });
    },
  });

  return {
    toAIStream() {
      debugLog('LLM: response stream ready');
      return result.toAIStream();
    },
  };
}


