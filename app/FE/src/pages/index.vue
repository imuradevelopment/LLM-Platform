<template>
  <ChatTemplate>
    <div class="panel rounded p-4 max-w-xl mx-auto space-y-3">
      <h2 class="text-xl font-semibold">Welcome</h2>
      <p class="text-sm muted">このアプリを使うにはログインしてください。</p>
      <div class="flex gap-2">
        <NuxtLink to="/login" class="btn">Login</NuxtLink>
        <NuxtLink to="/chat" class="btn">Chat</NuxtLink>
      </div>
    </div>
  </ChatTemplate>
</template>

<script setup lang="ts">
import ChatTemplate from '~/components/templates/ChatTemplate.vue'
</script>

<style scoped>
html, body, #__nuxt { height: 100%; }
.panel { border: 1px solid var(--c-border); background: var(--c-panel); color: var(--c-fg); }
.muted { color: var(--c-fg-muted); }
.btn { padding: 6px 10px; border: 1px solid var(--c-border); border-radius: 6px; background: var(--c-btn); color: var(--c-fg); text-decoration: none; }
</style>


