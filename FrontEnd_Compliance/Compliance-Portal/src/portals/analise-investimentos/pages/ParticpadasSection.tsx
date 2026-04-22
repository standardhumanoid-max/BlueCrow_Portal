import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  ComposedChart, Bar, Line, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import {
  Plus, Building2, TrendingUp, TrendingDown, Pencil, Trash2,
  X, Check, RefreshCw, BarChart3, ExternalLink,
} from 'lucide-react'
import { authFetch, API_BASE } from '@/lib/api'

const API = `${API_BASE}/api/ai`

// ── Types ──────────────────────────────────────────────────────────────────────
interface AiCompany {
  id: string
  name: string
  short_name: string | null
  sector: string | null
  company_type: string | null
  country: string
  fund_id: number | null
  fund_name: string | null
  fund_short_name: string | null
  entry_date: string | null
  entry_value: number | null
  ownership_pct: number | null
  instrument: string | null
  status: string
  website: string | null
  notes: string | null
}

interface AiKpi {
  id: string
  company_id: string
  period: string
  period_date: string | null
  revenue: number | null
  gross_profit: number | null
  ebitda: number | null
  ebit: number | null
  net_profit: number | null
  total_assets: number | null
  total_liabilities: number | null
  equity: number | null
  gross_debt: number | null
  cash: number | null
  net_debt: number | null
  monthly_burn: number | null
  arr: number | null
  mrr: number | null
  headcount: number | null
  equity_value: number | null
  notes: string | null
}

interface FundOption { id: number; name: string; short_name: string }

// ── Utilities ──────────────────────────────────────────────────────────────────
function fmtM(v: number | null, d = 1): string {
  if (v == null) return '—'
  const a = Math.abs(v)
  const s = v < 0 ? '-' : ''
  if (a >= 1_000_000) return `${s}€${(a / 1_000_000).toFixed(d)}M`
  if (a >= 1_000)     return `${s}€${(a / 1_000).toFixed(0)}K`
  return `${s}€${a.toFixed(0)}`
}

function fmtPct(v: number | null): string {
  if (v == null) return '—'
  return `${v.toFixed(1)}%`
}

function fmtMonths(m: number | null): string {
  if (m == null || m <= 0) return '—'
  return m >= 12 ? `${(m / 12).toFixed(1)}a` : `${m.toFixed(0)}m`
}

function fmtPeriod(p: string): string {
  const m = p.match(/^(\d{4})[-_](Q[1-4]|H[12]|S[12]|FY)$/i)
  if (!m) return p
  return `${m[2].toUpperCase()}'${m[1].slice(2)}`
}

function inferPeriodDate(period: string): string {
  const m = period.match(/^(\d{4})[-_](Q1|Q2|Q3|Q4|H1|H2|S1|S2|FY)$/i)
  if (!m) return ''
  const y = m[1]
  const ends: Record<string, string> = {
    Q1: `${y}-03-31`, Q2: `${y}-06-30`, Q3: `${y}-09-30`, Q4: `${y}-12-31`,
    H1: `${y}-06-30`, S1: `${y}-06-30`, H2: `${y}-12-31`, S2: `${y}-12-31`,
    FY: `${y}-12-31`,
  }
  return ends[m[2].toUpperCase()] ?? ''
}

const SECTORS = ['SaaS', 'Tecnologia', 'Industrial', 'Serviços', 'Imobiliário', 'Energia', 'Healthcare', 'Agro', 'Media/Entretenimento', 'Financeiro', 'Outro']
const INSTRUMENTS = [{ value: 'equity', label: 'Equity' }, { value: 'divida', label: 'Dívida' }, { value: 'convertivel', label: 'Convertível' }, { value: 'misto', label: 'Misto' }]
const STATUSES = [
  { value: 'active',     label: 'Ativa',    cls: 'bg-emerald-100 text-emerald-700' },
  { value: 'watch',      label: 'Watch',    cls: 'bg-amber-100 text-amber-700' },
  { value: 'exited',     label: 'Saída',    cls: 'bg-blue-100 text-blue-700' },
  { value: 'written_off',label: 'Write-off',cls: 'bg-red-100 text-red-700' },
]

function StatusBadge({ status }: { status: string }) {
  const s = STATUSES.find(x => x.value === status) ?? STATUSES[0]
  return <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${s.cls}`}>{s.label}</span>
}

function InstrBadge({ instr }: { instr: string | null }) {
  if (!instr) return null
  const label = INSTRUMENTS.find(i => i.value === instr)?.label ?? instr
  return <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">{label}</span>
}

// ── KPI Card ──────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, color = 'text-slate-800', trend }: {
  label: string; value: string; sub?: string; color?: string; trend?: 'up' | 'down' | null
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 px-4 py-3 shadow-sm">
      <div className="text-[10px] text-slate-400 font-medium uppercase tracking-wide mb-1">{label}</div>
      <div className={`text-[17px] font-semibold ${color} flex items-center gap-1.5`}>
        {value}
        {trend === 'up'   && <TrendingUp   size={13} className="text-emerald-500" />}
        {trend === 'down' && <TrendingDown  size={13} className="text-red-400" />}
      </div>
      {sub && <div className="text-[10px] text-slate-400 mt-0.5">{sub}</div>}
    </div>
  )
}

// ── Charts ─────────────────────────────────────────────────────────────────────
const TT = {
  contentStyle: { fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
  labelStyle: { fontWeight: 600, color: '#334155' },
}

function RevenueChart({ data }: { data: AiKpi[] }) {
  const pts = data.map((k, i) => {
    const prev = i > 0 ? data[i - 1].revenue : null
    const yoy = k.revenue != null && prev != null && prev !== 0
      ? +((k.revenue - prev) / prev * 100).toFixed(1) : null
    return { p: fmtPeriod(k.period), rev: k.revenue != null ? +(k.revenue / 1e6).toFixed(3) : null, yoy }
  })
  return (
    <ResponsiveContainer width="100%" height={196}>
      <ComposedChart data={pts} margin={{ top: 4, right: 40, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis dataKey="p" tick={{ fontSize: 10, fill: '#94a3b8' }} />
        <YAxis yAxisId="l" tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={v => `€${v}M`} width={50} />
        <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={v => `${v}%`} width={34} />
        <Tooltip {...TT} formatter={(v: number, n: string) => n === 'Receitas' ? `€${v}M` : `${v}%`} />
        <Bar yAxisId="l" dataKey="rev" name="Receitas" fill="#10b981" fillOpacity={0.85} radius={[3,3,0,0]} />
        <Line yAxisId="r" dataKey="yoy" name="YoY %" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} connectNulls />
      </ComposedChart>
    </ResponsiveContainer>
  )
}

function EbitdaChart({ data }: { data: AiKpi[] }) {
  const pts = data.map(k => ({
    p:      fmtPeriod(k.period),
    ebitda: k.ebitda != null ? +(k.ebitda / 1e6).toFixed(3) : null,
    margin: k.ebitda != null && k.revenue != null && k.revenue !== 0
      ? +((k.ebitda / k.revenue) * 100).toFixed(1) : null,
  }))
  return (
    <ResponsiveContainer width="100%" height={196}>
      <ComposedChart data={pts} margin={{ top: 4, right: 40, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis dataKey="p" tick={{ fontSize: 10, fill: '#94a3b8' }} />
        <YAxis yAxisId="l" tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={v => `€${v}M`} width={50} />
        <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={v => `${v}%`} width={34} />
        <ReferenceLine yAxisId="l" y={0} stroke="#cbd5e1" />
        <Tooltip {...TT} formatter={(v: number, n: string) => n === 'EBITDA' ? `€${v}M` : `${v}%`} />
        <Bar yAxisId="l" dataKey="ebitda" name="EBITDA" fill="#3b82f6" fillOpacity={0.85} radius={[3,3,0,0]} />
        <Line yAxisId="r" dataKey="margin" name="Margem %" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 3 }} connectNulls />
      </ComposedChart>
    </ResponsiveContainer>
  )
}

function CashBurnChart({ data }: { data: AiKpi[] }) {
  const pts = data.map(k => ({
    p:    fmtPeriod(k.period),
    cash: k.cash        != null ? +(k.cash        / 1e6).toFixed(3) : null,
    burn: k.monthly_burn != null ? +(k.monthly_burn / 1e6).toFixed(3) : null,
  }))
  return (
    <ResponsiveContainer width="100%" height={196}>
      <ComposedChart data={pts} margin={{ top: 4, right: 40, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis dataKey="p" tick={{ fontSize: 10, fill: '#94a3b8' }} />
        <YAxis yAxisId="l" tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={v => `€${v}M`} width={50} />
        <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={v => `€${v}M`} width={50} />
        <Tooltip {...TT} formatter={(v: number) => `€${v}M`} />
        <Area yAxisId="l" dataKey="cash" name="Caixa" fill="#fef3c7" stroke="#f59e0b" strokeWidth={2} fillOpacity={0.5} />
        <Line yAxisId="r" dataKey="burn" name="Burn/mês" stroke="#ef4444" strokeWidth={2} strokeDasharray="4 3" dot={{ r: 3 }} connectNulls />
      </ComposedChart>
    </ResponsiveContainer>
  )
}

function NetDebtChart({ data }: { data: AiKpi[] }) {
  const pts = data.map(k => {
    const nd = k.net_debt ?? (k.gross_debt != null && k.cash != null ? k.gross_debt - k.cash : null)
    return { p: fmtPeriod(k.period), nd: nd != null ? +(nd / 1e6).toFixed(3) : null }
  })
  if (pts.every(p => p.nd == null))
    return <div className="h-[196px] flex items-center justify-center text-[11px] text-slate-300">Sem dados de dívida</div>
  return (
    <ResponsiveContainer width="100%" height={196}>
      <ComposedChart data={pts} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis dataKey="p" tick={{ fontSize: 10, fill: '#94a3b8' }} />
        <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={v => `€${v}M`} width={50} />
        <ReferenceLine y={0} stroke="#cbd5e1" />
        <Tooltip {...TT} formatter={(v: number) => [`€${v}M`, v >= 0 ? 'Dívida Líquida' : 'Caixa Líquido']} />
        <Bar dataKey="nd" name="Dívida Líquida" radius={[3,3,0,0]}
          fill="#ef4444" fillOpacity={0.8}
        />
      </ComposedChart>
    </ResponsiveContainer>
  )
}

// ── Company Detail ─────────────────────────────────────────────────────────────
function CompanyDetail({ company, kpis, onEdit, onAddKpi, onDeleteKpi }: {
  company: AiCompany
  kpis: AiKpi[]
  onEdit: () => void
  onAddKpi: () => void
  onDeleteKpi: (id: string) => void
}) {
  const latest = kpis.at(-1) ?? null
  const prev   = kpis.at(-2) ?? null

  const ebitdaMargin = latest?.ebitda != null && latest?.revenue != null && latest.revenue !== 0
    ? latest.ebitda / latest.revenue * 100 : null
  const netDebt = latest?.net_debt
    ?? (latest?.gross_debt != null && latest?.cash != null ? latest.gross_debt - latest.cash : null)
  const runway = latest?.cash != null && latest?.monthly_burn != null && latest.monthly_burn > 0
    ? latest.cash / latest.monthly_burn : null
  const moic = latest?.equity_value != null && company.entry_value != null && company.entry_value > 0
    ? latest.equity_value / company.entry_value : null
  const revTrend = latest?.revenue != null && prev?.revenue != null
    ? (latest.revenue >= prev.revenue ? 'up' : 'down') as 'up' | 'down' : null

  return (
    <div className="flex-1 overflow-y-auto bg-[#f5f6fa]">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 sticky top-0 z-10">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h1 className="text-[16px] font-semibold text-slate-800">{company.name}</h1>
              <StatusBadge status={company.status} />
              <InstrBadge instr={company.instrument} />
            </div>
            <div className="flex items-center gap-3 text-[11px] text-slate-400 flex-wrap">
              {company.sector && <span>{company.sector}</span>}
              {company.company_type && <span>· {company.company_type}</span>}
              {company.fund_short_name && <span>· {company.fund_short_name}</span>}
              {company.country && <span>· {company.country}</span>}
              {company.ownership_pct != null && <span>· {company.ownership_pct}%</span>}
              {company.website && (
                <a href={company.website} target="_blank" rel="noreferrer"
                  className="flex items-center gap-0.5 hover:text-slate-600 transition-colors">
                  <ExternalLink size={10} /> website
                </a>
              )}
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <button onClick={onAddKpi}
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-medium px-3 py-1.5 rounded-lg transition-colors">
              <Plus size={12} /> Período KPI
            </button>
            <button onClick={onEdit}
              className="flex items-center gap-1.5 text-slate-500 hover:text-slate-700 text-[11px] font-medium px-3 py-1.5 rounded-lg border border-slate-200 transition-colors">
              <Pencil size={12} /> Editar
            </button>
          </div>
        </div>
      </div>

      {/* KPI Summary */}
      <div className="px-6 pt-5 pb-3 grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-3">
        <KpiCard label="Receitas" value={fmtM(latest?.revenue ?? null)} trend={revTrend} />
        <KpiCard label="EBITDA" value={fmtM(latest?.ebitda ?? null)}
          color={(latest?.ebitda ?? 0) < 0 ? 'text-red-600' : 'text-slate-800'} />
        <KpiCard label="Margem EBITDA" value={fmtPct(ebitdaMargin)}
          color={(ebitdaMargin ?? 0) < 0 ? 'text-red-600' : 'text-slate-800'} />
        <KpiCard label="Caixa" value={fmtM(latest?.cash ?? null)} color="text-amber-600" />
        <KpiCard label="Runway"
          value={fmtMonths(runway)}
          color={runway != null && runway < 6 ? 'text-red-600' : runway != null && runway < 12 ? 'text-amber-600' : 'text-slate-800'}
          sub={runway != null ? (runway < 6 ? 'Crítico' : runway < 12 ? 'Atenção' : 'Estável') : undefined} />
        <KpiCard label="Dívida Líquida" value={fmtM(netDebt)}
          color={(netDebt ?? 0) > 0 ? 'text-red-500' : (netDebt ?? 0) < 0 ? 'text-emerald-600' : 'text-slate-800'} />
        <KpiCard label="Capital Investido" value={fmtM(company.entry_value)} />
        <KpiCard label="MOIC" value={moic != null ? `${moic.toFixed(2)}x` : '—'}
          color={moic != null && moic >= 1 ? 'text-emerald-600' : moic != null ? 'text-red-500' : 'text-slate-800'} />
      </div>

      {kpis.length === 0 ? (
        <div className="flex items-center justify-center h-48">
          <div className="text-center">
            <BarChart3 size={28} className="text-slate-300 mx-auto mb-2" />
            <div className="text-[13px] font-medium text-slate-500">Sem dados KPI</div>
            <div className="text-[11px] text-slate-400 mt-1">Adiciona o primeiro período para ver os gráficos.</div>
            <button onClick={onAddKpi}
              className="mt-3 flex items-center gap-1.5 mx-auto bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-medium px-3 py-1.5 rounded-lg transition-colors">
              <Plus size={12} /> Adicionar Período
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Charts 2×2 */}
          <div className="px-6 pb-4 grid grid-cols-2 gap-4">
            {([
              ['Receitas & Crescimento YoY',    <RevenueChart  data={kpis} />],
              ['EBITDA & Margem',               <EbitdaChart   data={kpis} />],
              ['Posição de Caixa & Burn Rate',  <CashBurnChart data={kpis} />],
              ['Dívida Líquida',                <NetDebtChart  data={kpis} />],
            ] as [string, React.ReactNode][]).map(([title, chart]) => (
              <div key={title as string} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                <div className="text-[11px] font-semibold text-slate-600 mb-3">{title as string}</div>
                {chart}
              </div>
            ))}
          </div>

          {/* KPI History */}
          <div className="px-6 pb-8">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                <span className="text-[12px] font-semibold text-slate-700">Histórico de KPIs</span>
                <span className="text-[10px] text-slate-400">{kpis.length} períodos</span>
              </div>
              <table className="w-full min-w-max">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    {['Período','Receitas','Gross Profit','EBITDA','Margem EBITDA','Res. Líquido','Caixa','Dív. Líquida','Burn/mês','Runway','Valorização','Headcount',''].map((h,i) => (
                      <th key={i} className={`px-3 py-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wide whitespace-nowrap ${i === 0 || i === 12 ? 'text-left' : 'text-right'}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...kpis].reverse().map(k => {
                    const nd  = k.net_debt ?? (k.gross_debt != null && k.cash != null ? k.gross_debt - k.cash : null)
                    const rwy = k.cash != null && k.monthly_burn != null && k.monthly_burn > 0 ? k.cash / k.monthly_burn : null
                    const mg  = k.ebitda != null && k.revenue != null && k.revenue !== 0 ? k.ebitda / k.revenue * 100 : null
                    return (
                      <tr key={k.id} className="border-b border-slate-50 hover:bg-slate-50 text-[11px]">
                        <td className="px-3 py-2 font-semibold text-slate-700">{fmtPeriod(k.period)}</td>
                        <td className="px-3 py-2 text-right text-slate-600">{fmtM(k.revenue)}</td>
                        <td className="px-3 py-2 text-right text-slate-500">{fmtM(k.gross_profit)}</td>
                        <td className={`px-3 py-2 text-right font-medium ${(k.ebitda ?? 0) < 0 ? 'text-red-500' : 'text-slate-700'}`}>{fmtM(k.ebitda)}</td>
                        <td className={`px-3 py-2 text-right ${(mg ?? 0) < 0 ? 'text-red-500' : 'text-slate-600'}`}>{fmtPct(mg)}</td>
                        <td className={`px-3 py-2 text-right ${(k.net_profit ?? 0) < 0 ? 'text-red-500' : 'text-slate-600'}`}>{fmtM(k.net_profit)}</td>
                        <td className="px-3 py-2 text-right text-amber-600">{fmtM(k.cash)}</td>
                        <td className={`px-3 py-2 text-right font-medium ${(nd ?? 0) > 0 ? 'text-red-500' : (nd ?? 0) < 0 ? 'text-emerald-600' : 'text-slate-400'}`}>{fmtM(nd)}</td>
                        <td className="px-3 py-2 text-right text-slate-500">{fmtM(k.monthly_burn)}</td>
                        <td className={`px-3 py-2 text-right font-medium ${rwy != null && rwy < 6 ? 'text-red-500' : rwy != null && rwy < 12 ? 'text-amber-600' : 'text-slate-700'}`}>{fmtMonths(rwy)}</td>
                        <td className="px-3 py-2 text-right text-slate-600">{fmtM(k.equity_value)}</td>
                        <td className="px-3 py-2 text-right text-slate-500">{k.headcount ?? '—'}</td>
                        <td className="px-3 py-2 text-right">
                          <button onClick={() => onDeleteKpi(k.id)}
                            className="text-slate-200 hover:text-red-400 transition-colors">
                            <Trash2 size={11} />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ── Company Modal ──────────────────────────────────────────────────────────────
function CompanyModal({ company, funds, onSave, onClose }: {
  company: AiCompany | null
  funds: FundOption[]
  onSave: (data: Record<string, unknown>) => Promise<void>
  onClose: () => void
}) {
  const INIT = {
    name: company?.name ?? '', short_name: company?.short_name ?? '',
    sector: company?.sector ?? '', company_type: company?.company_type ?? '',
    country: company?.country ?? 'Portugal', fund_id: company?.fund_id?.toString() ?? '',
    entry_date: company?.entry_date?.slice(0, 10) ?? '',
    entry_value: company?.entry_value?.toString() ?? '',
    ownership_pct: company?.ownership_pct?.toString() ?? '',
    instrument: company?.instrument ?? 'equity', status: company?.status ?? 'active',
    website: company?.website ?? '', notes: company?.notes ?? '',
  }
  const [form, setForm] = useState(INIT)
  const [saving, setSaving] = useState(false)
  const [err, setErr]       = useState<string | null>(null)

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  async function save() {
    if (!form.name.trim()) { setErr('Nome obrigatório'); return }
    setSaving(true); setErr(null)
    try {
      await onSave({
        name:          form.name.trim(),
        short_name:    form.short_name  || null,
        sector:        form.sector      || null,
        company_type:  form.company_type|| null,
        country:       form.country     || 'Portugal',
        fund_id:       form.fund_id     ? Number(form.fund_id)      : null,
        entry_date:    form.entry_date  || null,
        entry_value:   form.entry_value ? Number(form.entry_value)  : null,
        ownership_pct: form.ownership_pct ? Number(form.ownership_pct) : null,
        instrument:    form.instrument  || null,
        status:        form.status,
        website:       form.website     || null,
        notes:         form.notes       || null,
      })
    } catch { setErr('Erro ao guardar'); setSaving(false) }
  }

  const inp = 'w-full border border-slate-200 rounded-lg px-3 py-1.5 text-[12px] text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-400 bg-white'
  const lbl = 'text-[10px] font-medium text-slate-500 uppercase tracking-wide block mb-0.5'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-[14px] font-semibold text-slate-800">{company ? 'Editar Participada' : 'Nova Participada'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X size={16} /></button>
        </div>

        <div className="overflow-y-auto px-6 py-4 space-y-5">
          {err && <p className="text-[11px] text-red-600 bg-red-50 rounded-lg px-3 py-2">{err}</p>}

          <section>
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-3">Identificação</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className={lbl}>Nome *</label>
                <input className={inp} value={form.name} onChange={e => set('name', e.target.value)} />
              </div>
              <div><label className={lbl}>Código</label><input className={inp} value={form.short_name} onChange={e => set('short_name', e.target.value)} placeholder="Ex: ACME" /></div>
              <div><label className={lbl}>País</label><input className={inp} value={form.country} onChange={e => set('country', e.target.value)} /></div>
              <div>
                <label className={lbl}>Setor</label>
                <select className={inp} value={form.sector} onChange={e => set('sector', e.target.value)}>
                  <option value="">— selecionar —</option>
                  {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div><label className={lbl}>Tipo / Subsetor</label><input className={inp} value={form.company_type} onChange={e => set('company_type', e.target.value)} placeholder="Ex: B2B SaaS" /></div>
              <div className="col-span-2"><label className={lbl}>Website</label><input className={inp} value={form.website} onChange={e => set('website', e.target.value)} /></div>
            </div>
          </section>

          <section>
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-3">Investimento</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Fundo</label>
                <select className={inp} value={form.fund_id} onChange={e => set('fund_id', e.target.value)}>
                  <option value="">— selecionar —</option>
                  {funds.map(f => <option key={f.id} value={f.id}>{f.short_name} — {f.name}</option>)}
                </select>
              </div>
              <div>
                <label className={lbl}>Instrumento</label>
                <select className={inp} value={form.instrument} onChange={e => set('instrument', e.target.value)}>
                  {INSTRUMENTS.map(i => <option key={i.value} value={i.value}>{i.label}</option>)}
                </select>
              </div>
              <div><label className={lbl}>Data de Entrada</label><input type="date" className={inp} value={form.entry_date} onChange={e => set('entry_date', e.target.value)} /></div>
              <div><label className={lbl}>Capital Investido (€)</label><input type="number" className={inp} value={form.entry_value} onChange={e => set('entry_value', e.target.value)} /></div>
              <div><label className={lbl}>Participação (%)</label><input type="number" step="0.01" className={inp} value={form.ownership_pct} onChange={e => set('ownership_pct', e.target.value)} /></div>
              <div>
                <label className={lbl}>Estado</label>
                <select className={inp} value={form.status} onChange={e => set('status', e.target.value)}>
                  {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
            </div>
          </section>

          <section>
            <label className={lbl}>Notas</label>
            <textarea className={`${inp} h-20 resize-none mt-0.5`} value={form.notes} onChange={e => set('notes', e.target.value)} />
          </section>
        </div>

        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-2">
          <button onClick={onClose} className="text-[12px] text-slate-500 px-4 py-2 rounded-lg border border-slate-200">Cancelar</button>
          <button onClick={save} disabled={saving}
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[12px] font-medium px-4 py-2 rounded-lg transition-colors">
            <Check size={13} /> {saving ? 'A guardar…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── KPI Modal ─────────────────────────────────────────────────────────────────
const EMPTY_KPI = {
  period: '', period_date: '',
  revenue: '', gross_profit: '', ebitda: '', ebit: '', net_profit: '',
  total_assets: '', total_liabilities: '', equity: '', gross_debt: '', cash: '', net_debt: '',
  monthly_burn: '', arr: '', mrr: '', headcount: '', equity_value: '', notes: '',
}

function KpiModal({ onSave, onClose }: {
  onSave: (d: Record<string, unknown>) => Promise<void>
  onClose: () => void
}) {
  const [form, setForm] = useState(EMPTY_KPI)
  const [saving, setSaving] = useState(false)
  const [err, setErr]       = useState<string | null>(null)

  function set(k: string, v: string) {
    setForm(f => {
      const next = { ...f, [k]: v }
      if (k === 'period') {
        const d = inferPeriodDate(v)
        if (d) next.period_date = d
      }
      return next
    })
  }

  const num = (v: string) => { const n = parseFloat(v); return isNaN(n) ? null : n }
  const int = (v: string) => { const n = parseInt(v, 10); return isNaN(n) ? null : n }

  async function save() {
    if (!form.period.trim()) { setErr('Período obrigatório'); return }
    setSaving(true); setErr(null)
    try {
      await onSave({
        period: form.period.trim(), period_date: form.period_date || null,
        revenue: num(form.revenue), gross_profit: num(form.gross_profit),
        ebitda: num(form.ebitda), ebit: num(form.ebit), net_profit: num(form.net_profit),
        total_assets: num(form.total_assets), total_liabilities: num(form.total_liabilities),
        equity: num(form.equity), gross_debt: num(form.gross_debt),
        cash: num(form.cash), net_debt: num(form.net_debt),
        monthly_burn: num(form.monthly_burn), arr: num(form.arr), mrr: num(form.mrr),
        headcount: int(form.headcount), equity_value: num(form.equity_value),
        notes: form.notes || null,
      })
    } catch { setErr('Erro ao guardar'); setSaving(false) }
  }

  const inp = 'w-full border border-slate-200 rounded-lg px-3 py-1.5 text-[12px] text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-400 bg-white'
  const lbl = 'text-[10px] font-medium text-slate-500 uppercase tracking-wide block mb-0.5'

  type K = keyof typeof EMPTY_KPI
  function F({ label, k, type = 'number', ph = '' }: { label: string; k: K; type?: string; ph?: string }) {
    return (
      <div>
        <label className={lbl}>{label}</label>
        <input type={type} step="any" placeholder={ph} className={inp}
          value={form[k]} onChange={e => set(k, e.target.value)} />
      </div>
    )
  }

  function Sec({ title, children }: { title: string; children: React.ReactNode }) {
    return (
      <section>
        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-1.5 mb-3">{title}</p>
        <div className="grid grid-cols-3 gap-3">{children}</div>
      </section>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-[14px] font-semibold text-slate-800">Adicionar Período KPI</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X size={16} /></button>
        </div>

        <div className="overflow-y-auto px-6 py-4 space-y-5">
          {err && <p className="text-[11px] text-red-600 bg-red-50 rounded-lg px-3 py-2">{err}</p>}

          <Sec title="Período">
            <F label="Período *" k="period" type="text" ph="Ex: 2024-Q1, 2024-FY" />
            <F label="Data de Referência" k="period_date" type="date" />
          </Sec>

          <Sec title="P&L">
            <F label="Receitas (€)" k="revenue" />
            <F label="Gross Profit (€)" k="gross_profit" />
            <F label="EBITDA (€)" k="ebitda" />
            <F label="EBIT (€)" k="ebit" />
            <F label="Resultado Líquido (€)" k="net_profit" />
          </Sec>

          <Sec title="Balanço">
            <F label="Ativo Total (€)" k="total_assets" />
            <F label="Passivo Total (€)" k="total_liabilities" />
            <F label="Capital Próprio (€)" k="equity" />
            <F label="Dívida Bruta (€)" k="gross_debt" />
            <F label="Caixa (€)" k="cash" />
            <F label="Dívida Líquida (€)" k="net_debt" />
          </Sec>

          <Sec title="Operacional">
            <F label="Burn Mensal (€)" k="monthly_burn" />
            <F label="ARR (€)" k="arr" />
            <F label="MRR (€)" k="mrr" />
            <F label="Headcount" k="headcount" />
            <F label="Valorização (€)" k="equity_value" />
          </Sec>

          <section>
            <label className={lbl}>Notas</label>
            <textarea className={`${inp} h-16 resize-none mt-0.5`} value={form.notes}
              onChange={e => set('notes', e.target.value)} />
          </section>
        </div>

        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-2">
          <button onClick={onClose} className="text-[12px] text-slate-500 px-4 py-2 rounded-lg border border-slate-200">Cancelar</button>
          <button onClick={save} disabled={saving}
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[12px] font-medium px-4 py-2 rounded-lg transition-colors">
            <Check size={13} /> {saving ? 'A guardar…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Section ───────────────────────────────────────────────────────────────
export function ParticpadasSection() {
  const [companies, setCompanies] = useState<AiCompany[]>([])
  const [kpis,      setKpis]      = useState<AiKpi[]>([])
  const [funds,     setFunds]     = useState<FundOption[]>([])
  const [selected,  setSelected]  = useState<AiCompany | null>(null)
  const [loading,   setLoading]   = useState(true)
  const [modal,     setModal]     = useState<'company' | 'kpi' | null>(null)
  const [editing,   setEditing]   = useState<AiCompany | null>(null)
  const [filter,    setFilter]    = useState('')

  const loadCompanies = useCallback(async () => {
    setLoading(true)
    const [cr, fr] = await Promise.all([
      authFetch(`${API}/companies`),
      authFetch(`${API_BASE}/api/bc-funds?portal=investment_analysis`),
    ])
    if (cr.ok) setCompanies(await cr.json())
    if (fr.ok) {
      const all: { id: number; name: string; short_name: string; is_subfund: boolean }[] = await fr.json()
      setFunds(all.filter(f => !f.is_subfund).map(f => ({ id: f.id, name: f.name, short_name: f.short_name })))
    }
    setLoading(false)
  }, [])

  const loadKpis = useCallback(async (id: string) => {
    const res = await authFetch(`${API}/companies/${id}/kpis`)
    if (res.ok) setKpis(await res.json())
  }, [])

  useEffect(() => { void loadCompanies() }, [loadCompanies])
  useEffect(() => {
    if (selected) void loadKpis(selected.id)
    else setKpis([])
  }, [selected, loadKpis])

  async function handleSaveCompany(data: Record<string, unknown>) {
    if (editing) {
      await authFetch(`${API}/companies/${editing.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
      })
    } else {
      const res = await authFetch(`${API}/companies`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
      })
      if (res.ok) setSelected(await res.json())
    }
    setModal(null); setEditing(null)
    await loadCompanies()
  }

  async function handleSaveKpi(data: Record<string, unknown>) {
    if (!selected) return
    await authFetch(`${API}/companies/${selected.id}/kpis`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
    })
    setModal(null)
    await loadKpis(selected.id)
  }

  async function handleDeleteKpi(kpiId: string) {
    await authFetch(`${API}/kpis/${kpiId}`, { method: 'DELETE' })
    if (selected) await loadKpis(selected.id)
  }

  const filtered = useMemo(() => {
    if (!filter) return companies
    const q = filter.toLowerCase()
    return companies.filter(c =>
      c.name.toLowerCase().includes(q) ||
      (c.sector ?? '').toLowerCase().includes(q) ||
      (c.fund_short_name ?? '').toLowerCase().includes(q)
    )
  }, [companies, filter])

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Sidebar */}
      <div className="w-64 flex flex-col bg-white border-r border-slate-200 shrink-0">
        <div className="p-3 border-b border-slate-100">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[12px] font-semibold text-slate-700 flex-1">
              Participadas <span className="text-slate-400 font-normal">({companies.length})</span>
            </span>
            <button onClick={() => { setEditing(null); setModal('company') }}
              className="w-6 h-6 flex items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors">
              <Plus size={12} />
            </button>
          </div>
          <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Filtrar…"
            className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-[11px] focus:outline-none focus:ring-1 focus:ring-emerald-400" />
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-24 text-slate-300">
              <RefreshCw size={14} className="animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-8 text-[11px] text-slate-400">
              {companies.length === 0 ? 'Sem participadas' : 'Sem resultados'}
            </div>
          ) : filtered.map(c => (
            <button key={c.id} onClick={() => setSelected(c)}
              className={`w-full text-left px-3 py-2.5 border-b border-slate-50 transition-colors ${
                selected?.id === c.id
                  ? 'bg-emerald-50 border-l-2 border-l-emerald-500'
                  : 'hover:bg-slate-50'
              }`}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[12px] font-medium text-slate-800 truncate">{c.name}</span>
                <StatusBadge status={c.status} />
              </div>
              <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-slate-400">
                {c.sector && <span>{c.sector}</span>}
                {c.fund_short_name && <span>· {c.fund_short_name}</span>}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Detail */}
      {selected ? (
        <CompanyDetail
          company={selected}
          kpis={kpis}
          onEdit={() => { setEditing(selected); setModal('company') }}
          onAddKpi={() => setModal('kpi')}
          onDeleteKpi={handleDeleteKpi}
        />
      ) : (
        <div className="flex-1 flex items-center justify-center bg-[#f5f6fa]">
          <div className="text-center">
            <Building2 size={32} className="text-slate-300 mx-auto mb-3" />
            <div className="text-[14px] font-semibold text-slate-500">Seleciona uma participada</div>
            <div className="text-[11px] text-slate-400 mt-1">ou adiciona a primeira</div>
            <button onClick={() => { setEditing(null); setModal('company') }}
              className="mt-4 flex items-center gap-1.5 mx-auto bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-medium px-4 py-2 rounded-lg transition-colors">
              <Plus size={12} /> Nova Participada
            </button>
          </div>
        </div>
      )}

      {modal === 'company' && (
        <CompanyModal company={editing} funds={funds} onSave={handleSaveCompany}
          onClose={() => { setModal(null); setEditing(null) }} />
      )}
      {modal === 'kpi' && selected && (
        <KpiModal onSave={handleSaveKpi} onClose={() => setModal(null)} />
      )}
    </div>
  )
}
