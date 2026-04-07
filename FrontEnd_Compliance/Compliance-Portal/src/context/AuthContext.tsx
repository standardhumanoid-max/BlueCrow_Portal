import { createContext, useContext, useState, useEffect, useRef, type ReactNode } from 'react'
import { ROLE_PERMISSIONS, type AppUser, type Permission } from '@/config/users'
import { useStore } from '@/store/useStore'
import { Clock } from 'lucide-react'

const API              = 'http://localhost:3001/api/comp/portal_users'
const SESSION_KEY      = 'compliance_user'
const LOCKOUT_KEY      = 'compliance_lockout'   // { email, count, until }
const MAX_ATTEMPTS     = 5
const LOCKOUT_MS       = 15 * 60 * 1000         // 15 minutos
const INACTIVITY_MS    = 30 * 60 * 1000         // 30 minutos
const WARNING_MS       =  2 * 60 * 1000         //  aviso 2 min antes do logout

interface LockoutEntry {
  email: string
  count: number
  until: number   // timestamp; 0 = não bloqueado ainda
}

function getLockout(email: string): LockoutEntry {
  try {
    const raw = localStorage.getItem(LOCKOUT_KEY)
    if (!raw) return { email, count: 0, until: 0 }
    const parsed: LockoutEntry = JSON.parse(raw)
    if (parsed.email !== email) return { email, count: 0, until: 0 }
    return parsed
  } catch {
    return { email, count: 0, until: 0 }
  }
}

function saveLockout(entry: LockoutEntry) {
  localStorage.setItem(LOCKOUT_KEY, JSON.stringify(entry))
}

function clearLockout(email: string) {
  const raw = localStorage.getItem(LOCKOUT_KEY)
  if (!raw) return
  try {
    const parsed: LockoutEntry = JSON.parse(raw)
    if (parsed.email === email) localStorage.removeItem(LOCKOUT_KEY)
  } catch { /* noop */ }
}

const AUTH_API_SETUP  = 'http://localhost:3001/api/auth/2fa/setup'
const AUTH_API_ENABLE = 'http://localhost:3001/api/auth/2fa/enable'
const AUTH_API_VERIFY = 'http://localhost:3001/api/auth/2fa/verify'

export interface LoginResult {
  error:        string | null
  requires2fa?: boolean   // 2FA configurado — pede código
  needsSetup?:  boolean   // 2FA não configurado — pede QR setup
  userId?:      string
}

// ─── Tipos expostos ───────────────────────────────────────────────────────────
interface AuthState {
  user:            AppUser | null
  authLoading:     boolean
  login:           (email: string, password: string) => Promise<LoginResult>
  getSetup2fa:     (userId: string) => Promise<{ qr: string; secret: string } | string>
  confirmSetup2fa: (userId: string, token: string) => Promise<string | null>
  verify2fa:       (userId: string, token: string) => Promise<string | null>
  logout:          () => Promise<void>
  can:             (permission: Permission) => boolean
  canPortal:       (portal: string) => boolean
  isAdmin:         boolean
  lockoutInfo:     (email: string) => { locked: boolean; remaining: number; attempts: number }
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const stored = sessionStorage.getItem(SESSION_KEY)
  const [user, setUser]           = useState<AppUser | null>(stored ? JSON.parse(stored) : null)
  const [dbUsers, setDbUsers]     = useState<(AppUser & { password: string })[]>([])
  const [authLoading, setAuthLoading] = useState(true)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const warnRef  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const resetRef = useRef<(() => void) | null>(null)
  const [showWarning, setShowWarning] = useState(false)

  // ── Carregar utilizadores da base de dados ─────────────────────────────────
  useEffect(() => {
    fetch(API)
      .then(r => r.json())
      .then((rows: (AppUser & { password: string })[]) => {
        setDbUsers(rows)
      })
      .catch(() => console.warn('[auth] Não foi possível carregar utilizadores da BD'))
      .finally(() => setAuthLoading(false))
  }, [])

  // ── Inatividade — logout automático após 30 min + aviso 2 min antes ───────
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
        sessionStorage.removeItem(SESSION_KEY)
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

  /** Devolve info de bloqueio para mostrar na UI de login */
  function lockoutInfo(email: string) {
    const entry = getLockout(email)
    const now   = Date.now()
    const locked    = entry.until > now
    const remaining = locked ? Math.ceil((entry.until - now) / 1000) : 0
    return { locked, remaining, attempts: entry.count }
  }

  async function login(email: string, password: string): Promise<LoginResult> {
    const now   = Date.now()
    const entry = getLockout(email)

    // ── Verificar bloqueio activo ──────────────────────────────────────────
    if (entry.until > now) {
      const mins = Math.ceil((entry.until - now) / 60000)
      return { error: `Conta bloqueada por excesso de tentativas. Tente novamente em ${mins} min.` }
    }

    // ── Validar credenciais contra a base de dados ─────────────────────────
    const found = dbUsers.find(u => u.email === email && u.password === password && u.active)

    if (!found) {
      const newCount = entry.count + 1
      const until    = newCount >= MAX_ATTEMPTS ? now + LOCKOUT_MS : 0
      saveLockout({ email, count: newCount, until })

      sessionStorage.setItem(SESSION_KEY, JSON.stringify({ id: 'unknown', name: email }))
      useStore.getState().addAuditLog({
        action: 'LOGIN_FAILED',
        entity: 'Sessão',
        entity_label: `Tentativa falhada (${newCount}/${MAX_ATTEMPTS}) — ${email}`,
      })
      sessionStorage.removeItem(SESSION_KEY)

      if (newCount >= MAX_ATTEMPTS) {
        return { error: `Conta bloqueada após ${MAX_ATTEMPTS} tentativas falhadas. Tente novamente em 15 minutos.` }
      }

      const restantes = MAX_ATTEMPTS - newCount
      return { error: `Credenciais incorretas. Verifique o email e a password. (${restantes} tentativa${restantes === 1 ? '' : 's'} restante${restantes === 1 ? '' : 's'})` }
    }

    // ── 2FA: sempre obrigatório após credenciais válidas ──────────────────
    const u2fa = found as AppUser & { password: string; totp_enabled?: boolean; totp_secret?: string }
    if (!u2fa.totp_enabled) {
      // Sem 2FA configurado — utilizador precisa de configurar agora
      return { error: null, needsSetup: true, userId: found.id }
    }
    // 2FA activo — pede código
    return { error: null, requires2fa: true, userId: found.id }
  }

  function completeLogin(appUser: AppUser, email: string) {
    clearLockout(email)
    setUser(appUser)
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(appUser))
    useStore.getState().addAuditLog({
      action: 'LOGIN',
      entity: 'Sessão',
      entity_label: `${appUser.name} (${appUser.email})`,
    })
  }

  function findUser(userId: string) {
    return dbUsers.find(u => u.id === userId) ?? null
  }

  /** Gera QR code de setup (chamado no 1.º login) */
  async function getSetup2fa(userId: string): Promise<{ qr: string; secret: string } | string> {
    try {
      const res = await fetch(`${AUTH_API_SETUP}/${userId}`)
      if (!res.ok) { const d = await res.json(); return d.error ?? 'Erro ao gerar QR code' }
      return await res.json()
    } catch {
      return 'Erro de ligação ao servidor'
    }
  }

  /** Confirma código após setup — ativa 2FA e completa o login */
  async function confirmSetup2fa(userId: string, token: string): Promise<string | null> {
    try {
      const res = await fetch(AUTH_API_ENABLE, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ userId, token }),
      })
      if (!res.ok) { const d = await res.json(); return d.error ?? 'Código inválido' }
      const found = findUser(userId)
      if (!found) return 'Utilizador não encontrado'
      const { password: _pw, ...appUser } = found
      completeLogin(appUser as AppUser, appUser.email)
      return null
    } catch {
      return 'Erro de ligação ao servidor'
    }
  }

  /** Verifica código TOTP no login normal */
  async function verify2fa(userId: string, token: string): Promise<string | null> {
    try {
      const res = await fetch(AUTH_API_VERIFY, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ userId, token }),
      })
      if (!res.ok) { const d = await res.json(); return d.error ?? 'Código inválido' }
      const found = findUser(userId)
      if (!found) return 'Utilizador não encontrado'
      const { password: _pw, ...appUser } = found
      completeLogin(appUser as AppUser, appUser.email)
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
    sessionStorage.removeItem(SESSION_KEY)
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
      user, authLoading, login, getSetup2fa, confirmSetup2fa, verify2fa,
      logout, can, canPortal, lockoutInfo,
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
