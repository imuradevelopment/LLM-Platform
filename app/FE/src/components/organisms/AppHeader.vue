<template>
  <header class="header">
    <div class="left">
      <NuxtLink to="/" class="brand">MVP Chat</NuxtLink>
    </div>
    <ClientOnly>
      <div class="right">
        <div v-if="isLoggedIn" class="user" ref="root">
          <select class="model-select" v-model="provider" @change="persist">
            <option v-for="p in providers" :key="p.id" :value="p.id">{{ p.name }}</option>
          </select>
          <select class="model-input" v-model="model" @change="persist">
            <option v-for="m in models" :key="m.id" :value="m.id">{{ m.label }}</option>
          </select>
          <button class="user-btn" @click="toggle">{{ name }}</button>
          <div v-if="open" class="menu">
            <button class="menu-item" @click="goChat">Chat</button>
            <button class="menu-item" @click="logout">Logout</button>
          </div>
        </div>
        <NuxtLink v-else to="/login" class="login">Login</NuxtLink>
      </div>
    </ClientOnly>
  </header>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'
import { useJwtAuth } from '~/composables/useJwtAuth'
import { useModelSelector } from '~/composables/useModelSelector'

const { token, name: displayName, clear } = useJwtAuth()
const isLoggedIn = computed(() => Boolean(token.value))
const name = computed(() => displayName.value || 'user')
const open = ref(false)
const root = ref<HTMLElement | null>(null)
const { selection, setProvider, setModel, providers: providerDefs, modelsForSelected, loaded, loadOptions } = useModelSelector()
const provider = computed({ get: () => selection.value.provider, set: (v) => setProvider(v as any) })
const model = computed({ get: () => selection.value.model, set: (v) => setModel(v) })
const providers = providerDefs
const models = modelsForSelected

function toggle() { open.value = !open.value }
function logout() { clear(); open.value = false; navigateTo('/login') }
function goChat() { navigateTo('/chat'); open.value = false }
function persist() { /* 双方向同期は composable 側で行うため空実装 */ }

function onDocumentClick(e: MouseEvent) {
  if (!open.value) return
  const el = root.value
  const target = e.target as Node | null
  if (el && target && !el.contains(target)) {
    open.value = false
  }
}

onMounted(() => {
  if (!loaded.value) loadOptions()
  if (process.client) document.addEventListener('click', onDocumentClick)
})
onBeforeUnmount(() => { if (process.client) document.removeEventListener('click', onDocumentClick) })
</script>

<style scoped>
.header { height: 56px; display: flex; align-items: center; justify-content: space-between; padding: 0 16px; border-bottom: 1px solid var(--c-border); position: sticky; top: 0; background: var(--c-panel); color: var(--c-fg); z-index: 20; backdrop-filter: saturate(120%) blur(6px); }
.brand { font-weight: 700; text-decoration: none; color: var(--c-fg-strong); }
.user { position: relative; }
.user-btn { border: 1px solid var(--c-border); padding: 6px 10px; border-radius: 6px; background: var(--c-btn); color: var(--c-fg); cursor: pointer; }
.model-select { margin-right: 8px; padding: 6px 8px; border: 1px solid var(--c-border); border-radius: 6px; background: var(--c-input); color: var(--c-fg); }
.model-input { margin-right: 8px; padding: 6px 8px; border: 1px solid var(--c-border); border-radius: 6px; width: 260px; background: var(--c-input); color: var(--c-fg); }
.menu { position: absolute; right: 0; top: calc(100% + 6px); border: 1px solid var(--c-border); border-radius: 8px; background: var(--c-panel); min-width: 140px; box-shadow: 0 6px 18px rgba(0,0,0,0.35); display: flex; flex-direction: column; }
.menu-item { text-align: left; background: transparent; color: var(--c-fg); border: none; padding: 10px 12px; cursor: pointer; }
.menu-item:hover { background: var(--c-hover); }
.login { border: 1px solid var(--c-border); padding: 6px 10px; border-radius: 6px; text-decoration: none; color: var(--c-fg); }
</style>


