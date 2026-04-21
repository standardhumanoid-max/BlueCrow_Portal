import { Bell, Download, Plus, X, Clock, Shield, CheckSquare } from 'lucide-react'
import { useStore } from '@/store/useStore'
import type { PageId, ComplianceTask, Risk, SecurityAlert } from '@/types'
import { useState, useEffect, useRef, useMemo } from 'react'
import { supabase } from '@/services/supabase'

// ─── Page metadata ─────────────────────────────────────────────────────────────
const PAGE_TITLES: Record<PageId, { title: string; sub: string }> = {
  dashboard:    { title: 'Dashboard',                 sub: '17 de março de 2026' },
  compliance:   { title: 'Compliance',                sub: 'Plano Anual · Reportes' },
  controlo:     { title: 'Controlo Interno',          sub: 'Organogramas · Registos · Relatório' },
  riscos:       { title: 'Gestão de Riscos',          sub: 'Matriz de Risco · Limites Legais' },
  pbcft:        { title: 'PBC/FT',                    sub: 'KYC · Mapa Clientes · Deveres · Modelos' },
  rgpd:         { title: 'RGPD',                      sub: 'Checklist · Plano · Matriz · DPIA' },
  oia:          { title: 'OIA',                       sub: '' },
  scr:          { title: 'SCR',                       sub: '' },
  cmvm:         { title: 'CMVM',                      sub: '' },
  regulatorio:  { title: 'Quadro Regulatório',        sub: 'CMVM · BdP · ESMA · Legislação' },
  legislacao:   { title: 'Legislação',                sub: 'Carregue documentos · Análise com IA' },
  politicas:    { title: 'Políticas e Procedimentos', sub: 'BCR-COMP Série · 8 documentos' },
  formacao:     { title: 'Formação',                  sub: '' },
  estrutura:    { title: 'Estrutura Organizacional',  sub: 'Organograma · Responsabilidades' },
  assistente:   { title: 'Assistente IA',             sub: 'Análise regulatória com IA' },
  reportes:     { title: 'Reportes',                  sub: '' },
  roadmap:        { title: 'Roadmap',          sub: 'Melhorias planeadas · Em desenvolvimento · Concluídas' },
  ciberseguranca: { title: 'Cibersegurança',   sub: '' },
}

// ─── Date helpers ──────────────────────────────────────────────────────────────
function parseDMY(s: string): Date | null {
  if (!s) return null
  const parts = s.split('.')
  if (parts.length !== 3) return null
  const [d, m, y] = parts
  const dt = new Date(+y, +m - 1, +d)
  return isNaN(dt.getTime()) ? null : dt
}

function daysUntil(dateStr: string): number | null {
  const d = parseDMY(dateStr)
  if (!d) return null
  return Math.ceil((d.getTime() - Date.now()) / 86400000)
}

// ─── Notifications ─────────────────────────────────────────────────────────────
const DISMISSED_KEY = 'topbar_dismissed_notifs'
function loadDismissed(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(DISMISSED_KEY) || '[]')) } catch { return new Set() }
}
function saveDismissed(ids: Set<string>) {
  try { localStorage.setItem(DISMISSED_KEY, JSON.stringify([...ids])) } catch {}
}

type NotifType = 'deadline' | 'task' | 'security'
interface Notif {
  id: string
  type: NotifType
  title: string
  detail: string
  page: PageId
  urgent: boolean
}

type CmvmSup = { id: string; identificacao: string; assunto: string; data_limite: string; estado: string }

function buildNotifications(tasks: ComplianceTask[], securityAlerts: SecurityAlert[], cmvmSups: CmvmSup[]): Notif[] {
  const notifs: Notif[] = []

  // CMVM supervisões — prazos nos próximos 30 dias
  try {
    const sups = cmvmSups
    for (const s of sups) {
      if (!s.data_limite || s.estado === 'Fechado' || s.estado === 'Respondido') continue
      const days = daysUntil(s.data_limite)
      if (days !== null && days >= 0 && days <= 30) {
        notifs.push({
          id: `cmvm-${s.id}`,
          type: 'deadline',
          title: s.identificacao || s.assunto,
          detail: days === 0 ? 'Prazo hoje' : `Prazo em ${days} dia${days !== 1 ? 's' : ''}`,
          page: 'cmvm',
          urgent: days <= 7,
        })
      }
    }
  } catch {}

  // Compliance tasks — vencidas nos próximos 14 dias
  for (const t of tasks) {
    if (!t.prazo || t.estado === 'Concluído') continue
    const days = daysUntil(t.prazo)
    if (days !== null && days >= 0 && days <= 14) {
      notifs.push({
        id: `task-${t.id}`,
        type: 'task',
        title: t.tarefa,
        detail: days === 0 ? 'Prazo hoje' : `Prazo em ${days} dia${days !== 1 ? 's' : ''}`,
        page: 'compliance',
        urgent: days <= 3,
      })
    }
  }

  // Security alerts — não dispensados
  for (const a of securityAlerts) {
    if (a.dismissed) continue
    notifs.push({
      id: `sec-${a.id}`,
      type: 'security',
      title: a.title,
      detail: a.severity,
      page: 'ciberseguranca',
      urgent: a.severity === 'Crítico' || a.severity === 'Alto',
    })
  }

  // Urgentes primeiro
  return notifs.sort((a, b) => (b.urgent ? 1 : 0) - (a.urgent ? 1 : 0))
}

// ─── CSV Export ────────────────────────────────────────────────────────────────
function q(v: unknown): string {
  return `"${String(v ?? '').replace(/"/g, '""')}"`
}

function triggerDownload(filename: string, csv: string) {
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function exportCsv(page: PageId, tasks: ComplianceTask[], risks: Risk[], cmvmSupsFull?: { id: string; identificacao: string; assunto: string; departamento: string; estado: string; responsaveis: string; data_comunicacao: string; data_limite: string }[]) {
  if (page === 'cmvm') {
    try {
      const sups = cmvmSupsFull ?? []
      let csv = 'Referência,Assunto,Departamento,Estado,Responsáveis,Data Comunicação,Data Limite\n'
      for (const s of sups) {
        csv += [s.identificacao, s.assunto, s.departamento, s.estado,
          s.responsaveis, s.data_comunicacao, s.data_limite
        ].map(q).join(',') + '\n'
      }
      triggerDownload('cmvm_supervisoes.csv', csv)
    } catch {}

  } else if (page === 'compliance') {
    let csv = 'ID,Tarefa,Área,Responsável,Prioridade,Prazo,Estado,Periodicidade\n'
    for (const t of tasks) {
      csv += [t.id, t.tarefa, t.tematica, t.responsavel, t.prioridade, t.prazo, t.estado, t.periodicidade
      ].map(q).join(',') + '\n'
    }
    triggerDownload('compliance_tarefas.csv', csv)

  } else if (page === 'riscos') {
    let csv = 'ID,Risco,Categoria,Processo,Responsável,Probabilidade,Impacto,Estado,Mitigação\n'
    for (const r of risks) {
      csv += [r.id, r.risco, r.categoria, r.nomeProcesso, r.responsavel,
        r.probabilidade, r.impacto, r.estado, r.mitigacao
      ].map(q).join(',') + '\n'
    }
    triggerDownload('riscos.csv', csv)

  } else if (page === 'oia') {
    try {
      const companies = JSON.parse(localStorage.getItem('oia_companies') || '[]')
      let csv = 'Empresa,Sector,País,Stage,Fundos,Stake (%),Investido (€),NAV (€),MOIC,Estado\n'
      for (const c of companies) {
        csv += [c.name, c.sector, c.country, c.stage,
          (c.funds || []).join('; '), c.stake, c.invested, c.nav, c.moic, c.status
        ].map(q).join(',') + '\n'
      }
      triggerDownload('oia_portfolio.csv', csv)
    } catch {}

  } else if (page === 'scr') {
    try {
      const infos = JSON.parse(localStorage.getItem('scr_fund_info') || '[]')
      let csv = 'Fundo,Data Criação,Duração (anos),Extensão (anos),% Fora Portugal,Política de Investimento\n'
      for (const i of infos) {
        csv += [i.fundId, i.dataCriacao, i.duracaoAnos, i.extensaoAnos,
          i.percForaPortugal, i.politicaInvestimento
        ].map(q).join(',') + '\n'
      }
      triggerDownload('scr_fundos.csv', csv)
    } catch {}

  } else if (page === 'legislacao') {
    try {
      const diplomas = JSON.parse(localStorage.getItem('legislacao_diplomas') || '[]')
      let csv = 'Referência,Título,Tipo,Autoridade,Data Publicação,Estado,Impacto\n'
      for (const d of diplomas) {
        csv += [d.referencia, d.titulo, d.tipo, d.autoridade,
          d.dataPublicacao, d.estado, d.impacto
        ].map(q).join(',') + '\n'
      }
      triggerDownload('legislacao_diplomas.csv', csv)
    } catch {}

  } else if (page === 'pbcft') {
    try {
      const clients = JSON.parse(localStorage.getItem('kyc_clients') || '[]')
      let csv = 'ID,Nome,Tipo,NIF,Risco,Estado,Fundos\n'
      for (const c of clients) {
        csv += [c.id, c.name, c.type, c.nif, c.risk, c.status,
          (c.funds || []).join('; ')
        ].map(q).join(',') + '\n'
      }
      triggerDownload('pbcft_clientes.csv', csv)
    } catch {}

  } else {
    triggerDownload(`${page}_export.csv`, `Página,${page}\nSem dados estruturados disponíveis para exportação.\n`)
  }
}

// ─── Quick new options per page ────────────────────────────────────────────────
const QUICK_NEW: Partial<Record<PageId, { label: string; action: string }[]>> = {
  compliance:   [{ label: 'Nova Tarefa', action: 'new-task' }, { label: 'Novo Incumprimento', action: 'new-incumprimento' }],
  riscos:       [{ label: 'Novo Risco', action: 'new-risk' }],
  oia:          [{ label: 'Nova Empresa', action: 'new-company' }, { label: 'Nova Proposta', action: 'new-pipeline' }],
  cmvm:         [{ label: 'Nova Supervisão', action: 'new-supervisao' }, { label: 'Nova Comunicação', action: 'new-comunicacao' }],
  pbcft:        [{ label: 'Novo Cliente KYC', action: 'new-client' }],
  legislacao:   [{ label: 'Novo Diploma', action: 'new-diploma' }],
  scr:          [{ label: 'Novo Fundo', action: 'new-fund' }],
  rgpd:         [{ label: 'Nova DPIA', action: 'new-dpia' }, { label: 'Nova Atividade', action: 'new-matriz' }],
  ciberseguranca: [{ label: 'Novo Alerta', action: 'new-alert' }],
}

// ─── Topbar ────────────────────────────────────────────────────────────────────
export function Topbar() {
  const { currentPage, setPage, tasks, risks, securityAlerts } = useStore()
  const { title, sub } = PAGE_TITLES[currentPage]

  const [showBell, setShowBell] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [dismissed, setDismissed] = useState<Set<string>>(() => loadDismissed())
  const [cmvmSups, setCmvmSups] = useState<CmvmSup[]>([])

  const bellRef = useRef<HTMLDivElement>(null)
  const newRef  = useRef<HTMLDivElement>(null)

  useEffect(() => {
    supabase.from('cmvm_supervisoes')
      .select('id, identificacao, assunto, data_limite, estado')
      .then(({ data }) => { if (data) setCmvmSups(data as CmvmSup[]) })
  }, [])

  const allNotifs  = useMemo(() => buildNotifications(tasks, securityAlerts, cmvmSups), [tasks, securityAlerts, cmvmSups])
  const activeNotifs = useMemo(() => allNotifs.filter(n => !dismissed.has(n.id)), [allNotifs, dismissed])

  // Close dropdowns on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) setShowBell(false)
      if (newRef.current  && !newRef.current.contains(e.target as Node))  setShowNew(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function dismiss(id: string) {
    const next = new Set(dismissed)
    next.add(id)
    setDismissed(next)
    saveDismissed(next)
  }

  function dismissAll() {
    const next = new Set(dismissed)
    activeNotifs.forEach(n => next.add(n.id))
    setDismissed(next)
    saveDismissed(next)
  }

  function handleNotifClick(n: Notif) {
    setPage(n.page)
    setShowBell(false)
  }

  function handleQuickNew(action: string) {
    setShowNew(false)
    window.dispatchEvent(new CustomEvent('app:quickNew', { detail: { action, page: currentPage } }))
  }

  const quickOpts = QUICK_NEW[currentPage] ?? []

  return (
    <header className="h-[52px] bg-white border-b border-gray-200 flex items-center justify-between px-6 flex-shrink-0">
      <div>
        <div className="text-[15px] font-semibold text-gray-900 leading-none">{title}</div>
        {sub && <div className="text-[11px] text-gray-400 mt-0.5">{sub}</div>}
      </div>

      <div className="flex items-center gap-2">

        {/* ── Bell ── */}
        <div className="relative" ref={bellRef}>
          <button
            onClick={() => { setShowBell(v => !v); setShowNew(false) }}
            title="Notificações"
            className="p-1.5 rounded-md hover:bg-gray-100 text-gray-500 transition-colors relative"
          >
            <Bell size={15} />
            {activeNotifs.length > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] bg-red-500 rounded-full text-white text-[9px] font-semibold flex items-center justify-center px-0.5 leading-none">
                {activeNotifs.length > 9 ? '9+' : activeNotifs.length}
              </span>
            )}
          </button>

          {showBell && (
            <div className="absolute right-0 top-full mt-1 w-80 bg-white border border-gray-200 rounded-xl shadow-xl z-50">
              {/* Header */}
              <div className="px-4 py-2.5 border-b border-gray-100 flex items-center justify-between">
                <span className="text-[12px] font-semibold text-gray-700">
                  Notificações
                  {activeNotifs.length > 0 && (
                    <span className="ml-1.5 bg-red-100 text-red-600 text-[10px] font-semibold px-1.5 py-0.5 rounded-full">
                      {activeNotifs.length}
                    </span>
                  )}
                </span>
                {activeNotifs.length > 0 && (
                  <button onClick={dismissAll}
                    className="text-[10px] text-blue-600 hover:text-blue-800">
                    Marcar todas como lidas
                  </button>
                )}
              </div>

              {/* List */}
              <div className="max-h-[320px] overflow-y-auto divide-y divide-gray-50">
                {activeNotifs.length === 0 ? (
                  <div className="px-4 py-8 text-center text-[12px] text-gray-400">
                    Sem notificações pendentes
                  </div>
                ) : (
                  activeNotifs.map(n => (
                    <div
                      key={n.id}
                      onClick={() => handleNotifClick(n)}
                      className={`px-4 py-3 flex gap-3 hover:bg-gray-50 cursor-pointer ${n.urgent ? 'bg-red-50/50' : ''}`}
                    >
                      {/* Icon */}
                      <div className={`mt-0.5 flex-shrink-0 ${
                        n.urgent ? 'text-red-500'
                          : n.type === 'security' ? 'text-amber-500'
                          : n.type === 'task' ? 'text-blue-500'
                          : 'text-purple-500'
                      }`}>
                        {n.type === 'deadline' ? <Clock size={13} />
                          : n.type === 'security' ? <Shield size={13} />
                          : <CheckSquare size={13} />}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="text-[11px] font-medium text-gray-800 truncate leading-snug">{n.title}</div>
                        <div className={`text-[10px] mt-0.5 ${n.urgent ? 'text-red-600 font-semibold' : 'text-gray-400'}`}>
                          {n.detail}
                        </div>
                      </div>

                      {/* Dismiss */}
                      <button
                        onClick={e => { e.stopPropagation(); dismiss(n.id) }}
                        className="flex-shrink-0 mt-0.5 text-gray-300 hover:text-gray-500 transition-colors"
                      >
                        <X size={11} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Download ── */}
        <button
          onClick={() => exportCsv(currentPage, tasks, risks, cmvmSups as Parameters<typeof exportCsv>[3])}
          title="Exportar dados desta página"
          className="p-1.5 rounded-md hover:bg-gray-100 text-gray-500 transition-colors"
        >
          <Download size={15} />
        </button>

        {/* ── + Novo ── */}
        {quickOpts.length > 0 ? (
          <div className="relative" ref={newRef}>
            <button
              onClick={() => { setShowNew(v => !v); setShowBell(false) }}
              className="btn btn-primary btn-sm flex items-center gap-1"
            >
              <Plus size={12} />
              Novo
            </button>
            {showNew && (
              <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-xl shadow-xl z-50 py-1 overflow-hidden">
                {quickOpts.map(opt => (
                  <button
                    key={opt.action}
                    onClick={() => handleQuickNew(opt.action)}
                    className="w-full text-left px-4 py-2 text-[12px] text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <button className="btn btn-primary btn-sm flex items-center gap-1 opacity-50 cursor-not-allowed" disabled>
            <Plus size={12} />
            Novo
          </button>
        )}
      </div>
    </header>
  )
}
