export default defineNuxtRouteMiddleware(() => {
  // SSR/CSR ともに Cookie で判定
  const token = useCookie<string | null>('jwtToken', { sameSite: 'lax' })
  if (!token.value) return navigateTo('/login')
})


