import { useState, useMemo, useEffect } from 'react'
import { useDatabase } from '../hooks/useDatabase'
import { metrics, hasActiveExposure, fmtE, getFundBadgeStyle, latestVal } from '../lib/helpers'
import { FUNDS } from '../types/database'
import type { Fund, Company, Valuation } from '../types/database'
import { CompanyPanel } from '../components/CompanyPanel'

interface Props {
  initialCompanyId?: string | null
  onNavigate: (page: string, options?: { companyId?: string; tab?: string }) => void
}

export function ParticipadasPage({ initialCompanyId, onNavigate }: Props) {
  const { db, loading, error } = useDatabase()
  const [selectedFund, setSelectedFund] = useState<Fund | ''>('')
  const [search, setSearch] = useState('')
  const [panelCompany, setPanelCompany] = useState<Company | null>(null)

  // Auto-open panel if navigated here with a companyId
  useEffect(() => {
    if (!db || !initialCompanyId) return
    const c = db.companies.find(c => c.id === initialCompanyId)
    if (c) setPanelCompany(c)
  }, [db, initialCompanyId])

  const companies = useMemo(() => {
    if (!db) return []
    return db.companies
      .filter(c => hasActiveExposure(c, selectedFund ? [selectedFund] : null))
      .filter(c => !search || c.name.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
  }, [db, selectedFund, search])

  if (loading) return <div className="page-shell"><p style={{ color: 'var(--text-muted)' }}>A carregar...</p></div>
  if (error) return <div className="page-shell"><p style={{ color: 'var(--crimson-400)' }}>Erro: {error}</p></div>
  if (!db) return null

  return (
    <div className="page-shell">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Participadas</h1>
          <p className="page-subtitle">{companies.length} empresa{companies.length !== 1 ? 's' : ''} em portfólio</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <input
            style={{
              height: 36, border: '1px solid var(--border)', borderRadius: 8,
              background: 'var(--surface-raised)', padding: '0 12px',
              fontSize: 13, color: 'var(--text-primary)', outline: 'none', width: 180,
            }}
            placeholder="Pesquisar..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <select
            className="filter-select"
            value={selectedFund}
            onChange={e => setSelectedFund(e.target.value as Fund | '')}
          >
            <option value="">Todos os fundos</option>
            {FUNDS.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
        {companies.length === 0 && (
          <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', gridColumn: '1/-1' }}>
            Sem participadas
          </div>
        )}
        {companies.map(c => (
          <CompanyCard
            key={c.id}
            company={c}
            valuations={db.valuations}
            fundFilter={selectedFund || null}
            onClick={() => setPanelCompany(c)}
          />
        ))}
      </div>

      {panelCompany && (
        <CompanyPanel
          company={panelCompany}
          valuations={db.valuations}
          onClose={() => setPanelCompany(null)}
          onNavigate={onNavigate}
        />
      )}
    </div>
  )
}

function CompanyCard({
  company, valuations, fundFilter, onClick,
}: {
  company: Company
  valuations: Valuation[]
  fundFilter: string | null
  onClick: () => void
}) {
  const m = metrics(company, valuations, fundFilter)
  const lv = latestVal(company.id, valuations)

  // Runway
  const runway = company.runway
  const runwayMonths = runway?.cashBalance && runway?.monthlyBurn && runway.monthlyBurn > 0
    ? Math.round(runway.cashBalance / runway.monthlyBurn)
    : null
  const runwayColor = runwayMonths == null ? 'var(--text-disabled)'
    : runwayMonths > 18 ? 'var(--jade-500)'
    : runwayMonths > 12 ? 'var(--amber-400)'
    : 'var(--crimson-500)'

  // Latest financials
  const lastFin = company.financials?.length
    ? [...company.financials].sort((a, b) => b.year - a.year)[0]
    : null

  // Active funds
  const activeFunds = [...new Set(
    (company.tranches || [])
      .filter(t => !t.converted && t.type !== 'Evento Cap Table')
      .map(t => t.fund)
  )]

  return (
    <div
      className="card"
      onClick={onClick}
      style={{ cursor: 'pointer', transition: 'box-shadow 150ms', padding: 0, overflow: 'hidden' }}
      onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.10)')}
      onMouseLeave={e => (e.currentTarget.style.boxShadow = '')}
    >
      {/* Header */}
      <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>{company.name}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
              {[company.sector, company.country].filter(Boolean).join(' · ') || '—'}
            </div>
          </div>
          {runwayMonths != null && (
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 700, color: runwayColor, lineHeight: 1 }}>
                {runwayMonths}m
              </div>
              <div style={{ fontSize: 9, color: 'var(--text-disabled)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>runway</div>
            </div>
          )}
        </div>

        {/* Fund badges */}
        <div style={{ display: 'flex', gap: 4, marginTop: 8, flexWrap: 'wrap' }}>
          {activeFunds.map(f => (
            <span key={f} className="fund-badge" style={{ ...getFundBadgeStyle(f), fontSize: 10 }}>{f}</span>
          ))}
        </div>
      </div>

      {/* Summary */}
      {company.summary && (
        <div style={{ padding: '8px 16px', fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5, borderBottom: '1px solid var(--border)' }}>
          <p style={{ margin: 0, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
            {company.summary}
          </p>
        </div>
      )}

      {/* Metrics row */}
      <div style={{ padding: '10px 16px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        <Metric label="NAV" value={fmtE(m.nav)} bold />
        <Metric label="MOIC" value={m.moic != null ? m.moic.toFixed(2) + 'x' : '—'} />
        <Metric label="Part." value={m.own != null ? m.own.toFixed(1) + '%' : '—'} />
      </div>

      {/* Financials snippet */}
      {lastFin && (
        <div style={{ padding: '0 16px 12px', display: 'flex', gap: 16 }}>
          {lastFin.revenue != null && (
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{lastFin.year}</span>
              {' · '}Vendas {fmtE(lastFin.revenue)}
            </div>
          )}
          {lastFin.netProfit != null && (
            <div style={{ fontSize: 11, color: lastFin.netProfit >= 0 ? 'var(--jade-500)' : 'var(--crimson-500)' }}>
              Res. {fmtE(lastFin.netProfit)}
            </div>
          )}
        </div>
      )}

      {/* Valuation date */}
      {lv && (
        <div style={{ padding: '6px 16px 10px', fontSize: 10, color: 'var(--text-disabled)', borderTop: lastFin ? '1px solid var(--border)' : undefined }}>
          Ult. aval. {lv.date}{lv.method ? ` · ${lv.method}` : ''}
        </div>
      )}
    </div>
  )
}

function Metric({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-disabled)' }}>{label}</span>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: bold ? 700 : 500, color: bold ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{value}</span>
    </div>
  )
}
