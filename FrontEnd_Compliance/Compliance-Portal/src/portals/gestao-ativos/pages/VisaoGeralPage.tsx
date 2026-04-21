import { useMemo, useState } from 'react'
import { ExternalLink, MapPin, Search } from 'lucide-react'
import type { Asset } from '../lib/api'
import {
  calcTotalCost, calcCapitalCost, calcBreakEven, calcAskingBCC,
  calcTransactionFee, calcYieldOnCost,
  fmtEur, fmtPctRaw,
} from '../lib/finance'
import { STATUS_LABELS, STATUS_CLS } from '../lib/status'

interface Props {
  assets: Asset[]
  onSelectAsset: (id: string) => void
}

const STATUS_DOT: Record<string, string> = {
  em_rendimento:  '#22c55e',
  sem_rendimento: 'rgba(26,28,34,0.15)',
  em_venda:       '#f59e0b',
  vendido:        '#60a5fa',
}

export function VisaoGeralPage({ assets, onSelectAsset }: Props) {
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    if (!q) return assets
    return assets.filter(a =>
      a.name.toLowerCase().includes(q) ||
      (a.spv ?? '').toLowerCase().includes(q) ||
      (a.location ?? '').toLowerCase().includes(q) ||
      (a.typology ?? '').toLowerCase().includes(q) ||
      (a.tenant ?? '').toLowerCase().includes(q)
    )
  }, [assets, search])

  const totals = useMemo(() => {
    let cost = 0, income = 0, breakEven = 0, asking = 0
    for (const a of filtered) {
      cost     += calcTotalCost(a)
      income   += a.income_current ?? 0
      breakEven += calcBreakEven(a)
      asking   += a.asking_price ?? calcAskingBCC(a)
    }
    return { cost, income, breakEven, asking, yield: cost > 0 ? income / cost : 0 }
  }, [filtered])

  return (
    <div className="ga-vg-page">
      {/* Toolbar */}
      <div className="ga-vg-toolbar">
        <div className="ga-search-wrap">
          <Search size={13} />
          <input
            className="ga-search"
            placeholder="Pesquisar ativo, SPV, localização…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ minWidth: 260 }}
          />
        </div>
        <div className="ga-vg-summary">
          <span className="ga-vg-summary-item">
            <span className="ga-vg-summary-label">Ativos</span>
            <span className="ga-vg-summary-value">{filtered.length}</span>
          </span>
          <span className="ga-vg-summary-sep" />
          <span className="ga-vg-summary-item">
            <span className="ga-vg-summary-label">Custo Total</span>
            <span className="ga-vg-summary-value">{fmtEur(totals.cost, true)}</span>
          </span>
          <span className="ga-vg-summary-sep" />
          <span className="ga-vg-summary-item">
            <span className="ga-vg-summary-label">Renda Anual</span>
            <span className="ga-vg-summary-value">{fmtEur(totals.income, true)}</span>
          </span>
          <span className="ga-vg-summary-sep" />
          <span className="ga-vg-summary-item">
            <span className="ga-vg-summary-label">Yield Médio</span>
            <span className="ga-vg-summary-value">{(totals.yield * 100).toFixed(1)}%</span>
          </span>
          <span className="ga-vg-summary-sep" />
          <span className="ga-vg-summary-item">
            <span className="ga-vg-summary-label">VALOR Inv.</span>
            <span className="ga-vg-summary-value accent">{fmtEur(totals.breakEven, true)}</span>
          </span>
          <span className="ga-vg-summary-sep" />
          <span className="ga-vg-summary-item">
            <span className="ga-vg-summary-label">Asking Total</span>
            <span className="ga-vg-summary-value">{fmtEur(totals.asking, true)}</span>
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="ga-vg-table-outer">
        <table className="ga-vg-table">
          <thead>
            <tr>
              <th className="ga-vg-th sticky-col">Ativo</th>
              <th className="ga-vg-th">SPV</th>
              <th className="ga-vg-th">Localização</th>
              <th className="ga-vg-th">Tipologia</th>
              <th className="ga-vg-th num">Área Terreno</th>
              <th className="ga-vg-th num">Área Const.</th>
              <th className="ga-vg-th">Inquilino</th>
              <th className="ga-vg-th">Aquisição</th>
              <th className="ga-vg-th">Notas</th>
              <th className="ga-vg-th num">Preço Compra</th>
              <th className="ga-vg-th num">IS</th>
              <th className="ga-vg-th num">Notário</th>
              <th className="ga-vg-th num">CAPEX</th>
              <th className="ga-vg-th num">OPEX</th>
              <th className="ga-vg-th num">Taxa Cap.</th>
              <th className="ga-vg-th num">Custo Cap.</th>
              <th className="ga-vg-th num">NOI</th>
              <th className="ga-vg-th num">Yield</th>
              <th className="ga-vg-th num">Oferta</th>
              <th className="ga-vg-th num">Taxa Trans.</th>
              <th className="ga-vg-th num accent-col">VALOR Inv.</th>
              <th className="ga-vg-th num">VALOR Avr.</th>
              <th className="ga-vg-th num">Comercializ.</th>
              <th className="ga-vg-th num">Asking Final</th>
              <th className="ga-vg-th">Estado</th>
              <th className="ga-vg-th"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(a => {
              const totalCostA = calcTotalCost(a)
              const capCost    = calcCapitalCost(a)
              const breakEven  = calcBreakEven(a)
              const askingBCC  = calcAskingBCC(a)
              const txFee      = calcTransactionFee(a)
              const yoc        = calcYieldOnCost(a)
              const [municipio] = (a.location ?? '').split(' - ')

              return (
                <tr key={a.id} className="ga-vg-row" onClick={() => onSelectAsset(a.id)}>
                  <td className="ga-vg-td sticky-col ga-vg-name-cell">
                    <span className="ga-vg-dot" style={{ background: STATUS_DOT[a.status] }} />
                    <span className="ga-vg-name">{a.name}</span>
                  </td>
                  <td className="ga-vg-td">
                    {a.spv ? <span className="ga-pill spv" style={{ fontSize: 9 }}>{a.spv}</span> : '—'}
                  </td>
                  <td className="ga-vg-td">
                    {a.location ? (
                      <span className="ga-vg-location">
                        <MapPin size={10} style={{ opacity: 0.4, flexShrink: 0 }} />
                        {municipio}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="ga-vg-td">{a.typology ?? '—'}</td>
                  <td className="ga-vg-td num">{a.land_area ? a.land_area.toLocaleString('pt-PT') + ' m²' : '—'}</td>
                  <td className="ga-vg-td num">{a.build_area ? a.build_area.toLocaleString('pt-PT') + ' m²' : '—'}</td>
                  <td className="ga-vg-td">{a.tenant ?? '—'}</td>
                  <td className="ga-vg-td">
                    {a.acquisition_date
                      ? new Date(a.acquisition_date).toLocaleDateString('pt-PT', { year: 'numeric', month: 'short' })
                      : '—'}
                  </td>
                  <td className="ga-vg-td ga-vg-notes-cell">{a.general_notes ?? '—'}</td>
                  <td className="ga-vg-td num mono">{fmtEur(a.purchase_price, true)}</td>
                  <td className="ga-vg-td num mono">{a.stamp_duty ? fmtEur(a.stamp_duty, true) : '—'}</td>
                  <td className="ga-vg-td num mono">{a.notary_fees ? fmtEur(a.notary_fees, true) : '—'}</td>
                  <td className="ga-vg-td num mono">{a.capex_current ? fmtEur(a.capex_current, true) : '—'}</td>
                  <td className="ga-vg-td num mono">{a.opex_current ? fmtEur(a.opex_current, true) : '—'}</td>
                  <td className="ga-vg-td num mono">{a.capital_cost ? fmtPctRaw(a.capital_cost) : '—'}</td>
                  <td className="ga-vg-td num mono">{fmtEur(capCost, true)}</td>
                  <td className="ga-vg-td num mono">{a.income_current ? fmtEur(a.income_current, true) : '—'}</td>
                  <td className="ga-vg-td num mono" style={{
                    color: yoc > 0.06 ? 'var(--green)' : yoc > 0.02 ? undefined : yoc > 0 ? 'var(--red)' : undefined
                  }}>
                    {yoc > 0 ? fmtPctRaw(yoc * 100) : '—'}
                  </td>
                  <td className="ga-vg-td num mono">{a.bidding_offer ? fmtEur(a.bidding_offer, true) : '—'}</td>
                  <td className="ga-vg-td num mono">{txFee > 0 ? fmtEur(txFee, true) : '—'}</td>
                  <td className="ga-vg-td num mono accent-col">{fmtEur(breakEven, true)}</td>
                  <td className="ga-vg-td num mono">{fmtEur(askingBCC, true)}</td>
                  <td className="ga-vg-td num mono">{a.commercialization ? fmtPctRaw(a.commercialization) : '—'}</td>
                  <td className="ga-vg-td num mono">{a.asking_price ? fmtEur(a.asking_price, true) : '—'}</td>
                  <td className="ga-vg-td">
                    <span className={`ga-pill ${STATUS_CLS[a.status] ?? 'sem_rendimento'}`} style={{ fontSize: 9 }}>
                      {STATUS_LABELS[a.status]}
                    </span>
                  </td>
                  <td className="ga-vg-td" onClick={e => e.stopPropagation()}>
                    {a.maps_link && (
                      <a href={a.maps_link} target="_blank" rel="noreferrer" className="ga-vg-maps-link">
                        <ExternalLink size={11} />
                      </a>
                    )}
                  </td>
                </tr>
              )
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={26} className="ga-vg-empty">
                  {search ? 'Nenhum ativo corresponde à pesquisa.' : 'Nenhum ativo registado.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
