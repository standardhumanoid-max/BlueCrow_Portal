import { useState, useEffect, useCallback } from 'react'
import {
  LayoutGrid, LogOut, Landmark, Building2, Briefcase, TrendingUp,
  RefreshCw, Pencil, Check, X, ChevronRight, ChevronDown, FileSpreadsheet,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { authFetch, API_BASE } from '@/lib/api'
import { ParticpadasSection } from './pages/ParticpadasSection'
import { BalanceteAnalyzer }  from './pages/BalanceteAnalyzer'

const API = `${API_BASE}/api/bc-funds`

type Section = 'fundos' | 'participadas' | 'balancete' | 'asset-finance'

interface AiCompany { id: string; name: string; short_name: string | null; sector: string | null }

interface BcFund {
  id: number
  name: string
  short_name: string
  legal_type: string
  status: string
  is_subfund: boolean
  parent_fund_id: number | null
  vintage_year: number | null
  fund_term_years: number | null
  target_irr_pct: number | null
  target_moic: number | null
  capital_committed: number | null
  capital_called: number | null
  capital_deployed: number | null
}

const NAV: { id: Section; label: string; icon: typeof Landmark }[] = [
  { id: 'fundos',        label: 'Fundos',          icon: Landmark        },
  { id: 'participadas',  label: 'Participadas',    icon: Building2       },
  { id: 'balancete',     label: 'Balancete',       icon: FileSpreadsheet },
  { id: 'asset-finance', label: 'Asset Finance',   icon: Briefcase       },
]

const LEGAL_LABEL: Record<string, string> = {
  FCR_FECHADO:  'FCR Fechado',
  FIAM_ABERTO:  'FIAM Aberto',
  FIAM_PPR:     'FIAM PPR',
}

function fmt(v: number | null, decimals = 1) {
  if (v == null) return '—'
  return v.toLocaleString('pt-PT', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}
function fmtM(v: number | null) {
  if (v == null) return '—'
  return `€${(v / 1_000_000).toLocaleString('pt-PT', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}M`
}
function fmtPct(v: number | null) {
  if (v == null) return '—'
  return `${fmt(v)}%`
}

// ── Fundo row (inline edit) ────────────────────────────────────────────────────
function FundRow({ fund, onSave }: { fund: BcFund; onSave: (id: number, patch: Partial<BcFund>) => Promise<void> }) {
  const [editing, setEditing] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [draft, setDraft] = useState<Partial<BcFund>>({})
  const [saving, setSaving] = useState(false)

  function startEdit() {
    setDraft({
      vintage_year:      fund.vintage_year,
      fund_term_years:   fund.fund_term_years,
      target_irr_pct:    fund.target_irr_pct,
      target_moic:       fund.target_moic,
      capital_committed: fund.capital_committed,
      capital_called:    fund.capital_called,
      capital_deployed:  fund.capital_deployed,
    })
    setEditing(true)
    setExpanded(true)
  }

  async function save() {
    setSaving(true)
    await onSave(fund.id, draft)
    setSaving(false)
    setEditing(false)
  }

  const dryPowder = (fund.capital_committed ?? 0) - (fund.capital_called ?? 0)
  const callPct   = fund.capital_committed ? ((fund.capital_called ?? 0) / fund.capital_committed * 100) : null

  return (
    <>
      <tr
        className={`border-b border-slate-100 hover:bg-slate-50 transition-colors cursor-pointer ${fund.is_subfund ? 'bg-slate-50/60' : ''}`}
        onClick={() => !editing && setExpanded(e => !e)}
      >
        <td className="px-4 py-2.5 text-[12px] text-slate-800 font-medium">
          <div className="flex items-center gap-1.5">
            {fund.is_subfund
              ? <span className="w-4 shrink-0" />
              : expanded
                ? <ChevronDown size={13} className="text-slate-400 shrink-0" />
                : <ChevronRight size={13} className="text-slate-400 shrink-0" />}
            <span className={fund.is_subfund ? 'text-slate-500' : ''}>{fund.name}</span>
          </div>
        </td>
        <td className="px-4 py-2.5 text-[11px] text-slate-500 font-mono">{fund.short_name}</td>
        <td className="px-4 py-2.5 text-[11px] text-slate-500">{fund.vintage_year ?? '—'}</td>
        <td className="px-4 py-2.5 text-[11px] text-slate-500">{fund.fund_term_years ? `${fund.fund_term_years}a` : '—'}</td>
        <td className="px-4 py-2.5 text-[11px] text-slate-700 text-right">{fmtM(fund.capital_committed)}</td>
        <td className="px-4 py-2.5 text-[11px] text-slate-700 text-right">{fmtM(fund.capital_called)}</td>
        <td className="px-4 py-2.5 text-[11px] text-slate-700 text-right">{fmtM(fund.capital_deployed)}</td>
        <td className="px-4 py-2.5 text-[11px] text-right">
          {dryPowder > 0
            ? <span className="text-emerald-600 font-medium">{fmtM(dryPowder)}</span>
            : <span className="text-slate-400">—</span>}
        </td>
        <td className="px-4 py-2.5 text-[11px] text-right">{fmtPct(fund.target_irr_pct)}</td>
        <td className="px-4 py-2.5 text-[11px] text-right">{fund.target_moic ? `${fmt(fund.target_moic)}x` : '—'}</td>
        <td className="px-4 py-2.5 text-right">
          <button
            onClick={e => { e.stopPropagation(); startEdit() }}
            className="text-slate-300 hover:text-emerald-600 transition-colors"
          >
            <Pencil size={12} />
          </button>
        </td>
      </tr>

      {expanded && (
        <tr className="border-b border-slate-100 bg-slate-50">
          <td colSpan={11} className="px-8 py-4">
            {editing ? (
              <div className="flex flex-wrap gap-4 items-end">
                {([
                  ['Vintage', 'vintage_year', 'number'],
                  ['Prazo (anos)', 'fund_term_years', 'number'],
                  ['IRR Alvo (%)', 'target_irr_pct', 'number'],
                  ['MOIC Alvo (x)', 'target_moic', 'number'],
                  ['Comprometido (€)', 'capital_committed', 'number'],
                  ['Capital Chamado (€)', 'capital_called', 'number'],
                  ['Capital Investido (€)', 'capital_deployed', 'number'],
                ] as [string, keyof BcFund, string][]).map(([label, key, type]) => (
                  <div key={key} className="flex flex-col gap-1 min-w-[140px]">
                    <label className="text-[10px] text-slate-500 font-medium uppercase tracking-wide">{label}</label>
                    <input
                      type={type}
                      step="any"
                      value={(draft[key] as number | null) ?? ''}
                      onChange={e => setDraft(d => ({ ...d, [key]: e.target.value === '' ? null : Number(e.target.value) }))}
                      className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-[12px] text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-400 bg-white w-full"
                    />
                  </div>
                ))}
                <div className="flex gap-2 pb-0.5">
                  <button
                    onClick={save}
                    disabled={saving}
                    className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-medium px-3 py-1.5 rounded-lg transition-colors"
                  >
                    <Check size={12} /> {saving ? 'A guardar…' : 'Guardar'}
                  </button>
                  <button
                    onClick={() => setEditing(false)}
                    className="flex items-center gap-1.5 text-slate-500 hover:text-slate-700 text-[11px] font-medium px-3 py-1.5 rounded-lg border border-slate-200 transition-colors"
                  >
                    <X size={12} /> Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-6 text-[11px] text-slate-500">
                <span>Capital chamado: <b className="text-slate-700">{callPct != null ? `${fmt(callPct)}%` : '—'}</b></span>
                <span>Dry Powder: <b className="text-emerald-600">{fmtM(dryPowder > 0 ? dryPowder : null)}</b></span>
                <span>Status: <b className="text-slate-700">{fund.status}</b></span>
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  )
}

// ── Fundos section ─────────────────────────────────────────────────────────────
function FundosSection() {
  const [funds, setFunds]     = useState<BcFund[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab]         = useState<'FCR_FECHADO' | 'FIAM'>('FCR_FECHADO')

  const load = useCallback(async () => {
    setLoading(true)
    const res = await authFetch(`${API}?portal=investment_analysis`)
    if (res.ok) setFunds(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  async function handleSave(id: number, patch: Partial<BcFund>) {
    await authFetch(`${API}/${id}?portal=investment_analysis`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    await load()
  }

  const fcr   = funds.filter(f => f.legal_type === 'FCR_FECHADO')
  const fiam  = funds.filter(f => f.legal_type !== 'FCR_FECHADO')
  const shown = tab === 'FCR_FECHADO' ? fcr : fiam

  const totalCommitted = funds.reduce((s, f) => s + (f.capital_committed ?? 0), 0)
  const totalDeployed  = funds.reduce((s, f) => s + (f.capital_deployed ?? 0), 0)
  const totalDryPowder = funds.reduce((s, f) => s + Math.max(0, (f.capital_committed ?? 0) - (f.capital_called ?? 0)), 0)

  return (
    <div className="flex-1 overflow-y-auto bg-[#f5f6fa]">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-[16px] font-semibold text-slate-800">Fundos</h1>
          <p className="text-[11px] text-slate-400 mt-0.5">Visão global — capital e performance por fundo</p>
        </div>
        <button onClick={load} className="text-slate-400 hover:text-slate-700 transition-colors">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* KPI cards */}
      <div className="px-6 pt-5 pb-2 grid grid-cols-4 gap-4">
        {[
          { label: 'Nº Fundos',          value: funds.filter(f => !f.is_subfund).length.toString(), color: 'text-slate-800' },
          { label: 'Capital Comprometido', value: fmtM(totalCommitted),  color: 'text-slate-800' },
          { label: 'Capital Investido',    value: fmtM(totalDeployed),   color: 'text-emerald-600' },
          { label: 'Dry Powder',           value: fmtM(totalDryPowder),  color: 'text-amber-600' },
        ].map(kpi => (
          <div key={kpi.label} className="bg-white rounded-xl border border-slate-200 px-4 py-3.5 shadow-sm">
            <div className="text-[10px] text-slate-400 font-medium uppercase tracking-wide mb-1">{kpi.label}</div>
            <div className={`text-[20px] font-semibold ${kpi.color}`}>{kpi.value}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="px-6 pt-4 pb-2 flex gap-2">
        {([['FCR_FECHADO', `FCR Fechado (${fcr.filter(f => !f.is_subfund).length})`], ['FIAM', `FIAM Abertos (${fiam.length})`]] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`text-[12px] font-medium px-3.5 py-1.5 rounded-lg transition-colors ${
              tab === key ? 'bg-emerald-600 text-white' : 'bg-white text-slate-500 hover:text-slate-800 border border-slate-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="px-6 pb-8">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-32 text-slate-400 text-[12px]">
              <RefreshCw size={14} className="animate-spin mr-2" /> A carregar…
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  {['Fundo', 'Código', 'Vintage', 'Prazo', 'Comprometido', 'Chamado', 'Investido', 'Dry Powder', 'IRR Alvo', 'MOIC', ''].map((h, i) => (
                    <th key={i} className={`px-4 py-2.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wide ${i >= 4 && i <= 9 ? 'text-right' : 'text-left'}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {shown.length === 0 ? (
                  <tr><td colSpan={11} className="px-4 py-8 text-center text-[12px] text-slate-400">Sem fundos nesta categoria</td></tr>
                ) : shown.map(f => (
                  <FundRow key={f.id} fund={f} onSave={handleSave} />
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Placeholder ────────────────────────────────────────────────────────────────
function PlaceholderSection({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="flex-1 flex items-center justify-center bg-[#f5f6fa]">
      <div className="text-center">
        <TrendingUp size={32} className="text-slate-300 mx-auto mb-3" />
        <div className="text-[14px] font-semibold text-slate-600">{title}</div>
        <div className="text-[12px] text-slate-400 mt-1">{subtitle}</div>
      </div>
    </div>
  )
}

// ── Portal root ────────────────────────────────────────────────────────────────
export function AnaliseInvestimentosPortal({ onBackToHub }: { onBackToHub: () => void }) {
  const { user, logout } = useAuth()
  const [section, setSection] = useState<Section>('fundos')
  const [companies, setCompanies] = useState<AiCompany[]>([])

  useEffect(() => {
    authFetch(`${API_BASE}/api/ai/companies`)
      .then(r => r.ok ? r.json() : [])
      .then(setCompanies)
      .catch(() => {})
  }, [])

  return (
    <div className="flex h-screen overflow-hidden bg-slate-950">
      {/* Sidebar */}
      <aside className="w-60 flex flex-col bg-slate-900 border-r border-white/5 shrink-0">
        <div className="px-5 py-5 border-b border-white/5">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-white/10 border border-white/20 flex items-center justify-center">
              <img src="/simbolo.ico" alt="BlueCrow" className="w-4 h-4 object-contain" style={{ filter: 'brightness(0) invert(1)' }} />
            </div>
            <div>
              <div className="text-white text-[13px] font-semibold leading-none">Análise</div>
              <div className="text-slate-500 text-[10px] mt-0.5">Análise de Investimentos</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {NAV.map(item => (
            <button
              key={item.id}
              onClick={() => setSection(item.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[12px] font-medium transition-colors text-left ${
                section === item.id ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <item.icon size={14} />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="px-4 py-4 border-t border-white/5 space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white text-[9px] font-bold">
              {user?.initials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-slate-200 text-[11px] font-semibold leading-none truncate">{user?.name.split(' ')[0]}</div>
              <div className="text-slate-500 text-[9px] mt-0.5 capitalize">{user?.role}</div>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={onBackToHub}
              className="flex-1 flex items-center justify-center gap-1.5 text-[11px] font-medium text-slate-400 hover:text-white hover:bg-white/10 px-2.5 py-1.5 rounded-lg transition-colors border border-white/10"
            >
              <LayoutGrid size={11} /> Portal
            </button>
            <button
              onClick={() => { logout(); onBackToHub() }}
              className="flex-1 flex items-center justify-center gap-1.5 text-[11px] font-medium text-slate-400 hover:text-red-400 hover:bg-red-500/10 px-2.5 py-1.5 rounded-lg transition-colors border border-white/10"
            >
              <LogOut size={11} /> Sair
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {section === 'fundos'        && <FundosSection />}
        {section === 'participadas'  && <ParticpadasSection />}
        {section === 'balancete'     && <BalanceteAnalyzer companies={companies} />}
        {section === 'asset-finance' && <PlaceholderSection title="Asset Finance" subtitle="DSCR, yield e perfil de amortização — em desenvolvimento" />}
      </div>
    </div>
  )
}
