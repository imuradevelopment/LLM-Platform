<template>
  <ChatTemplate>
    <div class="chat-page">
      <div class="messages" ref="messagesEl">
        <div v-for="(m, i) in messages" :key="i" :class="['bubble', m.role]">
          <div class="role" v-if="false">{{ m.role }}</div>
          <div class="content">{{ m.content }}</div>
        </div>
      </div>
      <div class="composer">
        <textarea :value="input" @input="onInput" class="input" rows="2" placeholder="Type a message" />
        <div class="actions">
          <button :disabled="isStreaming || !input" class="send" @click="send">
            <span v-if="isStreaming" class="spinner" />
            <span v-else>Send</span>
          </button>
          <button :disabled="!isStreaming" class="stop" @click="stop">Stop</button>
        </div>
      </div>
    </div>
  </ChatTemplate>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { useGlobalAlert } from '~/composables/useGlobalAlert'
import { useJwtAuth } from '~/composables/useJwtAuth'
import { useApi } from '~/composables/useApi'
import { useModelSelector } from '~/composables/useModelSelector'
import ChatTemplate from '~/components/templates/ChatTemplate.vue'

definePageMeta({ middleware: ['require-auth-client'] })

type Role = 'user' | 'assistant' | 'system'
interface ChatMessage { role: Role; content: string }
interface ChatItem { id: number; title: string | null }

const messages = ref<ChatMessage[]>([])
const chatId = ref<string | null>(null)
const input = ref('')
const isStreaming = ref(false)
let currentAbort: AbortController | null = null
const error = ref('')
const { show } = useGlobalAlert()

const config = useRuntimeConfig()
const apiBaseUrl: string = config.public.apiBaseUrl
const { getAuthHeader } = useJwtAuth()
const { get, patch, del } = useApi()
const chats = ref<ChatItem[]>([])
const { selection, getHeaders } = useModelSelector()

function onInput(e: Event) { input.value = (e.target as HTMLTextAreaElement).value }

async function send() {
  if (!input.value || isStreaming.value) return
  error.value = ''
  isStreaming.value = true

  const body = { messages: [...messages.value, { role: 'user', content: input.value }] }
  messages.value.push({ role: 'user', content: input.value })
  input.value = ''

  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(chatId.value ? { 'x-chat-id': chatId.value } : {}) , ...getAuthHeader(), ...getHeaders() }

    currentAbort?.abort();
    currentAbort = new AbortController()
    const res = await fetch(`${apiBaseUrl}/api/chat`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: currentAbort.signal,
    })

    if (!res.ok) throw new Error(res.statusText || 'Request failed')

    // 取得したチャットIDを先に記憶（ストリーミング完了後にナビゲートし、途中でstateを壊さない）
    let pendingNavId: string | null = null
    const newId = res.headers.get('x-chat-id') || chatId.value
    if (newId && newId !== chatId.value) {
      chatId.value = newId
      pendingNavId = newId
    }
    const reader = res.body?.getReader()
    const decoder = new TextDecoder()
    let acc = ''
    const assistantMessage: ChatMessage = { role: 'assistant', content: '' }
    messages.value.push(assistantMessage)
    if (reader) {
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (value) {
            const chunk = decoder.decode(value, { stream: true })
            if (chunk) {
              acc += chunk
              // 直接参照を書き換えることで、配列が入れ替わっても上書き誤爆を防ぐ
              assistantMessage.content = acc
            }
          }
          if (done) break
        }
      } finally {
        // ストリームの終了で TextDecoder を最終フラッシュ
        try {
          const tail = decoder.decode()
          if (tail) {
            acc += tail
            assistantMessage.content = acc
          }
        } catch {}
        // ストリームの終了を検知してロード状態を解除
        isStreaming.value = false
        currentAbort = null
      }
    }

    // ストリーミングが終わってからURLとサイドバーを同期
    if (pendingNavId) {
      await navigateTo({ path: '/chat', query: { id: String(pendingNavId) } }, { replace: true })
      try {
        const data = await get<{ chats: ChatItem[] }>(`/api/chat/chats`)
        chats.value = data.chats
      } catch {}
    }
    // 初回応答完了タイミングでサイドバーを更新（タイトルが確定）
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('chat-title-updated'))
    }
  } catch (e: any) {
    error.value = e?.message || 'Unknown error'
    show(error.value)
  } finally {
    isStreaming.value = false
    currentAbort = null
  }
}

function stop() {
  try { currentAbort?.abort() } catch {}
}

// クエリの id でチャットを開く（SSRとCSRの不一致を避けるため、初回はonMountedで実行）
const route = useRoute()
onMounted(() => {
  const id = route.query.id
  if (id) openChat(Number(id))
  else {
    // 新規チャット表示用に状態を初期化
    chatId.value = null
    messages.value = []
  }
})
watch(
  () => route.query.id,
  (id, oldId) => {
    if (!id) {
      // New Chat に遷移したときは状態を完全リセット
      chatId.value = null
      messages.value = []
      input.value = ''
      isStreaming.value = false
      error.value = ''
      return
    }
    if (id === oldId) return
    openChat(Number(id))
  }
)

async function refreshChats() {
  try {
    const data = await get<{ chats: { id: number; title: string | null }[] }>(`/api/chat/chats`)
    chats.value = data.chats
  } catch (e: any) {
    show(e?.message || 'failed to load chats')
  }
}

async function openChat(id: number) {
  chatId.value = String(id)
  messages.value = []
  try {
    const data = await get<{ messages: ChatMessage[] }>(`/api/chat/${id}/messages`)
    messages.value = data.messages
  } catch (e: any) {
    show(e?.message || 'failed to load messages')
  }
}

async function rename(id: number) {
  const title = prompt('New title?')
  if (!title) return
  try {
    await patch(`/api/chat/${id}`, { title })
    await refreshChats()
  } catch (e: any) {
    show(e?.message || 'rename failed')
  }
}

async function removeChat(id: number) {
  if (!confirm('Delete this chat?')) return
  try {
    await del(`/api/chat/${id}`)
    if (chatId.value === String(id)) {
      chatId.value = null
      messages.value = []
    }
    await refreshChats()
  } catch (e: any) {
    show(e?.message || 'delete failed')
  }
}

onMounted(() => {
  refreshChats()
})

// 自動スクロール
const messagesEl = ref<HTMLElement | null>(null)
watch(messages, () => {
  requestAnimationFrame(() => {
    messagesEl.value?.scrollTo({ top: messagesEl.value.scrollHeight })
  })
})

</script>

<style scoped>
.chat-page { display: grid; grid-template-rows: 1fr auto; gap: 10px; height: 100%; overflow: hidden; background: var(--c-bg); color: var(--c-fg); }
.messages { overflow: auto; padding: 8px 4px; display: flex; flex-direction: column; gap: 8px; }
.bubble { max-width: 72%; padding: 10px 12px; border-radius: 14px; line-height: 1.5; white-space: pre-wrap; border: 1px solid var(--c-bubble-border); }
.bubble.user { align-self: flex-end; background: var(--c-bubble-user); color: var(--c-fg); border-top-right-radius: 6px; }
.bubble.assistant { align-self: flex-start; background: var(--c-bubble-assistant); color: var(--c-fg); border-top-left-radius: 6px; }
.composer { display: grid; grid-template-columns: 1fr auto; gap: 8px; padding: 8px; background: var(--c-panel); border-top: 1px solid var(--c-border); }
.actions { display: flex; gap: 8px; align-items: center; }
.input { width: 100%; resize: none; padding: 10px; border: 1px solid var(--c-border); border-radius: 10px; background: var(--c-input); color: var(--c-fg); }
.send { padding: 10px 16px; border-radius: 10px; border: 1px solid var(--c-accent); background: var(--c-accent); color: var(--c-fg-strong); }
.stop { padding: 10px 16px; border-radius: 10px; border: 1px solid var(--c-border); background: var(--c-btn); color: var(--c-fg); }
.spinner {
  width: 16px; height: 16px; border: 2px solid var(--c-fg-strong); border-right-color: transparent; border-radius: 50%; display: inline-block; animation: spin 0.8s linear infinite; }
@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
</style>


