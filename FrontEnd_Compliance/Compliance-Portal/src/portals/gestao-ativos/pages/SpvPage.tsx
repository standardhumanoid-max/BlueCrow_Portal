import { useMemo } from 'react'
import { ExternalLink, MapPin } from 'lucide-react'
import type { Asset } from '../lib/api'
import {
  calcTotalCost, calcCapitalCost, calcBreakEven,
  calcAskingBCC, calcTransactionFee, calcYieldOnCost,
  fmtEur, fmtPctRaw,
} from '../lib/finance'
import { STATUS_LABELS, STATUS_CLS } from '../lib/status'

interface Props {
  spv: string
  assets: Asset[]
  onSelectAsset: (id: string) => void
}

export function SpvPage({ spv, assets, onSelectAsset }: Props) {
  const list = useMemo(() => assets.filter(a => (a.spv ?? 'Sem SPV') === spv), [assets, spv])

  const { totalCost, totalBreakEven, totalAsking, totalIncome, avgYield } = useMemo(() => {
    let cost = 0, breakEvenSum = 0, asking = 0, income = 0
    for (const a of list) {
      cost       += calcTotalCost(a)
      breakEvenSum += calcBreakEven(a)
      asking     += a.asking_price ?? calcAskingBCC(a)
      income     += a.income_current ?? 0
    }
    return {
      totalCost:     cost,
      totalBreakEven: breakEvenSum,
      totalAsking:   asking,
      totalIncome:   income,
      avgYield:      cost > 0 ? income / cost : 0,
    }
  }, [list])

  return (
    <div className="ga-spv-page">

      {/* Header */}
      <div className="ga-spv-page-header">
        <div>
          <div className="ga-spv-page-eyebrow">Participada</div>
          <h1 className="ga-spv-page-title">{spv}</h1>
        </div>
        <div className="ga-spv-summary-strip">
          <div className="ga-spv-summary-kpi">
            <div className="ga-spv-summary-label">Ativos</div>
            <div className="ga-spv-summary-value">{list.length}</div>
          </div>
          <div className="ga-spv-summary-kpi">
            <div className="ga-spv-summary-label">Custo Total</div>
            <div className="ga-spv-summary-value">{fmtEur(totalCost, true)}</div>
          </div>
          <div className="ga-spv-summary-kpi">
            <div className="ga-spv-summary-label">Break-Even</div>
            <div className="ga-spv-summary-value accent">{fmtEur(totalBreakEven, true)}</div>
          </div>
          <div className="ga-spv-summary-kpi">
            <div className="ga-spv-summary-label">Asking Teórico</div>
            <div className="ga-spv-summary-value">{fmtEur(totalAsking, true)}</div>
          </div>
          <div className="ga-spv-summary-kpi">
            <div className="ga-spv-summary-label">Renda Anual</div>
            <div className="ga-spv-summary-value">{fmtEur(totalIncome, true)}</div>
          </div>
          <div className="ga-spv-summary-kpi">
            <div className="ga-spv-summary-label">Yield Médio</div>
            <div className="ga-spv-summary-value">{(avgYield * 100).toFixed(1)}%</div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="ga-spv-table-wrap">
        <table className="ga-spv-table">
          <thead>
            <tr>
              <th>Ativo</th>
              <th>Localização</th>
              <th>Tipologia</th>
              <th className="num">Área Terreno</th>
              <th className="num">Área Const.</th>
              <th>Inquilino</th>
              <th>Aquisição</th>
              <th className="num">Preço Compra</th>
              <th className="num">IS</th>
              <th className="num">Notário</th>
              <th className="num">CAPEX</th>
              <th className="num">OPEX</th>
              <th className="num">Taxa Cap.</th>
              <th className="num">Custo Cap.</th>
              <th className="num">Renda</th>
              <th className="num">Yield</th>
              <th className="num">Oferta</th>
              <th className="num">Taxa Trans.</th>
              <th className="num">VALOR Inv.</th>
              <th className="num">VALOR Avr.</th>
              <th className="num">Comercializ.</th>
              <th className="num">Asking Final</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {list.map(a => {
              const totalCostA  = calcTotalCost(a)
              const capCost     = calcCapitalCost(a)
              const breakEven   = calcBreakEven(a)
              const askingBCC   = calcAskingBCC(a)
              const effectiveAsking = a.asking_price ?? askingBCC
              const txFee       = calcTransactionFee(a)
              const yoc         = calcYieldOnCost(a)
              const [municipio] = (a.location ?? '').split(' - ')

              return (
                <tr key={a.id} className="ga-spv-row" onClick={() => onSelectAsset(a.id)}>
                  <td className="ga-spv-name-cell">
                    <span className="ga-spv-dot" style={{ background: a.status === 'em_rendimento' ? '#22c55e' : a.status === 'em_venda' ? '#f59e0b' : a.status === 'vendido' ? '#60a5fa' : 'rgba(255,255,255,0.18)' }} />
                    {a.name}
                  </td>
                  <td>
                    {a.location ? (
                      <span className="ga-spv-location">
                        <MapPin size={10} style={{ opacity: 0.4 }} />
                        {municipio}
                      </span>
                    ) : '—'}
                  </td>
                  <td>{a.typology ?? '—'}</td>
                  <td className="num">{a.land_area ? a.land_area.toLocaleString('pt-PT') + ' m²' : '—'}</td>
                  <td className="num">{a.build_area ? a.build_area.toLocaleString('pt-PT') + ' m²' : '—'}</td>
                  <td>{a.tenant ?? '—'}</td>
                  <td>{a.acquisition_date ? new Date(a.acquisition_date).toLocaleDateString('pt-PT', { year: 'numeric', month: 'short' }) : '—'}</td>
                  <td className="num">{fmtEur(a.purchase_price, true)}</td>
                  <td className="num">{a.stamp_duty ? fmtEur(a.stamp_duty, true) : '—'}</td>
                  <td className="num">{a.notary_fees ? fmtEur(a.notary_fees, true) : '—'}</td>
                  <td className="num">{a.capex_current ? fmtEur(a.capex_current, true) : '—'}</td>
                  <td className="num">{a.opex_current ? fmtEur(a.opex_current, true) : '—'}</td>
                  <td className="num">{a.capital_cost ? fmtPctRaw(a.capital_cost) : '—'}</td>
                  <td className="num">{fmtEur(capCost, true)}</td>
                  <td className="num">{a.income_current ? fmtEur(a.income_current, true) : '—'}</td>
                  <td className="num" style={{ color: yoc > 0.06 ? '#6ee7b7' : yoc > 0.02 ? undefined : '#fca5a5' }}>
                    {fmtPctRaw(yoc * 100)}
                  </td>
                  <td className="num">{a.bidding_offer ? fmtEur(a.bidding_offer, true) : '—'}</td>
                  <td className="num">{txFee > 0 ? fmtEur(txFee, true) : '—'}</td>
                  <td className="num accent">{fmtEur(breakEven, true)}</td>
                  <td className="num">{fmtEur(askingBCC, true)}</td>
                  <td className="num">{a.commercialization ? fmtPctRaw(a.commercialization) : '—'}</td>
                  <td className="num">{a.asking_price ? fmtEur(a.asking_price, true) : '—'}</td>
                  <td>
                    <span className={`ga-pill ${STATUS_CLS[a.status] ?? 'sem-rendimento'}`} style={{ fontSize: 9, padding: '2px 7px' }}>
                      {STATUS_LABELS[a.status]}
                    </span>
                  </td>
                  <td>
                    {a.maps_link && (
                      <a href={a.maps_link} target="_blank" rel="noreferrer"
                        onClick={e => e.stopPropagation()}
                        className="ga-spv-maps-link">
                        <ExternalLink size={11} />
                      </a>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
