<template>
  <AppHeader />
  <div class="app-root">
    <aside class="app-aside">
      <AppSidebar />
    </aside>
    <main class="app-main">
      <slot />
    </main>
    <transition name="fade">
      <div v-if="visible" class="fixed bottom-4 right-4 z-50 alert">
        {{ message }}
      </div>
    </transition>
  </div>
  
</template>

<script setup lang="ts">
import { useGlobalAlert } from '~/composables/useGlobalAlert'
const { message, visible } = useGlobalAlert()
import AppSidebar from '~/components/organisms/AppSidebar.vue'
import AppHeader from '~/components/organisms/AppHeader.vue'
</script>

<style>
html, body, #__nuxt { margin: 0; height: 100%; }
* { box-sizing: border-box; }
.app-root { display: grid; grid-template-columns: 240px 1fr; height: calc(100dvh - 56px); overflow: hidden; background: var(--c-bg); color: var(--c-fg); }
.app-aside { background: var(--c-panel); height: 100%; overflow: auto; border-right: 1px solid var(--c-border); }
.app-main { padding: 0; height: 100%; overflow: auto; }
.fade-enter-active, .fade-leave-active { transition: opacity .2s }
.fade-enter-from, .fade-leave-to { opacity: 0 }
.alert { background: #ef4444; color: var(--c-fg-strong); padding: 8px 12px; border-radius: 6px; box-shadow: 0 6px 18px rgba(0,0,0,0.35); }
@media (max-width: 860px) {
  .app-root { grid-template-columns: 200px 1fr; }
}
</style>


