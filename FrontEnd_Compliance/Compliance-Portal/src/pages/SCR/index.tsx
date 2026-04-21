import { useState, useRef, useEffect, useMemo } from 'react'
import { sbLoad, sbSaveAll } from '@/services/supabaseStore'
import {
  ChevronDown, ChevronRight, Search, TrendingUp, Layers, BarChart3, Briefcase,
  Eye, Trash2, File, X, Upload, Plus, Pencil, Check,
  MessageSquare, Send, Key,
} from 'lucide-react'
import clsx from 'clsx'
import { useAuth } from '@/context/AuthContext'
import { authFetch, API_BASE } from '@/lib/api'

// ══════════════════════════════════════════════════════════════════════════════
// Types
// ══════════════════════════════════════════════════════════════════════════════
type FundType   = 'FCR' | 'FIAA' | 'PPR'
type FundStatus = 'Ativo' | 'Em liquidação' | 'Fechado'

type DocCategory =
  | 'Atas AGP'       | 'Banco Depositário' | 'BS / PI'              | 'CMVM'
  | 'Contrato de Introdução' | 'DIF'        | 'Documento Único'      | 'Investidores'
  | 'Parceiros'      | 'Prospecto'          | 'Registos'             | 'Regulamentos de Gestão'

interface Fund {
  id: string; name: string; shortName: string
  type: FundType; vintage: number; size: string; status: FundStatus
}

interface FundDoc {
  id: string; fundId: string; category: DocCategory
  fileName: string; fileData: string; fileType: string; uploadedAt: string
}

interface PeriodoSubscricao {
  id: string; inicio: string; fim: string   // DD.MM.YYYY
}

interface FundInfo {
  id: string
  fundId: string
  dataCriacao: string              // DD.MM.YYYY
  periodos: PeriodoSubscricao[]
  montanteSubscricao: string
  valorUPs: string
  duracaoAnos: number              // base
  extensaoAnos: number             // extra (0 = sem extensão)
  percForaPortugal: number | ''    // % máxima de investimentos fora de Portugal
  politicaInvestimento: string
}

// ══════════════════════════════════════════════════════════════════════════════
// Constants
// ══════════════════════════════════════════════════════════════════════════════
const DOCS_KEY  = 'scr_fund_docs'
const INFO_KEY  = 'scr_fund_info'

const DOC_CATEGORIES: DocCategory[] = [
  'Atas AGP', 'Banco Depositário', 'BS / PI', 'CMVM',
  'Contrato de Introdução', 'DIF', 'Documento Único', 'Investidores',
  'Parceiros', 'Prospecto', 'Registos', 'Regulamentos de Gestão',
]

const ALL_FUNDS: Fund[] = [
  { id:'BCIF1',    shortName:'BCIF I',              name:'BlueCrow Innovation Fund I, FCR',                                                            type:'FCR',  vintage:2012, size:'—',     status:'Ativo' },
  { id:'BCIF2',    shortName:'BCIF II',             name:'BlueCrow Innovation Fund II, FCR',                                                           type:'FCR',  vintage:2015, size:'—',     status:'Ativo' },
  { id:'BCIF3',    shortName:'BCIF III',            name:'BlueCrow Innovation Fund III, FCR',                                                          type:'FCR',  vintage:2017, size:'—',     status:'Ativo' },
  { id:'BCIF4',    shortName:'BCIF IV',             name:'BlueCrow Innovation Fund IV, FCR',                                                           type:'FCR',  vintage:2018, size:'—',     status:'Ativo' },
  { id:'BCIF5',    shortName:'BCIF V',              name:'BlueCrow Innovation Fund V, FCR',                                                            type:'FCR',  vintage:2022, size:'—',     status:'Ativo' },
  { id:'VF',       shortName:'Viriatus',            name:'Viriatus Fund, FCR',                                                                         type:'FCR',  vintage:2013, size:'—',     status:'Ativo' },
  { id:'BCG1',     shortName:'BCG I',               name:'BlueCrow Growth Fund I, FCR',                                                                type:'FCR',  vintage:2014, size:'—',     status:'Ativo' },
  { id:'BCN1',     shortName:'BCN I',               name:'BlueCrow Northern Fund I, FCR',                                                              type:'FCR',  vintage:2016, size:'—',     status:'Ativo' },
  { id:'BCIMPACT', shortName:'BC Impact',           name:'BlueCrow Impact Fund, FCR',                                                                  type:'FCR',  vintage:2019, size:'—',     status:'Ativo' },
  { id:'BCNT1',    shortName:'BCNT I',              name:'BlueCrow Next Tech Fund I, FCR',                                                             type:'FCR',  vintage:2021, size:'60M€',  status:'Ativo' },
  { id:'GGT',      shortName:'GGT',                 name:'Global Growth Tech Fund, FCR',                                                               type:'FCR',  vintage:2023, size:'—',     status:'Ativo' },
  { id:'BCDF1A',   shortName:'BCDF I / A',          name:'BlueCrow Development Fund I — Subfundo A · Portuguese Agrobusiness Fund',                    type:'FCR',  vintage:2020, size:'80M€',  status:'Ativo' },
  { id:'BCDF1B',   shortName:'BCDF I / B',          name:'BlueCrow Development Fund I — Subfundo B · Portuguese Entertainment Fund',                   type:'FCR',  vintage:2020, size:'—',     status:'Ativo' },
  { id:'BCDF1C',   shortName:'BCDF I / C',          name:'BlueCrow Development Fund I — Subfundo C · Football Strategies Fund',                        type:'FCR',  vintage:2022, size:'40M€',  status:'Ativo' },
  { id:'BCDF1D',   shortName:'BCDF I / D',          name:'BlueCrow Development Fund I — Subfundo D · Hermes Fund',                                     type:'FCR',  vintage:2018, size:'200M€', status:'Ativo' },
  { id:'BCDF1E',   shortName:'BCDF I / E',          name:'BlueCrow Development Fund I — Subfundo E · Finance Fund',                                    type:'FCR',  vintage:2019, size:'120M€', status:'Ativo' },
  { id:'BCLPF',    shortName:'BC Listed Property',  name:'BlueCrow Global Listed Property Fund — FIAA',                                                type:'FIAA', vintage:2017, size:'300M€', status:'Ativo' },
  { id:'BCGDF',    shortName:'BC Global Discovery', name:'BlueCrow Global Discovery Fund — FIAA',                                                      type:'FIAA', vintage:2023, size:'50M€',  status:'Ativo' },
  { id:'BCSTF',    shortName:'BC Short Term',        name:'BlueCrow Portugal Short Term Fund — FIAA',                                                  type:'FIAA', vintage:2018, size:'—',     status:'Ativo' },
  { id:'BCPSF',    shortName:'BC Portugal Select',   name:'BlueCrow Portugal Select Fund — FIAA',                                                      type:'FIAA', vintage:2019, size:'—',     status:'Ativo' },
  { id:'BCTFF',    shortName:'BC Trade Finance',     name:'BlueCrow Global Trade Finance Fund — FIAA',                                                 type:'FIAA', vintage:2021, size:'—',     status:'Ativo' },
  { id:'BCOPPR',   shortName:'BC Global Opp. PPR',   name:'BlueCrow Global Opportunities PPR OIA Flexível — FIAA Aberto Flexível de Poupança Reforma', type:'PPR',  vintage:2016, size:'150M€', status:'Ativo' },
]

interface Group   { id: string; label: string; fundIds: string[] }
interface Segment {
  id: string; label: string; sublabel: string
  color: string; textColor: string; borderColor: string
  groups?: Group[]; fundIds?: string[]
}

const SEGMENTS: Segment[] = [
  {
    id: 'fcr', label: 'Capitais de Risco', sublabel: 'FCR',
    color: 'bg-blue-100', textColor: 'text-blue-700', borderColor: 'border-blue-200',
    groups: [
      { id: 'bcif',  label: 'BlueCrow Innovation Fund',   fundIds: ['BCIF1','BCIF2','BCIF3','BCIF4','BCIF5'] },
      { id: 'other', label: 'Outros FCR',                  fundIds: ['VF','BCG1','BCN1','BCIMPACT','BCNT1','GGT'] },
      { id: 'bcdf',  label: 'BlueCrow Development Fund I', fundIds: ['BCDF1A','BCDF1B','BCDF1C','BCDF1D','BCDF1E'] },
    ],
  },
  {
    id: 'fiaa', label: 'Mobiliários', sublabel: 'FIAA',
    color: 'bg-violet-100', textColor: 'text-violet-700', borderColor: 'border-violet-200',
    fundIds: ['BCLPF','BCGDF','BCSTF','BCPSF'],
  },
  {
    id: 'esp', label: 'Especializado', sublabel: 'Trade Finance',
    color: 'bg-teal-100', textColor: 'text-teal-700', borderColor: 'border-teal-200',
    fundIds: ['BCTFF'],
  },
  {
    id: 'ppr', label: 'Poupança Reforma', sublabel: 'PPR',
    color: 'bg-amber-100', textColor: 'text-amber-700', borderColor: 'border-amber-200',
    fundIds: ['BCOPPR'],
  },
]

// ══════════════════════════════════════════════════════════════════════════════
// Helpers
// ══════════════════════════════════════════════════════════════════════════════
const load = <T,>(key: string, fallback: T[]): T[] => {
  try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : fallback } catch { return fallback }
}
const save = <T,>(key: string, data: T[]) => {
  try { localStorage.setItem(key, JSON.stringify(data)) } catch {}
}

function todayStr(): string {
  const d = new Date()
  return `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()}`
}

function toInput(s: string): string {
  // DD.MM.YYYY → YYYY-MM-DD
  const [d, m, y] = s.split('.')
  if (!d || !m || !y) return ''
  return `${y}-${m}-${d}`
}
function fromInput(s: string): string {
  // YYYY-MM-DD → DD.MM.YYYY
  const [y, m, d] = s.split('-')
  if (!y || !m || !d) return ''
  return `${d}.${m}.${y}`
}
function parseDate(s: string): Date | null {
  if (!s) return null
  if (/^\d{2}\.\d{2}\.\d{4}$/.test(s)) {
    const [d, m, y] = s.split('.')
    return new Date(+y, +m - 1, +d)
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return new Date(s)
  }
  return null
}
function calcEndDate(criacao: string, anos: number, extensao: number): string {
  const d = parseDate(criacao)
  if (!d || !anos) return '—'
  const total = anos + (extensao || 0)
  const end = new Date(d)
  end.setFullYear(end.getFullYear() + total)
  return fromInput(end.toISOString().slice(0, 10))
}

function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload  = () => resolve(r.result as string)
    r.onerror = reject
    r.readAsDataURL(file)
  })
}
function fundsByIds(allFunds: Fund[], ids: string[]): Fund[] {
  return ids.map(id => allFunds.find(f => f.id === id)).filter(Boolean) as Fund[]
}

function emptyInfo(fundId: string): FundInfo {
  return { id: fundId, fundId, dataCriacao: '', periodos: [], montanteSubscricao: '', valorUPs: '', duracaoAnos: 0, extensaoAnos: 0, percForaPortugal: '', politicaInvestimento: '' }
}

// ── Seed data from fund prospectus table ──────────────────────────────────────
// Pré-preenchido via tabela de características (68% dos campos visíveis na imagem).
// Campos em falta: montanteSubscricao, valorUPs, politicaInvestimento.
const SEED_INFOS: FundInfo[] = [
  // ── BCDF I — subfundos ───────────────────────────────────────────────────
  { id:'BCDF1A', fundId:'BCDF1A', dataCriacao:'27.10.2023', periodos:[{id:'p1',inicio:'29.07.2024',fim:'29.07.2029'}], montanteSubscricao:'', valorUPs:'', duracaoAnos:10, extensaoAnos:0, percForaPortugal:40,  politicaInvestimento:'' },
  { id:'BCDF1B', fundId:'BCDF1B', dataCriacao:'21.07.2023', periodos:[{id:'p1',inicio:'29.07.2024',fim:'29.07.2029'}], montanteSubscricao:'', valorUPs:'', duracaoAnos:10, extensaoAnos:0, percForaPortugal:40,  politicaInvestimento:'' },
  { id:'BCDF1C', fundId:'BCDF1C', dataCriacao:'14.04.2023', periodos:[{id:'p1',inicio:'29.07.2024',fim:'29.07.2029'}], montanteSubscricao:'', valorUPs:'', duracaoAnos:10, extensaoAnos:0, percForaPortugal:40,  politicaInvestimento:'' },
  { id:'BCDF1D', fundId:'BCDF1D', dataCriacao:'18.05.2023', periodos:[{id:'p1',inicio:'29.07.2024',fim:'29.07.2029'}], montanteSubscricao:'', valorUPs:'', duracaoAnos:10, extensaoAnos:0, percForaPortugal:40,  politicaInvestimento:'' },
  { id:'BCDF1E', fundId:'BCDF1E', dataCriacao:'21.07.2023', periodos:[{id:'p1',inicio:'29.07.2024',fim:'29.07.2029'}], montanteSubscricao:'', valorUPs:'', duracaoAnos:10, extensaoAnos:0, percForaPortugal:40,  politicaInvestimento:'' },
  // ── FIAA / PPR — fundos abertos ──────────────────────────────────────────
  { id:'BCGDF',  fundId:'BCGDF',  dataCriacao:'07.04.2011', periodos:[], montanteSubscricao:'', valorUPs:'', duracaoAnos:0,  extensaoAnos:0, percForaPortugal:100, politicaInvestimento:'' },
  { id:'BCLPF',  fundId:'BCLPF',  dataCriacao:'06.06.2024', periodos:[], montanteSubscricao:'', valorUPs:'', duracaoAnos:0,  extensaoAnos:0, percForaPortugal:100, politicaInvestimento:'' },
  { id:'BCOPPR', fundId:'BCOPPR', dataCriacao:'27.05.2024', periodos:[], montanteSubscricao:'', valorUPs:'', duracaoAnos:0,  extensaoAnos:0, percForaPortugal:100, politicaInvestimento:'' },
  { id:'BCPSF',  fundId:'BCPSF',  dataCriacao:'24.01.2025', periodos:[], montanteSubscricao:'', valorUPs:'', duracaoAnos:0,  extensaoAnos:0, percForaPortugal:40,  politicaInvestimento:'' },
  { id:'BCSTF',  fundId:'BCSTF',  dataCriacao:'24.01.2025', periodos:[], montanteSubscricao:'', valorUPs:'', duracaoAnos:0,  extensaoAnos:0, percForaPortugal:40,  politicaInvestimento:'' },
  { id:'BCTFF',  fundId:'BCTFF',  dataCriacao:'09.12.2025', periodos:[], montanteSubscricao:'', valorUPs:'', duracaoAnos:0,  extensaoAnos:0, percForaPortugal:100, politicaInvestimento:'' },
  // ── FCR — outros fundos ──────────────────────────────────────────────────
  { id:'BCG1',     fundId:'BCG1',    dataCriacao:'28.12.2018', periodos:[{id:'p1',inicio:'31.12.2023',fim:'31.12.2025'}], montanteSubscricao:'', valorUPs:'', duracaoAnos:15, extensaoAnos:0, percForaPortugal:40, politicaInvestimento:'' },
  { id:'BCIMPACT', fundId:'BCIMPACT',dataCriacao:'13.07.2020', periodos:[{id:'p1',inicio:'',         fim:'31.12.2027'}], montanteSubscricao:'', valorUPs:'', duracaoAnos:16, extensaoAnos:0, percForaPortugal:0,  politicaInvestimento:'' },
  { id:'BCIF1',    fundId:'BCIF1',   dataCriacao:'19.12.2017', periodos:[{id:'p1',inicio:'31.12.2017',fim:'31.12.2019'}], montanteSubscricao:'', valorUPs:'', duracaoAnos:8,  extensaoAnos:0, percForaPortugal:0,  politicaInvestimento:'' },
  { id:'BCIF2',    fundId:'BCIF2',   dataCriacao:'30.08.2018', periodos:[{id:'p1',inicio:'31.12.2018',fim:'31.12.2020'}], montanteSubscricao:'', valorUPs:'', duracaoAnos:8,  extensaoAnos:0, percForaPortugal:0,  politicaInvestimento:'' },
  { id:'BCIF3',    fundId:'BCIF3',   dataCriacao:'23.08.2019', periodos:[{id:'p1',inicio:'31.12.2019',fim:'31.12.2021'}], montanteSubscricao:'', valorUPs:'', duracaoAnos:8,  extensaoAnos:0, percForaPortugal:0,  politicaInvestimento:'' },
  { id:'BCIF4',    fundId:'BCIF4',   dataCriacao:'30.09.2020', periodos:[{id:'p1',inicio:'01.01.2022',fim:'31.12.2022'}], montanteSubscricao:'', valorUPs:'', duracaoAnos:8,  extensaoAnos:0, percForaPortugal:0,  politicaInvestimento:'' },
  { id:'BCIF5',    fundId:'BCIF5',   dataCriacao:'03.12.2021', periodos:[], montanteSubscricao:'', valorUPs:'', duracaoAnos:8,  extensaoAnos:0, percForaPortugal:0,  politicaInvestimento:'' },
  { id:'BCN1',     fundId:'BCN1',    dataCriacao:'18.12.2018', periodos:[], montanteSubscricao:'', valorUPs:'', duracaoAnos:16, extensaoAnos:0, percForaPortugal:0,  politicaInvestimento:'' },
  { id:'GGT',      fundId:'GGT',     dataCriacao:'01.03.2022', periodos:[], montanteSubscricao:'', valorUPs:'', duracaoAnos:25, extensaoAnos:0, percForaPortugal:'', politicaInvestimento:'' },
  { id:'BCNT1',    fundId:'BCNT1',   dataCriacao:'15.12.2020', periodos:[], montanteSubscricao:'', valorUPs:'', duracaoAnos:16, extensaoAnos:0, percForaPortugal:0,  politicaInvestimento:'' },
  { id:'VF',       fundId:'VF',      dataCriacao:'27.12.2019', periodos:[], montanteSubscricao:'', valorUPs:'', duracaoAnos:10, extensaoAnos:0, percForaPortugal:0,  politicaInvestimento:'' },
]

const STATUS_CLS: Record<FundStatus, string> = {
  'Ativo': 'bg-green-100 text-green-700',
  'Em liquidação': 'bg-amber-100 text-amber-700',
  'Fechado': 'bg-gray-100 text-gray-500',
}
const TYPE_CLS: Record<FundType, string> = {
  FCR:  'bg-blue-50 text-blue-600 border border-blue-100',
  FIAA: 'bg-violet-50 text-violet-600 border border-violet-100',
  PPR:  'bg-amber-50 text-amber-600 border border-amber-100',
}

// ── Convert data URL → blob URL (needed for PDF iframes in Chrome/Edge) ──────
function useObjectUrl(dataUrl: string): string {
  const url = useMemo(() => {
    if (!dataUrl) return ''
    try {
      const [header, b64] = dataUrl.split(',')
      const mime = header.match(/:(.*?);/)?.[1] ?? 'application/octet-stream'
      const bytes = atob(b64)
      const arr   = new Uint8Array(bytes.length)
      for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i)
      return URL.createObjectURL(new Blob([arr], { type: mime }))
    } catch { return dataUrl }
  }, [dataUrl])

  useEffect(() => () => { if (url.startsWith('blob:')) URL.revokeObjectURL(url) }, [url])
  return url
}

// ══════════════════════════════════════════════════════════════════════════════
// File Preview Modal (with optional AI chat for DIF / Documento Único / Prospecto)
// ══════════════════════════════════════════════════════════════════════════════
const CHAT_CATEGORIES: DocCategory[] = ['DIF', 'Documento Único', 'Prospecto']

interface ChatMsg { role: 'user' | 'assistant'; content: string }

function FilePreviewModal({ doc, fundName, onClose }: { doc: FundDoc; fundName: string; onClose: () => void }) {
  const { hasApiKey } = useAuth()
  const isPDF   = doc.fileType === 'application/pdf' || doc.fileName.toLowerCase().endsWith('.pdf')
  const isImage = doc.fileType.startsWith('image/')
  const blobUrl = useObjectUrl(doc.fileData)
  const canChat = isPDF && CHAT_CATEGORIES.includes(doc.category)
  const pdfB64  = useMemo(
    () => doc.fileData.includes(',') ? doc.fileData.split(',')[1] : doc.fileData,
    [doc.fileData]
  )

  const [chatOpen,    setChatOpen]    = useState(false)
  const [messages,    setMessages]    = useState<ChatMsg[]>([])
  const [input,       setInput]       = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [chatError,   setChatError]   = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, chatLoading])

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault()
    if (!input.trim() || chatLoading) return
    const userMsg: ChatMsg = { role: 'user', content: input.trim() }
    const next = [...messages, userMsg]
    setMessages(next)
    setInput('')
    setChatLoading(true)
    setChatError(null)
    try {
      const res = await authFetch(`${API_BASE}/api/scr/chat`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ messages: next, fundName, pdfBase64: pdfB64, pdfMimeType: 'application/pdf' }),
      })
      const data = await res.json()
      if (!res.ok) { setChatError(data.error ?? 'Erro ao contactar assistente'); return }
      setMessages(m => [...m, { role: 'assistant', content: data.response }])
    } catch {
      setChatError('Erro de ligação ao servidor')
    } finally {
      setChatLoading(false)
    }
  }

  function closeChat() { setChatOpen(false); setMessages([]); setChatError(null) }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[200] p-6" onClick={onClose}>
      <div
        className="bg-white rounded-2xl border border-gray-200 shadow-2xl flex overflow-hidden"
        style={{ width: chatOpen ? '94vw' : '88vw', height: '92vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* ── Document preview pane ── */}
        <div className={clsx('flex flex-col', chatOpen ? 'flex-1 min-w-0' : 'w-full')}>
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 flex-shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <File size={16} className="text-gray-400 flex-shrink-0"/>
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-gray-900 truncate">{doc.fileName}</p>
                <p className="text-[11px] text-gray-400">{doc.category} · {fundName} · {doc.uploadedAt}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0 ml-4">
              {canChat && (
                <button onClick={() => chatOpen ? closeChat() : setChatOpen(true)}
                  title={hasApiKey ? 'Assistente IA' : 'Configure a chave API nas definições do hub'}
                  className={clsx(
                    'flex items-center gap-1.5 text-[11px] px-3 py-1.5 border rounded-lg transition-colors',
                    chatOpen
                      ? 'text-indigo-700 bg-indigo-50 border-indigo-200'
                      : 'text-gray-600 hover:text-indigo-700 border-gray-200 hover:border-indigo-200 hover:bg-indigo-50'
                  )}>
                  <MessageSquare size={12}/>
                  {chatOpen ? 'Fechar chat' : 'Assistente IA'}
                </button>
              )}
              <a href={blobUrl} download={doc.fileName} onClick={e => e.stopPropagation()}
                className="text-[11px] text-blue-600 hover:text-blue-800 px-3 py-1.5 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors">
                Download
              </a>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-700 p-1">
                <X size={18}/>
              </button>
            </div>
          </div>
          {/* Content */}
          <div className="flex-1 overflow-hidden">
            {isPDF ? (
              <iframe src={blobUrl} className="w-full h-full border-0" title={doc.fileName}/>
            ) : isImage ? (
              <div className="w-full h-full flex items-center justify-center bg-gray-50 overflow-auto p-6">
                <img src={blobUrl} alt={doc.fileName} className="max-w-full max-h-full object-contain rounded-lg shadow"/>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full gap-3">
                <File size={48} className="text-gray-200"/>
                <p className="text-[13px] text-gray-500">Pré-visualização não disponível para este formato</p>
                <a href={blobUrl} download={doc.fileName} onClick={e => e.stopPropagation()}
                  className="text-[12px] text-blue-600 hover:text-blue-800 underline">Fazer download</a>
              </div>
            )}
          </div>
        </div>

        {/* ── Chat pane ── */}
        {chatOpen && (
          <div className="w-80 flex-shrink-0 flex flex-col border-l border-gray-100">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between bg-gray-50/50 flex-shrink-0">
              <div>
                <p className="text-[12px] font-semibold text-gray-900">Assistente IA</p>
                <p className="text-[10px] text-gray-400">{doc.category} · {fundName}</p>
              </div>
              <button onClick={closeChat} className="text-gray-400 hover:text-gray-600">
                <X size={14}/>
              </button>
            </div>

            {!hasApiKey ? (
              <div className="flex-1 flex items-center justify-center p-6 text-center">
                <div>
                  <div className="w-10 h-10 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center mx-auto mb-3">
                    <Key size={16} className="text-indigo-400"/>
                  </div>
                  <p className="text-[12px] font-semibold text-gray-700 mb-1.5">Chave API não configurada</p>
                  <p className="text-[11px] text-gray-400 leading-relaxed">Configure a sua chave Anthropic nas definições do perfil (ícone no hub).</p>
                </div>
              </div>
            ) : (
              <>
                <div className="flex-1 overflow-y-auto p-3 space-y-2.5 bg-gray-50/30">
                  {messages.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full py-8 text-center">
                      <MessageSquare size={24} className="text-gray-200 mb-2"/>
                      <p className="text-[11px] text-gray-400">Faça uma pergunta sobre este documento.</p>
                    </div>
                  )}
                  {messages.map((msg, i) => (
                    <div key={i} className={clsx('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                      <div className={clsx(
                        'max-w-[88%] rounded-2xl px-3 py-2 text-[12px] leading-relaxed whitespace-pre-wrap',
                        msg.role === 'user'
                          ? 'bg-indigo-600 text-white rounded-br-sm'
                          : 'bg-white border border-gray-100 text-gray-800 rounded-bl-sm shadow-sm',
                      )}>
                        {msg.content}
                      </div>
                    </div>
                  ))}
                  {chatLoading && (
                    <div className="flex justify-start">
                      <div className="bg-white border border-gray-100 rounded-2xl rounded-bl-sm px-3 py-2.5 shadow-sm">
                        <div className="flex items-center gap-1">
                          <span className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce [animation-delay:-0.3s]"/>
                          <span className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce [animation-delay:-0.15s]"/>
                          <span className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce"/>
                        </div>
                      </div>
                    </div>
                  )}
                  {chatError && (
                    <div className="bg-red-50 border border-red-100 rounded-xl px-3 py-2 text-[11px] text-red-600 leading-relaxed">
                      {chatError}
                    </div>
                  )}
                  <div ref={bottomRef}/>
                </div>
                <form onSubmit={sendMessage} className="p-3 border-t border-gray-100 bg-white flex gap-2 flex-shrink-0">
                  <input
                    className="flex-1 text-[12px] border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-white"
                    placeholder="Faça uma pergunta…"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    disabled={chatLoading}
                  />
                  <button type="submit"
                    disabled={!input.trim() || chatLoading}
                    className="w-8 h-8 flex-shrink-0 flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white rounded-xl transition-colors">
                    <Send size={12}/>
                  </button>
                </form>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// Info Tab
// ══════════════════════════════════════════════════════════════════════════════
function InfoTab({ fund, info, onSave }: { fund: Fund; info: FundInfo | undefined; onSave: (i: FundInfo) => void }) {
  const [editing, setEditing] = useState(false)
  const [form, setForm]       = useState<FundInfo>(() => info ?? emptyInfo(fund.id))

  useEffect(() => { if (info) setForm(info) }, [info])

  const endDate = calcEndDate(form.dataCriacao, form.duracaoAnos, form.extensaoAnos)

  function set<K extends keyof FundInfo>(k: K, v: FundInfo[K]) {
    setForm(f => ({ ...f, [k]: v }))
  }

  function addPeriodo() {
    set('periodos', [...form.periodos, { id: crypto.randomUUID(), inicio: '', fim: '' }])
  }
  function updatePeriodo(id: string, field: 'inicio' | 'fim', val: string) {
    set('periodos', form.periodos.map(p => p.id === id ? { ...p, [field]: fromInput(val) } : p))
  }
  function removePeriodo(id: string) {
    set('periodos', form.periodos.filter(p => p.id !== id))
  }

  function handleSave() {
    onSave(form)
    setEditing(false)
  }
  function handleCancel() {
    setForm(info ?? emptyInfo(fund.id))
    setEditing(false)
  }

  // ── View mode ──
  if (!editing) {
    const hasData = !!(form.dataCriacao || form.periodos.length || form.montanteSubscricao ||
      form.valorUPs || form.duracaoAnos || form.percForaPortugal !== '' || form.politicaInvestimento)

    return (
      <div className="p-5">
        <div className="flex items-center justify-between mb-4">
          <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Informação do Fundo</p>
          <button onClick={() => setEditing(true)}
            className="flex items-center gap-1.5 text-[11px] text-blue-600 hover:text-blue-800 px-2.5 py-1.5 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors">
            <Pencil size={11}/> Editar
          </button>
        </div>

        {!hasData ? (
          <p className="text-[12px] text-gray-400 italic">Nenhuma informação registada. Clique em Editar para preencher.</p>
        ) : (
          <div className="space-y-5">
            {/* Row 1 */}
            <div className="grid grid-cols-3 gap-4">
              <ViewField label="Data de Criação"       value={form.dataCriacao || '—'} />
              <ViewField label="Montante de Subscrição" value={form.montanteSubscricao || '—'} />
              <ViewField label="Valor de UPs"           value={form.valorUPs || '—'} />
            </div>

            {/* Row 2 — Duration */}
            <div className="grid grid-cols-3 gap-4">
              <ViewField label="Duração do Fundo"
                value={form.duracaoAnos ? `${form.duracaoAnos} ano${form.duracaoAnos !== 1 ? 's' : ''}` : '—'}
              />
              <ViewField label="Extensão"
                value={form.extensaoAnos ? `+ ${form.extensaoAnos} ano${form.extensaoAnos !== 1 ? 's' : ''}` : '—'}
              />
              <div>
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Data de Final</p>
                <p className={clsx('text-[13px] font-semibold', endDate === '—' ? 'text-gray-300' : 'text-gray-900')}>
                  {endDate}
                </p>
                {form.extensaoAnos > 0 && endDate !== '—' && (
                  <p className="text-[10px] text-amber-600 mt-0.5">Inclui extensão de {form.extensaoAnos} ano{form.extensaoAnos !== 1 ? 's' : ''}</p>
                )}
              </div>
            </div>

            {/* Períodos de Subscrição */}
            {form.periodos.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Períodos de Subscrição</p>
                <div className="flex flex-wrap gap-2">
                  {form.periodos.map((p, i) => (
                    <div key={p.id} className="flex items-center gap-1.5 text-[11px] bg-gray-50 border border-gray-100 rounded-lg px-3 py-1.5">
                      <span className="text-gray-400 font-medium">#{i + 1}</span>
                      <span className="text-gray-700 font-semibold">{p.inicio || '—'}</span>
                      <span className="text-gray-400">→</span>
                      <span className="text-gray-700 font-semibold">{p.fim || '—'}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Investimentos fora de Portugal */}
            {form.percForaPortugal !== '' && (
              <div className="flex items-center gap-3 bg-gray-50 border border-gray-100 rounded-xl px-4 py-3">
                <div>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Investimentos fora de Portugal</p>
                  <p className="text-[13px] font-semibold text-gray-900 mt-0.5">
                    Máximo <span className="text-blue-700">{form.percForaPortugal}%</span> do portfolio
                  </p>
                </div>
              </div>
            )}

            {/* Política de Investimento */}
            {form.politicaInvestimento && (
              <div>
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Política de Investimento</p>
                <p className="text-[12px] text-gray-700 leading-relaxed whitespace-pre-wrap bg-gray-50 rounded-xl border border-gray-100 p-4">
                  {form.politicaInvestimento}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  // ── Edit mode ──
  return (
    <div className="p-5 space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Editar Informação</p>
        <div className="flex items-center gap-2">
          <button onClick={handleCancel}
            className="text-[11px] text-gray-500 hover:text-gray-700 px-2.5 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            Cancelar
          </button>
          <button onClick={handleSave}
            className="flex items-center gap-1.5 text-[11px] text-white bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded-lg transition-colors">
            <Check size={11}/> Guardar
          </button>
        </div>
      </div>

      {/* Row 1 */}
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">Data de Criação</label>
          <input type="date" className="form-input text-[12px]"
            value={toInput(form.dataCriacao)}
            onChange={e => set('dataCriacao', fromInput(e.target.value))}/>
        </div>
        <div>
          <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">Montante de Subscrição</label>
          <input type="text" className="form-input text-[12px]" placeholder="ex: 10.000.000 €"
            value={form.montanteSubscricao}
            onChange={e => set('montanteSubscricao', e.target.value)}/>
        </div>
        <div>
          <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">Valor de UPs</label>
          <input type="text" className="form-input text-[12px]" placeholder="ex: 1.000 €"
            value={form.valorUPs}
            onChange={e => set('valorUPs', e.target.value)}/>
        </div>
      </div>

      {/* Row 2 — Duration */}
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">Duração (anos)</label>
          <input type="number" min="0" className="form-input text-[12px]"
            value={form.duracaoAnos || ''}
            onChange={e => set('duracaoAnos', Number(e.target.value))}/>
        </div>
        <div>
          <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">Extensão (anos)</label>
          <input type="number" min="0" className="form-input text-[12px]" placeholder="0"
            value={form.extensaoAnos || ''}
            onChange={e => set('extensaoAnos', Number(e.target.value))}/>
        </div>
        <div>
          <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">Data de Final (calculada)</label>
          <div className={clsx(
            'px-3 py-2 rounded-xl border text-[12px] font-semibold',
            endDate === '—'
              ? 'bg-gray-50 border-gray-100 text-gray-300'
              : 'bg-blue-50 border-blue-100 text-blue-700',
          )}>
            {endDate}
            {form.extensaoAnos > 0 && endDate !== '—' && (
              <span className="ml-2 text-[10px] font-normal text-amber-600">+{form.extensaoAnos}a extensão</span>
            )}
          </div>
        </div>
      </div>

      {/* Períodos de Subscrição */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Períodos de Subscrição</label>
          <button onClick={addPeriodo}
            className="flex items-center gap-1 text-[10px] text-blue-600 hover:text-blue-800 px-2 py-1 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors">
            <Plus size={10}/> Adicionar período
          </button>
        </div>
        {form.periodos.length === 0 ? (
          <p className="text-[11px] text-gray-300 italic">Nenhum período adicionado</p>
        ) : (
          <div className="space-y-2">
            {form.periodos.map((p, i) => (
              <div key={p.id} className="flex items-center gap-3">
                <span className="text-[10px] text-gray-400 font-medium w-5 flex-shrink-0">#{i+1}</span>
                <div className="flex items-center gap-2 flex-1">
                  <input type="date" className="form-input text-[12px] flex-1"
                    value={toInput(p.inicio)}
                    onChange={e => updatePeriodo(p.id, 'inicio', e.target.value)}/>
                  <span className="text-[11px] text-gray-400 flex-shrink-0">→</span>
                  <input type="date" className="form-input text-[12px] flex-1"
                    value={toInput(p.fim)}
                    onChange={e => updatePeriodo(p.id, 'fim', e.target.value)}/>
                </div>
                <button onClick={() => removePeriodo(p.id)}
                  className="text-gray-300 hover:text-red-500 flex-shrink-0 transition-colors">
                  <X size={13}/>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Investimentos fora de Portugal */}
      <div>
        <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">
          Investimentos fora de Portugal (% máxima)
        </label>
        <div className="relative">
          <input
            type="number" min="0" max="100" step="1"
            className="form-input text-[12px] pr-8"
            placeholder="ex: 30"
            value={form.percForaPortugal}
            onChange={e => set('percForaPortugal', e.target.value === '' ? '' : Math.min(100, Math.max(0, Number(e.target.value))))}
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-gray-400 pointer-events-none">%</span>
        </div>
        <p className="text-[10px] text-gray-400 mt-1">Percentagem máxima do portfolio que pode ser investida fora de Portugal</p>
      </div>

      {/* Política de Investimento */}
      <div>
        <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">Política de Investimento</label>
        <textarea
          className="form-input text-[12px] w-full resize-y leading-relaxed"
          rows={8}
          placeholder="Descreva a política de investimento do fundo…"
          value={form.politicaInvestimento}
          onChange={e => set('politicaInvestimento', e.target.value)}
        />
      </div>
    </div>
  )
}

function ViewField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">{label}</p>
      <p className={clsx('text-[13px] font-semibold', value === '—' ? 'text-gray-300' : 'text-gray-900')}>{value}</p>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// Fund Row (expandable with tabs)
// ══════════════════════════════════════════════════════════════════════════════
interface DocHandlers {
  docs: FundDoc[]
  onAdd: (fundId: string, cat: DocCategory, name: string, data: string, type: string) => void
  onDelete: (id: string) => void
  onPreview: (doc: FundDoc, fundName: string) => void
}
interface InfoHandlers {
  info: FundInfo | undefined
  onSaveInfo: (i: FundInfo) => void
}

type FundRowTab = 'info' | 'docs'

function FundRow({ fund, seg, docs, onAdd, onDelete, onPreview, info, onSaveInfo }: {
  fund: Fund; seg: Segment
} & DocHandlers & InfoHandlers) {
  const [open, setOpen]   = useState(false)
  const [tab, setTab]     = useState<FundRowTab>('info')
  const inputRef          = useRef<HTMLInputElement>(null)
  const pendingCatRef     = useRef<DocCategory | null>(null)
  const totalDocs         = docs.length
  const colorBar          = seg.color.replace('-100', '-400')

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    const cat  = pendingCatRef.current
    if (!file || !cat) return
    const data = await readFileAsDataURL(file)
    onAdd(fund.id, cat, file.name, data, file.type)
    e.target.value = ''
    pendingCatRef.current = null
  }
  function triggerUpload(cat: DocCategory, e: React.MouseEvent) {
    e.stopPropagation()
    pendingCatRef.current = cat
    inputRef.current?.click()
  }

  return (
    <>
      {/* Row header */}
      <div
        className={clsx(
          'flex items-center gap-3 px-4 py-2.5 border-b border-gray-50 cursor-pointer select-none transition-colors',
          open ? 'bg-blue-50/40' : 'hover:bg-gray-50/60',
        )}
        onClick={() => setOpen(v => !v)}
      >
        <div className={clsx('w-1 h-8 rounded-full flex-shrink-0', colorBar)} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-semibold text-gray-900">{fund.shortName}</span>
            <span className={clsx('text-[9px] font-semibold px-1.5 py-0.5 rounded-full', TYPE_CLS[fund.type])}>{fund.type}</span>
          </div>
          <p className="text-[10px] text-gray-400 truncate mt-0.5 max-w-[460px]" title={fund.name}>{fund.name}</p>
        </div>
        <div className="flex items-center gap-5 flex-shrink-0">
          <div className="text-right">
            <p className="text-[10px] text-gray-400">Vintage</p>
            <p className="text-[12px] font-semibold text-gray-700">{fund.vintage}</p>
          </div>
          <div className="text-right w-20">
            <p className="text-[10px] text-gray-400">Dimensão</p>
            <p className={clsx('text-[12px] font-semibold', fund.size === '—' ? 'text-gray-300' : 'text-gray-700')}>{fund.size}</p>
          </div>
          <span className={clsx('text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap', STATUS_CLS[fund.status])}>
            {fund.status}
          </span>
          {totalDocs > 0 && (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">
              {totalDocs} doc{totalDocs !== 1 ? 's' : ''}
            </span>
          )}
          {open ? <ChevronDown size={13} className="text-gray-400 flex-shrink-0"/> : <ChevronRight size={13} className="text-gray-400 flex-shrink-0"/>}
        </div>
      </div>

      {/* Expanded panel */}
      {open && (
        <div className="border-b border-gray-100 bg-gray-50/30">
          {/* Tabs */}
          <div className="flex border-b border-gray-100 bg-white">
            {(['info', 'docs'] as FundRowTab[]).map(t => (
              <button key={t}
                onClick={e => { e.stopPropagation(); setTab(t) }}
                className={clsx(
                  'px-5 py-2.5 text-[11px] font-semibold border-b-2 transition-colors',
                  tab === t
                    ? 'border-blue-600 text-blue-700'
                    : 'border-transparent text-gray-400 hover:text-gray-700',
                )}>
                {t === 'info' ? 'Informação' : `Documentos${totalDocs ? ` (${totalDocs})` : ''}`}
              </button>
            ))}
          </div>

          {/* Tab content */}
          {tab === 'info' && (
            <InfoTab fund={fund} info={info} onSave={onSaveInfo}/>
          )}

          {tab === 'docs' && (
            <div className="px-5 py-4">
              <input ref={inputRef} type="file" className="hidden"
                accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx"
                onChange={handleFileChange}/>
              <div className="grid grid-cols-4 gap-3">
                {DOC_CATEGORIES.map(cat => {
                  const catDocs = docs.filter(d => d.category === cat)
                  return (
                    <div key={cat} className="bg-white rounded-xl border border-gray-100 p-3 flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-gray-700 leading-tight">{cat}</span>
                        <button onClick={e => triggerUpload(cat, e)}
                          className="flex items-center gap-0.5 text-[10px] text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-1.5 py-0.5 rounded transition-colors flex-shrink-0"
                          title="Carregar ficheiro">
                          <Upload size={9}/>
                        </button>
                      </div>
                      {catDocs.length === 0 ? (
                        <p className="text-[10px] text-gray-300 italic">Sem ficheiros</p>
                      ) : (
                        <div className="space-y-1">
                          {catDocs.map(doc => (
                            <div key={doc.id} className="flex items-center gap-1.5 group">
                              <File size={9} className="text-gray-400 flex-shrink-0"/>
                              <span className="text-[10px] text-gray-600 flex-1 truncate cursor-pointer hover:text-blue-600"
                                title={doc.fileName}
                                onClick={e => { e.stopPropagation(); onPreview(doc, fund.name) }}>
                                {doc.fileName}
                              </span>
                              <button onClick={e => { e.stopPropagation(); onPreview(doc, fund.name) }}
                                className="text-gray-400 hover:text-blue-600 flex-shrink-0"
                                title="Pré-visualizar">
                                <Eye size={11}/>
                              </button>
                              <button onClick={e => {
                                e.stopPropagation()
                                if (confirm(`Eliminar "${doc.fileName}"?`)) onDelete(doc.id)
                              }} className="text-gray-300 hover:text-red-500 flex-shrink-0"
                                title="Eliminar">
                                <Trash2 size={11}/>
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// Group & Segment
// ══════════════════════════════════════════════════════════════════════════════
interface AllHandlers extends DocHandlers {
  infos: FundInfo[]
  onSaveInfo: (i: FundInfo) => void
  allFunds: Fund[]
}

function FundGroup({ group, seg, search, infos, onSaveInfo, allFunds, ...docH }: {
  group: Group; seg: Segment; search: string
} & AllHandlers) {
  const [open, setOpen] = useState(true)
  const funds = fundsByIds(allFunds, group.fundIds).filter(f =>
    !search || f.shortName.toLowerCase().includes(search) || f.name.toLowerCase().includes(search)
  )
  if (funds.length === 0) return null
  return (
    <div>
      <button onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2 px-4 py-2 bg-gray-50/80 hover:bg-gray-100/60 border-b border-gray-100 transition-colors">
        {open ? <ChevronDown size={12} className="text-gray-400"/> : <ChevronRight size={12} className="text-gray-400"/>}
        <span className="text-[11px] font-semibold text-gray-600">{group.label}</span>
        <span className="text-[10px] text-gray-400 ml-auto">{funds.length} fundo{funds.length !== 1 ? 's' : ''}</span>
      </button>
      {open && funds.map(f => (
        <FundRow key={f.id} fund={f} seg={seg}
          docs={docH.docs.filter(d => d.fundId === f.id)}
          onAdd={docH.onAdd} onDelete={docH.onDelete} onPreview={docH.onPreview}
          info={infos.find(i => i.fundId === f.id)} onSaveInfo={onSaveInfo}
        />
      ))}
    </div>
  )
}

function SegmentPanel({ seg, search, infos, onSaveInfo, allFunds, ...docH }: {
  seg: Segment; search: string
} & AllHandlers) {
  const [open, setOpen] = useState(true)
  const allIds: string[] = seg.groups ? seg.groups.flatMap(g => g.fundIds) : seg.fundIds ?? []
  const visibleFunds = fundsByIds(allFunds, allIds).filter(f =>
    !search || f.shortName.toLowerCase().includes(search) || f.name.toLowerCase().includes(search)
  )
  if (visibleFunds.length === 0 && search) return null
  return (
    <div className={clsx('bg-white rounded-2xl border overflow-hidden', seg.borderColor)}>
      <button onClick={() => setOpen(v => !v)}
        className={clsx('w-full flex items-center gap-3 px-5 py-3.5 border-b transition-colors hover:bg-gray-50/60', seg.borderColor)}>
        <div className={clsx('w-2 h-2 rounded-full flex-shrink-0', seg.color.replace('-100', '-500'))} />
        <div className="flex-1 text-left">
          <span className="text-[13px] font-bold text-gray-900">{seg.label}</span>
          <span className={clsx('text-[10px] font-semibold ml-2 px-1.5 py-0.5 rounded-full', seg.color, seg.textColor)}>{seg.sublabel}</span>
        </div>
        <span className="text-[11px] text-gray-400">{visibleFunds.length} fundo{visibleFunds.length !== 1 ? 's' : ''}</span>
        {open ? <ChevronDown size={14} className="text-gray-400 flex-shrink-0"/> : <ChevronRight size={14} className="text-gray-400 flex-shrink-0"/>}
      </button>
      {open && (
        seg.groups ? (
          seg.groups.map(g => (
            <FundGroup key={g.id} group={g} seg={seg} search={search}
              {...docH} infos={infos} onSaveInfo={onSaveInfo} allFunds={allFunds}/>
          ))
        ) : (
          visibleFunds.map(f => (
            <FundRow key={f.id} fund={f} seg={seg}
              docs={docH.docs.filter(d => d.fundId === f.id)}
              onAdd={docH.onAdd} onDelete={docH.onDelete} onPreview={docH.onPreview}
              info={infos.find(i => i.fundId === f.id)} onSaveInfo={onSaveInfo}
            />
          ))
        )
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// Fundos page
// ══════════════════════════════════════════════════════════════════════════════
export function Fundos() {
  const [search,     setSearch]     = useState('')
  const [funds,      setFunds]      = useState<Fund[]>(ALL_FUNDS)
  const [docs,       setDocs]       = useState<FundDoc[]>( () => load(DOCS_KEY, []))
  const [infos,      setInfos]      = useState<FundInfo[]>(() => {
    const saved    = load<FundInfo>(INFO_KEY, [])
    const savedIds = new Set(saved.map(i => i.fundId))
    return [...saved, ...SEED_INFOS.filter(s => !savedIds.has(s.fundId))]
  })
  useEffect(() => {
    sbLoad<Fund>('oia_funds', 'scr_all_funds', ALL_FUNDS)
      .then(rows => rows.map(r => ({ ...r, shortName: (r as any).shortname ?? r.shortName })))
      .then(setFunds)
  }, [])
  useEffect(() => { sbLoad<FundDoc>('scr_fund_docs', DOCS_KEY, []).then(setDocs) }, [])
  useEffect(() => {
    sbLoad<FundInfo>('scr_fund_info', INFO_KEY, SEED_INFOS).then(data => {
      const savedIds = new Set(data.map(i => i.fundId))
      setInfos([...data, ...SEED_INFOS.filter(s => !savedIds.has(s.fundId))])
    })
  }, [])
  const [preview, setPreview] = useState<{ doc: FundDoc; fundName: string } | null>(null)

  const q = search.toLowerCase()

  const kpiFCR    = funds.filter(f => f.type === 'FCR').length
  const kpiFIAA   = funds.filter(f => f.type === 'FIAA').length
  const kpiPPR    = funds.filter(f => f.type === 'PPR').length
  const kpiAtivos = funds.filter(f => f.status === 'Ativo').length

  function addDoc(fundId: string, cat: DocCategory, name: string, data: string, type: string) {
    const updated = [...docs, { id: crypto.randomUUID(), fundId, category: cat, fileName: name, fileData: data, fileType: type, uploadedAt: todayStr() }]
    setDocs(updated); sbSaveAll('scr_fund_docs', DOCS_KEY, updated)
  }
  function deleteDoc(id: string) {
    const updated = docs.filter(d => d.id !== id)
    setDocs(updated); sbSaveAll('scr_fund_docs', DOCS_KEY, updated)
  }

  function saveInfo(info: FundInfo) {
    const updated = [...infos.filter(i => i.fundId !== info.fundId), info]
    setInfos(updated)
    sbSaveAll('scr_fund_info', INFO_KEY, updated.map(x => ({ ...x, id: (x as FundInfo & { id?: string }).id ?? x.fundId })))
  }


  return (
    <div className="p-6 space-y-5">

      <div>
        <h1 className="text-[18px] font-bold text-gray-900">Fundos</h1>
        <p className="text-[12px] text-gray-400 mt-0.5">
          Universo de fundos geridos pela BlueCrow Capital — clique num fundo para gerir informação e documentos
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-white rounded-2xl border border-gray-100 px-5 py-4 flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
            <Briefcase size={16} className="text-gray-600"/>
          </div>
          <div>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Total</p>
            <p className="text-2xl font-bold text-gray-900">{funds.length}</p>
            <p className="text-[10px] text-gray-400">fundos</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 px-5 py-4 flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
            <TrendingUp size={16} className="text-blue-600"/>
          </div>
          <div>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">FCR</p>
            <p className="text-2xl font-bold text-blue-700">{kpiFCR}</p>
            <p className="text-[10px] text-gray-400">capitais de risco</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 px-5 py-4 flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-violet-100 flex items-center justify-center flex-shrink-0">
            <BarChart3 size={16} className="text-violet-600"/>
          </div>
          <div>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">FIAA / PPR</p>
            <p className="text-2xl font-bold text-violet-700">{kpiFIAA + kpiPPR}</p>
            <p className="text-[10px] text-gray-400">mobiliários e poupança</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-green-100 bg-green-50/30 px-5 py-4 flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-green-100 flex items-center justify-center flex-shrink-0">
            <Layers size={16} className="text-green-600"/>
          </div>
          <div>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Ativos</p>
            <p className="text-2xl font-bold text-green-700">{kpiAtivos}</p>
            <p className="text-[10px] text-gray-400">em atividade</p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"/>
        <input className="w-full pl-8 pr-3 py-2 text-[12px] border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
          placeholder="Pesquisar fundo…" value={search} onChange={e => setSearch(e.target.value)}/>
      </div>

      {/* Segments */}
      <div className="space-y-4">
        {SEGMENTS.map(seg => (
          <SegmentPanel key={seg.id} seg={seg} search={q}
            docs={docs} onAdd={addDoc} onDelete={deleteDoc} onPreview={(doc, fundName) => setPreview({ doc, fundName })}
            infos={infos} onSaveInfo={saveInfo} allFunds={funds}
          />
        ))}
      </div>

      {/* File preview modal */}
      {preview && (
        <FilePreviewModal
          doc={preview.doc}
          fundName={preview.fundName}
          onClose={() => setPreview(null)}
        />
      )}
    </div>
  )
}
