export interface ProviderModelDef {
  id: string;
  name: string;
  models: { id: string; label: string }[];
}

export function getAllowedProvidersAndModels(): ProviderModelDef[] {
  const azure = (() => {
    const ep = process.env.AZURE_OPENAI_ENDPOINT || '';
    const { deployment } = parseAzureEndpoint(ep);
    const dep = deployment || process.env.AZURE_OPENAI_DEPLOYMENT || 'deployment';
    return { id: 'azure-openai', name: 'Azure OpenAI', models: [ { id: dep, label: `Azure deployment: ${dep}` } ] };
  })();

  return [
    { id: 'gemini', name: 'Gemini', models: [
      { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
      { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
      { id: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash' },
    ] },
    azure,
  ];
}

export function isProviderAllowed(provider?: string): boolean {
  if (!provider) return true; // 未指定は既定にフォールバック
  return getAllowedProvidersAndModels().some((p) => p.id === provider);
}

export function isModelAllowed(provider: string | undefined, model: string | undefined): boolean {
  if (!provider || !model) return true; // 未指定は既定
  const list = getAllowedProvidersAndModels().find((p) => p.id === provider)?.models || [];
  const normalized = model.replace(/^models\//, '');
  return list.some((m) => m.id === normalized);
}

function parseAzureEndpoint(input: string): { resource: string; deployment: string } {
  try {
    const url = new URL(input.includes('://') ? input : `https://${input}`);
    const resource = `${url.protocol}//${url.host}`;
    const parts = url.pathname.split('/').filter(Boolean);
    const idx = parts.findIndex((p) => p === 'deployments');
    const deployment = idx >= 0 && parts[idx + 1] ? parts[idx + 1] : '';
    return { resource, deployment };
  } catch {
    return { resource: input.replace(/\/openai.*$/, ''), deployment: '' };
  }
}


