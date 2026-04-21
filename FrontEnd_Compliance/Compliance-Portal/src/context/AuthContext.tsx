import { createContext, useContext, useState, useEffect, useRef, type ReactNode } from 'react'
import { ROLE_PERMISSIONS, type AppUser, type Permission } from '@/config/users'
import { useStore } from '@/store/useStore'
import { API_BASE } from '@/lib/api'
import { Clock } from 'lucide-react'

const SETTINGS_API = `${API_BASE}/api/settings`

const SESSION_KEY   = 'compliance_session'   // guarda { token, user } — sem password
const INACTIVITY_MS = 30 * 60 * 1000
const WARNING_MS    =  2 * 60 * 1000

const AUTH_API        = `${API_BASE}/api/auth`
const AUTH_API_SETUP  = `${AUTH_API}/2fa/setup`
const AUTH_API_ENABLE = `${AUTH_API}/2fa/enable`
const AUTH_API_VERIFY = `${AUTH_API}/2fa/verify`

// ─── Token helpers ─────────────────────────────────────────────────────────────
function saveSession(token: string, user: AppUser) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({ token, user }))
}
function loadSession(): { token: string; user: AppUser } | null {
  try {
    const s = sessionStorage.getItem(SESSION_KEY)
    return s ? JSON.parse(s) : null
  } catch { return null }
}
function clearSession() {
  sessionStorage.removeItem(SESSION_KEY)
}

// Token exposto para uso nas chamadas API
export function getAuthToken(): string | null {
  const s = loadSession()
  return s?.token ?? null
}

export interface LoginResult {
  error:        string | null
  requires2fa?: boolean
  needsSetup?:  boolean
  userId?:      string
  locked?:      boolean
  until?:       number
}

interface AuthState {
  user:            AppUser | null
  authLoading:     boolean
  hasApiKey:       boolean
  login:           (email: string, password: string) => Promise<LoginResult>
  getSetup2fa:     (userId: string) => Promise<{ qr: string; secret: string } | string>
  confirmSetup2fa: (userId: string, token: string) => Promise<string | null>
  verify2fa:       (userId: string, token: string) => Promise<string | null>
  logout:          () => Promise<void>
  can:             (permission: Permission) => boolean
  canPortal:       (portal: string) => boolean
  isAdmin:         boolean
  lockoutInfo:     (email: string) => Promise<{ locked: boolean; remaining: number; attempts: number }>
  saveApiKey:      (key: string) => Promise<string | null>
  removeApiKey:    () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const session = loadSession()
  const [user, setUser]               = useState<AppUser | null>(session?.user ?? null)
  const [authLoading, setAuthLoading] = useState(false)
  const [hasApiKey, setHasApiKey]     = useState(false)
  const timerRef  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const warnRef   = useRef<ReturnType<typeof setTimeout> | null>(null)
  const resetRef  = useRef<(() => void) | null>(null)
  const [showWarning, setShowWarning] = useState(false)

  // ── Inatividade — logout automático após 30 min ────────────────────────────
  useEffect(() => {
    if (!user) { setShowWarning(false); return }

    function resetTimers() {
      if (timerRef.current) clearTimeout(timerRef.current)
      if (warnRef.current)  clearTimeout(warnRef.current)
      setShowWarning(false)

      warnRef.current = setTimeout(() => setShowWarning(true), INACTIVITY_MS - WARNING_MS)

      timerRef.current = setTimeout(() => {
        useStore.getState().addAuditLog({
          action: 'LOGOUT',
          entity: 'Sessão',
          entity_label: `${user!.name} (${user!.email}) — logout automático por inatividade`,
        })
        setUser(null)
        clearSession()
      }, INACTIVITY_MS)
    }

    resetRef.current = resetTimers
    const events = ['mousemove', 'keydown', 'mousedown', 'touchstart', 'scroll'] as const
    events.forEach(e => window.addEventListener(e, resetTimers, { passive: true }))
    resetTimers()

    return () => {
      events.forEach(e => window.removeEventListener(e, resetTimers))
      if (timerRef.current) clearTimeout(timerRef.current)
      if (warnRef.current)  clearTimeout(warnRef.current)
      resetRef.current = null
    }
  }, [user])

  // ── Lockout: consulta o servidor ──────────────────────────────────────────
  async function lockoutInfo(email: string) {
    try {
      const res  = await fetch(`${AUTH_API}/lockout?email=${encodeURIComponent(email)}`)
      const data = await res.json()
      const locked    = data.locked && data.until > Date.now()
      const remaining = locked ? Math.ceil((data.until - Date.now()) / 1000) : 0
      return { locked, remaining, attempts: data.count ?? 0 }
    } catch {
      return { locked: false, remaining: 0, attempts: 0 }
    }
  }

  // ── Login: credenciais validadas no servidor ──────────────────────────────
  async function login(email: string, password: string): Promise<LoginResult> {
    try {
      const res  = await fetch(`${AUTH_API}/login`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email, password }),
      })
      const data = await res.json()

      if (res.status === 429) {
        useStore.getState().addAuditLog({
          action: 'LOGIN_FAILED',
          entity: 'Sessão',
          entity_label: `Conta bloqueada — ${email}`,
        })
        return { error: data.error, locked: true, until: data.until }
      }

      if (!res.ok) {
        useStore.getState().addAuditLog({
          action: 'LOGIN_FAILED',
          entity: 'Sessão',
          entity_label: `Tentativa falhada — ${email}`,
        })
        return { error: data.error ?? 'Credenciais incorretas.' }
      }

      // Credenciais válidas — aguarda 2FA
      return { error: null, ...data }
    } catch {
      return { error: 'Erro de ligação ao servidor.' }
    }
  }

  async function fetchApiKeyStatus(token: string) {
    try {
      const res = await fetch(`${SETTINGS_API}/apikey`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const data = await res.json()
        setHasApiKey(data.hasKey ?? false)
      }
    } catch { /* noop */ }
  }

  function completeLogin(appUser: AppUser, token: string, email: string) {
    setUser(appUser)
    saveSession(token, appUser)
    useStore.getState().addAuditLog({
      action: 'LOGIN',
      entity: 'Sessão',
      entity_label: `${appUser.name} (${email})`,
    })
    void fetchApiKeyStatus(token)
  }

  async function saveApiKey(key: string): Promise<string | null> {
    try {
      const s = loadSession()
      const res = await fetch(`${SETTINGS_API}/apikey`, {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${s?.token}` },
        body:    JSON.stringify({ key }),
      })
      if (!res.ok) {
        const d = await res.json()
        return d.error ?? 'Erro ao guardar chave'
      }
      setHasApiKey(true)
      return null
    } catch {
      return 'Erro de ligação ao servidor'
    }
  }

  async function removeApiKey(): Promise<void> {
    try {
      const s = loadSession()
      await fetch(`${SETTINGS_API}/apikey`, {
        method:  'DELETE',
        headers: { Authorization: `Bearer ${s?.token}` },
      })
      setHasApiKey(false)
    } catch { /* noop */ }
  }

  async function getSetup2fa(userId: string): Promise<{ qr: string; secret: string } | string> {
    try {
      const token = getAuthToken()
      const res = await fetch(`${AUTH_API_SETUP}/${userId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (!res.ok) { const d = await res.json(); return d.error ?? 'Erro ao gerar QR code' }
      return await res.json()
    } catch {
      return 'Erro de ligação ao servidor'
    }
  }

  async function confirmSetup2fa(userId: string, token: string): Promise<string | null> {
    try {
      const res = await fetch(AUTH_API_ENABLE, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ userId, token }),
      })
      if (!res.ok) { const d = await res.json(); return d.error ?? 'Código inválido' }

      // Obter JWT após 2FA confirmado
      const tokenRes = await fetch(`${AUTH_API}/token`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ userId }),
      })
      if (!tokenRes.ok) return 'Erro ao obter sessão'
      const { token: jwt, user: appUser } = await tokenRes.json()
      completeLogin(appUser as AppUser, jwt, appUser.email)
      return null
    } catch {
      return 'Erro de ligação ao servidor'
    }
  }

  async function verify2fa(userId: string, token: string): Promise<string | null> {
    try {
      const res = await fetch(AUTH_API_VERIFY, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ userId, token }),
      })
      if (!res.ok) { const d = await res.json(); return d.error ?? 'Código inválido' }

      // Obter JWT após 2FA verificado
      const tokenRes = await fetch(`${AUTH_API}/token`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ userId }),
      })
      if (!tokenRes.ok) return 'Erro ao obter sessão'
      const { token: jwt, user: appUser } = await tokenRes.json()
      completeLogin(appUser as AppUser, jwt, appUser.email)
      return null
    } catch {
      return 'Erro de ligação ao servidor'
    }
  }

  async function logout() {
    if (user) {
      useStore.getState().addAuditLog({
        action: 'LOGOUT',
        entity: 'Sessão',
        entity_label: `${user.name} (${user.email})`,
      })
    }
    setUser(null)
    clearSession()
  }

  function can(permission: Permission): boolean {
    if (!user) return false
    return ROLE_PERMISSIONS[user.role].includes(permission)
  }

  function canPortal(portal: string): boolean {
    if (!user) return false
    return user.portals?.includes(portal as never) ?? false
  }

  return (
    <AuthContext.Provider value={{
      user, authLoading, hasApiKey, login, getSetup2fa, confirmSetup2fa, verify2fa,
      logout, can, canPortal, lockoutInfo, saveApiKey, removeApiKey,
      isAdmin: user?.role === 'admin',
    }}>
      {children}
      {showWarning && user && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] bg-amber-50 border border-amber-300 rounded-2xl shadow-xl px-5 py-4 flex items-center gap-4 w-full max-w-sm">
          <Clock size={18} className="text-amber-500 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-semibold text-amber-900">Sessão prestes a expirar</div>
            <div className="text-[11px] text-amber-700 mt-0.5">Sem atividade detetada. Será desligado em 2 minutos.</div>
          </div>
          <button
            onClick={() => resetRef.current?.()}
            className="flex-shrink-0 text-[12px] font-semibold bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 rounded-lg transition-colors"
          >
            Continuar
          </button>
        </div>
      )}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
