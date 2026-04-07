import { computedFundShares, fmtE, getFundBadgeStyle, latestVal } from '../lib/helpers'
import { FUNDS } from '../types/database'
import type { Company, Valuation, ShareholderType } from '../types/database'

interface Props {
  company: Company
  valuations: Valuation[]
  onClose: () => void
  onNavigate: (page: string, options?: { companyId?: string; tab?: string }) => void
}

export function CompanyPanel({ company, valuations, onClose, onNavigate }: Props) {
  const lv = latestVal(company.id, valuations)

  // ── Financials (sorted by year asc) ──
  const financials = [...(company.financials || [])].sort((a, b) => a.year - b.year)
  const last3 = financials.slice(-3)

  // ── Cap table ──
  // Internal: BIF fund shares
  const fundShares = computedFundShares(company)
  const totalShares = +(company.totalShares || 0)
  const esop = +(company.esop || 0)
  const other = +(company.otherDilutive || 0)
  const diluted = totalShares + esop + other

  // Build unified cap table rows
  type CapRow = { name: string; shares: number; pct: number; badge?: string; type: string }
  const capRows: CapRow[] = []

  // Funds
  for (const f of FUNDS) {
    const sh = +(fundShares[f] || 0)
    if (sh > 0) {
      capRows.push({ name: f, shares: sh, pct: diluted > 0 ? (sh / diluted) * 100 : 0, badge: f, type: 'Fund' })
    }
  }

  // External shareholders
  for (const s of company.capTable || []) {
    const sh = s.shares ?? 0
    const pct = s.pct != null ? s.pct : (diluted > 0 && sh > 0 ? (sh / diluted) * 100 : 0)
    capRows.push({ name: s.name, shares: sh, pct, type: s.type })
  }

  // ESOP / other dilutive
  if (esop > 0) capRows.push({ name: 'ESOP', shares: esop, pct: diluted > 0 ? (esop / diluted) * 100 : 0, type: 'Employee' })
  if (other > 0) capRows.push({ name: 'Outros dilutivos', shares: other, pct: diluted > 0 ? (other / diluted) * 100 : 0, type: 'Other' })

  capRows.sort((a, b) => b.pct - a.pct)

  // ── Runway ──
  const runway = company.runway
  const runwayMonths = runway?.cashBalance && runway?.monthlyBurn && runway.monthlyBurn > 0
    ? runway.cashBalance / runway.monthlyBurn
    : null
  const runwayDate = runwayMonths != null
    ? (() => {
        const d = runway?.lastUpdated ? new Date(runway.lastUpdated + 'T00:00:00') : new Date()
        d.setMonth(d.getMonth() + Math.round(runwayMonths))
        return d.toLocaleDateString('pt-PT', { month: 'short', year: 'numeric' })
      })()
    : null
  const runwayColor = runwayMonths == null ? 'var(--text-muted)'
    : runwayMonths > 18 ? 'var(--jade-500)'
    : runwayMonths > 12 ? 'var(--amber-400)'
    : 'var(--crimson-500)'

  // ── Revenue chart (SVG bars) ──
  const chartData = last3.filter(y => y.revenue != null || y.equity != null)
  const hasNegativeEquity = chartData.some(y => (y.equity ?? 0) < 0)
  const maxAbsVal = chartData.length > 0
    ? Math.max(...chartData.flatMap(y => [Math.abs(y.revenue ?? 0), Math.abs(y.equity ?? 0)]), 1)
    : 1
  // When negative equity exists, use center baseline; otherwise bottom baseline
  const SVG_H = 80
  const BAR_MAX = hasNegativeEquity ? 32 : 65
  const baseline = hasNegativeEquity ? 38 : SVG_H

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.25)',
          zIndex: 200, backdropFilter: 'blur(2px)',
        }}
      />

      {/* Panel */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: 560, background: 'var(--surface)', zIndex: 201,
        boxShadow: '-4px 0 32px rgba(0,0,0,0.12)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        {/* ── Header ── */}
        <div style={{
          padding: '18px 24px 14px', borderBottom: '1px solid var(--border)',
          background: 'var(--surface-raised)', flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <h2 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 400, color: 'var(--text-primary)' }}>
                {company.name}
              </h2>
              <div style={{ display: 'flex', gap: 10, marginTop: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                {[company.sector, company.country].filter(Boolean).map((v, i) => (
                  <span key={i} style={{ fontSize: 12, color: 'var(--text-muted)' }}>{v}</span>
                ))}
                {company.website && (
                  <a
                    href={company.website.startsWith('http') ? company.website : `https://${company.website}`}
                    target="_blank" rel="noopener noreferrer"
                    style={{ fontSize: 12, color: 'var(--azure-500)', textDecoration: 'none' }}
                    onClick={e => e.stopPropagation()}
                  >
                    🔗 {company.website.replace(/^https?:\/\//, '')}
                  </a>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              <button
                onClick={() => { onClose(); onNavigate('configuracoes', { companyId: company.id }) }}
                style={{
                  fontSize: 11, fontWeight: 600, padding: '4px 12px', borderRadius: 6,
                  border: '1px solid var(--border-strong)', background: 'var(--surface)',
                  color: 'var(--text-secondary)', cursor: 'pointer',
                }}
              >
                Editar
              </button>
              <button onClick={onClose} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 18, color: 'var(--text-muted)', lineHeight: 1, padding: '4px 6px',
              }}>✕</button>
            </div>
          </div>

          {/* Summary */}
          {company.summary && (
            <p style={{ margin: '10px 0 0', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.55 }}>
              {company.summary}
            </p>
          )}

          {/* Latest valuation badge */}
          {lv && (
            <div style={{ marginTop: 10, display: 'flex', gap: 14, fontSize: 12 }}>
              <span style={{ color: 'var(--text-muted)' }}>Equity Value:</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--text-primary)' }}>{fmtE(lv.equityValue)}</span>
              <span style={{ color: 'var(--text-disabled)' }}>{lv.date}</span>
            </div>
          )}
        </div>

        {/* ── Scrollable body ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 36 }}>

          {/* ── FINANCEIROS ── */}
          {financials.length > 0 && (
            <Section title="Financeiros">
              {/* SVG mini chart */}
              {chartData.length > 0 && maxAbsVal > 0 && (
                <div style={{ marginBottom: 24 }}>
                  <svg width="100%" height={SVG_H} style={{ overflow: 'visible' }}>
                    {/* Zero baseline when negative values exist */}
                    {hasNegativeEquity && (
                      <line x1="0" x2="100%" y1={baseline} y2={baseline}
                        stroke="var(--border-strong)" strokeWidth={1} strokeDasharray="3 3" />
                    )}
                    {chartData.map((y, i) => {
                      const slotW = 100 / chartData.length
                      const bw = 14
                      const gap = 4
                      const cx = (i + 0.5) * slotW
                      const revH = y.revenue ? (Math.abs(y.revenue) / maxAbsVal) * BAR_MAX : 0
                      const eqH = y.equity ? (Math.abs(y.equity) / maxAbsVal) * BAR_MAX : 0
                      const eqNeg = (y.equity ?? 0) < 0
                      return (
                        <g key={y.year}>
                          {y.revenue != null && (
                            <rect x={`${cx - bw - gap / 2}%`} y={baseline - revH} width={`${bw}%`} height={revH}
                              fill="var(--azure-400)" opacity={0.7} rx={2} />
                          )}
                          {y.equity != null && (
                            <rect
                              x={`${cx + gap / 2}%`}
                              y={eqNeg ? baseline : baseline - eqH}
                              width={`${bw}%`}
                              height={eqH}
                              fill={eqNeg ? 'var(--crimson-500)' : 'var(--jade-500)'}
                              opacity={0.6} rx={2}
                            />
                          )}
                          <text x={`${cx}%`} y={SVG_H + 12} textAnchor="middle" fontSize={10} fill="var(--text-muted)">{y.year}</text>
                        </g>
                      )
                    })}
                  </svg>
                  <div style={{ display: 'flex', gap: 16, fontSize: 10, color: 'var(--text-muted)', marginTop: 20, justifyContent: 'center' }}>
                    <span><span style={{ display: 'inline-block', width: 10, height: 8, background: 'var(--azure-400)', borderRadius: 2, marginRight: 4 }} />Vendas</span>
                    <span><span style={{ display: 'inline-block', width: 10, height: 8, background: 'var(--jade-500)', borderRadius: 2, marginRight: 4 }} />Cap. Próprio</span>
                  </div>
                </div>
              )}

              <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['Ano', 'Vendas', 'Cap. Próprio', 'Ativo Total', 'Passivo', 'Result. Líq.'].map(h => (
                      <th key={h} style={{ textAlign: h === 'Ano' ? 'left' : 'right', padding: '4px 8px', fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text-muted)', textTransform: 'uppercase', borderBottom: '1px solid var(--border)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {financials.map(y => (
                    <tr key={y.year}>
                      <td style={{ padding: '6px 8px', fontWeight: 600, color: 'var(--text-secondary)' }}>{y.year}</td>
                      <Num val={y.revenue} />
                      <Num val={y.equity} colored />
                      <Num val={y.totalAssets} />
                      <Num val={y.totalLiabilities} />
                      <Num val={y.netProfit} colored />
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>
          )}

          {/* ── RUNWAY ── */}
          {runway && (runway.cashBalance != null || runway.monthlyBurn != null) && (
            <Section title="Runway Estimado">
              <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginBottom: runwayMonths != null ? 12 : 0 }}>
                {runway.cashBalance != null && (
                  <KV label="Cash" value={fmtE(runway.cashBalance)} />
                )}
                {runway.monthlyBurn != null && (
                  <KV label="Burn/mês" value={fmtE(runway.monthlyBurn)} />
                )}
                {runway.lastUpdated && (
                  <KV label="Referência" value={runway.lastUpdated} />
                )}
              </div>
              {runwayMonths != null && (
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, padding: '10px 14px', background: 'var(--surface-raised)', borderRadius: 8, border: '1px solid var(--border)' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 28, fontWeight: 600, color: runwayColor }}>
                    {Math.round(runwayMonths)}
                  </span>
                  <span style={{ fontSize: 14, color: runwayColor, fontWeight: 600 }}>meses</span>
                  {runwayDate && (
                    <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 8 }}>até {runwayDate}</span>
                  )}
                </div>
              )}
              {runway.notes && (
                <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>{runway.notes}</p>
              )}
            </Section>
          )}

          {/* ── CAP TABLE ── */}
          {(capRows.length > 0) && (() => {
            const totalPct = capRows.reduce((s, r) => s + r.pct, 0)
            const missing = 100 - totalPct
            const isIncomplete = missing > 0.5  // tolerance for rounding
            return (
            <Section title={`Cap Table · ${diluted > 0 ? diluted.toLocaleString('pt-PT') + ' ações dil.' : ''}`}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {capRows.map((row, i) => {
                  const bs = row.badge ? getFundBadgeStyle(row.badge) : shareholderStyle(row.type as ShareholderType)
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{
                        fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 4,
                        minWidth: 110, textAlign: 'center',
                        background: bs.background, color: bs.color, border: bs.border,
                      }}>{row.name}</span>
                      <div style={{ flex: 1, height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ width: `${Math.min(row.pct, 100)}%`, height: '100%', background: bs.color, opacity: 0.6, borderRadius: 3 }} />
                      </div>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', minWidth: 42, textAlign: 'right' }}>
                        {row.pct.toFixed(1)}%
                      </span>
                      {row.shares > 0 && (
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-disabled)', minWidth: 90, textAlign: 'right' }}>
                          {row.shares.toLocaleString('pt-PT')}
                        </span>
                      )}
                    </div>
                  )
                })}

                {/* Missing % warning row */}
                {isIncomplete && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{
                      fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 4,
                      minWidth: 110, textAlign: 'center',
                      background: 'rgba(217,119,6,0.08)', color: 'var(--amber-400)',
                      border: '1px dashed var(--amber-400)',
                    }}>⚠ Em falta</span>
                    <div style={{ flex: 1, height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ width: `${Math.min(missing, 100)}%`, height: '100%', background: 'var(--amber-400)', opacity: 0.3, borderRadius: 3 }} />
                    </div>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: 'var(--amber-400)', minWidth: 42, textAlign: 'right' }}>
                      {missing.toFixed(1)}%
                    </span>
                  </div>
                )}

                {/* Total row */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 6, borderTop: '1px solid var(--border)', gap: 8 }}>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Total</span>
                  <span style={{
                    fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700,
                    color: isIncomplete ? 'var(--amber-400)' : 'var(--jade-500)',
                  }}>
                    {totalPct.toFixed(1)}%
                  </span>
                </div>
              </div>
              {(company.capTable || []).some(s => s.notes || s.round) && (
                <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {(company.capTable || []).filter(s => s.notes || s.round).map(s => (
                    <div key={s.id} style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      <span style={{ fontWeight: 600 }}>{s.name}</span>
                      {s.round && <span style={{ marginLeft: 6, fontStyle: 'italic' }}>{s.round}</span>}
                      {s.notes && <span style={{ marginLeft: 6 }}>— {s.notes}</span>}
                    </div>
                  ))}
                </div>
              )}
            </Section>
            )
          })()}

          {/* Empty state */}
          {financials.length === 0 && !runway && capRows.length === 0 && (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>📋</div>
              Sem dados adicionais. Edita a empresa para adicionar financeiros, runway e cap table.
              <div style={{ marginTop: 14 }}>
                <button
                  onClick={() => { onClose(); onNavigate('configuracoes', { companyId: company.id }) }}
                  style={{ fontSize: 12, fontWeight: 600, padding: '6px 16px', borderRadius: 6, border: '1px solid var(--border-strong)', background: 'var(--surface-raised)', color: 'var(--text-secondary)', cursor: 'pointer' }}
                >
                  Abrir Configurações
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

// ── Helper sub-components ──

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 12 }}>
        {title}
      </div>
      {children}
    </div>
  )
}

function KV({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>{label}</span>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{value}</span>
    </div>
  )
}

function Num({ val, colored }: { val: number | undefined; colored?: boolean }) {
  if (val == null) return <td style={{ padding: '6px 8px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-disabled)' }}>—</td>
  const color = colored ? (val >= 0 ? 'var(--jade-500)' : 'var(--crimson-500)') : 'var(--text-secondary)'
  return (
    <td style={{ padding: '6px 8px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 12, color }}>
      {fmtE(val)}
    </td>
  )
}

function shareholderStyle(type: ShareholderType) {
  const map: Record<ShareholderType, { background: string; color: string; border: string }> = {
    Founders:  { background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a' },
    VC:        { background: '#ede9fe', color: '#5b21b6', border: '1px solid #ddd6fe' },
    Employee:  { background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0' },
    Other:     { background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0' },
  }
  return map[type] ?? map.Other
}
