<template>
  <div class="border rounded p-4">
    <div class="space-y-2 mb-3">
      <div v-for="(m, i) in messages" :key="i" class="text-sm whitespace-pre-wrap">
        <span class="font-semibold">{{ m.role }}:</span>
        <span> {{ m.content }}</span>
      </div>
    </div>
    <textarea
      :value="input"
      @input="onInput"
      class="w-full border rounded p-2"
      rows="3"
      placeholder="Type a message and press Send"
    />
    <div class="mt-2 flex gap-2">
      <button :disabled="isStreaming || !input" @click="$emit('send')" class="px-3 py-1 border rounded">{{ isStreaming ? 'Streaming...' : 'Send' }}</button>
    </div>
    <div v-if="error" class="mt-2 text-red-600 text-sm">{{ error }}</div>
  </div>
</template>

<script setup lang="ts">

interface ChatMessage { role: 'user' | 'assistant' | 'system'; content: string }

const props = defineProps<{
  messages: ChatMessage[]
  input: string
  isStreaming: boolean
  error: string
}>()

const emit = defineEmits<{ (e: 'send'): void; (e: 'update:input', value: string): void }>()

function onInput(e: Event) {
  emit('update:input', (e.target as HTMLTextAreaElement).value)
}
</script>


