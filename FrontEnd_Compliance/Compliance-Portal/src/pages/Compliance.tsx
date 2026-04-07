import { useState, useRef, useMemo, useEffect } from 'react'
import {
  Plus, Pencil, Trash2, Download, Upload, PlusCircle,
  ChevronLeft, Clock, X, Search, SlidersHorizontal, CalendarDays,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, Cell, PieChart, Pie,
} from 'recharts'
import { read, utils } from 'xlsx'
import { Badge, prioVariant, estadoVariant } from '@/components/ui/Badge'
import { KpiCard } from '@/components/ui/KpiCard'
import { useStore } from '@/store/useStore'
import { useExport } from '@/hooks/useExport'
import type { ComplianceTask } from '@/types'

// ─── Year persistence ────────────────────────────────────────────────────────
const API_YEARS = 'http://localhost:3001/api/comp/comp_available_years'
async function loadYears(): Promise<number[]> {
  try {
    const res = await fetch(API_YEARS)
    if (!res.ok) throw new Error()
    const rows: { id: string; data: { year: number } }[] = await res.json()
    if (rows.length > 0) return rows.map(r => r.data.year).sort((a, b) => a - b)
  } catch {}
  return [2026]
}
async function saveYears(years: number[]): Promise<void> {
  try {
    // Bulk replace: delete all and re-insert
    await fetch(`${API_YEARS}/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows: years.map(y => ({ id: String(y), data: { year: y } })) }),
    })
  } catch {}
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function getTaskYear(t: ComplianceTask): number {
  if (t.ano) return t.ano
  const m = t.prazo?.match(/\b(20\d{2})\b/)
  return m ? parseInt(m[1]) : 2026
}
function groupByTematica(tasks: ComplianceTask[]) {
  const map = new Map<string, ComplianceTask[]>()
  for (const t of tasks) {
    const key = t.tematica || '—'
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(t)
  }
  return map
}
function col(row: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const found = Object.keys(row).find(r => r.toLowerCase().replace(/[^a-z]/g, '') === k.toLowerCase().replace(/[^a-z]/g, ''))
    if (found && String(row[found]).trim()) return String(row[found]).trim()
  }
  return ''
}
// DD.MM.YYYY ↔ YYYY-MM-DD for <input type="date">
function toInputDate(s: string): string {
  const m = s?.match(/^(\d{2})\.(\d{2})\.(\d{4})$/)
  return m ? `${m[3]}-${m[2]}-${m[1]}` : s ?? ''
}
function fromInputDate(s: string): string {
  const m = s?.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  return m ? `${m[3]}.${m[2]}.${m[1]}` : s ?? ''
}
// Parse prazo for calendar (supports DD.MM.YYYY and YYYY-MM-DD)
function parsePrazoDate(prazo: string): Date | null {
  if (!prazo) return null
  const m1 = prazo.match(/^(\d{2})\.(\d{2})\.(\d{4})$/)
  if (m1) return new Date(+m1[3], +m1[2] - 1, +m1[1])
  const m2 = prazo.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (m2) return new Date(+m2[1], +m2[2] - 1, +m2[3])
  return null
}
const MONTH_NAMES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

const EMPTY_TASK = (ano: number, prioridade: ComplianceTask['prioridade'] = 'Q1'): Omit<ComplianceTask, 'id'> => ({
  ano, tematica: '', tarefa: '', responsavel: '',
  prioridade, prazo: '', periodicidade: 'Pontual',
  estado: 'Por iniciar', descritivo: '', observacoes: '',
})

// ─── Colour palette ───────────────────────────────────────────────────────────
const PALETTE = [
  { bg: '#1d4e89', light: '#dbeafe', text: '#1d4e89' },
  { bg: '#2d6a4f', light: '#d1fae5', text: '#2d6a4f' },
  { bg: '#7b2d8b', light: '#f3e8ff', text: '#7b2d8b' },
  { bg: '#9c4221', light: '#ffedd5', text: '#9c4221' },
  { bg: '#1a535c', light: '#ccfbf1', text: '#1a535c' },
  { bg: '#374151', light: '#f3f4f6', text: '#374151' },
  { bg: '#92400e', light: '#fef3c7', text: '#92400e' },
  { bg: '#065f46', light: '#d1fae5', text: '#065f46' },
  { bg: '#1e3a5f', light: '#dbeafe', text: '#1e3a5f' },
  { bg: '#6b21a8', light: '#ede9fe', text: '#6b21a8' },
]

const QUARTER_COLS: { key: ComplianceTask['prioridade']; label: string; color: string; border: string; bg: string }[] = [
  { key: 'Q1', label: 'Q1 — Jan–Mar', color: '#3b82f6', border: 'border-t-blue-500',   bg: 'bg-blue-50'   },
  { key: 'Q2', label: 'Q2 — Abr–Jun', color: '#8b5cf6', border: 'border-t-violet-500', bg: 'bg-violet-50' },
  { key: 'Q3', label: 'Q3 — Jul–Set', color: '#f59e0b', border: 'border-t-amber-500',  bg: 'bg-amber-50'  },
  { key: 'Q4', label: 'Q4 — Out–Dez', color: '#10b981', border: 'border-t-emerald-500',bg: 'bg-emerald-50' },
  { key: 'Ongoing', label: 'Ongoing',  color: '#6b7280', border: 'border-t-gray-400',   bg: 'bg-gray-50'   },
]

const ESTADO_COLORS: Record<ComplianceTask['estado'], string> = {
  'Concluído':    '#10b981',
  'Em andamento': '#3b82f6',
  'Por iniciar':  '#94a3b8',
  'Em atraso':    '#ef4444',
}

// ─── Kanban task card ─────────────────────────────────────────────────────────
function KanbanCard({ task, groupKeys, canEdit, onEdit, onDelete, onDragStart }: {
  task: ComplianceTask; groupKeys: string[]; canEdit: boolean
  onEdit: () => void; onDelete: () => void; onDragStart: (id: string) => void
}) {
  const gi  = groupKeys.indexOf(task.tematica)
  const pal = PALETTE[(gi >= 0 ? gi : 0) % PALETTE.length]
  return (
    <div
      draggable={canEdit}
      onDragStart={e => { if (canEdit) { onDragStart(task.id); e.dataTransfer.effectAllowed = 'move' } }}
      className="bg-white rounded-xl border border-gray-200 shadow-sm p-3 space-y-2 hover:shadow-md transition-shadow cursor-grab active:cursor-grabbing active:opacity-60"
    >
      {/* temática pill + estado */}
      <div className="flex items-start justify-between gap-1">
        <span className="inline-block px-1.5 py-0.5 rounded-full text-[9px] font-bold leading-tight"
          style={{ background: pal.light, color: pal.text }}>
          {task.tematica || '—'}
        </span>
        <Badge variant={estadoVariant(task.estado)} className="text-[9px] shrink-0">{task.estado}</Badge>
      </div>

      {/* title */}
      <p className="text-[11px] font-semibold text-gray-800 leading-snug line-clamp-2" title={task.tarefa}>
        {task.tarefa}
      </p>

      {/* footer */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[10px] text-gray-400">
          {task.responsavel && <span className="bg-gray-100 rounded px-1 py-0.5 text-gray-600">{task.responsavel}</span>}
          {task.prazo && <span className="font-mono">{task.prazo}</span>}
        </div>
        {canEdit && (
          <div className="flex gap-0.5 opacity-0 group-hover:opacity-100">
            <button onClick={e => { e.stopPropagation(); onEdit() }}
              className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-blue-600"><Pencil size={10}/></button>
            <button onClick={e => { e.stopPropagation(); onDelete() }}
              className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-red-500"><Trash2 size={10}/></button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Task modal (shared) ──────────────────────────────────────────────────────
function TaskModal({ form, setForm, groupKeys, onSave, onClose, title }: {
  form: Omit<ComplianceTask, 'id'>
  setForm: (f: Omit<ComplianceTask, 'id'>) => void
  groupKeys: string[]; onSave: () => void; onClose: () => void; title: string
}) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl border border-gray-200 p-5 w-[600px] max-h-[85vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <span className="text-[14px] font-semibold text-gray-900">{title}</span>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={16}/></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="form-label">Temática</label>
            <input className="form-input" value={form.tematica} onChange={e => setForm({...form, tematica: e.target.value})}
              list="tematicas-dl" placeholder="ex: Políticas, Procedimentos…"/>
            <datalist id="tematicas-dl">{groupKeys.map(g => <option key={g} value={g}/>)}</datalist>
          </div>
          <div>
            <label className="form-label">Ação</label>
            <input className="form-input" value={form.tarefa} onChange={e => setForm({...form, tarefa: e.target.value})}/>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">Responsável</label>
              <input className="form-input" value={form.responsavel} onChange={e => setForm({...form, responsavel: e.target.value})}/>
            </div>
            <div>
              <label className="form-label">Quarter</label>
              <select className="form-input" value={form.prioridade} onChange={e => setForm({...form, prioridade: e.target.value as ComplianceTask['prioridade']})}>
                <option>Q1</option><option>Q2</option><option>Q3</option><option>Q4</option><option>Ongoing</option>
              </select>
            </div>
            <div>
              <label className="form-label">Data de Referência</label>
              <input type="date" className="form-input" value={toInputDate(form.prazo)}
                onChange={e => setForm({...form, prazo: fromInputDate(e.target.value)})}/>
            </div>
            <div>
              <label className="form-label">Periodicidade</label>
              <select className="form-input" value={form.periodicidade} onChange={e => setForm({...form, periodicidade: e.target.value})}>
                <option>Pontual</option><option>Anual</option><option>Semestral</option>
                <option>Trimestral</option><option>Mensal</option><option>Semanal</option><option>Ongoing</option><option>Ver prazo</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="form-label">Estado</label>
              <select className="form-input" value={form.estado} onChange={e => setForm({...form, estado: e.target.value as ComplianceTask['estado']})}>
                <option>Em andamento</option><option>Por iniciar</option><option>Concluído</option><option>Em atraso</option>
              </select>
            </div>
          </div>
          <div>
            <label className="form-label">Descritivo</label>
            <textarea className="form-input" rows={3} value={form.descritivo??''} onChange={e => setForm({...form, descritivo: e.target.value})}/>
          </div>
          <div>
            <label className="form-label">Observações</label>
            <textarea className="form-input" rows={2} value={form.observacoes??''} onChange={e => setForm({...form, observacoes: e.target.value})}/>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-gray-200">
          <button onClick={onClose} className="btn btn-outline btn-sm">Cancelar</button>
          <button onClick={onSave}  className="btn btn-primary btn-sm">Guardar</button>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// Main component
// ═══════════════════════════════════════════════════════════════════════════════
export function Compliance() {
  const { tasks, addTask, updateTask, deleteTask, importTasks } = useStore()
  const { exportToExcel, exportToPDF } = useExport()

  const [availableYears, setAvailableYears] = useState<number[]>([2026])
  const [selectedYear, setSelectedYear]     = useState<number>(2026)

  useEffect(() => {
    loadYears().then(years => {
      setAvailableYears(years)
      setSelectedYear(years[years.length - 1] ?? 2026)
    })
  }, [])

  const [tab, setTab]     = useState<'plano' | 'trimestral' | 'reportes'>('plano')
  const [modal, setModal] = useState<{ open: boolean; task: ComplianceTask | null; defaultQ?: ComplianceTask['prioridade'] }>({ open: false, task: null })
  const [form, setForm]   = useState<Omit<ComplianceTask, 'id'>>(EMPTY_TASK(selectedYear))
  const [importing, setImporting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // ── Table filters ─────────────────────────────────────────────────────────
  type KpiFilter = 'total' | 'andamento' | 'atraso' | 'concluidas' | null
  const [kpiFilter,        setKpiFilter]        = useState<KpiFilter>(null)
  const [filterSearch,     setFilterSearch]     = useState('')
  const [filterTematica,   setFilterTematica]   = useState('')
  const [filterQuarter,    setFilterQuarter]    = useState('')
  const [filterEstado,     setFilterEstado]     = useState('')

  const clearFilters = () => { setKpiFilter(null); setFilterSearch(''); setFilterTematica(''); setFilterQuarter(''); setFilterEstado('') }
  const hasFilters = !!(kpiFilter || filterSearch || filterTematica || filterQuarter || filterEstado)

  // Drag-to-scroll (table)
  const tableRef  = useRef<HTMLDivElement>(null)
  const dragState = useRef({ active: false, startX: 0, scrollLeft: 0 })
  function onMouseDown(e: React.MouseEvent<HTMLDivElement>) {
    dragState.current = { active: true, startX: e.pageX - (tableRef.current?.offsetLeft ?? 0), scrollLeft: tableRef.current?.scrollLeft ?? 0 }
    if (tableRef.current) tableRef.current.style.cursor = 'grabbing'
  }
  function onMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (!dragState.current.active) return; e.preventDefault()
    const x = e.pageX - (tableRef.current?.offsetLeft ?? 0)
    if (tableRef.current) tableRef.current.scrollLeft = dragState.current.scrollLeft - (x - dragState.current.startX) * 1.5
  }
  function onMouseUp() { dragState.current.active = false; if (tableRef.current) tableRef.current.style.cursor = 'grab' }
  function scrollTable(dir: 'left' | 'right') { tableRef.current?.scrollBy({ left: dir === 'left' ? -320 : 320, behavior: 'smooth' }) }

  // Kanban drag & drop
  const dragId      = useRef<string | null>(null)
  const [dragOverQ, setDragOverQ] = useState<string | null>(null)

  const [calendarOpen, setCalendarOpen] = useState(false)

  // Year management
  const addNextYear = () => {
    const next = Math.max(...availableYears) + 1
    const updated = [...availableYears, next]
    setAvailableYears(updated); void saveYears(updated); setSelectedYear(next)
  }
  const deleteYear = (y: number) => {
    const count = tasks.filter(t => getTaskYear(t) === y).length
    const msg = count > 0
      ? `Apagar o ano ${y} e todas as ${count} ações associadas? Esta ação é irreversível.`
      : `Apagar o ano ${y}? Esta ação é irreversível.`
    if (!confirm(msg)) return
    const updated = availableYears.filter(x => x !== y)
    setAvailableYears(updated); void saveYears(updated)
    if (selectedYear === y) setSelectedYear(updated[updated.length - 1] ?? 2026)
    if (count > 0) importTasks([], y)
  }

  // Derived data
  const yearTasks = useMemo(() => tasks.filter(t => getTaskYear(t) === selectedYear), [tasks, selectedYear])
  const grouped   = useMemo(() => groupByTematica(yearTasks), [yearTasks])
  const groupKeys = useMemo(() => Array.from(grouped.keys()), [grouped])

  const filteredTasks = useMemo(() => {
    let list = yearTasks
    if (kpiFilter === 'andamento')  list = list.filter(t => t.estado === 'Em andamento')
    if (kpiFilter === 'atraso')     list = list.filter(t => t.estado === 'Em atraso')
    if (kpiFilter === 'concluidas') list = list.filter(t => t.estado === 'Concluído')
    if (filterTematica) list = list.filter(t => t.tematica === filterTematica)
    if (filterQuarter)  list = list.filter(t => t.prioridade === filterQuarter)
    if (filterEstado)   list = list.filter(t => t.estado === filterEstado)
    if (filterSearch) {
      const q = filterSearch.toLowerCase()
      list = list.filter(t =>
        t.tarefa.toLowerCase().includes(q) ||
        t.responsavel.toLowerCase().includes(q) ||
        (t.descritivo ?? '').toLowerCase().includes(q) ||
        (t.observacoes ?? '').toLowerCase().includes(q) ||
        t.tematica.toLowerCase().includes(q)
      )
    }
    return list
  }, [yearTasks, kpiFilter, filterSearch, filterTematica, filterQuarter, filterEstado])

  // Chart data
  const chartData = useMemo(() => QUARTER_COLS.map(q => ({
    name: q.key,
    'Concluído':    yearTasks.filter(t => t.prioridade === q.key && t.estado === 'Concluído').length,
    'Em andamento': yearTasks.filter(t => t.prioridade === q.key && t.estado === 'Em andamento').length,
    'Por iniciar':  yearTasks.filter(t => t.prioridade === q.key && t.estado === 'Por iniciar').length,
    'Em atraso':    yearTasks.filter(t => t.prioridade === q.key && t.estado === 'Em atraso').length,
    total:          yearTasks.filter(t => t.prioridade === q.key).length,
  })), [yearTasks])

  const pieData = useMemo(() => [
    { name: 'Concluído',    value: yearTasks.filter(t => t.estado === 'Concluído').length,    fill: '#10b981' },
    { name: 'Em andamento', value: yearTasks.filter(t => t.estado === 'Em andamento').length, fill: '#3b82f6' },
    { name: 'Por iniciar',  value: yearTasks.filter(t => t.estado === 'Por iniciar').length,  fill: '#94a3b8' },
    { name: 'Em atraso',    value: yearTasks.filter(t => t.estado === 'Em atraso').length,    fill: '#ef4444' },
  ].filter(d => d.value > 0), [yearTasks])

  // Calendar: tasks bucketed by month index
  const calendarTasks = useMemo(() => {
    const months: ComplianceTask[][] = Array.from({ length: 12 }, () => [])
    for (const t of yearTasks) {
      const d = parsePrazoDate(t.prazo)
      if (d && d.getFullYear() === selectedYear) months[d.getMonth()].push(t)
    }
    return months
  }, [yearTasks, selectedYear])

  // Modal helpers
  const openAdd = (defaultQ?: ComplianceTask['prioridade']) => {
    setForm(EMPTY_TASK(selectedYear, defaultQ)); setModal({ open: true, task: null, defaultQ })
  }
  const openEdit = (t: ComplianceTask) => { setForm({ ...t }); setModal({ open: true, task: t }) }
  const closeModal = () => setModal({ open: false, task: null })
  const handleSave = () => {
    const data = { ...form, ano: selectedYear }
    if (modal.task) updateTask(modal.task.id, data); else addTask(data)
    closeModal()
  }

  // Excel import
  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    setImporting(true)
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const wb   = read(ev.target?.result, { type: 'array' })
        const ws   = wb.Sheets[wb.SheetNames[0]]
        const rows = utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' })
        let counter = tasks.length
        const mapped: ComplianceTask[] = rows
          .filter(r => col(r,'tarefa','acao','ação','action').length > 0)
          .map(r => {
            counter++
            const estado = col(r,'estado','status')
            const prio   = col(r,'prioridade','priority','prio','quarter')
            return {
              id: `PAC-${String(counter).padStart(3,'0')}`, ano: selectedYear,
              tematica:      col(r,'tematica','temática','area','área','tema'),
              tarefa:        col(r,'tarefa','acao','ação','action','task'),
              responsavel:   col(r,'responsavel','responsável','resp'),
              prioridade:    (['Q1','Q2','Q3','Q4','Ongoing'].includes(prio)?prio:'Q1') as ComplianceTask['prioridade'],
              prazo:         col(r,'prazo','data','deadline','datareferencia'),
              periodicidade: col(r,'periodicidade','frequency')||'Pontual',
              estado:        (['Em andamento','Por iniciar','Concluído','Em atraso'].includes(estado)?estado:'Por iniciar') as ComplianceTask['estado'],
              descritivo:    col(r,'descritivo','description','desc'),
              observacoes:   col(r,'observacoes','observações','notes','obs'),
            }
          })
        importTasks(mapped, selectedYear)
        alert(`${mapped.length} ações importadas para ${selectedYear}.`)
      } catch (err) { console.error(err); alert('Erro ao importar.') }
      finally { setImporting(false); if (fileRef.current) fileRef.current.value = '' }
    }
    reader.readAsArrayBuffer(file)
  }

  const handleExportExcel = () => exportToExcel(
    yearTasks.map(t => ({ Ref:t.id, Ano:selectedYear, Temática:t.tematica, Ação:t.tarefa, Responsável:t.responsavel, Prioridade:t.prioridade, 'Data Ref.':t.prazo, Periodicidade:t.periodicidade, Estado:t.estado, Descritivo:t.descritivo??'', Observações:t.observacoes??'' })),
    `plano-anual-compliance-${selectedYear}`
  )
  const handleExportPDF = () => exportToPDF(
    `Plano Anual de Compliance ${selectedYear}`,
    ['Ref','Temática','Ação','Responsável','Prioridade','Data Ref.','Periodicidade','Estado'],
    yearTasks.map(t => [t.id, t.tematica, t.tarefa, t.responsavel, t.prioridade, t.prazo, t.periodicidade, t.estado]),
    `plano-anual-compliance-${selectedYear}`
  )

  const concluidas  = yearTasks.filter(t => t.estado === 'Concluído').length
  const emAndamento = yearTasks.filter(t => t.estado === 'Em andamento').length
  const atrasadas   = yearTasks.filter(t => t.estado === 'Em atraso').length

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 space-y-4">
      {/* Year selector */}
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mr-1">Ano</span>
        {availableYears.map(y => (
          <div key={y} className="relative group">
            <button onClick={() => setSelectedYear(y)}
              className={`px-3 py-1 pr-6 rounded-lg text-[12px] font-semibold border transition-colors ${
                selectedYear === y ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:border-blue-400 hover:text-blue-600'
              }`}>{y}</button>
            {availableYears.length > 1 && (
              <button
                onClick={e => { e.stopPropagation(); deleteYear(y) }}
                className={`absolute right-1 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity ${
                  selectedYear === y ? 'text-white/70 hover:text-white' : 'text-gray-400 hover:text-red-500'
                }`}
                title={`Apagar ano ${y}`}>
                <X size={9}/>
              </button>
            )}
          </div>
        ))}
        <button onClick={addNextYear}
          className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] text-gray-400 border border-dashed border-gray-300 hover:border-blue-400 hover:text-blue-500 transition-colors">
          <PlusCircle size={13}/>{Math.max(...availableYears) + 1}
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-3">
        <KpiCard label="Total Ações"  value={yearTasks.length} sub={`plano ${selectedYear}`} color="blue"
          active={kpiFilter==='total'} onClick={() => { setTab('plano'); setKpiFilter(kpiFilter==='total'?null:'total') }}/>
        <KpiCard label="Em Andamento" value={emAndamento} sub="a decorrer" color="blue" trend="neutral"
          active={kpiFilter==='andamento'} onClick={() => { setTab('plano'); setKpiFilter(kpiFilter==='andamento'?null:'andamento') }}/>
        <KpiCard label="Em Atraso"    value={atrasadas}   sub="requerem atenção" color="red" trend="down"
          active={kpiFilter==='atraso'} onClick={() => { setTab('plano'); setKpiFilter(kpiFilter==='atraso'?null:'atraso') }}/>
        <KpiCard label="Concluídas"   value={concluidas}  sub={`${Math.round(concluidas/(yearTasks.length||1)*100)}% do total`} color="green" trend="up"
          active={kpiFilter==='concluidas'} onClick={() => { setTab('plano'); setKpiFilter(kpiFilter==='concluidas'?null:'concluidas') }}/>
      </div>

      {/* Tabs */}
      <div className="tab-list">
        <button data-state={tab==='plano'      ?'active':'inactive'} className="tab-trigger" onClick={()=>setTab('plano')}>Plano Anual</button>
        <button data-state={tab==='trimestral' ?'active':'inactive'} className="tab-trigger" onClick={()=>setTab('trimestral')}>Vista Trimestral</button>
        <button data-state={tab==='reportes'   ?'active':'inactive'} className="tab-trigger" onClick={()=>setTab('reportes')}>Reportes</button>
      </div>

      {/* ══════════════════ PLANO TAB ════════════════════════════════════════ */}
      {tab === 'plano' && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Plano Anual de Compliance {selectedYear}</span>
            <div className="flex gap-2">
              <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImportExcel}/>
              <button onClick={() => fileRef.current?.click()} disabled={importing} className="btn btn-outline btn-sm">
                <Upload size={12}/>{importing ? 'A importar…' : 'Importar Excel'}
              </button>
              <button onClick={handleExportExcel} className="btn btn-outline btn-sm"><Download size={12}/> Excel</button>
              <button onClick={handleExportPDF}   className="btn btn-outline btn-sm"><Download size={12}/> PDF</button>
              <button onClick={() => openAdd()} className="btn btn-primary btn-sm"><Plus size={12}/> Nova Ação</button>
            </div>
          </div>

          {/* ── Filter bar ─────────────────────────────────────────────────── */}
          <div className="px-4 pb-3 flex flex-wrap items-center gap-2 border-b border-gray-100">
            {/* Search */}
            <div className="relative flex-1 min-w-[180px]">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"/>
              <input
                className="w-full pl-7 pr-3 py-1.5 text-[11px] border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
                placeholder="Pesquisar ação, responsável, descritivo…"
                value={filterSearch}
                onChange={e => setFilterSearch(e.target.value)}
              />
            </div>
            {/* Temática */}
            <select value={filterTematica} onChange={e => setFilterTematica(e.target.value)}
              className="text-[11px] border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 text-gray-600">
              <option value="">Todas as temáticas</option>
              {groupKeys.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
            {/* Quarter */}
            <select value={filterQuarter} onChange={e => setFilterQuarter(e.target.value)}
              className="text-[11px] border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 text-gray-600">
              <option value="">Todos os quarters</option>
              <option>Q1</option><option>Q2</option><option>Q3</option><option>Q4</option><option>Ongoing</option>
            </select>
            {/* Estado */}
            <select value={filterEstado} onChange={e => setFilterEstado(e.target.value)}
              className="text-[11px] border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 text-gray-600">
              <option value="">Todos os estados</option>
              <option>Em andamento</option><option>Por iniciar</option><option>Concluído</option><option>Em atraso</option>
            </select>
            {/* Clear + count */}
            {hasFilters && (
              <button onClick={clearFilters}
                className="flex items-center gap-1 text-[10px] text-gray-500 border border-gray-200 rounded-lg px-2 py-1.5 hover:border-gray-400 hover:text-gray-700 transition-colors">
                <X size={10}/> Limpar filtros
              </button>
            )}
            <span className="text-[10px] text-gray-400 ml-auto flex items-center gap-1">
              <SlidersHorizontal size={10}/>
              {filteredTasks.length} / {yearTasks.length} ações
            </span>
          </div>

          {yearTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <Clock size={32} className="mb-3 opacity-25"/>
              <p className="text-[13px] font-medium text-gray-500 mb-1">Sem ações para {selectedYear}</p>
              <p className="text-[12px]">Importe um ficheiro Excel ou adicione manualmente.</p>
            </div>
          ) : filteredTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
              <Search size={28} className="mb-3 opacity-25"/>
              <p className="text-[12px] font-medium text-gray-500 mb-1">Nenhuma ação corresponde aos filtros</p>
              <button onClick={clearFilters} className="text-[11px] text-blue-500 hover:underline mt-1">Limpar filtros</button>
            </div>
          ) : (
            <div className="relative">
              <button onClick={() => scrollTable('left')}
                className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-3 z-10 bg-white border border-gray-200 rounded-full shadow-md p-1.5 hover:bg-gray-50">
                <ChevronLeft size={14} className="text-gray-500"/>
              </button>
              <button onClick={() => scrollTable('right')}
                className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-3 z-10 bg-white border border-gray-200 rounded-full shadow-md p-1.5 hover:bg-gray-50">
                <ChevronLeft size={14} className="text-gray-500 rotate-180"/>
              </button>
              <div ref={tableRef}
                className="overflow-x-auto overflow-y-auto rounded-xl border border-gray-100 shadow-sm cursor-grab select-none"
                style={{ maxHeight: 'calc(100vh - 360px)' }}
                onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp}>
                <table className="w-full text-[11px] border-collapse" style={{ minWidth: 1280 }}>
                  <thead className="sticky top-0 z-10">
                    <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                      {([['Temática',130],['Ação',240],['Responsável',110],['Quarter',75],['Data Ref.',88],['Periodicidade',90],['Estado',105],['Descritivo',210],['Observações',190],['',56]] as [string,number][]).map(([l,w]) => (
                        <th key={l} className="px-3 py-2.5 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap" style={{ minWidth: w }}>{l}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTasks.map((t, ri) => {
                      const gi  = groupKeys.indexOf(t.tematica)
                      const pal = PALETTE[(gi >= 0 ? gi : 0) % PALETTE.length]
                      return (
                        <tr key={t.id} style={{ background: ri%2===0?'#fff':'#f9fafb', borderBottom:'1px solid #f1f5f9' }}
                          className="hover:bg-blue-50/40 transition-colors">
                          <td className="px-3 py-2.5">
                            <span className="inline-block px-2 py-0.5 rounded-full text-[9px] font-bold whitespace-nowrap"
                              style={{ background: pal.light, color: pal.text }}>{t.tematica}</span>
                          </td>
                          <td className="px-3 py-2.5 font-medium text-gray-800" style={{ maxWidth:240 }}>
                            <div className="line-clamp-2" title={t.tarefa}>{t.tarefa}</div>
                          </td>
                          <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{t.responsavel}</td>
                          <td className="px-3 py-2.5"><Badge variant={prioVariant(t.prioridade)}>{t.prioridade}</Badge></td>
                          <td className="px-3 py-2.5 font-mono text-[10px] text-gray-500 whitespace-nowrap">{t.prazo}</td>
                          <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">{t.periodicidade}</td>
                          <td className="px-3 py-2.5"><Badge variant={estadoVariant(t.estado)}>{t.estado}</Badge></td>
                          <td className="px-3 py-2.5 text-gray-600" style={{ maxWidth:210 }}>
                            {t.descritivo ? <span className="line-clamp-2" title={t.descritivo}>{t.descritivo}</span> : <span className="text-gray-200">—</span>}
                          </td>
                          <td className="px-3 py-2.5 text-gray-500" style={{ maxWidth:190 }}>
                            {t.observacoes ? <span className="line-clamp-2" title={t.observacoes}>{t.observacoes}</span> : <span className="text-gray-200">—</span>}
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="flex gap-1">
                              <button onClick={() => openEdit(t)} className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-blue-600"><Pencil size={11}/></button>
                              <button onClick={() => deleteTask(t.id)} className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-red-600"><Trash2 size={11}/></button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════ TRIMESTRAL TAB ══════════════════════════════════ */}
      {tab === 'trimestral' && (
        <div className="space-y-4">
          {/* Charts row */}
          <div className="grid grid-cols-3 gap-4">
            {/* Stacked bar chart */}
            <div className="card col-span-2 p-4">
              <p className="text-[12px] font-semibold text-gray-700 mb-3">Distribuição de Ações por Quarter</p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chartData} barSize={28} margin={{ top: 4, right: 16, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false}/>
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false}/>
                  <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} allowDecimals={false}/>
                  <Tooltip
                    contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e5e7eb', boxShadow: '0 4px 12px rgba(0,0,0,.08)' }}
                    cursor={{ fill: '#f8fafc' }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }}/>
                  <Bar dataKey="Concluído"    stackId="a" fill={ESTADO_COLORS['Concluído']}    radius={[0,0,0,0]}/>
                  <Bar dataKey="Em andamento" stackId="a" fill={ESTADO_COLORS['Em andamento']} radius={[0,0,0,0]}/>
                  <Bar dataKey="Por iniciar"  stackId="a" fill={ESTADO_COLORS['Por iniciar']}  radius={[0,0,0,0]}/>
                  <Bar dataKey="Em atraso"    stackId="a" fill={ESTADO_COLORS['Em atraso']}    radius={[4,4,0,0]}/>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Pie chart — overall status */}
            <div className="card p-4 flex flex-col">
              <p className="text-[12px] font-semibold text-gray-700 mb-1">Estado Geral {selectedYear}</p>
              <div className="flex-1 flex items-center justify-center">
                {pieData.length === 0 ? (
                  <p className="text-[11px] text-gray-300">Sem dados</p>
                ) : (
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%"
                        innerRadius={52} outerRadius={80} paddingAngle={3} label={({ name, percent }) => `${Math.round(percent*100)}%`}
                        labelLine={false}>
                        {pieData.map((entry, i) => <Cell key={i} fill={entry.fill}/>)}
                      </Pie>
                      <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e5e7eb' }}/>
                      <Legend wrapperStyle={{ fontSize: 11 }}/>
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>

          {/* Quarter summary pills */}
          <div className="grid grid-cols-5 gap-3">
            {QUARTER_COLS.map(q => {
              const qTasks = yearTasks.filter(t => t.prioridade === q.key)
              const done   = qTasks.filter(t => t.estado === 'Concluído').length
              const pct    = qTasks.length ? Math.round(done/qTasks.length*100) : 0
              return (
                <div key={q.key} className="card p-3 flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold" style={{ color: q.color }}>{q.key}</span>
                    <span className="text-[10px] text-gray-400">{qTasks.length} ações</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width:`${pct}%`, background: q.color }}/>
                  </div>
                  <p className="text-[9px] text-gray-400">{pct}% concluído · {qTasks.filter(t=>t.estado==='Em atraso').length} em atraso</p>
                </div>
              )
            })}
          </div>

          {/* Calendar toggle */}
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Calendário Anual</span>
            <button onClick={() => setCalendarOpen(v => !v)}
              className="flex items-center gap-1.5 text-[11px] text-gray-500 border border-gray-200 rounded-lg px-3 py-1.5 hover:border-blue-400 hover:text-blue-600 transition-colors bg-white">
              <CalendarDays size={12}/>{calendarOpen ? 'Ocultar' : 'Mostrar Calendário'}
            </button>
          </div>

          {/* Annual calendar */}
          {calendarOpen && (
            <div className="card p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-[12px] font-semibold text-gray-800">Calendário de Datas de Referência — {selectedYear}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">Ações posicionadas pela data de referência definida</p>
                </div>
              </div>
              <div className="overflow-x-auto">
                <div className="grid gap-1.5" style={{ gridTemplateColumns: 'repeat(12, minmax(90px, 1fr))', minWidth: 1100 }}>
                  {MONTH_NAMES.map((mName, mi) => {
                    const q = mi < 3 ? 'Q1' : mi < 6 ? 'Q2' : mi < 9 ? 'Q3' : 'Q4'
                    const qCol = QUARTER_COLS.find(x => x.key === q)!
                    const mTasks = calendarTasks[mi]
                    return (
                      <div key={mName} className="rounded-lg border border-gray-100 overflow-hidden flex flex-col">
                        <div className="px-2 py-1.5 text-center font-bold text-[10px] border-b border-gray-100"
                          style={{ background: qCol.color + '18', color: qCol.color }}>
                          {mName}
                          {mTasks.length > 0 && (
                            <span className="ml-1 inline-flex items-center justify-center w-3.5 h-3.5 rounded-full text-[8px] text-white"
                              style={{ background: qCol.color }}>{mTasks.length}</span>
                          )}
                        </div>
                        <div className="p-1.5 flex-1 space-y-0.5 min-h-[64px]">
                          {mTasks.length === 0 ? (
                            <div className="text-[9px] text-gray-200 text-center pt-3">—</div>
                          ) : mTasks.map(t => (
                            <button key={t.id} onClick={() => openEdit(t)} title={`${t.tarefa}\n${t.responsavel}`}
                              className="w-full text-left px-1.5 py-0.5 rounded text-[9px] font-medium truncate transition-opacity hover:opacity-70"
                              style={{ background: qCol.color + '22', color: qCol.color }}>
                              {t.tarefa}
                            </button>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
              {/* Quarter legend */}
              <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-100">
                {QUARTER_COLS.filter(q => q.key !== 'Ongoing').map(q => (
                  <div key={q.key} className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-sm" style={{ background: q.color }}/>
                    <span className="text-[10px] text-gray-500">{q.label}</span>
                  </div>
                ))}
                <span className="text-[10px] text-gray-400 ml-auto">
                  {calendarTasks.flat().length} de {yearTasks.length} ações com data de referência
                </span>
              </div>
            </div>
          )}

          {/* Kanban board */}
          <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}
            onDragEnd={() => { dragId.current = null; setDragOverQ(null) }}>
            {QUARTER_COLS.map(q => {
              const colTasks = yearTasks.filter(t => t.prioridade === q.key)
              const isOver   = dragOverQ === q.key
              return (
                <div key={q.key}
                  onDragOver={e => { e.preventDefault(); setDragOverQ(q.key) }}
                  onDragLeave={() => setDragOverQ(null)}
                  onDrop={e => {
                    e.preventDefault(); setDragOverQ(null)
                    if (!dragId.current) return
                    const id = dragId.current; dragId.current = null
                    const item = yearTasks.find(t => t.id === id)
                    if (!item || item.prioridade === q.key) return
                    updateTask(id, { prioridade: q.key })
                  }}
                  className={`rounded-xl border-t-4 transition-all ${q.border} ${isOver ? 'ring-2 ring-offset-1 shadow-lg' : ''}`}
                  style={{ background: isOver ? q.color+'15' : '#f9fafb', borderColor: undefined, minHeight: 200 }}
                >
                  {/* Column header */}
                  <div className="px-3 pt-3 pb-2 flex items-center justify-between">
                    <div>
                      <p className="text-[12px] font-bold" style={{ color: q.color }}>{q.key}</p>
                      <p className="text-[9px] text-gray-400">{q.label.split('—')[1]?.trim() ?? 'Recorrente'}</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full text-white" style={{ background: q.color }}>
                        {colTasks.length}
                      </span>
                      <button onClick={() => openAdd(q.key)}
                        className="w-5 h-5 rounded-full flex items-center justify-center text-gray-400 hover:text-white transition-colors hover:bg-opacity-90"
                        style={{ background: 'transparent' }}
                        onMouseEnter={e => (e.currentTarget.style.background = q.color)}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                        <Plus size={12}/>
                      </button>
                    </div>
                  </div>

                  {/* Cards */}
                  <div className="px-2 pb-3 space-y-2 group">
                    {colTasks.length === 0 ? (
                      <div className="border-2 border-dashed border-gray-200 rounded-xl p-4 text-center">
                        <p className="text-[10px] text-gray-300">Arraste ações aqui</p>
                      </div>
                    ) : (
                      colTasks.map(t => (
                        <KanbanCard key={t.id} task={t} groupKeys={groupKeys} canEdit
                          onDragStart={id => { dragId.current = id }}
                          onEdit={() => openEdit(t)}
                          onDelete={() => { if (confirm(`Eliminar "${t.tarefa}"?`)) deleteTask(t.id) }}
                        />
                      ))
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ══════════════════ REPORTES TAB ═════════════════════════════════════ */}
      {tab === 'reportes' && (
        <div className="card p-12 text-center">
          <div className="text-[13px] font-medium text-gray-700 mb-2">Reportes</div>
          <div className="text-[12px] text-gray-400 mb-4">Ficheiro de reportes a carregar.</div>
          <button className="btn btn-outline btn-sm">Carregar ficheiro</button>
        </div>
      )}

      {/* ══════════════════ MODAL ════════════════════════════════════════════ */}
      {modal.open && (
        <TaskModal
          form={form} setForm={setForm} groupKeys={groupKeys}
          onSave={handleSave} onClose={closeModal}
          title={modal.task ? 'Editar Ação' : `Nova Ação — ${selectedYear}`}
        />
      )}
    </div>
  )
}
