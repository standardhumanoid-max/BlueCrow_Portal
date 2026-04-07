import { useMemo, useState } from 'react'
import { useDatabase } from '../hooks/useDatabase'
import { fmtE, fmtP, getFundBadgeStyle, hasActiveExposure, latestVal, metrics, nonEquityInstrumentValues } from '../lib/helpers'
import { FUNDS } from '../types/database'
import type { Fund, FundAdjustment, FundData } from '../types/database'

function uid() {
  return crypto.randomUUID()
}

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function cloneFundData(fd?: FundData): FundData {
  return {
    subscrito: +(fd?.subscrito || 0),
    adjustments: (fd?.adjustments || []).map((adjustment) => ({
      ...adjustment,
      amount: +(adjustment.amount || 0),
    })),
  }
}

function emptyAdjustment(): FundAdjustment {
  return {
    id: uid(),
    date: todayISO(),
    amount: 0,
    description: '',
    type: '',
  }
}

const inlineInput: React.CSSProperties = {
  border: '1px solid var(--border)',
  borderRadius: 4,
  background: 'var(--surface-raised)',
  color: 'var(--text-primary)',
  padding: '3px 7px',
  fontSize: 12,
  fontFamily: 'var(--font-mono)',
  outline: 'none',
}

const iconBtn: React.CSSProperties = {
  border: 0,
  background: 'none',
  cursor: 'pointer',
  fontSize: 12,
  color: 'var(--text-muted)',
  fontWeight: 600,
  padding: '2px 6px',
  borderRadius: 4,
}

export function CapitalPage() {
  const { db, loading, error, save } = useDatabase()
  const [fundDrafts, setFundDrafts] = useState<Partial<Record<Fund, FundData>>>({})
  const [saving, setSaving] = useState(false)
  const [detailFund, setDetailFund] = useState<Fund>(FUNDS[0])

  const hasPendingChanges = Object.keys(fundDrafts).length > 0

  function updateFundDraft(fund: Fund, updater: (current: FundData) => FundData) {
    if (!db) return
    setFundDrafts((prev) => {
      const current = prev[fund] ?? cloneFundData(db.funds[fund])
      return {
        ...prev,
        [fund]: updater(cloneFundData(current)),
      }
    })
  }

  function addAdjustment(fund: Fund) {
    updateFundDraft(fund, (current) => ({
      ...current,
      adjustments: [...current.adjustments, emptyAdjustment()],
    }))
  }

  function updateAdjustment(fund: Fund, adjustmentId: string, patch: Partial<FundAdjustment>) {
    updateFundDraft(fund, (current) => ({
      ...current,
      adjustments: current.adjustments.map((adjustment) =>
        adjustment.id === adjustmentId ? { ...adjustment, ...patch } : adjustment,
      ),
    }))
  }

  function removeAdjustment(fund: Fund, adjustmentId: string) {
    updateFundDraft(fund, (current) => ({
      ...current,
      adjustments: current.adjustments.filter((adjustment) => adjustment.id !== adjustmentId),
    }))
  }

  async function handleSave() {
    if (!db || !hasPendingChanges) return
    setSaving(true)
    try {
      const updatedFunds = { ...db.funds }
      for (const fund of FUNDS) {
        updatedFunds[fund] = fundDrafts[fund] ?? cloneFundData(db.funds[fund])
      }
      await save({ ...db, funds: updatedFunds })
      setFundDrafts({})
    } finally {
      setSaving(false)
    }
  }

  const data = useMemo(() => {
    if (!db) return null

    return FUNDS.map((fund) => {
      const fd = fundDrafts[fund] ?? cloneFundData(db.funds[fund])
      const subscrito = +(fd.subscrito || 0)
      const adjTotal = fd.adjustments.reduce((sum, adjustment) => sum + (+(adjustment.amount || 0)), 0)
      const adjustments = [...fd.adjustments].sort(
        (a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime(),
      )

      const invested = db.companies.reduce((sum, company) => {
        const m = metrics(company, db.valuations, [fund])
        return sum + m.totInv
      }, 0)

      const realised = db.companies.reduce((sum, company) => {
        return (
          sum +
          (company.sales || [])
            .filter((sale) => sale.fund === fund)
            .reduce((companySum, sale) => companySum + (+(sale.amount || 0)), 0)
        )
      }, 0)

      const nav = db.companies
        .filter((company) => hasActiveExposure(company, [fund]))
        .reduce((sum, company) => {
          const m = metrics(company, db.valuations, [fund])
          return sum + (m.nav ?? 0)
        }, 0)

      const disponivel = subscrito + adjTotal - invested
      const deployedPct = subscrito > 0 ? (invested / subscrito) * 100 : null
      const moic = invested > 0 ? nav / invested : null

      return {
        fund,
        subscrito,
        adjTotal,
        adjustments,
        invested,
        realised,
        nav,
        disponivel,
        deployedPct,
        moic,
      }
    })
  }, [db, fundDrafts])

  const allAdjustments = useMemo(() => {
    if (!data) return []

    return data
      .flatMap((item) =>
        item.adjustments.map((adjustment) => ({
          fund: item.fund,
          ...adjustment,
        })),
      )
      .sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime())
  }, [data])

  const detailRows = useMemo(() => {
    if (!db) return []
    return db.companies
      .filter((c) => hasActiveExposure(c, [detailFund]))
      .map((c) => {
        const lv = latestVal(c.id, db.valuations)
        const m = metrics(c, db.valuations, [detailFund])
        const instruments = nonEquityInstrumentValues(c, [detailFund], lv)
        const byType = (type: string) =>
          instruments.filter((i) => i.type === type).reduce((s, i) => s + i.value, 0)
        const safe = byType('SAFE')
        const cln = byType('CLN')
        const prest = byType('Prest. Suplementares')
        const mutuo = byType('Mútuo')
        const equityNav = m.equityNav ?? 0
        const unrealized = m.eqInv > 0 ? equityNav - m.eqInv : null
        return { company: c, eqCost: m.eqInv, equityNav, unrealized, safe, cln, prest, mutuo, nav: m.nav ?? 0 }
      })
      .sort((a, b) => (a.company.name || '').localeCompare(b.company.name || ''))
  }, [db, detailFund])

  if (loading) return <div className="page-shell"><p style={{ color: 'var(--text-muted)' }}>A carregar...</p></div>
  if (error) return <div className="page-shell"><p style={{ color: 'var(--crimson-400)' }}>Erro: {error}</p></div>
  if (!db || !data) return null

  const totSubscrito = data.reduce((sum, item) => sum + item.subscrito, 0)
  const totInvested = data.reduce((sum, item) => sum + item.invested, 0)
  const totNAV = data.reduce((sum, item) => sum + item.nav, 0)
  const totDisponivel = data.reduce((sum, item) => sum + item.disponivel, 0)
  const totRealised = data.reduce((sum, item) => sum + item.realised, 0)

  return (
    <div className="page-shell">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Capital</h1>
          <p className="page-subtitle">Subscrito, deployed, NAV e ajustes por fundo</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {hasPendingChanges && (
            <span style={{ fontSize: 12, color: 'var(--amber-400)' }}>Alterações por guardar</span>
          )}
          <button
            className="primary-button"
            style={{ width: 'auto', height: 38, padding: '0 18px', fontSize: 13 }}
            onClick={() => void handleSave()}
            disabled={saving || !hasPendingChanges}
          >
            {saving ? 'A guardar...' : 'Guardar'}
          </button>
        </div>
      </div>

      <div className="kpi-grid" style={{ marginBottom: 28 }}>
        <div className="kpi-card" data-tooltip="Capital comprometido pelos investidores por fundo (editável na tabela abaixo)">
          <div className="kpi-label">Total Subscrito</div>
          <div className="kpi-value">{fmtE(totSubscrito)}</div>
        </div>
        <div className="kpi-card" data-tooltip={"Soma de todas as tranches activas:\nEquity + SAFE + CLN + Prest. Sup. + Mútuo\n(ao custo de aquisição, não ao valor actual)"}>
          <div className="kpi-label">Total Investido</div>
          <div className="kpi-value">{fmtE(totInvested)}</div>
          <div className="kpi-sub">
            {totSubscrito > 0 ? `${((totInvested / totSubscrito) * 100).toFixed(1)}% deployed` : ''}
          </div>
        </div>
        <div className="kpi-card" data-tooltip={"Capital disponível para investir:\nSubscrito + Ajustes − Investido"}>
          <div className="kpi-label">Dry Powder</div>
          <div
            className="kpi-value"
            style={{ color: totDisponivel >= 0 ? 'var(--jade-500)' : 'var(--crimson-500)' }}
          >
            {fmtE(totDisponivel)}
          </div>
          <div className="kpi-sub">Subscrito + ajustes − investido</div>
        </div>
        <div className="kpi-card" data-tooltip={"Valor de mercado estimado da carteira:\nNAV Equity (pós dedução SAFE/Prest.)\n+ Instrumentos de dívida a fair value\n(ou nominal se sem avaliação)"}>
          <div className="kpi-label">NAV Total</div>
          <div className="kpi-value">{fmtE(totNAV)}</div>
          <div className="kpi-sub">
            {totInvested > 0 ? `MOIC ${(totNAV / totInvested).toFixed(2)}x` : ''}
          </div>
        </div>
        <div className="kpi-card" data-tooltip={"Montante já recebido de saídas/vendas\n(realizadas, não inclui NAV latente)"}>
          <div className="kpi-label">Total Realizado</div>
          <div className="kpi-value">{fmtE(totRealised)}</div>
          <div className="kpi-sub">Saídas acumuladas</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <span className="card-title">Composição do Deployed por Fundo</span>
        </div>
        <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {data.map((item) => {
            const badgeStyle = getFundBadgeStyle(item.fund)
            const pct = totInvested > 0 ? (item.invested / totInvested) * 100 : 0
            return (
              <div key={item.fund} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span className="fund-badge" style={{ ...badgeStyle, minWidth: 78, textAlign: 'center' }}>
                  {item.fund}
                </span>
                <div
                  style={{
                    flex: 1,
                    height: 6,
                    background: 'var(--border)',
                    borderRadius: 3,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${pct}%`,
                      height: '100%',
                      background: badgeStyle.color,
                      opacity: 0.6,
                      borderRadius: 3,
                    }}
                  />
                </div>
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11,
                    color: 'var(--text-muted)',
                    minWidth: 38,
                    textAlign: 'right',
                  }}
                >
                  {pct.toFixed(1)}%
                </span>
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 12,
                    color: 'var(--text-secondary)',
                    minWidth: 110,
                    textAlign: 'right',
                  }}
                >
                  {fmtE(item.invested)}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">Detalhe por Fundo</span>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Fundo</th>
                <th className="right">Subscrito</th>
                <th className="right">Ajustes</th>
                <th className="right">Investido</th>
                <th className="right">% Deployed</th>
                <th className="right">Dry Powder</th>
                <th className="right">NAV</th>
                <th className="right">Realizado</th>
                <th className="right">MOIC</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.map((item) => (
                <tr key={item.fund}>
                  <td>
                    <span className="fund-badge" style={getFundBadgeStyle(item.fund)}>{item.fund}</span>
                  </td>
                  <td className="right">
                    <input
                      type="number"
                      value={item.subscrito}
                      onChange={(event) => {
                        const value = event.target.value === '' ? 0 : Number(event.target.value)
                        updateFundDraft(item.fund, (current) => ({ ...current, subscrito: value }))
                      }}
                      style={{ ...inlineInput, width: 130, textAlign: 'right' }}
                    />
                  </td>
                  <td className="right mono" style={{ color: item.adjTotal >= 0 ? 'var(--jade-500)' : 'var(--crimson-500)' }}>
                    {item.adjTotal === 0 ? '—' : `${item.adjTotal > 0 ? '+' : ''}${fmtE(item.adjTotal)}`}
                  </td>
                  <td className="right mono">{fmtE(item.invested)}</td>
                  <td className="right mono">
                    {item.deployedPct != null ? (
                      <span
                        style={{
                          color:
                            item.deployedPct > 90
                              ? 'var(--crimson-500)'
                              : item.deployedPct > 70
                                ? 'var(--amber-400)'
                                : 'var(--text-secondary)',
                        }}
                      >
                        {item.deployedPct.toFixed(1)}%
                      </span>
                    ) : '—'}
                  </td>
                  <td
                    className="right mono"
                    style={{ color: item.disponivel >= 0 ? 'var(--jade-500)' : 'var(--crimson-500)' }}
                  >
                    {fmtE(item.disponivel)}
                  </td>
                  <td className="right bold">{fmtE(item.nav)}</td>
                  <td className="right mono">
                    {item.realised > 0 ? fmtE(item.realised) : <span style={{ color: 'var(--text-disabled)' }}>—</span>}
                  </td>
                  <td className="right mono">{item.moic != null ? `${item.moic.toFixed(2)}x` : '—'}</td>
                  <td className="right">
                    <button style={iconBtn} onClick={() => addAdjustment(item.fund)}>
                      ＋ Ajuste
                    </button>
                  </td>
                </tr>
              ))}
              <tr style={{ borderTop: '2px solid var(--border-strong)', background: 'var(--surface-raised)' }}>
                <td style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 12 }}>Total</td>
                <td className="right bold">{fmtE(totSubscrito)}</td>
                <td className="right bold">{
                  data.reduce((sum, item) => sum + item.adjTotal, 0) === 0
                    ? '—'
                    : fmtE(data.reduce((sum, item) => sum + item.adjTotal, 0))
                }</td>
                <td className="right bold">{fmtE(totInvested)}</td>
                <td className="right mono">{totSubscrito > 0 ? `${((totInvested / totSubscrito) * 100).toFixed(1)}%` : '—'}</td>
                <td
                  className="right bold"
                  style={{ color: totDisponivel >= 0 ? 'var(--jade-500)' : 'var(--crimson-500)' }}
                >
                  {fmtE(totDisponivel)}
                </td>
                <td className="right bold">{fmtE(totNAV)}</td>
                <td className="right bold">{fmtE(totRealised)}</td>
                <td className="right bold">{totInvested > 0 ? `${(totNAV / totInvested).toFixed(2)}x` : '—'}</td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="card-header" style={{ marginTop: 0 }}>
          <span className="card-title">Ajustes de Capital</span>
        </div>
        {allAdjustments.length === 0 ? (
          <div className="empty-state" style={{ padding: 24 }}>
            Sem ajustes registados. Usa “＋ Ajuste” no fundo correspondente para adicionar.
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Fundo</th>
                  <th>Data</th>
                  <th>Descrição</th>
                  <th>Tipo</th>
                  <th className="right">Montante</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {allAdjustments.map((adjustment) => (
                  <tr key={`${adjustment.fund}-${adjustment.id}`}>
                    <td>
                      <span className="fund-badge" style={getFundBadgeStyle(adjustment.fund)}>
                        {adjustment.fund}
                      </span>
                    </td>
                    <td>
                      <input
                        type="date"
                        value={adjustment.date}
                        onChange={(event) => updateAdjustment(adjustment.fund, adjustment.id, { date: event.target.value })}
                        style={{ ...inlineInput, width: 130 }}
                      />
                    </td>
                    <td>
                      <input
                        value={adjustment.description ?? ''}
                        onChange={(event) =>
                          updateAdjustment(adjustment.fund, adjustment.id, {
                            description: event.target.value || undefined,
                          })
                        }
                        style={{ ...inlineInput, width: '100%', minWidth: 220, fontFamily: 'var(--font-body)' }}
                      />
                    </td>
                    <td>
                      <input
                        value={adjustment.type ?? ''}
                        onChange={(event) =>
                          updateAdjustment(adjustment.fund, adjustment.id, {
                            type: event.target.value || undefined,
                          })
                        }
                        style={{ ...inlineInput, width: 140, fontFamily: 'var(--font-body)' }}
                      />
                    </td>
                    <td className="right">
                      <input
                        type="number"
                        value={adjustment.amount}
                        onChange={(event) =>
                          updateAdjustment(adjustment.fund, adjustment.id, {
                            amount: event.target.value === '' ? 0 : Number(event.target.value),
                          })
                        }
                        style={{ ...inlineInput, width: 130, textAlign: 'right' }}
                      />
                    </td>
                    <td className="right">
                      <button
                        style={{ ...iconBtn, color: 'var(--crimson-400)' }}
                        onClick={() => removeAdjustment(adjustment.fund, adjustment.id)}
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card" style={{ marginTop: 20, padding: 20 }}>
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: 'var(--text-muted)',
            marginBottom: 20,
          }}
        >
          Evolução da Caixa por Fundo
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
          {data.map((item) => {
            const badgeStyle = getFundBadgeStyle(item.fund)
            const navPct = item.subscrito > 0 ? Math.min((item.nav / item.subscrito) * 100, 200) : 0
            const invPct = item.subscrito > 0 ? Math.min((item.invested / item.subscrito) * 100, 100) : 0
            const dispPct = item.subscrito > 0 ? Math.min((item.disponivel / item.subscrito) * 100, 100) : 0
            const rentTotal = item.invested > 0 ? fmtP((item.nav / item.invested - 1) * 100, 1) : '—'

            return (
              <div key={item.fund} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span className="fund-badge" style={badgeStyle}>{item.fund}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>
                    {rentTotal}
                  </span>
                </div>
                <div
                  style={{
                    height: 28,
                    background: 'var(--border)',
                    borderRadius: 6,
                    overflow: 'hidden',
                    position: 'relative',
                    display: 'flex',
                  }}
                >
                  <div
                    style={{ width: `${invPct}%`, background: badgeStyle.color, opacity: 0.7, transition: 'width 0.4s' }}
                    title={`Investido: ${fmtE(item.invested)}`}
                  />
                  <div
                    style={{ width: `${Math.max(dispPct, 0)}%`, background: 'var(--jade-500)', opacity: 0.3 }}
                    title={`Disponível: ${fmtE(item.disponivel)}`}
                  />
                </div>
                <div style={{ height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                  <div
                    style={{ width: `${navPct}%`, height: '100%', background: badgeStyle.color, borderRadius: 3 }}
                    title={`NAV: ${fmtE(item.nav)}`}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-muted)' }}>
                  <span>NAV {fmtE(item.nav)}</span>
                  <span>Disp. {fmtE(item.disponivel)}</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <div className="card-header" style={{ alignItems: 'center' }}>
          <span className="card-title">Exposição por Participada</span>
          <select
            className="filter-select"
            value={detailFund}
            onChange={(e) => setDetailFund(e.target.value as Fund)}
          >
            {FUNDS.map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Empresa</th>
                <th className="right">Custo Equity</th>
                <th className="right">NAV Equity</th>
                <th className="right">+/− Valor</th>
                <th className="right">SAFE</th>
                <th className="right">CLN</th>
                <th className="right">Prest. Sup.</th>
                <th className="right">Mútuo</th>
                <th className="right">NAV Total</th>
              </tr>
            </thead>
            <tbody>
              {detailRows.length === 0 && (
                <tr>
                  <td colSpan={9} className="empty-state">Sem exposição para {detailFund}</td>
                </tr>
              )}
              {detailRows.map(({ company, eqCost, equityNav, unrealized, safe, cln, prest, mutuo, nav }) => (
                <tr key={company.id}>
                  <td style={{ fontWeight: 600 }}>{company.name}</td>
                  <td className="right mono">{eqCost > 0 ? fmtE(eqCost) : <span style={{ color: 'var(--text-disabled)' }}>—</span>}</td>
                  <td className="right mono">{eqCost > 0 ? fmtE(equityNav) : <span style={{ color: 'var(--text-disabled)' }}>—</span>}</td>
                  <td className="right mono">
                    {unrealized != null && eqCost > 0 ? (
                      <span style={{ color: unrealized >= 0 ? 'var(--jade-500)' : 'var(--crimson-500)' }}>
                        {fmtP((unrealized / eqCost) * 100)}&nbsp;
                        <span style={{ fontSize: 11, opacity: 0.8 }}>({unrealized >= 0 ? '+' : ''}{fmtE(unrealized)})</span>
                      </span>
                    ) : <span style={{ color: 'var(--text-disabled)' }}>—</span>}
                  </td>
                  <td className="right mono">{safe > 0 ? fmtE(safe) : <span style={{ color: 'var(--text-disabled)' }}>—</span>}</td>
                  <td className="right mono">{cln > 0 ? fmtE(cln) : <span style={{ color: 'var(--text-disabled)' }}>—</span>}</td>
                  <td className="right mono">{prest > 0 ? fmtE(prest) : <span style={{ color: 'var(--text-disabled)' }}>—</span>}</td>
                  <td className="right mono">{mutuo > 0 ? fmtE(mutuo) : <span style={{ color: 'var(--text-disabled)' }}>—</span>}</td>
                  <td className="right bold">{fmtE(nav)}</td>
                </tr>
              ))}
              {detailRows.length > 0 && (() => {
                const totEqCost = detailRows.reduce((s, r) => s + r.eqCost, 0)
                const totEqNav = detailRows.reduce((s, r) => s + r.equityNav, 0)
                const totSafe = detailRows.reduce((s, r) => s + r.safe, 0)
                const totCln = detailRows.reduce((s, r) => s + r.cln, 0)
                const totPrest = detailRows.reduce((s, r) => s + r.prest, 0)
                const totMutuo = detailRows.reduce((s, r) => s + r.mutuo, 0)
                const totNav = detailRows.reduce((s, r) => s + r.nav, 0)
                const totUnrealized = totEqNav - totEqCost
                return (
                  <tr style={{ borderTop: '2px solid var(--border-strong)', background: 'var(--surface-raised)' }}>
                    <td style={{ fontWeight: 700, fontSize: 12 }}>Total {detailFund}</td>
                    <td className="right bold">{fmtE(totEqCost)}</td>
                    <td className="right bold">{fmtE(totEqNav)}</td>
                    <td className="right bold">
                      <span style={{ color: totUnrealized >= 0 ? 'var(--jade-500)' : 'var(--crimson-500)' }}>
                        {totEqCost > 0 ? fmtP((totUnrealized / totEqCost) * 100) : '—'}
                      </span>
                    </td>
                    <td className="right bold">{totSafe > 0 ? fmtE(totSafe) : '—'}</td>
                    <td className="right bold">{totCln > 0 ? fmtE(totCln) : '—'}</td>
                    <td className="right bold">{totPrest > 0 ? fmtE(totPrest) : '—'}</td>
                    <td className="right bold">{totMutuo > 0 ? fmtE(totMutuo) : '—'}</td>
                    <td className="right bold">{fmtE(totNav)}</td>
                  </tr>
                )
              })()}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
