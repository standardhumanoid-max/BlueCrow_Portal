import { useState, useEffect, useMemo } from 'react'
import { TrendingUp, TrendingDown, Minus, Plus, Trash2, Check, X } from 'lucide-react'
import type { AssetValuationRow, Valuation, Bov } from '../lib/api'
import { fetchAvaliacoes, upsertValuation, upsertBov } from '../lib/api'
import { calcTotalCost, calcBreakEven, calcAskingBCC, fmtEur } from '../lib/finance'

interface Props {
  onSelectAsset: (id: string) => void
}

type Tab = 'avaliacoes' | 'bovs'

// ── helpers ────────────────────────────────────────────────────────────────

function latestVal(valuations: Valuation[]): Valuation | null {
  if (!valuations.length) return null
  return [...valuations].sort((a, b) => b.year.localeCompare(a.year))[0]
}

function latestBov(bovs: Bov[]): Bov | null {
  if (!bovs.length) return null
  return [...bovs].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
}

function DeltaBadge({ value, base }: { value: number; base: number }) {
  if (!base) return <span className="ga-av-delta neutral">—</span>
  const pct = ((value - base) / base) * 100
  const cls = pct > 0 ? 'positive' : pct < 0 ? 'negative' : 'neutral'
  const Icon = pct > 0 ? TrendingUp : pct < 0 ? TrendingDown : Minus
  return (
    <span className={`ga-av-delta ${cls}`}>
      <Icon size={10} />
      {pct > 0 ? '+' : ''}{pct.toFixed(1)}%
    </span>
  )
}

// ── Main ───────────────────────────────────────────────────────────────────

export function AvaliacoesPage({ onSelectAsset }: Props) {
  const [tab,     setTab]     = useState<Tab>('avaliacoes')
  const [rows,    setRows]    = useState<AssetValuationRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  useEffect(() => { load() }, [])

  async function load() {
    try {
      setLoading(true); setError(null)
      setRows(await fetchAvaliacoes())
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }

  async function handleSaveValuation(assetId: string, year: string, value: number) {
    await upsertValuation(assetId, year, value)
    await load()
  }

  async function handleSaveBov(assetId: string, label: string, value: number | null, notes: string | null) {
    await upsertBov(assetId, label, value, notes)
    await load()
  }

  const kpis = useMemo(() => {
    let totalMarket = 0, totalCost = 0, withVal = 0
    for (const r of rows) {
      const lv = latestVal(r.valuations)
      const cost = calcTotalCost(r as any)
      totalCost += cost
      if (lv?.value) { totalMarket += lv.value; withVal++ }
    }
    return { totalMarket, totalCost, withVal, total: rows.length }
  }, [rows])

  if (loading) return <div className="ga-av-loading">A carregar avaliações…</div>
  if (error)   return <div className="ga-av-error">Erro: {error}</div>

  return (
    <div className="ga-av-page">

      {/* KPI strip */}
      <div className="ga-av-kpi-row">
        <div className="ga-av-kpi">
          <div className="ga-av-kpi-label">Ativos com Avaliação</div>
          <div className="ga-av-kpi-value">{kpis.withVal} <span className="ga-av-kpi-total">/ {kpis.total}</span></div>
        </div>
        <div className="ga-av-kpi accent">
          <div className="ga-av-kpi-label">Valor de Mercado Total</div>
          <div className="ga-av-kpi-value">{fmtEur(kpis.totalMarket, true)}</div>
          <div className="ga-av-kpi-sub">soma das últimas avaliações</div>
        </div>
        <div className="ga-av-kpi">
          <div className="ga-av-kpi-label">Custo Total Portefólio</div>
          <div className="ga-av-kpi-value">{fmtEur(kpis.totalCost, true)}</div>
        </div>
        <div className={`ga-av-kpi ${kpis.totalMarket > kpis.totalCost ? 'positive' : 'negative'}`}>
          <div className="ga-av-kpi-label">Delta Mercado vs Custo</div>
          <div className="ga-av-kpi-value">{fmtEur(kpis.totalMarket - kpis.totalCost, true)}</div>
          <div className="ga-av-kpi-sub">
            {kpis.totalCost > 0
              ? `${(((kpis.totalMarket - kpis.totalCost) / kpis.totalCost) * 100).toFixed(1)}%`
              : '—'}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="ga-av-tabs">
        <button className={`ga-av-tab${tab === 'avaliacoes' ? ' active' : ''}`} onClick={() => setTab('avaliacoes')}>
          Avaliações
        </button>
        <button className={`ga-av-tab${tab === 'bovs' ? ' active' : ''}`} onClick={() => setTab('bovs')}>
          BOV
        </button>
      </div>

      {/* Content */}
      {tab === 'avaliacoes' ? (
        <ValuationsTab rows={rows} onSave={handleSaveValuation} onSelectAsset={onSelectAsset} />
      ) : (
        <BovsTab rows={rows} onSave={handleSaveBov} onSelectAsset={onSelectAsset} />
      )}
    </div>
  )
}

// ── Valuations tab ─────────────────────────────────────────────────────────

function ValuationsTab({ rows, onSave, onSelectAsset }: {
  rows: AssetValuationRow[]
  onSave: (assetId: string, year: string, value: number) => Promise<void>
  onSelectAsset: (id: string) => void
}) {
  const [adding, setAdding] = useState<string | null>(null) // assetId
  const [newYear, setNewYear] = useState('')
  const [newVal, setNewVal] = useState('')
  const [saving, setSaving] = useState(false)

  async function save(assetId: string) {
    if (!newYear.trim() || !newVal) return
    setSaving(true)
    try {
      await onSave(assetId, newYear.trim(), Number(newVal))
      setAdding(null); setNewYear(''); setNewVal('')
    } finally { setSaving(false) }
  }

  return (
    <div className="ga-av-table-wrap">
      <table className="ga-av-table">
        <thead>
          <tr>
            <th>Ativo</th>
            <th>SPV</th>
            <th className="num">Custo Total</th>
            <th className="num">Break-Even</th>
            <th className="num">Última Avaliação</th>
            <th className="num">Ano</th>
            <th className="num">Δ vs Custo</th>
            <th className="num">Δ vs Break-Even</th>
            <th>Histórico</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => {
            const cost   = calcTotalCost(r as any)
            const be     = calcBreakEven(r as any)
            const lv     = latestVal(r.valuations)
            const isAdding = adding === r.id

            return (
              <tr key={r.id} className="ga-av-row">
                <td className="ga-av-name" onClick={() => onSelectAsset(r.id)}>{r.name}</td>
                <td className="ga-av-spv">{r.spv ?? '—'}</td>
                <td className="num mono">{fmtEur(cost, true)}</td>
                <td className="num mono">{fmtEur(be, true)}</td>
                <td className="num mono accent">
                  {lv?.value ? fmtEur(lv.value, true) : <span className="ga-av-empty-cell">—</span>}
                </td>
                <td className="num mono muted">{lv?.year ?? '—'}</td>
                <td className="num">
                  {lv?.value ? <DeltaBadge value={lv.value} base={cost} /> : '—'}
                </td>
                <td className="num">
                  {lv?.value ? <DeltaBadge value={lv.value} base={be} /> : '—'}
                </td>
                <td>
                  <div className="ga-av-history">
                    {r.valuations.slice().sort((a,b) => a.year.localeCompare(b.year)).map(v => (
                      <span key={v.year} className="ga-av-hist-pill" title={fmtEur(v.value)}>
                        {v.year}
                      </span>
                    ))}
                    {r.valuations.length === 0 && <span className="ga-av-no-hist">sem histórico</span>}
                  </div>
                </td>
                <td>
                  {isAdding ? (
                    <div className="ga-av-inline-add">
                      <input className="ga-av-input" placeholder="Ano" value={newYear}
                        onChange={e => setNewYear(e.target.value)} style={{ width: 56 }} />
                      <input className="ga-av-input" placeholder="Valor €" type="number" value={newVal}
                        onChange={e => setNewVal(e.target.value)} style={{ width: 80 }} />
                      <button className="ga-av-icon-btn confirm" disabled={saving} onClick={() => save(r.id)}>
                        <Check size={11} />
                      </button>
                      <button className="ga-av-icon-btn" onClick={() => { setAdding(null); setNewYear(''); setNewVal('') }}>
                        <X size={11} />
                      </button>
                    </div>
                  ) : (
                    <button className="ga-av-icon-btn" onClick={() => setAdding(r.id)}>
                      <Plus size={11} />
                    </button>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── BOV tab ────────────────────────────────────────────────────────────────

function BovsTab({ rows, onSave, onSelectAsset }: {
  rows: AssetValuationRow[]
  onSave: (assetId: string, label: string, value: number | null, notes: string | null) => Promise<void>
  onSelectAsset: (id: string) => void
}) {
  const [adding, setAdding] = useState<string | null>(null)
  const [newLabel, setNewLabel] = useState('')
  const [newVal, setNewVal] = useState('')
  const [newNotes, setNewNotes] = useState('')
  const [saving, setSaving] = useState(false)

  async function save(assetId: string) {
    if (!newLabel.trim()) return
    setSaving(true)
    try {
      await onSave(assetId, newLabel.trim(), newVal ? Number(newVal) : null, newNotes || null)
      setAdding(null); setNewLabel(''); setNewVal(''); setNewNotes('')
    } finally { setSaving(false) }
  }

  return (
    <div className="ga-av-table-wrap">
      <table className="ga-av-table">
        <thead>
          <tr>
            <th>Ativo</th>
            <th>SPV</th>
            <th className="num">Custo Total</th>
            <th className="num">Break-Even</th>
            <th className="num">Asking Teórico</th>
            <th className="num">Último BOV</th>
            <th>Label</th>
            <th className="num">Δ vs Break-Even</th>
            <th className="num">Δ vs Asking</th>
            <th>Notas</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => {
            const cost    = calcTotalCost(r as any)
            const be      = calcBreakEven(r as any)
            const asking  = r.asking_price ?? calcAskingBCC(r as any)
            const lb      = latestBov(r.bovs)
            const isAdding = adding === r.id

            return (
              <tr key={r.id} className="ga-av-row">
                <td className="ga-av-name" onClick={() => onSelectAsset(r.id)}>{r.name}</td>
                <td className="ga-av-spv">{r.spv ?? '—'}</td>
                <td className="num mono">{fmtEur(cost, true)}</td>
                <td className="num mono">{fmtEur(be, true)}</td>
                <td className="num mono">{fmtEur(asking, true)}</td>
                <td className="num mono accent">
                  {lb?.value ? fmtEur(lb.value, true) : <span className="ga-av-empty-cell">—</span>}
                </td>
                <td className="muted" style={{ fontSize: 11 }}>{lb?.label ?? '—'}</td>
                <td className="num">
                  {lb?.value ? <DeltaBadge value={lb.value} base={be} /> : '—'}
                </td>
                <td className="num">
                  {lb?.value ? <DeltaBadge value={lb.value} base={asking} /> : '—'}
                </td>
                <td className="ga-av-notes-cell">{lb?.notes ?? '—'}</td>
                <td>
                  {isAdding ? (
                    <div className="ga-av-inline-add">
                      <input className="ga-av-input" placeholder="Label" value={newLabel}
                        onChange={e => setNewLabel(e.target.value)} style={{ width: 80 }} />
                      <input className="ga-av-input" placeholder="Valor €" type="number" value={newVal}
                        onChange={e => setNewVal(e.target.value)} style={{ width: 80 }} />
                      <input className="ga-av-input" placeholder="Notas" value={newNotes}
                        onChange={e => setNewNotes(e.target.value)} style={{ width: 100 }} />
                      <button className="ga-av-icon-btn confirm" disabled={saving} onClick={() => save(r.id)}>
                        <Check size={11} />
                      </button>
                      <button className="ga-av-icon-btn" onClick={() => { setAdding(null); setNewLabel(''); setNewVal(''); setNewNotes('') }}>
                        <X size={11} />
                      </button>
                    </div>
                  ) : (
                    <button className="ga-av-icon-btn" onClick={() => setAdding(r.id)}>
                      <Plus size={11} />
                    </button>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
