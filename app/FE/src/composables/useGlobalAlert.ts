import { ref } from 'vue'

const message = ref<string>('')
const visible = ref(false)

export function useGlobalAlert() {
  function show(msg: string) {
    message.value = msg
    visible.value = true
    // 自動的に数秒で消す（必要なら調整）
    setTimeout(() => {
      visible.value = false
    }, 5000)
  }

  function clear() {
    visible.value = false
    message.value = ''
  }

  return { message, visible, show, clear }
}


