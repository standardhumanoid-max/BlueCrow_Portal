import { useState, useEffect } from 'react'
import { Users, ClipboardList, Shield, LogOut, LayoutGrid, Plus, Pencil, Trash2, X, Eye, EyeOff, Check, Smartphone, ShieldOff, Megaphone } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { Auditoria }      from '@/pages/Auditoria'
import { Ciberseguranca } from '@/pages/Ciberseguranca'
import { ROLE_LABELS, ROLE_COLORS, type Role, type Portal } from '@/config/users'

import { API_BASE, authFetch } from '@/lib/api'
const ADMIN_API    = `${API_BASE}/api/admin`
const AUTH_API     = `${API_BASE}/api/auth`
const SETTINGS_API = `${API_BASE}/api/settings`

type Section = 'utilizadores' | 'auditoria' | 'ciberseguranca' | 'comunicados'

interface DBUser {
  id:           string
  email:        string
  name:         string
  initials:     string
  role:         Role
  portals:      Portal[]
  active:       boolean
  totp_enabled: boolean
  created_at?:  string
}

const EMPTY_FORM = {
  id:        '',
  email:     '',
  name:      '',
  initials:  '',
  role:      'viewer' as Role,
  active:    true,
  password:  '',
  portals:   [] as Portal[],
}

const ALL_PORTALS: { key: Portal; label: string }[] = [
  { key: 'compliance',     label: 'Compliance' },
  { key: 'asset_valuation', label: 'Avaliação de Ativos' },
]

// ── Sidebar nav items ─────────────────────────────────────────────────────────
const NAV: { id: Section; label: string; icon: React.ReactNode }[] = [
  { id: 'utilizadores',  label: 'Utilizadores',        icon: <Users         size={16} /> },
  { id: 'auditoria',     label: 'Registo de Auditoria', icon: <ClipboardList size={16} /> },
  { id: 'ciberseguranca', label: 'Cibersegurança',      icon: <Shield        size={16} /> },
  { id: 'comunicados',   label: 'Comunicados',          icon: <Megaphone     size={16} /> },
]

// ── AdminPortal root ──────────────────────────────────────────────────────────
export function AdminPortal({ onBackToHub }: { onBackToHub: () => void }) {
  const { user, logout } = useAuth()
  const [section, setSection] = useState<Section>('utilizadores')

  return (
    <div className="flex h-screen overflow-hidden bg-slate-950">
      {/* Sidebar */}
      <aside className="w-60 flex flex-col bg-slate-900 border-r border-white/5 shrink-0">
        {/* Logo */}
        <div className="px-5 py-5 border-b border-white/5">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-white/10 border border-white/20 flex items-center justify-center">
              <img src="/simbolo.ico" alt="BlueCrow" className="w-4 h-4 object-contain" style={{ filter: 'brightness(0) invert(1)' }} />
            </div>
            <div>
              <div className="text-white text-[13px] font-semibold leading-none">Painel Admin</div>
              <div className="text-slate-500 text-[10px] mt-0.5">Administração da plataforma</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {NAV.map(item => (
            <button
              key={item.id}
              onClick={() => setSection(item.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[12px] font-medium transition-colors text-left ${
                section === item.id
                  ? 'bg-white/10 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>

        {/* User + actions */}
        {user && (
          <div className="px-4 py-4 border-t border-white/5 space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white text-[9px] font-bold">
                {user.initials}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-slate-200 text-[11px] font-semibold leading-none truncate">{user.name.split(' ')[0]}</div>
                <div className="text-slate-500 text-[9px] mt-0.5 capitalize">{user.role}</div>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={onBackToHub}
                className="flex-1 flex items-center justify-center gap-1.5 text-[11px] font-medium text-slate-400 hover:text-white hover:bg-white/10 px-2.5 py-1.5 rounded-lg transition-colors border border-white/10"
              >
                <LayoutGrid size={11} />
                Portal
              </button>
              <button
                onClick={() => { logout(); onBackToHub() }}
                className="flex-1 flex items-center justify-center gap-1.5 text-[11px] font-medium text-slate-400 hover:text-red-400 hover:bg-red-500/10 px-2.5 py-1.5 rounded-lg transition-colors border border-white/10"
              >
                <LogOut size={11} />
                Sair
              </button>
            </div>
          </div>
        )}
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto bg-[#f5f6fa]">
        {section === 'utilizadores'   && <UtilizadoresAdmin />}
        {section === 'auditoria'      && <Auditoria />}
        {section === 'ciberseguranca' && <Ciberseguranca />}
        {section === 'comunicados'    && <ComunicadosAdmin />}
      </main>
    </div>
  )
}

// ── Utilizadores CRUD ─────────────────────────────────────────────────────────
function UtilizadoresAdmin() {
  const { user: me } = useAuth()
  const [users,    setUsers]   = useState<DBUser[]>([])
  const [loading,  setLoading] = useState(true)
  const [modal,    setModal]   = useState<'create' | 'edit' | null>(null)
  const [form,     setForm]    = useState(EMPTY_FORM)
  const [saving,   setSaving]  = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [showPw,   setShowPw]  = useState(false)
  const [error,    setError]   = useState<string | null>(null)

  async function disable2FA(u: DBUser) {
    if (!window.confirm(`Repor 2FA para ${u.name}?\nO utilizador terá de configurar novamente no próximo login.`)) return
    try {
      await authFetch(`${AUTH_API}/2fa/${u.id}`, { method: 'DELETE' })
      await loadUsers()
    } catch { /* noop */ }
  }

  async function loadUsers() {
    setLoading(true)
    try {
      const res = await authFetch(`${ADMIN_API}/users`)
      if (!res.ok) throw new Error(await res.text())
      const rows: DBUser[] = await res.json()
      setUsers(rows.map(r => ({ ...r, portals: r.portals ?? [] })))
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadUsers() }, [])

  function openCreate() {
    setForm(EMPTY_FORM)
    setShowPw(false)
    setError(null)
    setModal('create')
  }

  function openEdit(u: DBUser) {
    setForm({ id: u.id, email: u.email, name: u.name, initials: u.initials, role: u.role, active: u.active, password: '', portals: u.portals ?? [] })
    setShowPw(false)
    setError(null)
    setModal('edit')
  }

  async function handleSave() {
    setError(null)
    if (!form.email || !form.name || !form.initials) { setError('Email, nome e iniciais são obrigatórios.'); return }
    if (modal === 'create' && !form.password)        { setError('Password é obrigatória para novo utilizador.'); return }
    setSaving(true)
    try {
      const body = {
        ...(modal === 'edit' ? { id: form.id } : {}),
        email:    form.email,
        name:     form.name,
        initials: form.initials.toUpperCase(),
        role:     form.role,
        active:   form.active,
        portals:  form.portals,
        ...(form.password ? { password: form.password } : {}),
      }
      const res = await authFetch(`${ADMIN_API}/users`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? 'Erro desconhecido') }
      setModal(null)
      await loadUsers()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Eliminar utilizador? Esta acção é irreversível.')) return
    setDeleting(id)
    try {
      await authFetch(`${ADMIN_API}/users/${id}`, { method: 'DELETE' })
      await loadUsers()
    } finally {
      setDeleting(null)
    }
  }

  function togglePortal(key: Portal) {
    setForm(f => ({
      ...f,
      portals: f.portals.includes(key) ? f.portals.filter(p => p !== key) : [...f.portals, key],
    }))
  }

  const active = users.filter(u => u.active).length

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Gestão de Utilizadores</h1>
          <p className="text-sm text-gray-400 mt-0.5">{active} ativos · {users.length} total</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-white text-[13px] font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <Plus size={15} />
          Novo utilizador
        </button>
      </div>

      {error && !modal && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-[13px] rounded-lg px-4 py-3">{error}</div>
      )}

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">Utilizadores</h2>
        </div>
        {loading ? (
          <div className="py-12 text-center text-sm text-gray-400">A carregar…</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-[10px] text-gray-500 uppercase tracking-wide">
                  <th className="px-5 py-3 text-left font-medium">Nome</th>
                  <th className="px-5 py-3 text-left font-medium">Email</th>
                  <th className="px-5 py-3 text-left font-medium">Perfil</th>
                  <th className="px-5 py-3 text-left font-medium">Portais</th>
                  <th className="px-5 py-3 text-center font-medium">Ativo</th>
                  <th className="px-5 py-3 text-center font-medium">2FA</th>
                  <th className="px-5 py-3 text-right font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => {
                  const isMe = u.id === me?.id
                  return (
                    <tr key={u.id} className={`border-b border-gray-50 hover:bg-gray-50/50 ${isMe ? 'bg-blue-50/30' : ''}`}>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-slate-800 text-white text-[10px] font-semibold flex items-center justify-center shrink-0">
                            {u.initials}
                          </div>
                          <div className="text-[12px] font-medium text-gray-900">
                            {u.name}
                            {isMe && <span className="ml-1.5 text-[10px] text-blue-600 font-semibold">(você)</span>}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <code className="text-[12px] text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded font-mono">{u.email}</code>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${ROLE_COLORS[u.role]}`}>
                          {ROLE_LABELS[u.role]}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex flex-wrap gap-1">
                          {(u.portals ?? []).length === 0
                            ? <span className="text-[11px] text-gray-400 italic">Nenhum</span>
                            : (u.portals ?? []).map(p => (
                              <span key={p} className="text-[10px] bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded font-medium">
                                {p === 'compliance' ? 'Compliance' : p === 'asset_valuation' ? 'Av. Ativos' : p}
                              </span>
                            ))
                          }
                        </div>
                      </td>
                      <td className="px-5 py-3 text-center">
                        {u.active
                          ? <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />
                          : <span className="w-2 h-2 rounded-full bg-gray-300 inline-block" />}
                      </td>
                      <td className="px-5 py-3 text-center">
                        {u.totp_enabled
                          ? <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-green-700 bg-green-50 border border-green-200 rounded-full px-2 py-0.5"><Smartphone size={9} />Ativo</span>
                          : <span className="text-[10px] text-gray-400">—</span>}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEdit(u)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                            title="Editar"
                          >
                            <Pencil size={13} />
                          </button>
                          {u.totp_enabled && (
                            <button
                              onClick={() => disable2FA(u)}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                              title="Repor 2FA"
                            >
                              <ShieldOff size={13} />
                            </button>
                          )}
                          {!isMe && (
                            <button
                              onClick={() => handleDelete(u.id)}
                              disabled={deleting === u.id}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-40"
                              title="Eliminar"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
              <h2 className="text-[15px] font-semibold text-gray-900">
                {modal === 'create' ? 'Novo Utilizador' : 'Editar Utilizador'}
              </h2>
              <button onClick={() => setModal(null)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X size={16} />
              </button>
            </div>

            {/* Modal body */}
            <div className="px-6 py-5 space-y-4">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-[12px] rounded-lg px-3.5 py-2.5">{error}</div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Nome completo</label>
                  <input
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-[13px] text-gray-900 focus:outline-none focus:ring-2 focus:ring-slate-400/40"
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Ana Silva"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Email</label>
                  <input
                    type="email"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-[13px] text-gray-900 focus:outline-none focus:ring-2 focus:ring-slate-400/40"
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="ana@bluecrow.pt"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Iniciais</label>
                  <input
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-[13px] text-gray-900 focus:outline-none focus:ring-2 focus:ring-slate-400/40 uppercase"
                    maxLength={3}
                    value={form.initials}
                    onChange={e => setForm(f => ({ ...f, initials: e.target.value.toUpperCase() }))}
                    placeholder="AS"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  Password {modal === 'edit' && <span className="normal-case text-gray-400 font-normal">(deixar vazio para manter)</span>}
                </label>
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 pr-9 text-[13px] text-gray-900 focus:outline-none focus:ring-2 focus:ring-slate-400/40"
                    value={form.password}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    placeholder={modal === 'create' ? 'Password obrigatória' : '••••••••'}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(p => !p)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    tabIndex={-1}
                  >
                    {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Perfil</label>
                  <select
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-[13px] text-gray-900 focus:outline-none focus:ring-2 focus:ring-slate-400/40"
                    value={form.role}
                    onChange={e => setForm(f => ({ ...f, role: e.target.value as Role }))}
                  >
                    {(Object.keys(ROLE_LABELS) as Role[]).map(r => (
                      <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Estado</label>
                  <select
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-[13px] text-gray-900 focus:outline-none focus:ring-2 focus:ring-slate-400/40"
                    value={form.active ? 'true' : 'false'}
                    onChange={e => setForm(f => ({ ...f, active: e.target.value === 'true' }))}
                  >
                    <option value="true">Ativo</option>
                    <option value="false">Inativo</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2">Acesso a portais</label>
                <div className="flex flex-wrap gap-2">
                  {ALL_PORTALS.map(p => {
                    const active = form.portals.includes(p.key)
                    return (
                      <button
                        key={p.key}
                        type="button"
                        onClick={() => togglePortal(p.key)}
                        className={`flex items-center gap-1.5 text-[12px] font-medium px-3 py-1.5 rounded-lg border transition-colors ${
                          active
                            ? 'bg-slate-800 border-slate-800 text-white'
                            : 'bg-white border-gray-200 text-gray-600 hover:border-slate-400'
                        }`}
                      >
                        {active && <Check size={11} />}
                        {p.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Modal footer */}
            <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-2.5">
              <button
                onClick={() => setModal(null)}
                className="px-4 py-2 text-[13px] text-gray-600 hover:text-gray-900 font-medium transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white text-[13px] font-semibold px-5 py-2 rounded-lg transition-colors"
              >
                {saving ? <><div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />A guardar…</> : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Comunicados Admin ──────────────────────────────────────────────────────────
function ComunicadosAdmin() {
  const [message, setMessage] = useState('')
  const [saved,   setSaved]   = useState('')
  const [saving,  setSaving]  = useState(false)
  const [status,  setStatus]  = useState<'idle' | 'ok' | 'error'>('idle')

  useEffect(() => {
    authFetch(`${SETTINGS_API}/announcement`)
      .then(r => r.json())
      .then(d => { setMessage(d.value ?? ''); setSaved(d.value ?? '') })
      .catch(() => {})
  }, [])

  async function handleSave() {
    setSaving(true)
    setStatus('idle')
    try {
      const res = await authFetch(`${SETTINGS_API}/announcement`, {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ value: message }),
      })
      if (!res.ok) throw new Error()
      setSaved(message)
      setStatus('ok')
    } catch {
      setStatus('error')
    } finally {
      setSaving(false)
    }
  }

  function handleClear() {
    setMessage('')
  }

  const isDirty = message !== saved

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Comunicados</h1>
        <p className="text-sm text-gray-400 mt-0.5">
          A mensagem aparece no topo de todos os portais enquanto estiver preenchida.
          Deixar vazio para ocultar a barra.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
        <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
          Mensagem
        </label>
        <textarea
          rows={4}
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 resize-none focus:outline-none focus:ring-2 focus:ring-slate-400/40 placeholder:text-gray-300"
          placeholder="Ex: Manutenção prevista para sábado às 10h. O portal poderá estar indisponível por cerca de 30 minutos."
          value={message}
          onChange={e => { setMessage(e.target.value); setStatus('idle') }}
        />

        {/* Preview */}
        {message.trim() && (
          <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 flex items-start gap-2.5">
            <Megaphone className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
            <p className="text-[12px] text-amber-800 leading-relaxed">{message}</p>
          </div>
        )}

        {status === 'ok' && (
          <p className="text-[12px] text-green-600 font-medium">Guardado com sucesso.</p>
        )}
        {status === 'error' && (
          <p className="text-[12px] text-red-600 font-medium">Erro ao guardar. Tenta novamente.</p>
        )}

        <div className="flex items-center gap-2 pt-1">
          {message.trim() && (
            <button
              onClick={handleClear}
              className="px-4 py-2 text-[13px] text-gray-500 hover:text-red-600 font-medium border border-gray-200 rounded-lg hover:border-red-200 hover:bg-red-50 transition-colors"
            >
              Limpar barra
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={saving || !isDirty}
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-[13px] font-semibold px-5 py-2 rounded-lg transition-colors ml-auto"
          >
            {saving
              ? <><div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />A guardar…</>
              : 'Publicar'
            }
          </button>
        </div>
      </div>
    </div>
  )
}
