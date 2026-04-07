// ─── Compliance Tasks ────────────────────────────────────────────────────────
export interface ComplianceTask {
  id: string
  ano?: number              // Ano do plano (2026, 2027, ...)
  tematica: string          // Temática / área temática
  tarefa: string            // Ação
  responsavel: string
  prioridade: 'Q1' | 'Q2' | 'Q3' | 'Q4' | 'Ongoing'
  prazo: string             // Data de referência
  periodicidade: string     // Pontual / Anual / Trimestral / Semestral / Mensal / Semanal / Ongoing
  estado: 'Em andamento' | 'Por iniciar' | 'Concluído' | 'Em atraso'
  descritivo?: string
  observacoes?: string
  // legacy compat
  area?: string
  progresso?: number
  created_at?: string
}

// ─── Risk ────────────────────────────────────────────────────────────────────
export type ImpactoLevel      = 'Baixo' | 'Médio Baixo' | 'Médio Alto' | 'Alto'
export type ProbabilidadeLevel = 'Baixa' | 'Médio Baixa' | 'Média Alta' | 'Alta'
export type RiscoFinal         = 'F1' | 'F2' | 'F3' | 'F4'

export interface Risk {
  id: string
  // Processo
  entidade?: string
  negocioSuporte?: string
  nomeProcesso?: string
  ownerProcesso?: string
  categoria: string
  // Risco
  risco: string
  responsavel: string
  probabilidade: ProbabilidadeLevel
  impacto: ImpactoLevel
  riscoConcatenado?: string   // e.g. "AMA", "MAMB"
  estado: RiscoFinal          // F1 | F2 | F3 | F4
  // Controlo
  objetivos?: string
  mitigacao: string
  responsavelControlo?: string
  frequenciaControlo?: string
  created_at?: string
}

// ─── KYC Client ──────────────────────────────────────────────────────────────
export interface KYCClient {
  id: string
  name: string
  type: 'Pessoa Coletiva' | 'Pessoa Singular' | 'Investidor Institucional'
  nif: string
  nat: string       // nationality
  dom: string       // domicile
  ubo: string       // ultimate beneficial owner
  inv: string       // investment amount
  funds: string[]
  risk: 'Baixo' | 'Médio' | 'Alto'
  status: 'Aceite' | 'Em Revisão' | 'Pendente' | 'Recusado'
  pep: boolean
  entrada: string | null
  aceite: string | null
  comment: string
  docs: KYCDoc[]
  motivo?: string
  created_at?: string
}

export interface KYCDoc {
  n: string   // name
  s: 'ok' | 'missing' | 'expired'
}

// ─── RGPD ────────────────────────────────────────────────────────────────────
export interface ChecklistItem {
  id: string
  secao: string
  item: string
  prioridade: 'Alta' | 'Média' | 'Baixa'
  responsavel: string
  frequencia: string
  referencia: string
  evidencias: string
  done: boolean
}

export interface MatrizTratamento {
  id: string
  nome: string
  dept: string
  descricao: string
  base_legal: string
  prazo: string
  dados_sensiveis: 'Sim' | 'Não'
  pia: 'Sim' | 'Não'
  partilha: string
  risco: 'Baixo' | 'Médio' | 'Alto'
  created_at?: string
}

export interface DPIA {
  id: string
  nome: string
  controller: string
  importadores: string
  pais: string
  dpo: string
  mecanismo: string
  risco_residual: 'Baixo' | 'Médio' | 'Alto'
  cnpd: 'Sim' | 'Não'
  finalidades: string
  mitigacao: string
  created_at?: string
}

// ─── Legislation ─────────────────────────────────────────────────────────────
export interface LegDocument {
  id: string
  name: string
  type: 'PDF' | 'Word'
  size: string
  date: string
  base64: string
  summary: LegSummary | null
  chats: LegChat[]
}

export interface LegSummary {
  titulo: string
  resumo: string
  pontos_chave: string[]
  obrigacoes: LegObrigacao[]
  areas: string[]
  entrada_vigor: string | null
}

export interface LegObrigacao {
  titulo: string
  descricao: string
  prazo: string | null
  gravidade: 'Alta' | 'Média' | 'Baixa'
}

export interface LegChat {
  role: 'user' | 'ai'
  text: string
  ts: string
}

// ─── Incumprimento ───────────────────────────────────────────────────────────
export interface Incumprimento {
  id: string
  descricao: string
  area: string
  data: string
  gravidade: 'Alta' | 'Média' | 'Baixa'
  estado: 'Em análise' | 'Atribuída' | 'Resolvida' | 'Fechada'
  created_at?: string
}

// ─── Audit Log ───────────────────────────────────────────────────────────────
export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGIN_FAILED' | 'LOGOUT' | 'EXPORT'

export interface AuditLog {
  id: string
  user_id: string
  user_name: string
  action: AuditAction
  entity: string       // 'Tarefa' | 'Risco' | 'Cliente KYC' | 'Incumprimento' | 'Checklist RGPD' | 'Matriz Tratamento' | 'DPIA' | 'Sessão'
  entity_id?: string
  entity_label: string // texto legível, ex: "R-01 — Risco de Mercado"
  created_at: string   // ISO
}

// ─── Security Alerts ─────────────────────────────────────────────────────────
export type AlertSeverity = 'Crítico' | 'Alto' | 'Médio'

export interface SecurityAlert {
  id:         string
  severity:   AlertSeverity
  type:       'LOGIN_BRUTE_FORCE' | 'MASS_DELETE' | 'ACCOUNT_LOCKED'
  title:      string
  message:    string
  created_at: string
  dismissed:  boolean
}

// ─── UI Helpers ──────────────────────────────────────────────────────────────
export type BadgeVariant = 'blue' | 'green' | 'amber' | 'red' | 'gray' | 'dark'

export type RoadmapEstado     = 'Em avaliação' | 'Planeado' | 'Em desenvolvimento' | 'Concluído' | 'Descartado'
export type RoadmapPrioridade = 'Crítica' | 'Alta' | 'Média' | 'Baixa'
export type RoadmapCategoria  = 'Segurança' | 'Módulos' | 'Integração' | 'UI/UX' | 'Regulatório' | 'Performance' | 'Dados' | 'Outro'

export interface RoadmapItem {
  id:           string
  titulo:       string
  descricao:    string
  categoria:    RoadmapCategoria
  prioridade:   RoadmapPrioridade
  estado:       RoadmapEstado
  responsavel?: string
  prazoAlvo?:   string   // ex: "Q2 2026"
  notas?:       string
  created_at:   string
  completedAt?: string
}

// ─── UI Helpers ──────────────────────────────────────────────────────────────
export type PageId =
  | 'dashboard'
  | 'compliance'
  | 'controlo'
  | 'riscos'
  | 'pbcft'
  | 'rgpd'
  | 'oia'
  | 'scr'
  | 'cmvm'
  | 'regulatorio'
  | 'legislacao'
  | 'politicas'
  | 'formacao'
  | 'estrutura'
  | 'assistente'
  | 'reportes'
  | 'roadmap'
