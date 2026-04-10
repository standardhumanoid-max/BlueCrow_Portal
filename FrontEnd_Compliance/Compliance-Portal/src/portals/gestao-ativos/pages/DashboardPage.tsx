import { useMemo } from 'react'
import type { Asset } from '../lib/api'
import { Building2, TrendingUp, Euro, MapPin } from 'lucide-react'

const STATUS_LABEL: Record<string, string> = {
  em_rendimento: 'Em Rendimento',
  sem_rendimento: 'Sem Rendimento',
  em_venda: 'Em Venda',
  vendido: 'Vendido',
}
const STATUS_COLOR: Record<string, string> = {
  em_rendimento:  'bg-emerald-100 text-emerald-700',
  sem_rendimento: 'bg-gray-100 text-gray-600',
  em_venda:       'bg-amber-100 text-amber-700',
  vendido:        'bg-blue-100 text-blue-700',
}

function fmt(n: number | null | undefined) {
  if (n == null) return '—'
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)
}

export function DashboardPage({ assets, onSelect }: { assets: Asset[]; onSelect: (id: string) => void }) {
  const stats = useMemo(() => {
    const ativos = assets.filter(a => a.status === 'em_rendimento')
    return {
      total:         assets.length,
      em_rendimento: ativos.length,
      em_venda:      assets.filter(a => a.status === 'em_venda').length,
      income_total:  assets.reduce((s, a) => s + (a.income_current ?? 0), 0),
      custo_total:   assets.reduce((s, a) => s + (a.purchase_price ?? 0), 0),
    }
  }, [assets])

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Dashboard</h1>
        <p className="text-sm text-slate-500 mt-0.5">Visão geral do portefólio de ativos</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Ativos',     value: stats.total,             icon: Building2,   color: 'text-slate-600',  bg: 'bg-slate-50' },
          { label: 'Em Rendimento',    value: stats.em_rendimento,     icon: TrendingUp,  color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Em Venda',         value: stats.em_venda,          icon: Building2,   color: 'text-amber-600',  bg: 'bg-amber-50' },
          { label: 'Rendimento Anual', value: fmt(stats.income_total), icon: Euro,        color: 'text-blue-600',   bg: 'bg-blue-50' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 p-4">
            <div className={`w-9 h-9 rounded-lg ${bg} flex items-center justify-center mb-3`}>
              <Icon className={`w-5 h-5 ${color}`} />
            </div>
            <div className="text-2xl font-bold text-slate-800">{value}</div>
            <div className="text-xs text-slate-500 mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* Assets table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-slate-700">Portefólio de Ativos</h2>
        </div>
        {assets.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-sm">Nenhum ativo registado.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-[11px] uppercase tracking-wide text-slate-400">
                <th className="px-5 py-3 text-left">Ativo</th>
                <th className="px-4 py-3 text-left">SPV</th>
                <th className="px-4 py-3 text-left">Localização</th>
                <th className="px-4 py-3 text-left">Setor</th>
                <th className="px-4 py-3 text-right">Rendimento Anual</th>
                <th className="px-4 py-3 text-left">Estado</th>
              </tr>
            </thead>
            <tbody>
              {assets.map(a => (
                <tr key={a.id} onClick={() => onSelect(a.id)}
                  className="border-b border-gray-50 hover:bg-slate-50 cursor-pointer transition-colors">
                  <td className="px-5 py-3 font-medium text-slate-800">{a.name}</td>
                  <td className="px-4 py-3 text-slate-500">{a.spv ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-500">
                    <div className="flex items-center gap-1.5">
                      {a.maps_link
                        ? <a href={a.maps_link} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}
                            className="flex items-center gap-1 text-blue-500 hover:text-blue-700">
                            <MapPin className="w-3 h-3" />{a.location ?? '—'}
                          </a>
                        : <span>{a.location ?? '—'}</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-500 capitalize">{a.sector ?? '—'}</td>
                  <td className="px-4 py-3 text-right font-medium text-slate-700">{fmt(a.income_current)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium ${STATUS_COLOR[a.status] ?? 'bg-gray-100 text-gray-600'}`}>
                      {STATUS_LABEL[a.status] ?? a.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
