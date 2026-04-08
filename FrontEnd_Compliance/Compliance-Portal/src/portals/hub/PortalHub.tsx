// ─────────────────────────────────────────────────────────────────────────────
// PORTAL HUB — BlueCrow Capital
// Para adicionar um novo portal:
//   1. Adiciona um novo objeto ao array PORTALS abaixo
//   2. Adiciona o seu PortalId ao tipo em App.tsx
//   3. Cria a pasta src/portals/<nome>/ com o código do portal
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/context/AuthContext'
import { Eye, EyeOff, Lock, Shield, LogOut, Smartphone } from 'lucide-react'

export type PortalId = 'compliance' | 'asset-valuation' | 'investment-analysis' | 'investor-relations' | 'admin-panel'

// Mapa PortalId → chave usada na tabela portal_users
const PORTAL_KEY: Partial<Record<PortalId, string>> = {
  'compliance':      'compliance',
  'asset-valuation': 'asset_valuation',
}

interface Portal {
  id:          PortalId
  title:       string
  subtitle:    string
  description: string
  gradient:    string
  iconPath:    string
  active:      boolean
  adminOnly?:  boolean
}

const PORTALS: Portal[] = [
  {
    id:          'asset-valuation',
    title:       'Avaliação de Ativos',
    subtitle:    'Asset Valuation',
    description: 'Modelos de avaliação, due diligence e reporting de ativos imobiliários e capital de risco.',
    gradient:    'from-amber-800 via-orange-900 to-stone-900',
    iconPath:    'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M9 22V12h6v10',
    active:      true,
  },
  {
    id:          'investment-analysis',
    title:       'Análise de Investimentos',
    subtitle:    'Investment Analysis',
    description: 'Pipeline de deal flow, análise quantitativa e acompanhamento de portfólio.',
    gradient:    'from-emerald-800 via-teal-900 to-slate-900',
    iconPath:    'M3 3v18h18 M18 9l-5 5-4-4-4 4',
    active:      false,
  },
  {
    id:          'compliance',
    title:       'Compliance',
    subtitle:    'Compliance Portal',
    description: 'Gestão regulatória, PBCFT, RGPD, controlo interno e reporte à CMVM.',
    gradient:    'from-blue-800 via-indigo-900 to-slate-900',
    iconPath:    'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z M9 12l2 2 4-4',
    active:      true,
  },
  {
    id:          'investor-relations',
    title:       'Relação com Investidores',
    subtitle:    'Investor Relations',
    description: 'Comunicação com investidores, relatórios de fundo e gestão de capital calls.',
    gradient:    'from-violet-800 via-purple-900 to-slate-900',
    iconPath:    'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M23 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75',
    active:      false,
  },
  {
    id:          'admin-panel',
    title:       'Painel Administrador',
    subtitle:    'Admin Panel',
    description: 'Gestão de utilizadores, registo de auditoria e cibersegurança. Transversal a toda a plataforma.',
    gradient:    'from-slate-700 via-slate-800 to-slate-900',
    iconPath:    'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z M12 8v4 M12 16h.01',
    active:      true,
    adminOnly:   true,
  },
]

// ── Background pattern (subtle dots) ─────────────────────────────────────────
const DOT_PATTERN = `url("data:image/svg+xml,%3Csvg width='20' height='20' viewBox='0 0 20 20' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='1' cy='1' r='1' fill='white' fill-opacity='0.05'/%3E%3C/svg%3E")`

interface Props {
  onSelectPortal: (id: PortalId) => void
}

export function PortalHub({ onSelectPortal }: Props) {
  const { user, login, getSetup2fa, confirmSetup2fa, verify2fa, logout, lockoutInfo, authLoading } = useAuth()

  // ── Login form state ───────────────────────────────────────────────────────
  const [step,        setStep]       = useState<'credentials' | '2fa' | 'setup'>('credentials')
  const [pendingId,   setPendingId]  = useState<string>('')
  const [email,       setEmail]      = useState('')
  const [password,    setPassword]   = useState('')
  const [showPw,      setShowPw]     = useState(false)
  const [totpToken,   setTotpToken]  = useState('')
  const [setupQr,     setSetupQr]    = useState('')
  const [setupSecret, setSetupSecret] = useState('')
  const [error,       setError]      = useState<string | null>(null)
  const [loading,     setLoading]    = useState(false)
  const [locked,      setLocked]     = useState(false)
  const [remaining,   setRemaining]  = useState(0)
  const [attempts,    setAttempts]   = useState(0)

  const refreshLockout = useCallback(() => {
    const info = lockoutInfo(email.trim())
    setLocked(info.locked); setRemaining(info.remaining); setAttempts(info.attempts)
  }, [email, lockoutInfo])

  useEffect(() => { refreshLockout() }, [refreshLockout])

  useEffect(() => {
    if (!locked) return
    const id = setInterval(() => {
      const info = lockoutInfo(email.trim())
      setRemaining(info.remaining)
      if (!info.locked) { setLocked(false); setError(null) }
    }, 1000)
    return () => clearInterval(id)
  }, [locked, email, lockoutInfo])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    if (locked) return
    setError(null); setLoading(true)
    const result = await login(email.trim(), password)
    if (result.error) {
      setError(result.error); refreshLockout()
    } else if (result.needsSetup && result.userId) {
      // Primeiro login — gerar QR e mostrar ecrã de setup
      setPendingId(result.userId)
      const setup = await getSetup2fa(result.userId)
      if (typeof setup === 'string') { setError(setup) }
      else { setSetupQr(setup.qr); setSetupSecret(setup.secret); setTotpToken(''); setStep('setup') }
    } else if (result.requires2fa && result.userId) {
      setPendingId(result.userId)
      setTotpToken(''); setStep('2fa')
    }
    setLoading(false)
  }

  async function handleConfirmSetup(e: React.FormEvent) {
    e.preventDefault()
    setError(null); setLoading(true)
    const err = await confirmSetup2fa(pendingId, totpToken)
    if (err) setError(err)
    else setStep('credentials')
    setLoading(false)
  }

  async function handle2FA(e: React.FormEvent) {
    e.preventDefault()
    setError(null); setLoading(true)
    const err = await verify2fa(pendingId, totpToken.replace(/\s/g, ''))
    if (err) setError(err)
    else setStep('credentials')
    setLoading(false)
  }

  function fmtRemaining(secs: number) {
    const m = Math.floor(secs / 60); const s = secs % 60
    return m > 0 ? `${m}m ${s}s` : `${s}s`
  }

  // ── Portal filtering ───────────────────────────────────────────────────────
  // Admin vê todos os portais (incluindo inativos, marcados como "em desenvolvimento")
  // Outros utilizadores vêem apenas os portais activos a que têm acesso
  const visiblePortals = user
    ? PORTALS.filter(p => {
        if (p.adminOnly) return user.role === 'admin'
        if (user.role === 'admin') return true
        if (!p.active) return false
        const key = PORTAL_KEY[p.id]
        if (!key) return true
        return user.portals?.includes(key as never) ?? false
      })
    : []

  const attemptsLeft      = Math.max(0, 5 - attempts)
  const showAttemptsWarn  = attempts > 0 && attempts < 5 && !locked

  return (
    <div
      className="min-h-screen bg-slate-900 flex flex-col relative overflow-hidden"
      style={{ backgroundImage: DOT_PATTERN }}
    >
      {/* ── Ingenuity helicopter — contorno decorativo ── */}
      <svg
        viewBox="0 0 520 380"
        fill="none"
        stroke="white"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="absolute bottom-0 right-0 w-[520px] opacity-[0.04] pointer-events-none select-none"
        aria-hidden="true"
      >
        {/* Corpo principal */}
        <rect x="195" y="190" width="130" height="80" rx="6" strokeWidth="3"/>
        {/* Painel solar */}
        <rect x="205" y="172" width="110" height="18" rx="3" strokeWidth="2.5"/>
        {/* Linha de ligação painel-corpo */}
        <line x1="260" y1="172" x2="260" y2="190" strokeWidth="2"/>
        {/* Mastro do rotor superior */}
        <line x1="260" y1="130" x2="260" y2="172" strokeWidth="3"/>
        {/* Hub rotor superior */}
        <circle cx="260" cy="126" r="10" strokeWidth="2.5"/>
        {/* Pás rotor superior (4 pás em X) */}
        <line x1="260" y1="126" x2="60"  y2="100" strokeWidth="2.5"/>
        <line x1="260" y1="126" x2="460" y2="100" strokeWidth="2.5"/>
        <line x1="260" y1="126" x2="60"  y2="152" strokeWidth="2.5"/>
        <line x1="260" y1="126" x2="460" y2="152" strokeWidth="2.5"/>
        {/* Dicas das pás superiores */}
        <ellipse cx="60"  cy="100" rx="14" ry="5" transform="rotate(-7 60 100)"  strokeWidth="2"/>
        <ellipse cx="460" cy="100" rx="14" ry="5" transform="rotate(7 460 100)"  strokeWidth="2"/>
        <ellipse cx="60"  cy="152" rx="14" ry="5" transform="rotate(7 60 152)"   strokeWidth="2"/>
        <ellipse cx="460" cy="152" rx="14" ry="5" transform="rotate(-7 460 152)" strokeWidth="2"/>
        {/* Hub rotor inferior */}
        <circle cx="260" cy="140" r="7" strokeWidth="2"/>
        {/* Pás rotor inferior (ligeiramente rodadas) */}
        <line x1="260" y1="140" x2="75"  y2="160" strokeWidth="2"/>
        <line x1="260" y1="140" x2="445" y2="160" strokeWidth="2"/>
        <line x1="260" y1="140" x2="75"  y2="120" strokeWidth="2"/>
        <line x1="260" y1="140" x2="445" y2="120" strokeWidth="2"/>
        {/* Pernas de aterragem */}
        <line x1="210" y1="270" x2="170" y2="330" strokeWidth="2.5"/>
        <line x1="310" y1="270" x2="350" y2="330" strokeWidth="2.5"/>
        <line x1="155" y1="330" x2="365" y2="330" strokeWidth="3"/>
        {/* Detalhe lateral do corpo */}
        <line x1="195" y1="210" x2="165" y2="220" strokeWidth="1.5"/>
        <line x1="325" y1="210" x2="355" y2="220" strokeWidth="1.5"/>
        <line x1="165" y1="220" x2="165" y2="255" strokeWidth="1.5"/>
        <line x1="355" y1="220" x2="355" y2="255" strokeWidth="1.5"/>
      </svg>
      {/* ── Header ── */}
      <header className="flex items-center justify-between px-10 pt-10 pb-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center">
            <img src="/simbolo.ico" alt="BlueCrow" className="w-6 h-6 object-contain" style={{ filter: 'brightness(0) invert(1)' }} />
          </div>
          <div>
            <div className="text-white font-bold text-[15px] leading-none">BlueCrow Capital</div>
            <div className="text-slate-400 text-[10px] font-medium uppercase tracking-widest mt-0.5">Plataforma Interna</div>
          </div>
        </div>

        <div className="flex items-center gap-5">
          {/* User info (quando autenticado) */}
          {user && (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white text-[10px] font-bold">
                  {user.initials}
                </div>
                <div>
                  <div className="text-slate-200 text-[12px] font-semibold leading-none">{user.name.split(' ')[0]}</div>
                  <div className="text-slate-500 text-[10px] mt-0.5 capitalize">{user.role}</div>
                </div>
              </div>
              <button
                onClick={() => logout()}
                className="flex items-center gap-1.5 text-slate-500 hover:text-slate-300 text-[11px] font-medium transition-colors px-2 py-1 rounded-lg hover:bg-white/5"
              >
                <LogOut size={12} />
                Sair
              </button>
            </div>
          )}
          <div className="text-slate-500 text-[11px]">
            {new Date().toLocaleDateString('pt-PT', { weekday:'long', day:'numeric', month:'long', year:'numeric' })}
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <div className="text-center px-6 pt-12 pb-10">
        <h1 className="text-white text-3xl font-bold tracking-tight">
          Portal Ingenuity
        </h1>
        <p className="text-slate-400 text-[14px] mt-2 max-w-md mx-auto">
          {user
            ? `Bem-vindo${user.role === 'admin' ? ' — acesso completo' : ''}, ${user.name.split(' ')[0]}. Selecione o portal que pretende aceder.`
            : 'Autentique-se para aceder aos portais disponíveis'}
        </p>
      </div>

      {/* ── Main ── */}
      <main className="flex-1 flex items-start justify-center px-8 pb-16">

        {/* ── Login form (quando não autenticado) ── */}
        {!user && (
          <div className="w-full max-w-sm">
            <div className="bg-white/5 border border-white/10 rounded-2xl px-8 py-8 shadow-2xl backdrop-blur-sm">

              {/* ── Step: credenciais ── */}
              {step === 'credentials' && (<>
                <div className="flex items-center gap-2.5 mb-7">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/20 border border-blue-400/20 flex items-center justify-center">
                    <Shield className="w-4 h-4 text-blue-400" />
                  </div>
                  <h2 className="text-[15px] font-semibold text-white">Acesso Restrito</h2>
                </div>

                {/* Bloqueio activo */}
                {locked && (
                  <div className="mb-6 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-4 text-center">
                    <Lock className="w-5 h-5 text-red-400 mx-auto mb-2" />
                    <div className="text-[13px] font-semibold text-red-300 mb-1">Acesso temporariamente bloqueado</div>
                    <div className="text-[11px] text-red-400/70 mb-3">5 tentativas falhadas foram registadas.</div>
                    <div className="text-[24px] font-mono font-bold text-red-400">{fmtRemaining(remaining)}</div>
                    <div className="text-[10px] text-red-500 mt-1">Desbloqueio automático</div>
                  </div>
                )}

                <form onSubmit={handleLogin} className="space-y-4">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Email</label>
                    <input
                      type="email"
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3.5 py-2.5 text-[13px] text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/40 transition-all disabled:opacity-40"
                      value={email}
                      onChange={e => { setEmail(e.target.value); setError(null) }}
                      placeholder="nome@bluecrow.pt"
                      autoComplete="email"
                      autoFocus
                      disabled={locked}
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Password</label>
                    <div className="relative">
                      <input
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3.5 py-2.5 pr-10 text-[13px] text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/40 transition-all disabled:opacity-40"
                        type={showPw ? 'text' : 'password'}
                        value={password}
                        onChange={e => { setPassword(e.target.value); setError(null) }}
                        placeholder="••••••••"
                        autoComplete="current-password"
                        disabled={locked}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPw(p => !p)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                        tabIndex={-1}
                        disabled={locked}
                      >
                        {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {showAttemptsWarn && (
                    <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3.5 py-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
                      <span className="text-[11px] text-amber-300">
                        {attemptsLeft} tentativa{attemptsLeft === 1 ? '' : 's'} restante{attemptsLeft === 1 ? '' : 's'} antes do bloqueio.
                      </span>
                    </div>
                  )}

                  {error && !locked && (
                    <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-3.5 py-2.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />
                      <span className="text-[12px] text-red-300">{error}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading || authLoading || !email || !password || locked}
                    className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-[13px] py-2.5 rounded-lg transition-all flex items-center justify-center gap-2 mt-2"
                  >
                    {authLoading
                      ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />A inicializar…</>
                      : loading
                      ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />A autenticar…</>
                      : locked
                      ? <><Lock className="w-4 h-4" />Bloqueado</>
                      : 'Entrar'}
                  </button>
                </form>
              </>)}

              {/* ── Step: setup 2FA (primeiro login) ── */}
              {step === 'setup' && (<>
                <div className="flex items-center gap-2.5 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-400/20 flex items-center justify-center">
                    <Smartphone className="w-4 h-4 text-indigo-400" />
                  </div>
                  <h2 className="text-[15px] font-semibold text-white">Configurar autenticação</h2>
                </div>
                <p className="text-[12px] text-slate-400 mb-5">
                  É necessário configurar a autenticação de dois fatores. Utilize o Google Authenticator ou Authy.
                </p>

                <form onSubmit={handleConfirmSetup} className="space-y-4">
                  <div className="space-y-2">
                    <p className="text-[11px] text-slate-400">1. Instale uma app autenticadora no seu telemóvel.</p>
                    <p className="text-[11px] text-slate-400">2. Digitalize o QR code:</p>
                    {setupQr && (
                      <div className="flex justify-center py-2">
                        <img src={setupQr} alt="QR Code 2FA" className="w-40 h-40 rounded-xl bg-white p-1" />
                      </div>
                    )}
                    <div>
                      <p className="text-[10px] text-slate-500 mb-1">Chave manual:</p>
                      <code className="block text-[10px] bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 font-mono text-slate-300 break-all select-all">{setupSecret}</code>
                    </div>
                    <p className="text-[11px] text-slate-400">3. Introduza o código gerado pela app:</p>
                  </div>

                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3.5 py-3 text-[22px] font-mono tracking-[0.3em] text-center text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                    value={totpToken}
                    onChange={e => { setTotpToken(e.target.value.replace(/\D/g, '').slice(0, 6)); setError(null) }}
                    placeholder="000000"
                    autoFocus
                  />

                  {error && (
                    <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-3.5 py-2.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />
                      <span className="text-[12px] text-red-300">{error}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading || totpToken.length < 6}
                    className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-[13px] py-2.5 rounded-lg transition-all flex items-center justify-center gap-2"
                  >
                    {loading
                      ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />A ativar…</>
                      : 'Ativar e entrar'}
                  </button>
                </form>
              </>)}

              {/* ── Step: 2FA ── */}
              {step === '2fa' && (<>
                <div className="flex items-center gap-2.5 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-400/20 flex items-center justify-center">
                    <Smartphone className="w-4 h-4 text-indigo-400" />
                  </div>
                  <h2 className="text-[15px] font-semibold text-white">Verificação em 2 passos</h2>
                </div>
                <p className="text-[12px] text-slate-400 mb-7">
                  Introduza o código de 6 dígitos gerado pela sua app autenticadora.
                </p>

                <form onSubmit={handle2FA} className="space-y-4">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Código de autenticação</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9 ]*"
                      maxLength={7}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3.5 py-3 text-[22px] font-mono tracking-[0.3em] text-center text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/40 transition-all"
                      value={totpToken}
                      onChange={e => { setTotpToken(e.target.value.replace(/\D/g, '').slice(0, 6)); setError(null) }}
                      placeholder="000000"
                      autoFocus
                    />
                  </div>

                  {error && (
                    <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-3.5 py-2.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />
                      <span className="text-[12px] text-red-300">{error}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading || totpToken.length < 6}
                    className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-[13px] py-2.5 rounded-lg transition-all flex items-center justify-center gap-2"
                  >
                    {loading
                      ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />A verificar…</>
                      : 'Verificar'}
                  </button>

                  <button
                    type="button"
                    onClick={() => { setStep('credentials'); setError(null); setTotpToken('') }}
                    className="w-full text-[12px] text-slate-500 hover:text-slate-300 transition-colors py-1"
                  >
                    ← Voltar ao início de sessão
                  </button>
                </form>
              </>)}
            </div>

            <p className="text-center text-[11px] text-slate-600 mt-5">
              Portal de uso interno · BlueCrow · Acesso monitorizado
            </p>
          </div>
        )}

        {/* ── Portal cards (quando autenticado) ── */}
        {user && (
          visiblePortals.length > 0 ? (
            <div className="grid grid-cols-2 gap-5 w-full max-w-4xl">
              {visiblePortals.map((portal) => (
                <PortalCard
                  key={portal.id}
                  portal={portal}
                  onClick={() => portal.active && onSelectPortal(portal.id)}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-20">
              <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-4">
                <Shield className="w-5 h-5 text-slate-500" />
              </div>
              <p className="text-slate-300 text-[15px] font-medium">Sem portais disponíveis</p>
              <p className="text-slate-500 text-[12px] mt-1">O seu perfil não tem acesso a nenhum portal. Contacte o administrador.</p>
            </div>
          )
        )}
      </main>

      {/* ── Footer ── */}
      <footer className="text-center pb-6">
        <p className="text-slate-600 text-[10px] uppercase tracking-widest font-medium">
          BlueCrow Capital · Uso Exclusivamente Interno · Acesso Monitorizado
        </p>
      </footer>
    </div>
  )
}

// ── Portal Card ───────────────────────────────────────────────────────────────
function PortalCard({ portal, onClick }: { portal: Portal; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={!portal.active}
      className={`
        relative group text-left rounded-2xl overflow-hidden border transition-all duration-300
        ${portal.active
          ? 'border-white/10 hover:border-white/30 hover:scale-[1.02] hover:shadow-2xl cursor-pointer'
          : 'border-white/5 cursor-default opacity-70'
        }
      `}
    >
      {/* Gradient background */}
      <div className={`absolute inset-0 bg-gradient-to-br ${portal.gradient}`} />

      {/* Dot overlay */}
      <div className="absolute inset-0 opacity-30" style={{ backgroundImage: DOT_PATTERN }} />

      {/* Glow effect on active hover */}
      {portal.active && (
        <div className="absolute inset-0 bg-white/0 group-hover:bg-white/5 transition-colors duration-300" />
      )}

      {/* Large background icon (decorative) */}
      <div className="absolute -bottom-4 -right-4 opacity-[0.07]">
        <svg width="140" height="140" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
          <path d={portal.iconPath} />
        </svg>
      </div>

      {/* Content */}
      <div className="relative p-7">
        {/* Icon */}
        <div className="w-11 h-11 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center mb-5">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d={portal.iconPath} />
          </svg>
        </div>

        {/* Badge */}
        {!portal.active && (
          <div className="inline-flex items-center gap-1 bg-white/10 border border-white/20 rounded-full px-2.5 py-0.5 mb-3">
            <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            <span className="text-[10px] font-medium text-white/70 uppercase tracking-wide">Em desenvolvimento</span>
          </div>
        )}
        {portal.active && portal.adminOnly && (
          <div className="inline-flex items-center gap-1 bg-white/10 border border-white/20 rounded-full px-2.5 py-0.5 mb-3">
            <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            <span className="text-[10px] font-medium text-white/70 uppercase tracking-wide">Administrador</span>
          </div>
        )}
        {portal.active && !portal.adminOnly && (
          <div className="inline-flex items-center gap-1 bg-white/10 border border-white/20 rounded-full px-2.5 py-0.5 mb-3">
            <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
            <span className="text-[10px] font-medium text-white/70 uppercase tracking-wide">Disponível</span>
          </div>
        )}

        {/* Title */}
        <div className="text-white font-bold text-[18px] leading-tight">{portal.title}</div>
        <div className="text-white/40 text-[10px] font-medium uppercase tracking-widest mt-0.5">{portal.subtitle}</div>

        {/* Description */}
        <p className="text-white/60 text-[12px] leading-relaxed mt-3">{portal.description}</p>

        {/* CTA */}
        {portal.active && (
          <div className="mt-5 flex items-center gap-2 text-white/80 text-[12px] font-semibold group-hover:text-white transition-colors">
            <span>Aceder</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="group-hover:translate-x-1 transition-transform">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </div>
        )}
      </div>
    </button>
  )
}
