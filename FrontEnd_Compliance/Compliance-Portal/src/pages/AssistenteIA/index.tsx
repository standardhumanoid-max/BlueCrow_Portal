import { useState, useRef, useEffect } from 'react'
import * as XLSX from 'xlsx'
import {
  Upload, X, FileText, FileSpreadsheet, File, Sparkles,
  Send, Bot, User, Key, AlertCircle, Trash2, Plus,
  ChevronDown, Loader2, BookOpen,
} from 'lucide-react'
import { clsx } from 'clsx'

// ─── Types ─────────────────────────────────────────────────────────────────────
interface Source {
  id: string
  name: string
  type: 'pdf' | 'excel' | 'txt' | 'other'
  size: string
  pdfBase64?: string   // raw base64 for PDFs (passed to Claude as document block)
  text?: string        // extracted text for xlsx / txt
  addedAt: string
}

interface Msg {
  role: 'user' | 'assistant'
  content: string
  ts: string
  error?: boolean
}

// ─── Helpers ───────────────────────────────────────────────────────────────────
function uid() { return Math.random().toString(36).slice(2, 9) }

function fmtSize(bytes: number) {
  return bytes > 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${(bytes / 1024).toFixed(0)} KB`
}

function guessType(name: string): Source['type'] {
  const ext = name.split('.').pop()?.toLowerCase()
  if (ext === 'pdf') return 'pdf'
  if (['xlsx', 'xls', 'csv'].includes(ext ?? '')) return 'excel'
  if (['txt', 'md'].includes(ext ?? '')) return 'txt'
  return 'other'
}

function extractExcelText(base64: string): string {
  try {
    const raw = base64.includes(',') ? base64.split(',')[1] : base64
    const wb = XLSX.read(raw, { type: 'base64' })
    let out = ''
    for (const sheetName of wb.SheetNames) {
      out += `### Folha: ${sheetName}\n`
      out += XLSX.utils.sheet_to_csv(wb.Sheets[sheetName])
      out += '\n\n'
    }
    return out.trim()
  } catch {
    return '[Erro ao extrair conteúdo do ficheiro Excel]'
  }
}

// ─── Anthropic API call ────────────────────────────────────────────────────────
async function askClaude(
  apiKey: string,
  sources: Source[],
  history: Msg[],
  question: string,
): Promise<string> {
  // System message: identity + text sources
  const textSources = sources.filter(s => s.text)
  let systemText = `Você é um assistente especialista em compliance para gestoras de fundos (SCR/AIFMD). Responda sempre em português europeu de forma clara e precisa.

Quando existem documentos carregados como fontes, baseie as suas respostas principalmente nesses documentos. Cite o nome do documento quando relevante. Se a resposta não estiver nos documentos, diga claramente que a informação não consta nas fontes fornecidas, mas pode dar uma resposta geral se souber.`

  if (textSources.length > 0) {
    systemText += '\n\n## Fontes de texto disponíveis:\n\n'
    for (const s of textSources) {
      systemText += `### ${s.name}\n${s.text}\n\n`
    }
  }

  // Build user content: PDF document blocks + question
  const pdfSources = sources.filter(s => s.type === 'pdf' && s.pdfBase64)

  // Build messages array from history (exclude system messages)
  const messages: { role: 'user' | 'assistant'; content: any }[] = []

  // Prior history (text only for previous turns)
  for (const m of history.slice(-6)) {
    messages.push({ role: m.role, content: m.content })
  }

  // Current user message with PDF docs + question
  const userContent: any[] = []
  for (const s of pdfSources) {
    userContent.push({
      type: 'document',
      source: { type: 'base64', media_type: 'application/pdf', data: s.pdfBase64! },
      title: s.name,
    })
  }
  userContent.push({ type: 'text', text: question })

  messages.push({ role: 'user', content: pdfSources.length > 0 ? userContent : question })

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
      max_tokens: 2048,
      system: systemText,
      messages,
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error?.message ?? `Erro HTTP ${res.status}`)
  }

  const data = await res.json()
  return data.content?.[0]?.text ?? '(sem resposta)'
}

// ─── Source icon ───────────────────────────────────────────────────────────────
function SourceIcon({ type, className }: { type: Source['type']; className?: string }) {
  if (type === 'pdf')   return <FileText       className={clsx('text-red-500',    className)} />
  if (type === 'excel') return <FileSpreadsheet className={clsx('text-green-600',  className)} />
  if (type === 'txt')   return <BookOpen        className={clsx('text-blue-500',   className)} />
  return                        <File           className={clsx('text-gray-400',   className)} />
}

// ─── Suggested questions ───────────────────────────────────────────────────────
const SUGGESTIONS = [
  'Faz um resumo dos documentos carregados.',
  'Quais são as principais obrigações identificadas?',
  'Quais são os prazos mais importantes?',
  'Existem riscos ou incumprimentos mencionados?',
  'Quais as ações recomendadas?',
]

// ─── Main component ────────────────────────────────────────────────────────────
export function AssistenteIA() {
  const [sources, setSources]       = useState<Source[]>([])
  const [messages, setMessages]     = useState<Msg[]>([])
  const [input, setInput]           = useState('')
  const [loading, setLoading]       = useState(false)
  const [apiKey, setApiKey]         = useState(() => localStorage.getItem('anthropic_api_key') ?? '')
  const [showKeyInput, setShowKeyInput] = useState(false)
  const [keyDraft, setKeyDraft]     = useState('')
  const [dragOver, setDragOver]     = useState(false)
  const fileRef  = useRef<HTMLInputElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  // ── File processing ──────────────────────────────────────────────────────────
  function processFile(file: File) {
    const type = guessType(file.name)
    const size = fmtSize(file.size)
    const reader = new FileReader()

    reader.onload = (e) => {
      const result = e.target?.result as string
      const src: Source = { id: uid(), name: file.name, type, size, addedAt: new Date().toISOString() }

      if (type === 'pdf') {
        // Strip data URL prefix to get raw base64
        src.pdfBase64 = result.includes(',') ? result.split(',')[1] : result
      } else if (type === 'excel') {
        src.text = extractExcelText(result)
      } else {
        // TXT / other: read as text
        src.text = typeof result === 'string' && result.includes(',')
          ? atob(result.split(',')[1])
          : result
      }

      setSources(p => [...p, src])
    }

    if (type === 'txt') {
      reader.readAsText(file)
    } else {
      reader.readAsDataURL(file)
    }
  }

  function handleFiles(files: FileList | null) {
    if (!files) return
    Array.from(files).forEach(processFile)
  }

  // ── Drag & drop ──────────────────────────────────────────────────────────────
  function onDrop(e: React.DragEvent) {
    e.preventDefault(); setDragOver(false)
    handleFiles(e.dataTransfer.files)
  }

  // ── Send message ─────────────────────────────────────────────────────────────
  async function send(text?: string) {
    const q = (text ?? input).trim()
    if (!q || loading) return
    if (!apiKey) { setShowKeyInput(true); return }

    const userMsg: Msg = { role: 'user', content: q, ts: new Date().toISOString() }
    setMessages(p => [...p, userMsg])
    setInput('')
    setLoading(true)

    try {
      const answer = await askClaude(apiKey, sources, messages, q)
      setMessages(p => [...p, { role: 'assistant', content: answer, ts: new Date().toISOString() }])
    } catch (err: any) {
      setMessages(p => [...p, {
        role: 'assistant',
        content: `Erro: ${err.message ?? 'Falha na ligação à API'}`,
        ts: new Date().toISOString(),
        error: true,
      }])
    } finally {
      setLoading(false)
    }
  }

  function saveKey() {
    const k = keyDraft.trim()
    if (!k) return
    localStorage.setItem('anthropic_api_key', k)
    setApiKey(k)
    setShowKeyInput(false)
    setKeyDraft('')
  }

  const hasKey     = !!apiKey
  const hasSources = sources.length > 0

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-full overflow-hidden bg-[#f5f6fa]">

      {/* ── LEFT: Sources panel ────────────────────────────────────────────── */}
      <div className="w-[280px] min-w-[280px] bg-white border-r border-gray-200 flex flex-col overflow-hidden">
        <div className="px-4 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-md bg-[#1e3a5f] flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-[13px] font-semibold text-gray-900">Fontes</span>
            {hasSources && (
              <span className="ml-auto text-[10px] bg-blue-100 text-blue-700 font-semibold px-1.5 py-0.5 rounded-full">
                {sources.length}
              </span>
            )}
          </div>

          {/* Upload button */}
          <button
            onClick={() => fileRef.current?.click()}
            className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-gray-300 rounded-xl py-3 text-[12px] text-gray-500 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50/30 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Adicionar fonte
          </button>
          <input
            ref={fileRef}
            type="file"
            multiple
            className="hidden"
            accept=".pdf,.xlsx,.xls,.csv,.txt,.md,.docx"
            onChange={e => handleFiles(e.target.files)}
          />
          <div className="text-[10px] text-gray-400 text-center mt-1.5">
            PDF · Excel · CSV · TXT
          </div>
        </div>

        {/* Drop zone + source list */}
        <div
          className={clsx(
            'flex-1 overflow-y-auto transition-colors',
            dragOver && 'bg-blue-50/60',
          )}
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
        >
          {sources.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-6 text-gray-400">
              <Upload className="w-8 h-8 mb-3 opacity-30" />
              <p className="text-[12px] font-medium text-gray-500">Arraste ficheiros aqui</p>
              <p className="text-[11px] mt-1">ou clique em "Adicionar fonte"</p>
            </div>
          ) : (
            <div className="p-3 space-y-2">
              {sources.map(s => (
                <div key={s.id}
                  className="flex items-center gap-2.5 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 group">
                  <SourceIcon type={s.type} className="w-4 h-4 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-medium text-gray-800 truncate" title={s.name}>{s.name}</div>
                    <div className="text-[10px] text-gray-400">{s.size}</div>
                  </div>
                  <button
                    onClick={() => setSources(p => p.filter(x => x.id !== s.id))}
                    className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* API key section */}
        <div className="border-t border-gray-100 px-3 py-3">
          {hasKey ? (
            <button
              onClick={() => { setKeyDraft(apiKey); setShowKeyInput(true) }}
              className="flex items-center gap-1.5 text-[11px] text-gray-400 hover:text-gray-700 transition-colors w-full"
            >
              <Key className="w-3 h-3" />
              <span>API key configurada</span>
              <span className="ml-auto text-[10px] bg-green-100 text-green-600 font-semibold px-1.5 py-0.5 rounded-full">ativa</span>
            </button>
          ) : (
            <button
              onClick={() => setShowKeyInput(true)}
              className="flex items-center gap-1.5 text-[11px] text-amber-600 hover:text-amber-800 transition-colors w-full"
            >
              <AlertCircle className="w-3 h-3" />
              <span>Configurar chave API</span>
            </button>
          )}
        </div>
      </div>

      {/* ── RIGHT: Chat panel ───────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-3.5 flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#1e3a5f] to-blue-500 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="text-[13px] font-semibold text-gray-900">Assistente IA — Compliance</div>
            <div className="text-[11px] text-gray-400">
              {hasSources
                ? `${sources.length} fonte${sources.length !== 1 ? 's' : ''} carregada${sources.length !== 1 ? 's' : ''}`
                : 'Sem fontes — pode fazer perguntas gerais de compliance'
              }
            </div>
          </div>
          {!hasKey && (
            <div className="ml-auto flex items-center gap-1.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg px-3 py-1.5 text-[11px] font-medium">
              <AlertCircle className="w-3.5 h-3.5" />
              Chave API necessária
            </div>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">

          {/* Empty state */}
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center max-w-lg mx-auto">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#1e3a5f] to-blue-500 flex items-center justify-center mb-4">
                <Sparkles className="w-7 h-7 text-white" />
              </div>
              <h2 className="text-[15px] font-semibold text-gray-900 mb-1">
                {hasSources ? 'Pronto para analisar as suas fontes' : 'Assistente de Compliance'}
              </h2>
              <p className="text-[12px] text-gray-500 mb-6 leading-relaxed">
                {hasSources
                  ? `Carregou ${sources.length} documento${sources.length !== 1 ? 's' : ''}. Faça perguntas sobre o conteúdo ou peça um resumo.`
                  : 'Carregue documentos (PDF, Excel, TXT) para análise contextual, ou faça perguntas gerais de compliance regulatório.'
                }
              </p>
              {/* Suggested questions */}
              <div className="w-full space-y-2">
                <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  {hasSources ? 'Sugestões' : 'Perguntas frequentes'}
                </div>
                {(hasSources ? SUGGESTIONS : [
                  'Quais são os requisitos da DORA para gestoras de ativos?',
                  'O que obriga o PBCFT em termos de KYC?',
                  'Quais são os reportes obrigatórios à CMVM?',
                  'O que é o Annex IV AIFMD e quando é reportado?',
                  'Quais as obrigações do SFDR para fundos Artigo 8?',
                ]).map(q => (
                  <button key={q}
                    onClick={() => send(q)}
                    disabled={!hasKey}
                    className="w-full text-left flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-[12px] text-gray-700 hover:border-blue-300 hover:bg-blue-50/30 hover:text-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <ChevronDown className="w-3 h-3 text-gray-300 rotate-[-90deg] flex-shrink-0" />
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Message bubbles */}
          {messages.map((m, i) => (
            <div key={i} className={clsx('flex gap-3', m.role === 'user' ? 'justify-end' : 'justify-start')}>
              {m.role === 'assistant' && (
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#1e3a5f] to-blue-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Bot className="w-4 h-4 text-white" />
                </div>
              )}
              <div className={clsx(
                'rounded-2xl px-4 py-3 text-[13px] leading-relaxed max-w-[75%]',
                m.role === 'user'
                  ? 'bg-[#1e3a5f] text-white rounded-tr-sm'
                  : m.error
                    ? 'bg-red-50 text-red-700 border border-red-200 rounded-tl-sm'
                    : 'bg-white border border-gray-200 text-gray-800 rounded-tl-sm shadow-sm',
              )}>
                {/* Render markdown-ish bold */}
                <MessageContent content={m.content} />
              </div>
              {m.role === 'user' && (
                <div className="w-7 h-7 rounded-lg bg-gray-200 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <User className="w-4 h-4 text-gray-600" />
                </div>
              )}
            </div>
          ))}

          {/* Loading */}
          {loading && (
            <div className="flex gap-3 justify-start">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#1e3a5f] to-blue-500 flex items-center justify-center flex-shrink-0">
                <Bot className="w-4 h-4 text-white" />
              </div>
              <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 text-blue-500 animate-spin" />
                <span className="text-[12px] text-gray-500">A analisar{hasSources ? ' documentos' : ''}…</span>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input bar */}
        <div className="bg-white border-t border-gray-200 px-6 py-4">
          {!hasKey && (
            <div className="mb-3 flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5">
              <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />
              <span className="text-[12px] text-amber-700 flex-1">
                Configure a chave da API Anthropic para activar o assistente.
              </span>
              <button onClick={() => setShowKeyInput(true)}
                className="text-[12px] font-semibold text-amber-700 hover:text-amber-900 underline flex-shrink-0">
                Configurar
              </button>
            </div>
          )}
          <div className="flex items-end gap-3">
            <div className="flex-1 bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 focus-within:ring-2 focus-within:ring-blue-400 focus-within:border-blue-300 transition-all">
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
                }}
                placeholder={hasSources
                  ? `Faça uma pergunta sobre ${sources.length === 1 ? sources[0].name : 'os documentos'}…`
                  : 'Faça uma pergunta de compliance…'
                }
                rows={1}
                className="w-full bg-transparent text-[13px] text-gray-900 placeholder-gray-400 focus:outline-none resize-none leading-relaxed"
                style={{ maxHeight: 120, overflowY: 'auto' }}
              />
            </div>
            <button
              onClick={() => send()}
              disabled={!input.trim() || loading || !hasKey}
              className="w-10 h-10 bg-[#1e3a5f] hover:bg-blue-800 disabled:bg-gray-200 text-white rounded-xl flex items-center justify-center transition-colors flex-shrink-0"
            >
              {loading
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <Send className="w-4 h-4" />
              }
            </button>
          </div>
          <div className="text-[10px] text-gray-400 mt-2 text-center">
            Enter para enviar · Shift+Enter para nova linha
          </div>
        </div>
      </div>

      {/* ── API Key modal ─────────────────────────────────────────────────────── */}
      {showKeyInput && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-100">
              <div className="flex items-center gap-2 mb-1">
                <Key className="w-4 h-4 text-[#1e3a5f]" />
                <span className="text-[14px] font-semibold text-gray-900">Chave API Anthropic</span>
              </div>
              <p className="text-[12px] text-gray-500">
                Necessária para activar o assistente. Obtém a tua chave em{' '}
                <span className="text-blue-600 font-medium">console.anthropic.com</span>
              </p>
            </div>
            <div className="px-6 py-4 space-y-3">
              <div>
                <label className="block text-[11px] font-medium text-gray-500 mb-1">Chave API (sk-ant-…)</label>
                <input
                  type="password"
                  value={keyDraft || apiKey}
                  onChange={e => setKeyDraft(e.target.value)}
                  placeholder="sk-ant-api03-…"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-[13px] font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                  onKeyDown={e => e.key === 'Enter' && saveKey()}
                />
              </div>
              <div className="bg-gray-50 rounded-xl p-3 text-[11px] text-gray-500 space-y-1">
                <div className="font-medium text-gray-700">Como funciona</div>
                <ul className="list-disc list-inside space-y-0.5">
                  <li>A chave é guardada apenas no seu browser (localStorage)</li>
                  <li>Nunca é enviada para servidores externos além da API Anthropic</li>
                  <li>Pode remover a qualquer momento</li>
                </ul>
              </div>
            </div>
            <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
              {hasKey && (
                <button onClick={() => {
                  localStorage.removeItem('anthropic_api_key')
                  setApiKey(''); setKeyDraft(''); setShowKeyInput(false)
                }} className="text-[12px] text-red-500 hover:text-red-700">
                  Remover chave
                </button>
              )}
              <div className="flex gap-2 ml-auto">
                <button onClick={() => { setShowKeyInput(false); setKeyDraft('') }}
                  className="px-3 py-1.5 text-[12px] text-gray-600 hover:text-gray-900">
                  Cancelar
                </button>
                <button
                  onClick={saveKey}
                  disabled={!(keyDraft || apiKey).trim()}
                  className="px-4 py-1.5 text-[12px] bg-[#1e3a5f] text-white rounded-xl hover:bg-blue-800 disabled:opacity-40 transition-colors">
                  Guardar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Simple markdown renderer ─────────────────────────────────────────────────
function MessageContent({ content }: { content: string }) {
  // Split by newlines and render paragraphs with bold support
  const lines = content.split('\n')
  return (
    <div className="space-y-1.5">
      {lines.map((line, i) => {
        if (!line.trim()) return <div key={i} className="h-1" />
        // Headings
        if (line.startsWith('### ')) return <div key={i} className="font-semibold text-[13px] mt-2">{line.slice(4)}</div>
        if (line.startsWith('## '))  return <div key={i} className="font-bold text-[14px] mt-2">{line.slice(3)}</div>
        if (line.startsWith('# '))   return <div key={i} className="font-bold text-[15px] mt-2">{line.slice(2)}</div>
        // Bullet points
        if (line.startsWith('- ') || line.startsWith('* ')) {
          return (
            <div key={i} className="flex gap-2">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-current flex-shrink-0 opacity-60" />
              <span>{renderBold(line.slice(2))}</span>
            </div>
          )
        }
        // Numbered list
        const num = line.match(/^(\d+)\. (.+)/)
        if (num) {
          return (
            <div key={i} className="flex gap-2">
              <span className="font-semibold text-[12px] flex-shrink-0 opacity-70 w-5 text-right">{num[1]}.</span>
              <span>{renderBold(num[2])}</span>
            </div>
          )
        }
        return <p key={i}>{renderBold(line)}</p>
      })}
    </div>
  )
}

function renderBold(text: string): React.ReactNode {
  const parts = text.split(/\*\*(.*?)\*\*/)
  return parts.map((p, i) => i % 2 === 1 ? <strong key={i}>{p}</strong> : p)
}
