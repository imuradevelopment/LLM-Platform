<template>
  <ChatTemplate>
    <div class="panel rounded p-4 max-w-md mx-auto space-y-3">
      <h2 class="text-xl font-semibold">Login / Register</h2>
      <div class="space-y-2">
        <label class="block text-sm">Username</label>
        <input v-model="u" class="w-full input rounded p-2" placeholder="alice" />
      </div>
      <div class="space-y-2">
        <label class="block text-sm">Password</label>
        <input v-model="p" class="w-full input rounded p-2" type="password" placeholder="••••••" />
      </div>
      <div class="flex gap-2 items-center">
        <button :disabled="submitting" @click="login" class="btn">{{ submitting ? 'Checking...' : 'Login' }}</button>
        <div v-if="error" class="error text-sm">{{ error }}</div>
      </div>
    </div>
  </ChatTemplate>
  
</template>

<script setup lang="ts">
import { ref } from 'vue'
import ChatTemplate from '~/components/templates/ChatTemplate.vue'
import { useJwtAuth } from '~/composables/useJwtAuth'
import { useApi } from '~/composables/useApi'

const { setToken } = useJwtAuth()
const { post } = useApi()
const config = useRuntimeConfig()
const apiBaseUrl: string = config.public.apiBaseUrl
const router = useRouter()

const u = ref('')
const p = ref('')
const submitting = ref(false)
const error = ref('')

async function login() {
  error.value = ''
  submitting.value = true
  try {
    // まずログインを試行
    try {
      const data = await post<{ token: string }>(`/api/auth/login`, { name: u.value, password: p.value })
      if (!data?.token) throw new Error('認証に失敗しました')
      setToken(data.token, u.value)
      await router.push('/chat')
      return
    } catch (e: any) {
      // 401 の場合のみ登録→再ログイン
      try {
        await post(`/api/auth/register`, { name: u.value, password: p.value })
      } catch (re: any) {
        // 409=既存ユーザー → パスワード違いとみなす
        if (String(re?.message || '').includes('409') || String(re).includes('USER_EXISTS')) {
          throw new Error('ユーザーは既に存在します。パスワードが正しいか確認してください。')
        }
        throw re
      }
      const data = await post<{ token: string }>(`/api/auth/login`, { name: u.value, password: p.value })
      if (!data?.token) throw new Error('認証に失敗しました')
      setToken(data.token, u.value)
      await router.push('/chat')
    }
  } catch (e: any) {
    error.value = e?.message || 'Unknown error'
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.panel { border: 1px solid var(--c-border); background: var(--c-panel); color: var(--c-fg); }
.input { border: 1px solid var(--c-border); background: var(--c-input); color: var(--c-fg); }
.btn { padding: 6px 10px; border: 1px solid var(--c-border); border-radius: 6px; background: var(--c-btn); color: var(--c-fg); }
.error { color: #ef4444; }
</style>
