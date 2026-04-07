import { useMemo } from 'react'
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts'
import { KpiCard } from '@/components/ui/KpiCard'
import { Badge, prioVariant, estadoVariant } from '@/components/ui/Badge'
import { useStore } from '@/store/useStore'
import {
  AlertTriangle, TrendingUp, CheckCircle2, XCircle,
  CalendarDays, Clock, ChevronRight, Flame,
} from 'lucide-react'

// ─── Date helpers ─────────────────────────────────────────────────────────────
function parsePrazo(prazo: string): Date | null {
  if (!prazo) return null
  // DD.MM.YYYY
  const m = prazo.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/)
  if (m) return new Date(parseInt(m[3]), parseInt(m[2]) - 1, parseInt(m[1]))
  // YYYY-MM-DD fallback
  const d = new Date(prazo)
  return isNaN(d.getTime()) ? null : d
}

function daysUntil(date: Date): number {
  const now = new Date(); now.setHours(0,0,0,0)
  return Math.ceil((date.getTime() - now.getTime()) / 86400000)
}

function urgencyColor(days: number): { bg: string; text: string; dot: string } {
  if (days < 0)   return { bg: 'bg-red-50',    text: 'text-red-700',    dot: 'bg-red-500' }
  if (days <= 7)  return { bg: 'bg-red-50',    text: 'text-red-600',    dot: 'bg-red-400' }
  if (days <= 14) return { bg: 'bg-amber-50',  text: 'text-amber-700',  dot: 'bg-amber-400' }
  if (days <= 30) return { bg: 'bg-blue-50',   text: 'text-blue-700',   dot: 'bg-blue-400' }
  return              { bg: 'bg-gray-50',    text: 'text-gray-600',   dot: 'bg-gray-300' }
}

const MONTH_PT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

// ─── Quarter mini progress ────────────────────────────────────────────────────
function QuarterBar({ label, total, done, color }: { label: string; total: number; done: number; color: string }) {
  const pct = total ? Math.round(done/total*100) : 0
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] font-bold w-8 shrink-0" style={{ color }}>{label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }}/>
      </div>
      <span className="text-[10px] text-gray-400 w-8 text-right">{done}/{total}</span>
    </div>
  )
}

// ─── Section heading ──────────────────────────────────────────────────────────
function SectionHead({ icon, title, action, onAction }: {
  icon: React.ReactNode; title: string; action?: string; onAction?: () => void
}) {
  return (
    <div className="card-header mb-3">
      <div className="flex items-center gap-2">
        {icon}
        <span className="card-title">{title}</span>
      </div>
      {action && (
        <button onClick={onAction} className="text-[11px] text-blue-600 font-medium hover:text-blue-800 flex items-center gap-0.5">
          {action} <ChevronRight size={11}/>
        </button>
      )}
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
export function Dashboard() {
  const { tasks, risks, clients, checklist, setPage } = useStore()

  const now         = new Date(); now.setHours(0,0,0,0)
  const curMonth    = now.getMonth()
  const curYear     = now.getFullYear()
  const monthLabel  = MONTH_PT[curMonth]

  // ── Task derived ──────────────────────────────────────────────────────────
  const concluidas   = tasks.filter(t => t.estado === 'Concluído').length
  const emAndamento  = tasks.filter(t => t.estado === 'Em andamento').length
  const atrasadas    = tasks.filter(t => t.estado === 'Em atraso')
  const conformidade = tasks.length ? Math.round(concluidas / tasks.length * 100) : 0

  // Tasks with parsed dates
  const tasksWithDate = useMemo(() =>
    tasks
      .map(t => ({ ...t, _date: parsePrazo(t.prazo) }))
      .filter(t => t._date !== null) as (typeof tasks[0] & { _date: Date })[]
  , [tasks])

  // Mês actual
  const monthTasks = useMemo(() =>
    tasksWithDate.filter(t =>
      t._date.getMonth() === curMonth &&
      t._date.getFullYear() === curYear &&
      t.estado !== 'Concluído'
    ).sort((a,b) => a._date.getTime() - b._date.getTime())
  , [tasksWithDate, curMonth, curYear])

  // Próximas 60 dias (excluindo mês actual já listado e concluídas)
  const upcomingTasks = useMemo(() => {
    const limit = new Date(now); limit.setDate(limit.getDate() + 60)
    return tasksWithDate
      .filter(t =>
        t._date > now &&
        t._date.getMonth() !== curMonth &&
        t._date <= limit &&
        t.estado !== 'Concluído'
      )
      .sort((a,b) => a._date.getTime() - b._date.getTime())
      .slice(0, 8)
  }, [tasksWithDate, now, curMonth])

  // ── Risk derived ──────────────────────────────────────────────────────────
  const criticos     = risks.filter(r => r.estado === 'F4').length
  const altos        = risks.filter(r => r.estado === 'F3').length
  const topRisks     = useMemo(() =>
    [...risks]
      .filter(r => ['F4','F3'].includes(r.estado as string))
      .sort((a,b) => (Number(b.probabilidade) * Number(b.impacto)) - (Number(a.probabilidade) * Number(a.impacto)))
      .slice(0, 5)
  , [risks])

  // ── KYC ──────────────────────────────────────────────────────────────────
  const kycPendentes = clients.filter(c => c.status === 'Pendente' || c.status === 'Em Revisão').length

  // ── Charts ────────────────────────────────────────────────────────────────
  const pieData = useMemo(() => [
    { name: 'Concluído',    value: concluidas,                                        fill: '#10b981' },
    { name: 'Em andamento', value: emAndamento,                                       fill: '#3b82f6' },
    { name: 'Por iniciar',  value: tasks.filter(t => t.estado === 'Por iniciar').length, fill: '#94a3b8' },
    { name: 'Em atraso',    value: atrasadas.length,                                  fill: '#ef4444' },
  ].filter(d => d.value > 0), [tasks, concluidas, emAndamento, atrasadas])

  const quarterData = useMemo(() => ['Q1','Q2','Q3','Q4'].map(q => ({
    q,
    total:  tasks.filter(t => t.prioridade === q).length,
    done:   tasks.filter(t => t.prioridade === q && t.estado === 'Concluído').length,
    late:   tasks.filter(t => t.prioridade === q && t.estado === 'Em atraso').length,
  })), [tasks])

  const barData = useMemo(() => ['Q1','Q2','Q3','Q4','Ongoing'].map(q => ({
    name: q,
    'Concluído':    tasks.filter(t => t.prioridade === q && t.estado === 'Concluído').length,
    'Em andamento': tasks.filter(t => t.prioridade === q && t.estado === 'Em andamento').length,
    'Por iniciar':  tasks.filter(t => t.prioridade === q && t.estado === 'Por iniciar').length,
    'Em atraso':    tasks.filter(t => t.prioridade === q && t.estado === 'Em atraso').length,
  })), [tasks])

  const checkDone  = checklist.filter(c => c.done).length
  const checkTotal = checklist.length

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="p-6 space-y-4">

      {/* ── KPIs ─────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-5 gap-3">
        <KpiCard label="Total Ações"        value={tasks.length}       sub={`plano ${curYear}`}       color="blue" />
        <KpiCard label="Taxa de Conclusão"  value={`${conformidade}%`} sub={`${concluidas} concluídas`} color="green" trend="up" />
        <KpiCard label="Em Andamento"       value={emAndamento}        sub="em progresso"             color="blue"  trend="neutral" />
        <KpiCard label="Em Atraso"          value={atrasadas.length}   sub="requerem atenção"         color="red"   trend={atrasadas.length > 0 ? 'down' : 'up'} />
        <KpiCard label="Riscos Críticos/Altos" value={criticos + altos} sub={`${criticos} críticos · ${altos} altos`} color="amber" trend="neutral" />
      </div>

      {/* ── Alert strip ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        <div onClick={() => setPage('pbcft')}
          className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 cursor-pointer hover:bg-amber-100 transition-colors flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-amber-200 flex items-center justify-center shrink-0">
            <AlertTriangle size={16} className="text-amber-700"/>
          </div>
          <div>
            <div className="text-[11px] font-semibold text-amber-700 uppercase tracking-wide">KYC Pendente</div>
            <div className="text-[22px] font-bold text-amber-800 leading-tight">{kycPendentes}</div>
            <div className="text-[10px] text-amber-600">clientes aguardam análise</div>
          </div>
        </div>
        <div onClick={() => setPage('riscos')}
          className="bg-red-50 border border-red-200 rounded-xl p-3.5 cursor-pointer hover:bg-red-100 transition-colors flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-red-200 flex items-center justify-center shrink-0">
            <Flame size={16} className="text-red-700"/>
          </div>
          <div>
            <div className="text-[11px] font-semibold text-red-700 uppercase tracking-wide">Riscos F4</div>
            <div className="text-[22px] font-bold text-red-800 leading-tight">{criticos}</div>
            <div className="text-[10px] text-red-600">requerem ação imediata</div>
          </div>
        </div>
        <div onClick={() => setPage('rgpd')}
          className="bg-blue-50 border border-blue-200 rounded-xl p-3.5 cursor-pointer hover:bg-blue-100 transition-colors flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-200 flex items-center justify-center shrink-0">
            <TrendingUp size={16} className="text-blue-700"/>
          </div>
          <div>
            <div className="text-[11px] font-semibold text-blue-700 uppercase tracking-wide">Checklist RGPD</div>
            <div className="text-[22px] font-bold text-blue-800 leading-tight">{checkDone}<span className="text-[14px] font-normal text-blue-400">/{checkTotal}</span></div>
            <div className="text-[10px] text-blue-600">itens concluídos</div>
          </div>
        </div>
      </div>

      {/* ── Mês actual + Charts ───────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-4">
        {/* Tasks do mês */}
        <div className="card col-span-2">
          <SectionHead
            icon={<CalendarDays size={14} className="text-blue-500"/>}
            title={`Ações de ${monthLabel} ${curYear}`}
            action="Ver plano completo"
            onAction={() => setPage('compliance')}
          />
          {monthTasks.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-gray-300">
              <CheckCircle2 size={28} className="mb-2"/>
              <p className="text-[12px] text-gray-400">Sem ações pendentes em {monthLabel}</p>
            </div>
          ) : (
            <div className="space-y-1.5 max-h-[260px] overflow-y-auto pr-1">
              {monthTasks.map(t => {
                const days   = daysUntil(t._date)
                const colors = urgencyColor(days)
                return (
                  <div key={t.id}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg ${colors.bg} cursor-pointer hover:opacity-90 transition-opacity`}
                    onClick={() => setPage('compliance')}>
                    <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${colors.dot}`}/>
                    <div className="flex-1 min-w-0">
                      <p className={`text-[11px] font-semibold truncate ${colors.text}`}>{t.tarefa}</p>
                      <p className="text-[10px] text-gray-400">{t.tematica} · {t.responsavel}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <Badge variant={estadoVariant(t.estado)} className="text-[9px]">{t.estado}</Badge>
                      <p className={`text-[9px] mt-0.5 font-mono ${colors.text}`}>
                        {days < 0 ? `${Math.abs(days)}d atraso` : days === 0 ? 'hoje' : `${days}d`}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Right column: donut + quarter bars */}
        <div className="space-y-4">
          {/* Estado donut */}
          <div className="card p-4">
            <p className="text-[11px] font-semibold text-gray-600 mb-2">Estado Geral do Plano</p>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={140}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" cx="50%" cy="50%"
                    innerRadius={38} outerRadius={58} paddingAngle={3}>
                    {pieData.map((entry, i) => <Cell key={i} fill={entry.fill}/>)}
                  </Pie>
                  <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e5e7eb' }}/>
                </PieChart>
              </ResponsiveContainer>
            ) : null}
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 mt-1">
              {pieData.map(d => (
                <div key={d.name} className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ background: d.fill }}/>
                  <span className="text-[9px] text-gray-500 truncate">{d.name}</span>
                  <span className="text-[9px] font-bold text-gray-700 ml-auto">{d.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Quarter progress */}
          <div className="card p-4">
            <p className="text-[11px] font-semibold text-gray-600 mb-3">Progresso por Quarter</p>
            <div className="space-y-2.5">
              {quarterData.map(q => (
                <QuarterBar key={q.q} label={q.q} total={q.total} done={q.done}
                  color={q.q==='Q1'?'#3b82f6':q.q==='Q2'?'#8b5cf6':q.q==='Q3'?'#f59e0b':'#10b981'}/>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Bar chart full width ──────────────────────────────────────────── */}
      <div className="card p-4">
        <p className="text-[12px] font-semibold text-gray-700 mb-3">Distribuição de Ações por Quarter e Estado</p>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={barData} barSize={22} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false}/>
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false}/>
            <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} allowDecimals={false}/>
            <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e5e7eb' }} cursor={{ fill: '#f8fafc' }}/>
            <Bar dataKey="Concluído"    stackId="a" fill="#10b981"/>
            <Bar dataKey="Em andamento" stackId="a" fill="#3b82f6"/>
            <Bar dataKey="Por iniciar"  stackId="a" fill="#94a3b8"/>
            <Bar dataKey="Em atraso"    stackId="a" fill="#ef4444" radius={[4,4,0,0]}/>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ── Bottom grid: próximas + riscos ───────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4">
        {/* Próximas ações */}
        <div className="card">
          <SectionHead
            icon={<Clock size={14} className="text-amber-500"/>}
            title="Próximas Ações (60 dias)"
            action="Ver plano"
            onAction={() => setPage('compliance')}
          />
          {upcomingTasks.length === 0 ? (
            <p className="text-[11px] text-gray-400 py-4 text-center">Sem ações nos próximos 60 dias</p>
          ) : (
            <div className="space-y-1">
              {upcomingTasks.map(t => {
                const days   = daysUntil(t._date)
                const colors = urgencyColor(days)
                return (
                  <div key={t.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 cursor-pointer" onClick={() => setPage('compliance')}>
                    <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${colors.dot}`}/>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-medium text-gray-800 truncate">{t.tarefa}</p>
                      <p className="text-[9px] text-gray-400">{t.tematica} · {t.responsavel}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className={`text-[10px] font-semibold ${colors.text}`}>{t.prazo}</p>
                      <p className={`text-[9px] ${colors.text}`}>{days}d</p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Top riscos */}
        <div className="card">
          <SectionHead
            icon={<XCircle size={14} className="text-red-500"/>}
            title="Riscos Críticos e Altos"
            action="Ver todos"
            onAction={() => setPage('riscos')}
          />
          {topRisks.length === 0 ? (
            <p className="text-[11px] text-gray-400 py-4 text-center">Sem riscos críticos ou altos</p>
          ) : (
            <div className="space-y-1">
              {topRisks.map(r => {
                const score = Number(r.probabilidade) * Number(r.impacto)
                const isF4  = r.estado === 'F4'
                return (
                  <div key={r.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 cursor-pointer" onClick={() => setPage('riscos')}>
                    <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${isF4 ? 'bg-red-500' : 'bg-amber-400'}`}/>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-medium text-gray-800 truncate">{r.risco}</p>
                      <p className="text-[9px] text-gray-400">{r.categoria} · {r.responsavel}</p>
                    </div>
                    <div className="shrink-0 flex items-center gap-2">
                      <span className={`text-[11px] font-bold ${isF4 ? 'text-red-600' : 'text-amber-600'}`}>{score}</span>
                      <Badge variant={estadoVariant(r.estado)} className="text-[9px]">{r.estado}</Badge>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Tasks em atraso ──────────────────────────────────────────────── */}
      {atrasadas.length > 0 && (
        <div className="card">
          <SectionHead
            icon={<AlertTriangle size={14} className="text-red-500"/>}
            title={`Tarefas em Atraso (${atrasadas.length})`}
            action="Ver plano completo"
            onAction={() => setPage('compliance')}
          />
          <table className="data-table w-full">
            <thead>
              <tr>
                <th>Ref.</th><th>Tarefa</th><th>Temática</th><th>Responsável</th><th>Prazo</th><th>Quarter</th><th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {atrasadas.slice(0, 8).map(t => (
                <tr key={t.id} className="cursor-pointer" onClick={() => setPage('compliance')}>
                  <td className="text-gray-400 font-mono text-[11px]">{t.id}</td>
                  <td className="font-medium max-w-[200px]"><div className="truncate" title={t.tarefa}>{t.tarefa}</div></td>
                  <td className="text-gray-500 text-[11px]">{t.tematica}</td>
                  <td>{t.responsavel}</td>
                  <td className="text-red-600 font-medium font-mono text-[11px]">{t.prazo}</td>
                  <td><Badge variant={prioVariant(t.prioridade)}>{t.prioridade}</Badge></td>
                  <td><Badge variant={estadoVariant(t.estado)}>{t.estado}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

    </div>
  )
}
