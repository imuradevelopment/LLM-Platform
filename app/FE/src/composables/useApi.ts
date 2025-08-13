export function useApi() {
  const config = useRuntimeConfig()
  const apiBaseUrl: string = config.public.apiBaseUrl
  const { getAuthHeader } = useJwtAuth()

  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...getAuthHeader(),
      ...(init.headers as any),
    }
    const res = await fetch(`${apiBaseUrl}${path}`, { ...init, headers })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(text || res.statusText)
    }
    const ct = res.headers.get('content-type') || ''
    if (ct.includes('application/json')) return (await res.json()) as T
    // @ts-expect-error allow non-json
    return undefined
  }

  return {
    get: <T>(path: string) => request<T>(path, { method: 'GET' }),
    post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body: JSON.stringify(body ?? {}) }),
    patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body: JSON.stringify(body ?? {}) }),
    del: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
  }
}


