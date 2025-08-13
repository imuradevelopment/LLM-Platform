// Minimal type shims for 'ai' package used at runtime.
// This avoids editor/CI lints that cannot resolve the module types in some envs.

declare module 'ai' {
  export type CoreMessage = { role: string; content: string };
  export interface LanguageModelV1 {}
  export function parseStreamPart(input: string): { type?: string; value?: unknown };
  export function streamText(args: any): any;
}


