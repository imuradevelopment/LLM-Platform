<template>
  <nav class="sidebar">
    <div class="row">
      <button class="btn primary w-full" @click="newChat" :disabled="!isLoggedIn">+ New Chat</button>
    </div>
    <div class="row">
      <input v-model="query" placeholder="Search..." class="input w-full" :disabled="!isLoggedIn" />
    </div>
    <ul class="list">
      <li v-for="c in filtered" :key="c.id" :class="['item', { active: activeId === String(c.id) }]">
        <button class="title" @click="open(c.id)">{{ c.title || `Chat #${c.id}` }}</button>
        <div class="actions">
          <button title="Rename" class="icon" @click.stop="rename(c.id)">✎</button>
          <button title="Delete" class="icon" @click.stop="removeChat(c.id)">🗑</button>
        </div>
      </li>
    </ul>
    <div class="row small">
      <button class="btn w-full" @click="load" :disabled="!isLoggedIn">Refresh</button>
    </div>
  </nav>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useApi } from '~/composables/useApi'
import { useJwtAuth } from '~/composables/useJwtAuth'

interface ChatItem { id: number; title: string | null }

const { get, patch, del } = useApi()
const { token } = useJwtAuth()
const isLoggedIn = computed(() => Boolean(token.value))
const chats = ref<ChatItem[]>([])
const query = ref('')
const route = useRoute()
const activeId = computed(() => String(route.query.id || ''))

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return chats.value
  return chats.value.filter(c => (c.title || `Chat #${c.id}`).toLowerCase().includes(q))
})

async function load() {
  if (!isLoggedIn.value) return
  try {
    const data = await get<{ chats: ChatItem[] }>(`/api/chat/chats`)
    chats.value = data.chats
    // 現在の URL の id が一覧にあれば、スクロールや強調を維持（簡易）
  } catch {}
}

function open(id: number) {
  navigateTo({ path: '/chat', query: { id: String(id) } })
}

function newChat() {
  // クエリ id を外して新規チャットとして開始
  navigateTo({ path: '/chat', query: {} })
}

async function rename(id: number) {
  const title = prompt('New title?')
  if (!title) return
  try {
    await patch(`/api/chat/${id}`, { title })
    await load()
  } catch {}
}

async function removeChat(id: number) {
  if (!confirm('Delete this chat?')) return
  try {
    await del(`/api/chat/${id}`)
    if (activeId.value === String(id)) navigateTo('/chat')
    await load()
  } catch {}
}

const handler = () => load()

onMounted(() => {
  if (isLoggedIn.value) load()
  if (process.client && isLoggedIn.value) {
    window.addEventListener('chat-title-updated', handler)
  }
})

watch(isLoggedIn, (v, ov) => {
  if (process.client) {
    if (v) {
      load()
      window.addEventListener('chat-title-updated', handler)
    } else {
      window.removeEventListener('chat-title-updated', handler)
      chats.value = []
      query.value = ''
    }
  }
})

onUnmounted(() => {
  if (process.client) window.removeEventListener('chat-title-updated', handler)
})
</script>

<style scoped>
.sidebar { display: flex; flex-direction: column; gap: 10px; padding: 12px; border-right: 1px solid var(--c-border); height: 100%; overflow: auto; background: var(--c-panel); color: var(--c-fg); }
.row { display: flex; gap: 8px; }
.small { margin-top: auto; }
.w-full { width: 100%; }
.btn { padding: 6px 8px; border: 1px solid var(--c-border); border-radius: 6px; background: var(--c-btn); color: var(--c-fg); cursor: pointer; }
.btn.primary { background: var(--c-accent); color: var(--c-fg-strong); border-color: var(--c-accent); }
.input { padding: 6px 8px; border: 1px solid var(--c-border); border-radius: 6px; background: var(--c-input); color: var(--c-fg); }
.list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 4px; }
.item { display: grid; grid-template-columns: 1fr auto; gap: 6px; align-items: center; border-radius: 6px; padding: 6px; }
.item.active { background: var(--c-active); }
.title { text-align: left; background: transparent; border: none; cursor: pointer; padding: 4px; }
.actions { display: flex; gap: 6px; }
.icon { border: 1px solid var(--c-border); background: var(--c-btn); color: var(--c-fg); border-radius: 6px; padding: 2px 6px; cursor: pointer; }
</style>


