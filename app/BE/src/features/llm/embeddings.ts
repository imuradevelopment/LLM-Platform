type Provider = 'gemini' | 'azure-openai';

export interface EmbedTextsArgs {
  texts: string[];
  kind: 'document' | 'query';
  provider: Provider;
  modelId?: string; // for gemini: defaults to text-embedding-004; for azure: deployment name
}

export interface EmbedTextsResult {
  vectors: number[][];
  dims: number;
  provider: Provider;
  model: string;
}

export async function embedTexts(args: EmbedTextsArgs): Promise<EmbedTextsResult> {
  if (args.provider === 'azure-openai') {
    return embedWithAzure(args);
  }
  return embedWithGemini(args);
}

async function embedWithGemini(args: EmbedTextsArgs): Promise<EmbedTextsResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('Missing required env: GEMINI_API_KEY');
  const model = (args.modelId || process.env.GEMINI_EMBEDDING_MODEL || 'text-embedding-004').replace(/^models\//, '');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:embedContent?key=${encodeURIComponent(apiKey)}`;
  const vectors: number[][] = [];
  let dims = 0;
  for (const text of args.texts) {
    const body = {
      model,
      taskType: args.kind === 'query' ? 'RETRIEVAL_QUERY' : 'RETRIEVAL_DOCUMENT',
      content: { parts: [{ text }] },
    };
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      throw new Error(`Gemini embedding failed: ${res.status} ${await res.text()}`);
    }
    const json: any = await res.json();
    const values: number[] = json?.embedding?.values || [];
    if (!values.length) throw new Error('Gemini embedding returned empty vector');
    vectors.push(values);
    dims = dims || values.length;
  }
  return { vectors, dims, provider: 'gemini', model };
}

async function embedWithAzure(args: EmbedTextsArgs): Promise<EmbedTextsResult> {
  const apiKey = process.env.AZURE_OPENAI_API_KEY;
  const rawEndpoint = process.env.AZURE_OPENAI_ENDPOINT || '';
  const deployment = args.modelId || process.env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT || '';
  const apiVersion = process.env.AZURE_OPENAI_API_VERSION || '2025-01-01-preview';
  if (!apiKey) throw new Error('Missing required env: AZURE_OPENAI_API_KEY');
  if (!rawEndpoint) throw new Error('Missing required env: AZURE_OPENAI_ENDPOINT');
  if (!deployment) throw new Error('Missing required env: AZURE_OPENAI_EMBEDDING_DEPLOYMENT');
  const { resource } = parseAzureEndpoint(rawEndpoint);
  const url = `${resource}/openai/deployments/${encodeURIComponent(deployment)}/embeddings?api-version=${encodeURIComponent(apiVersion)}`;
  const input = args.texts;
  const body = { input } as any;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': apiKey,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Azure embedding failed: ${res.status} ${await res.text()}`);
  }
  const json: any = await res.json();
  const data = Array.isArray(json?.data) ? json.data : [];
  const vectors: number[][] = [];
  let dims = 0;
  for (const item of data) {
    const vec: number[] = item?.embedding || [];
    if (!vec.length) continue;
    vectors.push(vec);
    dims = dims || vec.length;
  }
  if (!vectors.length) throw new Error('Azure embedding returned empty vectors');
  return { vectors, dims, provider: 'azure-openai', model: deployment };
}

function parseAzureEndpoint(input: string): { resource: string } {
  try {
    const url = new URL(input.includes('://') ? input : `https://${input}`);
    const resource = `${url.protocol}//${url.host}`;
    return { resource };
  } catch {
    return { resource: input.replace(/\/?openai.*$/, '') };
  }
}

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i += 1) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb) || 1;
  return dot / denom;
}


