// Minimal type shim for '@ai-sdk/google' to satisfy the linter in environments
// where the package types are not resolved.

declare module '@ai-sdk/google' {
  import type { LanguageModelV1 } from 'ai';
  export function google(modelId: string): LanguageModelV1;
}



