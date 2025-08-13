// Minimal shim for '@ai-sdk/openai' to satisfy types in environments
// where the package types may not resolve in the editor/CI.

declare module '@ai-sdk/openai' {
  import type { LanguageModelV1 } from 'ai';
  export function createOpenAI(config: { apiKey: string; baseURL?: string }): (modelId: string) => LanguageModelV1;
}


