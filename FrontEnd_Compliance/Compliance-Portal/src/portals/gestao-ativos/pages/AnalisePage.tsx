import { useMemo } from 'react'
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend
} from 'recharts'
import type { Asset } from '../lib/api'
import { calcTotalCost, calcBreakEven, calcYieldOnCost, fmtEur, fmtPct } from '../lib/finance'

const COLORS = ['#C25A2E', '#14213D', '#4A7C59', '#8B6A2F', '#6B7280', '#A47551', '#2D5A8A']

interface Props {
  assets: Asset[]
}

export function AnalisePage({ assets }: Props) {
  const active = useMemo(() => assets.filter(a => a.status !== 'vendido'), [assets])

  // By SPV
  const bySPV = useMemo(() => {
    const map: Record<string, number> = {}
    active.forEach(a => {
      const k = a.spv || 'Sem SPV'
      map[k] = (map[k] ?? 0) + calcTotalCost(a)
    })
    return Object.entries(map).map(([name, value]) => ({ name, value }))
  }, [active])

  // By Typology
  const bySector = useMemo(() => {
    const map: Record<string, number> = {}
    active.forEach(a => {
      const k = a.typology || 'Sem Tipologia'
      map[k] = (map[k] ?? 0) + calcTotalCost(a)
    })
    return Object.entries(map).map(([name, value]) => ({ name, value }))
  }, [active])

  // Per-asset bar data
  const perAsset = useMemo(() =>
    [...active]
      .sort((a, b) => calcTotalCost(b) - calcTotalCost(a))
      .slice(0, 15)
      .map(a => ({
        name: a.name.length > 18 ? a.name.slice(0, 18) + '…' : a.name,
        custo:    Math.round(calcTotalCost(a)),
        breakeven: Math.round(calcBreakEven(a)),
        rendimento: Math.round(a.income_current ?? 0),
      })),
    [active]
  )

  // Summary stats
  const totalCost    = active.reduce((s, a) => s + calcTotalCost(a), 0)
  const totalIncome  = active.reduce((s, a) => s + (a.income_current ?? 0), 0)
  const avgYield     = totalCost > 0 ? totalIncome / totalCost : 0
  const emVenda      = assets.filter(a => a.status === 'em_venda').length

  return (
    <div className="ga-analise">
      {/* Summary stats */}
      <div className="ga-kpi-grid">
        <StatCard label="Ativos em Análise" value={String(active.length)} />
        <StatCard label="Custo Total" value={fmtEur(totalCost, true)} />
        <StatCard label="Yield Médio" value={(avgYield * 100).toFixed(1) + '%'} />
        <StatCard label="Em Venda" value={String(emVenda)} />
      </div>

      {/* Donuts row */}
      <div className="ga-charts-row">
        <div className="ga-chart-card">
          <div className="ga-chart-title">Por SPV — Custo Total</div>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={bySPV} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                {bySPV.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v: number) => fmtEur(v, true)} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="ga-chart-card">
          <div className="ga-chart-title">Por Setor — Custo Total</div>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={bySector} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                {bySector.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v: number) => fmtEur(v, true)} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Bar chart — per asset */}
      <div className="ga-chart-card" style={{ marginTop: '1.5rem' }}>
        <div className="ga-chart-title">Comparativo por Ativo (top 15 por custo)</div>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={perAsset} margin={{ top: 0, right: 16, left: 16, bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" interval={0} />
            <YAxis tick={{ fontSize: 10 }} tickFormatter={(v: number) => fmtEur(v, true)} />
            <Tooltip formatter={(v: number) => fmtEur(v)} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="custo"      name="Custo Total"    fill="#14213D" radius={[3,3,0,0]} />
            <Bar dataKey="breakeven"  name="Break-Even"     fill="#C25A2E" radius={[3,3,0,0]} />
            <Bar dataKey="rendimento" name="Rendimento Anual" fill="#4A7C59" radius={[3,3,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Yield table */}
      <div className="ga-section-title" style={{ marginTop: '2rem' }}>Ranking por Yield</div>
      <div className="ga-table-wrap">
        <table className="ga-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Nome</th>
              <th>SPV</th>
              <th style={{textAlign:'right'}}>Custo Total</th>
              <th style={{textAlign:'right'}}>Rendimento</th>
              <th style={{textAlign:'right'}}>Yield on Cost</th>
            </tr>
          </thead>
          <tbody>
            {[...active]
              .sort((a, b) => calcYieldOnCost(b) - calcYieldOnCost(a))
              .map((a, i) => {
                const yoc = calcYieldOnCost(a)
                return (
                  <tr key={a.id} className="ga-table-row">
                    <td className="ga-table-mono text-gray-400">{i + 1}</td>
                    <td className="ga-table-name">{a.name}</td>
                    <td className="ga-table-mono">{a.spv ?? '—'}</td>
                    <td style={{textAlign:'right'}} className="ga-table-mono">{fmtEur(calcTotalCost(a))}</td>
                    <td style={{textAlign:'right'}} className="ga-table-mono">{fmtEur(a.income_current)}</td>
                    <td style={{textAlign:'right'}} className={`ga-table-mono font-semibold ${yoc > 0.06 ? 'text-green-700' : yoc > 0.03 ? 'text-amber-600' : 'text-gray-500'}`}>
                      {fmtPct(yoc)}
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

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="ga-kpi-card">
      <div className="ga-kpi-label">{label}</div>
      <div className="ga-kpi-value">{value}</div>
    </div>
  )
}
