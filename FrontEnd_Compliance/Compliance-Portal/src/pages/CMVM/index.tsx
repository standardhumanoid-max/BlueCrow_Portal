import { useState, useMemo, useRef, useEffect } from 'react'
import { Plus, Pencil, Trash2, X, Search, CalendarDays, AlertTriangle, CheckCircle2, Clock, ChevronLeft, ChevronRight, Paperclip, Download, FileText, Mail } from 'lucide-react'
import clsx from 'clsx'

// ── Types ──────────────────────────────────────────────────────────────────────
type SuperEstado = 'Pendente' | 'Em curso' | 'Respondido' | 'Fechado'
type ComEstado   = 'Em preparação' | 'Enviada' | 'Pendente' | 'Arquivo'
type ComTipo     = 'Ofício' | 'Circular' | 'Carta' | 'Email' | 'Outra'

interface Supervisao {
  id: string
  identificacao: string
  data_comunicacao: string     // DD.MM.YYYY
  assunto: string
  detalhes: string
  responsaveis: string
  departamento: string
  resposta_bc: string
  data_resposta_bc: string     // DD.MM.YYYY
  data_limite: string          // DD.MM.YYYY
  estado: SuperEstado
  observacoes: string
}

// Comunicações associadas a uma supervisão específica (correspondência do processo)
interface SupComunicacao {
  id: string
  supervisao_id: string
  ref: string
  data: string          // DD.MM.YYYY
  tipo: ComTipo
  assunto: string
  responsavel: string
  estado: ComEstado
  observacoes: string
}

interface RespostaFicheiro {
  id: string
  name: string
  size: number
  mimeType: string
  dataUrl: string
}

interface Resposta {
  id: string
  supervisao_ids: string[]
  data: string          // DD.MM.YYYY
  descricao: string
  responsavel: string
  ficheiros: RespostaFicheiro[]
}

// Comunicações gerais enviadas à CMVM (separador próprio)
interface Comunicacao {
  id: string
  ref: string
  data: string
  tipo: ComTipo
  assunto: string
  destinatario: string
  responsavel: string
  estado: ComEstado
  observacoes: string
}

// ── API helpers ───────────────────────────────────────────────────────────────
import { API_BASE } from '@/lib/api'
const CMVM_API = `${API_BASE}/api/cmvm`

// Mapa: chave interna → path na nova API
const ENDPOINT: Record<string, string> = {
  cmvm_supervisoes:      'supervisoes',
  cmvm_sup_comunicacoes: 'sup-coms',
  cmvm_respostas:        'respostas',
  cmvm_comunicacoes:     'comunicacoes',
}

async function sbNativeLoad<T extends { id: string }>(table: string): Promise<T[]> {
  try {
    const res = await fetch(`${CMVM_API}/${ENDPOINT[table] ?? table}`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.json() as T[]
  } catch {
    return []
  }
}

async function sbNativeSave<T extends { id: string }>(table: string, items: T[]) {
  try {
    await fetch(`${CMVM_API}/${ENDPOINT[table] ?? table}/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows: items }),
    })
  } catch (e) { console.error(`[cmvm] save ${table}:`, e) }
}

async function sbNativeSaveOne<T extends { id: string }>(table: string, item: T) {
  try {
    await fetch(`${CMVM_API}/${ENDPOINT[table] ?? table}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item),
    })
  } catch (e) { console.error(`[cmvm] save-one ${table}:`, e) }
}

async function sbNativeDelete(table: string, id: string) {
  try {
    await fetch(`${CMVM_API}/${ENDPOINT[table] ?? table}/${id}`, { method: 'DELETE' })
  } catch (e) { console.error(`[cmvm] delete ${table}:`, e) }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function parseDate(s: string): Date | null {
  if (!s) return null
  const m = s.match(/^(\d{2})\.(\d{2})\.(\d{4})$/)
  if (m) return new Date(+m[3], +m[2] - 1, +m[1])
  const m2 = s.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (m2) return new Date(+m2[1], +m2[2] - 1, +m2[3])
  return null
}
function toInputDate(s: string): string {
  const m = s?.match(/^(\d{2})\.(\d{2})\.(\d{4})$/)
  return m ? `${m[3]}-${m[2]}-${m[1]}` : s ?? ''
}
function fromInputDate(s: string): string {
  const m = s?.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  return m ? `${m[3]}.${m[2]}.${m[1]}` : s ?? ''
}
function daysUntil(d: Date): number {
  return Math.ceil((d.getTime() - new Date().setHours(0,0,0,0)) / 86400000)
}

const SUPER_ESTADO_CLS: Record<SuperEstado, string> = {
  'Pendente':    'bg-amber-100 text-amber-700',
  'Em curso':    'bg-blue-100 text-blue-700',
  'Respondido':  'bg-green-100 text-green-700',
  'Fechado':     'bg-gray-100 text-gray-500',
}
const COM_ESTADO_CLS: Record<ComEstado, string> = {
  'Em preparação': 'bg-amber-100 text-amber-700',
  'Enviada':        'bg-green-100 text-green-700',
  'Pendente':       'bg-red-100 text-red-700',
  'Arquivo':        'bg-gray-100 text-gray-500',
}

const MONTH_PT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
const DAY_SHORT = ['Seg','Ter','Qua','Qui','Sex','Sáb','Dom']

// ── Calendar ──────────────────────────────────────────────────────────────────
function SupervisaoCalendar({ supervisoes, onSelectSup }: { supervisoes: Supervisao[]; onSelectSup?: (s: Supervisao) => void }) {
  const today = new Date(); today.setHours(0,0,0,0)
  const [calMonth, setCalMonth] = useState({ y: today.getFullYear(), m: today.getMonth() })

  type EvType = 'received' | 'deadline' | 'responded'
  type CalEv  = { type: EvType; sup: Supervisao }
  const eventsMap = useMemo(() => {
    const map = new Map<string, CalEv[]>()
    const add = (key: string, ev: CalEv) => { if (!map.has(key)) map.set(key, []); map.get(key)!.push(ev) }
    for (const s of supervisoes) {
      const dk = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
      const dr = parseDate(s.data_comunicacao); if (dr) add(dk(dr), { type: 'received',  sup: s })
      const dl = parseDate(s.data_limite);      if (dl) add(dk(dl), { type: 'deadline',  sup: s })
      const da = parseDate(s.data_resposta_bc); if (da) add(dk(da), { type: 'responded', sup: s })
    }
    return map
  }, [supervisoes])

  const upcoming4 = useMemo(() =>
    supervisoes
      .filter(s => s.estado !== 'Respondido' && s.estado !== 'Fechado' && s.data_limite)
      .map(s => ({ sup: s, date: parseDate(s.data_limite)! }))
      .filter(x => x.date)
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .slice(0, 4),
  [supervisoes])

  const { y, m } = calMonth
  const firstDay  = new Date(y, m, 1).getDay()
  const daysInMon = new Date(y, m + 1, 0).getDate()
  const startOff  = (firstDay + 6) % 7
  const cells: (number | null)[] = [...Array(startOff).fill(null), ...Array.from({ length: daysInMon }, (_, i) => i + 1)]
  while (cells.length % 7 !== 0) cells.push(null)
  const dk = (day: number) => `${y}-${m}-${day}`

  return (
    <div className="space-y-5">
      <div>
        <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-3">Próximos Prazos de Resposta</p>
        {upcoming4.length === 0 ? (
          <div className="bg-green-50 border border-green-100 rounded-xl px-4 py-3 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0"/>
            <span className="text-[12px] text-green-700">Sem prazos pendentes — todos os processos foram respondidos.</span>
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-3">
            {upcoming4.map(({ sup, date }, idx) => {
              const days = daysUntil(date)
              const isOverdue = days < 0
              const isUrgent  = days >= 0 && days <= 5
              return (
                <div key={sup.id} onClick={() => onSelectSup?.(sup)}
                  className={clsx('rounded-xl border-2 p-4 flex flex-col gap-2 relative transition-shadow',
                    onSelectSup && 'cursor-pointer hover:shadow-md',
                    isOverdue ? 'border-red-400 bg-red-50' : isUrgent ? 'border-orange-400 bg-orange-50' : idx === 0 ? 'border-blue-400 bg-blue-50' : 'border-gray-200 bg-white')}>
                  {idx === 0 && !isOverdue && <span className="absolute -top-2 left-3 text-[9px] font-bold bg-blue-600 text-white px-2 py-0.5 rounded-full">Mais próximo</span>}
                  {isOverdue && <span className="absolute -top-2 left-3 text-[9px] font-bold bg-red-600 text-white px-2 py-0.5 rounded-full">Em atraso</span>}
                  <div className="flex items-start justify-between gap-1">
                    <span className={clsx('text-[10px] font-bold px-1.5 py-0.5 rounded-full', isOverdue ? 'bg-red-200 text-red-700' : isUrgent ? 'bg-orange-200 text-orange-700' : 'bg-blue-100 text-blue-700')}>{sup.id}</span>
                    {isOverdue ? <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0"/> : isUrgent ? <AlertTriangle className="w-4 h-4 text-orange-500 flex-shrink-0"/> : <Clock className="w-4 h-4 text-blue-400 flex-shrink-0"/>}
                  </div>
                  <p className="text-[11px] font-semibold text-gray-800 leading-snug line-clamp-2">{sup.assunto}</p>
                  <div className="mt-auto">
                    <p className="text-[10px] text-gray-500">{sup.responsaveis}</p>
                    <p className={clsx('text-[13px] font-bold mt-0.5', isOverdue ? 'text-red-600' : isUrgent ? 'text-orange-600' : 'text-blue-700')}>{sup.data_limite}</p>
                    <p className={clsx('text-[10px] font-medium', isOverdue ? 'text-red-500' : isUrgent ? 'text-orange-500' : 'text-gray-400')}>
                      {isOverdue ? `${Math.abs(days)} dias em atraso` : days === 0 ? 'Hoje!' : `${days} dias restantes`}
                    </p>
                  </div>
                </div>
              )
            })}
            {Array.from({ length: Math.max(0, 4 - upcoming4.length) }).map((_, i) => (
              <div key={`empty-${i}`} className="rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 p-4 flex items-center justify-center">
                <span className="text-[11px] text-gray-300">—</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <button onClick={() => setCalMonth(({ y, m }) => m === 0 ? { y: y-1, m: 11 } : { y, m: m-1 })} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600"><ChevronLeft size={14}/></button>
          <p className="text-[13px] font-semibold text-gray-900">{MONTH_PT[m]} {y}</p>
          <button onClick={() => setCalMonth(({ y, m }) => m === 11 ? { y: y+1, m: 0 } : { y, m: m+1 })} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600"><ChevronRight size={14}/></button>
        </div>
        <div className="grid grid-cols-7 border-b border-gray-100">
          {DAY_SHORT.map(d => <div key={d} className="py-2 text-center text-[10px] font-semibold text-gray-400 uppercase tracking-wide">{d}</div>)}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((day, idx) => {
            if (!day) return <div key={idx} className="h-20 border-b border-r border-gray-50 last:border-r-0 bg-gray-50/30"/>
            const events = eventsMap.get(dk(day)) ?? []
            const isToday = today.getFullYear() === y && today.getMonth() === m && today.getDate() === day
            return (
              <div key={idx} className={clsx('h-20 border-b border-r border-gray-50 last:border-r-0 p-1.5 flex flex-col', isToday && 'bg-blue-50/40')}>
                <span className={clsx('text-[11px] font-semibold w-5 h-5 flex items-center justify-center rounded-full mb-0.5', isToday ? 'bg-blue-600 text-white' : 'text-gray-600')}>{day}</span>
                <div className="flex-1 space-y-0.5 overflow-hidden">
                  {events.map((ev, ei) => (
                    <div key={ei} onClick={e => { e.stopPropagation(); onSelectSup?.(ev.sup) }}
                      title={`${ev.sup.identificacao} — ${ev.sup.assunto}`}
                      className={clsx('text-[8px] font-medium px-1 py-0.5 rounded truncate leading-tight',
                        onSelectSup && 'cursor-pointer hover:opacity-70',
                        ev.type === 'received' ? 'bg-blue-100 text-blue-700'
                        : ev.type === 'deadline' ? (parseDate(ev.sup.data_limite)! < today ? 'bg-red-200 text-red-700' : 'bg-orange-100 text-orange-700')
                        : 'bg-green-100 text-green-700')}>
                      {ev.type === 'received' ? '↓' : ev.type === 'deadline' ? '⚑' : '✓'} {ev.sup.identificacao}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
        <div className="flex items-center gap-4 px-5 py-3 border-t border-gray-100 bg-gray-50">
          <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-blue-100 border border-blue-300 text-[8px] flex items-center justify-center text-blue-700">↓</span><span className="text-[10px] text-gray-500">Recebido</span></div>
          <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-orange-100 border border-orange-300 text-[8px] flex items-center justify-center text-orange-700">⚑</span><span className="text-[10px] text-gray-500">Prazo limite</span></div>
          <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-green-100 border border-green-300 text-[8px] flex items-center justify-center text-green-700">✓</span><span className="text-[10px] text-gray-500">Respondido</span></div>
        </div>
      </div>
    </div>
  )
}

// ── Empty forms ───────────────────────────────────────────────────────────────
const emptySup = (): Omit<Supervisao,'id'> => ({
  data_comunicacao:'', assunto:'', detalhes:'', identificacao:'',
  responsaveis:'', departamento:'', resposta_bc:'', data_resposta_bc:'', data_limite:'',
  estado:'Pendente', observacoes:'',
})
const emptyCom = (): Omit<Comunicacao,'id'> => ({
  ref:'', data:'', tipo:'Ofício', assunto:'', destinatario:'', responsavel:'', estado:'Em preparação', observacoes:'',
})
const emptySupCom = (supId = ''): Omit<SupComunicacao,'id'> => ({
  supervisao_id: supId, ref:'', data:'', tipo:'Ofício', assunto:'', responsavel:'', estado:'Em preparação', observacoes:'',
})
const emptyResp = (supId = ''): Omit<Resposta,'id'> => ({
  supervisao_ids: supId ? [supId] : [], data: '', descricao: '', responsavel: '', ficheiros: [],
})

// ══════════════════════════════════════════════════════════════════════════════
// Main CMVM component
// ══════════════════════════════════════════════════════════════════════════════
export function CMVM() {
  const [tab, setTab] = useState<'comunicacoes' | 'supervisoes'>('supervisoes')

  // ── Supervisões ───────────────────────────────────────────────────────────
  const [supervisoes, setSupervisoes] = useState<Supervisao[]>([])
  const [supModal, setSupModal]       = useState(false)
  const [supEditing, setSupEditing]   = useState<Supervisao | null>(null)
  const [supForm, setSupForm]         = useState(emptySup())
  const [supSearch, setSupSearch]     = useState('')
  const [supEstado, setSupEstado]     = useState('')
  const [showCal, setShowCal]         = useState(true)
  const [supSubTab, setSupSubTab]     = useState<'processos' | 'respostas'>('processos')

  // ── Detail drawer ─────────────────────────────────────────────────────────
  const [detailSup, setDetailSup]     = useState<Supervisao | null>(null)
  const [detailTab, setDetailTab]     = useState<'detalhes' | 'comunicacoes' | 'respostas'>('detalhes')

  // ── Comunicações por supervisão ────────────────────────────────────────────
  const [supComs, setSupComs]         = useState<SupComunicacao[]>([])
  const [addingSupCom, setAddingSupCom] = useState(false)
  const [supComEditing, setSupComEditing] = useState<SupComunicacao | null>(null)
  const [supComForm, setSupComForm]   = useState<Omit<SupComunicacao,'id'>>(emptySupCom())

  // ── Respostas ─────────────────────────────────────────────────────────────
  const [respostas, setRespostas]     = useState<Resposta[]>([])

  // ── Carregar tudo do Supabase ao montar + limpar localStorage ─────────────
  useEffect(() => {
    localStorage.removeItem('cmvm_supervisoes')
    localStorage.removeItem('cmvm_sup_comunicacoes')
    localStorage.removeItem('cmvm_comunicacoes')
    localStorage.removeItem('cmvm_respostas')
    sbNativeLoad<Supervisao>('cmvm_supervisoes').then(setSupervisoes)
    sbNativeLoad<SupComunicacao>('cmvm_sup_comunicacoes').then(setSupComs)
    sbNativeLoad<Resposta>('cmvm_respostas').then(setRespostas)
    sbNativeLoad<Comunicacao>('cmvm_comunicacoes').then(setComunicacoes)
  }, [])
  const [respSearch, setRespSearch]   = useState('')
  const [addingResp, setAddingResp]   = useState(false)
  const [addingRespGlobal, setAddingRespGlobal] = useState(false)
  const [respForm, setRespForm]       = useState<Omit<Resposta,'id'>>(emptyResp())
  const fileInputRef                  = useRef<HTMLInputElement>(null)

  const filteredSup = useMemo(() => {
    let list = supervisoes
    if (supEstado) list = list.filter(s => s.estado === supEstado)
    if (supSearch) {
      const q = supSearch.toLowerCase()
      list = list.filter(s =>
        s.assunto.toLowerCase().includes(q) || s.identificacao.toLowerCase().includes(q) ||
        s.responsaveis.toLowerCase().includes(q)
      )
    }
    return list
  }, [supervisoes, supSearch, supEstado])

  const supByYear = useMemo(() => {
    const map = new Map<number, Supervisao[]>()
    for (const s of filteredSup) {
      const d = parseDate(s.data_comunicacao)
      const y = d ? d.getFullYear() : 0
      if (!map.has(y)) map.set(y, [])
      map.get(y)!.push(s)
    }
    return Array.from(map.entries()).sort((a, b) => b[0] - a[0])
  }, [filteredSup])

  // ── Supervisão CRUD ───────────────────────────────────────────────────────
  function saveSup() {
    const now = new Date(); const seq = String(supervisoes.length + 1).padStart(3,'0')
    const updated = [...supervisoes, { id: `SUP-${now.getFullYear()}-${seq}`, ...supForm }]
    setSupervisoes(updated); sbNativeSave('cmvm_supervisoes', updated); setSupModal(false)
  }
  function saveSupInline() {
    if (!supEditing) return
    const updated = supervisoes.map(s => s.id === supEditing.id ? { ...supEditing, ...supForm } : s)
    setSupervisoes(updated); sbNativeSave('cmvm_supervisoes', updated)
    setDetailSup({ ...supEditing, ...supForm })
  }
  function deleteSup(id: string) {
    if (!confirm('Eliminar este processo de supervisão?')) return
    const updated = supervisoes.filter(s => s.id !== id)
    setSupervisoes(updated); sbNativeSave('cmvm_supervisoes', updated)
    // clean up related records
    const updatedComs = supComs.filter(c => c.supervisao_id !== id)
    setSupComs(updatedComs); sbNativeSave('cmvm_sup_comunicacoes', updatedComs)
    if (detailSup?.id === id) setDetailSup(null)
  }
  function openDetailSup(s: Supervisao, tab: 'detalhes' | 'comunicacoes' | 'respostas' = 'detalhes') {
    const { id, ...rest } = s
    setSupForm(rest); setSupEditing(s)
    setDetailSup(s); setDetailTab(tab)
    setAddingResp(false); setAddingSupCom(false); setSupComEditing(null)
  }
  function openNewSup() { setSupForm(emptySup()); setSupEditing(null); setSupModal(true) }

  // ── SupComunicação CRUD ───────────────────────────────────────────────────
  function saveSupCom() {
    if (!detailSup) return
    let updated: SupComunicacao[]
    if (supComEditing) {
      updated = supComs.map(c => c.id === supComEditing.id ? { ...supComEditing, ...supComForm } : c)
    } else {
      updated = [...supComs, { id: `SCCOM-${Date.now()}`, ...supComForm, supervisao_id: detailSup.id }]
    }
    setSupComs(updated); sbNativeSave('cmvm_sup_comunicacoes', updated)
    setAddingSupCom(false); setSupComEditing(null); setSupComForm(emptySupCom(detailSup.id))
  }
  function deleteSupCom(id: string) {
    if (!confirm('Eliminar esta comunicação?')) return
    const updated = supComs.filter(c => c.id !== id)
    setSupComs(updated); sbNativeSave('cmvm_sup_comunicacoes', updated)
  }
  function editSupCom(c: SupComunicacao) {
    const { id, ...rest } = c
    setSupComForm(rest); setSupComEditing(c); setAddingSupCom(true)
  }

  // ── Resposta CRUD ─────────────────────────────────────────────────────────
  function saveResp() {
    const r: Resposta = { id: `RESP-${Date.now()}`, ...respForm }
    const updated = [...respostas, r]
    setRespostas(updated)
    sbNativeSave('cmvm_respostas', updated)
    setAddingResp(false); setAddingRespGlobal(false)
    setRespForm(emptyResp(detailSup?.id))
  }
  function deleteResp(id: string) {
    if (!confirm('Eliminar esta resposta?')) return
    const updated = respostas.filter(r => r.id !== id)
    setRespostas(updated); sbNativeSave('cmvm_respostas', updated)
  }
  function downloadFile(f: RespostaFicheiro) {
    const a = document.createElement('a'); a.href = f.dataUrl; a.download = f.name
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
  }
  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files; if (!files?.length) return
    Array.from(files).forEach(file => {
      const reader = new FileReader()
      reader.onload = () => setRespForm(prev => ({
        ...prev,
        ficheiros: [...prev.ficheiros, {
          id: `F-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          name: file.name, size: file.size, mimeType: file.type, dataUrl: reader.result as string,
        }],
      }))
      reader.readAsDataURL(file)
    })
    e.target.value = ''
  }
  function removeFileFromForm(id: string) { setRespForm(prev => ({ ...prev, ficheiros: prev.ficheiros.filter(f => f.id !== id) })) }
  function formatBytes(n: number) {
    if (n < 1024) return `${n} B`; if (n < 1048576) return `${(n/1024).toFixed(0)} KB`; return `${(n/1048576).toFixed(1)} MB`
  }

  // ── Comunicações gerais ───────────────────────────────────────────────────
  const [comunicacoes, setComunicacoes] = useState<Comunicacao[]>([])
  const [comModal, setComModal]         = useState(false)
  const [comEditing, setComEditing]     = useState<Comunicacao | null>(null)
  const [comForm, setComForm]           = useState(emptyCom())
  const [comSearch, setComSearch]       = useState('')

  const filteredRespostas = useMemo(() => {
    const list = respSearch
      ? respostas.filter(r => {
          const linkedSups = supervisoes.filter(s => r.supervisao_ids.includes(s.id))
          const q = respSearch.toLowerCase()
          return r.responsavel.toLowerCase().includes(q) || r.descricao.toLowerCase().includes(q) ||
            linkedSups.some(s => s.identificacao.toLowerCase().includes(q) || s.assunto.toLowerCase().includes(q))
        })
      : respostas
    return list.slice().sort((a, b) => (parseDate(b.data)?.getTime() ?? 0) - (parseDate(a.data)?.getTime() ?? 0))
  }, [respostas, supervisoes, respSearch])

  const filteredCom = useMemo(() => {
    if (!comSearch) return comunicacoes
    const q = comSearch.toLowerCase()
    return comunicacoes.filter(c => c.assunto.toLowerCase().includes(q) || c.ref.toLowerCase().includes(q) || c.responsavel.toLowerCase().includes(q))
  }, [comunicacoes, comSearch])

  function saveCom() {
    const seq = String(comunicacoes.length + 1).padStart(3,'0')
    const updated = comEditing
      ? comunicacoes.map(c => c.id === comEditing.id ? { ...comEditing, ...comForm } : c)
      : [...comunicacoes, { id: `COM-${new Date().getFullYear()}-${seq}`, ...comForm }]
    setComunicacoes(updated); sbNativeSave('cmvm_comunicacoes', updated); setComModal(false)
  }
  function deleteCom(id: string) {
    if (!confirm('Eliminar esta comunicação?')) return
    const updated = comunicacoes.filter(c => c.id !== id)
    setComunicacoes(updated); sbNativeSave('cmvm_comunicacoes', updated)
  }
  function openEditCom(c: Comunicacao) { const { id, ...rest } = c; setComForm(rest); setComEditing(c); setComModal(true) }
  function openNewCom() { setComForm(emptyCom()); setComEditing(null); setComModal(true) }

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const kpiPendente = supervisoes.filter(s => s.estado === 'Pendente').length
  const kpiEmCurso  = supervisoes.filter(s => s.estado === 'Em curso').length
  const today = new Date(); today.setHours(0,0,0,0)
  const kpiAtraso   = supervisoes.filter(s => {
    if (s.estado === 'Respondido' || s.estado === 'Fechado') return false
    const d = parseDate(s.data_limite); return d ? d < today : false
  }).length

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 space-y-4">

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-white rounded-2xl border border-gray-100 px-5 py-4">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Total Processos</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{supervisoes.length}</p>
          <p className="text-[10px] text-gray-400">supervisões CMVM</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 px-5 py-4">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Pendentes</p>
          <p className="text-2xl font-bold text-amber-600 mt-1">{kpiPendente}</p>
          <p className="text-[10px] text-gray-400">aguardam resposta</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 px-5 py-4">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Em Curso</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">{kpiEmCurso}</p>
          <p className="text-[10px] text-gray-400">em preparação de resposta</p>
        </div>
        <div className={clsx('rounded-2xl border px-5 py-4', kpiAtraso > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-gray-100')}>
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Prazo Expirado</p>
          <p className={clsx('text-2xl font-bold mt-1', kpiAtraso > 0 ? 'text-red-600' : 'text-gray-900')}>{kpiAtraso}</p>
          <p className="text-[10px] text-gray-400">sem resposta e em atraso</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {([['comunicacoes','Comunicações'],['supervisoes','Supervisões']] as const).map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)}
            className={clsx('text-[12px] font-medium px-5 py-1.5 rounded-lg transition-colors',
              tab === k ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700')}>
            {label}
          </button>
        ))}
      </div>

      {/* ══════════ SUPERVISÕES ══════════ */}
      {tab === 'supervisoes' && (
        <div className="space-y-4">
          <div className="flex items-center justify-end gap-2">
            <button onClick={() => setShowCal(v => !v)}
              className="flex items-center gap-1.5 text-[11px] text-gray-500 border border-gray-200 rounded-lg px-3 py-1.5 hover:border-blue-400 hover:text-blue-600 transition-colors bg-white">
              <CalendarDays size={12}/>{showCal ? 'Ocultar Calendário' : 'Ver Calendário'}
            </button>
            <button onClick={openNewSup} className="flex items-center gap-1.5 text-[11px] font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg px-3 py-1.5 transition-colors">
              <Plus size={12}/> Nova Supervisão
            </button>
          </div>

          {showCal && <SupervisaoCalendar supervisoes={supervisoes} onSelectSup={s => openDetailSup(s)}/>}

          {/* Sub-tabs */}
          <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
            {([['processos','Processos'], ['respostas', `Respostas${respostas.length > 0 ? ` (${respostas.length})` : ''}`]] as const).map(([k, label]) => (
              <button key={k} onClick={() => setSupSubTab(k)}
                className={clsx('text-[12px] font-medium px-5 py-1.5 rounded-lg transition-colors',
                  supSubTab === k ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700')}>
                {label}
              </button>
            ))}
          </div>

          {/* ── Sub-tab: Processos ── */}
          {supSubTab === 'processos' && (
          <div className="bg-white rounded-2xl border border-gray-100">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
              <div>
                <span className="text-sm font-semibold text-gray-900">Processos de Supervisão CMVM</span>
                <p className="text-[11px] text-gray-400 mt-0.5">Registo de comunicações recebidas da CMVM no âmbito de supervisão</p>
              </div>
              <span className="text-[11px] text-gray-400">{filteredSup.length} processo{filteredSup.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="px-5 py-2.5 border-b border-gray-100 flex items-center gap-2">
              <div className="relative flex-1 max-w-sm">
                <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"/>
                <input className="w-full pl-7 pr-3 py-1.5 text-[11px] border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400"
                  placeholder="Pesquisar por identificação, assunto, responsável…" value={supSearch} onChange={e => setSupSearch(e.target.value)}/>
              </div>
              <select className="text-[11px] border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none text-gray-600"
                value={supEstado} onChange={e => setSupEstado(e.target.value)}>
                <option value="">Todos os estados</option>
                <option>Pendente</option><option>Em curso</option><option>Respondido</option><option>Fechado</option>
              </select>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[11px]" style={{ minWidth: 1300 }}>
                <thead>
                  <tr className="text-[10px] text-gray-500 uppercase tracking-wide border-b border-gray-100 bg-gray-50">
                    {['Identificação','Data Recebida','Assunto','Detalhes do Ofício','Responsáveis','Departamento','Resposta BC','Data Resposta','Data Limite','Estado','Observações',''].map(h => (
                      <th key={h} className="px-3 py-3 text-left font-medium whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {supByYear.length === 0 ? (
                    <tr><td colSpan={12} className="px-5 py-10 text-center text-gray-400">Nenhum processo encontrado.</td></tr>
                  ) : supByYear.flatMap(([year, items]) => [
                    <tr key={`year-${year}`}>
                      <td colSpan={12} className="px-4 py-2 bg-gray-50/80 border-y border-gray-100">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-bold text-gray-700">{year === 0 ? 'Sem data' : year}</span>
                          <span className="text-[10px] text-gray-400">— {items.length} processo{items.length !== 1 ? 's' : ''}</span>
                        </div>
                      </td>
                    </tr>,
                    ...items.map(s => {
                      const dl = parseDate(s.data_limite)
                      const isOverdue = dl && dl < today && s.estado !== 'Respondido' && s.estado !== 'Fechado'
                      const nComs  = supComs.filter(c => c.supervisao_id === s.id).length
                      const nResps = respostas.filter(r => r.supervisao_ids.includes(s.id)).length
                      return (
                        <tr key={s.id} onClick={() => openDetailSup(s)}
                          className={clsx('border-b border-gray-50 hover:bg-blue-50/30 cursor-pointer transition-colors',
                            isOverdue && 'bg-red-50/40',
                            detailSup?.id === s.id && 'bg-blue-50/50 border-l-2 border-l-blue-400')}>
                          <td className="px-3 py-2.5 font-medium text-blue-700 whitespace-nowrap">{s.identificacao}</td>
                          <td className="px-3 py-2.5 whitespace-nowrap font-mono text-gray-600">{s.data_comunicacao}</td>
                          <td className="px-3 py-2.5 max-w-[160px]"><div className="line-clamp-2 font-medium text-gray-800" title={s.assunto}>{s.assunto}</div></td>
                          <td className="px-3 py-2.5 max-w-[180px] text-gray-500"><div className="line-clamp-2" title={s.detalhes}>{s.detalhes || '—'}</div></td>
                          <td className="px-3 py-2.5 whitespace-nowrap">{s.responsaveis}</td>
                          <td className="px-3 py-2.5 whitespace-nowrap text-gray-500">{s.departamento}</td>
                          <td className="px-3 py-2.5 max-w-[160px] text-gray-500"><div className="line-clamp-2" title={s.resposta_bc}>{s.resposta_bc || <span className="text-gray-200">—</span>}</div></td>
                          <td className="px-3 py-2.5 whitespace-nowrap font-mono text-gray-500">{s.data_resposta_bc || '—'}</td>
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            <span className={clsx('font-mono font-semibold', isOverdue ? 'text-red-600' : 'text-orange-600')}>{s.data_limite || '—'}</span>
                            {isOverdue && <AlertTriangle size={11} className="inline ml-1 text-red-500"/>}
                          </td>
                          <td className="px-3 py-2.5">
                            <span className={clsx('text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap', SUPER_ESTADO_CLS[s.estado])}>{s.estado}</span>
                          </td>
                          <td className="px-3 py-2.5 max-w-[140px] text-gray-400"><div className="line-clamp-2">{s.observacoes || '—'}</div></td>
                          <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center gap-1.5">
                              {nComs > 0 && (
                                <span title={`${nComs} comunicação${nComs !== 1 ? 'ões' : ''}`}
                                  className="text-[9px] font-bold bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                                  <Mail size={8} className="inline mr-0.5"/>{nComs}
                                </span>
                              )}
                              {nResps > 0 && (
                                <span title={`${nResps} resposta${nResps !== 1 ? 's' : ''}`}
                                  className="text-[9px] font-bold bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                                  <Paperclip size={8} className="inline mr-0.5"/>{nResps}
                                </span>
                              )}
                              <button onClick={() => openDetailSup(s)} className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-blue-600"><Pencil size={11}/></button>
                              <button onClick={() => deleteSup(s.id)} className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-red-500"><Trash2 size={11}/></button>
                            </div>
                          </td>
                        </tr>
                      )
                    }),
                  ])}
                </tbody>
              </table>
            </div>
          </div>
          )}

          {/* ── Sub-tab: Respostas ── */}
          {supSubTab === 'respostas' && (
            <div className="bg-white rounded-2xl border border-gray-100">
              <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <span className="text-sm font-semibold text-gray-900">Respostas Enviadas</span>
                  <p className="text-[11px] text-gray-400 mt-0.5">Todas as respostas registadas para processos de supervisão CMVM</p>
                </div>
                <button onClick={() => { setRespForm(emptyResp()); setAddingRespGlobal(true) }}
                  className="flex items-center gap-1.5 text-[11px] font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg px-3 py-1.5 transition-colors">
                  <Plus size={12}/> Nova Resposta
                </button>
              </div>
              <div className="px-5 py-2.5 border-b border-gray-100">
                <div className="relative max-w-sm">
                  <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"/>
                  <input className="w-full pl-7 pr-3 py-1.5 text-[11px] border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400"
                    placeholder="Pesquisar por supervisão, responsável, descrição…"
                    value={respSearch} onChange={e => setRespSearch(e.target.value)}/>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="text-[10px] text-gray-500 uppercase tracking-wide border-b border-gray-100 bg-gray-50">
                      {['Supervisões','Data Resposta','Responsável','Descrição','Ficheiros',''].map(h => (
                        <th key={h} className="px-3 py-3 text-left font-medium whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRespostas.length === 0 ? (
                      <tr><td colSpan={6} className="px-5 py-10 text-center text-gray-400">
                        {respSearch ? 'Nenhuma resposta encontrada.' : 'Ainda não foram registadas respostas. Clique em "Nova Resposta" para adicionar.'}
                      </td></tr>
                    ) : filteredRespostas.map(r => {
                      const linkedSups = supervisoes.filter(s => r.supervisao_ids.includes(s.id))
                      return (
                        <tr key={r.id} className="border-b border-gray-50 hover:bg-blue-50/20 transition-colors">
                          <td className="px-3 py-2.5">
                            <div className="flex flex-wrap gap-1">
                              {linkedSups.length > 0 ? linkedSups.map(s => (
                                <button key={s.id} onClick={() => openDetailSup(s, 'respostas')}
                                  className="text-[9px] font-semibold px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded-full border border-blue-100 hover:bg-blue-100 transition-colors whitespace-nowrap" title={s.assunto}>
                                  {s.identificacao}
                                </button>
                              )) : <span className="text-gray-300">—</span>}
                            </div>
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap font-mono text-gray-600">{r.data || '—'}</td>
                          <td className="px-3 py-2.5 whitespace-nowrap">{r.responsavel || '—'}</td>
                          <td className="px-3 py-2.5 max-w-[280px] text-gray-500"><div className="line-clamp-2">{r.descricao || '—'}</div></td>
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            {r.ficheiros.length > 0 ? <span className="flex items-center gap-1 text-blue-600"><Paperclip size={10}/>{r.ficheiros.length}</span> : <span className="text-gray-200">—</span>}
                          </td>
                          <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
                            <button onClick={() => deleteResp(r.id)} className="p-1 rounded hover:bg-gray-100 text-gray-300 hover:text-red-400 transition-colors"><Trash2 size={11}/></button>
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

      {/* ══════════ COMUNICAÇÕES GERAIS ══════════ */}
      {tab === 'comunicacoes' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="relative">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"/>
              <input className="pl-7 pr-3 py-1.5 text-[11px] border border-gray-200 rounded-lg w-56 focus:outline-none focus:ring-1 focus:ring-blue-400"
                placeholder="Pesquisar…" value={comSearch} onChange={e => setComSearch(e.target.value)}/>
            </div>
            <button onClick={openNewCom} className="flex items-center gap-1.5 text-[11px] font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg px-3 py-1.5 transition-colors">
              <Plus size={12}/> Nova Comunicação
            </button>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100">
            <div className="px-5 py-3 border-b border-gray-100">
              <span className="text-sm font-semibold text-gray-900">Comunicações Enviadas à CMVM</span>
              <p className="text-[11px] text-gray-400 mt-0.5">Registo de toda a correspondência enviada à CMVM</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="text-[10px] text-gray-500 uppercase tracking-wide border-b border-gray-100 bg-gray-50">
                    {['Referência','Data','Tipo','Assunto','Destinatário','Responsável','Estado','Observações',''].map(h => (
                      <th key={h} className="px-3 py-3 text-left font-medium whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredCom.length === 0 ? (
                    <tr><td colSpan={9} className="px-5 py-10 text-center text-gray-400">Nenhuma comunicação encontrada.</td></tr>
                  ) : filteredCom.map(c => (
                    <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50/60">
                      <td className="px-3 py-2.5 font-medium text-blue-700 whitespace-nowrap">{c.ref}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap font-mono text-gray-600">{c.data}</td>
                      <td className="px-3 py-2.5"><span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">{c.tipo}</span></td>
                      <td className="px-3 py-2.5 max-w-[220px] font-medium text-gray-800"><div className="line-clamp-2" title={c.assunto}>{c.assunto}</div></td>
                      <td className="px-3 py-2.5 whitespace-nowrap text-gray-600">{c.destinatario}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap">{c.responsavel}</td>
                      <td className="px-3 py-2.5"><span className={clsx('text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap', COM_ESTADO_CLS[c.estado])}>{c.estado}</span></td>
                      <td className="px-3 py-2.5 max-w-[160px] text-gray-400"><div className="line-clamp-1">{c.observacoes || '—'}</div></td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => openEditCom(c)} className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-blue-600"><Pencil size={11}/></button>
                          <button onClick={() => deleteCom(c.id)} className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-red-500"><Trash2 size={11}/></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ══════════ MODAL — Nova Supervisão ══════════ */}
      {supModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl border border-gray-200 p-6 w-[720px] max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="flex items-center justify-between mb-5">
              <span className="text-[14px] font-semibold text-gray-900">Novo Processo de Supervisão</span>
              <button onClick={() => setSupModal(false)} className="text-gray-400 hover:text-gray-600"><X size={16}/></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="form-label">Identificação da Comunicação</label><input className="form-input" placeholder="CMVM/SUP/2026/001" value={supForm.identificacao} onChange={e=>setSupForm({...supForm,identificacao:e.target.value})}/></div>
              <div><label className="form-label">Data da Comunicação (recebida)</label><input type="date" className="form-input" value={toInputDate(supForm.data_comunicacao)} onChange={e=>setSupForm({...supForm,data_comunicacao:fromInputDate(e.target.value)})}/></div>
              <div>
                <label className="form-label">Data Limite para Resposta <span className="text-red-500">*</span></label>
                <input type="date" className="form-input border-orange-300 focus:ring-orange-400" value={toInputDate(supForm.data_limite)} onChange={e=>setSupForm({...supForm,data_limite:fromInputDate(e.target.value)})}/>
                <p className="text-[10px] text-orange-600 mt-0.5">Data importante — prazo máximo de resposta à CMVM</p>
              </div>
              <div><label className="form-label">Responsáveis</label><input className="form-input" placeholder="Nome / Cargo" value={supForm.responsaveis} onChange={e=>setSupForm({...supForm,responsaveis:e.target.value})}/></div>
              <div><label className="form-label">Departamento</label><input className="form-input" placeholder="Ex: Compliance" value={supForm.departamento} onChange={e=>setSupForm({...supForm,departamento:e.target.value})}/></div>
              <div>
                <label className="form-label">Estado</label>
                <select className="form-input" value={supForm.estado} onChange={e=>setSupForm({...supForm,estado:e.target.value as SuperEstado})}>
                  <option>Pendente</option><option>Em curso</option><option>Respondido</option><option>Fechado</option>
                </select>
              </div>
              <div><label className="form-label">Data de Envio da Resposta</label><input type="date" className="form-input" value={toInputDate(supForm.data_resposta_bc)} onChange={e=>setSupForm({...supForm,data_resposta_bc:fromInputDate(e.target.value)})}/></div>
              <div className="col-span-2"><label className="form-label">Assunto</label><input className="form-input" placeholder="Descrição breve do assunto da supervisão" value={supForm.assunto} onChange={e=>setSupForm({...supForm,assunto:e.target.value})}/></div>
              <div className="col-span-2"><label className="form-label">Detalhes do Ofício</label><textarea className="form-input" rows={3} placeholder="Detalhe do conteúdo do ofício recebido…" value={supForm.detalhes} onChange={e=>setSupForm({...supForm,detalhes:e.target.value})}/></div>
              <div className="col-span-2"><label className="form-label">Resposta BC</label><textarea className="form-input" rows={2} placeholder="Resumo ou referência da resposta enviada pela BlueCrow…" value={supForm.resposta_bc} onChange={e=>setSupForm({...supForm,resposta_bc:e.target.value})}/></div>
              <div className="col-span-2"><label className="form-label">Observações</label><textarea className="form-input" rows={2} value={supForm.observacoes} onChange={e=>setSupForm({...supForm,observacoes:e.target.value})}/></div>
            </div>
            <div className="flex justify-end gap-2 pt-4 mt-4 border-t border-gray-100">
              <button onClick={() => setSupModal(false)} className="btn btn-outline btn-sm">Cancelar</button>
              <button onClick={saveSup} disabled={!supForm.assunto || !supForm.identificacao} className="btn btn-primary btn-sm">Guardar</button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════ DETAIL DRAWER ══════════ */}
      {detailSup && (
        <>
          <div className="fixed inset-0 bg-black/20 z-40" onClick={() => setDetailSup(null)}/>
          <div className="fixed right-0 top-0 h-full w-[560px] bg-white border-l border-gray-200 shadow-2xl z-50 flex flex-col">

            {/* Header */}
            <div className="flex items-start justify-between px-5 py-4 border-b border-gray-100 bg-gray-50 flex-shrink-0">
              <div className="min-w-0 flex-1 pr-3">
                <p className="text-[13px] font-bold text-blue-700 truncate">{detailSup.identificacao}</p>
                <p className="text-[11px] text-gray-500 mt-0.5 line-clamp-2">{detailSup.assunto}</p>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <span className={clsx('text-[10px] font-semibold px-2 py-0.5 rounded-full', SUPER_ESTADO_CLS[detailSup.estado])}>{detailSup.estado}</span>
                  {detailSup.data_limite && <span className="text-[10px] text-gray-400">Prazo: {detailSup.data_limite}</span>}
                </div>
              </div>
              <button onClick={() => setDetailSup(null)} className="text-gray-400 hover:text-gray-700 flex-shrink-0 p-1 mt-0.5"><X size={16}/></button>
            </div>

            {/* Drawer tabs: Detalhes | Comunicações | Respostas */}
            <div className="flex gap-1 px-4 py-2.5 border-b border-gray-100 flex-shrink-0 bg-white">
              {(['detalhes', 'comunicacoes', 'respostas'] as const).map(t => {
                const countComs  = t === 'comunicacoes' ? supComs.filter(c => c.supervisao_id === detailSup.id).length : 0
                const countResps = t === 'respostas'    ? respostas.filter(r => r.supervisao_ids.includes(detailSup.id)).length : 0
                const count = countComs + countResps
                const label = t === 'detalhes' ? 'Detalhes' : t === 'comunicacoes' ? 'Comunicações' : 'Respostas'
                return (
                  <button key={t} onClick={() => setDetailTab(t)}
                    className={clsx('text-[11px] font-medium px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5',
                      detailTab === t ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-100')}>
                    {label}
                    {count > 0 && (
                      <span className={clsx('text-[9px] font-bold px-1.5 py-0.5 rounded-full', detailTab === t ? 'bg-white/20 text-white' : 'bg-blue-100 text-blue-600')}>{count}</span>
                    )}
                  </button>
                )
              })}
            </div>

            {/* Drawer content */}
            <div className="flex-1 overflow-y-auto">

              {/* ── Detalhes ── */}
              {detailTab === 'detalhes' && (
                <div className="p-5 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="form-label">Identificação</label><input className="form-input" value={supForm.identificacao} onChange={e=>setSupForm({...supForm,identificacao:e.target.value})}/></div>
                    <div><label className="form-label">Data Recebida</label><input type="date" className="form-input" value={toInputDate(supForm.data_comunicacao)} onChange={e=>setSupForm({...supForm,data_comunicacao:fromInputDate(e.target.value)})}/></div>
                    <div>
                      <label className="form-label">Data Limite <span className="text-red-500">*</span></label>
                      <input type="date" className="form-input border-orange-300 focus:ring-orange-400" value={toInputDate(supForm.data_limite)} onChange={e=>setSupForm({...supForm,data_limite:fromInputDate(e.target.value)})}/>
                    </div>
                    <div><label className="form-label">Responsáveis</label><input className="form-input" value={supForm.responsaveis} onChange={e=>setSupForm({...supForm,responsaveis:e.target.value})}/></div>
                    <div><label className="form-label">Departamento</label><input className="form-input" value={supForm.departamento} onChange={e=>setSupForm({...supForm,departamento:e.target.value})}/></div>
                    <div>
                      <label className="form-label">Estado</label>
                      <select className="form-input" value={supForm.estado} onChange={e=>setSupForm({...supForm,estado:e.target.value as SuperEstado})}>
                        <option>Pendente</option><option>Em curso</option><option>Respondido</option><option>Fechado</option>
                      </select>
                    </div>
                    <div><label className="form-label">Data de Envio da Resposta</label><input type="date" className="form-input" value={toInputDate(supForm.data_resposta_bc)} onChange={e=>setSupForm({...supForm,data_resposta_bc:fromInputDate(e.target.value)})}/></div>
                    <div className="col-span-2"><label className="form-label">Assunto</label><input className="form-input" value={supForm.assunto} onChange={e=>setSupForm({...supForm,assunto:e.target.value})}/></div>
                    <div className="col-span-2"><label className="form-label">Detalhes do Ofício</label><textarea className="form-input" rows={3} value={supForm.detalhes} onChange={e=>setSupForm({...supForm,detalhes:e.target.value})}/></div>
                    <div className="col-span-2"><label className="form-label">Resposta BC</label><textarea className="form-input" rows={2} value={supForm.resposta_bc} onChange={e=>setSupForm({...supForm,resposta_bc:e.target.value})}/></div>
                    <div className="col-span-2"><label className="form-label">Observações</label><textarea className="form-input" rows={2} value={supForm.observacoes} onChange={e=>setSupForm({...supForm,observacoes:e.target.value})}/></div>
                  </div>
                  <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                    <button onClick={() => setDetailSup(null)} className="btn btn-outline btn-sm">Cancelar</button>
                    <button onClick={saveSupInline} disabled={!supForm.assunto || !supForm.identificacao} className="btn btn-primary btn-sm">Guardar Alterações</button>
                  </div>
                </div>
              )}

              {/* ── Comunicações do processo ── */}
              {detailTab === 'comunicacoes' && (
                <div className="p-5 space-y-4">
                  {!addingSupCom && (
                    <button onClick={() => { setAddingSupCom(true); setSupComEditing(null); setSupComForm(emptySupCom(detailSup.id)) }}
                      className="flex items-center gap-1.5 text-[11px] font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg px-3 py-1.5 transition-colors">
                      <Plus size={12}/> Adicionar Comunicação
                    </button>
                  )}

                  {addingSupCom && (
                    <div className="border border-blue-200 rounded-xl bg-blue-50/30 p-4 space-y-3">
                      <p className="text-[12px] font-semibold text-gray-800">{supComEditing ? 'Editar Comunicação' : 'Nova Comunicação'}</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div><label className="form-label">Referência</label><input className="form-input" placeholder="BCR-CMVM-2026-001" value={supComForm.ref} onChange={e=>setSupComForm({...supComForm,ref:e.target.value})}/></div>
                        <div><label className="form-label">Data</label><input type="date" className="form-input" value={toInputDate(supComForm.data)} onChange={e=>setSupComForm({...supComForm,data:fromInputDate(e.target.value)})}/></div>
                        <div>
                          <label className="form-label">Tipo</label>
                          <select className="form-input" value={supComForm.tipo} onChange={e=>setSupComForm({...supComForm,tipo:e.target.value as ComTipo})}>
                            <option>Ofício</option><option>Circular</option><option>Carta</option><option>Email</option><option>Outra</option>
                          </select>
                        </div>
                        <div>
                          <label className="form-label">Estado</label>
                          <select className="form-input" value={supComForm.estado} onChange={e=>setSupComForm({...supComForm,estado:e.target.value as ComEstado})}>
                            <option>Em preparação</option><option>Enviada</option><option>Pendente</option><option>Arquivo</option>
                          </select>
                        </div>
                        <div className="col-span-2"><label className="form-label">Assunto</label><input className="form-input" placeholder="Assunto da comunicação" value={supComForm.assunto} onChange={e=>setSupComForm({...supComForm,assunto:e.target.value})}/></div>
                        <div><label className="form-label">Responsável</label><input className="form-input" placeholder="Nome" value={supComForm.responsavel} onChange={e=>setSupComForm({...supComForm,responsavel:e.target.value})}/></div>
                        <div className="col-span-2"><label className="form-label">Observações</label><textarea className="form-input" rows={2} value={supComForm.observacoes} onChange={e=>setSupComForm({...supComForm,observacoes:e.target.value})}/></div>
                      </div>
                      <div className="flex justify-end gap-2 pt-1">
                        <button onClick={() => { setAddingSupCom(false); setSupComEditing(null) }} className="btn btn-outline btn-sm">Cancelar</button>
                        <button onClick={saveSupCom} disabled={!supComForm.assunto} className="btn btn-primary btn-sm">Guardar</button>
                      </div>
                    </div>
                  )}

                  {(() => {
                    const items = supComs
                      .filter(c => c.supervisao_id === detailSup.id)
                      .sort((a, b) => (parseDate(b.data)?.getTime() ?? 0) - (parseDate(a.data)?.getTime() ?? 0))
                    if (items.length === 0 && !addingSupCom) return (
                      <div className="text-center py-10">
                        <Mail size={24} className="text-gray-200 mx-auto mb-2"/>
                        <p className="text-[12px] text-gray-400">Ainda não foram registadas comunicações para este processo.</p>
                        <p className="text-[11px] text-gray-300 mt-0.5">Clique em "Adicionar Comunicação" para registar.</p>
                      </div>
                    )
                    return (
                      <div className="space-y-2">
                        {items.map(c => (
                          <div key={c.id} className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                {c.ref && <span className="text-[11px] font-bold text-blue-700">{c.ref}</span>}
                                <span className={clsx('text-[10px] font-semibold px-2 py-0.5 rounded-full', COM_ESTADO_CLS[c.estado])}>{c.estado}</span>
                                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">{c.tipo}</span>
                                {c.data && <span className="text-[10px] text-gray-400 font-mono">{c.data}</span>}
                              </div>
                              <div className="flex items-center gap-1 flex-shrink-0">
                                <button onClick={() => editSupCom(c)} className="p-1 rounded hover:bg-gray-100 text-gray-300 hover:text-blue-500 transition-colors"><Pencil size={11}/></button>
                                <button onClick={() => deleteSupCom(c.id)} className="p-1 rounded hover:bg-gray-100 text-gray-300 hover:text-red-400 transition-colors"><Trash2 size={11}/></button>
                              </div>
                            </div>
                            <p className="text-[11px] font-medium text-gray-800 mt-1.5">{c.assunto}</p>
                            {c.responsavel && <p className="text-[10px] text-gray-400 mt-0.5">{c.responsavel}</p>}
                            {c.observacoes && <p className="text-[11px] text-gray-500 mt-1 leading-relaxed">{c.observacoes}</p>}
                          </div>
                        ))}
                      </div>
                    )
                  })()}
                </div>
              )}

              {/* ── Respostas ── */}
              {detailTab === 'respostas' && (
                <div className="p-5 space-y-4">
                  {!addingResp && (
                    <button onClick={() => { setAddingResp(true); setRespForm(emptyResp(detailSup.id)) }}
                      className="flex items-center gap-1.5 text-[11px] font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg px-3 py-1.5 transition-colors">
                      <Plus size={12}/> Adicionar Resposta
                    </button>
                  )}

                  {addingResp && (
                    <div className="border border-blue-200 rounded-xl bg-blue-50/30 p-4 space-y-3">
                      <p className="text-[12px] font-semibold text-gray-800">Nova Resposta</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div><label className="form-label">Data</label><input type="date" className="form-input" value={toInputDate(respForm.data)} onChange={e=>setRespForm({...respForm,data:fromInputDate(e.target.value)})}/></div>
                        <div><label className="form-label">Responsável</label><input className="form-input" placeholder="Nome" value={respForm.responsavel} onChange={e=>setRespForm({...respForm,responsavel:e.target.value})}/></div>
                        <div className="col-span-2"><label className="form-label">Descrição</label><textarea className="form-input" rows={3} placeholder="Descreva o conteúdo da resposta enviada à CMVM…" value={respForm.descricao} onChange={e=>setRespForm({...respForm,descricao:e.target.value})}/></div>
                      </div>
                      {/* Multi-supervisão selector */}
                      <div>
                        <label className="form-label">Também aplicável a outras supervisões</label>
                        <div className="border border-gray-200 rounded-lg overflow-hidden max-h-32 overflow-y-auto">
                          {supervisoes.filter(s => s.id !== detailSup.id).map(s => (
                            <label key={s.id} className="flex items-center gap-2.5 px-3 py-1.5 hover:bg-blue-50/30 cursor-pointer border-b border-gray-50 last:border-0">
                              <input type="checkbox" className="rounded border-gray-300 text-blue-600 focus:ring-blue-400 flex-shrink-0"
                                checked={respForm.supervisao_ids.includes(s.id)}
                                onChange={e => setRespForm(prev => ({
                                  ...prev,
                                  supervisao_ids: e.target.checked
                                    ? [...prev.supervisao_ids, s.id]
                                    : prev.supervisao_ids.filter(id => id !== s.id)
                                }))}/>
                              <span className="text-[10px] font-semibold text-blue-600 whitespace-nowrap">{s.identificacao}</span>
                              <span className="text-[10px] text-gray-500 truncate flex-1">{s.assunto}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="form-label">Ficheiros anexos</label>
                        <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileInput}/>
                        <button onClick={() => fileInputRef.current?.click()}
                          className="flex items-center gap-1.5 text-[11px] border border-dashed border-gray-300 rounded-lg px-3 py-2 text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors w-full justify-center">
                          <Paperclip size={12}/> Escolher ficheiros…
                        </button>
                        {respForm.ficheiros.length > 0 && (
                          <div className="mt-2 space-y-1">
                            {respForm.ficheiros.map(f => (
                              <div key={f.id} className="flex items-center gap-2 bg-white border border-gray-100 rounded-lg px-2.5 py-1.5">
                                <FileText size={11} className="text-blue-400 flex-shrink-0"/>
                                <span className="text-[11px] text-gray-700 flex-1 truncate">{f.name}</span>
                                <span className="text-[10px] text-gray-400">{formatBytes(f.size)}</span>
                                <button onClick={() => removeFileFromForm(f.id)} className="text-gray-300 hover:text-red-400"><X size={11}/></button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex justify-end gap-2 pt-1">
                        <button onClick={() => setAddingResp(false)} className="btn btn-outline btn-sm">Cancelar</button>
                        <button onClick={saveResp} disabled={!respForm.descricao && respForm.ficheiros.length === 0} className="btn btn-primary btn-sm">Guardar Resposta</button>
                      </div>
                    </div>
                  )}

                  {respostas.filter(r => r.supervisao_ids.includes(detailSup.id)).length === 0 && !addingResp ? (
                    <div className="text-center py-10">
                      <Paperclip size={24} className="text-gray-200 mx-auto mb-2"/>
                      <p className="text-[12px] text-gray-400">Ainda não foram registadas respostas para este processo.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {respostas.filter(r => r.supervisao_ids.includes(detailSup.id))
                        .sort((a, b) => (parseDate(b.data)?.getTime() ?? 0) - (parseDate(a.data)?.getTime() ?? 0))
                        .map(r => {
                          const otherSups = supervisoes.filter(s => r.supervisao_ids.includes(s.id) && s.id !== detailSup.id)
                          return (
                            <div key={r.id} className="bg-white border border-gray-100 rounded-xl p-4 space-y-2 shadow-sm">
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <span className="text-[11px] font-semibold text-gray-800">{r.responsavel || '—'}</span>
                                  {r.data && <span className="text-[10px] text-gray-400 ml-2">{r.data}</span>}
                                </div>
                                <button onClick={() => deleteResp(r.id)} className="text-gray-200 hover:text-red-400 flex-shrink-0 transition-colors"><Trash2 size={12}/></button>
                              </div>
                              {r.descricao && <p className="text-[11px] text-gray-600 leading-relaxed">{r.descricao}</p>}
                              {otherSups.length > 0 && (
                                <div className="flex flex-wrap gap-1 pt-1">
                                  <span className="text-[10px] text-gray-400 mr-1">Também em:</span>
                                  {otherSups.map(s => (
                                    <button key={s.id} onClick={() => openDetailSup(s, 'respostas')}
                                      className="text-[9px] font-semibold px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded-full hover:bg-blue-50 hover:text-blue-600 transition-colors whitespace-nowrap">
                                      {s.identificacao}
                                    </button>
                                  ))}
                                </div>
                              )}
                              {r.ficheiros.length > 0 && (
                                <div className="space-y-1 pt-1 border-t border-gray-50">
                                  {r.ficheiros.map(f => (
                                    <div key={f.id} className="flex items-center gap-2 text-[11px]">
                                      <FileText size={11} className="text-blue-400 flex-shrink-0"/>
                                      <span className="flex-1 truncate text-gray-600">{f.name}</span>
                                      <span className="text-gray-300">{formatBytes(f.size)}</span>
                                      <button onClick={() => downloadFile(f)} className="p-1 rounded hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition-colors" title="Descarregar"><Download size={11}/></button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )
                        })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ══════════ MODAL — Nova Resposta Global ══════════ */}
      {addingRespGlobal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl border border-gray-200 p-6 w-[600px] max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="flex items-center justify-between mb-5">
              <span className="text-[14px] font-semibold text-gray-900">Nova Resposta</span>
              <button onClick={() => setAddingRespGlobal(false)} className="text-gray-400 hover:text-gray-600"><X size={16}/></button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="form-label">Data</label><input type="date" className="form-input" value={toInputDate(respForm.data)} onChange={e=>setRespForm({...respForm,data:fromInputDate(e.target.value)})}/></div>
                <div><label className="form-label">Responsável</label><input className="form-input" placeholder="Nome" value={respForm.responsavel} onChange={e=>setRespForm({...respForm,responsavel:e.target.value})}/></div>
                <div className="col-span-2"><label className="form-label">Descrição</label><textarea className="form-input" rows={4} placeholder="Descreva o conteúdo da resposta enviada à CMVM…" value={respForm.descricao} onChange={e=>setRespForm({...respForm,descricao:e.target.value})}/></div>
              </div>
              <div>
                <label className="form-label">Supervisões associadas <span className="text-red-500">*</span></label>
                <div className="border border-gray-200 rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                  {supervisoes.map(s => (
                    <label key={s.id} className="flex items-center gap-2.5 px-3 py-2 hover:bg-blue-50/30 cursor-pointer border-b border-gray-50 last:border-0 transition-colors">
                      <input type="checkbox" className="rounded border-gray-300 text-blue-600 focus:ring-blue-400 flex-shrink-0"
                        checked={respForm.supervisao_ids.includes(s.id)}
                        onChange={e => setRespForm(prev => ({
                          ...prev,
                          supervisao_ids: e.target.checked ? [...prev.supervisao_ids, s.id] : prev.supervisao_ids.filter(id => id !== s.id)
                        }))}/>
                      <span className="text-[10px] font-semibold text-blue-600 whitespace-nowrap">{s.identificacao}</span>
                      <span className="text-[11px] text-gray-600 truncate flex-1">{s.assunto}</span>
                      <span className={clsx('text-[9px] font-medium px-1.5 py-0.5 rounded-full flex-shrink-0', SUPER_ESTADO_CLS[s.estado])}>{s.estado}</span>
                    </label>
                  ))}
                </div>
                {respForm.supervisao_ids.length > 0 && (
                  <p className="text-[10px] text-blue-600 mt-1">{respForm.supervisao_ids.length} supervisão{respForm.supervisao_ids.length !== 1 ? 'ões' : ''} seleccionada{respForm.supervisao_ids.length !== 1 ? 's' : ''}</p>
                )}
              </div>
              <div>
                <label className="form-label">Ficheiros anexos</label>
                <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileInput}/>
                <button onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1.5 text-[11px] border border-dashed border-gray-300 rounded-lg px-3 py-2 text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors w-full justify-center">
                  <Paperclip size={12}/> Escolher ficheiros…
                </button>
                {respForm.ficheiros.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {respForm.ficheiros.map(f => (
                      <div key={f.id} className="flex items-center gap-2 bg-white border border-gray-100 rounded-lg px-2.5 py-1.5">
                        <FileText size={11} className="text-blue-400 flex-shrink-0"/>
                        <span className="text-[11px] text-gray-700 flex-1 truncate">{f.name}</span>
                        <span className="text-[10px] text-gray-400">{formatBytes(f.size)}</span>
                        <button onClick={() => removeFileFromForm(f.id)} className="text-gray-300 hover:text-red-400"><X size={11}/></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-4 mt-4 border-t border-gray-100">
              <button onClick={() => setAddingRespGlobal(false)} className="btn btn-outline btn-sm">Cancelar</button>
              <button onClick={saveResp}
                disabled={(!respForm.descricao && respForm.ficheiros.length === 0) || respForm.supervisao_ids.length === 0}
                className="btn btn-primary btn-sm">
                Guardar Resposta
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════ MODAL — Comunicação Geral ══════════ */}
      {comModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl border border-gray-200 p-6 w-[600px] max-h-[85vh] overflow-y-auto shadow-xl">
            <div className="flex items-center justify-between mb-5">
              <span className="text-[14px] font-semibold text-gray-900">{comEditing ? 'Editar Comunicação' : 'Nova Comunicação'}</span>
              <button onClick={() => setComModal(false)} className="text-gray-400 hover:text-gray-600"><X size={16}/></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="form-label">Referência</label><input className="form-input" placeholder="BCR-CMVM-2026-001" value={comForm.ref} onChange={e=>setComForm({...comForm,ref:e.target.value})}/></div>
              <div><label className="form-label">Data</label><input type="date" className="form-input" value={toInputDate(comForm.data)} onChange={e=>setComForm({...comForm,data:fromInputDate(e.target.value)})}/></div>
              <div><label className="form-label">Tipo</label>
                <select className="form-input" value={comForm.tipo} onChange={e=>setComForm({...comForm,tipo:e.target.value as ComTipo})}>
                  <option>Ofício</option><option>Circular</option><option>Carta</option><option>Email</option><option>Outra</option>
                </select>
              </div>
              <div><label className="form-label">Estado</label>
                <select className="form-input" value={comForm.estado} onChange={e=>setComForm({...comForm,estado:e.target.value as ComEstado})}>
                  <option>Em preparação</option><option>Enviada</option><option>Pendente</option><option>Arquivo</option>
                </select>
              </div>
              <div className="col-span-2"><label className="form-label">Assunto</label><input className="form-input" value={comForm.assunto} onChange={e=>setComForm({...comForm,assunto:e.target.value})}/></div>
              <div><label className="form-label">Destinatário</label><input className="form-input" placeholder="CMVM — Supervisão" value={comForm.destinatario} onChange={e=>setComForm({...comForm,destinatario:e.target.value})}/></div>
              <div><label className="form-label">Responsável</label><input className="form-input" value={comForm.responsavel} onChange={e=>setComForm({...comForm,responsavel:e.target.value})}/></div>
              <div className="col-span-2"><label className="form-label">Observações</label><textarea className="form-input" rows={2} value={comForm.observacoes} onChange={e=>setComForm({...comForm,observacoes:e.target.value})}/></div>
            </div>
            <div className="flex justify-end gap-2 pt-4 mt-4 border-t border-gray-100">
              <button onClick={() => setComModal(false)} className="btn btn-outline btn-sm">Cancelar</button>
              <button onClick={saveCom} disabled={!comForm.assunto} className="btn btn-primary btn-sm">Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
