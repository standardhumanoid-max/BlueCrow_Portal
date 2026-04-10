import { create } from 'zustand'

// ─── API helper ───────────────────────────────────────────────────────────────
import { API_BASE, authFetch } from '@/lib/api'
const COMP_API = `${API_BASE}/api/comp`
const fetch = authFetch
const api = {
  async upsert(table: string, id: string, data: Record<string, unknown>) {
    await fetch(`${COMP_API}/${table}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, data }),
    })
  },
  async del(table: string, id: string, label?: string): Promise<Record<string, unknown> | null> {
    const res  = await fetch(`${COMP_API}/${table}/${id}`, { method: 'DELETE' })
    const json = await res.json().catch(() => ({}))
    const deleted: Record<string, unknown> | null = json.deleted ?? null
    if (deleted && label) {
      useUndoStore.getState().showUndo({ table, label, rowData: deleted })
    }
    return deleted
  },
  async bulk(table: string, items: { id: string; [k: string]: unknown }[]) {
    const rows = items.map(({ id, ...rest }) => ({ id, data: rest }))
    await fetch(`${COMP_API}/${table}/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows }),
    })
  },
}

import type { PageId, ComplianceTask, Risk, KYCClient, ChecklistItem, MatrizTratamento, DPIA, LegDocument, Incumprimento, AuditLog, AuditAction, SecurityAlert, RoadmapItem } from '@/types'
import { useUndoStore } from '@/store/useUndoStore'

// ─── Store ────────────────────────────────────────────────────────────────────
interface AppState {
  // Navigation
  currentPage: PageId
  setPage: (page: PageId) => void

  // Loading
  loading: boolean
  loadAll: () => Promise<void>

  // Compliance
  tasks: ComplianceTask[]
  addTask: (t: Omit<ComplianceTask, 'id'>) => Promise<void>
  updateTask: (id: string, t: Partial<ComplianceTask>) => Promise<void>
  deleteTask: (id: string) => Promise<void>
  importTasks: (rows: ComplianceTask[], ano: number) => Promise<void>

  // Risks
  risks: Risk[]
  addRisk: (r: Omit<Risk, 'id'>) => Promise<void>
  updateRisk: (id: string, r: Partial<Risk>) => Promise<void>
  deleteRisk: (id: string) => Promise<void>
  importRisks: (rows: Risk[]) => Promise<void>

  // KYC Clients
  clients: KYCClient[]
  addClient: (c: KYCClient) => Promise<void>
  updateClient: (id: string, c: Partial<KYCClient>) => Promise<void>
  deleteClient: (id: string) => Promise<void>

  // Incumprimentos
  incumprimentos: Incumprimento[]
  addIncumprimento: (i: Omit<Incumprimento, 'id'>) => Promise<void>
  updateIncumprimento: (id: string, i: Partial<Incumprimento>) => Promise<void>
  deleteIncumprimento: (id: string) => Promise<void>

  // RGPD Checklist
  checklist: ChecklistItem[]
  toggleChecklistItem: (id: string) => Promise<void>

  // RGPD Matriz
  matrizTratamento: MatrizTratamento[]
  addMatriz: (m: Omit<MatrizTratamento, 'id'>) => Promise<void>
  deleteMatriz: (id: string) => Promise<void>

  // DPIA
  dpias: DPIA[]
  addDPIA: (d: Omit<DPIA, 'id'>) => Promise<void>
  deleteDPIA: (id: string) => Promise<void>

  // Legislation (local only — documentos carregados pelo utilizador)
  legDocuments: LegDocument[]
  addLegDocument: (d: LegDocument) => void
  updateLegDocument: (id: string, d: Partial<LegDocument>) => void
  removeLegDocument: (id: string) => void

  // Audit Log
  auditLogs: AuditLog[]
  addAuditLog: (entry: { action: AuditAction; entity: string; entity_id?: string; entity_label: string }) => void
  loadAuditLogs: () => Promise<void>

  // Security Alerts
  securityAlerts: SecurityAlert[]
  dismissSecurityAlert: (id: string) => void

  // Roadmap
  roadmapItems: RoadmapItem[]
  addRoadmapItem: (item: Omit<RoadmapItem, 'id' | 'created_at'>) => void
  updateRoadmapItem: (id: string, patch: Partial<RoadmapItem>) => void
  deleteRoadmapItem: (id: string) => void
}

function nanoid() {
  return Math.random().toString(36).slice(2, 10)
}

function nextId(prefix: string, existing: { id: string }[]) {
  return `${prefix}-${String(existing.length + 1).padStart(3, '0')}`
}

// ─── Helper: identifica o utilizador actual a partir do localStorage ──────────
function saveRisksCache(risks: Risk[]) {
  try { localStorage.setItem('compliance_risks', JSON.stringify(risks)) } catch {}
}

const AUDIT_CACHE_KEY = 'compliance_audit_logs'
function saveAuditCache(logs: AuditLog[]) {
  try { localStorage.setItem(AUDIT_CACHE_KEY, JSON.stringify(logs.slice(0, 500))) } catch {}
}
function loadAuditCache(): AuditLog[] {
  try {
    const s = localStorage.getItem(AUDIT_CACHE_KEY)
    if (s) return JSON.parse(s) as AuditLog[]
  } catch {}
  return []
}

function getActor() {
  try {
    const u = JSON.parse(sessionStorage.getItem('compliance_user') || 'null')
    return { user_id: u?.id ?? 'sys', user_name: u?.name ?? 'Sistema' }
  } catch {
    return { user_id: 'sys', user_name: 'Sistema' }
  }
}

// ─── Roadmap — dados iniciais ────────────────────────────────────────────────
const DEFAULT_ROADMAP: Omit<RoadmapItem, never>[] = [
  // ── Concluído ───────────────────────────────────────────────────────────────
  { id:'RM-c01', titulo:'Audit Log completo — todas as entidades', descricao:'Registo automático de todas as operações CRUD, login, logout e tentativas falhadas. Página dedicada com filtros e exportação Excel, visível apenas a Admin.', categoria:'Segurança', prioridade:'Alta', estado:'Concluído', responsavel:'SPM', prazoAlvo:'Q1 2026', created_at:'2026-03-22T00:00:00Z', completedAt:'2026-03-22' },
  { id:'RM-c02', titulo:'Bloqueio de login após 5 tentativas falhadas', descricao:'Mecanismo de rate limiting no AuthContext: lockout 15 min após 5 tentativas. Contador decrescente em tempo real, campos desativados, desbloqueio automático.', categoria:'Segurança', prioridade:'Alta', estado:'Concluído', responsavel:'SPM', prazoAlvo:'Q1 2026', created_at:'2026-03-22T00:00:00Z', completedAt:'2026-03-22' },
  { id:'RM-c03', titulo:'Alertas de segurança in-app (brute-force e mass delete)', descricao:'Detecção de padrões suspeitos no store Zustand. Toast flutuante, badge sidebar e painel na página Auditoria.', categoria:'Segurança', prioridade:'Média', estado:'Concluído', responsavel:'SPM', prazoAlvo:'Q1 2026', created_at:'2026-03-22T00:00:00Z', completedAt:'2026-03-22' },
  { id:'RM-c04', titulo:'Secção Cibersegurança com análise de riscos', descricao:'Página dedicada a admin/gestor com scorecard de maturidade, 15 riscos identificados, plano de melhorias priorizado e checklist de controlos.', categoria:'Segurança', prioridade:'Média', estado:'Concluído', responsavel:'SPM', prazoAlvo:'Q1 2026', created_at:'2026-03-22T00:00:00Z', completedAt:'2026-03-22' },
  { id:'RM-c05', titulo:'Controlo de acesso por role alargado', descricao:'Filtragem de itens de menu por array de roles. Cibersegurança visível apenas a admin/gestor. Páginas verificam role e recusam acesso.', categoria:'Segurança', prioridade:'Alta', estado:'Concluído', responsavel:'SPM', prazoAlvo:'Q1 2026', created_at:'2026-03-22T00:00:00Z', completedAt:'2026-03-22' },
  { id:'RM-c06', titulo:'Importação Excel de riscos (Gestão de Riscos)', descricao:'Botão "Importar .xlsx" com mapeamento automático de colunas, suporte a códigos curtos (B/MB/MA/A), restrição a admin/gestor e confirmação prévia.', categoria:'Módulos', prioridade:'Alta', estado:'Concluído', responsavel:'SPM', prazoAlvo:'Q1 2026', created_at:'2026-03-23T00:00:00Z', completedAt:'2026-03-23' },
  { id:'RM-c07', titulo:'Filtros F1–F4 interativos (Gestão de Riscos)', descricao:'KpiCards clicáveis que filtram a tabela de riscos pelo nível de risco selecionado. Toggle: clique activa, segundo clique limpa.', categoria:'UI/UX', prioridade:'Baixa', estado:'Concluído', responsavel:'SPM', prazoAlvo:'Q1 2026', created_at:'2026-03-23T00:00:00Z', completedAt:'2026-03-23' },
  { id:'RM-c08', titulo:'Auditoria de código e atualização de riscos CS', descricao:'Revisão completa do código-fonte. CS-010 mitigado (sem dangerouslySetInnerHTML). CS-015 identificado e parcialmente mitigado (import Excel restringido a admin/gestor com confirmação).', categoria:'Segurança', prioridade:'Alta', estado:'Concluído', responsavel:'SPM', prazoAlvo:'Q1 2026', created_at:'2026-03-23T00:00:00Z', completedAt:'2026-03-23' },
  // ── Em desenvolvimento ──────────────────────────────────────────────────────
  { id:'RM-d01', titulo:'Roadmap de produto do portal', descricao:'Página de roadmap com kanban por estado, categorias, prioridades e funcionalidade de adicionar/editar itens. Persistência em localStorage.', categoria:'UI/UX', prioridade:'Média', estado:'Concluído', responsavel:'SPM', prazoAlvo:'Q1 2026', created_at:'2026-03-23T00:00:00Z', completedAt:'2026-03-23' },
  // ── Planeado ────────────────────────────────────────────────────────────────
  { id:'RM-p01', titulo:'Timeout de sessão por inatividade (30 min)', descricao:'Hook que deteta inatividade (sem mouse/keyboard events) durante 30 min e força logout. Migrar sessão de localStorage para sessionStorage.', categoria:'Segurança', prioridade:'Média', estado:'Concluído', responsavel:'SPM', prazoAlvo:'Q1 2026', created_at:'2026-03-23T00:00:00Z', completedAt:'2026-03-23' },
  { id:'RM-p02', titulo:'Content Security Policy (CSP) headers', descricao:'Configurar CSP, HSTS, X-Frame-Options e X-Content-Type-Options no servidor/CDN para mitigar XSS, clickjacking e MIME sniffing.', categoria:'Segurança', prioridade:'Média', estado:'Concluído', responsavel:'SPM', prazoAlvo:'Q1 2026', created_at:'2026-03-23T00:00:00Z', completedAt:'2026-03-23' },
  { id:'RM-p03', titulo:'Auditoria de dependências automatizada (Dependabot)', descricao:'Integrar Dependabot ou Snyk para análise automática de vulnerabilidades npm. Pipeline CI/CD que falha em vulnerabilidades críticas.', categoria:'Segurança', prioridade:'Média', estado:'Planeado', prazoAlvo:'Q2 2026', created_at:'2026-03-23T00:00:00Z' },
  { id:'RM-p04', titulo:'Alertas externos via email/Slack (Supabase Edge Function)', descricao:'Edge Function triggered no INSERT da tabela audit_log. Envia email ou webhook Slack fora de sessão — cobre ataques fora do horário laboral.', categoria:'Integração', prioridade:'Média', estado:'Planeado', prazoAlvo:'Q2 2026', created_at:'2026-03-23T00:00:00Z' },
  { id:'RM-p05', titulo:'Módulo Legislação com análise IA', descricao:'Upload de diplomas legais com parsing automático por Claude: resumo, obrigações, prazos e áreas de impacto. Chat com o documento.', categoria:'Módulos', prioridade:'Média', estado:'Planeado', prazoAlvo:'Q2 2026', created_at:'2026-03-23T00:00:00Z' },
  { id:'RM-p06', titulo:'Módulo SCR completo', descricao:'Sistema de Controlo de Risco com formulários, limites regulamentares e reportes SCR à CMVM.', categoria:'Módulos', prioridade:'Média', estado:'Planeado', prazoAlvo:'Q2 2026', created_at:'2026-03-23T00:00:00Z' },
  { id:'RM-p07', titulo:'Módulo CMVM completo', descricao:'Gestão de reportes e comunicações à CMVM, calendário regulatório e arquivo de submissões.', categoria:'Módulos', prioridade:'Média', estado:'Planeado', prazoAlvo:'Q2 2026', created_at:'2026-03-23T00:00:00Z' },
  { id:'RM-p08', titulo:'Módulo Políticas e Procedimentos', descricao:'Inventário documental BCR-COMP com versionamento, aprovações e distribuição controlada.', categoria:'Módulos', prioridade:'Média', estado:'Planeado', prazoAlvo:'Q3 2026', created_at:'2026-03-23T00:00:00Z' },
  { id:'RM-p09', titulo:'Módulo Formação', descricao:'Plano anual de formação, registo de presenças, avaliação de eficácia e certificados.', categoria:'Módulos', prioridade:'Baixa', estado:'Planeado', prazoAlvo:'Q3 2026', created_at:'2026-03-23T00:00:00Z' },
  { id:'RM-p10', titulo:'Módulo Estrutura Organizacional', descricao:'Organograma interativo com responsabilidades, substituições e mapa de key persons.', categoria:'Módulos', prioridade:'Baixa', estado:'Planeado', prazoAlvo:'Q3 2026', created_at:'2026-03-23T00:00:00Z' },
  { id:'RM-p11', titulo:'Backup automático antes de importação Excel de riscos', descricao:'Download automático de ficheiro JSON com todos os riscos actuais imediatamente antes de cada importação destrutiva. Snapshot adicional guardado em localStorage com timestamp. Dupla camada de segurança implementada em GestaoRiscos e useStore.', categoria:'Dados', prioridade:'Média', estado:'Concluído', responsavel:'SPM', prazoAlvo:'Q1 2026', created_at:'2026-03-23T00:00:00Z', completedAt:'2026-03-23' },
  { id:'RM-p12', titulo:'Migrar documentos para Supabase Storage', descricao:'Ficheiros PDF/Word passam de base64 no estado para Supabase Storage com signed URLs temporárias (expiram em 1h). Reduz superfície XSS e consumo de memória.', categoria:'Dados', prioridade:'Média', estado:'Planeado', prazoAlvo:'Q3 2026', created_at:'2026-03-23T00:00:00Z' },
  { id:'RM-m01', titulo:'Migração completa de localStorage para Supabase', descricao:`Todos os módulos do portal guardam dados apenas no PC local (localStorage). Esta tarefa cobre a migração de 12 módulos para a Supabase, tornando os dados acessíveis em qualquer PC com a aplicação instalada.\n\nMódulos a migrar (por prioridade):\n\n1. CMVM — cmvm_supervisoes, cmvm_sup_comunicacoes, cmvm_comunicacoes, cmvm_respostas\n2. Investimentos (OIA) — oia_companies, oia_comparacoes, oia_pipeline_inv, oia_pipeline_deinv\n3. Legislação — leg_diplomas, leg_analises, leg_consultas\n4. Fundos (SCR) — scr_fund_docs, scr_fund_info\n5. RGPD — rgpd_dpias_full, compliance_avaliacoes_iniciais\n6. Quadro Regulatório — reg_diplomas\n7. Compliance — compliance_available_years\n8. Roadmap — compliance_roadmap\n9. Auditoria — compliance_audit_logs (cache → fonte primária)\n\nPara cada módulo: criar tabela Supabase, desativar RLS, substituir leitura/escrita localStorage por chamadas Supabase, manter fallback local em caso de falha de rede.`, categoria:'Dados', prioridade:'Crítica', estado:'Planeado', responsavel:'SPM', prazoAlvo:'Q2 2026', created_at:'2026-03-25T00:00:00Z' },
  // ── Em avaliação ────────────────────────────────────────────────────────────
  { id:'RM-a01', titulo:'Migração para Supabase Auth', descricao:'Substituir users.ts (passwords em texto simples) por Supabase Auth com bcrypt, JWT com expiração e refresh tokens. Pré-requisito para MFA.', categoria:'Segurança', prioridade:'Crítica', estado:'Em avaliação', prazoAlvo:'Q2 2026', created_at:'2026-03-23T00:00:00Z' },
  { id:'RM-a02', titulo:'Ativar Row Level Security (RLS) em todas as tabelas', descricao:'Políticas RLS no Supabase para autorização backend baseada em JWT. Atualmente qualquer utilizador autenticado pode aceder a qualquer tabela.', categoria:'Segurança', prioridade:'Alta', estado:'Em avaliação', prazoAlvo:'Q2 2026', created_at:'2026-03-23T00:00:00Z' },
  { id:'RM-a03', titulo:'MFA por TOTP (Google Authenticator / Authy)', descricao:'Autenticação de dois fatores para todos os utilizadores, obrigatório para admin e gestores. Depende da migração para Supabase Auth.', categoria:'Segurança', prioridade:'Alta', estado:'Em avaliação', prazoAlvo:'Q3 2026', created_at:'2026-03-23T00:00:00Z' },
  { id:'RM-a04', titulo:'Política de Segurança da Informação (ISMS)', descricao:'Documentação formal: Política de Segurança, Plano de Resposta a Incidentes ICT (DORA), Registo de Ativos e Análise de Risco Anual.', categoria:'Regulatório', prioridade:'Alta', estado:'Em avaliação', prazoAlvo:'Q2 2026', created_at:'2026-03-23T00:00:00Z' },
  { id:'RM-a05', titulo:'Plano de Resposta a Incidentes ICT (DORA)', descricao:'Procedimento documentado de contenção, notificação (CNPD em 72h, CMVM) e recuperação. Playbooks por tipo de incidente.', categoria:'Regulatório', prioridade:'Alta', estado:'Em avaliação', prazoAlvo:'Q2 2026', created_at:'2026-03-23T00:00:00Z' },
]

export const useStore = create<AppState>((set, get) => ({
  // ── Navigation ──────────────────────────────────────────────
  currentPage: 'dashboard',
  setPage: (page) => set({ currentPage: page }),

  // ── Loading ──────────────────────────────────────────────────
  loading: false,
  loadAll: async () => {
    set({ loading: true })
    const API = COMP_API
    function unwrap<T>(rows: any[]): T[] {
      if (rows.length === 0) return []
      // JSONB tables return { id, data: {...} }; flat tables return plain rows
      return rows.map(r => ('data' in r && r.data !== null && typeof r.data === 'object')
        ? ({ ...r.data, id: r.id })
        : r
      ) as T[]
    }
    async function fetchTable(table: string) {
      const res = await fetch(`${API}/${table}`)
      if (!res.ok) {
        console.warn(`[loadAll] ${table} → HTTP ${res.status}`)
        return []
      }
      return res.json()
    }
    try {
      const [tasks, risks, clients, incumprimentos, checklist, matrizTratamento, dpias, roadmapRows] =
        await Promise.all([
          fetchTable('comp_tasks'),
          fetchTable('comp_risks'),
          fetchTable('comp_clients'),
          fetchTable('comp_incumprimentos'),
          fetchTable('comp_checklist'),
          fetchTable('comp_matriz'),
          fetchTable('comp_dpias'),
          fetchTable('comp_roadmap'),
        ])

      // Seed roadmap se a tabela estiver vazia
      if (roadmapRows.length === 0) {
        const seedRows = (DEFAULT_ROADMAP as RoadmapItem[]).map(({ id, ...rest }) => ({ id, data: rest }))
        for (const row of seedRows) {
          fetch(`${API}/comp_roadmap`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(row),
          }).catch(() => {})
        }
      }

      set({
        tasks:            unwrap<ComplianceTask>(tasks),
        risks:            (() => {
          const dbRisks = unwrap<Risk>(risks).filter(r => ['F1','F2','F3','F4'].includes(r.estado as string))
          if (dbRisks.length) { saveRisksCache(dbRisks); return dbRisks }
          return get().risks
        })(),
        clients:          unwrap<KYCClient>(clients),
        incumprimentos:   unwrap<Incumprimento>(incumprimentos),
        checklist:        unwrap<ChecklistItem>(checklist),
        matrizTratamento: unwrap<MatrizTratamento>(matrizTratamento),
        dpias:            unwrap<DPIA>(dpias),
        roadmapItems:     roadmapRows.length ? unwrap<RoadmapItem>(roadmapRows) : get().roadmapItems,
      })
    } catch (err) {
      console.error('Erro ao carregar dados:', err)
    } finally {
      set({ loading: false })
    }
  },

  // ── Compliance Tasks ─────────────────────────────────────────
  tasks: [] as ComplianceTask[],
  addTask: async (t) => {
    const id = nextId('PAC', get().tasks)
    const task: ComplianceTask = { ...t, id }
    set((s) => ({ tasks: [...s.tasks, task] }))
    const { id: _id, ...rest } = task
    await api.upsert('comp_tasks', _id, rest)
    get().addAuditLog({ action: 'CREATE', entity: 'Tarefa', entity_id: id, entity_label: `${id} — ${t.tarefa}` })
  },
  updateTask: async (id, t) => {
    const old = get().tasks.find(x => x.id === id)
    const updated = { ...old, ...t } as ComplianceTask
    set((s) => ({ tasks: s.tasks.map((x) => x.id === id ? updated : x) }))
    const { id: _id, ...rest } = updated
    await api.upsert('comp_tasks', _id, rest)
    get().addAuditLog({ action: 'UPDATE', entity: 'Tarefa', entity_id: id, entity_label: `${id} — ${old?.tarefa ?? id}` })
  },
  deleteTask: async (id) => {
    const old = get().tasks.find(x => x.id === id)
    set((s) => ({ tasks: s.tasks.filter((x) => x.id !== id) }))
    await api.del('comp_tasks', id, old?.tarefa ?? id)
    get().addAuditLog({ action: 'DELETE', entity: 'Tarefa', entity_id: id, entity_label: `${id} — ${old?.tarefa ?? id}` })
  },
  importTasks: async (rows, ano) => {
    const others = get().tasks.filter(t => (t.ano ?? 2026) !== ano)
    set({ tasks: [...others, ...rows] })
    try {
      await api.bulk('comp_tasks', [...others, ...rows])
      get().addAuditLog({ action: 'CREATE', entity: 'Tarefa', entity_label: `Importação de ${rows.length} tarefas via Excel para ${ano}` })
    } catch (err) {
      console.error('importTasks:', err)
    }
  },

  // ── Risks ────────────────────────────────────────────────────
  risks: (() => {
    try {
      const stored = localStorage.getItem('compliance_risks')
      if (stored) return JSON.parse(stored) as Risk[]
    } catch {}
    return [] as Risk[]
  })(),
  importRisks: async (rows) => {
    const current = get().risks
    if (current.length > 0) {
      try {
        localStorage.setItem('compliance_risks_backup', JSON.stringify({
          savedAt: new Date().toISOString(), count: current.length, risks: current,
        }))
      } catch { /* quota exceeded */ }
    }
    set({ risks: rows })
    saveRisksCache(rows)
    try {
      await api.bulk('comp_risks', rows)
      get().addAuditLog({ action: 'CREATE', entity: 'Risco', entity_label: `Importação de ${rows.length} riscos via Excel (backup de ${current.length} guardado)` })
    } catch (err) {
      console.error('importRisks:', err)
    }
  },
  addRisk: async (r) => {
    const id = `R-${String(get().risks.length + 1).padStart(2, '0')}`
    const risk: Risk = { ...r, id }
    set((s) => { const updated = [...s.risks, risk]; saveRisksCache(updated); return { risks: updated } })
    const { id: _id, ...rest } = risk
    await api.upsert('comp_risks', _id, rest)
    get().addAuditLog({ action: 'CREATE', entity: 'Risco', entity_id: id, entity_label: `${id} — ${r.risco}` })
  },
  updateRisk: async (id, r) => {
    const old = get().risks.find(x => x.id === id)
    const updated = { ...old, ...r } as Risk
    set((s) => { const u = s.risks.map((x) => x.id === id ? updated : x); saveRisksCache(u); return { risks: u } })
    const { id: _id, ...rest } = updated
    await api.upsert('comp_risks', _id, rest)
    get().addAuditLog({ action: 'UPDATE', entity: 'Risco', entity_id: id, entity_label: `${id} — ${old?.risco ?? id}` })
  },
  deleteRisk: async (id) => {
    const old = get().risks.find(x => x.id === id)
    set((s) => { const u = s.risks.filter((x) => x.id !== id); saveRisksCache(u); return { risks: u } })
    await api.del('comp_risks', id, old?.risco ?? id)
    get().addAuditLog({ action: 'DELETE', entity: 'Risco', entity_id: id, entity_label: `${id} — ${old?.risco ?? id}` })
  },

  // ── KYC Clients ──────────────────────────────────────────────
  clients: [],
  addClient: async (c) => {
    set((s) => ({ clients: [...s.clients, c] }))
    const { id, ...rest } = c
    await api.upsert('comp_clients', id, rest)
    get().addAuditLog({ action: 'CREATE', entity: 'Cliente KYC', entity_id: c.id, entity_label: `${c.id} — ${c.name}` })
  },
  updateClient: async (id, c) => {
    const old = get().clients.find(x => x.id === id)
    const updated = { ...old, ...c } as KYCClient
    set((s) => ({ clients: s.clients.map((x) => x.id === id ? updated : x) }))
    const { id: _id, ...rest } = updated
    await api.upsert('comp_clients', _id, rest)
    get().addAuditLog({ action: 'UPDATE', entity: 'Cliente KYC', entity_id: id, entity_label: `${id} — ${old?.name ?? id}` })
  },
  deleteClient: async (id) => {
    const old = get().clients.find(x => x.id === id)
    set((s) => ({ clients: s.clients.filter((x) => x.id !== id) }))
    await api.del('comp_clients', id, old?.name ?? id)
    get().addAuditLog({ action: 'DELETE', entity: 'Cliente KYC', entity_id: id, entity_label: `${id} — ${old?.name ?? id}` })
  },

  // ── Incumprimentos ───────────────────────────────────────────
  incumprimentos: [],
  addIncumprimento: async (i) => {
    const id = nextId('INC', get().incumprimentos)
    const record: Incumprimento = { ...i, id }
    set((s) => ({ incumprimentos: [...s.incumprimentos, record] }))
    const { id: _id, ...rest } = record
    await api.upsert('comp_incumprimentos', _id, rest)
    get().addAuditLog({ action: 'CREATE', entity: 'Incumprimento', entity_id: id, entity_label: `${id} — ${i.descricao}` })
  },
  updateIncumprimento: async (id, i) => {
    const old = get().incumprimentos.find(x => x.id === id)
    const updated = { ...old, ...i } as Incumprimento
    set((s) => ({ incumprimentos: s.incumprimentos.map((x) => x.id === id ? updated : x) }))
    const { id: _id, ...rest } = updated
    await api.upsert('comp_incumprimentos', _id, rest)
    get().addAuditLog({ action: 'UPDATE', entity: 'Incumprimento', entity_id: id, entity_label: `${id} — ${old?.descricao ?? id}` })
  },
  deleteIncumprimento: async (id) => {
    const old = get().incumprimentos.find(x => x.id === id)
    set((s) => ({ incumprimentos: s.incumprimentos.filter((x) => x.id !== id) }))
    await api.del('comp_incumprimentos', id, old?.descricao ?? id)
    get().addAuditLog({ action: 'DELETE', entity: 'Incumprimento', entity_id: id, entity_label: `${id} — ${old?.descricao ?? id}` })
  },

  // ── RGPD Checklist ───────────────────────────────────────────
  checklist: [],
  toggleChecklistItem: async (id) => {
    const item = get().checklist.find((x) => x.id === id)
    if (!item) return
    const done = !item.done
    const updated = { ...item, done }
    set((s) => ({ checklist: s.checklist.map((x) => x.id === id ? updated : x) }))
    const { id: _id, ...rest } = updated
    await api.upsert('comp_checklist', _id, rest)
    get().addAuditLog({ action: 'UPDATE', entity: 'Checklist RGPD', entity_id: id, entity_label: `${id} — ${item.item} [${done ? 'concluído' : 'por fazer'}]` })
  },

  // ── RGPD Matriz de Tratamento ────────────────────────────────
  matrizTratamento: [],
  addMatriz: async (m) => {
    const id = `T${String(get().matrizTratamento.length + 1).padStart(3, '0')}`
    const record: MatrizTratamento = { ...m, id }
    set((s) => ({ matrizTratamento: [...s.matrizTratamento, record] }))
    const { id: _id, ...rest } = record
    await api.upsert('comp_matriz', _id, rest)
    get().addAuditLog({ action: 'CREATE', entity: 'Matriz Tratamento', entity_id: id, entity_label: `${id} — ${m.nome}` })
  },
  deleteMatriz: async (id) => {
    const old = get().matrizTratamento.find(x => x.id === id)
    set((s) => ({ matrizTratamento: s.matrizTratamento.filter((x) => x.id !== id) }))
    await api.del('comp_matriz', id, old?.nome ?? id)
    get().addAuditLog({ action: 'DELETE', entity: 'Matriz Tratamento', entity_id: id, entity_label: `${id} — ${old?.nome ?? id}` })
  },

  // ── DPIA ─────────────────────────────────────────────────────
  dpias: [],
  addDPIA: async (d) => {
    const id = nanoid()
    const record: DPIA = { ...d, id }
    set((s) => ({ dpias: [...s.dpias, record] }))
    const { id: _id, ...rest } = record
    await api.upsert('comp_dpias', _id, rest)
    get().addAuditLog({ action: 'CREATE', entity: 'DPIA', entity_id: id, entity_label: `${id} — ${d.nome}` })
  },
  deleteDPIA: async (id) => {
    const old = get().dpias.find(x => x.id === id)
    set((s) => ({ dpias: s.dpias.filter((x) => x.id !== id) }))
    await api.del('comp_dpias', id, old?.nome ?? id)
    get().addAuditLog({ action: 'DELETE', entity: 'DPIA', entity_id: id, entity_label: `${id} — ${old?.nome ?? id}` })
  },

  // ── Legislation (local only) ─────────────────────────────────
  legDocuments: [],
  addLegDocument: (d) => set((s) => ({ legDocuments: [...s.legDocuments, d] })),
  updateLegDocument: (id, d) => set((s) => ({ legDocuments: s.legDocuments.map((x) => x.id === id ? { ...x, ...d } : x) })),
  removeLegDocument: (id) => set((s) => ({ legDocuments: s.legDocuments.filter((x) => x.id !== id) })),

  // ── Audit Log ─────────────────────────────────────────────────
  // SQL para criar a tabela no Supabase:
  // create table audit_log (
  //   id text primary key,
  //   user_id text not null,
  //   user_name text not null,
  //   action text not null,
  //   entity text not null,
  //   entity_id text,
  //   entity_label text not null,
  //   created_at timestamptz default now()
  // );
  auditLogs: loadAuditCache(),
  addAuditLog: (entry) => {
    const actor = getActor()
    const now   = new Date().toISOString()
    const nowMs = Date.now()
    const log: AuditLog = {
      id: `AL-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      user_id:      actor.user_id,
      user_name:    actor.user_name,
      action:       entry.action,
      entity:       entry.entity,
      entity_id:    entry.entity_id,
      entity_label: entry.entity_label,
      created_at:   now,
    }
    set((s) => {
      const updated = [log, ...s.auditLogs].slice(0, 1000)
      saveAuditCache(updated)
      return { auditLogs: updated }
    })
    api.upsert('comp_audit', log.id, { ...log }).catch(() => {})

    // ── Detecção de padrões suspeitos ──────────────────────────────────────
    const allLogs  = [log, ...get().auditLogs]
    const newAlerts: SecurityAlert[] = []

    // Regra 1 — Brute-force: 3+ LOGIN_FAILED para o mesmo email em 5 min
    if (log.action === 'LOGIN_FAILED') {
      const email  = log.entity_label.split('—')[1]?.trim() ?? log.entity_label
      const win5m  = nowMs - 5 * 60 * 1000
      const fails  = allLogs.filter(l =>
        l.action === 'LOGIN_FAILED' &&
        l.entity_label.includes(email) &&
        new Date(l.created_at).getTime() > win5m
      )
      if (fails.length >= 3 && fails.length % 3 === 0) {
        const dup = get().securityAlerts.find(
          a => a.type === 'LOGIN_BRUTE_FORCE' && a.message.includes(email) &&
               !a.dismissed && nowMs - new Date(a.created_at).getTime() < 5 * 60 * 1000
        )
        if (!dup) {
          newAlerts.push({
            id:         `SA-${nowMs}-bf`,
            severity:   fails.length >= 5 ? 'Crítico' : 'Alto',
            type:       'LOGIN_BRUTE_FORCE',
            title:      'Múltiplas tentativas de login falhadas',
            message:    `${fails.length} tentativas falhadas para "${email}" nos últimos 5 minutos.`,
            created_at: now,
            dismissed:  false,
          })
        }
      }
    }

    // Regra 2 — Eliminação em massa: 5+ DELETE em 60 min
    if (log.action === 'DELETE') {
      const win1h   = nowMs - 60 * 60 * 1000
      const deletes = allLogs.filter(l =>
        l.action === 'DELETE' &&
        new Date(l.created_at).getTime() > win1h
      )
      if (deletes.length >= 5 && deletes.length % 5 === 0) {
        const dup = get().securityAlerts.find(
          a => a.type === 'MASS_DELETE' && !a.dismissed &&
               nowMs - new Date(a.created_at).getTime() < 60 * 60 * 1000
        )
        if (!dup) {
          newAlerts.push({
            id:         `SA-${nowMs}-del`,
            severity:   'Alto',
            type:       'MASS_DELETE',
            title:      'Volume anormal de eliminações',
            message:    `${deletes.length} registos eliminados na última hora por ${log.user_name}.`,
            created_at: now,
            dismissed:  false,
          })
        }
      }
    }

    if (newAlerts.length > 0) {
      set((s) => ({ securityAlerts: [...newAlerts, ...s.securityAlerts] }))
    }
  },
  loadAuditLogs: async () => {
    try {
      const res = await fetch(`${COMP_API}/comp_audit`)
      if (!res.ok) return
      const logs = await res.json() as AuditLog[]
      logs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      saveAuditCache(logs)
      set({ auditLogs: logs })
    } catch (err) {
      console.error('loadAuditLogs:', err)
    }
  },

  // ── Security Alerts ────────────────────────────────────────────────────────
  securityAlerts: [],
  dismissSecurityAlert: (id) => {
    set((s) => ({
      securityAlerts: s.securityAlerts.map(a => a.id === id ? { ...a, dismissed: true } : a),
    }))
  },

  // ── Roadmap ─────────────────────────────────────────────────────────────────
  roadmapItems: DEFAULT_ROADMAP as RoadmapItem[],
  addRoadmapItem: (item) => {
    const newItem: RoadmapItem = { ...item, id: `RM-${nanoid()}`, created_at: new Date().toISOString() }
    set((s) => ({ roadmapItems: [...s.roadmapItems, newItem] }))
    const { id, ...rest } = newItem
    api.upsert('comp_roadmap', id, rest).catch(() => {})
  },
  updateRoadmapItem: (id, patch) => {
    set((s) => {
      const updated = s.roadmapItems.map(r => r.id === id ? { ...r, ...patch } : r)
      const item = updated.find(r => r.id === id)
      if (item) {
        const { id: itemId, ...rest } = item
        api.upsert('comp_roadmap', itemId, rest).catch(() => {})
      }
      return { roadmapItems: updated }
    })
  },
  deleteRoadmapItem: (id) => {
    const old = get().roadmapItems.find(r => r.id === id)
    set((s) => ({ roadmapItems: s.roadmapItems.filter(r => r.id !== id) }))
    api.del('comp_roadmap', id, old?.title ?? id).catch(() => {})
  },
}))