import { useState, useMemo, useRef } from 'react'
import { Plus, FileSpreadsheet, Upload, Search, X, ChevronDown, ChevronUp, Pencil, Trash2, ChevronLeft, ChevronRight } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { KpiCard } from '@/components/ui/KpiCard'
import { useStore } from '@/store/useStore'
import { useAuth }  from '@/context/AuthContext'
// @ts-ignore — xlsx-js-style não tem types oficiais
import XLSXStyle from 'xlsx-js-style'
import type { Risk, ImpactoLevel, ProbabilidadeLevel, RiscoFinal } from '@/types'

// ── Classificação F1–F4 (Matriz de Grau de Risco Inerente) ────────────────────
const IMP_CODE: Record<ImpactoLevel, string> = {
  'Baixo': 'B', 'Médio Baixo': 'MB', 'Médio Alto': 'MA', 'Alto': 'A',
}
const PROB_CODE: Record<ProbabilidadeLevel, string> = {
  'Baixa': 'B', 'Médio Baixa': 'MB', 'Média Alta': 'MA', 'Alta': 'A',
}
const RISK_MATRIX: Record<string, RiscoFinal> = {
  // Alto impacto
  'AB': 'F3', 'AMB': 'F3', 'AMA': 'F4', 'AA': 'F4',
  // Médio Alto impacto
  'MAB': 'F2', 'MAMB': 'F2', 'MAMA': 'F3', 'MAA': 'F4',
  // Médio Baixo impacto
  'MBB': 'F1', 'MBMB': 'F1', 'MBMA': 'F2', 'MBA': 'F3',
  // Baixo impacto
  'BB': 'F1', 'BMB': 'F1', 'BMA': 'F2', 'BA': 'F3',
}
function getRiscoConcat(imp: ImpactoLevel, prob: ProbabilidadeLevel) {
  return IMP_CODE[imp] + PROB_CODE[prob]
}
function getRiscoFinal(imp: ImpactoLevel, prob: ProbabilidadeLevel): RiscoFinal {
  return RISK_MATRIX[getRiscoConcat(imp, prob)] ?? 'F1'
}

type RiscoInfo = { bg: string; text: string; border: string; label: string }
const RISCO_COLOR: Record<RiscoFinal, RiscoInfo> = {
  F1: { bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0', label: 'F1 — Baixo'   },
  F2: { bg: '#fefce8', text: '#a16207', border: '#fde68a', label: 'F2 — Médio'   },
  F3: { bg: '#fff7ed', text: '#c2410c', border: '#fed7aa', label: 'F3 — Alto'    },
  F4: { bg: '#fef2f2', text: '#b91c1c', border: '#fecaca', label: 'F4 — Crítico' },
}

const IMP_LEVELS:  ImpactoLevel[]       = ['Alto', 'Médio Alto', 'Médio Baixo', 'Baixo']
const PROB_LEVELS: ProbabilidadeLevel[] = ['Baixa', 'Médio Baixa', 'Média Alta', 'Alta']
const FREQ_OPTS = [
  'Diária',
  'Semanal',
  'Quinzenal',
  'Mensal',
  'Bimestral',
  'Trimestral',
  'Quadrimestral',
  'Semestral',
  'Anual',
  'Plurianual',
  'Ad hoc',
  'Sempre que existe uma subscrição/operação',
  'A cada fecho semestral do fundo',
  'Ongoing',
  'Pontual',
]

// ── Shared cell style helpers ─────────────────────────────────────────────────
const FILL_F1 = {fgColor:{rgb:'D1FAE5'}}
const FILL_F2 = {fgColor:{rgb:'FEF9C3'}}
const FILL_F3 = {fgColor:{rgb:'FFEDD5'}}
const FILL_F4 = {fgColor:{rgb:'FEE2E2'}}
const FILL_RISK_MAP: Record<RiscoFinal, unknown> = { F1:FILL_F1, F2:FILL_F2, F3:FILL_F3, F4:FILL_F4 }

const S = {
  grpProcesso: { font:{bold:true,color:{rgb:'FFFFFF'},sz:11}, fill:{fgColor:{rgb:'3A7D44'}}, alignment:{horizontal:'center',vertical:'center'} },
  grpRisco:    { font:{bold:true,color:{rgb:'FFFFFF'},sz:11}, fill:{fgColor:{rgb:'C0392B'}}, alignment:{horizontal:'center',vertical:'center'} },
  grpControlo: { font:{bold:true,color:{rgb:'FFFFFF'},sz:11}, fill:{fgColor:{rgb:'2980B9'}}, alignment:{horizontal:'center',vertical:'center'} },
  colHdr:      { font:{bold:true,sz:9}, fill:{fgColor:{rgb:'F3F4F6'}}, alignment:{horizontal:'center',vertical:'center',wrapText:true}, border:{bottom:{style:'thin',color:{rgb:'D1D5DB'}}} },
  cell:        { font:{sz:9}, alignment:{vertical:'center',wrapText:true} },
  cellAlt:     { font:{sz:9}, fill:{fgColor:{rgb:'F9FAFB'}}, alignment:{vertical:'center',wrapText:true} },
}

// ── Excel export ──────────────────────────────────────────────────────────────
function exportMatriz(risks: Risk[]) {
  const COL_HDRS = [
    'Entidade','Negócio/Suporte','Nome do Processo',
    'Owner do Processo / Área ou Departamento','Categoria de Risco',
    'Descrição do Risco','Owner do Risco',
    'Probabilidade de Ocorrência','Impacto Potencial',
    'Risco Inerente (código)','Risco Final',
    'Objetivos','Medidas Mitigadoras',
    'Responsável pelo Controlo','Frequência do Controlo',
  ]

  const ws: Record<string, unknown> = {}
  const RC = (r: number, c: number) => XLSXStyle.utils.encode_cell({ r, c })

  // Row 0 — group headers
  ws[RC(0,0)] = { v:'Processo', s:S.grpProcesso }
  ;[1,2,3,4].forEach(c => { ws[RC(0,c)] = { v:'', s:S.grpProcesso } })
  ws[RC(0,5)] = { v:'Risco', s:S.grpRisco }
  ;[6,7,8,9,10].forEach(c => { ws[RC(0,c)] = { v:'', s:S.grpRisco } })
  ws[RC(0,11)] = { v:'Controlo', s:S.grpControlo }
  ;[12,13,14].forEach(c => { ws[RC(0,c)] = { v:'', s:S.grpControlo } })

  // Row 1 — column headers
  COL_HDRS.forEach((v, c) => { ws[RC(1,c)] = { v, s:S.colHdr } })

  // Rows 2+ — data
  risks.forEach((r, i) => {
    const concat = getRiscoConcat(r.impacto, r.probabilidade)
    const final  = r.estado
    const fillCell  = { font:{sz:9}, fill: FILL_RISK_MAP[final], alignment:{vertical:'center',wrapText:true} }
    const baseStyle = i % 2 === 0 ? S.cell : S.cellAlt
    const vals: unknown[] = [
      r.entidade ?? '', r.negocioSuporte ?? '', r.nomeProcesso ?? '',
      r.ownerProcesso ?? '', r.categoria ?? '',
      r.risco ?? '', r.responsavel ?? '',
      r.probabilidade, r.impacto,
      concat, final,
      r.objetivos ?? '', r.mitigacao ?? '',
      r.responsavelControlo ?? '', r.frequenciaControlo ?? '',
    ]
    vals.forEach((v, c) => {
      ws[RC(i+2, c)] = { v, s: (c === 9 || c === 10) ? fillCell : baseStyle }
    })
  })

  ws['!ref'] = XLSXStyle.utils.encode_range({ s:{r:0,c:0}, e:{r:risks.length+1, c:14} })
  ws['!merges'] = [
    { s:{r:0,c:0 }, e:{r:0,c:4 } },
    { s:{r:0,c:5 }, e:{r:0,c:10} },
    { s:{r:0,c:11}, e:{r:0,c:14} },
  ]
  ws['!rows'] = [{ hpt: 22 }, { hpt: 36 }, ...risks.map(() => ({ hpt: 18 }))]
  ws['!cols'] = [
    {wch:16},{wch:14},{wch:22},{wch:32},{wch:18},
    {wch:32},{wch:18},{wch:16},{wch:14},{wch:10},{wch:10},
    {wch:28},{wch:30},{wch:28},{wch:16},
  ]

  const wb = XLSXStyle.utils.book_new()
  XLSXStyle.utils.book_append_sheet(wb, ws, 'Matriz de Risco')
  XLSXStyle.writeFile(wb, `matriz_risco_${new Date().toISOString().slice(0,10)}.xlsx`)
}

// ── Risk Detail Modal ─────────────────────────────────────────────────────────
function RiskDetailModal({ risk, canEdit, onClose, onEdit, onDelete }: {
  risk: Risk
  canEdit: boolean
  onClose: () => void
  onEdit: (r: Risk) => void
  onDelete: (r: Risk) => void
}) {
  const r  = risk
  const c  = RISCO_COLOR[r.estado as RiscoFinal] ?? RISCO_COLOR['F1']
  const cc = (IMP_CODE[r.impacto] ?? '?') + (PROB_CODE[r.probabilidade] ?? '?')
  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-[100] p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <div className="text-[14px] font-semibold text-gray-900 leading-snug">{r.risco}</div>
            <span className="inline-block mt-1.5 text-[11px] font-bold px-2.5 py-0.5 rounded-full"
              style={{ background: c.bg, color: c.text, border: `1px solid ${c.border}` }}>
              {cc} → {c.label}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-4">
            {canEdit && (
              <button onClick={() => onEdit(r)}
                className="flex items-center gap-1.5 text-[12px] font-semibold text-blue-600 hover:bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-lg transition-colors">
                <Pencil size={12}/> Editar
              </button>
            )}
            {canEdit && (
              <button onClick={() => onDelete(r)}
                className="flex items-center gap-1.5 text-[12px] font-semibold text-red-500 hover:bg-red-50 border border-red-200 px-3 py-1.5 rounded-lg transition-colors">
                <Trash2 size={12}/> Eliminar
              </button>
            )}
            <button onClick={onClose}
              className="flex items-center gap-1 text-[12px] text-gray-500 hover:bg-gray-100 border border-gray-200 px-3 py-1.5 rounded-lg transition-colors">
              <X size={12}/> Fechar
            </button>
          </div>
        </div>
        {/* Body */}
        <div className="px-6 py-5 space-y-5">
          <div className="grid grid-cols-3 gap-4 text-[12px]">
            {[
              { l: 'ID',          v: r.id },
              { l: 'Entidade',    v: r.entidade || '—' },
              { l: 'Negócio',     v: r.negocioSuporte || '—' },
              { l: 'Processo',    v: r.nomeProcesso || '—' },
              { l: 'Owner Proc.', v: r.ownerProcesso || '—' },
              { l: 'Categoria',   v: r.categoria || '—' },
            ].map(({ l, v }) => (
              <div key={l}>
                <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">{l}</div>
                <div className="text-gray-800">{v}</div>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-4 text-[12px] bg-gray-50 rounded-xl p-4">
            {[
              { l: 'Owner do Risco',   v: r.responsavel || '—' },
              { l: 'Probabilidade',    v: r.probabilidade },
              { l: 'Impacto',          v: r.impacto },
              { l: 'Resp. Controlo',   v: r.responsavelControlo || '—' },
              { l: 'Freq. Controlo',   v: r.frequenciaControlo || '—' },
            ].map(({ l, v }) => (
              <div key={l}>
                <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">{l}</div>
                <div className="text-gray-800">{v}</div>
              </div>
            ))}
            <div>
              <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">Risco Inerente</div>
              <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded" style={{ background: c.bg, color: c.text }}>
                {cc} → {r.estado}
              </span>
            </div>
          </div>
          {r.objetivos && (
            <div>
              <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Objetivos</div>
              <div className="text-[12px] text-gray-700 leading-relaxed">{r.objetivos}</div>
            </div>
          )}
          {r.mitigacao && (
            <div>
              <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Medidas Mitigadoras</div>
              <div className="text-[12px] text-gray-700 leading-relaxed">{r.mitigacao}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Form blank ────────────────────────────────────────────────────────────────
const BLANK: Omit<Risk,'id'|'created_at'> = {
  entidade: 'BlueCrow Capital', negocioSuporte: '', nomeProcesso: '', ownerProcesso: '',
  categoria: '', risco: '', responsavel: '',
  probabilidade: 'Médio Baixa', impacto: 'Médio Baixo',
  riscoConcatenado: 'MBMB', estado: 'F1',
  objetivos: '', mitigacao: '', responsavelControlo: '', frequenciaControlo: '',
}

// ── Component ─────────────────────────────────────────────────────────────────
export function GestaoRiscos() {
  const { risks, addRisk, updateRisk, deleteRisk, importRisks } = useStore()
  const { user } = useAuth()
  const canEdit   = user?.role === 'admin' || user?.role === 'gestor'
  const canImport = canEdit
  const fileInputRef = useRef<HTMLInputElement>(null)
  const tableRef     = useRef<HTMLDivElement>(null)
  const dragState    = useRef({ active: false, startX: 0, scrollLeft: 0 })

  function onTableMouseDown(e: React.MouseEvent<HTMLDivElement>) {
    const el = tableRef.current
    if (!el) return
    dragState.current = { active: true, startX: e.pageX - el.offsetLeft, scrollLeft: el.scrollLeft }
    el.style.cursor = 'grabbing'
    el.style.userSelect = 'none'
  }
  function onTableMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const el = tableRef.current
    if (!el || !dragState.current.active) return
    e.preventDefault()
    const x    = e.pageX - el.offsetLeft
    const walk = (x - dragState.current.startX) * 1.2
    el.scrollLeft = dragState.current.scrollLeft - walk
  }
  function onTableMouseUp() {
    const el = tableRef.current
    if (!el) return
    dragState.current.active = false
    el.style.cursor = 'grab'
    el.style.userSelect = ''
  }
  function scrollTable(dir: 'left' | 'right') {
    const el = tableRef.current
    if (!el) return
    el.scrollBy({ left: dir === 'left' ? -320 : 320, behavior: 'smooth' })
  }

  const [detailRisk, setDetailRisk] = useState<Risk | null>(null)   // modal de detalhe
  const [editingId,  setEditingId]  = useState<string | null>(null)  // null = novo risco
  const [modal, setModal] = useState(false)
  const [matrixOpen, setMatrixOpen] = useState(true)
  const [tab, setTab]     = useState<'matriz' | 'limites'>('matriz')
  const [form, setForm]   = useState<Omit<Risk,'id'|'created_at'>>(BLANK)
  const f = (k: keyof typeof form) => (v: string | number) => setForm(p => ({ ...p, [k]: v }))

  function openNew() { setEditingId(null); setForm(BLANK); setModal(true) }
  function openEdit(r: Risk) {
    setDetailRisk(null)
    setEditingId(r.id)
    const { id: _id, ...rest } = r as Risk & { id: string }
    setForm(rest as Omit<Risk,'id'|'created_at'>)
    setModal(true)
  }
  function handleDelete(r: Risk) {
    if (!confirm(`Eliminar o risco "${r.risco}"?\n\nEsta ação não pode ser revertida.`)) return
    if (detailRisk?.id === r.id) setDetailRisk(null)
    deleteRisk(r.id)
  }

  // ── Filters ─────────────────────────────────────────────────────────────
  const [search,       setSearch]       = useState('')
  const [filterCat,    setFilterCat]    = useState('')
  const [filterEstado, setFilterEstado] = useState<RiscoFinal | ''>('')
  const [filterProb,   setFilterProb]   = useState<ProbabilidadeLevel | ''>('')
  const [filterImp,    setFilterImp]    = useState<ImpactoLevel | ''>('')
  const [filterFreq,   setFilterFreq]   = useState('')
  const [filterResp,   setFilterResp]   = useState('')

  const hasFilter = !!(search || filterCat || filterEstado || filterProb || filterImp || filterFreq || filterResp)
  function clearFilters() {
    setSearch(''); setFilterCat(''); setFilterEstado(''); setFilterProb(''); setFilterImp(''); setFilterFreq(''); setFilterResp('')
  }

  const filtered = useMemo(() => risks.filter(r => {
    if (filterCat    && r.categoria       !== filterCat)    return false
    if (filterEstado && r.estado          !== filterEstado) return false
    if (filterProb   && r.probabilidade   !== filterProb)   return false
    if (filterImp    && r.impacto         !== filterImp)    return false
    if (filterFreq   && r.frequenciaControlo !== filterFreq) return false
    if (filterResp   && r.responsavel     !== filterResp)   return false
    if (search) {
      const q = search.toLowerCase()
      return (
        r.risco.toLowerCase().includes(q) ||
        (r.categoria?.toLowerCase().includes(q) ?? false) ||
        (r.entidade?.toLowerCase().includes(q) ?? false) ||
        r.responsavel.toLowerCase().includes(q) ||
        (r.nomeProcesso?.toLowerCase().includes(q) ?? false) ||
        (r.mitigacao?.toLowerCase().includes(q) ?? false) ||
        r.id.toLowerCase().includes(q)
      )
    }
    return true
  }), [risks, search, filterCat, filterEstado, filterProb, filterImp, filterFreq, filterResp])

  // ── Excel Import ─────────────────────────────────────────────────────────
  function importFromExcel(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async (ev) => {
      try {
        const wb = XLSXStyle.read(ev.target!.result, { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]

        // Read all rows as arrays — handles multi-row headers (our export has
        // a merged group header on row 0 and the real column names on row 1)
        const allRows: string[][] = XLSXStyle.utils.sheet_to_json(ws, { header: 1, defval: '' })

        // Find the header row: the first row that contains at least one of these keywords
        const ANCHOR = ['probabilidade', 'impacto', 'categoria', 'risco', 'processo', 'frequência', 'frequencia']
        let hdrIdx = 0
        for (let i = 0; i < Math.min(allRows.length, 5); i++) {
          const joined = allRows[i].join('|').toLowerCase()
          if (ANCHOR.some(k => joined.includes(k))) { hdrIdx = i; break }
        }
        const headers = allRows[hdrIdx].map(h => String(h ?? '').trim())
        const dataRows = allRows.slice(hdrIdx + 1).filter(r => r.some(c => String(c ?? '').trim() !== ''))

        // Find column index by matching any of the supplied substrings (case-insensitive)
        function col(...keywords: string[]) {
          for (const kw of keywords) {
            const idx = headers.findIndex(h => h.toLowerCase().includes(kw.toLowerCase()))
            if (idx >= 0) return idx
          }
          return -1
        }
        const get = (row: string[], c: number) => c >= 0 ? String(row[c] ?? '').trim() : ''

        // Exact match first, then substring
        function colExact(exact: string, ...fallbacks: string[]) {
          const e = headers.findIndex(h => h.toLowerCase() === exact.toLowerCase())
          if (e >= 0) return e
          return col(...fallbacks)
        }

        const CI = {
          id:          colExact('id'),
          entidade:    col('entidade'),
          negocio:     col('negócio', 'negocio'),
          nomeProc:    col('nome do processo'),
          ownerProc:   col('owner do processo', 'área ou departamento'),
          categoria:   col('categoria de risco', 'categoria'),
          descRisco:   col('descrição do risco', 'descrição do risco', 'risco'),
          ownerRisco:  col('owner do risco'),
          prob:        col('probabilidade'),
          imp:         col('impacto'),
          objetivos:   col('objetivos'),
          mitigacao:   col('medidas mitigadoras', 'mitigação', 'mitigacao', 'medidas'),
          respControl: col('responsável pelo controlo', 'responsavel pelo controlo'),
          freqControl: col('frequência do controlo', 'frequencia do controlo', 'frequência', 'frequencia'),
        }

        // Decode short codes (B / MB / MA / A) OR accept full Portuguese names
        const IMP_MAP: Record<string, ImpactoLevel> = {
          'a': 'Alto', 'alto': 'Alto',
          'ma': 'Médio Alto', 'médio alto': 'Médio Alto', 'medio alto': 'Médio Alto',
          'mb': 'Médio Baixo', 'médio baixo': 'Médio Baixo', 'medio baixo': 'Médio Baixo',
          'b': 'Baixo', 'baixo': 'Baixo',
        }
        const PROB_MAP: Record<string, ProbabilidadeLevel> = {
          'a': 'Alta', 'alta': 'Alta',
          'ma': 'Média Alta', 'média alta': 'Média Alta', 'media alta': 'Média Alta',
          'mb': 'Médio Baixa', 'médio baixa': 'Médio Baixa', 'medio baixa': 'Médio Baixa',
          'b': 'Baixa', 'baixa': 'Baixa',
        }

        const parsed: Risk[] = dataRows.map((row, i) => {
          const impRaw  = get(row, CI.imp).toLowerCase()
          const probRaw = get(row, CI.prob).toLowerCase()
          const imp     = IMP_MAP[impRaw]  ?? 'Médio Baixo' as ImpactoLevel
          const prob    = PROB_MAP[probRaw] ?? 'Médio Baixa' as ProbabilidadeLevel
          const concat  = getRiscoConcat(imp, prob)
          const estado  = (RISK_MATRIX[concat] ?? 'F1') as RiscoFinal
          return {
            id:                  get(row, CI.id)          || `R-${String(i + 1).padStart(2, '0')}`,
            entidade:            get(row, CI.entidade)    || 'BlueCrow Capital',
            negocioSuporte:      get(row, CI.negocio)     || '',
            nomeProcesso:        get(row, CI.nomeProc)    || '',
            ownerProcesso:       get(row, CI.ownerProc)   || '',
            categoria:           get(row, CI.categoria)   || '',
            risco:               get(row, CI.descRisco)   || '',
            responsavel:         get(row, CI.ownerRisco)  || '',
            probabilidade:       prob,
            impacto:             imp,
            riscoConcatenado:    concat,
            estado,
            objetivos:           get(row, CI.objetivos)   || '',
            mitigacao:           get(row, CI.mitigacao)   || '',
            responsavelControlo: get(row, CI.respControl) || '',
            frequenciaControlo:  get(row, CI.freqControl) || '',
          }
        })

        // Auto-download do backup JSON antes da substituição destrutiva
        if (risks.length > 0) {
          const blob = new Blob([JSON.stringify(risks, null, 2)], { type: 'application/json' })
          const url  = URL.createObjectURL(blob)
          const a    = document.createElement('a')
          a.href     = url
          a.download = `riscos_backup_${new Date().toISOString().slice(0, 10)}.json`
          document.body.appendChild(a)
          a.click()
          document.body.removeChild(a)
          URL.revokeObjectURL(url)
        }
        await importRisks(parsed)
        alert(`${parsed.length} risco(s) importado(s) com sucesso.`)
      } catch (err) {
        console.error('importFromExcel:', err)
        alert('Erro ao importar ficheiro. Verifique o formato do Excel.')
      }
      e.target.value = ''
    }
    reader.readAsArrayBuffer(file)
  }

  // unique values for filter dropdowns (from full list)
  const uCats  = useMemo(() => [...new Set(risks.map(r => r.categoria))].sort(), [risks])
  const uResps = useMemo(() => [...new Set(risks.map(r => r.responsavel))].sort(), [risks])
  const uFreqs = useMemo(() => [...new Set(risks.map(r => r.frequenciaControlo ?? '').filter(Boolean))].sort(), [risks])

  const nF4 = risks.filter(r => r.estado === 'F4').length
  const nF3 = risks.filter(r => r.estado === 'F3').length
  const nF2 = risks.filter(r => r.estado === 'F2').length
  const nF1 = risks.filter(r => r.estado === 'F1').length

  return (
    <div className="p-6 space-y-4">
      <div className="grid grid-cols-4 gap-3">
        <KpiCard label="F4 — Crítico" value={nF4} sub="ação imediata"         color="red"   trend="down"    active={filterEstado === 'F4'} onClick={() => setFilterEstado(v => v === 'F4' ? '' : 'F4')} />
        <KpiCard label="F3 — Alto"    value={nF3} sub="monitorização intensa" color="amber" trend="down"    active={filterEstado === 'F3'} onClick={() => setFilterEstado(v => v === 'F3' ? '' : 'F3')} />
        <KpiCard label="F2 — Médio"   value={nF2} sub="controlos em curso"    color="blue"  trend="neutral" active={filterEstado === 'F2'} onClick={() => setFilterEstado(v => v === 'F2' ? '' : 'F2')} />
        <KpiCard label="F1 — Baixo"   value={nF1} sub="gestão de rotina"      color="green" trend="up"      active={filterEstado === 'F1'} onClick={() => setFilterEstado(v => v === 'F1' ? '' : 'F1')} />
      </div>

      {/* Tabs */}
      <div className="tab-list">
        <button data-state={tab==='matriz'  ? 'active' : ''} className="tab-trigger" onClick={()=>setTab('matriz')}>Matriz de Risco</button>
        <button data-state={tab==='limites' ? 'active' : ''} className="tab-trigger" onClick={()=>setTab('limites')}>Limites Legais e Contratuais</button>
      </div>

      {/* ── Matriz tab ── */}
      {tab === 'matriz' && (
        <div className="space-y-4">
          {/* Visual matrix + actions row */}
          <div className="card overflow-hidden">
            {/* Collapsible header */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100">
              <span className="text-[11px] font-semibold text-gray-600 uppercase tracking-wider">Matriz de Grau de Risco Inerente</span>
              <div className="flex items-center gap-2">
                <div className="flex flex-wrap gap-2">
                  {(['F1','F2','F3','F4'] as RiscoFinal[]).map(fx=>(
                    <div key={fx} className="flex items-center gap-1">
                      <div className="w-2.5 h-2.5 rounded-sm" style={{background:RISCO_COLOR[fx].bg, border:`1px solid ${RISCO_COLOR[fx].border}`}}/>
                      <span className="text-[10px]" style={{color:RISCO_COLOR[fx].text}}>{RISCO_COLOR[fx].label}</span>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => setMatrixOpen(v => !v)}
                  className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-gray-700 border border-gray-200 rounded-lg px-2 py-1 transition-colors ml-2"
                >
                  {matrixOpen ? <><ChevronUp size={12}/> Colapsar</> : <><ChevronDown size={12}/> Expandir</>}
                </button>
              </div>
            </div>

            {matrixOpen && (
              <div className="p-4 flex gap-4">
                {/* 4×4 matrix */}
                <div className="flex-1">
                  <div className="grid gap-0.5" style={{ gridTemplateColumns: '72px repeat(4,1fr)' }}>
                    <div/>
                    {(['Baixa','Médio Baixa','Média Alta','Alta'] as ProbabilidadeLevel[]).map(p=>(
                      <div key={p} className="text-center text-[9px] text-gray-400 leading-tight pb-0.5">{p}</div>
                    ))}
                    {(['Alto','Médio Alto','Médio Baixo','Baixo'] as ImpactoLevel[]).map(imp=>(
                      [imp, ...(['Baixa','Médio Baixa','Média Alta','Alta'] as ProbabilidadeLevel[])].map((val, ci) => {
                        if (ci === 0) return (
                          <div key={`l-${imp}`} className="flex items-center justify-end pr-2 text-[9px] text-gray-400 leading-tight text-right">{imp}</div>
                        )
                        const prob = val as ProbabilidadeLevel
                        const fx   = getRiscoFinal(imp as ImpactoLevel, prob)
                        const c    = RISCO_COLOR[fx]
                        const dots = risks.filter(r => r.impacto === imp && r.probabilidade === prob)
                        return (
                          <div key={`cell-${imp}-${prob}`}
                            className="rounded flex items-start justify-center flex-wrap gap-1 p-1 min-h-[52px]"
                            style={{ background: c.bg, border: `1px solid ${c.border}` }}>
                            <span className="text-[9px] font-bold w-full text-center" style={{ color: c.text }}>{fx}</span>
                            {dots.map(r=>(
                              <button key={r.id} onClick={()=>setDetailRisk(r)}
                                className="w-5 h-5 rounded-full text-[8px] font-bold text-white flex items-center justify-center hover:scale-110 transition-transform"
                                style={{ background: c.text }} title={r.risco}>
                                {r.id.replace('R-','')}
                              </button>
                            ))}
                          </div>
                        )
                      })
                    ))}
                  </div>
                </div>

                {/* Actions panel */}
                <div className="flex flex-col gap-2 w-[170px] justify-end shrink-0">
                  <input ref={fileInputRef} type="file" accept=".xlsx" className="hidden" onChange={importFromExcel} />
                  {canImport && (
                    <button
                      onClick={() => {
                        if (!window.confirm(`⚠️ Esta operação irá APAGAR todos os ${risks.length} riscos existentes e substituí-los pelo conteúdo do ficheiro Excel.\n\nTem a certeza que pretende continuar?`)) return
                        fileInputRef.current?.click()
                      }}
                      className="flex items-center gap-2 justify-center bg-amber-500 hover:bg-amber-600 text-white text-[12px] font-semibold px-3 py-2 rounded-xl shadow-sm transition-colors"
                    >
                      <Upload size={13} /> Importar .xlsx
                    </button>
                  )}
                  <button onClick={() => exportMatriz(risks)}
                    className="flex items-center gap-2 justify-center bg-emerald-600 hover:bg-emerald-700 text-white text-[12px] font-semibold px-3 py-2 rounded-xl shadow-sm transition-colors"
                  >
                    <FileSpreadsheet size={13} /> Extrair Matriz
                  </button>
                  <button onClick={openNew}
                    className="flex items-center gap-2 justify-center bg-blue-600 hover:bg-blue-700 text-white text-[12px] font-semibold px-3 py-2 rounded-xl shadow-sm transition-colors"
                  >
                    <Plus size={13} /> Novo Risco
                  </button>
                </div>
              </div>
            )}

            {/* When collapsed, show action buttons inline */}
            {!matrixOpen && (
              <div className="flex items-center gap-2 px-4 py-3">
                <input ref={fileInputRef} type="file" accept=".xlsx" className="hidden" onChange={importFromExcel} />
                {canImport && (
                  <button onClick={() => { if (!window.confirm(`⚠️ APAGAR ${risks.length} riscos e substituir pelo Excel?`)) return; fileInputRef.current?.click() }}
                    className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-semibold px-3 py-1.5 rounded-lg transition-colors">
                    <Upload size={12}/> Importar .xlsx
                  </button>
                )}
                <button onClick={() => exportMatriz(risks)}
                  className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold px-3 py-1.5 rounded-lg transition-colors">
                  <FileSpreadsheet size={12}/> Extrair
                </button>
                <button onClick={openNew}
                  className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-semibold px-3 py-1.5 rounded-lg transition-colors">
                  <Plus size={12}/> Novo Risco
                </button>
              </div>
            )}
          </div>

          {/* ── Search bar ── */}
          <div className="flex items-center gap-3 bg-white rounded-xl border border-gray-200 px-3 py-2 shadow-sm">
            <Search size={14} className="text-gray-400 flex-shrink-0" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Pesquisar por risco, categoria, processo, responsável, ID…"
              className="flex-1 text-[12px] text-gray-700 placeholder-gray-400 outline-none bg-transparent"
            />
            {hasFilter && (
              <button onClick={clearFilters} className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-red-500 transition-colors">
                <X size={11}/> Limpar filtros
              </button>
            )}
            <span className="text-[10px] text-gray-400 flex-shrink-0">
              {filtered.length}/{risks.length} riscos
            </span>
          </div>

          {/* ── Main table with group headers ── */}
          <div className="relative">
            {/* Scroll buttons */}
            <button
              onClick={() => scrollTable('left')}
              className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-3 z-10 bg-white border border-gray-200 rounded-full shadow-md p-1.5 hover:bg-gray-50 transition-colors"
            >
              <ChevronLeft size={14} className="text-gray-500" />
            </button>
            <button
              onClick={() => scrollTable('right')}
              className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-3 z-10 bg-white border border-gray-200 rounded-full shadow-md p-1.5 hover:bg-gray-50 transition-colors"
            >
              <ChevronRight size={14} className="text-gray-500" />
            </button>

            <div
              ref={tableRef}
              className="bg-white rounded-xl border border-gray-100 overflow-x-auto overflow-y-auto shadow-sm cursor-grab select-none"
              style={{ maxHeight: 'calc(100vh - 320px)' }}
              onMouseDown={onTableMouseDown}
              onMouseMove={onTableMouseMove}
              onMouseUp={onTableMouseUp}
              onMouseLeave={onTableMouseUp}
            >
            <table className="w-full text-[11px] border-collapse" style={{ minWidth: 1400 }}>
              <thead>
                {/* Group header row */}
                <tr>
                  <th colSpan={5} className="py-2 text-center text-[11px] font-bold text-white tracking-wider" style={{ background: '#3a7d44' }}>
                    Processo
                  </th>
                  <th colSpan={6} className="py-2 text-center text-[11px] font-bold text-white tracking-wider" style={{ background: '#c0392b' }}>
                    Risco
                  </th>
                  <th colSpan={4} className="py-2 text-center text-[11px] font-bold text-white tracking-wider" style={{ background: '#2980b9' }}>
                    Controlo
                  </th>
                </tr>
                {/* Column headers */}
                <tr className="bg-gray-50 text-[10px] text-gray-600 font-semibold uppercase tracking-wide border-b border-gray-200">
                  {/* Processo */}
                  <th className="px-3 py-2 text-left border-r border-gray-200 whitespace-nowrap">Entidade</th>
                  <th className="px-3 py-2 text-left border-r border-gray-200 whitespace-nowrap">Negócio/<br/>Suporte</th>
                  <th className="px-3 py-2 text-left border-r border-gray-200 whitespace-nowrap">Nome do<br/>Processo</th>
                  <th className="px-3 py-2 text-left border-r border-gray-200 whitespace-nowrap">Owner do Processo /<br/>Área ou Departamento</th>
                  <th className="px-3 py-2 text-left border-r border-gray-200">
                    <div>Categoria de Risco</div>
                    <select value={filterCat} onChange={e=>setFilterCat(e.target.value)}
                      className="mt-1 w-full text-[9px] font-normal normal-case tracking-normal border border-gray-200 rounded px-1 py-0.5 bg-white text-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-400"
                      onClick={e=>e.stopPropagation()}>
                      <option value="">Todas</option>
                      {uCats.map(c=><option key={c} value={c}>{c}</option>)}
                    </select>
                  </th>
                  {/* Risco */}
                  <th className="px-3 py-2 text-left border-r border-gray-200 whitespace-nowrap">Descrição<br/>do Risco</th>
                  <th className="px-3 py-2 text-left border-r border-gray-200">
                    <div>Owner do Risco</div>
                    <select value={filterResp} onChange={e=>setFilterResp(e.target.value)}
                      className="mt-1 w-full text-[9px] font-normal normal-case tracking-normal border border-gray-200 rounded px-1 py-0.5 bg-white text-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-400"
                      onClick={e=>e.stopPropagation()}>
                      <option value="">Todos</option>
                      {uResps.map(r=><option key={r} value={r}>{r}</option>)}
                    </select>
                  </th>
                  <th className="px-3 py-2 text-center border-r border-gray-200">
                    <div>Probabilidade<br/>de Ocorrência</div>
                    <select value={filterProb} onChange={e=>setFilterProb(e.target.value as ProbabilidadeLevel | '')}
                      className="mt-1 w-full text-[9px] font-normal normal-case tracking-normal border border-gray-200 rounded px-1 py-0.5 bg-white text-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-400"
                      onClick={e=>e.stopPropagation()}>
                      <option value="">Todas</option>
                      {PROB_LEVELS.map(p=><option key={p} value={p}>{p}</option>)}
                    </select>
                  </th>
                  <th className="px-3 py-2 text-center border-r border-gray-200">
                    <div>Impacto<br/>Potencial</div>
                    <select value={filterImp} onChange={e=>setFilterImp(e.target.value as ImpactoLevel | '')}
                      className="mt-1 w-full text-[9px] font-normal normal-case tracking-normal border border-gray-200 rounded px-1 py-0.5 bg-white text-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-400"
                      onClick={e=>e.stopPropagation()}>
                      <option value="">Todos</option>
                      {IMP_LEVELS.map(i=><option key={i} value={i}>{i}</option>)}
                    </select>
                  </th>
                  <th className="px-3 py-2 text-center border-r border-gray-200 whitespace-nowrap">Risco<br/>Inerente</th>
                  <th className="px-3 py-2 text-center border-r border-gray-200">
                    <div>Risco Final</div>
                    <select value={filterEstado} onChange={e=>setFilterEstado(e.target.value as RiscoFinal | '')}
                      className="mt-1 w-full text-[9px] font-normal normal-case tracking-normal border border-gray-200 rounded px-1 py-0.5 bg-white text-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-400"
                      onClick={e=>e.stopPropagation()}>
                      <option value="">Todos</option>
                      <option value="F1">F1 — Baixo</option>
                      <option value="F2">F2 — Médio</option>
                      <option value="F3">F3 — Alto</option>
                      <option value="F4">F4 — Crítico</option>
                    </select>
                  </th>
                  {/* Controlo */}
                  <th className="px-3 py-2 text-left border-r border-gray-200 whitespace-nowrap">Objetivos</th>
                  <th className="px-3 py-2 text-left border-r border-gray-200 whitespace-nowrap">Medidas<br/>Mitigadoras</th>
                  <th className="px-3 py-2 text-left border-r border-gray-200 whitespace-nowrap">Responsável pelo Controlo /<br/>Owner do Controlo</th>
                  <th className="px-3 py-2 text-left">
                    <div>Frequência<br/>do Controlo</div>
                    <select value={filterFreq} onChange={e=>setFilterFreq(e.target.value)}
                      className="mt-1 w-full text-[9px] font-normal normal-case tracking-normal border border-gray-200 rounded px-1 py-0.5 bg-white text-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-400"
                      onClick={e=>e.stopPropagation()}>
                      <option value="">Todas</option>
                      {uFreqs.map(fr=><option key={fr} value={fr}>{fr}</option>)}
                    </select>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={15} className="py-10 text-center text-sm text-gray-400 italic">
                    {hasFilter ? 'Nenhum risco corresponde aos filtros aplicados.' : 'Sem riscos registados — clique em Novo Risco para adicionar.'}
                  </td></tr>
                )}
                {filtered.map((r, i) => {
                  const concat = (IMP_CODE[r.impacto] ?? '?') + (PROB_CODE[r.probabilidade] ?? '?')
                  const c      = RISCO_COLOR[r.estado as RiscoFinal] ?? RISCO_COLOR['F1']
                  const isActive = detailRisk?.id === r.id
                  return (
                    <tr key={r.id}
                      onClick={() => setDetailRisk(p => p?.id === r.id ? null : r)}
                      className="border-b border-gray-100 hover:bg-blue-50/30 cursor-pointer transition-colors"
                      style={{ background: isActive ? '#eff6ff' : i%2===0 ? '#fff' : '#fafafa' }}
                    >
                      <td className="px-3 py-1.5 border-r border-gray-100">{r.entidade||<span className="text-gray-300">—</span>}</td>
                      <td className="px-3 py-1.5 border-r border-gray-100">{r.negocioSuporte||<span className="text-gray-300">—</span>}</td>
                      <td className="px-3 py-1.5 border-r border-gray-100">{r.nomeProcesso||<span className="text-gray-300">—</span>}</td>
                      <td className="px-3 py-1.5 border-r border-gray-100">{r.ownerProcesso||<span className="text-gray-300">—</span>}</td>
                      <td className="px-3 py-1.5 border-r border-gray-100">{r.categoria||<span className="text-gray-300">—</span>}</td>
                      <td className="px-3 py-1.5 border-r border-gray-100 font-medium text-gray-900">{r.risco}</td>
                      <td className="px-3 py-1.5 border-r border-gray-100">{r.responsavel||<span className="text-gray-300">—</span>}</td>
                      <td className="px-3 py-1.5 border-r border-gray-100 text-center text-[10px]">{r.probabilidade}</td>
                      <td className="px-3 py-1.5 border-r border-gray-100 text-center text-[10px]">{r.impacto}</td>
                      <td className="px-3 py-1.5 border-r border-gray-100 text-center">
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded" style={{ background: c.bg, color: c.text }}>
                          {concat}
                        </span>
                      </td>
                      <td className="px-3 py-1.5 border-r border-gray-100 text-center">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: c.bg, color: c.text, border: `1px solid ${c.border}` }}>
                          {r.estado}
                        </span>
                      </td>
                      <td className="px-3 py-1.5 border-r border-gray-100 max-w-[180px]"><div className="truncate">{r.objetivos||<span className="text-gray-300">—</span>}</div></td>
                      <td className="px-3 py-1.5 border-r border-gray-100 max-w-[200px]"><div className="truncate">{r.mitigacao||<span className="text-gray-300">—</span>}</div></td>
                      <td className="px-3 py-1.5 border-r border-gray-100">{r.responsavelControlo||<span className="text-gray-300">—</span>}</td>
                      <td className="px-3 py-1.5">{r.frequenciaControlo||<span className="text-gray-300">—</span>}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Limites tab ── */}
      {tab === 'limites' && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Limites Legais e Contratuais</span>
            <button className="btn btn-primary btn-sm"><Plus size={12}/> Adicionar</button>
          </div>
          <table className="data-table w-full">
            <thead><tr><th>Limite</th><th>Tipo</th><th>Valor / Referência</th><th>Fonte</th><th>Vigência</th><th>Estado</th></tr></thead>
            <tbody>
              {[
                ['Limite de exposição por cliente','Contratual','€500.000','Contrato Quadro','Dez 2026','Ativo'],
                ['Reporte de transações suspeitas','Legal','Imediato (<24h)','Lei 83/2017','Permanente','Ativo'],
                ['Capital mínimo regulatório','Legal','€730.000','CVM Art. 12','Permanente','Ativo'],
                ['Prazo de conservação de documentos','Legal','10 anos','RGPD + Lei 83/2017','Permanente','Ativo'],
              ].map(([l,t,v,fo,vi,e])=>(
                <tr key={l}>
                  <td className="font-medium">{l}</td><td>{t}</td><td className="font-mono text-[11px]">{v}</td>
                  <td className="text-gray-400">{fo}</td><td>{vi}</td>
                  <td><Badge variant="green">{e}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Modal: Detalhe do Risco ── */}
      {detailRisk && (
        <RiskDetailModal
          risk={detailRisk}
          canEdit={canEdit}
          onClose={() => setDetailRisk(null)}
          onEdit={openEdit}
          onDelete={handleDelete}
        />
      )}

      {/* ── Modal: Novo / Editar Risco ── */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
              <div className="text-[15px] font-semibold text-gray-900">{editingId ? 'Editar Risco' : 'Novo Risco'}</div>
            </div>
            <div className="p-6 space-y-5">

              {/* Processo */}
              <div>
                <div className="text-[11px] font-bold uppercase tracking-widest mb-3 px-3 py-1.5 rounded-lg text-white" style={{ background: '#3a7d44' }}>Processo</div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="form-label">Entidade</label>
                    <input className="form-input" value={form.entidade??''} onChange={e=>f('entidade')(e.target.value)} placeholder="ex: BlueCrow SCR"/>
                  </div>
                  <div>
                    <label className="form-label">Negócio / Suporte</label>
                    <input className="form-input" value={form.negocioSuporte??''} onChange={e=>f('negocioSuporte')(e.target.value)} placeholder="ex: Gestão de Fundos, PBCFT, TI…" />
                  </div>
                  <div>
                    <label className="form-label">Nome do Processo</label>
                    <input className="form-input" value={form.nomeProcesso??''} onChange={e=>f('nomeProcesso')(e.target.value)} placeholder="ex: Gestão de Carteira"/>
                  </div>
                  <div>
                    <label className="form-label">Owner do Processo / Área ou Departamento</label>
                    <input className="form-input" value={form.ownerProcesso??''} onChange={e=>f('ownerProcesso')(e.target.value)} placeholder="ex: Compliance"/>
                  </div>
                  <div className="col-span-2">
                    <label className="form-label">Categoria de Risco</label>
                    <input className="form-input" value={form.categoria} onChange={e=>f('categoria')(e.target.value)} placeholder="ex: Risco de Mercado, Risco Operacional…"/>
                  </div>
                </div>
              </div>

              {/* Risco */}
              <div>
                <div className="text-[11px] font-bold uppercase tracking-widest mb-3 px-3 py-1.5 rounded-lg text-white" style={{ background: '#c0392b' }}>Risco</div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="form-label">Descrição do Risco</label>
                    <input className="form-input" value={form.risco} onChange={e=>f('risco')(e.target.value)} placeholder="Descreva o risco"/>
                  </div>
                  <div>
                    <label className="form-label">Owner do Risco</label>
                    <input className="form-input" value={form.responsavel} onChange={e=>f('responsavel')(e.target.value)} placeholder="Nome / Função"/>
                  </div>
                  <div>
                    <label className="form-label">Probabilidade de Ocorrência</label>
                    <select className="form-input" value={form.probabilidade} onChange={e=>f('probabilidade')(e.target.value)}>
                      {PROB_LEVELS.map(o=><option key={o}>{o}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="form-label">Impacto Potencial</label>
                    <select className="form-input" value={form.impacto} onChange={e=>f('impacto')(e.target.value)}>
                      {IMP_LEVELS.map(o=><option key={o}>{o}</option>)}
                    </select>
                  </div>
                  <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-4 py-3 border border-gray-200">
                    <div>
                      <div className="text-[10px] text-gray-400 uppercase tracking-wide">Risco Inerente (calculado)</div>
                      {(() => {
                        const f2 = getRiscoFinal(form.impacto, form.probabilidade)
                        const c  = RISCO_COLOR[f2]
                        return (
                          <div className="text-[14px] font-bold mt-0.5" style={{ color: c.text }}>
                            {getRiscoConcat(form.impacto, form.probabilidade)} → {c.label}
                          </div>
                        )
                      })()}
                    </div>
                  </div>
                </div>
              </div>

              {/* Controlo */}
              <div>
                <div className="text-[11px] font-bold uppercase tracking-widest mb-3 px-3 py-1.5 rounded-lg text-white" style={{ background: '#2980b9' }}>Controlo</div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="form-label">Objetivos</label>
                    <input className="form-input" value={form.objetivos??''} onChange={e=>f('objetivos')(e.target.value)} placeholder="Objetivos do controlo"/>
                  </div>
                  <div className="col-span-2">
                    <label className="form-label">Medidas Mitigadoras</label>
                    <textarea className="form-input" rows={2} value={form.mitigacao} onChange={e=>f('mitigacao')(e.target.value)} placeholder="Descreva as medidas de mitigação"/>
                  </div>
                  <div>
                    <label className="form-label">Responsável pelo Controlo / Owner do Controlo</label>
                    <input className="form-input" value={form.responsavelControlo??''} onChange={e=>f('responsavelControlo')(e.target.value)} placeholder="Nome / Função"/>
                  </div>
                  <div>
                    <label className="form-label">Frequência do Controlo</label>
                    <select className="form-input" value={form.frequenciaControlo??''} onChange={e=>f('frequenciaControlo')(e.target.value)}>
                      <option value="">—</option>
                      {FREQ_OPTS.map(o=><option key={o}>{o}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100 sticky bottom-0 bg-white">
              <button onClick={() => { setModal(false); setEditingId(null) }} className="btn btn-outline btn-sm">Cancelar</button>
              <button
                onClick={() => {
                  if (!form.risco) return
                  const concat = getRiscoConcat(form.impacto, form.probabilidade)
                  const estado = getRiscoFinal(form.impacto, form.probabilidade)
                  const data   = { ...form, riscoConcatenado: concat, estado }
                  if (editingId) {
                    updateRisk(editingId, data)
                  } else {
                    addRisk(data)
                  }
                  setModal(false)
                  setEditingId(null)
                }}
                className="btn btn-primary btn-sm"
              >Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
