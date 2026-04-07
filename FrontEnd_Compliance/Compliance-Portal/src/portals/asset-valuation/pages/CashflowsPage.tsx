import { useMemo, useState } from 'react'

import { useDatabase } from '../hooks/useDatabase'
import { fmtE, getFundBadgeStyle } from '../lib/helpers'
import { FUNDS } from '../types/database'
import type { Fund } from '../types/database'

type CashflowRow = {
  id: string
  date: string
  companyName: string
  fund: Fund
  type: string
  amount: number
}

export function CashflowsPage() {
  const { db, loading, error } = useDatabase()
  const [selectedFund, setSelectedFund] = useState<Fund | ''>('')

  const rows = useMemo<CashflowRow[]>(() => {
    if (!db) return []

    return db.companies
      .flatMap((company) => {
        const investments = (company.tranches || [])
          .filter(
            (tranche) =>
              !tranche.converted &&
              (tranche.amount || 0) > 0 &&
              Boolean(tranche.date),
          )
          .map((tranche) => ({
            id: `investment-${tranche.id}`,
            date: tranche.date!,
            companyName: company.name,
            fund: tranche.fund,
            type: tranche.type,
            amount: -(tranche.amount || 0),
          }))

        const exits = (company.sales || [])
          .filter((sale) => (sale.amount || 0) > 0 && Boolean(sale.date))
          .map((sale) => ({
            id: `exit-${sale.id}`,
            date: sale.date!,
            companyName: company.name,
            fund: sale.fund,
            type: 'Saída',
            amount: sale.amount || 0,
          }))

        return [...investments, ...exits]
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }, [db])

  const filteredRows = useMemo(() => {
    if (!selectedFund) return rows
    return rows.filter((row) => row.fund === selectedFund)
  }, [rows, selectedFund])

  const investmentTotal = useMemo(
    () =>
      filteredRows
        .filter((row) => row.amount < 0)
        .reduce((sum, row) => sum + row.amount, 0),
    [filteredRows],
  )

  const exitTotal = useMemo(
    () =>
      filteredRows
        .filter((row) => row.amount > 0)
        .reduce((sum, row) => sum + row.amount, 0),
    [filteredRows],
  )

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
          <h1 className="page-title">Cashflows</h1>
          <p className="page-subtitle">{filteredRows.length} movimentos</p>
        </div>

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

      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-label">Total Investido</div>
          <div className="kpi-value">{fmtE(Math.abs(investmentTotal))}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Total Realizado</div>
          <div className="kpi-value">{fmtE(exitTotal)}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Cash Líquido</div>
          <div className="kpi-value" style={{ color: (exitTotal + investmentTotal) >= 0 ? 'var(--jade-500)' : 'var(--text-primary)' }}>
            {fmtE(exitTotal + investmentTotal)}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Empresa</th>
                <th>Fundo</th>
                <th>Tipo</th>
                <th className="right">Montante</th>
              </tr>
            </thead>

            <tbody>
              {filteredRows.length === 0 && (
                <tr>
                  <td colSpan={5} className="empty-state">
                    Sem movimentos de caixa
                  </td>
                </tr>
              )}

              {filteredRows.map((row) => (
                <tr key={row.id}>
                  <td className="mono" style={{ color: 'var(--text-muted)', fontSize: 11 }}>{row.date}</td>
                  <td className="primary">{row.companyName}</td>
                  <td><span className="fund-badge" style={getFundBadgeStyle(row.fund)}>{row.fund}</span></td>
                  <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{row.type}</td>
                  <td className="right mono" style={{ color: row.amount < 0 ? 'var(--crimson-500)' : 'var(--jade-500)', fontWeight: 500 }}>
                    {row.amount < 0 ? '−' : '+'}{fmtE(Math.abs(row.amount))}
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
