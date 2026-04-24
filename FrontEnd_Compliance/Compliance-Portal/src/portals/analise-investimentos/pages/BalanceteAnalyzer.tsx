import { useState, useRef, useCallback } from 'react'
import {
  Upload, FileText, X, Loader2, ChevronDown, ChevronUp,
  TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle,
  Building2, Save, RotateCcw,
} from 'lucide-react'
import { authFetch, API_BASE } from '@/lib/api'

const API = `${API_BASE}/api/ai`

// ── Types ──────────────────────────────────────────────────────────────────────
interface BalanceteResult {
  meta: {
    company_name: string | null
    period: string | null
    period_date: string | null
    currency: string
    accounting_standard: string
  }
  pl: Record<string, number | null>
  balance: Record<string, number | null>
  operational: Record<string, number | null>
  ratios: Record<string, number | null>
  analysis: {
    summary: string
    financial_health: 'saudavel' | 'atencao' | 'critico'
    strengths: string[]
    risks: string[]
    key_observations: string
    red_flags: string[]
  }
}

interface AiCompany { id: string; name: string; short_name: string | null; sector: string | null }

// ── Formatting helpers ─────────────────────────────────────────────────────────
function fmtM(v: number | null, d = 1): string {
  if (v == null) return '—'
  const a = Math.abs(v), s = v < 0 ? '-' : ''
  if (a >= 1_000_000) return `${s}€${(a / 1_000_000).toFixed(d)}M`
  if (a >= 1_000)     return `${s}€${(a / 1_000).toFixed(0)}K`
  return `${s}€${a.toFixed(0)}`
}
function fmtPct(v: number | null): string { return v == null ? '—' : `${v.toFixed(1)}%` }
function fmtX(v: number | null): string   { return v == null ? '—' : `${v.toFixed(2)}x` }
function fmt(v: number | null, suffix = ''): string { return v == null ? '—' : `${v.toFixed(1)}${suffix}` }

// ── Ratio colour thresholds ────────────────────────────────────────────────────
type Health = 'good' | 'warn' | 'bad' | 'neutral'

function ratioHealth(key: string, v: number | null): Health {
  if (v == null) return 'neutral'
  const rules: Record<string, (n: number) => Health> = {
    ebitda_margin_pct:  n => n > 15 ? 'good' : n > 5  ? 'warn' : 'bad',
    net_margin_pct:     n => n > 5  ? 'good' : n > 0  ? 'warn' : 'bad',
    gross_margin_pct:   n => n > 30 ? 'good' : n > 15 ? 'warn' : 'bad',
    current_ratio:      n => n > 1.5? 'good' : n > 1  ? 'warn' : 'bad',
    quick_ratio:        n => n > 1  ? 'good' : n > 0.7? 'warn' : 'bad',
    debt_to_equity:     n => n < 1  ? 'good' : n < 3  ? 'warn' : 'bad',
    net_debt_ebitda:    n => n < 2  ? 'good' : n < 5  ? 'warn' : 'bad',
    interest_coverage:  n => n > 3  ? 'good' : n > 1.5? 'warn' : 'bad',
    roe_pct:            n => n > 10 ? 'good' : n > 0  ? 'warn' : 'bad',
    roa_pct:            n => n > 5  ? 'good' : n > 0  ? 'warn' : 'bad',
    days_receivable:    n => n < 45 ? 'good' : n < 90 ? 'warn' : 'bad',
    days_payable:       n => n < 60 ? 'good' : n < 90 ? 'warn' : 'bad',
    equity_ratio_pct:   n => n > 40 ? 'good' : n > 20 ? 'warn' : 'bad',
    debt_ratio_pct:     n => n < 60 ? 'good' : n < 80 ? 'warn' : 'bad',
  }
  return rules[key]?.(v) ?? 'neutral'
}

const HEALTH_CLS: Record<Health, string> = {
  good:    'text-emerald-600',
  warn:    'text-amber-600',
  bad:     'text-red-500',
  neutral: 'text-slate-700',
}
const HEALTH_BG: Record<Health, string> = {
  good:    'bg-emerald-50 border-emerald-200',
  warn:    'bg-amber-50 border-amber-200',
  bad:     'bg-red-50 border-red-200',
  neutral: 'bg-white border-slate-200',
}

// ── Ratio Card ─────────────────────────────────────────────────────────────────
function RatioCard({ label, value, display, ratioKey }: {
  label: string; value: number | null; display: string; ratioKey: string
}) {
  const h = ratioHealth(ratioKey, value)
  return (
    <div className={`rounded-xl border px-4 py-3 ${HEALTH_BG[h]}`}>
      <div className="text-[10px] text-slate-400 font-medium uppercase tracking-wide mb-1">{label}</div>
      <div className={`text-[17px] font-semibold ${HEALTH_CLS[h]}`}>{display}</div>
    </div>
  )
}

// ── KPI Mini Card ──────────────────────────────────────────────────────────────
function KpiMini({ label, value, negative }: { label: string; value: string; negative?: boolean }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 px-4 py-3 shadow-sm">
      <div className="text-[10px] text-slate-400 font-medium uppercase tracking-wide mb-1">{label}</div>
      <div className={`text-[16px] font-semibold ${negative ? 'text-red-500' : 'text-slate-800'}`}>{value}</div>
    </div>
  )
}

// ── Collapsible Section ────────────────────────────────────────────────────────
function Section({ title, children, defaultOpen = true }: {
  title: string; children: React.ReactNode; defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-slate-50 transition-colors"
      >
        <span className="text-[13px] font-semibold text-slate-700">{title}</span>
        {open ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
      </button>
      {open && <div className="px-5 pb-5 pt-1 border-t border-slate-100">{children}</div>}
    </div>
  )
}

// ── Result Dashboard ───────────────────────────────────────────────────────────
function ResultDashboard({ result, companies, onSave, onReset }: {
  result: BalanceteResult
  companies: AiCompany[]
  onSave: (companyId: string, period: string) => Promise<void>
  onReset: () => void
}) {
  const [saveModal, setSaveModal] = useState(false)
  const [selCompany, setSelCompany] = useState('')
  const [selPeriod,  setSelPeriod]  = useState(result.meta.period ?? '')
  const [saving, setSaving]         = useState(false)

  const { pl, balance, ratios, analysis } = result

  const healthIcon = {
    saudavel: <CheckCircle size={15} className="text-emerald-500" />,
    atencao:  <AlertTriangle size={15} className="text-amber-500" />,
    critico:  <AlertTriangle size={15} className="text-red-500" />,
  }[analysis.financial_health]

  const healthLabel = { saudavel: 'Saudável', atencao: 'Atenção', critico: 'Crítico' }[analysis.financial_health]
  const healthCls   = { saudavel: 'bg-emerald-100 text-emerald-700', atencao: 'bg-amber-100 text-amber-700', critico: 'bg-red-100 text-red-700' }[analysis.financial_health]

  async function confirmSave() {
    if (!selCompany || !selPeriod) return
    setSaving(true)
    await onSave(selCompany, selPeriod)
    setSaving(false)
    setSaveModal(false)
  }

  const inp = 'w-full border border-slate-200 rounded-lg px-3 py-1.5 text-[12px] text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-400'

  return (
    <div className="flex-1 overflow-y-auto bg-[#f5f6fa] px-6 py-5 space-y-4">
      {/* Top bar */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-5 py-4 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-[15px] font-semibold text-slate-800">
              {result.meta.company_name ?? 'Empresa não identificada'}
            </h2>
            <span className={`flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${healthCls}`}>
              {healthIcon} {healthLabel}
            </span>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-slate-400">
            {result.meta.period    && <span>Período: <b className="text-slate-600">{result.meta.period}</b></span>}
            {result.meta.currency  && <span>· {result.meta.currency}</span>}
            {result.meta.accounting_standard && <span>· {result.meta.accounting_standard}</span>}
          </div>
          <p className="mt-2 text-[12px] text-slate-600 leading-relaxed max-w-2xl">{analysis.summary}</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button onClick={() => setSaveModal(true)}
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-medium px-3 py-1.5 rounded-lg transition-colors">
            <Save size={12} /> Guardar em Participada
          </button>
          <button onClick={onReset}
            className="flex items-center gap-1.5 text-slate-500 hover:text-slate-700 text-[11px] font-medium px-3 py-1.5 rounded-lg border border-slate-200 transition-colors">
            <RotateCcw size={12} /> Nova análise
          </button>
        </div>
      </div>

      {/* P&L Summary */}
      <Section title="Demonstração de Resultados">
        <div className="grid grid-cols-3 gap-3 mt-3">
          <KpiMini label="Receitas"         value={fmtM(pl.revenue)} />
          <KpiMini label="Gross Profit"     value={fmtM(pl.gross_profit)} negative={(pl.gross_profit ?? 1) < 0} />
          <KpiMini label="FSE"              value={fmtM(pl.fse)}          negative />
          <KpiMini label="Gastos Pessoal"   value={fmtM(pl.staff_costs)}  negative />
          <KpiMini label="EBITDA"           value={fmtM(pl.ebitda)}       negative={(pl.ebitda ?? 1) < 0} />
          <KpiMini label="Amort. & Deprc."  value={fmtM(pl.depreciation_amortization)} negative />
          <KpiMini label="EBIT"             value={fmtM(pl.ebit)}         negative={(pl.ebit ?? 1) < 0} />
          <KpiMini label="Resultado Fin."   value={fmtM(pl.financial_result)} negative={(pl.financial_result ?? 1) < 0} />
          <KpiMini label="Resultado Líquido" value={fmtM(pl.net_profit)}  negative={(pl.net_profit ?? 1) < 0} />
        </div>
      </Section>

      {/* Balance Sheet */}
      <Section title="Balanço">
        <div className="grid grid-cols-2 gap-5 mt-3">
          <div>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Ativo</p>
            <div className="space-y-1.5">
              {([
                ['Ativo Total',    balance.total_assets],
                ['Ativo Fixo',     balance.fixed_assets],
                ['Intangíveis',    balance.intangible_assets],
                ['Ativo Corrente', balance.current_assets],
                ['Inventários',    balance.inventory],
                ['Clientes',       balance.receivables],
                ['Caixa',          balance.cash],
              ] as [string, number | null][]).map(([lbl, val]) => (
                <div key={lbl} className="flex justify-between text-[12px] py-1 border-b border-slate-50">
                  <span className="text-slate-500">{lbl}</span>
                  <span className={`font-medium ${lbl === 'Ativo Total' ? 'text-slate-800' : 'text-slate-600'}`}>{fmtM(val)}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Capital Próprio & Passivo</p>
            <div className="space-y-1.5">
              {([
                ['Capital Próprio',   balance.equity],
                ['Passivo Total',     balance.total_liabilities],
                ['Dívida LP',         balance.lt_debt],
                ['Dívida CP',         balance.st_debt],
                ['Dívida Bruta',      balance.gross_debt],
                ['Fornecedores',      balance.payables],
                ['Dívida Líquida',    balance.net_debt],
              ] as [string, number | null][]).map(([lbl, val]) => (
                <div key={lbl} className="flex justify-between text-[12px] py-1 border-b border-slate-50">
                  <span className="text-slate-500">{lbl}</span>
                  <span className={`font-medium ${
                    lbl === 'Dívida Líquida' && (val ?? 0) > 0 ? 'text-red-500' :
                    lbl === 'Capital Próprio' ? 'text-slate-800' : 'text-slate-600'
                  }`}>{fmtM(val)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Section>

      {/* Ratios */}
      <Section title="Rácios Financeiros">
        <div className="space-y-4 mt-3">
          <div>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Rentabilidade</p>
            <div className="grid grid-cols-4 gap-3">
              <RatioCard label="Margem Bruta"    ratioKey="gross_margin_pct"  value={ratios.gross_margin_pct}  display={fmtPct(ratios.gross_margin_pct)} />
              <RatioCard label="Margem EBITDA"   ratioKey="ebitda_margin_pct" value={ratios.ebitda_margin_pct} display={fmtPct(ratios.ebitda_margin_pct)} />
              <RatioCard label="Margem EBIT"     ratioKey="ebit_margin_pct"   value={ratios.ebit_margin_pct}   display={fmtPct(ratios.ebit_margin_pct)} />
              <RatioCard label="Margem Líquida"  ratioKey="net_margin_pct"    value={ratios.net_margin_pct}    display={fmtPct(ratios.net_margin_pct)} />
              <RatioCard label="ROE"             ratioKey="roe_pct"           value={ratios.roe_pct}           display={fmtPct(ratios.roe_pct)} />
              <RatioCard label="ROA"             ratioKey="roa_pct"           value={ratios.roa_pct}           display={fmtPct(ratios.roa_pct)} />
              <RatioCard label="ROCE"            ratioKey="roce_pct"          value={ratios.roce_pct}          display={fmtPct(ratios.roce_pct)} />
              <RatioCard label="Asset Turnover"  ratioKey="asset_turnover"    value={ratios.asset_turnover}    display={fmtX(ratios.asset_turnover)} />
            </div>
          </div>
          <div>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Liquidez</p>
            <div className="grid grid-cols-4 gap-3">
              <RatioCard label="Current Ratio"   ratioKey="current_ratio"     value={ratios.current_ratio}     display={fmtX(ratios.current_ratio)} />
              <RatioCard label="Quick Ratio"     ratioKey="quick_ratio"       value={ratios.quick_ratio}       display={fmtX(ratios.quick_ratio)} />
              <RatioCard label="Cash Ratio"      ratioKey="cash_ratio"        value={ratios.cash_ratio}        display={fmtX(ratios.cash_ratio)} />
              <RatioCard label="Working Capital" ratioKey="working_capital"   value={ratios.working_capital}   display={fmtM(ratios.working_capital)} />
            </div>
          </div>
          <div>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Endividamento</p>
            <div className="grid grid-cols-4 gap-3">
              <RatioCard label="Dívida/CP"        ratioKey="debt_to_equity"   value={ratios.debt_to_equity}    display={fmtX(ratios.debt_to_equity)} />
              <RatioCard label="ND/EBITDA"        ratioKey="net_debt_ebitda"  value={ratios.net_debt_ebitda}   display={fmtX(ratios.net_debt_ebitda)} />
              <RatioCard label="Cobert. Juros"    ratioKey="interest_coverage" value={ratios.interest_coverage} display={fmtX(ratios.interest_coverage)} />
              <RatioCard label="Rácio Capital Pr." ratioKey="equity_ratio_pct" value={ratios.equity_ratio_pct} display={fmtPct(ratios.equity_ratio_pct)} />
            </div>
          </div>
          <div>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Ciclo Operacional</p>
            <div className="grid grid-cols-4 gap-3">
              <RatioCard label="DSO (dias)"       ratioKey="days_receivable"  value={ratios.days_receivable}   display={fmt(ratios.days_receivable, 'd')} />
              <RatioCard label="DPO (dias)"       ratioKey="days_payable"     value={ratios.days_payable}      display={fmt(ratios.days_payable, 'd')} />
              <RatioCard label="DIO (dias)"       ratioKey="days_inventory"   value={ratios.days_inventory}    display={fmt(ratios.days_inventory, 'd')} />
              <RatioCard label="Ciclo Caixa"      ratioKey="cash_conversion_cycle" value={ratios.cash_conversion_cycle} display={fmt(ratios.cash_conversion_cycle, 'd')} />
            </div>
          </div>
        </div>
      </Section>

      {/* Analysis */}
      <Section title="Análise Qualitativa">
        <div className="mt-3 space-y-4">
          <p className="text-[12px] text-slate-600 leading-relaxed">{analysis.key_observations}</p>
          <div className="grid grid-cols-2 gap-4">
            {analysis.strengths?.length > 0 && (
              <div className="bg-emerald-50 rounded-xl border border-emerald-200 p-4">
                <p className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wide mb-2 flex items-center gap-1">
                  <TrendingUp size={12} /> Pontos Fortes
                </p>
                <ul className="space-y-1">
                  {analysis.strengths.map((s, i) => (
                    <li key={i} className="text-[12px] text-emerald-800 flex gap-1.5">
                      <span className="mt-1 w-1 h-1 rounded-full bg-emerald-400 shrink-0" /> {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {analysis.risks?.length > 0 && (
              <div className="bg-amber-50 rounded-xl border border-amber-200 p-4">
                <p className="text-[11px] font-semibold text-amber-700 uppercase tracking-wide mb-2 flex items-center gap-1">
                  <TrendingDown size={12} /> Riscos
                </p>
                <ul className="space-y-1">
                  {analysis.risks.map((r, i) => (
                    <li key={i} className="text-[12px] text-amber-800 flex gap-1.5">
                      <span className="mt-1 w-1 h-1 rounded-full bg-amber-400 shrink-0" /> {r}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          {analysis.red_flags?.length > 0 && (
            <div className="bg-red-50 rounded-xl border border-red-200 p-4">
              <p className="text-[11px] font-semibold text-red-700 uppercase tracking-wide mb-2 flex items-center gap-1">
                <AlertTriangle size={12} /> Red Flags
              </p>
              <ul className="space-y-1">
                {analysis.red_flags.map((f, i) => (
                  <li key={i} className="text-[12px] text-red-800 flex gap-1.5">
                    <span className="mt-1 w-1 h-1 rounded-full bg-red-400 shrink-0" /> {f}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </Section>

      {/* Save to participada modal */}
      {saveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[14px] font-semibold text-slate-800">Guardar em Participada</h3>
              <button onClick={() => setSaveModal(false)} className="text-slate-400 hover:text-slate-700"><X size={15} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-medium text-slate-500 uppercase tracking-wide block mb-0.5">Empresa</label>
                <select className={inp} value={selCompany} onChange={e => setSelCompany(e.target.value)}>
                  <option value="">— selecionar participada —</option>
                  {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-medium text-slate-500 uppercase tracking-wide block mb-0.5">Período</label>
                <input className={inp} value={selPeriod} onChange={e => setSelPeriod(e.target.value)} placeholder="Ex: 2024-Q3, 2024-FY" />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setSaveModal(false)} className="text-[12px] text-slate-500 px-4 py-2 rounded-lg border border-slate-200">Cancelar</button>
              <button onClick={confirmSave} disabled={!selCompany || !selPeriod || saving}
                className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-[12px] font-medium px-4 py-2 rounded-lg transition-colors">
                <Save size={12} /> {saving ? 'A guardar…' : 'Guardar KPI'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Upload Zone ────────────────────────────────────────────────────────────────
export function BalanceteAnalyzer({ companies }: { companies: AiCompany[] }) {
  const [file,    setFile]    = useState<File | null>(null)
  const [period,  setPeriod]  = useState('')
  const [loading, setLoading] = useState(false)
  const [result,  setResult]  = useState<BalanceteResult | null>(null)
  const [error,   setError]   = useState<string | null>(null)
  const [drag,    setDrag]    = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function handleFile(f: File) {
    if (!f.type.includes('pdf')) { setError('Apenas ficheiros PDF são suportados neste momento.'); return }
    if (f.size > 20 * 1024 * 1024) { setError('Ficheiro demasiado grande. Máximo: 20 MB.'); return }
    setFile(f); setError(null); setResult(null)
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDrag(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }, [])

  function toBase64(f: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload  = () => resolve((reader.result as string).split(',')[1])
      reader.onerror = reject
      reader.readAsDataURL(f)
    })
  }

  async function analyse() {
    if (!file) return
    setLoading(true); setError(null)
    try {
      const base64 = await toBase64(file)
      const res = await authFetch(`${API}/balancete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileBase64: base64,
          fileMimeType: 'application/pdf',
          period: period || undefined,
        }),
      })
      if (!res.ok) {
        const d = await res.json()
        setError(d.error ?? 'Erro na análise')
        return
      }
      setResult(await res.json())
    } catch (e) {
      setError('Erro de ligação ao servidor')
    } finally {
      setLoading(false)
    }
  }

  async function handleSaveKpi(companyId: string, period: string) {
    if (!result) return
    const { pl, balance, operational } = result
    await authFetch(`${API}/companies/${companyId}/kpis`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        period,
        period_date:       result.meta.period_date,
        revenue:           pl.revenue,
        gross_profit:      pl.gross_profit,
        ebitda:            pl.ebitda,
        ebit:              pl.ebit,
        net_profit:        pl.net_profit,
        total_assets:      balance.total_assets,
        total_liabilities: balance.total_liabilities,
        equity:            balance.equity,
        gross_debt:        balance.gross_debt,
        cash:              balance.cash,
        net_debt:          balance.net_debt,
        monthly_burn:      operational.monthly_burn,
        arr:               operational.arr,
        mrr:               operational.mrr,
        headcount:         operational.headcount,
      }),
    })
  }

  if (result) {
    return <ResultDashboard result={result} companies={companies} onSave={handleSaveKpi} onReset={() => { setResult(null); setFile(null) }} />
  }

  return (
    <div className="flex-1 overflow-y-auto bg-[#f5f6fa] flex items-start justify-center px-6 py-10">
      <div className="w-full max-w-xl space-y-4">
        <div className="text-center mb-6">
          <h1 className="text-[17px] font-semibold text-slate-800">Análise de Balancete</h1>
          <p className="text-[12px] text-slate-400 mt-1">
            Faz upload de um balancete em PDF. O Claude extrai todas as métricas e calcula os rácios automaticamente.
          </p>
        </div>

        {/* Drop zone */}
        <div
          onDragOver={e => { e.preventDefault(); setDrag(true) }}
          onDragLeave={() => setDrag(false)}
          onDrop={onDrop}
          onClick={() => !file && inputRef.current?.click()}
          className={`relative rounded-2xl border-2 border-dashed transition-all cursor-pointer ${
            drag    ? 'border-emerald-400 bg-emerald-50'  :
            file    ? 'border-emerald-300 bg-emerald-50/50 cursor-default' :
                      'border-slate-300 bg-white hover:border-emerald-300 hover:bg-emerald-50/30'
          }`}
        >
          <input
            ref={inputRef} type="file" accept=".pdf" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
          />
          <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
            {file ? (
              <>
                <FileText size={36} className="text-emerald-500 mb-3" />
                <p className="text-[13px] font-semibold text-slate-700">{file.name}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">{(file.size / 1024).toFixed(0)} KB</p>
                <button
                  onClick={e => { e.stopPropagation(); setFile(null) }}
                  className="mt-3 text-[11px] text-slate-400 hover:text-red-500 flex items-center gap-1 transition-colors"
                >
                  <X size={11} /> Remover
                </button>
              </>
            ) : (
              <>
                <Upload size={32} className="text-slate-300 mb-3" />
                <p className="text-[13px] font-medium text-slate-600">Arrasta o balancete para aqui</p>
                <p className="text-[11px] text-slate-400 mt-1">ou clica para selecionar · PDF</p>
              </>
            )}
          </div>
        </div>

        {/* Optional period */}
        <div className="bg-white rounded-xl border border-slate-200 px-4 py-3">
          <label className="text-[10px] font-medium text-slate-500 uppercase tracking-wide block mb-1.5">
            Período (opcional — Claude deteta automaticamente)
          </label>
          <input
            value={period} onChange={e => setPeriod(e.target.value)}
            placeholder="Ex: 2024-Q3, 2024-FY, 2024-H1"
            className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-[12px] text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-400"
          />
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-[12px] text-red-700 flex items-start gap-2">
            <AlertTriangle size={13} className="mt-0.5 shrink-0" /> {error}
          </div>
        )}

        <button
          onClick={analyse} disabled={!file || loading}
          className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-[13px] font-semibold py-3 rounded-xl transition-colors"
        >
          {loading
            ? <><Loader2 size={16} className="animate-spin" /> A analisar com Claude…</>
            : <><FileText size={16} /> Analisar Balancete</>}
        </button>

        {loading && (
          <p className="text-center text-[11px] text-slate-400">
            O Claude está a ler o documento e a extrair as métricas. Pode demorar 15–30 segundos.
          </p>
        )}

        {/* Info */}
        <div className="bg-slate-50 rounded-xl border border-slate-200 px-4 py-3 text-[11px] text-slate-500 space-y-1">
          <p className="font-medium text-slate-600">O que é extraído automaticamente:</p>
          <p>P&L completo · Balanço detalhado · 20+ rácios financeiros (rentabilidade, liquidez, endividamento, ciclo operacional) · Análise qualitativa com pontos fortes, riscos e red flags</p>
          <p className="pt-1">Após a análise, podes guardar os KPIs diretamente numa participada existente.</p>
        </div>
      </div>
    </div>
  )
}
