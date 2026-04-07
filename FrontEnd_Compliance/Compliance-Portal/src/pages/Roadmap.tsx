import { useState, useRef } from 'react'
import { Plus, X, ChevronDown, Check, Pencil, Trash2, GitBranch, LayoutList } from 'lucide-react'
import { clsx } from 'clsx'
import { useStore } from '@/store/useStore'
import { useAuth } from '@/context/AuthContext'
import type { RoadmapItem, RoadmapEstado, RoadmapPrioridade, RoadmapCategoria } from '@/types'

// ─── Constantes ───────────────────────────────────────────────────────────────
const ESTADOS: RoadmapEstado[] = ['Em avaliação', 'Planeado', 'Em desenvolvimento', 'Concluído', 'Descartado']
const PRIORIDADES: RoadmapPrioridade[] = ['Crítica', 'Alta', 'Média', 'Baixa']
const CATEGORIAS: RoadmapCategoria[] = ['Segurança', 'Módulos', 'Integração', 'UI/UX', 'Regulatório', 'Performance', 'Dados', 'Outro']

const ESTADO_COLS: { estado: RoadmapEstado; label: string; color: string; header: string }[] = [
  { estado: 'Em avaliação',      label: 'Em avaliação',      color: 'bg-gray-100 text-gray-600',   header: 'border-t-gray-400' },
  { estado: 'Planeado',          label: 'Planeado',          color: 'bg-blue-100 text-blue-700',   header: 'border-t-blue-500' },
  { estado: 'Em desenvolvimento',label: 'Em desenvolvimento', color: 'bg-amber-100 text-amber-700', header: 'border-t-amber-500' },
  { estado: 'Concluído',         label: 'Concluído',         color: 'bg-green-100 text-green-700', header: 'border-t-green-500' },
]

const PRIO_COLOR: Record<RoadmapPrioridade, string> = {
  'Crítica': 'bg-red-100 text-red-700 border-red-200',
  'Alta':    'bg-orange-100 text-orange-700 border-orange-200',
  'Média':   'bg-amber-100 text-amber-700 border-amber-200',
  'Baixa':   'bg-gray-100 text-gray-500 border-gray-200',
}
const CAT_COLOR: Record<RoadmapCategoria, string> = {
  'Segurança':    'bg-red-50 text-red-600',
  'Módulos':      'bg-blue-50 text-blue-600',
  'Integração':   'bg-purple-50 text-purple-600',
  'UI/UX':        'bg-pink-50 text-pink-600',
  'Regulatório':  'bg-indigo-50 text-indigo-700',
  'Performance':  'bg-cyan-50 text-cyan-600',
  'Dados':        'bg-teal-50 text-teal-600',
  'Outro':        'bg-gray-50 text-gray-500',
}

// ─── Blank form ───────────────────────────────────────────────────────────────
const BLANK: Omit<RoadmapItem, 'id' | 'created_at'> = {
  titulo: '', descricao: '', categoria: 'Módulos', prioridade: 'Média',
  estado: 'Planeado', responsavel: '', prazoAlvo: '', notas: '',
}

// ─── Modal ────────────────────────────────────────────────────────────────────
function RoadmapModal({
  initial, onSave, onClose,
}: {
  initial: Omit<RoadmapItem, 'id' | 'created_at'>
  onSave: (data: Omit<RoadmapItem, 'id' | 'created_at'>) => void
  onClose: () => void
}) {
  const [form, setForm] = useState(initial)
  const f = (k: keyof typeof form) => (v: string) => setForm(p => ({ ...p, [k]: v }))
  const valid = form.titulo.trim() && form.descricao.trim()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <span className="text-[14px] font-semibold text-gray-900">
            {initial.titulo ? 'Editar item' : 'Novo item do Roadmap'}
          </span>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="form-label">Título *</label>
            <input className="form-input" value={form.titulo} onChange={e => f('titulo')(e.target.value)} placeholder="ex: Migração para Supabase Auth" />
          </div>
          <div>
            <label className="form-label">Descrição *</label>
            <textarea className="form-input min-h-[80px]" value={form.descricao} onChange={e => f('descricao')(e.target.value)} placeholder="Descreva o que será feito e qual o impacto esperado…" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">Categoria</label>
              <select className="form-input" value={form.categoria} onChange={e => f('categoria')(e.target.value)}>
                {CATEGORIAS.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Prioridade</label>
              <select className="form-input" value={form.prioridade} onChange={e => f('prioridade')(e.target.value)}>
                {PRIORIDADES.map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">Estado</label>
              <select className="form-input" value={form.estado} onChange={e => f('estado')(e.target.value)}>
                {ESTADOS.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Prazo Alvo</label>
              <input className="form-input" value={form.prazoAlvo ?? ''} onChange={e => f('prazoAlvo')(e.target.value)} placeholder="ex: Q2 2026" />
            </div>
          </div>
          <div>
            <label className="form-label">Responsável</label>
            <input className="form-input" value={form.responsavel ?? ''} onChange={e => f('responsavel')(e.target.value)} placeholder="ex: SPM" />
          </div>
          <div>
            <label className="form-label">Notas adicionais</label>
            <textarea className="form-input min-h-[60px]" value={form.notas ?? ''} onChange={e => f('notas')(e.target.value)} placeholder="Observações, dependências, links…" />
          </div>
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 text-[13px] text-gray-600 hover:bg-gray-50 rounded-lg">Cancelar</button>
          <button
            disabled={!valid}
            onClick={() => { onSave(form); onClose() }}
            className="px-4 py-2 text-[13px] font-semibold bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-lg"
          >
            Guardar
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Card ─────────────────────────────────────────────────────────────────────
function RoadmapCard({
  item, canEdit, onEdit, onDelete, onMoveEstado, onDragStart,
}: {
  item: RoadmapItem
  canEdit: boolean
  onEdit: () => void
  onDelete: () => void
  onMoveEstado: (e: RoadmapEstado) => void
  onDragStart?: (id: string) => void
}) {
  const [menu, setMenu] = useState(false)

  return (
    <div
      draggable={canEdit}
      onDragStart={e => { if (canEdit && onDragStart) { onDragStart(item.id); e.dataTransfer.effectAllowed = 'move' } }}
      className={clsx('bg-white rounded-xl border border-gray-200 shadow-sm p-3.5 space-y-2.5 hover:shadow-md transition-shadow', canEdit && 'cursor-grab active:cursor-grabbing active:opacity-60')}
    >
      {/* badges row */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className={clsx('text-[10px] font-semibold px-1.5 py-0.5 rounded-full border', PRIO_COLOR[item.prioridade])}>
          {item.prioridade}
        </span>
        <span className={clsx('text-[10px] font-medium px-1.5 py-0.5 rounded-full', CAT_COLOR[item.categoria])}>
          {item.categoria}
        </span>
        {item.prazoAlvo && (
          <span className="ml-auto text-[10px] text-gray-400">{item.prazoAlvo}</span>
        )}
      </div>

      {/* title */}
      <div className="text-[12.5px] font-semibold text-gray-900 leading-snug">{item.titulo}</div>

      {/* description */}
      <p className="text-[11px] text-gray-500 leading-relaxed line-clamp-3">{item.descricao}</p>

      {/* footer */}
      {(item.responsavel || item.completedAt || canEdit) && (
        <div className="flex items-center justify-between pt-1 border-t border-gray-100">
          <div className="flex items-center gap-2">
            {item.responsavel && (
              <span className="text-[10px] text-gray-400">{item.responsavel}</span>
            )}
            {item.completedAt && (
              <span className="flex items-center gap-0.5 text-[10px] text-green-600">
                <Check size={10} /> {item.completedAt}
              </span>
            )}
          </div>
          {canEdit && (
            <div className="flex items-center gap-1">
              {/* move estado */}
              <div className="relative">
                <button
                  onClick={() => setMenu(m => !m)}
                  className="text-gray-300 hover:text-gray-600 p-0.5 rounded"
                  title="Mover para…"
                >
                  <ChevronDown size={12} />
                </button>
                {menu && (
                  <div className="absolute right-0 bottom-6 bg-white border border-gray-200 rounded-lg shadow-lg z-10 min-w-[160px] py-1">
                    {ESTADOS.map(s => (
                      <button
                        key={s}
                        onClick={() => { onMoveEstado(s); setMenu(false) }}
                        className={clsx(
                          'w-full text-left text-[11px] px-3 py-1.5 hover:bg-gray-50',
                          s === item.estado ? 'font-semibold text-blue-600' : 'text-gray-700',
                        )}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button onClick={onEdit}   className="text-gray-300 hover:text-blue-500  p-0.5 rounded"><Pencil size={11} /></button>
              <button onClick={onDelete} className="text-gray-300 hover:text-red-500   p-0.5 rounded"><Trash2 size={11} /></button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Modal Row ────────────────────────────────────────────────────────────────
function ModalRow({ item }: { item: RoadmapItem }) {
  return (
    <div className="px-6 py-3 flex items-start justify-between gap-4 hover:bg-gray-50">
      <div className="min-w-0">
        <div className="text-[12.5px] font-semibold text-gray-900 truncate">{item.titulo}</div>
        <div className="text-[11px] text-gray-500 line-clamp-1 mt-0.5">{item.descricao}</div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <span className={clsx('text-[10px] font-semibold px-1.5 py-0.5 rounded-full border', PRIO_COLOR[item.prioridade])}>
          {item.prioridade}
        </span>
        <span className={clsx('text-[10px] font-medium px-1.5 py-0.5 rounded-full', CAT_COLOR[item.categoria])}>
          {item.categoria}
        </span>
        {item.prazoAlvo && (
          <span className="text-[10px] text-gray-400">{item.prazoAlvo}</span>
        )}
      </div>
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────
export function Roadmap() {
  const { roadmapItems, addRoadmapItem, updateRoadmapItem, deleteRoadmapItem } = useStore()
  const { user } = useAuth()
  const canEdit = user?.role === 'admin' || user?.role === 'gestor'

  const [modal, setModal]   = useState(false)
  const [editing, setEditing] = useState<RoadmapItem | null>(null)
  const [filterCat,  setFilterCat]  = useState<RoadmapCategoria | ''>('')
  const [filterPrio, setFilterPrio] = useState<RoadmapPrioridade | ''>('')
  const [showDescartado, setShowDescartado] = useState(false)
  const [showAllModal, setShowAllModal] = useState<'all' | 'concluidas' | 'emdev' | 'prio' | null>(null)

  // drag & drop
  const dragId = useRef<string | null>(null)
  const [dragOverCol, setDragOverCol] = useState<RoadmapEstado | null>(null)

  const filtered = roadmapItems.filter(r => {
    if (r.estado === 'Descartado') return false       // handled separately
    if (filterCat  && r.categoria  !== filterCat)  return false
    if (filterPrio && r.prioridade !== filterPrio)  return false
    return true
  })
  const descartados = roadmapItems.filter(r => r.estado === 'Descartado')

  // counts for stats
  const total = roadmapItems.filter(r => r.estado !== 'Descartado').length
  const nConcluido = roadmapItems.filter(r => r.estado === 'Concluído').length
  const nEmDev     = roadmapItems.filter(r => r.estado === 'Em desenvolvimento').length
  const nPrioridade = roadmapItems.filter(r => r.prioridade === 'Crítica' || r.prioridade === 'Alta').length

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2.5">
          <GitBranch className="w-5 h-5 text-blue-600" />
          <div>
            <h1 className="text-[16px] font-semibold text-gray-900">Roadmap do Portal</h1>
            <p className="text-[12px] text-gray-400">Melhorias planeadas, em desenvolvimento e concluídas</p>
          </div>
        </div>
        {canEdit && (
          <button
            onClick={() => { setEditing(null); setModal(true) }}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-[13px] font-semibold px-4 py-2 rounded-xl shadow-sm transition-colors"
          >
            <Plus size={14} /> Adicionar item
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {([
          { key: 'all',       label: 'Total de iniciativas',    value: total,      color: 'border-b-blue-500',  hoverIcon: 'text-blue-500'  },
          { key: 'concluidas',label: 'Concluídas',              value: nConcluido, color: 'border-b-green-500', hoverIcon: 'text-green-500' },
          { key: 'emdev',     label: 'Em desenvolvimento',      value: nEmDev,     color: 'border-b-amber-500', hoverIcon: 'text-amber-500' },
          { key: 'prio',      label: 'Prioridade alta/crítica', value: nPrioridade,color: 'border-b-red-500',   hoverIcon: 'text-red-500'   },
        ] as const).map(s => (
          <button
            key={s.key}
            onClick={() => setShowAllModal(s.key)}
            className={clsx('bg-white rounded-lg border border-gray-200 border-b-[3px] p-4 text-left hover:shadow-md transition-shadow group', s.color)}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{s.label}</div>
              <LayoutList size={13} className={clsx('text-gray-300 transition-colors group-hover:' + s.hoverIcon)} />
            </div>
            <div className="text-[24px] font-semibold text-gray-900">{s.value}</div>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <select
          value={filterCat}
          onChange={e => setFilterCat(e.target.value as RoadmapCategoria | '')}
          className="text-[12px] border border-gray-200 rounded-lg px-3 py-1.5 text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Todas as categorias</option>
          {CATEGORIAS.map(c => <option key={c}>{c}</option>)}
        </select>
        <select
          value={filterPrio}
          onChange={e => setFilterPrio(e.target.value as RoadmapPrioridade | '')}
          className="text-[12px] border border-gray-200 rounded-lg px-3 py-1.5 text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Todas as prioridades</option>
          {PRIORIDADES.map(p => <option key={p}>{p}</option>)}
        </select>
        {(filterCat || filterPrio) && (
          <button
            onClick={() => { setFilterCat(''); setFilterPrio('') }}
            className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-gray-700 px-2 py-1.5 rounded-lg hover:bg-gray-50"
          >
            <X size={11} /> Limpar filtros
          </button>
        )}
      </div>

      {/* Kanban board */}
      <div
        className="grid grid-cols-4 gap-4 items-start"
        onDragEnd={() => { dragId.current = null; setDragOverCol(null) }}
      >
        {ESTADO_COLS.map(col => {
          const items = filtered.filter(r => r.estado === col.estado)
          const isOver = dragOverCol === col.estado
          return (
            <div
              key={col.estado}
              onDragOver={e => { e.preventDefault(); setDragOverCol(col.estado) }}
              onDragLeave={() => setDragOverCol(null)}
              onDrop={e => {
                e.preventDefault()
                setDragOverCol(null)
                if (!dragId.current) return
                const id = dragId.current
                dragId.current = null
                const item = roadmapItems.find(r => r.id === id)
                if (!item || item.estado === col.estado) return
                updateRoadmapItem(id, {
                  estado: col.estado,
                  completedAt: col.estado === 'Concluído' ? new Date().toISOString().slice(0, 10) : item.completedAt,
                })
              }}
            >
              {/* Column header */}
              <div className={clsx('bg-white rounded-t-xl border border-b-0 border-gray-200 border-t-[3px] px-3 py-2.5 flex items-center justify-between transition-colors', col.header, isOver && 'bg-blue-50')}>
                <span className={clsx('text-[11px] font-semibold px-2 py-0.5 rounded-full', col.color)}>
                  {col.label}
                </span>
                <span className="text-[11px] text-gray-400 font-medium">{items.length}</span>
              </div>
              {/* Cards */}
              <div className={clsx('bg-gray-50 border border-t-0 border-gray-200 rounded-b-xl p-2 space-y-2 min-h-[120px] transition-colors', isOver && 'bg-blue-50/60 border-blue-200')}>
                {items.length === 0 && (
                  <div className={clsx('text-center text-[11px] py-6', isOver ? 'text-blue-300' : 'text-gray-300')}>
                    {isOver ? 'Soltar aqui' : '—'}
                  </div>
                )}
                {items.map(item => (
                  <RoadmapCard
                    key={item.id}
                    item={item}
                    canEdit={canEdit}
                    onDragStart={id => { dragId.current = id }}
                    onEdit={() => { setEditing(item); setModal(true) }}
                    onDelete={() => {
                      if (confirm(`Eliminar "${item.titulo}"?`)) deleteRoadmapItem(item.id)
                    }}
                    onMoveEstado={(e) => updateRoadmapItem(item.id, {
                      estado: e,
                      completedAt: e === 'Concluído' ? new Date().toISOString().slice(0, 10) : item.completedAt,
                    })}
                  />
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* Descartados (colapsável) */}
      {descartados.length > 0 && (
        <div>
          <button
            onClick={() => setShowDescartado(v => !v)}
            className="flex items-center gap-1.5 text-[12px] text-gray-400 hover:text-gray-600 mb-2"
          >
            <ChevronDown size={13} className={clsx('transition-transform', showDescartado && 'rotate-180')} />
            Descartados ({descartados.length})
          </button>
          {showDescartado && (
            <div className="grid grid-cols-4 gap-3">
              {descartados.map(item => (
                <RoadmapCard
                  key={item.id}
                  item={item}
                  canEdit={canEdit}
                  onEdit={() => { setEditing(item); setModal(true) }}
                  onDelete={() => {
                    if (confirm(`Eliminar "${item.titulo}"?`)) deleteRoadmapItem(item.id)
                  }}
                  onMoveEstado={(e) => updateRoadmapItem(item.id, { estado: e })}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* All Tasks Modal */}
      {showAllModal && (() => {
        const modalFilter = showAllModal
        const modalItems = roadmapItems.filter(r => {
          if (modalFilter === 'all')       return r.estado !== 'Descartado'
          if (modalFilter === 'concluidas') return r.estado === 'Concluído'
          if (modalFilter === 'emdev')      return r.estado === 'Em desenvolvimento'
          if (modalFilter === 'prio')       return r.prioridade === 'Crítica' || r.prioridade === 'Alta'
          return false
        })
        const modalTitle = {
          all:        `Todas as iniciativas (${total})`,
          concluidas: `Concluídas (${nConcluido})`,
          emdev:      `Em desenvolvimento (${nEmDev})`,
          prio:       `Prioridade alta/crítica (${nPrioridade})`,
        }[modalFilter]
        const groupByEstado = modalFilter === 'all' || modalFilter === 'prio'
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                <span className="text-[14px] font-semibold text-gray-900">{modalTitle}</span>
                <button onClick={() => setShowAllModal(null)} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
              </div>
              <div className="overflow-y-auto divide-y divide-gray-100">
                {groupByEstado
                  ? ESTADOS.filter(e => e !== 'Descartado').map(estado => {
                      const group = modalItems.filter(r => r.estado === estado)
                      if (group.length === 0) return null
                      const col = ESTADO_COLS.find(c => c.estado === estado)
                      return (
                        <div key={estado}>
                          <div className="px-6 py-2 bg-gray-50">
                            <span className={clsx('text-[10px] font-semibold px-2 py-0.5 rounded-full', col?.color ?? 'bg-gray-100 text-gray-600')}>
                              {estado} · {group.length}
                            </span>
                          </div>
                          {group.map(item => <ModalRow key={item.id} item={item} />)}
                        </div>
                      )
                    })
                  : modalItems.map(item => <ModalRow key={item.id} item={item} />)
                }
                {modalItems.length === 0 && (
                  <div className="text-center text-[12px] text-gray-400 py-10">Nenhum item</div>
                )}
              </div>
            </div>
          </div>
        )
      })()}

      {/* Modal */}
      {modal && (
        <RoadmapModal
          initial={editing ? { ...editing } : { ...BLANK }}
          onSave={(data) => {
            if (editing) {
              updateRoadmapItem(editing.id, {
                ...data,
                completedAt: data.estado === 'Concluído' && !editing.completedAt
                  ? new Date().toISOString().slice(0, 10)
                  : editing.completedAt,
              })
            } else {
              addRoadmapItem(data)
            }
          }}
          onClose={() => { setModal(false); setEditing(null) }}
        />
      )}
    </div>
  )
}
