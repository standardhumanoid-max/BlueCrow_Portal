// URL base da API — configurável via variável de ambiente no build
// Dev: http://localhost:3001   |   LAN: http://192.168.8.186:3001
export const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:3001'

// ── Fetch autenticado — injeta JWT automaticamente ────────────────────────────
export async function authFetch(input: RequestInfo, init: RequestInit = {}): Promise<Response> {
  try {
    const s = sessionStorage.getItem('compliance_session')
    const token = s ? JSON.parse(s)?.token : null
    if (token) {
      init.headers = {
        ...(init.headers ?? {}),
        Authorization: `Bearer ${token}`,
      }
    }
  } catch { /* noop */ }

  const res = await fetch(input, init)

  // Sessão expirada ou inválida — limpar e recarregar para forçar login
  if (res.status === 401) {
    sessionStorage.removeItem('compliance_session')
    window.location.reload()
  }

  return res
}
