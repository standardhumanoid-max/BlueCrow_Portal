import { useState, useMemo, useEffect } from 'react'
import { sbLoad, sbSaveAll, sbDelete } from '@/services/supabaseStore'
import { Plus, Trash2, X, ChevronDown } from 'lucide-react'
import clsx from 'clsx'

// ══════════════════════════════════════════════════════════════════════════════
// Types & Constants
// ══════════════════════════════════════════════════════════════════════════════
type ValorCriterio = 'Sim' | 'Não' | ''

const CRITERIOS = [
  { id: 'politica',      label: 'Política de investimento',             required: true  },
  { id: 'periodo',       label: 'Período de investimento',              required: true  },
  { id: 'duracao',       label: 'Duração do Fundo',                     required: true  },
  { id: 'duracaoPrev',   label: 'Duração prevista para o investimento',  required: true  },
  { id: 'setores',       label: 'Setores de investimento',              required: true  },
  { id: 'geografico',    label: 'Setores geográficos',                  required: true  },
  { id: 'targetMin',     label: 'Targets mínimos de investimento',      required: true  },
  { id: 'targetMax',     label: 'Targets máximos de investimento',      required: true  },
  { id: 'liquidez',      label: 'Liquidez financeira',                  required: true  },
  { id: 'investPrevios', label: 'Investimentos prévios no mesmo setor', required: false },
] as const

type CriterioId = typeof CRITERIOS[number]['id']

interface FundMeta { id: string; shortName: string; type: 'FCR' | 'FIAA' | 'PPR' }

const ALL_FUNDS: FundMeta[] = [
  { id:'BCDF1A',   shortName:'BCDF I / A',          type:'FCR'  },
  { id:'BCDF1B',   shortName:'BCDF I / B',          type:'FCR'  },
  { id:'BCDF1C',   shortName:'BCDF I / C',          type:'FCR'  },
  { id:'BCDF1D',   shortName:'BCDF I / D',          type:'FCR'  },
  { id:'BCDF1E',   shortName:'BCDF I / E',          type:'FCR'  },
  { id:'BCIF1',    shortName:'BCIF I',              type:'FCR'  },
  { id:'BCIF2',    shortName:'BCIF II',             type:'FCR'  },
  { id:'BCIF3',    shortName:'BCIF III',            type:'FCR'  },
  { id:'BCIF4',    shortName:'BCIF IV',             type:'FCR'  },
  { id:'BCIF5',    shortName:'BCIF V',              type:'FCR'  },
  { id:'VF',       shortName:'Viriatus',            type:'FCR'  },
  { id:'BCG1',     shortName:'BCG I',               type:'FCR'  },
  { id:'BCN1',     shortName:'BCN I',               type:'FCR'  },
  { id:'BCIMPACT', shortName:'BC Impact',           type:'FCR'  },
  { id:'BCNT1',    shortName:'BCNT I',              type:'FCR'  },
  { id:'GGT',      shortName:'GGT',                 type:'FCR'  },
  { id:'BCLPF',    shortName:'BC Listed Property',  type:'FIAA' },
  { id:'BCGDF',    shortName:'BC Global Discovery', type:'FIAA' },
  { id:'BCSTF',    shortName:'BC Short Term',       type:'FIAA' },
  { id:'BCPSF',    shortName:'BC Portugal Select',  type:'FIAA' },
  { id:'BCTFF',    shortName:'BC Trade Finance',    type:'FIAA' },
  { id:'BCOPPR',   shortName:'BC Global Opp. PPR',  type:'PPR'  },
]

interface Comparacao {
  id: string
  nome: string
  fundIds: string[]
  valores: Partial<Record<string, Partial<Record<CriterioId, ValorCriterio>>>>
  createdAt: string
}

const COMP_KEY = 'oia_comparacoes'

const load = <T,>(key: string, fallback: T[]): T[] => {
  try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : fallback } catch { return fallback }
}
const save = <T,>(key: string, data: T[]) => {
  try { localStorage.setItem(key, JSON.stringify(data)) } catch {}
}

function todayStr() {
  const d = new Date()
  return `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()}`
}

const TYPE_CLS: Record<string, string> = {
  FCR:  'bg-blue-50 text-blue-600 border border-blue-100',
  FIAA: 'bg-violet-50 text-violet-600 border border-violet-100',
  PPR:  'bg-amber-50 text-amber-600 border border-amber-100',
}

// ── Formula: all required criteria must be 'Sim' ─────────────────────────────
function calcResultado(comp: Comparacao, fundId: string): 'INVESTIR' | 'NÃO INVESTIR' | '' {
  const vals = comp.valores[fundId] ?? {}
  const allFilled = CRITERIOS.filter(c => c.required).every(c => vals[c.id] !== undefined && vals[c.id] !== '')
  if (!allFilled) return ''
  return CRITERIOS.filter(c => c.required).every(c => vals[c.id] === 'Sim')
    ? 'INVESTIR'
    : 'NÃO INVESTIR'
}

// ── Cell toggle ───────────────────────────────────────────────────────────────
function nextValor(v: ValorCriterio): ValorCriterio {
  if (v === '')    return 'Sim'
  if (v === 'Sim') return 'Não'
  return ''
}

// ══════════════════════════════════════════════════════════════════════════════
// Fund selector modal
// ══════════════════════════════════════════════════════════════════════════════
function FundSelectorModal({ selectedIds, onClose, onConfirm, allFunds }: {
  selectedIds: string[]
  onClose: () => void
  onConfirm: (ids: string[]) => void
  allFunds: FundMeta[]
}) {
  const [sel, setSel] = useState<Set<string>>(new Set(selectedIds))

  const toggle = (id: string) =>
    setSel(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })

  const fcr  = allFunds.filter(f => f.type === 'FCR')
  const fiaa = allFunds.filter(f => f.type === 'FIAA')
  const ppr  = allFunds.filter(f => f.type === 'PPR')

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl border border-gray-200 p-6 w-[520px] max-h-[80vh] overflow-y-auto shadow-xl"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[14px] font-bold text-gray-900">Selecionar Fundos</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X size={16}/></button>
        </div>

        {[{ label: 'FCR — Capitais de Risco', funds: fcr }, { label: 'FIAA — Mobiliários', funds: fiaa }, { label: 'PPR', funds: ppr }].map(group => (
          <div key={group.label} className="mb-4">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">{group.label}</p>
            <div className="flex flex-wrap gap-2">
              {group.funds.map(f => (
                <button key={f.id} onClick={() => toggle(f.id)}
                  className={clsx(
                    'text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition-colors',
                    sel.has(f.id)
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300',
                  )}>
                  {f.shortName}
                </button>
              ))}
            </div>
          </div>
        ))}

        <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-gray-100">
          <button onClick={onClose}
            className="text-[12px] text-gray-500 px-4 py-2 border border-gray-200 rounded-xl hover:bg-gray-50">
            Cancelar
          </button>
          <button onClick={() => onConfirm(Array.from(sel))}
            className="text-[12px] text-white bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-xl">
            Confirmar ({sel.size})
          </button>
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// Comparison Table
// ══════════════════════════════════════════════════════════════════════════════
function CompTable({ comp, onChange, allFunds }: {
  comp: Comparacao
  onChange: (updated: Comparacao) => void
  allFunds: FundMeta[]
}) {
  const funds = allFunds.filter(f => comp.fundIds.includes(f.id))

  function toggleCell(fundId: string, cId: CriterioId) {
    const cur = comp.valores[fundId]?.[cId] ?? ''
    onChange({
      ...comp,
      valores: {
        ...comp.valores,
        [fundId]: { ...comp.valores[fundId], [cId]: nextValor(cur) },
      },
    })
  }

  function removeFund(fundId: string) {
    const { [fundId]: _, ...rest } = comp.valores
    onChange({ ...comp, fundIds: comp.fundIds.filter(id => id !== fundId), valores: rest })
  }

  if (funds.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-[13px] text-gray-400">Nenhum fundo selecionado.</p>
        <p className="text-[12px] text-gray-300 mt-1">Clique em "Adicionar Fundos" para começar.</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="border-collapse" style={{ minWidth: `${200 + funds.length * 110}px` }}>
        <thead>
          <tr className="bg-gray-50">
            <th className="text-left text-[11px] font-bold text-gray-700 px-4 py-3 border border-gray-200 min-w-[200px] sticky left-0 bg-gray-50 z-10">
              Compatibilidade dos critérios
            </th>
            {funds.map(f => (
              <th key={f.id} className="border border-gray-200 px-2 py-2 min-w-[100px] max-w-[120px]">
                <div className="flex flex-col items-center gap-1">
                  <span className={clsx('text-[8px] font-bold px-1 py-0.5 rounded', TYPE_CLS[f.type])}>{f.type}</span>
                  <span className="text-[10px] font-bold text-gray-800 text-center leading-tight">{f.shortName}</span>
                  <button onClick={() => removeFund(f.id)}
                    className="text-gray-300 hover:text-red-400 transition-colors mt-0.5">
                    <X size={10}/>
                  </button>
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {CRITERIOS.map((crit, idx) => (
            <tr key={crit.id} className={clsx(idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50')}>
              <td className={clsx(
                'px-4 py-2.5 border border-gray-200 text-[11px] font-semibold sticky left-0 z-10',
                idx % 2 === 0 ? 'bg-white' : 'bg-gray-50',
                !crit.required && 'text-gray-400 italic',
              )}>
                {crit.label}
                {!crit.required && (
                  <span className="ml-1.5 text-[9px] font-normal text-gray-400">(não obrigatório)</span>
                )}
              </td>
              {funds.map(f => {
                const val = comp.valores[f.id]?.[crit.id] ?? ''
                return (
                  <td key={f.id} className="border border-gray-200 text-center p-1.5">
                    <button
                      onClick={() => toggleCell(f.id, crit.id)}
                      className={clsx(
                        'w-full min-w-[72px] px-2 py-1 rounded-lg text-[11px] font-semibold transition-colors',
                        val === 'Sim' ? 'bg-green-100 text-green-700 hover:bg-green-200' :
                        val === 'Não' ? 'bg-red-100 text-red-600 hover:bg-red-200'       :
                        'bg-gray-100 text-gray-300 hover:bg-gray-200',
                      )}
                      title="Clique para alternar"
                    >
                      {val || '—'}
                    </button>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-gray-100 border-t-2 border-gray-300">
            <td className="px-4 py-3 text-[11px] font-bold text-gray-900 border border-gray-200 sticky left-0 bg-gray-100 z-10 uppercase tracking-wide">
              Resultado
            </td>
            {funds.map(f => {
              const res = calcResultado(comp, f.id)
              return (
                <td key={f.id} className="border border-gray-200 text-center p-2">
                  <span className={clsx(
                    'px-2 py-1 rounded-lg text-[10px] font-bold whitespace-nowrap',
                    res === 'INVESTIR'     ? 'bg-green-600 text-white'   :
                    res === 'NÃO INVESTIR' ? 'bg-red-600 text-white'     :
                    'bg-gray-100 text-gray-300',
                  )}>
                    {res || '—'}
                  </span>
                </td>
              )
            })}
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// Main Comparacao page
// ══════════════════════════════════════════════════════════════════════════════
export function Comparacao() {
  const [allFunds, setAllFunds] = useState<FundMeta[]>(ALL_FUNDS)
  const [comps,    setComps]    = useState<Comparacao[]>(() => load(COMP_KEY, []))
  const [activeId, setActiveId] = useState<string | null>(() => {
    const saved = load<Comparacao>(COMP_KEY, [])
    return saved[0]?.id ?? null
  })
  useEffect(() => {
    sbLoad<FundMeta>('oia_funds', 'oia_all_funds_meta', ALL_FUNDS)
      .then(rows => rows.map(r => ({ ...r, shortName: (r as any).shortname ?? r.shortName })))
      .then(setAllFunds)
  }, [])
  useEffect(() => {
    sbLoad<Comparacao>('oia_comparacoes', COMP_KEY, []).then(data => {
      setComps(data)
      setActiveId(prev => prev ?? data[0]?.id ?? null)
    })
  }, [])
  const [showFundSel, setShowFundSel] = useState(false)
  const [editingName, setEditingName] = useState(false)

  const active = comps.find(c => c.id === activeId) ?? null

  function persist(updated: Comparacao[]) {
    setComps(updated)
    sbSaveAll('oia_comparacoes', COMP_KEY, updated)
  }

  function createNew() {
    const c: Comparacao = {
      id: crypto.randomUUID(),
      nome: 'Nova Comparação',
      fundIds: [],
      valores: {},
      createdAt: todayStr(),
    }
    persist([...comps, c])
    setActiveId(c.id)
    setEditingName(true)
  }

  function deleteComp(id: string) {
    if (!confirm('Eliminar esta comparação?')) return
    const comp = comps.find(c => c.id === id)
    const updated = comps.filter(c => c.id !== id)
    setComps(updated)
    sbDelete('oia_comparacoes', COMP_KEY, id, comp?.name ?? id)
    if (activeId === id) setActiveId(updated[0]?.id ?? null)
  }

  function updateActive(updated: Comparacao) {
    persist(comps.map(c => c.id === updated.id ? updated : c))
  }

  function handleFundsConfirm(ids: string[]) {
    if (!active) return
    updateActive({ ...active, fundIds: ids })
    setShowFundSel(false)
  }

  const investirCount = useMemo(() => {
    if (!active) return 0
    return active.fundIds.filter(fid => calcResultado(active, fid) === 'INVESTIR').length
  }, [active])

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div>
        <h2 className="text-[16px] font-bold text-gray-900">Comparação de Fundos</h2>
        <p className="text-[12px] text-gray-400 mt-0.5">
          Avalie a compatibilidade de um potencial investimento com os critérios de cada fundo
        </p>
      </div>

      {/* Top bar */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Saved comparisons selector */}
        {comps.length > 0 && (
          <div className="relative">
            <select
              value={activeId ?? ''}
              onChange={e => setActiveId(e.target.value)}
              className="pl-3 pr-8 py-2 text-[12px] border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 appearance-none cursor-pointer"
            >
              {comps.map(c => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </select>
            <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"/>
          </div>
        )}

        <button onClick={createNew}
          className="flex items-center gap-1.5 text-[12px] text-white bg-blue-600 hover:bg-blue-700 px-3 py-2 rounded-xl transition-colors">
          <Plus size={13}/> Nova Comparação
        </button>

        {active && (
          <>
            <button onClick={() => setShowFundSel(true)}
              className="flex items-center gap-1.5 text-[12px] text-blue-600 border border-blue-200 hover:bg-blue-50 px-3 py-2 rounded-xl transition-colors">
              <Plus size={13}/> Adicionar Fundos
            </button>
            <button onClick={() => deleteComp(active.id)}
              className="flex items-center gap-1.5 text-[12px] text-red-400 border border-red-200 hover:bg-red-50 px-3 py-2 rounded-xl transition-colors">
              <Trash2 size={13}/> Eliminar
            </button>
          </>
        )}
      </div>

      {/* Active comparison */}
      {!active ? (
        <div className="bg-white rounded-2xl border border-gray-100 flex flex-col items-center justify-center py-20 text-center">
          <p className="text-[13px] text-gray-400">Nenhuma comparação criada.</p>
          <button onClick={createNew}
            className="mt-3 text-[12px] text-blue-600 hover:text-blue-800 underline">
            Criar nova comparação
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          {/* Comparison header */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
            <div className="flex items-center gap-3 min-w-0">
              {editingName ? (
                <input
                  autoFocus
                  className="text-[14px] font-bold text-gray-900 border-b border-blue-400 focus:outline-none bg-transparent"
                  value={active.nome}
                  onChange={e => updateActive({ ...active, nome: e.target.value })}
                  onBlur={() => setEditingName(false)}
                  onKeyDown={e => e.key === 'Enter' && setEditingName(false)}
                />
              ) : (
                <button
                  className="text-[14px] font-bold text-gray-900 hover:text-blue-600 transition-colors text-left"
                  onClick={() => setEditingName(true)}
                  title="Clique para renomear"
                >
                  {active.nome}
                </button>
              )}
              <span className="text-[10px] text-gray-400">{active.createdAt}</span>
            </div>
            <div className="flex items-center gap-3 text-[11px] text-gray-500 flex-shrink-0">
              <span>{active.fundIds.length} fundo{active.fundIds.length !== 1 ? 's' : ''}</span>
              {investirCount > 0 && (
                <span className="bg-green-100 text-green-700 font-semibold px-2 py-0.5 rounded-full">
                  {investirCount} INVESTIR
                </span>
              )}
            </div>
          </div>

          {/* Table */}
          <CompTable comp={active} onChange={updateActive} allFunds={allFunds}/>
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-4 text-[10px] text-gray-400">
        <span className="flex items-center gap-1.5">
          <span className="w-4 h-4 rounded bg-green-100 inline-block"/> Sim
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-4 h-4 rounded bg-red-100 inline-block"/> Não
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-4 h-4 rounded bg-gray-100 inline-block"/> Não definido
        </span>
        <span className="ml-2 text-gray-300">·</span>
        <span>Resultado: todos os critérios obrigatórios = Sim → <strong className="text-green-600">INVESTIR</strong>, caso contrário → <strong className="text-red-600">NÃO INVESTIR</strong></span>
      </div>

      {showFundSel && active && (
        <FundSelectorModal
          selectedIds={active.fundIds}
          onClose={() => setShowFundSel(false)}
          onConfirm={handleFundsConfirm}
          allFunds={allFunds}
        />
      )}
    </div>
  )
}
