import { useMemo, useState } from 'react'

import { useDatabase } from '../hooks/useDatabase'
import {
  companyIRR,
  fmtE,
  fmtN,
  fmtP,
  fmtPAbs,
  getFundBadgeStyle,
  hasActiveExposure,
  metrics,
} from '../lib/helpers'
import { FUNDS, COMPANY_TYPES } from '../types/database'
import type { Fund, CompanyType } from '../types/database'

interface Props {
  onNavigate: (page: string, options?: { companyId?: string }) => void
}

export function PortfolioPage({ onNavigate }: Props) {
  const { db, loading, error } = useDatabase()
  const [selectedFund, setSelectedFund] = useState<Fund | ''>('')
  const [selectedType, setSelectedType] = useState<CompanyType | ''>('')

  const companies = useMemo(() => {
    if (!db) return []

    return db.companies
      .filter((company) =>
        hasActiveExposure(company, selectedFund ? [selectedFund] : null) &&
        (!selectedType || company.companyType === selectedType),
      )
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
  }, [db, selectedFund, selectedType])

  if (loading) {
    return (
      <div className="page-shell">
        <p style={{ color: 'var(--text-muted)' }}>A carregar...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="page-shell">
        <p style={{ color: 'var(--crimson-400)' }}>Erro: {error}</p>
      </div>
    )
  }

  if (!db) return null

  return (
    <div className="page-shell">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Portfólio Consolidado</h1>
          <p className="page-subtitle">
            {companies.length} empresa{companies.length !== 1 ? 's' : ''} em
            portfólio
          </p>
        </div>

        <select
          className="filter-select"
          value={selectedType}
          onChange={(event) => setSelectedType(event.target.value as CompanyType | '')}
        >
          <option value="">Todos os tipos</option>
          {COMPANY_TYPES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <select
          className="filter-select"
          value={selectedFund}
          onChange={(event) => setSelectedFund(event.target.value as Fund | '')}
        >
          <option value="">Todos os fundos</option>
          {FUNDS.map((fund) => (
            <option key={fund} value={fund}>
              {fund}
            </option>
          ))}
        </select>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Empresa</th>
                <th>Fundos</th>
                <th className="right">Equity Inv.</th>
                <th className="right">Quasi Eq.</th>
                <th className="right">Dívida</th>
                <th className="right">Ações</th>
                <th className="right">% Part.</th>
                <th className="right">Equity Value</th>
                <th className="right">NAV</th>
                <th className="right">IRR</th>
                <th className="right">Rent. Equity</th>
              </tr>
            </thead>

            <tbody>
              {companies.length === 0 && (
                <tr>
                  <td colSpan={11} className="empty-state">
                    Sem empresas no portfólio
                  </td>
                </tr>
              )}

              {companies.map((company) => {
                const companyMetrics = metrics(
                  company,
                  db.valuations,
                  selectedFund || null,
                )
                const irr = companyIRR(company, db.valuations)
                const funds = [
                  ...new Set(
                    (company.tranches || [])
                      .filter(
                        (tranche) =>
                          !tranche.converted &&
                          tranche.type !== 'Evento Cap Table',
                      )
                      .map((tranche) => tranche.fund),
                  ),
                ]

                return (
                  <tr
                    key={company.id}
                    onClick={() => onNavigate('participadas', { companyId: company.id })}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        onNavigate('participadas', { companyId: company.id })
                      }
                    }}
                    tabIndex={0}
                    style={{ cursor: 'pointer' }}
                  >
                    <td>
                      <div
                        style={{
                          fontWeight: 600,
                          color: 'var(--text-primary)',
                        }}
                      >
                        {company.name}
                      </div>

                      {(company.sector || company.country) && (
                        <div
                          style={{
                            fontSize: 11,
                            color: 'var(--text-muted)',
                            marginTop: 2,
                          }}
                        >
                          {[company.sector, company.country]
                            .filter(Boolean)
                            .join(' · ')}
                        </div>
                      )}
                    </td>

                    <td>
                      <div className="fund-badges">
                        {funds.map((fund) => (
                          <span key={fund} className="fund-badge" style={getFundBadgeStyle(fund)}>
                            {fund}
                          </span>
                        ))}
                      </div>
                    </td>

                    <td className="right mono">{fmtE(companyMetrics.eqInv)}</td>
                    <td className="right mono">{fmtE(companyMetrics.quasiInv)}</td>
                    <td className="right mono">{fmtE(companyMetrics.debtInv)}</td>
                    <td className="right mono">{fmtN(companyMetrics.fsh)}</td>
                    <td className="right mono">{fmtPAbs(companyMetrics.own)}</td>
                    <td className="right mono">{fmtE(companyMetrics.ev)}</td>
                    <td className="right bold">{fmtE(companyMetrics.nav)}</td>
                    <td className="right mono" style={{ color: reColor(irr) }}>
                      {fmtP(irr, 1)}
                    </td>
                    <td
                      className="right mono"
                      style={{ color: reColor(companyMetrics.re) }}
                    >
                      {companyMetrics.re != null
                        ? fmtP(companyMetrics.re, 1)
                        : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  )
}

function reColor(n: number | null | undefined): string {
  if (n == null) return 'var(--text-muted)'
  return n > 0
    ? 'var(--jade-500)'
    : n < 0
      ? 'var(--crimson-500)'
      : 'var(--text-muted)'
}
