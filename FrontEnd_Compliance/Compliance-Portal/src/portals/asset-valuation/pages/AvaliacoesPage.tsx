import { useState, useMemo } from 'react'
import { useDatabase } from '../hooks/useDatabase'
import { latestVal, computeNAV, computeOwnership, fundSharesAt, fmtE, fmtPAbs, semOf, getFundBadgeStyle } from '../lib/helpers'
import { FUNDS } from '../types/database'
import type { Company, Valuation, BPAssumptions } from '../types/database'

interface Props {
  onNavigate: (page: string, options?: { companyId?: string; tab?: string }) => void
}

export function AvaliacoesPage({ onNavigate }: Props) {
  const { db, loading, error } = useDatabase()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const companies = useMemo(() => {
    if (!db) return []
    return db.companies
      .filter(c => db.valuations.some(v => v.companyId === c.id))
      .filter(c => !search || c.name.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
  }, [db, search])

  const selected = useMemo(() => {
    if (!db || !selectedId) return null
    return db.companies.find(c => c.id === selectedId) ?? null
  }, [db, selectedId])

  const history = useMemo(() => {
    if (!db || !selectedId) return []
    return db.valuations
      .filter(v => v.companyId === selectedId)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }, [db, selectedId])

  if (loading) return <div className="page-shell"><p style={{ color: 'var(--text-muted)' }}>A carregar...</p></div>
  if (error) return <div className="page-shell"><p style={{ color: 'var(--crimson-400)' }}>Erro: {error}</p></div>
  if (!db) return null

  return (
    <div className="page-shell">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Avaliações</h1>
          <p className="page-subtitle">Histórico de valuations por participada</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 16, alignItems: 'start' }}>
        {/* ── COMPANY LIST ── */}
        <div className="card" style={{ position: 'sticky', top: 20 }}>
          <div className="card-header">
            <span className="card-title">Participadas</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>{companies.length}</span>
          </div>
          <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)' }}>
            <input
              style={{
                width: '100%', height: 30, border: '1px solid var(--border)',
                borderRadius: 6, background: 'var(--surface-raised)', padding: '0 10px',
                fontSize: 12, color: 'var(--text-primary)', outline: 'none',
              }}
              placeholder="Pesquisar..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div style={{ maxHeight: 'calc(100vh - 260px)', overflowY: 'auto' }}>
            {companies.map(c => {
              const lv = latestVal(c.id, db.valuations)
              const isActive = c.id === selectedId
              return (
                <button key={c.id} onClick={() => setSelectedId(c.id)} style={{
                  display: 'block', width: '100%', textAlign: 'left',
                  padding: '9px 14px', border: 0, cursor: 'pointer',
                  borderBottom: '1px solid var(--border)',
                  background: isActive ? 'var(--gold-100)' : 'none',
                  transition: 'background 120ms',
                }}>
                  <div style={{ fontSize: 13, fontWeight: isActive ? 600 : 500, color: isActive ? 'var(--gold-500)' : 'var(--text-primary)' }}>
                    {c.name}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                      {db.valuations.filter(v => v.companyId === c.id).length} aval.
                    </span>
                    {lv && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}>{fmtE(lv.equityValue)}</span>}
                  </div>
                </button>
              )
            })}
            {companies.length === 0 && <div className="empty-state" style={{ padding: 24 }}>Sem resultados</div>}
          </div>
        </div>

        {/* ── HISTORY PANEL ── */}
        {!selected
          ? <div className="card" style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>Seleciona uma empresa</div>
          : <ValuationHistory
              key={selectedId}
              company={selected}
              history={history}
              onEdit={() => onNavigate('configuracoes', { companyId: selected.id, tab: 'avaliacoes' })}
            />
        }
      </div>
    </div>
  )
}

function ValuationHistory({ company, history, onEdit }: { company: Company; history: Valuation[]; onEdit: () => void }) {
  const [openDebt, setOpenDebt] = useState<Set<string>>(new Set())
  const toggleDebt = (id: string) => setOpenDebt(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })

  const esop = +(company.esop || 0)
  const otherDil = +(company.otherDilutive || 0)
  const seriesB = +(company.seriesBShares || 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ marginBottom: 4, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 400, color: 'var(--text-primary)' }}>
            {company.name}
          </h2>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
            {[`${history.length} avaliações`, company.sector, company.country].filter(Boolean).join(' · ')}
          </div>
        </div>
        <button
          onClick={onEdit}
          style={{
            fontSize: 12, fontWeight: 600, padding: '6px 14px', borderRadius: 6,
            border: '1px solid var(--border-strong)', background: 'var(--surface)',
            color: 'var(--text-secondary)', cursor: 'pointer', whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          ✎ Editar
        </button>
      </div>

      {history.length === 0 && (
        <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Sem avaliações</div>
      )}

      {/* ── BP ASSUMPTIONS COMPARISON TABLE ── */}
      {(() => {
        const withBP = history.filter(v => v.bpAssumptions && Object.keys(v.bpAssumptions).some(k => k !== 'notes' && v.bpAssumptions![k as keyof BPAssumptions] != null))
        if (withBP.length < 1) return null
        const cols = [...withBP].reverse()
        const allRows: { label: string; key: keyof BPAssumptions; fmt: (v: number) => string }[] = [
          { label: 'Revenue CAGR',       key: 'revenueCagr',    fmt: (v: number) => v.toFixed(1) + '%' },
          { label: 'EBITDA Margin TY',   key: 'ebitdaMarginTY', fmt: (v: number) => v.toFixed(1) + '%' },
          { label: 'EBIT Margin TY',     key: 'ebitMarginTY',   fmt: (v: number) => v.toFixed(1) + '%' },
          { label: 'CAPEX / Revenue TY', key: 'capexRevenueTY', fmt: (v: number) => v.toFixed(1) + '%' },
          { label: 'NWC / Revenue TY',   key: 'nwcRevenueTY',   fmt: (v: number) => v.toFixed(1) + '%' },
          { label: 'Anos explícitos',    key: 'explicitYears',  fmt: (v: number) => v.toString() },
        ]
        const rows = allRows.filter(r => cols.some(v => v.bpAssumptions?.[r.key] != null))
        if (rows.length === 0) return null

        return (
          <div className="card" style={{ marginBottom: 4 }}>
            <div className="card-header">
              <span className="card-title">Evolução dos Pressupostos BP</span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{cols.length} BP{cols.length > 1 ? 's' : ''}</span>
            </div>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Métrica</th>
                    {cols.map(v => (
                      <th key={v.id} className="right" style={{ whiteSpace: 'nowrap' }}>
                        {semOf(v.date)}
                        <div style={{ fontSize: 10, fontWeight: 400, color: 'var(--text-disabled)' }}>{v.date}</div>
                      </th>
                    ))}
                    {cols.length > 1 && <th className="right">Δ acumulado</th>}
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ label, key, fmt }) => {
                    const vals = cols.map(v => v.bpAssumptions?.[key] as number | undefined)
                    const first = vals.find(v => v != null)
                    const last = [...vals].reverse().find(v => v != null)
                    const delta = first != null && last != null && first !== last ? last - first : null
                    const deltaColor = delta == null ? undefined
                      : key === 'capexRevenueTY' || key === 'nwcRevenueTY'
                        ? (delta > 0 ? 'var(--crimson-500)' : 'var(--jade-500)')
                        : (delta < 0 ? 'var(--crimson-500)' : 'var(--jade-500)')
                    return (
                      <tr key={key}>
                        <td style={{ fontWeight: 500 }}>{label}</td>
                        {vals.map((val, i) => (
                          <td key={i} className="right mono">
                            {val != null ? fmt(val) : <span style={{ color: 'var(--text-disabled)' }}>—</span>}
                          </td>
                        ))}
                        {cols.length > 1 && (
                          <td className="right mono">
                            {delta != null ? (
                              <span style={{ fontWeight: 700, color: deltaColor }}>
                                {delta > 0 ? '+' : ''}{fmt(delta)}
                              </span>
                            ) : <span style={{ color: 'var(--text-disabled)' }}>—</span>}
                          </td>
                        )}
                      </tr>
                    )
                  })}
                  {cols.some(v => v.bpAssumptions?.notes) && (
                    <tr>
                      <td style={{ fontWeight: 500, color: 'var(--text-muted)' }}>Notas</td>
                      {cols.map(v => (
                        <td key={v.id} style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                          {v.bpAssumptions?.notes ?? '—'}
                        </td>
                      ))}
                      {cols.length > 1 && <td />}
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )
      })()}

      {history.map((v, i) => {
        const prev = history[i + 1]
        const changePct = prev ? ((v.equityValue - prev.equityValue) / prev.equityValue) * 100 : null

        const totalSharesAtDate = (() => {
          const d = new Date(v.date + 'T23:59:59')
          const events = (company.tranches || [])
            .filter(t => t.totalSharesAtEvent && t.date && new Date(t.date) <= d &&
              (t.type === 'Equity' || t.type === 'Evento Cap Table' || t.fromConversion))
            .sort((a, b) => new Date(b.date!).getTime() - new Date(a.date!).getTime())
          return events.length ? +(events[0].totalSharesAtEvent!) : +(company.totalShares || 0)
        })()

        const dil = totalSharesAtDate + esop + otherDil + seriesB
        const pricePerShare = dil > 0 ? v.equityValue / dil : null

        const quasiDeduction = (v.debtAssessment || []).reduce((s, item) => {
          const isQuasi = item.instrumentType
            ? (item.instrumentType === 'SAFE' || item.instrumentType === 'Prest. Suplementares')
            : (() => { const t = (company.tranches || []).find(x => x.id === item.id); return !!t && (t.type === 'SAFE' || t.type === 'Prest. Suplementares') })()
          return s + (isQuasi ? (+(item.fairValue || 0)) : 0)
        }, 0)
        const adjustedEquity = v.equityValue - quasiDeduction
        const adjustedPricePerShare = dil > 0 && quasiDeduction > 0 ? adjustedEquity / dil : null

        const fundRows = FUNDS.map(fund => {
          const nav = computeNAV(company, fund, v.equityValue, dil)
          const own = computeOwnership(company, fund, dil, v.date)
          const shares = fundSharesAt(company, fund, v.date)
          if (!nav || nav <= 0) return null
          return { fund, nav, own, shares }
        }).filter(Boolean) as { fund: string; nav: number; own: number; shares: number }[]

        const totalNAV = fundRows.reduce((s, r) => s + r.nav, 0)
        const hasDebt = v.debtAssessment && v.debtAssessment.length > 0

        return (
          <div key={v.id} className="card">
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '11px 18px', borderBottom: '1px solid var(--border)',
              background: 'var(--surface-raised)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
                  {semOf(v.date)}
                </span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>· {v.date}</span>
                {v.method && (
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 4, border: '1px solid', ...methodStyle(v.method) }}>
                    {v.method}
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {changePct != null && (
                  <span style={{
                    fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700,
                    padding: '2px 9px', borderRadius: 20,
                    background: changePct >= 0 ? 'rgba(22,163,74,0.1)' : 'rgba(220,38,38,0.1)',
                    color: changePct >= 0 ? 'var(--jade-500)' : 'var(--crimson-500)',
                  }}>
                    {changePct > 0 ? '+' : ''}{changePct.toFixed(2)}%
                  </span>
                )}
                {i === 0 && (
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: 'var(--gold-100)', color: 'var(--gold-500)' }}>
                    Atual
                  </span>
                )}
              </div>
            </div>

            <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 20, alignItems: 'start' }}>
                <div>
                  {quasiDeduction > 0 ? (
                    <>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 28, fontWeight: 500, color: 'var(--text-primary)', letterSpacing: '-0.03em', lineHeight: 1 }}>
                        {fmtE(adjustedEquity)}
                      </div>
                      <div style={{ marginTop: 5, display: 'flex', gap: 12, fontSize: 11, color: 'var(--text-muted)', flexWrap: 'wrap', alignItems: 'center' }}>
                        <span style={{ fontSize: 10, fontStyle: 'italic' }}>equity adj. p/ ordinários</span>
                        {dil > 0 && <span>{dil.toLocaleString('pt-PT')} ações dil.</span>}
                        {adjustedPricePerShare != null && (
                          <span style={{ fontFamily: 'var(--font-mono)' }}>€{adjustedPricePerShare.toFixed(2)}/ação</span>
                        )}
                      </div>
                      <div style={{ marginTop: 7, display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-disabled)' }}>{fmtE(v.equityValue)}</span>
                        <span style={{ fontSize: 10, color: 'var(--text-disabled)' }}>equity bruto</span>
                        <span style={{ fontSize: 10, color: 'var(--text-disabled)' }}>− {fmtE(quasiDeduction)} SAFE/Prest.</span>
                        {pricePerShare != null && (
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-disabled)' }}>€{pricePerShare.toFixed(2)}/ação</span>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 28, fontWeight: 500, color: 'var(--text-primary)', letterSpacing: '-0.03em', lineHeight: 1 }}>
                        {fmtE(v.equityValue)}
                      </div>
                      <div style={{ marginTop: 6, display: 'flex', gap: 14, fontSize: 11, color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                        {dil > 0 && <span>{dil.toLocaleString('pt-PT')} ações dil.</span>}
                        {pricePerShare != null && (
                          <span style={{ fontFamily: 'var(--font-mono)' }}>€{pricePerShare.toFixed(2)}/ação</span>
                        )}
                      </div>
                    </>
                  )}
                </div>
                {(v.wacc != null || v.beta != null || v.ke != null || v.kd != null) && (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    {v.wacc != null && <Param label="WACC" value={v.wacc.toFixed(2) + '%'} />}
                    {v.beta != null && <Param label="β" value={v.beta.toFixed(2)} />}
                    {v.ke != null && <Param label="Ke" value={v.ke.toFixed(2) + '%'} />}
                    {v.kd != null && <Param label="Kd" value={v.kd.toFixed(2) + '%'} />}
                  </div>
                )}
              </div>

              {fundRows.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  {fundRows.map(({ fund, nav, own, shares }) => {
                    const bs = getFundBadgeStyle(fund)
                    return (
                      <div key={fund} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span className="fund-badge" style={{ ...bs, minWidth: 70, textAlign: 'center' }}>{fund}</span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)', minWidth: 52 }}>
                          {fmtPAbs(own, 2)}
                        </span>
                        {shares > 0 && (
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-disabled)', minWidth: 90 }}>
                            {shares.toLocaleString('pt-PT')} ações
                          </span>
                        )}
                        <div style={{ flex: 1, height: 3, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
                          <div style={{ width: `${totalNAV > 0 ? (nav / totalNAV) * 100 : 0}%`, height: '100%', background: bs.color, opacity: 0.6 }} />
                        </div>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-secondary)', minWidth: 100, textAlign: 'right' }}>
                          {fmtE(nav)}
                        </span>
                      </div>
                    )
                  })}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 6, borderTop: '1px solid var(--border)', marginTop: 2, gap: 10 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>Total NAV Equity</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{fmtE(totalNAV)}</span>
                  </div>
                </div>
              )}

              {hasDebt && (
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                  <button
                    onClick={() => toggleDebt(v.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                      background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                      marginBottom: openDebt.has(v.id) ? 8 : 0,
                    }}
                  >
                    <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                      Avaliação de Dívida
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>({v.debtAssessment!.length})</span>
                    <span style={{
                      marginLeft: 'auto', fontSize: 11, color: 'var(--text-muted)',
                      transform: openDebt.has(v.id) ? 'rotate(180deg)' : 'none',
                      transition: 'transform 180ms', display: 'inline-block', lineHeight: 1,
                    }}>▾</span>
                  </button>
                  {openDebt.has(v.id) && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {v.debtAssessment!.map(item => {
                        const diff = item.fairValue - item.nominalValue
                        const diffPct = item.nominalValue > 0 ? (diff / item.nominalValue) * 100 : null
                        const aboveKd = item.rate != null && item.kd != null ? item.rate > item.kd : null
                        return (
                          <div key={item.id} style={{
                            display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
                            padding: '7px 10px', borderRadius: 6, background: 'var(--surface-raised)', fontSize: 12,
                          }}>
                            <span style={{ fontWeight: 600, color: 'var(--text-primary)', minWidth: 140 }}>{item.label}</span>
                            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', minWidth: 100 }}>Nominal: {fmtE(item.nominalValue)}</span>
                            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-primary)', minWidth: 100 }}>FV: {fmtE(item.fairValue)}</span>
                            {diffPct != null && (
                              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600, color: diff >= 0 ? 'var(--jade-500)' : 'var(--crimson-500)' }}>
                                {diff >= 0 ? '+' : ''}{diffPct.toFixed(2)}%
                              </span>
                            )}
                            {item.rate != null && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Taxa: <span style={{ fontFamily: 'var(--font-mono)' }}>{item.rate.toFixed(2)}%</span></span>}
                            {item.kd != null && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Kd: <span style={{ fontFamily: 'var(--font-mono)' }}>{item.kd.toFixed(2)}%</span></span>}
                            {aboveKd != null && (
                              <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 4, background: aboveKd ? 'rgba(22,163,74,0.1)' : 'rgba(220,38,38,0.1)', color: aboveKd ? 'var(--jade-500)' : 'var(--crimson-500)' }}>
                                {aboveKd ? 'taxa > Kd' : 'taxa < Kd'}
                              </span>
                            )}
                            {item.notes && <span style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>{item.notes}</span>}
                          </div>
                        )
                      })}
                      <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 4, gap: 10 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>Total NAV Dívida</span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>
                          {fmtE(v.debtAssessment!.reduce((s, d) => s + d.fairValue, 0))}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {(v.notes || v.bpPath) && (
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {v.notes && (
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                      <span style={{ fontWeight: 600, color: 'var(--text-muted)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Notas</span>
                      <p style={{ margin: '3px 0 0' }}>{v.notes}</p>
                    </div>
                  )}
                  {v.bpPath && (
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontWeight: 600, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>BP</span>
                      <code style={{ fontFamily: 'var(--font-mono)', fontSize: 11, background: 'var(--surface-raised)', padding: '2px 6px', borderRadius: 4 }}>
                        {v.bpPath}
                      </code>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function methodStyle(method: string): React.CSSProperties {
  const map: Record<string, React.CSSProperties> = {
    'DCF':               { background: 'rgba(26,95,224,0.1)',  color: '#1a5fe0', borderColor: 'rgba(26,95,224,0.2)' },
    'TMR':               { background: 'rgba(109,40,217,0.1)', color: '#6d28d9', borderColor: 'rgba(109,40,217,0.2)' },
    'Custo de Aquisição':{ background: 'rgba(107,114,128,0.1)',color: '#4b5563', borderColor: 'rgba(107,114,128,0.2)' },
    'Múltiplos':         { background: 'rgba(22,163,74,0.1)',  color: '#15803d', borderColor: 'rgba(22,163,74,0.2)'  },
    'Outro':             { background: 'rgba(217,119,6,0.1)',  color: '#b45309', borderColor: 'rgba(217,119,6,0.2)'  },
  }
  return map[method] ?? { background: 'var(--surface-raised)', color: 'var(--text-muted)', borderColor: 'var(--border)' }
}

function Param({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '5px 10px', borderRadius: 6, background: 'var(--surface-raised)',
      border: '1px solid var(--border)', minWidth: 52,
    }}>
      <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{label}</span>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginTop: 2 }}>{value}</span>
    </div>
  )
}
