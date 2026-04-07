import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/context/AuthContext'
import { Eye, EyeOff, Shield, Lock } from 'lucide-react'

export function Login({ onBack }: { onBack?: () => void }) {
  const { login, lockoutInfo } = useAuth()
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [showPw,   setShowPw]   = useState(false)
  const [error,    setError]    = useState<string | null>(null)
  const [loading,  setLoading]  = useState(false)

  // Estado de bloqueio reactivo (actualiza a contagem decrescente)
  const [locked,     setLocked]     = useState(false)
  const [remaining,  setRemaining]  = useState(0)
  const [attempts,   setAttempts]   = useState(0)

  const refreshLockout = useCallback(() => {
    const info = lockoutInfo(email.trim())
    setLocked(info.locked)
    setRemaining(info.remaining)
    setAttempts(info.attempts)
  }, [email, lockoutInfo])

  // Actualiza quando o email muda
  useEffect(() => { refreshLockout() }, [refreshLockout])

  // Contagem decrescente enquanto bloqueado
  useEffect(() => {
    if (!locked) return
    const id = setInterval(() => {
      const info = lockoutInfo(email.trim())
      setRemaining(info.remaining)
      if (!info.locked) { setLocked(false); setError(null) }
    }, 1000)
    return () => clearInterval(id)
  }, [locked, email, lockoutInfo])

  function fmtRemaining(secs: number) {
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return m > 0 ? `${m}m ${s}s` : `${s}s`
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (locked) return
    setError(null)
    setLoading(true)
    const err = await login(email.trim(), password)
    if (err) {
      setError(err)
      refreshLockout()
    }
    setLoading(false)
  }

  const attemptsLeft = Math.max(0, 5 - attempts)
  const showAttemptsWarning = attempts > 0 && attempts < 5 && !locked

  return (
    <div className="min-h-screen bg-[#f5f6fa] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {onBack && (
          <button onClick={onBack} className="flex items-center gap-1.5 text-[12px] text-gray-400 hover:text-gray-600 mb-4 transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
            Voltar ao hub
          </button>
        )}

        {/* Logo card */}
        <div className="bg-[#0f1f3d] rounded-2xl px-8 py-6 mb-6 text-center shadow-xl">
          <div className="w-16 h-16 mx-auto mb-4">
            <img src="/simbolo.ico" alt="BlueCrow" className="w-16 h-16 object-contain" />
          </div>
          <div className="text-white font-bold text-lg leading-tight">BlueCrow</div>
          <div className="text-blue-200 text-[12px] font-semibold mt-0.5">Compliance</div>
          <div className="text-blue-400 text-[10px] mt-1 uppercase tracking-widest">Portal Interno</div>
        </div>

        {/* Form card */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-8 py-7">
          <div className="flex items-center gap-2 mb-6">
            <Shield className="w-4 h-4 text-blue-600" />
            <h1 className="text-[14px] font-semibold text-gray-900">Acesso Restrito</h1>
          </div>

          {/* Bloqueio activo */}
          {locked && (
            <div className="mb-5 bg-red-50 border border-red-200 rounded-xl px-4 py-4 text-center">
              <Lock className="w-6 h-6 text-red-500 mx-auto mb-2" />
              <div className="text-[13px] font-semibold text-red-700 mb-1">Acesso temporariamente bloqueado</div>
              <div className="text-[11px] text-red-500 mb-3">5 tentativas falhadas foram registadas.</div>
              <div className="text-[22px] font-mono font-bold text-red-600">{fmtRemaining(remaining)}</div>
              <div className="text-[10px] text-red-400 mt-1">Desbloqueio automático</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                Email
              </label>
              <input
                type="email"
                className="w-full border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all disabled:bg-gray-50 disabled:text-gray-400"
                value={email}
                onChange={e => { setEmail(e.target.value); setError(null) }}
                placeholder="nome@bluecrow.pt"
                autoComplete="email"
                autoFocus
                disabled={locked}
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  className="w-full border border-gray-200 rounded-lg px-3.5 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all disabled:bg-gray-50 disabled:text-gray-400"
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
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  tabIndex={-1}
                  disabled={locked}
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Aviso de tentativas restantes */}
            {showAttemptsWarning && (
              <div className="flex items-center gap-2 bg-amber-50 border border-amber-100 rounded-lg px-3.5 py-2">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" />
                <span className="text-[11px] text-amber-700">
                  {attemptsLeft} tentativa{attemptsLeft === 1 ? '' : 's'} restante{attemptsLeft === 1 ? '' : 's'} antes do bloqueio.
                </span>
              </div>
            )}

            {/* Erro genérico (sem bloqueio) */}
            {error && !locked && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-lg px-3.5 py-2.5">
                <div className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
                <span className="text-[12px] text-red-700">{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !email || !password || locked}
              className="w-full bg-[#1e3a5f] hover:bg-[#162d4a] disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-[13px] py-2.5 rounded-lg transition-all flex items-center justify-center gap-2 mt-2"
            >
              {loading
                ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />A autenticar…</>
                : locked
                ? <><Lock className="w-4 h-4" />Bloqueado</>
                : 'Entrar'
              }
            </button>
          </form>
        </div>

        <p className="text-center text-[11px] text-gray-400 mt-4">
          Portal de uso interno · BlueCrow · Acesso monitorizado
        </p>
      </div>
    </div>
  )
}
