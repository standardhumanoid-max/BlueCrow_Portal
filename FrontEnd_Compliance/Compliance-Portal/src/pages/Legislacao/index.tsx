import { useState, useMemo, useRef, useEffect } from 'react'
import { sbLoad, sbSaveAll } from '@/services/supabaseStore'
import {
  Search, Plus, X, Upload, FileText, Sparkles,
  AlertCircle, BookOpen, Clock, CheckCircle2, AlertTriangle,
  Download, Loader2, Save, Trash2, Key, Scale,
  Calendar, TrendingUp, ChevronDown, ChevronRight, Bot,
  Pencil, ExternalLink, Send,
} from 'lucide-react'
import { clsx } from 'clsx'

// ── Types ──────────────────────────────────────────────────────────────────────
type TabId = 'radar' | 'analise' | 'consultas'
type Impacto = 'Alto' | 'Médio' | 'Baixo' | '—'
type EstadoDiploma = 'Vigente' | 'Aprovado' | 'Proposta' | 'Em consulta' | 'Revogado' | 'Suspenso' | 'Pendente'
type TipoDiploma = 'Diretiva UE' | 'Regulamento UE' | 'Lei' | 'Decreto-Lei' | 'Regulamento CMVM' | 'Instrução BdP' | 'Portaria' | 'Outro'

interface Diploma {
  id: string
  titulo: string
  referencia: string
  tipo: TipoDiploma
  autoridade: string
  dataPublicacao: string   // DD.MM.YYYY
  dataVigor: string
  estado: EstadoDiploma
  impacto: Impacto
  ambito: string
  descricao: string
  observacoes: string
}

interface AnaliseSecao {
  titulo: string
  conteudo: string
}

interface AnaliseIA {
  id: string
  diploma_id: string
  diploma_titulo: string
  data: string            // DD.MM.YYYY
  responsavel: string
  secoes: AnaliseSecao[]
  nivel_impacto: Impacto
}

interface ConsultaPublica {
  id: string
  titulo: string
  autoridade: string
  abertura: string        // DD.MM.YYYY
  encerramento: string
  estado: 'Aberta' | 'Encerrada' | 'Em análise'
  link: string
  parecer_bc: string
  observacoes: string
}

// ── Persistence ────────────────────────────────────────────────────────────────
const LEG_KEY  = 'leg_diplomas'
const ALEG_KEY = 'leg_analises'
const CONS_KEY = 'leg_consultas'
function uid() { return Math.random().toString(36).slice(2, 9) }
function load<T>(key: string, fallback: T[]): T[] {
  try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : fallback } catch { return fallback }
}
function save<T>(key: string, d: T[]) {
  try { localStorage.setItem(key, JSON.stringify(d)) } catch {}
}

// ── Date helpers ───────────────────────────────────────────────────────────────
function parseDate(s: string): Date | null {
  if (!s) return null
  const m = s.match(/^(\d{2})\.(\d{2})\.(\d{4})$/)
  if (m) return new Date(+m[3], +m[2] - 1, +m[1])
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
function today(): string {
  const d = new Date()
  return `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()}`
}

// ── Seed data ──────────────────────────────────────────────────────────────────
const SEED_DIPLOMAS: Diploma[] = [
  {
    id: uid(), titulo: 'AIFMD II — Diretiva (UE) 2024/927', referencia: 'Diretiva (UE) 2024/927',
    tipo: 'Diretiva UE', autoridade: 'Parlamento Europeu / Conselho',
    dataPublicacao: '26.04.2024', dataVigor: '15.04.2026',
    estado: 'Aprovado', impacto: 'Alto',
    ambito: 'Gestão de Ativos / AIFMD',
    descricao: 'Altera a AIFMD (2011/61/UE) e UCITS V. Introduz regime de delegação reforçado, novos requisitos de liquidez, regras de originação de empréstimos e alterações à passaporte europeu.',
    observacoes: 'Prazo de transposição: 15.04.2026. Análise IA recomendada.',
  },
  {
    id: uid(), titulo: 'DORA — Regulamento (UE) 2022/2554', referencia: 'Regulamento (UE) 2022/2554',
    tipo: 'Regulamento UE', autoridade: 'Parlamento Europeu / Conselho',
    dataPublicacao: '27.12.2022', dataVigor: '17.01.2025',
    estado: 'Vigente', impacto: 'Alto',
    ambito: 'Cibersegurança / Resiliência Operacional',
    descricao: 'Resiliência operacional digital para entidades financeiras. Requisitos de gestão de risco TIC, reporte de incidentes, testes de resiliência e gestão de risco de terceiros TIC.',
    observacoes: 'Em implementação. Políticas TIC revistas em 2025.',
  },
  {
    id: uid(), titulo: 'CSRD — Diretiva (UE) 2022/2464', referencia: 'Diretiva (UE) 2022/2464',
    tipo: 'Diretiva UE', autoridade: 'Parlamento Europeu / Conselho',
    dataPublicacao: '16.12.2022', dataVigor: '05.01.2023',
    estado: 'Vigente', impacto: 'Médio',
    ambito: 'Sustentabilidade / ESG',
    descricao: 'Relatório de sustentabilidade empresarial. Substitui NFRD. Aplica-se progressivamente, com reporte conforme ESRS. Inclui due diligence em cadeia de valor.',
    observacoes: 'Aplicabilidade a SGI em análise — dependente da dimensão.',
  },
  {
    id: uid(), titulo: 'SFDR — Regulamento (UE) 2019/2088', referencia: 'Regulamento (UE) 2019/2088',
    tipo: 'Regulamento UE', autoridade: 'Parlamento Europeu / Conselho',
    dataPublicacao: '09.12.2019', dataVigor: '10.03.2021',
    estado: 'Vigente', impacto: 'Alto',
    ambito: 'Sustentabilidade / ESG / Fundos',
    descricao: 'Divulgação de informação relacionada com a sustentabilidade no setor dos serviços financeiros. Classificação dos fundos: Artigo 6, 8 ou 9. Reporte PAI obrigatório para gestoras de FIA.',
    observacoes: 'Revisão da SFDR em curso (Consulta CE 2024).',
  },
  {
    id: uid(), titulo: 'Reg. CMVM n.º 3/2025 — Alteração RRGA', referencia: 'Reg. CMVM 3/2025',
    tipo: 'Regulamento CMVM', autoridade: 'CMVM',
    dataPublicacao: '01.04.2025', dataVigor: '15.04.2025',
    estado: 'Vigente', impacto: 'Alto',
    ambito: 'SCR / Prudencial / BUE',
    descricao: 'Altera o Regulamento CMVM n.º 7/2023 (RRGA) e o Regulamento CMVM n.º 8/2018. Novos requisitos prudenciais para SCR. Adaptação ao Balcão Único Europeu (BUE).',
    observacoes: 'Implementação interna em curso.',
  },
  {
    id: uid(), titulo: 'EMIR REFIT — Regulamento (UE) 2019/834', referencia: 'Regulamento (UE) 2019/834',
    tipo: 'Regulamento UE', autoridade: 'Parlamento Europeu / Conselho',
    dataPublicacao: '20.05.2019', dataVigor: '18.06.2019',
    estado: 'Vigente', impacto: 'Baixo',
    ambito: 'Derivados / Compensação',
    descricao: 'Simplifica obrigações de reporte e compensação de derivados OTC para contrapartes de pequena dimensão. Isenções reforçadas para fundos.',
    observacoes: '',
  },
  {
    id: uid(), titulo: 'Anti-Money Laundering Regulation — AMLR', referencia: 'Regulamento (UE) 2024/1624',
    tipo: 'Regulamento UE', autoridade: 'Parlamento Europeu / Conselho',
    dataPublicacao: '19.06.2024', dataVigor: '10.07.2027',
    estado: 'Aprovado', impacto: 'Alto',
    ambito: 'PBCFT / AML',
    descricao: 'Novo regulamento europeu de prevenção de branqueamento de capitais. Substitui Diretivas AML. Regras uniformes de KYC, beneficiário efetivo, clientes de alto risco e nova Autoridade AMLA.',
    observacoes: 'Aplicação direta a partir de 10.07.2027. Preparação antecipada recomendada.',
  },
  {
    id: uid(), titulo: 'CRD VI — Diretiva (UE) 2024/1619', referencia: 'Diretiva (UE) 2024/1619',
    tipo: 'Diretiva UE', autoridade: 'Parlamento Europeu / Conselho',
    dataPublicacao: '19.06.2024', dataVigor: '01.01.2026',
    estado: 'Aprovado', impacto: 'Baixo',
    ambito: 'Capital / Prudencial (bancos)',
    descricao: 'Transposição de Basileia IV. Principalmente aplicável a instituições de crédito. Impacto indireto em SGI via requisitos de contraparte bancária.',
    observacoes: 'Impacto indireto para BCR — monitorizar.',
  },
  {
    id: uid(), titulo: 'SFDR Review — Consulta CE sobre Revisão SFDR', referencia: 'Consulta CE 2024/SFDR',
    tipo: 'Outro', autoridade: 'Comissão Europeia',
    dataPublicacao: '03.09.2024', dataVigor: '—',
    estado: 'Em consulta', impacto: 'Alto',
    ambito: 'Sustentabilidade / ESG / Fundos',
    descricao: 'Consulta pública da CE sobre revisão do SFDR. Propõe novo sistema de categorização simplificado (Sustainable / Transition / ESG Collection). Poderá alterar significativamente os requisitos de classificação Art. 8/9.',
    observacoes: 'Resposta BCR em preparação. Prazo consulta: fevereiro 2025.',
  },
  {
    id: uid(), titulo: 'Proposta de Regulamento IA — EU AI Act', referencia: 'Regulamento (UE) 2024/1689',
    tipo: 'Regulamento UE', autoridade: 'Parlamento Europeu / Conselho',
    dataPublicacao: '12.07.2024', dataVigor: '02.08.2024',
    estado: 'Vigente', impacto: 'Médio',
    ambito: 'Inteligência Artificial / Tecnologia',
    descricao: 'Regulamento europeu sobre inteligência artificial. Classificação de risco de sistemas IA. Requisitos para sistemas de IA de alto risco em serviços financeiros. Proibição de sistemas IA inaceitáveis.',
    observacoes: 'Aplicação faseada. Sistemas IA de alto risco: agosto 2026.',
  },
]

const SEED_CONSULTAS: ConsultaPublica[] = [
  {
    id: uid(), titulo: 'Revisão do SFDR — Sistema de Categorização de Produtos Sustentáveis',
    autoridade: 'Comissão Europeia', abertura: '03.09.2024', encerramento: '15.02.2025',
    estado: 'Encerrada', link: 'https://finance.ec.europa.eu',
    parecer_bc: 'Resposta enviada em 10.02.2025. BCR apoia simplificação mas solicita período de transição.',
    observacoes: 'Aguardar publicação da proposta legislativa.',
  },
  {
    id: uid(), titulo: 'Consulta ESMA sobre Guidelines de Liquidez para FIA',
    autoridade: 'ESMA', abertura: '15.01.2026', encerramento: '15.04.2026',
    estado: 'Aberta', link: 'https://www.esma.europa.eu',
    parecer_bc: '',
    observacoes: 'Impacto direto nos fundos FCR-I e FIAA-I. Resposta recomendada.',
  },
  {
    id: uid(), titulo: 'Consulta CMVM — Alteração ao Regulamento de Governo Societário SGI',
    autoridade: 'CMVM', abertura: '01.02.2026', encerramento: '01.05.2026',
    estado: 'Aberta', link: 'https://www.cmvm.pt',
    parecer_bc: 'Em análise. Reunião de Compliance agendada para 15.03.2026.',
    observacoes: 'Proposta altera Reg. CMVM 6/2023. Análise IA recomendada.',
  },
  {
    id: uid(), titulo: 'Consulta CE — Revisão da Diretiva AIFMD para Fundos Paneuropeus',
    autoridade: 'Comissão Europeia', abertura: '10.03.2026', encerramento: '10.06.2026',
    estado: 'Aberta', link: 'https://finance.ec.europa.eu',
    parecer_bc: '',
    observacoes: 'Monitorizar. Possível impacto na passaporte europeu.',
  },
]

// ── Claude API ─────────────────────────────────────────────────────────────────
async function analisarLegislacao(
  apiKey: string,
  titulo: string,
  referencia: string,
  autoridade: string,
  texto: string,
): Promise<string> {
  const system = `Você é um especialista sénior em compliance regulatório para gestoras de fundos de capital de risco (SCR) e fundos de investimento alternativo (FIA) em Portugal, especificamente para a BlueCrow Capital SGI, S.A.
A BlueCrow Capital é uma SCR que gere fundos FIA (FCR-I e FIAA-I) nos termos do RGA (D.L. 27/2023) e é supervisionada pela CMVM.
Responda sempre em português europeu (Portugal), com rigor jurídico e técnico.`

  const prompt = `Analise o seguinte diploma/texto legislativo e forneça uma análise estruturada completa para a equipa de compliance da BlueCrow Capital.

**Diploma:** ${titulo}
**Referência:** ${referencia}
**Autoridade:** ${autoridade}

**Texto / Descrição:**
${texto || '(sem texto adicional — basear a análise no diploma referenciado com base no seu conhecimento)'}

---

Estruture a sua análise com exatamente as seguintes secções (use os cabeçalhos ## exatamente como indicados):

## Resumo Executivo
Síntese clara e objetiva do diploma em 4-6 frases. O que muda, para quem e quando.

## Aplicabilidade à BlueCrow Capital
Avalie detalhadamente se e como este diploma se aplica à BCR (SCR / gestora de FIA). Considere o RGA 2023, AIFMD, e o tipo de atividade da BCR.

## Nível de Impacto: [escreva apenas Alto, Médio ou Baixo]
Justifique o nível de impacto para as operações da BCR. Seja específico sobre quais áreas são afetadas (Compliance, Gestão de Fundos, TI, RH, Financeiro, etc.).

## Obrigações Identificadas
Liste de forma detalhada e numerada as obrigações concretas que resultam deste diploma para a BCR. Inclua obrigações de reporte, de governance, operacionais e de documentação.

## Prazos e Datas Relevantes
Liste todas as datas importantes: entrada em vigor, prazos de transposição, deadlines de implementação, datas de revisão. Use formato DD.MM.AAAA quando possível.

## Diplomas Relacionados
Identifique outros diplomas que interagem, complementam ou são substituídos por este. Foque em diplomas relevantes para SCR/FIA (AIFMD, RGA, RGOIC, regulamentos CMVM, SFDR, DORA, etc.).

## Recomendações de Ação
Liste de forma numerada e priorizada as ações concretas que a equipa de compliance da BCR deve tomar. Inclua responsável sugerido (Compliance, Jurídico, TI, etc.) e urgência.`

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 3000,
      system,
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error?.message ?? `Erro HTTP ${res.status}`)
  }
  const data = await res.json()
  return data.content?.[0]?.text ?? '(sem resposta)'
}

// ── Parse AI response into sections ───────────────────────────────────────────
function parseSections(text: string): { secoes: AnaliseSecao[]; nivel: Impacto } {
  const secoes: AnaliseSecao[] = []
  let nivel: Impacto = '—'
  const parts = text.split(/^## /m).filter(Boolean)
  for (const part of parts) {
    const nl = part.indexOf('\n')
    if (nl === -1) continue
    const rawTitulo = part.slice(0, nl).trim()
    const conteudo  = part.slice(nl).trim()
    // Extract impacto from the title "Nível de Impacto: Alto"
    if (rawTitulo.startsWith('Nível de Impacto')) {
      const m = rawTitulo.match(/(Alto|Médio|Baixo)/i)
      if (m) nivel = m[1] as Impacto
    }
    secoes.push({ titulo: rawTitulo, conteudo })
  }
  return { secoes, nivel }
}

// ── Style helpers ──────────────────────────────────────────────────────────────
const IMPACTO_CLS: Record<Impacto, string> = {
  'Alto':  'bg-red-100 text-red-700 border-red-200',
  'Médio': 'bg-amber-100 text-amber-700 border-amber-200',
  'Baixo': 'bg-green-100 text-green-700 border-green-200',
  '—':     'bg-gray-100 text-gray-500 border-gray-200',
}
const ESTADO_CLS: Record<EstadoDiploma, string> = {
  'Vigente':     'bg-green-100 text-green-700',
  'Aprovado':    'bg-blue-100 text-blue-700',
  'Proposta':    'bg-violet-100 text-violet-700',
  'Em consulta': 'bg-amber-100 text-amber-700',
  'Revogado':    'bg-gray-200 text-gray-500',
  'Suspenso':    'bg-red-100 text-red-600',
  'Pendente':    'bg-slate-100 text-slate-600',
}
const CONS_ESTADO_CLS = {
  'Aberta':     'bg-green-100 text-green-700',
  'Encerrada':  'bg-gray-100 text-gray-500',
  'Em análise': 'bg-blue-100 text-blue-700',
}

// ── Section icon map ───────────────────────────────────────────────────────────
function sectionIcon(titulo: string) {
  if (titulo.includes('Resumo'))         return '📋'
  if (titulo.includes('Aplicabilidade')) return '🎯'
  if (titulo.includes('Impacto'))        return '⚠️'
  if (titulo.includes('Obrigações'))     return '📌'
  if (titulo.includes('Prazos'))         return '📅'
  if (titulo.includes('Diplomas'))       return '🔗'
  if (titulo.includes('Recomendações'))  return '✅'
  return '📄'
}

// ── Empty forms ────────────────────────────────────────────────────────────────
const emptyDiploma = (): Omit<Diploma,'id'> => ({
  titulo:'', referencia:'', tipo:'Regulamento UE', autoridade:'', dataPublicacao:'',
  dataVigor:'', estado:'Pendente', impacto:'—', ambito:'', descricao:'', observacoes:'',
})
const emptyConsulta = (): Omit<ConsultaPublica,'id'> => ({
  titulo:'', autoridade:'', abertura:'', encerramento:'', estado:'Aberta',
  link:'', parecer_bc:'', observacoes:'',
})

// ══════════════════════════════════════════════════════════════════════════════
export function Legislacao() {
  const [tab, setTab] = useState<TabId>('radar')

  // ── Diplomas state ────────────────────────────────────────────────────────
  const [diplomas, setDiplomas]     = useState<Diploma[]>(() => load(LEG_KEY, SEED_DIPLOMAS))
  useEffect(() => { sbLoad<Diploma>('leg_diplomas', LEG_KEY, SEED_DIPLOMAS).then(setDiplomas) }, [])
  const [dipSearch, setDipSearch]   = useState('')
  const [dipImpacto, setDipImpacto] = useState('')
  const [dipEstado, setDipEstado]   = useState('')
  const [dipModal, setDipModal]     = useState(false)
  const [dipEditing, setDipEditing] = useState<Diploma | null>(null)
  const [dipForm, setDipForm]       = useState(emptyDiploma())

  // ── Análise state ─────────────────────────────────────────────────────────
  const [analises, setAnalises]         = useState<AnaliseIA[]>(() => load(ALEG_KEY, []))
  useEffect(() => { sbLoad<AnaliseIA>('leg_analises', ALEG_KEY, []).then(setAnalises) }, [])
  const [selDiplomaId, setSelDiplomaId] = useState('')
  const [textoLivre, setTextoLivre]     = useState('')
  const [autoriaLivre, setAutoriaLivre] = useState('')
  const [refLivre, setRefLivre]         = useState('')
  const [tituloLivre, setTituloLivre]   = useState('')
  const [analiseLoading, setAnaliseLoading] = useState(false)
  const [analiseResult, setAnaliseResult]   = useState<AnaliseIA | null>(null)
  const [analiseError, setAnaliseError]     = useState('')
  const [apiKey, setApiKey]             = useState(() => localStorage.getItem('anthropic_api_key') ?? '')
  const [showKey, setShowKey]           = useState(false)
  const [keyDraft, setKeyDraft]         = useState('')
  const [viewAnalise, setViewAnalise]   = useState<AnaliseIA | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // ── Consultas state ───────────────────────────────────────────────────────
  const [consultas, setConsultas]       = useState<ConsultaPublica[]>(() => load(CONS_KEY, SEED_CONSULTAS))
  useEffect(() => { sbLoad<ConsultaPublica>('leg_consultas', CONS_KEY, SEED_CONSULTAS).then(setConsultas) }, [])
  const [consModal, setConsModal]       = useState(false)
  const [consEditing, setConsEditing]   = useState<ConsultaPublica | null>(null)
  const [consForm, setConsForm]         = useState(emptyConsulta())

  // ── Derived ───────────────────────────────────────────────────────────────
  const filteredDiplomas = useMemo(() => {
    let list = diplomas
    if (dipSearch)  list = list.filter(d => d.titulo.toLowerCase().includes(dipSearch.toLowerCase()) || d.referencia.toLowerCase().includes(dipSearch.toLowerCase()) || d.ambito.toLowerCase().includes(dipSearch.toLowerCase()))
    if (dipImpacto) list = list.filter(d => d.impacto === dipImpacto)
    if (dipEstado)  list = list.filter(d => d.estado === dipEstado)
    return list
  }, [diplomas, dipSearch, dipImpacto, dipEstado])

  const kpiAlto     = diplomas.filter(d => d.impacto === 'Alto').length
  const kpiVigente  = diplomas.filter(d => d.estado === 'Vigente' || d.estado === 'Aprovado').length
  const kpiConsulta = diplomas.filter(d => d.estado === 'Em consulta').length
  const kpiProposta = diplomas.filter(d => d.estado === 'Proposta' || d.estado === 'Pendente').length
  const consultasAbertas = consultas.filter(c => c.estado === 'Aberta').length

  // ── Diploma CRUD ──────────────────────────────────────────────────────────
  function saveDiploma() {
    const updated = dipEditing
      ? diplomas.map(d => d.id === dipEditing.id ? { ...dipEditing, ...dipForm } : d)
      : [...diplomas, { id: uid(), ...dipForm }]
    setDiplomas(updated); sbSaveAll('leg_diplomas', LEG_KEY, updated); setDipModal(false)
  }
  function deleteDiploma(id: string) {
    if (!confirm('Eliminar este diploma?')) return
    const updated = diplomas.filter(d => d.id !== id)
    setDiplomas(updated); sbSaveAll('leg_diplomas', LEG_KEY, updated)
  }
  function openEditDiploma(d: Diploma) { const { id, ...r } = d; setDipForm(r); setDipEditing(d); setDipModal(true) }
  function openNewDiploma() { setDipForm(emptyDiploma()); setDipEditing(null); setDipModal(true) }

  // ── Análise IA ────────────────────────────────────────────────────────────
  const selDiploma = diplomas.find(d => d.id === selDiplomaId)

  async function runAnalise() {
    if (!apiKey) { setShowKey(true); return }
    const titulo   = selDiploma ? selDiploma.titulo    : tituloLivre
    const ref      = selDiploma ? selDiploma.referencia: refLivre
    const autor    = selDiploma ? selDiploma.autoridade: autoriaLivre
    const texto    = selDiploma ? selDiploma.descricao + '\n' + selDiploma.observacoes : textoLivre
    if (!titulo) { setAnaliseError('Selecione um diploma ou preencha o título.'); return }
    setAnaliseLoading(true); setAnaliseError('')
    try {
      const raw = await analisarLegislacao(apiKey, titulo, ref, autor, texto)
      const { secoes, nivel } = parseSections(raw)
      const a: AnaliseIA = {
        id: uid(),
        diploma_id: selDiplomaId,
        diploma_titulo: titulo,
        data: today(),
        responsavel: '',
        secoes,
        nivel_impacto: nivel,
      }
      setAnaliseResult(a)
    } catch (e: any) {
      setAnaliseError(e.message ?? 'Erro desconhecido')
    } finally {
      setAnaliseLoading(false)
    }
  }

  function saveAnalise() {
    if (!analiseResult) return
    const updated = [...analises, analiseResult]
    setAnalises(updated); sbSaveAll('leg_analises', ALEG_KEY, updated)
    // link diploma
    if (selDiplomaId) {
      const upd = diplomas.map(d => d.id === selDiplomaId ? { ...d, analise_id: analiseResult.id } : d)
      setDiplomas(upd); sbSaveAll('leg_diplomas', LEG_KEY, upd)
    }
    alert('Análise guardada com sucesso.')
  }

  async function exportAnalisePDF(a: AnaliseIA) {
    const { default: jsPDF } = await import('jspdf')
    const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' })
    const W = 190; let y = 20
    const addText = (text: string, size = 10, bold = false, color = '#111') => {
      doc.setFontSize(size); doc.setFont('helvetica', bold ? 'bold' : 'normal')
      doc.setTextColor(color)
      const lines = doc.splitTextToSize(text, W)
      if (y + lines.length * (size * 0.4) > 270) { doc.addPage(); y = 20 }
      doc.text(lines, 15, y); y += lines.length * (size * 0.45) + 2
    }
    addText('ANÁLISE LEGISLATIVA — BlueCrow Capital', 16, true, '#1e3a5f')
    addText(a.diploma_titulo, 13, true, '#1a1a1a')
    addText(`Data: ${a.data}  |  Impacto: ${a.nivel_impacto}`, 9, false, '#666')
    y += 4
    for (const sec of a.secoes) {
      y += 3
      addText(sec.titulo, 11, true, '#1e3a5f')
      addText(sec.conteudo, 9, false, '#333')
    }
    doc.save(`analise_legislacao_${a.diploma_titulo.replace(/\s+/g,'_').slice(0,40)}.pdf`)
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return
    const reader = new FileReader()
    reader.onload = () => setTextoLivre(reader.result as string)
    reader.readAsText(f)
    e.target.value = ''
  }

  // ── Consultas CRUD ────────────────────────────────────────────────────────
  function saveConsulta() {
    const updated = consEditing
      ? consultas.map(c => c.id === consEditing.id ? { ...consEditing, ...consForm } : c)
      : [...consultas, { id: uid(), ...consForm }]
    setConsultas(updated); sbSaveAll('leg_consultas', CONS_KEY, updated); setConsModal(false)
  }
  function deleteConsulta(id: string) {
    if (!confirm('Eliminar esta consulta?')) return
    const updated = consultas.filter(c => c.id !== id)
    setConsultas(updated); sbSaveAll('leg_consultas', CONS_KEY, updated)
  }
  function openEditConsulta(c: ConsultaPublica) { const { id, ...r } = c; setConsForm(r); setConsEditing(c); setConsModal(true) }
  function openNewConsulta() { setConsForm(emptyConsulta()); setConsEditing(null); setConsModal(true) }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 space-y-4">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <BookOpen size={18} className="text-blue-600"/> Legislação
          </h1>
          <p className="text-[12px] text-gray-400 mt-0.5">Radar legislativo, análise IA de diplomas e acompanhamento de consultas públicas</p>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-5 gap-3">
        <div className="bg-white rounded-2xl border border-gray-100 px-4 py-3">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Total Monitorizado</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{diplomas.length}</p>
          <p className="text-[10px] text-gray-400">diplomas</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 px-4 py-3">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Alto Impacto</p>
          <p className="text-2xl font-bold text-red-600 mt-1">{kpiAlto}</p>
          <p className="text-[10px] text-gray-400">diplomas críticos</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 px-4 py-3">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Em Vigor/Aprovados</p>
          <p className="text-2xl font-bold text-green-600 mt-1">{kpiVigente}</p>
          <p className="text-[10px] text-gray-400">diplomas activos</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 px-4 py-3">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Propostas/Pendentes</p>
          <p className="text-2xl font-bold text-violet-600 mt-1">{kpiProposta}</p>
          <p className="text-[10px] text-gray-400">a monitorizar</p>
        </div>
        <div className={clsx('rounded-2xl border px-4 py-3', consultasAbertas > 0 ? 'bg-amber-50 border-amber-200' : 'bg-white border-gray-100')}>
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Consultas Abertas</p>
          <p className={clsx('text-2xl font-bold mt-1', consultasAbertas > 0 ? 'text-amber-600' : 'text-gray-900')}>{consultasAbertas}</p>
          <p className="text-[10px] text-gray-400">aguardam resposta</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {([
          ['radar',    'Radar Legislativo'],
          ['analise',  'Análise IA'],
          ['consultas','Consultas Públicas'],
        ] as const).map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)}
            className={clsx('text-[12px] font-medium px-5 py-1.5 rounded-lg transition-colors flex items-center gap-1.5',
              tab === k ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700')}>
            {k === 'analise' && <Sparkles size={11} className={tab===k ? 'text-blue-500' : 'text-gray-400'}/>}
            {label}
          </button>
        ))}
      </div>

      {/* ══════ RADAR ══════ */}
      {tab === 'radar' && (
        <div className="space-y-3">
          <div className="bg-white rounded-2xl border border-gray-100">
            {/* Table header + filters */}
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
              <div>
                <span className="text-sm font-semibold text-gray-900">Radar Legislativo</span>
                <p className="text-[11px] text-gray-400 mt-0.5">Diplomas europeus e nacionais em acompanhamento</p>
              </div>
              <button onClick={openNewDiploma} className="flex items-center gap-1.5 text-[11px] font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg px-3 py-1.5 transition-colors">
                <Plus size={12}/> Novo Diploma
              </button>
            </div>
            {/* Search + filters */}
            <div className="px-5 py-2.5 border-b border-gray-100 flex items-center gap-2 flex-wrap">
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"/>
                <input className="w-full pl-7 pr-3 py-1.5 text-[11px] border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400"
                  placeholder="Pesquisar diploma, referência, âmbito…" value={dipSearch} onChange={e => setDipSearch(e.target.value)}/>
              </div>
              <select className="text-[11px] border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none text-gray-600"
                value={dipImpacto} onChange={e => setDipImpacto(e.target.value)}>
                <option value="">Todos os impactos</option>
                <option>Alto</option><option>Médio</option><option>Baixo</option>
              </select>
              <select className="text-[11px] border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none text-gray-600"
                value={dipEstado} onChange={e => setDipEstado(e.target.value)}>
                <option value="">Todos os estados</option>
                <option>Vigente</option><option>Aprovado</option><option>Em consulta</option><option>Proposta</option><option>Revogado</option><option>Pendente</option>
              </select>
              <span className="text-[11px] text-gray-400 ml-auto">{filteredDiplomas.length} diploma{filteredDiplomas.length !== 1 ? 's' : ''}</span>
            </div>
            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="text-[10px] text-gray-500 uppercase tracking-wide border-b border-gray-100 bg-gray-50">
                    {['Referência','Título','Tipo','Autoridade','Data Vigor','Estado','Impacto','Âmbito',''].map(h => (
                      <th key={h} className="px-3 py-3 text-left font-medium whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredDiplomas.length === 0 ? (
                    <tr><td colSpan={9} className="px-5 py-10 text-center text-gray-400">Nenhum diploma encontrado.</td></tr>
                  ) : filteredDiplomas.map(d => (
                    <tr key={d.id} className="border-b border-gray-50 hover:bg-gray-50/60 group">
                      <td className="px-3 py-2.5 font-mono text-blue-700 whitespace-nowrap text-[10px]">{d.referencia || '—'}</td>
                      <td className="px-3 py-2.5 max-w-[220px]">
                        <div className="font-medium text-gray-800 line-clamp-2" title={d.titulo}>{d.titulo}</div>
                        {d.descricao && <div className="text-[10px] text-gray-400 line-clamp-1 mt-0.5" title={d.descricao}>{d.descricao}</div>}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap text-gray-500">{d.tipo}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap text-gray-600">{d.autoridade}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap font-mono text-gray-600">{d.dataVigor || '—'}</td>
                      <td className="px-3 py-2.5">
                        <span className={clsx('text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap', ESTADO_CLS[d.estado])}>{d.estado}</span>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={clsx('text-[10px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap', IMPACTO_CLS[d.impacto])}>{d.impacto}</span>
                      </td>
                      <td className="px-3 py-2.5 text-gray-400 whitespace-nowrap">{d.ambito}</td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => { setSelDiplomaId(d.id); setTab('analise') }}
                            className="flex items-center gap-0.5 text-[10px] font-medium text-violet-600 hover:text-violet-800 bg-violet-50 hover:bg-violet-100 px-2 py-0.5 rounded-lg transition-colors whitespace-nowrap">
                            <Sparkles size={9}/> Analisar
                          </button>
                          <button onClick={() => openEditDiploma(d)} className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-blue-600"><Pencil size={11}/></button>
                          <button onClick={() => deleteDiploma(d.id)} className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-red-500"><Trash2 size={11}/></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Saved analyses section */}
          {analises.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100">
              <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-900 flex items-center gap-2"><Sparkles size={14} className="text-violet-500"/> Análises IA Guardadas</span>
                <span className="text-[11px] text-gray-400">{analises.length} análise{analises.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="divide-y divide-gray-50">
                {analises.map(a => (
                  <div key={a.id} className="px-5 py-3 flex items-center gap-3 hover:bg-gray-50/60 group">
                    <div className={clsx('w-2 h-2 rounded-full flex-shrink-0', a.nivel_impacto === 'Alto' ? 'bg-red-500' : a.nivel_impacto === 'Médio' ? 'bg-amber-500' : 'bg-green-500')}/>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-medium text-gray-800 truncate">{a.diploma_titulo}</p>
                      <p className="text-[10px] text-gray-400">{a.data} · Impacto: {a.nivel_impacto}</p>
                    </div>
                    <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => setViewAnalise(a)} className="text-[10px] text-blue-600 hover:text-blue-800 font-medium">Ver análise</button>
                      <button onClick={() => exportAnalisePDF(a)} className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700"><Download size={11}/></button>
                      <button onClick={() => { if(confirm('Eliminar análise?')) { const u = analises.filter(x=>x.id!==a.id); setAnalises(u); sbSaveAll('leg_analises',ALEG_KEY,u) } }}
                        className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-red-500"><Trash2 size={11}/></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════ ANÁLISE IA ══════ */}
      {tab === 'analise' && (
        <div className="grid grid-cols-[340px_1fr] gap-4 items-start">

          {/* Left: Input panel */}
          <div className="space-y-3">
            {/* API Key */}
            <div className="bg-white rounded-2xl border border-gray-100 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-semibold text-gray-700 flex items-center gap-1.5"><Key size={11}/> API Key Claude</span>
                {apiKey
                  ? <span className="text-[10px] text-green-600 flex items-center gap-1"><CheckCircle2 size={10}/> Configurada</span>
                  : <span className="text-[10px] text-amber-600 flex items-center gap-1"><AlertCircle size={10}/> Necessária</span>}
              </div>
              {(!apiKey || showKey) ? (
                <div className="space-y-2">
                  <input type="password" className="form-input text-[11px]" placeholder="sk-ant-…" value={keyDraft} onChange={e => setKeyDraft(e.target.value)}/>
                  <button onClick={() => { if(keyDraft){ localStorage.setItem('anthropic_api_key', keyDraft); setApiKey(keyDraft) } setShowKey(false) }}
                    className="btn btn-primary btn-sm w-full text-[11px]">Guardar chave</button>
                </div>
              ) : (
                <button onClick={() => { setKeyDraft(''); setShowKey(true) }} className="text-[10px] text-gray-400 hover:text-gray-600">Alterar chave…</button>
              )}
            </div>

            {/* Select diploma */}
            <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
              <p className="text-[12px] font-semibold text-gray-800">Selecionar Diploma</p>
              <select className="form-input text-[11px]" value={selDiplomaId} onChange={e => setSelDiplomaId(e.target.value)}>
                <option value="">— Texto livre / Upload —</option>
                {diplomas.map(d => (
                  <option key={d.id} value={d.id}>{d.referencia || d.titulo}</option>
                ))}
              </select>
              {selDiploma && (
                <div className="bg-blue-50 rounded-xl p-3 space-y-1">
                  <p className="text-[11px] font-semibold text-blue-800">{selDiploma.titulo}</p>
                  <p className="text-[10px] text-blue-600">{selDiploma.autoridade} · {selDiploma.dataVigor}</p>
                  <p className="text-[10px] text-blue-700 line-clamp-3">{selDiploma.descricao}</p>
                </div>
              )}
            </div>

            {/* Free text if no diploma selected */}
            {!selDiplomaId && (
              <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
                <p className="text-[12px] font-semibold text-gray-800">Texto Livre</p>
                <div><label className="form-label">Título do Diploma</label>
                  <input className="form-input text-[11px]" placeholder="Ex: Diretiva (UE) 2024/XXX" value={tituloLivre} onChange={e => setTituloLivre(e.target.value)}/></div>
                <div><label className="form-label">Referência</label>
                  <input className="form-input text-[11px]" placeholder="Ex: Regulamento (UE) 2024/XXX" value={refLivre} onChange={e => setRefLivre(e.target.value)}/></div>
                <div><label className="form-label">Autoridade</label>
                  <input className="form-input text-[11px]" placeholder="Ex: Parlamento Europeu / CMVM" value={autoriaLivre} onChange={e => setAutoriaLivre(e.target.value)}/></div>
                <div>
                  <label className="form-label">Texto / Artigos a Analisar</label>
                  <textarea className="form-input text-[11px]" rows={8} placeholder="Cole aqui o texto do diploma, artigos relevantes, ou uma descrição detalhada…" value={textoLivre} onChange={e => setTextoLivre(e.target.value)}/>
                </div>
                <div>
                  <input ref={fileRef} type="file" accept=".txt,.md" className="hidden" onChange={handleFileUpload}/>
                  <button onClick={() => fileRef.current?.click()}
                    className="flex items-center gap-1.5 text-[11px] border border-dashed border-gray-300 rounded-lg px-3 py-2 text-gray-500 hover:border-blue-400 hover:text-blue-600 w-full justify-center transition-colors">
                    <Upload size={11}/> Carregar ficheiro de texto (.txt, .md)
                  </button>
                </div>
              </div>
            )}

            {/* Analyze button */}
            <button onClick={runAnalise} disabled={analiseLoading || (!selDiplomaId && !tituloLivre)}
              className={clsx('w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-[12px] font-semibold transition-colors',
                analiseLoading || (!selDiplomaId && !tituloLivre)
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-violet-600 hover:bg-violet-700 text-white')}>
              {analiseLoading ? <><Loader2 size={14} className="animate-spin"/> A analisar…</> : <><Sparkles size={14}/> Analisar com IA</>}
            </button>

            {analiseError && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2">
                <AlertCircle size={13} className="text-red-500 flex-shrink-0 mt-0.5"/>
                <p className="text-[11px] text-red-600">{analiseError}</p>
              </div>
            )}
          </div>

          {/* Right: Result panel */}
          <div>
            {!analiseResult && !analiseLoading && (
              <div className="bg-white rounded-2xl border border-gray-100 p-10 flex flex-col items-center justify-center min-h-[400px] text-center">
                <Sparkles size={32} className="text-gray-200 mb-3"/>
                <p className="text-[13px] font-medium text-gray-400">Selecione um diploma e clique em "Analisar com IA"</p>
                <p className="text-[11px] text-gray-300 mt-1">A análise irá identificar obrigações, prazos e recomendações específicas para a BlueCrow Capital</p>
              </div>
            )}
            {analiseLoading && (
              <div className="bg-white rounded-2xl border border-gray-100 p-10 flex flex-col items-center justify-center min-h-[400px] text-center">
                <div className="w-10 h-10 rounded-full border-2 border-violet-600 border-t-transparent animate-spin mb-4"/>
                <p className="text-[12px] text-gray-500">A analisar o diploma…</p>
                <p className="text-[10px] text-gray-300 mt-1">Claude está a processar o texto legislativo</p>
              </div>
            )}
            {analiseResult && !analiseLoading && (
              <div className="space-y-3">
                {/* Result header */}
                <div className="bg-white rounded-2xl border border-gray-100 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[14px] font-bold text-gray-900">{analiseResult.diploma_titulo}</p>
                      <p className="text-[11px] text-gray-400 mt-0.5">Análise gerada em {analiseResult.data}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={clsx('text-[11px] font-bold px-3 py-1 rounded-full border', IMPACTO_CLS[analiseResult.nivel_impacto])}>
                        Impacto {analiseResult.nivel_impacto}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-3">
                    <button onClick={saveAnalise} className="flex items-center gap-1.5 text-[11px] font-medium bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg transition-colors">
                      <Save size={11}/> Guardar Análise
                    </button>
                    <button onClick={() => exportAnalisePDF(analiseResult)} className="flex items-center gap-1.5 text-[11px] font-medium border border-gray-200 hover:border-gray-300 text-gray-600 px-3 py-1.5 rounded-lg transition-colors">
                      <Download size={11}/> Exportar PDF
                    </button>
                    <button onClick={() => setAnaliseResult(null)} className="flex items-center gap-1.5 text-[11px] text-gray-400 hover:text-gray-600 px-2 py-1.5 rounded-lg transition-colors">
                      <X size={11}/> Limpar
                    </button>
                  </div>
                </div>

                {/* Sections */}
                {analiseResult.secoes.map((sec, i) => (
                  <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4">
                    <p className="text-[12px] font-bold text-gray-800 mb-2 flex items-center gap-1.5">
                      <span className="text-[14px]">{sectionIcon(sec.titulo)}</span>
                      {sec.titulo}
                    </p>
                    <div className="text-[11px] text-gray-600 leading-relaxed whitespace-pre-wrap">{sec.conteudo}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════ CONSULTAS PÚBLICAS ══════ */}
      {tab === 'consultas' && (
        <div className="bg-white rounded-2xl border border-gray-100">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
            <div>
              <span className="text-sm font-semibold text-gray-900">Consultas Públicas</span>
              <p className="text-[11px] text-gray-400 mt-0.5">Acompanhamento de consultas abertas por reguladores e legisladores</p>
            </div>
            <button onClick={openNewConsulta} className="flex items-center gap-1.5 text-[11px] font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg px-3 py-1.5 transition-colors">
              <Plus size={12}/> Nova Consulta
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="text-[10px] text-gray-500 uppercase tracking-wide border-b border-gray-100 bg-gray-50">
                  {['Título','Autoridade','Abertura','Encerramento','Estado','Prazo','Parecer BCR',''].map(h => (
                    <th key={h} className="px-3 py-3 text-left font-medium whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {consultas.length === 0 ? (
                  <tr><td colSpan={8} className="px-5 py-10 text-center text-gray-400">Nenhuma consulta registada.</td></tr>
                ) : consultas.map(c => {
                  const enc = parseDate(c.encerramento)
                  const dias = enc ? daysUntil(enc) : null
                  const urgente = c.estado === 'Aberta' && dias !== null && dias <= 14
                  return (
                    <tr key={c.id} className={clsx('border-b border-gray-50 hover:bg-gray-50/60 group', urgente && 'bg-amber-50/30')}>
                      <td className="px-3 py-2.5 max-w-[250px]">
                        <div className="font-medium text-gray-800 line-clamp-2" title={c.titulo}>{c.titulo}</div>
                        {c.link && <a href={c.link} target="_blank" rel="noreferrer" className="text-[10px] text-blue-500 hover:underline flex items-center gap-0.5 mt-0.5"><ExternalLink size={9}/> Link</a>}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap text-gray-600">{c.autoridade}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap font-mono text-gray-500">{c.abertura}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap font-mono text-gray-500">{c.encerramento}</td>
                      <td className="px-3 py-2.5">
                        <span className={clsx('text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap', CONS_ESTADO_CLS[c.estado])}>{c.estado}</span>
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        {c.estado === 'Aberta' && dias !== null ? (
                          <span className={clsx('text-[10px] font-semibold flex items-center gap-1',
                            dias < 0 ? 'text-red-600' : urgente ? 'text-amber-600' : 'text-gray-600')}>
                            {dias < 0 ? <><AlertTriangle size={10}/> Expirada</> : urgente ? <><Clock size={10}/> {dias}d</> : `${dias} dias`}
                          </span>
                        ) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-3 py-2.5 max-w-[200px] text-gray-500">
                        <div className="line-clamp-2" title={c.parecer_bc}>{c.parecer_bc || <span className="text-gray-200">—</span>}</div>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => openEditConsulta(c)} className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-blue-600"><Pencil size={11}/></button>
                          <button onClick={() => deleteConsulta(c.id)} className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-red-500"><Trash2 size={11}/></button>
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

      {/* ══════ MODAL: View Analysis ══════ */}
      {viewAnalise && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl border border-gray-200 w-[700px] max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white">
              <div>
                <p className="text-[13px] font-bold text-gray-900">{viewAnalise.diploma_titulo}</p>
                <p className="text-[11px] text-gray-400">{viewAnalise.data} · Impacto: {viewAnalise.nivel_impacto}</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => exportAnalisePDF(viewAnalise)} className="flex items-center gap-1.5 text-[11px] border border-gray-200 rounded-lg px-3 py-1.5 text-gray-600 hover:border-gray-300 transition-colors">
                  <Download size={11}/> PDF
                </button>
                <button onClick={() => setViewAnalise(null)} className="text-gray-400 hover:text-gray-700 p-1"><X size={16}/></button>
              </div>
            </div>
            <div className="p-5 space-y-4">
              {viewAnalise.secoes.map((sec, i) => (
                <div key={i} className="border border-gray-100 rounded-xl p-4">
                  <p className="text-[12px] font-bold text-gray-800 mb-2 flex items-center gap-1.5">
                    <span className="text-[14px]">{sectionIcon(sec.titulo)}</span>{sec.titulo}
                  </p>
                  <div className="text-[11px] text-gray-600 leading-relaxed whitespace-pre-wrap">{sec.conteudo}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ══════ MODAL: Diploma ══════ */}
      {dipModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl border border-gray-200 p-6 w-[680px] max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="flex items-center justify-between mb-5">
              <span className="text-[14px] font-semibold text-gray-900">{dipEditing ? 'Editar Diploma' : 'Novo Diploma'}</span>
              <button onClick={() => setDipModal(false)} className="text-gray-400 hover:text-gray-600"><X size={16}/></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><label className="form-label">Título</label><input className="form-input" value={dipForm.titulo} onChange={e=>setDipForm({...dipForm,titulo:e.target.value})}/></div>
              <div><label className="form-label">Referência</label><input className="form-input" placeholder="Ex: Regulamento (UE) 2024/XXX" value={dipForm.referencia} onChange={e=>setDipForm({...dipForm,referencia:e.target.value})}/></div>
              <div><label className="form-label">Tipo</label>
                <select className="form-input" value={dipForm.tipo} onChange={e=>setDipForm({...dipForm,tipo:e.target.value as TipoDiploma})}>
                  <option>Diretiva UE</option><option>Regulamento UE</option><option>Lei</option><option>Decreto-Lei</option><option>Regulamento CMVM</option><option>Instrução BdP</option><option>Portaria</option><option>Outro</option>
                </select>
              </div>
              <div><label className="form-label">Autoridade</label><input className="form-input" placeholder="Ex: Parlamento Europeu / CMVM" value={dipForm.autoridade} onChange={e=>setDipForm({...dipForm,autoridade:e.target.value})}/></div>
              <div><label className="form-label">Âmbito</label><input className="form-input" placeholder="Ex: Gestão de Ativos / AIFMD" value={dipForm.ambito} onChange={e=>setDipForm({...dipForm,ambito:e.target.value})}/></div>
              <div><label className="form-label">Data Publicação</label><input type="date" className="form-input" value={toInputDate(dipForm.dataPublicacao)} onChange={e=>setDipForm({...dipForm,dataPublicacao:fromInputDate(e.target.value)})}/></div>
              <div><label className="form-label">Data Vigor / Aplicação</label><input type="date" className="form-input" value={toInputDate(dipForm.dataVigor)} onChange={e=>setDipForm({...dipForm,dataVigor:fromInputDate(e.target.value)})}/></div>
              <div><label className="form-label">Estado</label>
                <select className="form-input" value={dipForm.estado} onChange={e=>setDipForm({...dipForm,estado:e.target.value as EstadoDiploma})}>
                  <option>Vigente</option><option>Aprovado</option><option>Proposta</option><option>Em consulta</option><option>Pendente</option><option>Suspenso</option><option>Revogado</option>
                </select>
              </div>
              <div><label className="form-label">Impacto para BCR</label>
                <select className="form-input" value={dipForm.impacto} onChange={e=>setDipForm({...dipForm,impacto:e.target.value as Impacto})}>
                  <option>—</option><option>Alto</option><option>Médio</option><option>Baixo</option>
                </select>
              </div>
              <div className="col-span-2"><label className="form-label">Descrição</label><textarea className="form-input" rows={3} value={dipForm.descricao} onChange={e=>setDipForm({...dipForm,descricao:e.target.value})}/></div>
              <div className="col-span-2"><label className="form-label">Observações</label><textarea className="form-input" rows={2} value={dipForm.observacoes} onChange={e=>setDipForm({...dipForm,observacoes:e.target.value})}/></div>
            </div>
            <div className="flex justify-end gap-2 pt-4 mt-4 border-t border-gray-100">
              <button onClick={() => setDipModal(false)} className="btn btn-outline btn-sm">Cancelar</button>
              <button onClick={saveDiploma} disabled={!dipForm.titulo} className="btn btn-primary btn-sm">Guardar</button>
            </div>
          </div>
        </div>
      )}

      {/* ══════ MODAL: Consulta ══════ */}
      {consModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl border border-gray-200 p-6 w-[620px] max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="flex items-center justify-between mb-5">
              <span className="text-[14px] font-semibold text-gray-900">{consEditing ? 'Editar Consulta' : 'Nova Consulta Pública'}</span>
              <button onClick={() => setConsModal(false)} className="text-gray-400 hover:text-gray-600"><X size={16}/></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><label className="form-label">Título</label><input className="form-input" value={consForm.titulo} onChange={e=>setConsForm({...consForm,titulo:e.target.value})}/></div>
              <div><label className="form-label">Autoridade</label><input className="form-input" placeholder="Ex: CMVM / ESMA / CE" value={consForm.autoridade} onChange={e=>setConsForm({...consForm,autoridade:e.target.value})}/></div>
              <div><label className="form-label">Estado</label>
                <select className="form-input" value={consForm.estado} onChange={e=>setConsForm({...consForm,estado:e.target.value as ConsultaPublica['estado']})}>
                  <option>Aberta</option><option>Em análise</option><option>Encerrada</option>
                </select>
              </div>
              <div><label className="form-label">Data Abertura</label><input type="date" className="form-input" value={toInputDate(consForm.abertura)} onChange={e=>setConsForm({...consForm,abertura:fromInputDate(e.target.value)})}/></div>
              <div><label className="form-label">Data Encerramento</label><input type="date" className="form-input" value={toInputDate(consForm.encerramento)} onChange={e=>setConsForm({...consForm,encerramento:fromInputDate(e.target.value)})}/></div>
              <div className="col-span-2"><label className="form-label">Link</label><input className="form-input" placeholder="https://…" value={consForm.link} onChange={e=>setConsForm({...consForm,link:e.target.value})}/></div>
              <div className="col-span-2"><label className="form-label">Parecer / Posição BCR</label><textarea className="form-input" rows={3} placeholder="Resumo da posição da BlueCrow Capital ou estado de preparação da resposta…" value={consForm.parecer_bc} onChange={e=>setConsForm({...consForm,parecer_bc:e.target.value})}/></div>
              <div className="col-span-2"><label className="form-label">Observações</label><textarea className="form-input" rows={2} value={consForm.observacoes} onChange={e=>setConsForm({...consForm,observacoes:e.target.value})}/></div>
            </div>
            <div className="flex justify-end gap-2 pt-4 mt-4 border-t border-gray-100">
              <button onClick={() => setConsModal(false)} className="btn btn-outline btn-sm">Cancelar</button>
              <button onClick={saveConsulta} disabled={!consForm.titulo} className="btn btn-primary btn-sm">Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
