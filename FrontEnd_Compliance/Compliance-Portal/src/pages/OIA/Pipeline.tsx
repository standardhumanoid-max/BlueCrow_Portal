import { useState, useMemo, useEffect } from 'react'
import { sbLoad, sbSaveAll } from '@/services/supabaseStore'
import { API_BASE } from '@/lib/api'
import { Plus, Check, X, ChevronDown, AlertCircle } from 'lucide-react'
import clsx from 'clsx'

// ══════════════════════════════════════════════════════════════════════════════
// Types (mirror OIA types — kept local to avoid circular imports)
// ══════════════════════════════════════════════════════════════════════════════
type TrancheType   = 'Equity' | 'CLN' | 'SAFE' | 'Mútuo' | 'Prest. Suplementares' | 'Outro'
type PipelineKind  = 'investimento' | 'desinvestimento'
type PipelineState = 'Em análise' | 'Aprovado' | 'Rejeitado'

export interface PipelineItem {
  id: string
  kind: PipelineKind
  // Company reference
  companyId: string        // '' = nova empresa
  companyName: string
  // Operation details
  sector: string
  country: string
  stage: string
  fundId: string
  trancheType: TrancheType
  amount: number
  shares: number
  notes: string
  // Meta
  responsavel: string
  dataProposta: string     // DD.MM.YYYY
  estado: PipelineState
  observacoes: string
}

export interface CompanyRef { id: string; name: string; funds: string[] }
export interface FundRef    { id: string; shortName: string }

interface Props {
  kind: PipelineKind
  companies: CompanyRef[]
  funds: FundRef[]
  onApprove: (item: PipelineItem) => void
}

// ══════════════════════════════════════════════════════════════════════════════
// Constants
// ══════════════════════════════════════════════════════════════════════════════
const INV_KEY  = 'oia_pipeline_inv'
const DEINV_KEY = 'oia_pipeline_deinv'

const TRANCHE_TYPES: TrancheType[] = ['Equity','CLN','SAFE','Mútuo','Prest. Suplementares','Outro']
const RESPONSAVEIS_DEFAULT = ['Florbela Racine','Sandra Lage','Catarina Moreira','Nuno Gaspar','Sofia Lopes','Pedro Costa','Ana Ferreira']

const ESTADO_CLS: Record<PipelineState, string> = {
  'Em análise': 'bg-amber-100 text-amber-700',
  'Aprovado':   'bg-green-100 text-green-700',
  'Rejeitado':  'bg-gray-100 text-gray-500',
}

const load = <T,>(key: string, fallback: T[]): T[] => {
  try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : fallback } catch { return fallback }
}
const persist = <T,>(key: string, data: T[]) => {
  try { localStorage.setItem(key, JSON.stringify(data)) } catch {}
}

function todayStr() {
  const d = new Date()
  return `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()}`
}
function toInput(s: string) {
  const [d,m,y] = s.split('.'); return (d&&m&&y) ? `${y}-${m}-${d}` : ''
}
function fromInput(s: string) {
  const [y,m,d] = s.split('-'); return (y&&m&&d) ? `${d}.${m}.${y}` : ''
}

// ══════════════════════════════════════════════════════════════════════════════
// Nova Proposta Modal
// ══════════════════════════════════════════════════════════════════════════════
function NovaProposta({ kind, companies, funds, responsaveis, onClose, onSave }: {
  kind: PipelineKind
  companies: CompanyRef[]
  funds: FundRef[]
  responsaveis: string[]
  onClose: () => void
  onSave: (item: Omit<PipelineItem, 'id' | 'estado'>) => void
}) {
  const [existente, setExistente] = useState(false)
  const [form, setForm] = useState({
    companyId:    '',
    companyName:  '',
    sector:       '',
    country:      'Portugal',
    stage:        '',
    fundId:       funds[0]?.id ?? '',
    trancheType:  'Equity' as TrancheType,
    amount:       0,
    shares:       0,
    notes:        '',
    responsavel:  responsaveis[0] ?? '',
    dataProposta: todayStr(),
    observacoes:  '',
  })

  function set<K extends keyof typeof form>(k: K, v: typeof form[K]) {
    setForm(f => ({ ...f, [k]: v }))
  }

  function handleCompanySelect(id: string) {
    const co = companies.find(c => c.id === id)
    set('companyId', id)
    set('companyName', co?.name ?? '')
  }

  function handleSubmit() {
    if (!form.companyName.trim()) return
    onSave({ kind, ...form })
    onClose()
  }

  const isDesinv = kind === 'desinvestimento'

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl border border-gray-200 p-6 w-[600px] max-h-[90vh] overflow-y-auto shadow-xl"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-[14px] font-bold text-gray-900">
            {isDesinv ? 'Nova Proposta de Desinvestimento' : 'Nova Proposta de Investimento'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X size={16}/></button>
        </div>

        <div className="space-y-4">
          {/* Empresa existente? */}
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
            <label className="text-[12px] font-semibold text-gray-600 flex-1">
              {isDesinv ? 'Empresa/ativo já no portfolio?' : 'Empresa/ativo já existe no portfolio?'}
            </label>
            <button onClick={() => { setExistente(v => !v); set('companyId', ''); set('companyName', '') }}
              className={clsx('px-3 py-1 rounded-lg text-[11px] font-semibold transition-colors',
                existente ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-500')}>
              {existente ? 'Sim — existente' : 'Não — nova entrada'}
            </button>
          </div>

          {/* Company selector */}
          {existente ? (
            <div>
              <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">
                Empresa / Ativo
              </label>
              <select className="form-input text-[12px]" value={form.companyId}
                onChange={e => handleCompanySelect(e.target.value)}>
                <option value="">— Selecionar —</option>
                {companies.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">Nome</label>
                <input className="form-input text-[12px]" placeholder="Nome da empresa ou ativo"
                  value={form.companyName} onChange={e => set('companyName', e.target.value)}/>
              </div>
              <div>
                <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">Setor</label>
                <input className="form-input text-[12px]" placeholder="ex: Tecnologia"
                  value={form.sector} onChange={e => set('sector', e.target.value)}/>
              </div>
              <div>
                <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">País</label>
                <input className="form-input text-[12px]"
                  value={form.country} onChange={e => set('country', e.target.value)}/>
              </div>
              <div>
                <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">Stage</label>
                <input className="form-input text-[12px]" placeholder="ex: Seed, Series A…"
                  value={form.stage} onChange={e => set('stage', e.target.value)}/>
              </div>
            </div>
          )}

          {/* Operation */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">Fundo</label>
              <select className="form-input text-[12px]" value={form.fundId}
                onChange={e => set('fundId', e.target.value)}>
                {funds.map(f => <option key={f.id} value={f.id}>{f.shortName}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">
                {isDesinv ? 'Tipo de saída' : 'Tipo de instrumento'}
              </label>
              <select className="form-input text-[12px]" value={form.trancheType}
                onChange={e => set('trancheType', e.target.value as TrancheType)}>
                {TRANCHE_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">
                {isDesinv ? 'Proceeds esperados (€)' : 'Montante (€)'}
              </label>
              <input type="number" min="0" className="form-input text-[12px]"
                value={form.amount || ''} onChange={e => set('amount', Number(e.target.value))}/>
            </div>
            <div>
              <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">N.º Participações</label>
              <input type="number" min="0" className="form-input text-[12px]"
                value={form.shares || ''} onChange={e => set('shares', Number(e.target.value))}/>
            </div>
          </div>

          {/* Meta */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">Responsável</label>
              <select className="form-input text-[12px]" value={form.responsavel}
                onChange={e => set('responsavel', e.target.value)}>
                {responsaveis.map(r => <option key={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">Data da Proposta</label>
              <input type="date" className="form-input text-[12px]"
                value={toInput(form.dataProposta)}
                onChange={e => set('dataProposta', fromInput(e.target.value))}/>
            </div>
          </div>

          <div>
            <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">Notas da operação</label>
            <textarea className="form-input text-[12px] w-full resize-none" rows={2}
              value={form.notes} onChange={e => set('notes', e.target.value)}/>
          </div>
          <div>
            <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">Observações internas</label>
            <textarea className="form-input text-[12px] w-full resize-none" rows={2}
              value={form.observacoes} onChange={e => set('observacoes', e.target.value)}/>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-gray-100">
          <button onClick={onClose}
            className="text-[12px] text-gray-500 px-4 py-2 border border-gray-200 rounded-xl hover:bg-gray-50">
            Cancelar
          </button>
          <button onClick={handleSubmit}
            disabled={!form.companyName.trim()}
            className="text-[12px] text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40 px-4 py-2 rounded-xl transition-colors">
            Guardar proposta
          </button>
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// Pipeline Table
// ══════════════════════════════════════════════════════════════════════════════
export function Pipeline({ kind, companies, funds, onApprove }: Props) {
  const storageKey = kind === 'investimento' ? INV_KEY : DEINV_KEY
  const tableName  = kind === 'investimento' ? 'oia_pipeline_inv' : 'oia_pipeline_deinv'
  const [items, setItems] = useState<PipelineItem[]>(() => load(storageKey, []))
  const [responsaveis, setResponsaveis] = useState<string[]>(RESPONSAVEIS_DEFAULT)
  const [showModal, setShowModal] = useState(false)
  useEffect(() => { sbLoad<PipelineItem>(tableName, storageKey, []).then(setItems) }, [tableName, storageKey])
  useEffect(() => {
    fetch(`${API_BASE}/api/comp/portal_users`)
      .then(r => r.json())
      .then((rows: { name: string; active: boolean }[]) => {
        const names = rows.filter(u => u.active).map(u => u.name)
        if (names.length > 0) setResponsaveis(names)
      })
      .catch(() => {/* keep default */})
  }, [])
  const [filterEstado, setFilterEstado] = useState<PipelineState | 'Todos'>('Todos')

  function saveItems(updated: PipelineItem[]) {
    setItems(updated); sbSaveAll(tableName, storageKey, updated)
  }

  function addItem(data: Omit<PipelineItem, 'id' | 'estado'>) {
    saveItems([...items, { ...data, id: crypto.randomUUID(), estado: 'Em análise' }])
  }

  function approve(item: PipelineItem) {
    const msg = kind === 'investimento'
      ? item.companyId
        ? `Aprovar e adicionar tranche à empresa "${item.companyName}"?`
        : `Aprovar e criar nova empresa "${item.companyName}" no portfolio?`
      : `Aprovar desinvestimento de "${item.companyName}" e atualizar estado no portfolio?`
    if (!confirm(msg)) return
    saveItems(items.map(i => i.id === item.id ? { ...i, estado: 'Aprovado' } : i))
    onApprove({ ...item, estado: 'Aprovado' })
  }

  function reject(id: string) {
    if (!confirm('Rejeitar esta proposta?')) return
    saveItems(items.map(i => i.id === id ? { ...i, estado: 'Rejeitado' } : i))
  }

  function remove(id: string) {
    if (!confirm('Eliminar esta proposta?')) return
    saveItems(items.filter(i => i.id !== id))
  }

  const filtered = useMemo(() =>
    filterEstado === 'Todos' ? items : items.filter(i => i.estado === filterEstado),
  [items, filterEstado])

  const counts = useMemo(() => ({
    analise:  items.filter(i => i.estado === 'Em análise').length,
    aprovado: items.filter(i => i.estado === 'Aprovado').length,
    rejeitado:items.filter(i => i.estado === 'Rejeitado').length,
  }), [items])

  const isDesinv = kind === 'desinvestimento'
  const fundMap  = Object.fromEntries(funds.map(f => [f.id, f.shortName]))

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-[16px] font-bold text-gray-900">
            {isDesinv ? 'Pipeline de Desinvestimentos' : 'Pipeline de Investimentos'}
          </h2>
          <p className="text-[12px] text-gray-400 mt-0.5">
            {isDesinv
              ? 'Propostas de saída — aprovação integra automaticamente no portfolio'
              : 'Propostas de investimento — aprovação cria ou actualiza empresa no portfolio'}
          </p>
        </div>
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 text-[12px] text-white bg-blue-600 hover:bg-blue-700 px-3 py-2 rounded-xl transition-colors">
          <Plus size={13}/> Nova Proposta
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Em análise', val: counts.analise,  cls: 'text-amber-700 bg-amber-50 border-amber-100' },
          { label: 'Aprovado',   val: counts.aprovado,  cls: 'text-green-700 bg-green-50 border-green-100' },
          { label: 'Rejeitado',  val: counts.rejeitado, cls: 'text-gray-500  bg-gray-50  border-gray-100'  },
        ].map(k => (
          <div key={k.label} className={clsx('rounded-xl border px-4 py-3 flex items-center gap-3', k.cls)}>
            <p className="text-2xl font-bold">{k.val}</p>
            <p className="text-[11px] font-semibold">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2">
        {(['Todos', 'Em análise', 'Aprovado', 'Rejeitado'] as const).map(e => (
          <button key={e} onClick={() => setFilterEstado(e)}
            className={clsx('text-[11px] font-semibold px-3 py-1.5 rounded-lg border transition-colors',
              filterEstado === e
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300')}>
            {e}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <AlertCircle size={32} className="text-gray-200 mb-3"/>
            <p className="text-[13px] text-gray-400">Nenhuma proposta{filterEstado !== 'Todos' ? ` com estado "${filterEstado}"` : ''}.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  {['Empresa / Ativo','Fundo','Instrumento','Montante','Responsável','Data','Estado',''].map(h => (
                    <th key={h} className="text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wide px-4 py-2.5 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(item => (
                  <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="text-[12px] font-semibold text-gray-900">{item.companyName}</p>
                      {item.sector && <p className="text-[10px] text-gray-400">{item.sector}</p>}
                      {item.companyId && (
                        <span className="text-[9px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-semibold">existente</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[11px] text-gray-600 whitespace-nowrap">
                      {fundMap[item.fundId] ?? item.fundId}
                    </td>
                    <td className="px-4 py-3 text-[11px] text-gray-600 whitespace-nowrap">{item.trancheType}</td>
                    <td className="px-4 py-3 text-[12px] font-semibold text-gray-800 whitespace-nowrap">
                      {item.amount ? `${(item.amount / 1_000_000).toFixed(2)}M €` : '—'}
                    </td>
                    <td className="px-4 py-3 text-[11px] text-gray-600 whitespace-nowrap">{item.responsavel}</td>
                    <td className="px-4 py-3 text-[11px] text-gray-500 whitespace-nowrap">{item.dataProposta}</td>
                    <td className="px-4 py-3">
                      <span className={clsx('text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap', ESTADO_CLS[item.estado])}>
                        {item.estado}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 justify-end">
                        {item.estado === 'Em análise' && (
                          <>
                            <button onClick={() => approve(item)} title="Aprovar"
                              className="flex items-center gap-1 text-[10px] font-semibold text-green-700 bg-green-50 hover:bg-green-100 px-2 py-1 rounded-lg transition-colors">
                              <Check size={11}/> Aprovar
                            </button>
                            <button onClick={() => reject(item.id)} title="Rejeitar"
                              className="flex items-center gap-1 text-[10px] font-semibold text-red-500 bg-red-50 hover:bg-red-100 px-2 py-1 rounded-lg transition-colors">
                              <X size={11}/> Rejeitar
                            </button>
                          </>
                        )}
                        <button onClick={() => remove(item.id)} title="Eliminar"
                          className="text-gray-300 hover:text-red-400 transition-colors p-1">
                          <X size={12}/>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <NovaProposta
          kind={kind}
          companies={companies}
          funds={funds}
          responsaveis={responsaveis}
          onClose={() => setShowModal(false)}
          onSave={addItem}
        />
      )}
    </div>
  )
}
