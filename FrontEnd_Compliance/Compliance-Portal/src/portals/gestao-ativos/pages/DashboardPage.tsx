import { useMemo } from 'react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell,
  PieChart, Pie, Legend,
} from 'recharts'
import type { Asset } from '../lib/api'
import {
  calcTotalCost, calcBreakEven, calcAskingBCC, calcYieldOnCost,
  fmtEur, fmtPctRaw,
} from '../lib/finance'
import { STATUS_LABELS } from '../lib/status'

interface Props {
  assets: Asset[]
  onSelectAsset: (id: string) => void
}

const STATUS_COLOR: Record<string, string> = {
  em_rendimento:  '#1E6B4A',
  sem_rendimento: '#6B7385',
  em_venda:       '#8A5B12',
  vendido:        '#1B4B9A',
}

const SPV_PALETTE = ['#C25A2E','#1E6B4A','#1B4B9A','#8A5B12','#6B3A8C','#2C7A7B','#991B1B','#374151']

function spvColor(i: number) { return SPV_PALETTE[i % SPV_PALETTE.length] }

// ── Tooltip formatters ──────────────────────────────────────────────────────

function EurTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="ga-chart-tooltip">
      <div className="ga-chart-tooltip-label">{label}</div>
      {payload.map((p: any, i: number) => (
        <div key={i} className="ga-chart-tooltip-row">
          <span style={{ color: p.color }}>{p.name}</span>
          <span>{fmtEur(p.value, true)}</span>
        </div>
      ))}
    </div>
  )
}

function PctTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="ga-chart-tooltip">
      <div className="ga-chart-tooltip-label">{label}</div>
      {payload.map((p: any, i: number) => (
        <div key={i} className="ga-chart-tooltip-row">
          <span style={{ color: p.color }}>{p.name ?? 'Yield'}</span>
          <span>{fmtPctRaw(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

function PieTooltipFn({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const p = payload[0]
  return (
    <div className="ga-chart-tooltip">
      <div className="ga-chart-tooltip-label">{p.name}</div>
      <div className="ga-chart-tooltip-row">
        <span style={{ color: p.payload.fill }}>{p.value} ativo{p.value !== 1 ? 's' : ''}</span>
      </div>
    </div>
  )
}

// ── Main component ──────────────────────────────────────────────────────────

export function DashboardPage({ assets, onSelectAsset }: Props) {
  const active = useMemo(() => assets.filter(a => a.status !== 'vendido'), [assets])

  const kpis = useMemo(() => {
    let cost = 0, income = 0, breakEven = 0, asking = 0
    for (const a of assets) {
      cost     += calcTotalCost(a)
      income   += a.income_current ?? 0
      breakEven += calcBreakEven(a)
      asking   += a.asking_price ?? calcAskingBCC(a)
    }
    return { cost, income, breakEven, asking, yield: cost > 0 ? income / cost : 0 }
  }, [assets])

  // SPV breakdown: cost + break-even + income
  const spvData = useMemo(() => {
    const map: Record<string, { cost: number; breakEven: number; income: number; count: number }> = {}
    for (const a of assets) {
      const k = a.spv || 'Sem SPV'
      if (!map[k]) map[k] = { cost: 0, breakEven: 0, income: 0, count: 0 }
      map[k].cost      += calcTotalCost(a)
      map[k].breakEven += calcBreakEven(a)
      map[k].income    += a.income_current ?? 0
      map[k].count++
    }
    return Object.entries(map)
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.cost - a.cost)
  }, [assets])

  // Status distribution (pie)
  const statusData = useMemo(() => {
    const map: Record<string, number> = {}
    for (const a of assets) map[a.status] = (map[a.status] ?? 0) + 1
    return Object.entries(map).map(([status, value]) => ({
      name: STATUS_LABELS[status] ?? status,
      value,
      fill: STATUS_COLOR[status] ?? '#6B7385',
    }))
  }, [assets])

  // Top 10 yield assets (active only)
  const yieldData = useMemo(() =>
    active
      .map(a => ({ name: a.name.length > 20 ? a.name.slice(0, 18) + '…' : a.name, yield: calcYieldOnCost(a) * 100 }))
      .filter(d => d.yield > 0)
      .sort((a, b) => b.yield - a.yield)
      .slice(0, 10),
    [active]
  )

  // Top assets by annual income
  const incomeRanking = useMemo(() =>
    [...assets]
      .filter(a => (a.income_current ?? 0) > 0)
      .sort((a, b) => (b.income_current ?? 0) - (a.income_current ?? 0))
      .slice(0, 8),
    [assets]
  )
  const maxIncome = incomeRanking[0]?.income_current ?? 1

  if (assets.length === 0) {
    return (
      <div className="ga-bi-empty">
        <div className="ga-bi-empty-icon">📊</div>
        <div className="ga-bi-empty-title">Sem dados para analisar</div>
        <div className="ga-bi-empty-sub">Adiciona ativos na Tabela para ver o dashboard.</div>
      </div>
    )
  }

  return (
    <div className="ga-bi">

      {/* ── KPI strip ── */}
      <div className="ga-bi-kpi-row">
        <KpiCard label="Ativos Totais"    value={String(assets.length)}           sub={`${active.length} ativos`} />
        <KpiCard label="Custo Portefólio" value={fmtEur(kpis.cost, true)}         sub="aquisição + capex + opex" accent />
        <KpiCard label="Renda Anual"      value={fmtEur(kpis.income, true)}       sub="NOI total" />
        <KpiCard label="Yield Médio"      value={fmtPctRaw(kpis.yield * 100)}     sub="income / custo" />
        <KpiCard label="VALOR Inv."       value={fmtEur(kpis.breakEven, true)}    sub="break-even total" accent />
        <KpiCard label="Asking Total"     value={fmtEur(kpis.asking, true)}       sub="asking teórico" />
      </div>

      {/* ── Row 1: SPV bars + Status pie ── */}
      <div className="ga-bi-row">
        <div className="ga-bi-card ga-bi-card-lg">
          <div className="ga-bi-card-title">Composição por SPV</div>
          <div className="ga-bi-card-sub">Custo total vs VALOR Inv. por participada</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={spvData} margin={{ top: 4, right: 8, bottom: 4, left: 8 }} barGap={2}>
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#6B7385' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: '#6B7385' }} axisLine={false} tickLine={false}
                tickFormatter={v => fmtEur(v, true)} width={52} />
              <Tooltip content={<EurTooltip />} />
              <Bar dataKey="cost" name="Custo" radius={[3,3,0,0]}>
                {spvData.map((_, i) => <Cell key={i} fill={spvColor(i)} fillOpacity={0.75} />)}
              </Bar>
              <Bar dataKey="breakEven" name="VALOR Inv." radius={[3,3,0,0]}>
                {spvData.map((_, i) => <Cell key={i} fill={spvColor(i)} fillOpacity={0.35} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          {/* SPV legend */}
          <div className="ga-bi-spv-legend">
            {spvData.map((s, i) => (
              <span key={s.name} className="ga-bi-legend-item">
                <span className="ga-bi-legend-dot" style={{ background: spvColor(i) }} />
                {s.name}
                <span className="ga-bi-legend-count">{s.count}</span>
              </span>
            ))}
          </div>
        </div>

        <div className="ga-bi-card">
          <div className="ga-bi-card-title">Distribuição por Estado</div>
          <div className="ga-bi-card-sub">Ativos por status</div>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={statusData} dataKey="value" cx="50%" cy="50%"
                innerRadius={48} outerRadius={78} paddingAngle={3}>
                {statusData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
              </Pie>
              <Tooltip content={<PieTooltipFn />} />
              <Legend iconType="circle" iconSize={8}
                formatter={(value) => <span style={{ fontSize: 10, color: '#6B7385' }}>{value}</span>} />
            </PieChart>
          </ResponsiveContainer>
          {/* Status counts */}
          <div className="ga-bi-status-rows">
            {statusData.map(s => (
              <div key={s.name} className="ga-bi-status-row">
                <span className="ga-bi-status-dot" style={{ background: s.fill }} />
                <span className="ga-bi-status-name">{s.name}</span>
                <span className="ga-bi-status-val">{s.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Row 2: Yield ranking + Income ranking ── */}
      <div className="ga-bi-row">
        <div className="ga-bi-card">
          <div className="ga-bi-card-title">Top Yield</div>
          <div className="ga-bi-card-sub">Yield sobre custo por ativo (ativos em rendimento)</div>
          {yieldData.length === 0 ? (
            <div className="ga-bi-no-data">Sem ativos com rendimento.</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={yieldData} layout="vertical" margin={{ top: 4, right: 32, bottom: 4, left: 4 }}>
                <XAxis type="number" tick={{ fontSize: 9, fill: '#6B7385' }} axisLine={false} tickLine={false}
                  tickFormatter={v => `${v.toFixed(1)}%`} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#6B7385' }}
                  axisLine={false} tickLine={false} width={110} />
                <Tooltip content={<PctTooltip />} />
                <Bar dataKey="yield" name="Yield" radius={[0,3,3,0]}>
                  {yieldData.map((d, i) => (
                    <Cell key={i} fill={d.yield >= 6 ? '#1E6B4A' : d.yield >= 2 ? '#C25A2E' : '#991B1B'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="ga-bi-card">
          <div className="ga-bi-card-title">Top Renda Anual</div>
          <div className="ga-bi-card-sub">Ativos com maior rendimento anual</div>
          {incomeRanking.length === 0 ? (
            <div className="ga-bi-no-data">Sem ativos com rendimento.</div>
          ) : (
            <div className="ga-bi-income-list">
              {incomeRanking.map((a, i) => {
                const pct = ((a.income_current ?? 0) / maxIncome) * 100
                return (
                  <button key={a.id} className="ga-bi-income-row" onClick={() => onSelectAsset(a.id)}>
                    <span className="ga-bi-income-rank">{i + 1}</span>
                    <div className="ga-bi-income-info">
                      <span className="ga-bi-income-name">{a.name}</span>
                      <div className="ga-bi-income-bar-wrap">
                        <div className="ga-bi-income-bar" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                    <span className="ga-bi-income-val">{fmtEur(a.income_current, true)}</span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Row 3: SPV income vs yield ── */}
      {spvData.length > 1 && (
        <div className="ga-bi-row">
          <div className="ga-bi-card ga-bi-card-full">
            <div className="ga-bi-card-title">Renda Anual por SPV</div>
            <div className="ga-bi-card-sub">NOI agregado por participada</div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={spvData} margin={{ top: 4, right: 8, bottom: 4, left: 8 }} barGap={2}>
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#6B7385' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: '#6B7385' }} axisLine={false} tickLine={false}
                  tickFormatter={v => fmtEur(v, true)} width={52} />
                <Tooltip content={<EurTooltip />} />
                <Bar dataKey="income" name="Renda Anual" radius={[3,3,0,0]}>
                  {spvData.map((_, i) => <Cell key={i} fill={spvColor(i)} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

    </div>
  )
}

function KpiCard({ label, value, sub, accent }: {
  label: string; value: string; sub: string; accent?: boolean
}) {
  return (
    <div className={`ga-bi-kpi${accent ? ' accent' : ''}`}>
      <div className="ga-bi-kpi-label">{label}</div>
      <div className="ga-bi-kpi-value">{value}</div>
      <div className="ga-bi-kpi-sub">{sub}</div>
    </div>
  )
}
