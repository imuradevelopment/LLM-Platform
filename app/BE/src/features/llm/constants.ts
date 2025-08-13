function requireNumber(name: string): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') {
    throw new Error(`Missing required env: ${name}`);
  }
  const num = Number(raw);
  if (Number.isNaN(num)) {
    throw new Error(`Env ${name} must be a number. Got: ${raw}`);
  }
  return num;
}

export const MAX_TOKENS = requireNumber('LLM_MAX_TOKENS');
export const MAX_RESPONSE_SEGMENTS = requireNumber('LLM_MAX_RESPONSE_SEGMENTS');
export const TEMPERATURE = requireNumber('LLM_TEMPERATURE');

// Optional knobs (only passed when set)
export const TOP_P = process.env.LLM_TOP_P ? Number(process.env.LLM_TOP_P) : undefined;
export const TOP_K = process.env.LLM_TOP_K ? Number(process.env.LLM_TOP_K) : undefined;


