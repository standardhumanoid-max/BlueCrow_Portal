import { useState } from 'react'
import type { Asset } from '../lib/api'
import { updateAsset } from '../lib/api'
import {
  calcTotalCost, calcBreakEven, calcBreakEvenCash,
  calcYieldOnCost, calcAskingBCC, calcBluecrowGross,
  calcBluecrowNet, calcTransactionFee, fmtEur, fmtPct, fmtPctRaw
} from '../lib/finance'
import { STATUS_LABELS, STATUS_CLS } from '../lib/status'

interface Props {
  assets: Asset[]
  onOpenFicha: (id: string) => void
  onReload: () => void
}

export function ComercializacaoPage({ assets, onOpenFicha, onReload }: Props) {
  const emVenda = assets.filter(a => a.status === 'em_venda')
  const [selectedId, setSelectedId] = useState<string | null>(emVenda[0]?.id ?? null)
  const selected = assets.find(a => a.id === selectedId) ?? null

  return (
    <div className="ga-comercial-layout">
      {/* Left rail — assets em venda */}
      <aside className="ga-comercial-rail">
        <div className="ga-comercial-rail-title">Em Venda</div>
        {emVenda.length === 0 ? (
          <div className="ga-comercial-empty">Nenhum ativo em venda.</div>
        ) : emVenda.map(a => (
          <button key={a.id}
            className={`ga-comercial-rail-item${selectedId === a.id ? ' active' : ''}`}
            onClick={() => setSelectedId(a.id)}>
            <div className="ga-comercial-rail-name">{a.name}</div>
            <div className="ga-comercial-rail-meta">{a.spv ?? '—'} · {a.location ?? '—'}</div>
            <div className="ga-comercial-rail-be">{fmtEur(calcBreakEven(a), true)} BE</div>
          </button>
        ))}
      </aside>

      {/* Workspace */}
      <div className="ga-comercial-workspace">
        {!selected ? (
          <div className="ga-comercial-placeholder">
            Selecione um ativo em venda para ver análise comercial.
          </div>
        ) : (
          <AssetWorkspace
            asset={selected}
            onOpenFicha={() => onOpenFicha(selected.id)}
            onReload={onReload}
          />
        )}

        {/* Pipeline table — all assets */}
        <div className="ga-section-title" style={{ marginTop: '2rem' }}>Pipeline Completo</div>
        <div className="ga-table-wrap">
          <table className="ga-table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>SPV</th>
                <th>Status</th>
                <th style={{textAlign:'right'}}>Custo Total</th>
                <th style={{textAlign:'right'}}>Break-Even</th>
                <th style={{textAlign:'right'}}>Asking BCC</th>
                <th style={{textAlign:'right'}}>Oferta</th>
                <th style={{textAlign:'right'}}>Bluecrow Net</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {assets.map(a => (
                <tr key={a.id} className="ga-table-row">
                  <td className="ga-table-name">{a.name}</td>
                  <td className="ga-table-mono">{a.spv ?? '—'}</td>
                  <td><span className={`ga-pill ${STATUS_CLS[a.status] ?? 'sem-rendimento'}`}>{STATUS_LABELS[a.status] ?? a.status}</span></td>
                  <td style={{textAlign:'right'}} className="ga-table-mono">{fmtEur(calcTotalCost(a))}</td>
                  <td style={{textAlign:'right'}} className="ga-table-mono">{fmtEur(calcBreakEven(a))}</td>
                  <td style={{textAlign:'right'}} className="ga-table-mono">{fmtEur(calcAskingBCC(a))}</td>
                  <td style={{textAlign:'right'}} className="ga-table-mono">{a.bidding_offer ? fmtEur(a.bidding_offer) : '—'}</td>
                  <td style={{textAlign:'right'}} className={`ga-table-mono ${(calcBluecrowNet(a) ?? 0) < 0 ? 'text-red-600' : 'text-green-700'}`}>
                    {a.bidding_offer ? fmtEur(calcBluecrowNet(a)) : '—'}
                  </td>
                  <td>
                    <button className="ga-ficha-btn" onClick={() => onOpenFicha(a.id)}>Ficha →</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ── Asset workspace ────────────────────────────────────────────────────────────

function AssetWorkspace({ asset, onOpenFicha, onReload }: {
  asset: Asset; onOpenFicha: () => void; onReload: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<Partial<Asset>>({})
  const [saving, setSaving] = useState(false)

  const a = editing ? { ...asset, ...draft } : asset

  function startEdit() {
    setDraft({
      bidding_offer:   asset.bidding_offer,
      transaction_fee: asset.transaction_fee,
      commercialization: asset.commercialization,
      asking_price:    asset.asking_price,
    })
    setEditing(true)
  }

  async function save() {
    setSaving(true)
    try {
      await updateAsset(asset.id, draft)
      await onReload()
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  const totalCost   = calcTotalCost(a)
  const breakEven   = calcBreakEven(a)
  const breakEvenCash = calcBreakEvenCash(a)
  const askingBCC   = calcAskingBCC(a)
  const effectiveAsking = a.asking_price ?? askingBCC
  const txFee       = calcTransactionFee(a)
  const bcGross     = calcBluecrowGross(a)
  const bcNet       = calcBluecrowNet(a)

  // Scenarios
  const scenarios = [85, 90, 95, 100, 105, 110].map(pct => {
    const offer = effectiveAsking * pct / 100
    const fee   = offer * (a.transaction_fee ?? 0) / 100
    const gross = offer - totalCost
    const net   = gross - fee
    return { pct, offer, fee, gross, net }
  })

  return (
    <div className="ga-workspace">
      <div className="ga-workspace-header">
        <div>
          <div className="ga-workspace-title">{asset.name}</div>
          <div className="ga-workspace-sub">{asset.spv ?? '—'} · {asset.location ?? '—'}</div>
        </div>
        <div className="ga-workspace-actions">
          <button className="ga-btn-secondary" onClick={onOpenFicha}>Ficha →</button>
          {editing
            ? <>
                <button className="ga-btn-secondary" onClick={() => setEditing(false)}>Cancelar</button>
                <button className="ga-btn-primary" onClick={save} disabled={saving}>
                  {saving ? 'A guardar…' : 'Guardar'}
                </button>
              </>
            : <button className="ga-btn-secondary" onClick={startEdit}>Editar Preços</button>
          }
        </div>
      </div>

      {/* Pricing fields */}
      <div className="ga-pricing-grid">
        <PricingField
          label="Oferta (Bidding Offer)"
          value={editing ? (draft.bidding_offer ?? 0) : (asset.bidding_offer ?? 0)}
          editing={editing}
          onChange={v => setDraft(d => ({ ...d, bidding_offer: v }))}
          type="eur"
        />
        <PricingField
          label="Fee Transação (%)"
          value={editing ? (draft.transaction_fee ?? 0) : (asset.transaction_fee ?? 0)}
          editing={editing}
          onChange={v => setDraft(d => ({ ...d, transaction_fee: v }))}
          type="pct"
        />
        <PricingField
          label="Margem Comercialização (%)"
          value={editing ? (draft.commercialization ?? 0) : (asset.commercialization ?? 0)}
          editing={editing}
          onChange={v => setDraft(d => ({ ...d, commercialization: v }))}
          type="pct"
        />
        <PricingField
          label="Asking Price (override)"
          value={editing ? (draft.asking_price ?? 0) : (asset.asking_price ?? 0)}
          editing={editing}
          onChange={v => setDraft(d => ({ ...d, asking_price: v || null }))}
          type="eur"
          nullable
        />
      </div>

      {/* Computed metrics */}
      <div className="ga-metrics-grid">
        <MetricRow label="Custo Total"        value={fmtEur(totalCost)} />
        <MetricRow label="Break-Even (c/ renda)" value={fmtEur(breakEven)} />
        <MetricRow label="Break-Even Cash"    value={fmtEur(breakEvenCash)} />
        <MetricRow label="Asking BCC (teórico)" value={fmtEur(askingBCC)} />
        <MetricRow label="Asking Efetivo"     value={fmtEur(effectiveAsking)} />
        <MetricRow label="Fee Transação"      value={fmtEur(txFee)} />
        <MetricRow label="BlueCrow Gross"     value={fmtEur(bcGross)} accent={bcGross < 0 ? 'red' : 'green'} />
        <MetricRow label="BlueCrow Net"       value={fmtEur(bcNet)}   accent={bcNet  < 0 ? 'red' : 'green'} />
      </div>

      {/* Scenarios table */}
      <div className="ga-section-title">Cenários de Venda</div>
      <div className="ga-table-wrap">
        <table className="ga-table">
          <thead>
            <tr>
              <th>% do Asking</th>
              <th style={{textAlign:'right'}}>Oferta</th>
              <th style={{textAlign:'right'}}>Fee</th>
              <th style={{textAlign:'right'}}>Gross</th>
              <th style={{textAlign:'right'}}>Net</th>
            </tr>
          </thead>
          <tbody>
            {scenarios.map(s => (
              <tr key={s.pct} className={`ga-table-row${s.pct === 100 ? ' ga-table-row-highlight' : ''}`}>
                <td>{s.pct}%</td>
                <td style={{textAlign:'right'}} className="ga-table-mono">{fmtEur(s.offer)}</td>
                <td style={{textAlign:'right'}} className="ga-table-mono">{fmtEur(s.fee)}</td>
                <td style={{textAlign:'right'}} className={`ga-table-mono ${s.gross < 0 ? 'text-red-600' : 'text-green-700'}`}>{fmtEur(s.gross)}</td>
                <td style={{textAlign:'right'}} className={`ga-table-mono ${s.net   < 0 ? 'text-red-600' : 'text-green-700'}`}>{fmtEur(s.net)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function PricingField({ label, value, editing, onChange, type, nullable }: {
  label: string; value: number | null; editing: boolean
  onChange: (v: number) => void; type: 'eur' | 'pct'; nullable?: boolean
}) {
  const display = value == null ? '—' : type === 'eur' ? fmtEur(value) : fmtPctRaw(value)
  return (
    <div className="ga-pricing-field">
      <div className="ga-pricing-label">{label}</div>
      {editing ? (
        <input
          type="number"
          className="ga-inline-input"
          value={value ?? ''}
          onChange={e => onChange(parseFloat(e.target.value) || 0)}
          step={type === 'pct' ? '0.1' : '1000'}
        />
      ) : (
        <div className="ga-pricing-value">{display}</div>
      )}
    </div>
  )
}

function MetricRow({ label, value, accent }: { label: string; value: string; accent?: 'red' | 'green' }) {
  const cls = accent === 'red' ? 'text-red-600' : accent === 'green' ? 'text-green-700' : ''
  return (
    <div className="ga-metric-row">
      <span className="ga-metric-label">{label}</span>
      <span className={`ga-metric-value ga-table-mono ${cls}`}>{value}</span>
    </div>
  )
}
