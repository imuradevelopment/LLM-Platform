import { watch, computed, ref } from 'vue'
import { useApi } from '~/composables/useApi'

type Provider = 'gemini' | 'azure-openai' | 'openai'

interface ModelSelection {
  provider: Provider
  model: string
}

export function useModelSelector() {
  const selection = useState<ModelSelection>('llmSelection', () => ({ provider: 'gemini', model: 'models/gemini-2.5-pro' }))
  const provider = computed(() => selection.value.provider)
  const model = computed(() => selection.value.model)

  const booted = useState<boolean>('llmSelectionBooted', () => false)
  const loaded = useState<boolean>('llmOptionsLoaded', () => false)
  const providerDefs = useState<any[]>('llmProviders', () => [])

  async function loadOptions() {
    if (loaded.value) return
    const { get } = useApi()
    try {
      const data = await get<{ providers: { id: string; name: string; models: { id: string; label: string }[] }[]; defaults: { provider: string; model: string } }>(`/api/llm/models`)
      // 埋め込み専用のプロバイダ（id が "-embed" で終わる）はモデル選択肢から除外
      const providersOnlyForChat = (data.providers || []).filter(p => !/-embed$/.test(p.id))
      providerDefs.value = providersOnlyForChat
      // 既存の選択が無効ならデフォルトに更新
      const validProvider = providersOnlyForChat.some(p => p.id === selection.value.provider)
      if (!validProvider) selection.value.provider = (data.defaults.provider || 'gemini') as Provider
      const models = providersOnlyForChat.find(p => p.id === selection.value.provider)?.models || []
      const validModel = models.some(m => m.id === (selection.value.model || '').replace(/^models\//,''))
      if (!validModel) {
        const next = (data.defaults.model || models[0]?.id || 'gemini-2.5-pro')
        selection.value.model = next
      } else {
        // 保存値が 'models/' 付きなら正規化
        selection.value.model = selection.value.model.replace(/^models\//,'')
      }
      loaded.value = true
    } catch {
      // 読み込み失敗時は静的フォールバック
      providerDefs.value = [
        { id: 'gemini', name: 'Gemini', models: [ { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' }, { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' } ] },
        // OpenAI は BE 側で無効化しているため、フォールバック候補から除外
        { id: 'azure-openai', name: 'Azure OpenAI', models: [ { id: 'deployment', label: 'Azure deployment' } ] },
      ]
      loaded.value = true
    }
  }
  if (process.client && !booted.value) {
    try {
      const saved = localStorage.getItem('llmSelection')
      if (saved) selection.value = JSON.parse(saved)
    } catch {}
    watch(selection, (v) => {
      try { localStorage.setItem('llmSelection', JSON.stringify(v)) } catch {}
    }, { deep: true, immediate: true })
    // オプション読み込み
    loadOptions()
    booted.value = true
  }

  function setProvider(p: Provider) { selection.value = { ...selection.value, provider: p } }
  function setModel(m: string) { selection.value = { ...selection.value, model: m } }
  function getHeaders(): Record<string, string> {
    return {
      'X-LLM-Provider': selection.value.provider,
      'X-LLM-Model': selection.value.model,
    }
  }

  const modelsForSelected = computed(() => (providerDefs.value.find(p => p.id === selection.value.provider)?.models || []) as { id: string; label: string }[])

  // provider変更でモデルを有効値に寄せる
  watch(provider, (p) => {
    const list = providerDefs.value.find(x => x.id === p)?.models || []
    if (!list.length) return
    if (!list.some(m => m.id === selection.value.model)) selection.value = { ...selection.value, model: list[0].id }
  })

  return { selection, provider, model, setProvider, setModel, getHeaders, providers: providerDefs, modelsForSelected, loaded, loadOptions }
}


