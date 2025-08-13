import { google } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
// process は Node グローバルだが、型解決エラー回避のため明示importは不要
import type { LanguageModelV1 } from 'ai';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const process: any;
import { debugLog } from '../../shared/logger';

export type Provider = 'gemini' | 'azure-openai' | 'openai';

export function getLanguageModel(runtime?: { provider?: Provider; model?: string; extra?: Record<string, string> }): LanguageModelV1 {
  const provider = (runtime?.provider || process.env.LLM_PROVIDER || 'gemini') as Provider;

  if (provider === 'gemini') {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('Missing required env: GEMINI_API_KEY');
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = apiKey;
    const modelEnv = runtime?.model || process.env.GEMINI_MODEL;
    if (!modelEnv) throw new Error('Missing required env: GEMINI_MODEL');
    const configuredModel = normalizeGeminiModelId(modelEnv);
    debugLog('LLM: provider setup', { provider, model: configuredModel });
    return google(configuredModel);
  }

  if (provider === 'openai') {
    // OpenAI (disabled by request; keep branch for future use)
    throw new Error('OpenAI provider is disabled. Use Gemini or Azure OpenAI.');
  }

  if (provider === 'azure-openai') {
    const apiKey = process.env.AZURE_OPENAI_API_KEY || runtime?.extra?.AZURE_OPENAI_API_KEY;
    const rawEndpoint = process.env.AZURE_OPENAI_ENDPOINT || runtime?.extra?.AZURE_OPENAI_ENDPOINT; // can be resource or full endpoint
    const deploymentEnv = process.env.AZURE_OPENAI_DEPLOYMENT || runtime?.extra?.AZURE_OPENAI_DEPLOYMENT || '';
    if (!apiKey) throw new Error('Missing required env: AZURE_OPENAI_API_KEY');
    if (!rawEndpoint) throw new Error('Missing required env: AZURE_OPENAI_ENDPOINT');

    const parsed = parseAzureEndpoint(rawEndpoint);
    const resource = parsed.resource; // like https://product-gi.openai.azure.com
    const deployment = deploymentEnv || parsed.deployment;
    const apiVersion = parsed.apiVersion || process.env.AZURE_OPENAI_API_VERSION || '2025-01-01-preview';
    if (!deployment) throw new Error('Missing Azure deployment. Set AZURE_OPENAI_DEPLOYMENT or include it in AZURE_OPENAI_ENDPOINT.');

    const baseURL = `${resource}/openai/deployments/${deployment}`;
    debugLog('LLM: provider setup', { provider, model: 'deployment' });
    const client = createOpenAI({
      apiKey,
      baseURL,
      compatibility: 'azure',
      // ai-sdk のバージョン差異に備え、api-version を必ず付与する fetch ラッパーを適用
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fetch: async (input: any, init?: any) => {
        const urlStr = typeof input === 'string' ? input : input?.url || '';
        const needsVersion = urlStr.startsWith(baseURL) && !/api-version=/.test(urlStr);
        const finalUrl = needsVersion ? `${urlStr}${urlStr.includes('?') ? '&' : '?'}api-version=${encodeURIComponent(apiVersion)}` : urlStr;
        return fetch(finalUrl, init);
      },
    } as any);
    // For Azure, model id is ignored by endpoint (deployment in baseURL)
    return client(runtime?.model || 'gpt-4o');
  }

  throw new Error(`Unsupported LLM provider: ${provider}`);
}

function normalizeGeminiModelId(model: string): string {
  return model.startsWith('models/') ? model : `models/${model}`;
}

function parseAzureEndpoint(input: string): { resource: string; deployment: string; apiVersion: string } {
  try {
    // Examples:
    // https://product-gi.openai.azure.com
    // https://product-gi.openai.azure.com/openai/deployments/gpt-4o-2/chat/completions?api-version=2025-01-01-preview
    const url = new URL(input.includes('://') ? input : `https://${input}`);
    const resource = `${url.protocol}//${url.host}`;
    const parts = url.pathname.split('/').filter(Boolean);
    const idx = parts.findIndex((p) => p === 'deployments');
    const deployment = idx >= 0 && parts[idx + 1] ? parts[idx + 1] : '';
    const params = new URLSearchParams(url.search);
    const apiVersion = params.get('api-version') || '';
    return { resource, deployment, apiVersion };
  } catch {
    return { resource: input.replace(/\/openai.*$/, ''), deployment: '', apiVersion: '' };
  }
}


