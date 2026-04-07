import { useState, useMemo } from 'react'
import { useDatabase } from '../hooks/useDatabase'
import { metrics, hasActiveExposure, fmtE, fmtP, getFundBadgeStyle, latestVal, nonEquityInstrumentValues } from '../lib/helpers'
import { FUNDS } from '../types/database'
import type { Fund } from '../types/database'

export function DashboardPage() {
  const { db, loading, error } = useDatabase()
  const [selectedFund, setSelectedFund] = useState<Fund | ''>('')
  const [expandedCompany, setExpandedCompany] = useState<string | null>(null)

  const data = useMemo(() => {
    if (!db) return null

    const fundFilter = selectedFund ? [selectedFund] : null
    const fundsToSum = selectedFund ? [selectedFund] : [...FUNDS]

    // ── Capital subscrito & adjustments ──
    const subscrito = fundsToSum.reduce((s, f) => s + (+(db.funds[f]?.subscrito || 0)), 0)
    const adjustments = fundsToSum.reduce((s, f) => {
      return s + (db.funds[f]?.adjustments || []).reduce((a, adj) => a + (+(adj.amount || 0)), 0)
    }, 0)

    // ── Per-company metrics ──
    const companies = db.companies.filter(c => hasActiveExposure(c, fundFilter))
    let totalInv = 0, totalEqInv = 0, totalNAV = 0, totalEquityNAV = 0, totalRealised = 0
    const navByCompany: { name: string; nav: number }[] = []

    for (const c of companies) {
      const m = metrics(c, db.valuations, fundFilter)
      totalInv += m.totInv
      totalEqInv += m.eqInv
      totalRealised += m.realised
      if (m.nav != null && m.nav > 0) {
        totalNAV += m.nav
        navByCompany.push({ name: c.name, nav: m.nav })
      }
      if (m.equityNav != null && m.equityNav > 0) {
        totalEquityNAV += m.equityNav
      }
    }

    // ── Capital disponível ──
    const chamado = totalInv
    const disponivel = subscrito + adjustments - chamado

    // ── Returns ──
    // Rent. Equity = (NAV equity only / custo equity) - 1  → comparável
    const rentEquity = totalEqInv > 0 ? ((totalEquityNAV / totalEqInv) - 1) * 100 : null
    // Rent. Total = (NAV total / total investido) - 1  → inclui tudo
    const rentTotal = totalInv > 0 ? ((totalNAV / totalInv) - 1) * 100 : null
    // MOIC
    const moic = totalInv > 0 ? totalNAV / totalInv : null

    // ── HHI ──
    let hhi = 0
    if (totalNAV > 0) {
      for (const { nav } of navByCompany) {
        const weight = nav / totalNAV        // 0–1
        hhi += weight * weight * 10000
      }
    }
    hhi = Math.round(hhi)

    // ── Top companies ──
    const top = [...navByCompany].sort((a, b) => b.nav - a.nav)
    const top3pct = top.slice(0, 3).reduce((s, c) => s + c.nav, 0) / (totalNAV || 1) * 100
    const top5pct = top.slice(0, 5).reduce((s, c) => s + c.nav, 0) / (totalNAV || 1) * 100

    return {
      subscrito, chamado, disponivel, adjustments,
      totalNAV, totalInv, totalEqInv, totalRealised,
      rentEquity, rentTotal, moic,
      nCompanies: companies.length,
      hhi, top3pct, top5pct,
      topCompanies: top,
      totalNAVforPct: totalNAV,
    }
  }, [db, selectedFund])

  if (loading) return <div className="page-shell"><p style={{ color: 'var(--text-muted)' }}>A carregar...</p></div>
  if (error) return <div className="page-shell"><p style={{ color: 'var(--crimson-400)' }}>Erro: {error}</p></div>
  if (!db || !data) return null

  const hhiLabel = data.hhi < 1500 ? 'Diversificado' : data.hhi < 2500 ? 'Moderado' : 'Concentrado'
  const hhiColor = data.hhi < 1500 ? 'var(--jade-500)' : data.hhi < 2500 ? 'var(--amber-400)' : 'var(--crimson-500)'

  return (
    <div className="page-shell">
      {/* ── HEADER ── */}
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Visão consolidada do portfólio</p>
        </div>
        <select
          className="filter-select"
          value={selectedFund}
          onChange={e => setSelectedFund(e.target.value as Fund | '')}
        >
          <option value="">Todos os fundos</option>
          {FUNDS.map(f => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>
      </div>

      {/* ── KPI ROW 1 — Capital ── */}
      <div style={{ marginBottom: 10, fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
        Capital
      </div>
      <div className="kpi-grid" style={{ marginBottom: 28 }}>
        <div className="kpi-card" data-tooltip="Capital total comprometido pelos LPs por fundo (editável em Capital)">
          <div className="kpi-label">Capital Subscrito</div>
          <div className="kpi-value">{fmtE(data.subscrito)}</div>
          <div className="kpi-sub">Comprometido pelos LPs</div>
        </div>
        <div className="kpi-card" data-tooltip={"Custo de aquisição total de todas as tranches activas:\nEquity + SAFE + CLN + Prest. Sup. + Mútuo\n(ao nominal, não ao valor actual)"}>
          <div className="kpi-label">Capital Investido</div>
          <div className="kpi-value">{fmtE(data.chamado)}</div>
          <div className="kpi-sub">
            {data.subscrito > 0
              ? `${((data.chamado / data.subscrito) * 100).toFixed(1)}% do subscrito`
              : '—'}
          </div>
        </div>
        <div className="kpi-card" data-tooltip="Subscrito + Ajustes − Investido">
          <div className="kpi-label">Capital Disponível</div>
          <div className="kpi-value" style={{ color: data.disponivel >= 0 ? 'var(--jade-500)' : 'var(--crimson-500)' }}>
            {fmtE(data.disponivel)}
          </div>
          <div className="kpi-sub">Dry powder</div>
        </div>
        <div className="kpi-card" data-tooltip="Empresas com pelo menos uma tranche activa (não convertida)">
          <div className="kpi-label">Nº Participadas</div>
          <div className="kpi-value">{data.nCompanies}</div>
          <div className="kpi-sub">Empresas em portfólio</div>
        </div>
      </div>

      {/* ── KPI ROW 2 — Performance ── */}
      <div style={{ marginBottom: 10, fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
        Performance
      </div>
      <div className="kpi-grid" style={{ marginBottom: 28 }}>
        <div className="kpi-card" data-tooltip={"Valor de mercado estimado da carteira:\nNAV Equity (EV × quota, pós dedução SAFE/Prest.)\n+ Instrumentos de dívida/quasi-equity\n  a fair value (ou nominal sem avaliação)"}>
          <div className="kpi-label">NAV Total</div>
          <div className="kpi-value">{fmtE(data.totalNAV)}</div>
          <div className="kpi-sub">Valor líquido do portfólio</div>
        </div>
        <div className="kpi-card" data-tooltip="NAV Total ÷ Capital Investido">
          <div className="kpi-label">MOIC</div>
          <div className="kpi-value">{data.moic != null ? data.moic.toFixed(2) + 'x' : '—'}</div>
          <div className="kpi-sub">NAV ÷ Capital Investido</div>
        </div>
        <div className="kpi-card" data-tooltip={"Rentabilidade das posições de equity:\nNAV Equity ÷ Custo Equity − 1\n(só equity vs equity, comparável)"}>

          <div className="kpi-label">Rent. Equity</div>
          <div className="kpi-value" style={{ color: data.rentEquity != null && data.rentEquity > 0 ? 'var(--jade-500)' : undefined }}>
            {data.rentEquity != null ? fmtP(data.rentEquity, 1) : '—'}
          </div>
          <div className="kpi-sub" style={{ fontSize: 10, color: 'var(--text-disabled)' }}>
            (NAV ÷ Eq. Inv.) − 1
          </div>
        </div>
        <div className="kpi-card" data-tooltip={"Rentabilidade sobre o investimento total:\n(NAV Total ÷ Total Investido) − 1\nInclui equity + dívida + quasi-equity"}>
          <div className="kpi-label">Rent. Total</div>
          <div className="kpi-value" style={{ color: data.rentTotal != null && data.rentTotal > 0 ? 'var(--jade-500)' : undefined }}>
            {data.rentTotal != null ? fmtP(data.rentTotal, 1) : '—'}
          </div>
          <div className="kpi-sub" style={{ fontSize: 10, color: 'var(--text-disabled)' }}>
            (NAV ÷ Total Inv.) − 1
          </div>
        </div>
      </div>

      {/* ── BOTTOM ROW ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16 }}>

        {/* Top participadas */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Participadas por NAV</span>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Empresa</th>
                <th className="right">NAV</th>
                <th className="right">% do Total</th>
                <th className="right">MOIC</th>
              </tr>
            </thead>
            <tbody>
              {data.topCompanies.length === 0 && (
                <tr><td colSpan={4} className="empty-state">Sem dados</td></tr>
              )}
              {data.topCompanies.map(({ name, nav }) => {
                const pct = data.totalNAVforPct > 0 ? (nav / data.totalNAVforPct) * 100 : 0
                const c = db.companies.find(co => co.name === name)
                const m = c ? metrics(c, db.valuations, selectedFund || null) : null
                const isOpen = expandedCompany === name

                // Tranche breakdown for expanded row
                const lv = c ? latestVal(c.id, db.valuations) : null
                const fundFilter = selectedFund || null
                const equityTranches = c
                  ? (c.tranches || []).filter(t => !t.converted && t.type === 'Equity' && (!fundFilter || t.fund === fundFilter))
                  : []
                const totalEqCost = equityTranches.reduce((s, t) => s + +(t.amount || 0), 0)
                const eqNAV = m?.equityNav ?? null
                const nonEquity = c ? nonEquityInstrumentValues(c, fundFilter, lv) : []
                const quasiTranches = nonEquity.filter(t => t.type === 'SAFE' || t.type === 'CLN' || t.type === 'Prest. Suplementares')
                const debtTranches = nonEquity.filter(t => t.type === 'Mútuo')

                return (
                  <>
                    <tr
                      key={name}
                      onClick={() => setExpandedCompany(isOpen ? null : name)}
                      style={{ cursor: 'pointer', background: isOpen ? 'var(--gold-100)' : undefined, transition: 'background 120ms' }}
                    >
                      <td className="primary" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 10, color: 'var(--text-muted)', transition: 'transform 120ms', display: 'inline-block', transform: isOpen ? 'rotate(90deg)' : 'none' }}>▶</span>
                        {name}
                      </td>
                      <td className="right bold">{fmtE(nav)}</td>
                      <td className="right mono">
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
                          <div style={{ width: 48, height: 4, borderRadius: 2, background: 'var(--border)', overflow: 'hidden' }}>
                            <div style={{ width: `${Math.min(pct, 100)}%`, height: '100%', background: 'var(--azure-400)', borderRadius: 2 }} />
                          </div>
                          {pct.toFixed(1)}%
                        </div>
                      </td>
                      <td className="right mono">{m?.moic != null ? m.moic.toFixed(2) + 'x' : '—'}</td>
                    </tr>
                    {isOpen && (
                      <tr key={`${name}-detail`}>
                        <td colSpan={4} style={{ padding: '0 0 4px 0', background: 'var(--surface-raised)' }}>
                          <div style={{ padding: '12px 16px 14px 32px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {equityTranches.length > 0 && (
                              <TrancheGroup
                                label="Equity"
                                color="var(--jade-500)"
                                rows={equityTranches.map(t => {
                                  const cost = +(t.amount || 0)
                                  const nav = eqNAV != null && totalEqCost > 0
                                    ? (cost / totalEqCost) * eqNAV
                                    : null
                                  return { fund: t.fund, label: t.date ?? '—', cost, nav }
                                })}
                              />
                            )}
                            {quasiTranches.length > 0 && (
                              <TrancheGroup
                                label="Quasi-Equity"
                                color="var(--amber-400)"
                                rows={quasiTranches.map(t => {
                                  const tranche = c?.tranches?.find(x => x.id === t.id)
                                  const dateStr = tranche?.date ?? ''
                                  return { fund: t.fund, label: dateStr ? `${dateStr} · ${t.type}` : t.type, cost: +(tranche?.amount || 0), nav: t.value }
                                })}
                              />
                            )}
                            {debtTranches.length > 0 && (
                              <TrancheGroup
                                label="Dívida"
                                color="var(--azure-400)"
                                rows={debtTranches.map(t => {
                                  const tranche = c?.tranches?.find(x => x.id === t.id)
                                  const dateStr = tranche?.date ?? ''
                                  return { fund: t.fund, label: dateStr ? `${dateStr} · ${t.type}` : t.type, cost: +(tranche?.amount || 0), nav: t.value }
                                })}
                              />
                            )}
                            {equityTranches.length === 0 && quasiTranches.length === 0 && debtTranches.length === 0 && (
                              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Sem tranches activas</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                )
              })}
              {data.topCompanies.length > 0 && (
                <tr style={{ borderTop: '2px solid var(--border-strong)', background: 'var(--surface-raised)' }}>
                  <td style={{ fontWeight: 700, fontSize: 12, color: 'var(--text-primary)' }}>Total</td>
                  <td className="right bold">{fmtE(data.totalNAV)}</td>
                  <td className="right mono" style={{ color: 'var(--text-muted)' }}>100%</td>
                  <td className="right mono">{data.moic != null ? data.moic.toFixed(2) + 'x' : '—'}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Concentração */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card" style={{ padding: 20 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 14 }}>
              Risco de Concentração
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 4 }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 32, fontWeight: 500, color: hhiColor, letterSpacing: '-0.02em' }}>
                {data.hhi.toLocaleString('pt-PT')}
              </span>
              <span style={{ fontSize: 12, fontWeight: 600, color: hhiColor }}>{hhiLabel}</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 16 }}>
              Índice HHI · máx 10 000
            </div>

            {/* HHI bar */}
            <div style={{ position: 'relative', height: 6, background: 'var(--border)', borderRadius: 3, marginBottom: 4 }}>
              <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${Math.min(data.hhi / 100, 100)}%`, borderRadius: 3, background: `linear-gradient(90deg, var(--jade-500), var(--amber-400), var(--crimson-500))` }} />
              <div style={{ position: 'absolute', top: -2, left: `${Math.min(data.hhi / 100, 100)}%`, width: 10, height: 10, borderRadius: '50%', background: hhiColor, border: '2px solid white', transform: 'translateX(-50%)' }} />
            </div>
            <div style={{ position: 'relative', height: 14, marginBottom: 12 }}>
              {([0, 1500, 2500, 10000] as const).map(v => (
                <span key={v} style={{
                  position: 'absolute', left: `${v / 100}%`, transform: 'translateX(-50%)',
                  fontSize: 9, color: 'var(--text-disabled)', whiteSpace: 'nowrap',
                }}>
                  {v === 0 ? '0' : v.toLocaleString('pt-PT')}
                </span>
              ))}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <ConcentrationRow label="Top 3" pct={data.top3pct} />
              <ConcentrationRow label="Top 5" pct={data.top5pct} />
            </div>

            <div style={{ marginTop: 14, fontSize: 10, color: 'var(--text-disabled)', lineHeight: 1.5 }}>
              HHI = Σ(peso NAV²) × 10 000<br />
              &lt;1 500 diversificado · 1 500–2 500 moderado · &gt;2 500 concentrado
            </div>
          </div>

          {/* Fundo breakdown */}
          {!selectedFund && (
            <div className="card" style={{ padding: 20 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 14 }}>
                NAV por Fundo
              </div>
              {FUNDS.map(f => {
                const fNAV = db.companies.reduce((s, c) => {
                  const m = metrics(c, db.valuations, [f])
                  return s + (m.nav ?? 0)
                }, 0)
                if (fNAV <= 0) return null
                const pct = data.totalNAV > 0 ? (fNAV / data.totalNAV) * 100 : 0
                const style = getFundBadgeStyle(f)
                return (
                  <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <span className="fund-badge" style={{ ...style, minWidth: 70, textAlign: 'center' }}>{f}</span>
                    <div style={{ flex: 1, height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: style.color, opacity: 0.7, borderRadius: 2 }} />
                    </div>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', minWidth: 36, textAlign: 'right' }}>
                      {pct.toFixed(1)}%
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function TrancheGroup({ label, color, rows }: {
  label: string
  color: string
  rows: { fund: string; label: string; cost: number; nav: number | null }[]
}) {
  const totalCost = rows.reduce((s, r) => s + r.cost, 0)
  const totalNav = rows.every(r => r.nav != null) ? rows.reduce((s, r) => s + (r.nav ?? 0), 0) : null
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
        <span style={{ width: 8, height: 8, borderRadius: 2, background: color, display: 'inline-block', flexShrink: 0 }} />
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{label}</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', marginLeft: 'auto' }}>
          Custo {fmtE(totalCost)}{totalNav != null ? ` · FV ${fmtE(totalNav)}` : ''}
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {rows.map((r, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
            <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 3, background: color + '22', color, fontWeight: 600, minWidth: 60, textAlign: 'center' }}>{r.fund}</span>
            <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>{r.label}</span>
            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', marginLeft: 'auto' }}>{fmtE(r.cost)}</span>
            {r.nav != null && (
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: r.nav >= r.cost ? 'var(--jade-500)' : 'var(--crimson-500)', minWidth: 90, textAlign: 'right' }}>
                → {fmtE(r.nav)}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function ConcentrationRow({ label, pct }: { label: string; pct: number }) {
  const color = pct > 80 ? 'var(--crimson-500)' : pct > 60 ? 'var(--amber-400)' : 'var(--jade-500)'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', minWidth: 36 }}>{label}</span>
      <div style={{ flex: 1, height: 5, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${Math.min(pct, 100)}%`, height: '100%', background: color, borderRadius: 3 }} />
      </div>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600, color, minWidth: 40, textAlign: 'right' }}>
        {pct.toFixed(1)}%
      </span>
    </div>
  )
}
