import { watch } from 'vue'

export function useJwtAuth() {
  // 状態は関数内で生成（Nuxt コンテキスト内）
  const token = useState<string>('jwtToken', () => '')
  const name = useState<string>('jwtName', () => '')
  const booted = useState<boolean>('jwtBooted', () => false)

  const tokenCookie = useCookie<string | null>('jwtToken', { sameSite: 'lax' })
  const nameCookie = useCookie<string | null>('jwtName', { sameSite: 'lax' })

  // SSR時も cookie から復元
  if (tokenCookie.value && !token.value) token.value = tokenCookie.value
  if (nameCookie.value && !name.value) name.value = nameCookie.value

  // CSRでは localStorage と双方向同期（cookie優先）。watcherは一度だけ。
  if (process.client && !booted.value) {
    try {
      const lsToken = localStorage.getItem('jwtToken') || ''
      const lsName = localStorage.getItem('jwtName') || ''
      if (!token.value && lsToken) token.value = lsToken
      if (!name.value && lsName) name.value = lsName
    } catch {}

    watch(token, (v) => {
      try {
        if (v) localStorage.setItem('jwtToken', v)
        else localStorage.removeItem('jwtToken')
      } catch {}
    }, { immediate: true })
    watch(name, (v) => {
      try {
        if (v) localStorage.setItem('jwtName', v)
        else localStorage.removeItem('jwtName')
      } catch {}
    }, { immediate: true })

    booted.value = true
  }

  function setToken(t: string, n?: string) {
    token.value = t
    tokenCookie.value = t
    if (n !== undefined) {
      name.value = n
      nameCookie.value = n
    }
    if (process.client) {
      try {
        localStorage.setItem('jwtToken', t)
        if (n !== undefined) localStorage.setItem('jwtName', n)
      } catch {}
    }
  }

  function clear() {
    token.value = ''
    name.value = ''
    tokenCookie.value = null
    nameCookie.value = null
    if (process.client) {
      try {
        localStorage.removeItem('jwtToken')
        localStorage.removeItem('jwtName')
      } catch {}
    }
  }

  function getAuthHeader(): Record<string, string> {
    if (!token.value) return {}
    return { Authorization: `Bearer ${token.value}` }
  }

  return { token, name, setToken, clear, getAuthHeader }
}


