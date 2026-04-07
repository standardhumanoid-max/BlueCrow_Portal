import { useState, useEffect } from 'react'
import { sbLoad } from '@/services/supabaseStore'
import {
  ShieldAlert, ShieldCheck, ShieldOff, AlertTriangle, CheckCircle2,
  XCircle, Clock, Info, Lock, Eye, EyeOff, Database,
  FileText, Zap, ArrowRight, GitCommit, Tag,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'

// ─── Types ────────────────────────────────────────────────────────────────────
type Severity   = 'Crítico' | 'Alto' | 'Médio' | 'Baixo'
type RiskStatus = 'Não mitigado' | 'Parcialmente mitigado' | 'Mitigado' | 'Aceite'
type PrioLabel  = 'Imediato' | 'Curto prazo' | 'Médio prazo' | 'Longo prazo'

interface SecurityRisk {
  id:           string
  categoria:    string
  risco:        string
  descricao:    string
  impacto:      string
  gravidade:    Severity
  status:       RiskStatus
  recomendacao: string
  prazo:        PrioLabel
  resolvidoEm?: string   // data de resolução, se Mitigado
}

interface Improvement {
  id?:             string
  titulo:          string
  descricao:       string
  impacto:         Severity
  esforco:         'Baixo' | 'Médio' | 'Alto'
  prazo:           PrioLabel
  categoria:       string
  implementado?:   boolean
  dataImpl?:       string
}

interface CheckItem {
  id?:       string
  categoria: string
  item:      string
  status:    'OK' | 'NOK' | 'Parcial' | 'N/A'
  nota?:     string
}

interface ChangelogEntry {
  id?:       string
  data:      string
  versao:    string
  tipo:      'Segurança' | 'Auditoria' | 'Autorização' | 'Monitorização' | 'Análise'
  titulo:    string
  descricao: string
  riscos:    string[]   // IDs de riscos afetados
}

// ─── Data — Riscos ────────────────────────────────────────────────────────────
const RISKS: SecurityRisk[] = [
  {
    id: 'CS-001', categoria: 'Autenticação',
    risco: 'Palavras-passe em texto simples no código-fonte',
    descricao: 'As credenciais dos utilizadores estão definidas em claro no ficheiro users.ts, incluído no bundle JavaScript distribuído ao browser. Qualquer pessoa com acesso ao código fonte (ou às DevTools) pode extrair todas as passwords.',
    impacto: 'Comprometimento total de todas as contas do portal.',
    gravidade: 'Crítico', status: 'Não mitigado',
    recomendacao: 'Migrar autenticação para Supabase Auth (bcrypt hash + JWT). Eliminar o ficheiro users.ts com credenciais.',
    prazo: 'Imediato',
  },
  {
    id: 'CS-002', categoria: 'Autenticação',
    risco: 'Ausência de autenticação multi-fator (MFA)',
    descricao: 'O portal gere dados financeiros e de conformidade regulatória sensíveis sem qualquer segundo fator de autenticação. Um ataque de phishing ou credential stuffing concede acesso imediato.',
    impacto: 'Acesso não autorizado com roubo de credencial simples.',
    gravidade: 'Alto', status: 'Não mitigado',
    recomendacao: 'Implementar TOTP (Google Authenticator / Authy) via Supabase Auth MFA. Obrigatório para Admin e Gestores.',
    prazo: 'Curto prazo',
  },
  {
    id: 'CS-003', categoria: 'Autenticação',
    risco: 'Ausência de timeout de sessão',
    descricao: 'Implementado em 2026-03-23: useEffect no AuthContext com event listeners (mousemove, keydown, mousedown, touchstart, scroll). Após 30 min de inatividade, o logout é forçado automaticamente com registo no audit trail. A sessão foi migrada de localStorage para sessionStorage — expira ao fechar o browser.',
    impacto: 'Risco residual mínimo: sessão protegida por inatividade e fechamento do browser.',
    gravidade: 'Médio', status: 'Mitigado',
    recomendacao: 'Implementado aviso visual 2 minutos antes do logout automático por inatividade — utilizador pode clicar "Continuar" para repor o timer.',
    prazo: 'Curto prazo',
    resolvidoEm: '2026-03-23',
  },
  {
    id: 'CS-004', categoria: 'Autenticação',
    risco: 'Bloqueio de conta após tentativas de login falhadas',
    descricao: 'O mecanismo de login limitava o número de tentativas falhadas, permitindo ataques de brute-force. Foi implementado bloqueio automático após 5 tentativas falhadas consecutivas, com lockout de 15 minutos e contador decrescente visível. Todas as tentativas falhadas são registadas no audit log.',
    impacto: 'Comprometimento de conta por força bruta — risco residual mínimo.',
    gravidade: 'Alto', status: 'Mitigado',
    recomendacao: 'Considerar CAPTCHA após 3 tentativas falhadas como camada adicional. Alertas automáticos ao admin (pendente CS-012).',
    prazo: 'Curto prazo',
    resolvidoEm: '2026-03-22',
  },
  {
    id: 'CS-005', categoria: 'Autorização',
    risco: 'Controlo de acesso apenas no lado do cliente',
    descricao: 'As verificações de role (admin, gestor, analista) são feitas exclusivamente no React. Um utilizador com conhecimento técnico pode manipular o estado da aplicação via DevTools e aceder a páginas e ações restritas.',
    impacto: 'Escalada de privilégios e acesso a dados não autorizados.',
    gravidade: 'Alto', status: 'Parcialmente mitigado',
    recomendacao: 'Implementar Row Level Security (RLS) no Supabase para que cada query seja autorizada pelo backend com base no JWT do utilizador.',
    prazo: 'Curto prazo',
  },
  {
    id: 'CS-006', categoria: 'Secrets & Configuração',
    risco: 'Chaves API do Supabase expostas no bundle do browser',
    descricao: 'A SUPABASE_URL e SUPABASE_ANON_KEY ficam incluídas no JavaScript compilado entregue ao browser. Embora a anon key seja de acesso público por design, sem RLS ativas qualquer utilizador autenticado pode executar queries diretas às tabelas.',
    impacto: 'Acesso direto à base de dados Supabase sem passar pela aplicação.',
    gravidade: 'Médio', status: 'Parcialmente mitigado',
    recomendacao: 'Ativar RLS em todas as tabelas Supabase. Nunca expor a service_role key no frontend.',
    prazo: 'Imediato',
  },
  {
    id: 'CS-007', categoria: 'Dados sensíveis',
    risco: 'Dados KYC e PBCFT armazenados sem cifragem adicional',
    descricao: 'Informações de identificação de clientes (NIF, nacionalidade, domicílio, UBO) são armazenadas na base de dados sem cifragem ao nível da aplicação. A cifragem em repouso depende exclusivamente do Supabase/PostgreSQL.',
    impacto: 'Exposição de dados pessoais em caso de breach da base de dados.',
    gravidade: 'Alto', status: 'Parcialmente mitigado',
    recomendacao: 'Cifrar campos sensíveis ao nível da aplicação antes de persistir. Avaliar uso de Vault do Supabase.',
    prazo: 'Médio prazo',
  },
  {
    id: 'CS-008', categoria: 'Dados sensíveis',
    risco: 'Documentos codificados em base64 no estado da aplicação',
    descricao: 'Documentos PDF e Word são armazenados como base64 no store Zustand (memória do browser) e potencialmente persistidos localmente. Ficheiros de legislação ficam em memória durante toda a sessão.',
    impacto: 'Exposição de documentos confidenciais em caso de XSS.',
    gravidade: 'Médio', status: 'Parcialmente mitigado',
    recomendacao: 'Armazenar ficheiros no Supabase Storage com signed URLs temporárias. Não guardar base64 no estado global.',
    prazo: 'Médio prazo',
  },
  {
    id: 'CS-009', categoria: 'Comunicação',
    risco: 'Dependência de HTTPS do ambiente de hosting',
    descricao: 'Implementado em 2026-03-23: criado vercel.json com headers de segurança completos — HSTS (max-age=31536000; includeSubDomains), X-Frame-Options DENY, X-Content-Type-Options nosniff, Referrer-Policy strict-origin-when-cross-origin, Permissions-Policy restritiva e Content-Security-Policy. CSP também definida como meta tag no index.html como camada adicional (unsafe-inline necessário por limitação do Vite dev mode).',
    impacto: 'Risco residual baixo: headers aplicados pelo CDN Vercel em produção.',
    gravidade: 'Médio', status: 'Mitigado',
    recomendacao: 'Eliminar unsafe-inline da CSP quando o projeto migrar para Vite com nonce-based CSP. Monitorizar relatórios CSP (report-uri).',
    prazo: 'Curto prazo',
    resolvidoEm: '2026-03-23',
  },
  {
    id: 'CS-010', categoria: 'Injeção & XSS',
    risco: 'Potencial XSS via conteúdo gerado pela IA',
    descricao: 'Auditoria de código realizada em 2026-03-23 confirmou a ausência total de dangerouslySetInnerHTML em todos os componentes, incluindo o Assistente IA. Todas as respostas da API Claude são renderizadas como texto puro. Não foram encontrados usos de eval() ou Function() no código-fonte.',
    impacto: 'Risco residual mínimo: React escapa automaticamente conteúdo de texto.',
    gravidade: 'Médio', status: 'Mitigado',
    recomendacao: 'Manter a regra de não usar dangerouslySetInnerHTML. Rever em cada PR qualquer novo componente que receba conteúdo externo.',
    prazo: 'Médio prazo',
    resolvidoEm: '2026-03-23',
  },
  {
    id: 'CS-011', categoria: 'Dependências',
    risco: 'Vulnerabilidades em dependências npm',
    descricao: 'O projeto utiliza múltiplas dependências de terceiros (React, Supabase, xlsx-js-style, lucide-react, etc.). Qualquer vulnerabilidade não corrigida pode ser explorada.',
    impacto: 'Comprometimento via supply chain attack ou vulnerabilidade conhecida.',
    gravidade: 'Médio', status: 'Parcialmente mitigado',
    recomendacao: 'Executar npm audit regularmente. Integrar Dependabot ou Snyk para alertas automáticos. Manter dependências atualizadas.',
    prazo: 'Curto prazo',
  },
  {
    id: 'CS-012', categoria: 'Auditoria & Monitorização',
    risco: 'Alertas de segurança em tempo real',
    descricao: 'Implementado sistema de detecção de padrões suspeitos directamente no store da aplicação. Dois padrões monitorizados: (1) Brute-force — 3+ tentativas de login falhadas para o mesmo email em 5 minutos gera alerta Alto/Crítico; (2) Eliminação em massa — 5+ registos eliminados em 60 minutos gera alerta Alto. Alertas aparecem como toast flutuante, com badge vermelho na sidebar e painel na página de Auditoria. Cada alerta pode ser dispensado individualmente.',
    impacto: 'Risco residual: alertas dependem de sessão activa — sem notificação externa (email/Slack) se ninguém estiver no portal.',
    gravidade: 'Médio', status: 'Mitigado',
    recomendacao: 'Como melhoria futura, configurar Edge Function no Supabase para envio de alertas por email mesmo sem utilizador activo.',
    prazo: 'Médio prazo',
    resolvidoEm: '2026-03-22',
  },
  {
    id: 'CS-013', categoria: 'Regulatório',
    risco: 'Ausência de política formal de segurança da informação',
    descricao: 'O portal não tem documentado um conjunto de políticas de segurança da informação (ISMS), contrariamente ao exigido pelo DORA e NIS2 para entidades financeiras reguladas.',
    impacto: 'Não conformidade regulatória com DORA, NIS2 e RGPD.',
    gravidade: 'Alto', status: 'Não mitigado',
    recomendacao: 'Elaborar Política de Segurança da Informação, Plano de Resposta a Incidentes e Plano de Continuidade.',
    prazo: 'Curto prazo',
  },
  {
    id: 'CS-014', categoria: 'Regulatório',
    risco: 'Sem processo definido de resposta a incidentes',
    descricao: 'Em caso de breach, não existe um procedimento documentado de contenção, notificação (CNPD, CMVM) e recuperação. O DORA exige planos de gestão de incidentes ICT.',
    impacto: 'Multas regulatórias, dano reputacional e incapacidade de recuperação rápida.',
    gravidade: 'Alto', status: 'Não mitigado',
    recomendacao: 'Definir Incident Response Plan com papéis, timelines de notificação (72h CNPD) e playbooks.',
    prazo: 'Curto prazo',
  },
  {
    id: 'CS-015', categoria: 'Integridade de Dados',
    risco: 'Importação Excel de riscos sem controlo de autorização por role',
    descricao: 'Mitigado em 2026-03-23: (1) botão de importação restringido a roles Admin e Gestor; (2) diálogo de confirmação explícita com aviso da operação destrutiva; (3) download automático de ficheiro JSON com todos os riscos actuais imediatamente antes de cada importação — backup local garantido ao utilizador; (4) snapshot salvo em localStorage com timestamp para recuperação imediata em caso de erro.',
    impacto: 'Risco residual mínimo: backup duplo (ficheiro + localStorage) antes de qualquer substituição.',
    gravidade: 'Alto', status: 'Mitigado',
    recomendacao: 'Como melhoria futura, considerar versionamento de snapshots no Supabase para historial auditável de importações.',
    prazo: 'Médio prazo',
    resolvidoEm: '2026-03-23',
  },
]

// ─── Data — Melhorias ─────────────────────────────────────────────────────────
const IMPROVEMENTS: Improvement[] = [
  {
    titulo: 'Audit Log completo — todas as ações CRUD + sessões',
    descricao: 'Implementado registo automático de todas as operações de criação, actualização e eliminação em todas as entidades do portal (tarefas, riscos, KYC, RGPD, OIA), bem como login, logout e tentativas falhadas. Página dedicada com filtros e exportação Excel, visível apenas para Admin.',
    impacto: 'Alto', esforco: 'Médio', prazo: 'Imediato',
    categoria: 'Monitorização', implementado: true, dataImpl: '2026-03-22',
  },
  {
    titulo: 'Bloqueio após 5 tentativas de login falhadas',
    descricao: 'Implementado bloqueio automático por 15 minutos após 5 tentativas de login falhadas consecutivas para o mesmo email. Contador decrescente visível na UI, campos desativados durante o bloqueio, registo de cada tentativa no audit log com numeração (ex: "3/5").',
    impacto: 'Alto', esforco: 'Baixo', prazo: 'Imediato',
    categoria: 'Autenticação', implementado: true, dataImpl: '2026-03-22',
  },
  {
    titulo: 'Secção de Cibersegurança com análise de riscos',
    descricao: 'Criada página dedicada de Cibersegurança visível apenas a Admin e Gestores de Compliance. Inclui scorecard de maturidade, 14 riscos identificados com estado e recomendações, plano de melhoria priorizado e checklist de 31 controlos.',
    impacto: 'Médio', esforco: 'Baixo', prazo: 'Imediato',
    categoria: 'Análise', implementado: true, dataImpl: '2026-03-22',
  },
  {
    titulo: 'Migração para Supabase Auth',
    descricao: 'Substituir o sistema de autenticação local (users.ts com passwords em texto simples) por Supabase Auth. Os utilizadores passam a ter passwords encriptadas com bcrypt, JWT com expiração, refresh tokens e suporte nativo a MFA.',
    impacto: 'Crítico', esforco: 'Médio', prazo: 'Imediato',
    categoria: 'Autenticação',
  },
  {
    titulo: 'Ativar Row Level Security (RLS) em todas as tabelas',
    descricao: 'Configurar políticas RLS no Supabase para que cada utilizador apenas possa ler e escrever os registos que lhe são permitidos, com base no JWT. Atualmente, qualquer utilizador autenticado pode aceder a qualquer tabela.',
    impacto: 'Alto', esforco: 'Médio', prazo: 'Imediato',
    categoria: 'Autorização',
  },
  {
    titulo: 'Implementar MFA por TOTP',
    descricao: 'Ativar autenticação de dois fatores via TOTP (Google Authenticator / Authy) para todos os utilizadores, especialmente admins e gestores. Supabase Auth tem suporte nativo que pode ser ativado com poucas linhas de código.',
    impacto: 'Alto', esforco: 'Baixo', prazo: 'Curto prazo',
    categoria: 'Autenticação',
  },
  {
    titulo: 'Timeout de sessão por inatividade (30 min)',
    descricao: 'useEffect com event listeners no AuthContext: mousemove, keydown, mousedown, touchstart, scroll. Após 30 min de inatividade força logout automático com registo no audit trail. Sessão migrada de localStorage para sessionStorage.',
    impacto: 'Médio', esforco: 'Baixo', prazo: 'Curto prazo',
    categoria: 'Autenticação', implementado: true, dataImpl: '2026-03-23',
  },
  {
    titulo: 'Content Security Policy (CSP) headers',
    descricao: 'Criado vercel.json com headers: HSTS max-age=31536000, X-Frame-Options DENY, X-Content-Type-Options nosniff, Referrer-Policy, Permissions-Policy e CSP completa. Meta tag CSP adicionada ao index.html como camada adicional.',
    impacto: 'Médio', esforco: 'Baixo', prazo: 'Curto prazo',
    categoria: 'Comunicação', implementado: true, dataImpl: '2026-03-23',
  },
  {
    titulo: 'Auditoria de dependências automatizada',
    descricao: 'Integrar Dependabot (GitHub) ou Snyk para análise automática de vulnerabilidades nas dependências npm. Configurar pipeline CI/CD que falha em caso de vulnerabilidades críticas.',
    impacto: 'Médio', esforco: 'Baixo', prazo: 'Curto prazo',
    categoria: 'Dependências',
  },
  {
    titulo: 'Alertas de segurança em tempo real (in-app)',
    descricao: 'Detecção automática de padrões suspeitos: brute-force (3+ login falhados em 5 min) e eliminação em massa (5+ DELETEs em 60 min). Toast flutuante, badge na sidebar e painel na página Auditoria. Dispensável individualmente.',
    impacto: 'Médio', esforco: 'Médio', prazo: 'Médio prazo',
    categoria: 'Monitorização', implementado: true, dataImpl: '2026-03-22',
  },
  {
    titulo: 'Alertas externos via email / Slack (Edge Function)',
    descricao: 'Configurar uma Supabase Edge Function triggered no INSERT da tabela audit_log. Envia email ou webhook Slack mesmo sem utilizador activo no portal — cobre o cenário de ataque fora do horário de trabalho.',
    impacto: 'Médio', esforco: 'Médio', prazo: 'Médio prazo',
    categoria: 'Monitorização',
  },
  {
    titulo: 'Migrar documentos para Supabase Storage',
    descricao: 'Em vez de armazenar ficheiros como base64 no estado da aplicação, fazer upload para Supabase Storage e usar signed URLs temporárias (expiram em 1h) para acesso. Reduz a superfície de ataque e o consumo de memória.',
    impacto: 'Médio', esforco: 'Alto', prazo: 'Médio prazo',
    categoria: 'Dados',
  },
  {
    titulo: 'Política de Segurança da Informação (ISMS)',
    descricao: 'Elaborar documentação formal de segurança: Política de Segurança da Informação, Plano de Resposta a Incidentes ICT (requisito DORA), Registo de Ativos de Informação e Análise de Risco Anual alinhada com ISO 27001.',
    impacto: 'Alto', esforco: 'Alto', prazo: 'Médio prazo',
    categoria: 'Regulatório',
  },
]

// ─── Data — Checklist ─────────────────────────────────────────────────────────
const CHECKLIST: CheckItem[] = [
  // Autenticação
  { categoria: 'Autenticação', item: 'Passwords armazenadas com hash seguro (bcrypt/argon2)', status: 'NOK', nota: 'Texto simples em users.ts — requer migração para Supabase Auth' },
  { categoria: 'Autenticação', item: 'Autenticação multi-fator disponível', status: 'NOK', nota: 'Previsto após migração para Supabase Auth' },
  { categoria: 'Autenticação', item: 'Timeout de sessão por inatividade', status: 'OK', nota: 'Implementado: 30 min inatividade, logout automático com audit log · 2026-03-23' },
  { categoria: 'Autenticação', item: 'Bloqueio após tentativas de login falhadas', status: 'OK', nota: 'Implementado: bloqueio aos 5 tentativas, lockout 15 min · 2026-03-22' },
  { categoria: 'Autenticação', item: 'Registo de tentativas de login (sucesso e falha)', status: 'OK', nota: 'Audit log com numeração de tentativas (ex: "3/5") · 2026-03-22' },
  { categoria: 'Autenticação', item: 'Sessão termina ao fechar o browser', status: 'OK', nota: 'Migrado de localStorage para sessionStorage · 2026-03-23' },
  // Autorização
  { categoria: 'Autorização', item: 'Controlo de acesso aplicado no backend', status: 'NOK', nota: 'Apenas no frontend (React)' },
  { categoria: 'Autorização', item: 'Row Level Security ativas no Supabase', status: 'NOK', nota: 'A configurar' },
  { categoria: 'Autorização', item: 'Separação de roles com princípio do menor privilégio', status: 'Parcial', nota: 'Definida no frontend, não aplicada no backend' },
  { categoria: 'Autorização', item: 'Service role key nunca exposta no frontend', status: 'OK' },
  // Dados
  { categoria: 'Dados', item: 'Dados em trânsito protegidos por TLS/HTTPS', status: 'OK', nota: 'HSTS max-age=31536000 configurado em vercel.json · 2026-03-23' },
  { categoria: 'Dados', item: 'Dados em repouso cifrados', status: 'Parcial', nota: 'Supabase cifra a disco; sem cifragem adicional na aplicação' },
  { categoria: 'Dados', item: 'Dados pessoais KYC/PBCFT protegidos com acesso restrito', status: 'Parcial', nota: 'Sem RLS ativas' },
  { categoria: 'Dados', item: 'Ficheiros armazenados em storage seguro com URLs temporárias', status: 'NOK', nota: 'Base64 no estado da aplicação' },
  { categoria: 'Dados', item: 'Política de retenção de dados definida', status: 'NOK' },
  // Comunicação
  { categoria: 'Comunicação', item: 'HTTPS forçado (HSTS)', status: 'OK', nota: 'HSTS max-age=31536000 em vercel.json · 2026-03-23' },
  { categoria: 'Comunicação', item: 'Content Security Policy (CSP) configurada', status: 'Parcial', nota: 'CSP em vercel.json + meta tag no index.html. unsafe-inline necessário por Vite · 2026-03-23' },
  { categoria: 'Comunicação', item: 'X-Frame-Options / clickjacking protection', status: 'OK', nota: 'X-Frame-Options: DENY em vercel.json · 2026-03-23' },
  { categoria: 'Comunicação', item: 'API keys de terceiros não expostas no bundle', status: 'Parcial', nota: 'Anon key exposta por design; service key não exposta' },
  // Código
  { categoria: 'Código', item: 'Sem uso de dangerouslySetInnerHTML com input externo', status: 'OK', nota: 'Auditoria de código 2026-03-23 confirmou ausência total — todos os componentes incluindo IA usam texto puro' },
  { categoria: 'Código', item: 'Input validado antes de persistir', status: 'Parcial', nota: 'Validação apenas no frontend' },
  { categoria: 'Código', item: 'Dependências sem vulnerabilidades críticas conhecidas', status: 'Parcial', nota: 'Sem pipeline automático de auditoria' },
  { categoria: 'Código', item: 'Secrets geridos via variáveis de ambiente (.env)', status: 'OK' },
  // Monitorização
  { categoria: 'Monitorização', item: 'Audit log de todas as ações CRUD', status: 'OK', nota: 'Implementado em todas as entidades · 2026-03-22' },
  { categoria: 'Monitorização', item: 'Registo de login/logout/tentativas falhadas', status: 'OK', nota: 'Implementado com numeração de tentativas · 2026-03-22' },
  { categoria: 'Monitorização', item: 'Página de auditoria com filtros e exportação', status: 'OK', nota: 'Visível apenas Admin · 2026-03-22' },
  { categoria: 'Monitorização', item: 'Alertas in-app para brute-force e eliminação em massa', status: 'OK', nota: 'Toast + badge sidebar + painel Auditoria · 2026-03-22' },
  { categoria: 'Monitorização', item: 'Alertas externos via email/Slack (fora de sessão)', status: 'NOK', nota: 'Previsto via Supabase Edge Function' },
  { categoria: 'Monitorização', item: 'Backups regulares da base de dados', status: 'Parcial', nota: 'Depende da configuração Supabase' },
  // Regulatório
  { categoria: 'Regulatório', item: 'Política de Segurança da Informação documentada', status: 'NOK' },
  { categoria: 'Regulatório', item: 'Plano de Resposta a Incidentes ICT (DORA)', status: 'NOK' },
  { categoria: 'Regulatório', item: 'Análise de risco de segurança anual', status: 'NOK' },
  { categoria: 'Regulatório', item: 'Notificação CNPD em 72h documentada em procedimento', status: 'NOK' },
  { categoria: 'Regulatório', item: 'DPO designado / ponto de contacto RGPD', status: 'Parcial' },
  // Integridade de Dados
  { categoria: 'Integridade de Dados', item: 'Operações destrutivas restritas a roles com permissão', status: 'OK', nota: 'Importação Excel restrita a admin/gestor · 2026-03-23' },
  { categoria: 'Integridade de Dados', item: 'Confirmação obrigatória antes de operações destrutivas', status: 'OK', nota: 'Diálogo de confirmação implementado na importação Excel · 2026-03-23' },
  { categoria: 'Integridade de Dados', item: 'Backup automático antes de substituição em massa', status: 'OK', nota: 'Download JSON automático + snapshot localStorage antes de cada importação Excel · 2026-03-23' },
]

// ─── Data — Histórico de Alterações ──────────────────────────────────────────
const CHANGELOG: ChangelogEntry[] = [
  {
    data: '2026-03-23', versao: 'v1.7',
    tipo: 'Segurança',
    titulo: 'Backup antes de importação Excel + Aviso de sessão (CS-015, CS-003)',
    descricao: 'CS-015 totalmente mitigado: download automático de ficheiro JSON com backup dos riscos actuais imediatamente antes de cada importação destrutiva; snapshot adicional guardado em localStorage com timestamp. CS-003 melhorado: aviso visual (banner laranja) aparece 2 minutos antes do logout automático por inatividade — botão "Continuar" repõe o timer sem interromper o trabalho. Checklist atualizada: "Dados em trânsito" → OK (HSTS configurado), "Backup antes de substituição em massa" → OK.',
    riscos: ['CS-015', 'CS-003'],
  },
  {
    data: '2026-03-23', versao: 'v1.6',
    tipo: 'Segurança',
    titulo: 'Timeout de sessão por inatividade + Security Headers (CS-003, CS-009)',
    descricao: 'Implementado timeout de inatividade de 30 minutos no AuthContext: useEffect com event listeners (mousemove, keydown, mousedown, touchstart, scroll); logout automático com registo no audit trail. Sessão migrada de localStorage para sessionStorage — expira ao fechar o browser. Criado vercel.json com headers: HSTS (max-age=31536000; includeSubDomains), X-Frame-Options DENY, X-Content-Type-Options nosniff, Referrer-Policy strict-origin-when-cross-origin, Permissions-Policy restritiva e Content-Security-Policy completa. CSP meta tag adicionada ao index.html como camada adicional. CS-003 e CS-009 atualizados para Mitigado.',
    riscos: ['CS-003', 'CS-009'],
  },
  {
    data: '2026-03-23', versao: 'v1.5',
    tipo: 'Análise',
    titulo: 'Revisão de código — auditoria de segurança completa',
    descricao: 'Auditoria manual e automatizada de todo o código-fonte do portal. Confirmada ausência de dangerouslySetInnerHTML em todos os componentes (incluindo Assistente IA), ausência de eval() e Function() construtores. CS-010 atualizado para Mitigado. Identificado novo risco CS-015 (importação Excel sem controlo de autorização) e parcialmente mitigado na mesma sessão: botão de importação restringido a roles Admin e Gestor; adicionado diálogo de confirmação explícita com indicação da operação destrutiva. Adicionadas 3 novas entradas na checklist de Integridade de Dados.',
    riscos: ['CS-010', 'CS-015'],
  },
  {
    data: '2026-03-22', versao: 'v1.4',
    tipo: 'Monitorização',
    titulo: 'Alertas de segurança em tempo real',
    descricao: 'Implementado sistema de detecção de padrões suspeitos no store Zustand. Regra 1 — Brute-force: 3+ LOGIN_FAILED para o mesmo email em 5 minutos dispara alerta Alto/Crítico. Regra 2 — Eliminação em massa: 5+ DELETE em 60 minutos dispara alerta Alto. Alertas surgem como toast flutuante com auto-dismiss a 10s, badge vermelho no item "Auditoria" da sidebar, e painel de alertas activos no topo da página Auditoria com botão de dismiss individual.',
    riscos: ['CS-012'],
  },
  {
    data: '2026-03-22', versao: 'v1.3',
    tipo: 'Segurança',
    titulo: 'Bloqueio de login após 5 tentativas falhadas',
    descricao: 'Implementado mecanismo de rate limiting no AuthContext: bloqueio automático de 15 minutos após 5 tentativas de login falhadas consecutivas para o mesmo email. Contador decrescente em tempo real na UI. Campos desativados durante o bloqueio. Desbloqueio automático quando o timer expira. Estado de bloqueio persiste em localStorage.',
    riscos: ['CS-004'],
  },
  {
    data: '2026-03-22', versao: 'v1.3',
    tipo: 'Auditoria',
    titulo: 'Registo de Auditoria completo — todas as entidades',
    descricao: 'Implementado audit log persistente no Supabase (tabela audit_log). Todas as operações CRUD nas entidades do portal (Tarefas, Riscos, Clientes KYC, Incumprimentos, RGPD, OIA) são registadas automaticamente com utilizador, data, ação e identificação do registo. Login, logout e tentativas falhadas também registados. Página dedicada com filtros, estatísticas e exportação Excel — acessível apenas a Admin.',
    riscos: ['CS-012'],
  },
  {
    data: '2026-03-22', versao: 'v1.3',
    tipo: 'Autorização',
    titulo: 'Controlo de acesso por role alargado',
    descricao: 'Adicionada lógica de filtragem de itens de menu por array de roles (campo roles?: Role[]). A secção Cibersegurança é visível exclusivamente a Admin e Gestor de Compliance. O Registo de Auditoria é visível exclusivamente a Admin. As páginas verificam o role do utilizador e recusam acesso com mensagem de restrição.',
    riscos: ['CS-005'],
  },
  {
    data: '2026-03-22', versao: 'v1.2',
    tipo: 'Análise',
    titulo: 'Avaliação inicial de cibersegurança do portal',
    descricao: 'Criada secção de Cibersegurança com análise completa: 14 riscos identificados e classificados por gravidade e estado de mitigação, 10 melhorias priorizadas por esforço/impacto, checklist de 33 controlos avaliados. Score de maturidade inicial: 35%. Análise cobre OWASP Top 10, DORA, NIS2 e RGPD.',
    riscos: ['CS-001', 'CS-002', 'CS-003', 'CS-004', 'CS-005', 'CS-006', 'CS-007', 'CS-008', 'CS-009', 'CS-010', 'CS-011', 'CS-012', 'CS-013', 'CS-014'],
  },
]

// ─── Seed arrays com id estável (para sbLoad) ─────────────────────────────────
const SEED_IMP_ID   = IMPROVEMENTS.map((x, i) => ({ id: `IMP-${String(i + 1).padStart(3, '0')}`, ...x }))
const SEED_CHK_ID   = CHECKLIST.map((x, i) => ({ id: `CHK-${String(i + 1).padStart(3, '0')}`, ...x }))
const SEED_CHL_ID   = CHANGELOG.map((x, i) => ({ id: `CHL-${String(i + 1).padStart(3, '0')}`, ...x }))

// ─── Estilo helpers ───────────────────────────────────────────────────────────
const SEV_COLOR: Record<Severity, string> = {
  Crítico: 'bg-red-100 text-red-700 border-red-200',
  Alto:    'bg-orange-100 text-orange-700 border-orange-200',
  Médio:   'bg-amber-100 text-amber-700 border-amber-200',
  Baixo:   'bg-green-100 text-green-700 border-green-200',
}
const STATUS_COLOR: Record<RiskStatus, string> = {
  'Não mitigado':          'bg-red-50 text-red-600',
  'Parcialmente mitigado': 'bg-amber-50 text-amber-700',
  'Mitigado':              'bg-green-50 text-green-700',
  'Aceite':                'bg-gray-100 text-gray-600',
}
const PRAZO_COLOR: Record<PrioLabel, string> = {
  'Imediato':    'bg-red-100 text-red-700',
  'Curto prazo': 'bg-orange-100 text-orange-700',
  'Médio prazo': 'bg-amber-100 text-amber-700',
  'Longo prazo': 'bg-blue-100 text-blue-700',
}
const TIPO_COLOR: Record<ChangelogEntry['tipo'], string> = {
  'Segurança':     'bg-red-100 text-red-700',
  'Auditoria':     'bg-blue-100 text-blue-700',
  'Autorização':   'bg-purple-100 text-purple-700',
  'Monitorização': 'bg-indigo-100 text-indigo-700',
  'Análise':       'bg-gray-100 text-gray-600',
}
const CHECK_ICON: Record<CheckItem['status'], React.ReactNode> = {
  OK:      <CheckCircle2 size={14} className="text-green-500 flex-shrink-0" />,
  NOK:     <XCircle     size={14} className="text-red-500 flex-shrink-0" />,
  Parcial: <Clock       size={14} className="text-amber-500 flex-shrink-0" />,
  'N/A':   <Info        size={14} className="text-gray-400 flex-shrink-0" />,
}

const SEV_FILTERS: Array<Severity | ''> = ['', 'Crítico', 'Alto', 'Médio', 'Baixo']
const STATUS_FILTERS: Array<RiskStatus | ''> = ['', 'Não mitigado', 'Parcialmente mitigado', 'Mitigado']

// ─── ScoreBadge ───────────────────────────────────────────────────────────────
function ScoreBadge({ checklist }: { checklist: CheckItem[] }) {
  const total   = checklist.length
  const ok      = checklist.filter(c => c.status === 'OK').length
  const parcial = checklist.filter(c => c.status === 'Parcial').length
  const nok     = checklist.filter(c => c.status === 'NOK').length
  const score   = Math.round((ok + parcial * 0.5) / total * 100)
  const scoreColor = score >= 70 ? 'text-amber-600' : score >= 50 ? 'text-orange-600' : 'text-red-600'
  const ringColor  = score >= 70 ? 'stroke-amber-400' : score >= 50 ? 'stroke-orange-400' : 'stroke-red-400'
  const circumference = 2 * Math.PI * 36
  const offset = circumference - (score / 100) * circumference

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-5">
      <div className="relative w-20 h-20 flex-shrink-0">
        <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90">
          <circle cx="40" cy="40" r="36" fill="none" stroke="#f3f4f6" strokeWidth="7" />
          <circle cx="40" cy="40" r="36" fill="none" strokeWidth="7"
            strokeDasharray={circumference} strokeDashoffset={offset}
            strokeLinecap="round" className={ringColor} />
        </svg>
        <div className={`absolute inset-0 flex items-center justify-center text-xl font-bold ${scoreColor}`}>
          {score}%
        </div>
      </div>
      <div>
        <div className="text-base font-semibold text-gray-900">Nível de Maturidade de Segurança</div>
        <div className="text-xs text-gray-400 mb-2">Com base em {total} controlos avaliados · última revisão 22 Mar 2026</div>
        <div className="flex gap-3 text-xs">
          <span className="flex items-center gap-1 text-green-600"><CheckCircle2 size={11} /> {ok} OK</span>
          <span className="flex items-center gap-1 text-amber-600"><Clock size={11} /> {parcial} Parcial</span>
          <span className="flex items-center gap-1 text-red-600"><XCircle size={11} /> {nok} NOK</span>
        </div>
      </div>
    </div>
  )
}

// ─── OverviewTab ──────────────────────────────────────────────────────────────
function OverviewTab({ risks, checklist }: { risks: SecurityRisk[]; checklist: CheckItem[] }) {
  const criticos  = risks.filter(r => r.gravidade === 'Crítico').length
  const altos     = risks.filter(r => r.gravidade === 'Alto').length
  const medios    = risks.filter(r => r.gravidade === 'Médio').length
  const mitigados = risks.filter(r => r.status === 'Mitigado').length
  const nMitigado = risks.filter(r => r.status === 'Não mitigado').length

  return (
    <div className="space-y-5">
      <ScoreBadge checklist={checklist} />

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Riscos Críticos',  value: criticos,  color: 'text-red-600',    bg: 'bg-red-50 border-red-200',       icon: <ShieldOff size={16} className="text-red-400" /> },
          { label: 'Riscos Altos',     value: altos,     color: 'text-orange-600', bg: 'bg-orange-50 border-orange-200', icon: <AlertTriangle size={16} className="text-orange-400" /> },
          { label: 'Riscos Médios',    value: medios,    color: 'text-amber-600',  bg: 'bg-amber-50 border-amber-200',   icon: <AlertTriangle size={16} className="text-amber-400" /> },
          { label: 'Sem mitigação',    value: nMitigado, color: 'text-gray-700',   bg: 'bg-gray-50 border-gray-200',     icon: <Clock size={16} className="text-gray-400" /> },
          { label: 'Mitigados',        value: mitigados, color: 'text-green-700',  bg: 'bg-green-50 border-green-200',   icon: <ShieldCheck size={16} className="text-green-400" /> },
        ].map(c => (
          <div key={c.label} className={`rounded-xl border p-4 ${c.bg}`}>
            <div className="mb-2">{c.icon}</div>
            <div className={`text-2xl font-bold ${c.color}`}>{c.value}</div>
            <div className="text-[11px] text-gray-500 mt-0.5">{c.label}</div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Info size={14} className="text-blue-500" />
          <span className="text-sm font-semibold text-gray-900">Contexto da Avaliação</span>
        </div>
        <p className="text-xs text-gray-600 leading-relaxed">
          Esta avaliação cobre a versão atual do portal de Compliance — SPA React 18 + TypeScript com backend Supabase (PostgreSQL). O portal gere dados regulatórios sensíveis no âmbito de uma entidade supervisionada pela CMVM, sujeita aos requisitos do <strong>DORA</strong>, <strong>NIS2</strong> e <strong>RGPD</strong>. A avaliação segue as boas práticas da <strong>OWASP Top 10</strong> e <strong>ISO 27001</strong>.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          {[
            { icon: <Lock size={13} className="text-blue-500" />,      title: 'OWASP Top 10',  desc: 'Autenticação, autorização, injeção, exposição de dados' },
            { icon: <FileText size={13} className="text-indigo-500" />, title: 'DORA / NIS2',   desc: 'Resiliência ICT, gestão de incidentes, continuidade' },
            { icon: <Database size={13} className="text-emerald-500" />,title: 'RGPD',          desc: 'Proteção de dados pessoais, notificação de breach' },
          ].map(f => (
            <div key={f.title} className="bg-gray-50 rounded-lg px-3 py-2.5 flex items-start gap-2">
              <span className="flex-shrink-0 mt-0.5">{f.icon}</span>
              <div>
                <div className="text-[11px] font-semibold text-gray-800">{f.title}</div>
                <div className="text-[10px] text-gray-500 leading-relaxed">{f.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center gap-2 mb-3">
          <Zap size={14} className="text-red-500" />
          <span className="text-sm font-semibold text-gray-900">Ações Prioritárias em Aberto</span>
        </div>
        <div className="space-y-2">
          {risks.filter(r => r.prazo === 'Imediato' && r.status !== 'Mitigado').map(r => (
            <div key={r.id} className="flex items-start gap-3 bg-red-50 border border-red-100 rounded-lg px-3 py-2.5">
              <span className="text-[10px] font-mono text-red-400 flex-shrink-0 mt-0.5">{r.id}</span>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-red-800">{r.risco}</div>
                <div className="text-[10px] text-red-600 mt-0.5">{r.recomendacao}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── RisksTab ─────────────────────────────────────────────────────────────────
function RisksTab({ risks }: { risks: SecurityRisk[] }) {
  const [expanded, setExpanded]       = useState<string | null>(null)
  const [filterSev, setFilterSev]     = useState<Severity | ''>('')
  const [filterStatus, setFilterStatus] = useState<RiskStatus | ''>('')

  const filtered = risks.filter(r => {
    if (filterSev && r.gravidade !== filterSev) return false
    if (filterStatus && r.status !== filterStatus) return false
    return true
  })

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {SEV_FILTERS.map(s => (
          <button key={s || 'all-sev'} onClick={() => setFilterSev(s)}
            className={`text-xs px-3 py-1 rounded-full border transition-colors ${filterSev === s ? 'bg-gray-800 text-white border-gray-800' : 'border-gray-200 text-gray-600 hover:border-gray-400'}`}>
            {s || 'Todas as gravidades'}
          </button>
        ))}
        <span className="mx-1 text-gray-200">|</span>
        {STATUS_FILTERS.map(s => (
          <button key={s || 'all-status'} onClick={() => setFilterStatus(s)}
            className={`text-xs px-3 py-1 rounded-full border transition-colors ${filterStatus === s ? 'bg-gray-800 text-white border-gray-800' : 'border-gray-200 text-gray-600 hover:border-gray-400'}`}>
            {s || 'Todos os estados'}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {filtered.map(r => (
          <div key={r.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <button onClick={() => setExpanded(expanded === r.id ? null : r.id)}
              className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors">
              <span className="text-[10px] font-mono text-gray-400 w-14 flex-shrink-0">{r.id}</span>
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border flex-shrink-0 ${SEV_COLOR[r.gravidade]}`}>{r.gravidade}</span>
              <span className="flex-1 text-sm font-medium text-gray-800">{r.risco}</span>
              {r.resolvidoEm && (
                <span className="text-[10px] text-green-600 flex items-center gap-1 flex-shrink-0">
                  <CheckCircle2 size={10} /> {r.resolvidoEm}
                </span>
              )}
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${STATUS_COLOR[r.status]}`}>{r.status}</span>
              <ArrowRight size={12} className={`text-gray-400 flex-shrink-0 transition-transform ${expanded === r.id ? 'rotate-90' : ''}`} />
            </button>

            {expanded === r.id && (
              <div className="border-t border-gray-100 px-4 py-4 space-y-3 bg-gray-50/50">
                <div>
                  <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Categoria</div>
                  <div className="text-xs text-gray-700">{r.categoria}</div>
                </div>
                <div>
                  <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Descrição</div>
                  <div className="text-xs text-gray-700 leading-relaxed">{r.descricao}</div>
                </div>
                <div>
                  <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Impacto potencial</div>
                  <div className="text-xs text-red-700 bg-red-50 rounded-lg px-3 py-2 leading-relaxed">{r.impacto}</div>
                </div>
                <div>
                  <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Recomendação</div>
                  <div className="text-xs text-blue-800 bg-blue-50 rounded-lg px-3 py-2 leading-relaxed flex items-start gap-2">
                    <ShieldCheck size={12} className="flex-shrink-0 mt-0.5 text-blue-500" />
                    {r.recomendacao}
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── ImprovementsTab ──────────────────────────────────────────────────────────
function ImprovementsTab({ improvements }: { improvements: Improvement[] }) {
  const implemented = improvements.filter(i => i.implementado)
  const pending     = improvements.filter(i => !i.implementado)
  const order: PrioLabel[] = ['Imediato', 'Curto prazo', 'Médio prazo', 'Longo prazo']
  const grouped = order.map(prazo => ({
    prazo,
    items: pending.filter(i => i.prazo === prazo),
  })).filter(g => g.items.length > 0)

  return (
    <div className="space-y-6">
      {/* Implementado */}
      {implemented.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-green-100 text-green-700 flex items-center gap-1">
              <CheckCircle2 size={11} /> Implementado
            </span>
            <div className="flex-1 h-px bg-gray-100" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {implemented.map(item => (
              <div key={item.titulo} className="bg-green-50 rounded-xl border border-green-200 p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="text-sm font-semibold text-green-900 flex items-center gap-1.5">
                    <CheckCircle2 size={13} className="text-green-500 flex-shrink-0" />
                    {item.titulo}
                  </div>
                  {item.dataImpl && (
                    <span className="text-[10px] text-green-600 flex-shrink-0">{item.dataImpl}</span>
                  )}
                </div>
                <div className="text-xs text-green-800 leading-relaxed">{item.descricao}</div>
                <div className="flex items-center gap-2 pt-1">
                  <span className="text-[10px] text-green-600">{item.categoria}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Por implementar, agrupado por prazo */}
      {grouped.map(({ prazo, items }) => (
        <div key={prazo}>
          <div className="flex items-center gap-2 mb-3">
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${PRAZO_COLOR[prazo]}`}>{prazo}</span>
            <div className="flex-1 h-px bg-gray-100" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {items.map(item => (
              <div key={item.titulo} className="bg-white rounded-xl border border-gray-200 p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="text-sm font-semibold text-gray-900">{item.titulo}</div>
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border flex-shrink-0 ${SEV_COLOR[item.impacto]}`}>
                    Impacto {item.impacto}
                  </span>
                </div>
                <div className="text-xs text-gray-600 leading-relaxed">{item.descricao}</div>
                <div className="flex items-center gap-2 pt-1">
                  <span className="text-[10px] text-gray-400">Esforço:</span>
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${item.esforco === 'Baixo' ? 'bg-green-100 text-green-700' : item.esforco === 'Médio' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                    {item.esforco}
                  </span>
                  <span className="text-[10px] text-gray-300">·</span>
                  <span className="text-[10px] text-gray-400">{item.categoria}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── ChecklistTab ─────────────────────────────────────────────────────────────
function ChecklistTab({ checklist }: { checklist: CheckItem[] }) {
  const categories = [...new Set(checklist.map(c => c.categoria))]
  const ok      = checklist.filter(c => c.status === 'OK').length
  const parcial = checklist.filter(c => c.status === 'Parcial').length
  const nok     = checklist.filter(c => c.status === 'NOK').length

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4 text-xs text-gray-500 bg-white rounded-xl border border-gray-200 px-4 py-3">
        <span className="flex items-center gap-1.5"><CheckCircle2 size={13} className="text-green-500" /> Conforme ({ok})</span>
        <span className="flex items-center gap-1.5"><Clock size={13} className="text-amber-500" /> Parcialmente conforme ({parcial})</span>
        <span className="flex items-center gap-1.5"><XCircle size={13} className="text-red-500" /> Não conforme ({nok})</span>
      </div>

      {categories.map(cat => {
        const items  = checklist.filter(c => c.categoria === cat)
        const catOk  = items.filter(i => i.status === 'OK').length
        return (
          <div key={cat} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 bg-gray-50">
              <span className="text-xs font-semibold text-gray-700">{cat}</span>
              <span className="text-[10px] text-gray-400">{catOk}/{items.length} conformes</span>
            </div>
            <div className="divide-y divide-gray-50">
              {items.map((c, i) => (
                <div key={i} className="flex items-start gap-3 px-4 py-2.5">
                  {CHECK_ICON[c.status]}
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-gray-800">{c.item}</div>
                    {c.nota && <div className="text-[10px] text-gray-400 mt-0.5">{c.nota}</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── ChangelogTab ─────────────────────────────────────────────────────────────
function ChangelogTab({ changelog }: { changelog: ChangelogEntry[] }) {
  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-xs text-blue-700 flex items-start gap-2">
        <Info size={13} className="flex-shrink-0 mt-0.5 text-blue-500" />
        Registo cronológico de todas as alterações de segurança implementadas no portal. Actualizado automaticamente a cada intervenção.
      </div>

      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-[19px] top-0 bottom-0 w-px bg-gray-200" />

        <div className="space-y-4">
          {changelog.map((entry, idx) => (
            <div key={idx} className="flex gap-4">
              {/* Dot */}
              <div className="flex-shrink-0 w-10 flex justify-center pt-3">
                <div className="w-3 h-3 rounded-full bg-white border-2 border-blue-500 z-10" />
              </div>

              {/* Card */}
              <div className="flex-1 bg-white rounded-xl border border-gray-200 p-4 space-y-2 mb-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-mono text-gray-400">{entry.data}</span>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${TIPO_COLOR[entry.tipo]}`}>{entry.tipo}</span>
                  <span className="text-[10px] font-mono text-gray-300 flex items-center gap-1">
                    <Tag size={9} /> {entry.versao}
                  </span>
                  <div className="flex gap-1 ml-auto">
                    {entry.riscos.map(r => (
                      <span key={r} className="text-[10px] font-mono bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
                        {r}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
                  <GitCommit size={13} className="text-gray-400 flex-shrink-0" />
                  {entry.titulo}
                </div>
                <div className="text-xs text-gray-600 leading-relaxed">{entry.descricao}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
const TABS = ['Visão Geral', 'Riscos Identificados', 'Plano de Melhoria', 'Checklist de Controlos', 'Histórico de Alterações'] as const
type Tab = typeof TABS[number]

export function Ciberseguranca() {
  const { user } = useAuth()
  const [tab, setTab] = useState<Tab>('Visão Geral')

  const [risks,        setRisks]        = useState<SecurityRisk[]>(RISKS)
  const [improvements, setImprovements] = useState<Improvement[]>(SEED_IMP_ID)
  const [checklist,    setChecklist]    = useState<CheckItem[]>(SEED_CHK_ID)
  const [changelog,    setChangelog]    = useState<ChangelogEntry[]>(SEED_CHL_ID)

  useEffect(() => {
    Promise.all([
      sbLoad<SecurityRisk>('ciber_risks',        'ciber_risks',        RISKS),
      sbLoad<Improvement & { id: string }>('ciber_improvements', 'ciber_improvements', SEED_IMP_ID),
      sbLoad<CheckItem & { id: string }>('ciber_checklist',    'ciber_checklist',    SEED_CHK_ID),
      sbLoad<ChangelogEntry & { id: string }>('ciber_changelog',    'ciber_changelog',    SEED_CHL_ID),
    ]).then(([r, imp, chk, chl]) => {
      setRisks(r)
      setImprovements(imp)
      setChecklist(chk)
      setChangelog(chl)
    })
  }, [])

  if (!user || (user.role !== 'admin' && user.role !== 'gestor')) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <ShieldAlert size={40} className="text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">Acesso restrito a Administradores e Gestores de Compliance.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-5 max-w-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Cibersegurança</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Avaliação de riscos · Plano de melhoria · Checklist · Histórico
            <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] bg-amber-100 text-amber-700">Classificado — Uso Interno</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Eye size={13} className="text-gray-300" />
          <EyeOff size={13} className="text-gray-300" />
          <span className="text-[10px] text-gray-400">Visível: Admin + Gestor</span>
        </div>
      </div>

      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit flex-wrap">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`text-xs px-3 py-1.5 rounded-md font-medium transition-colors ${tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            {t}
            {t === 'Histórico de Alterações' && (
              <span className="ml-1.5 text-[10px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full">{changelog.length}</span>
            )}
          </button>
        ))}
      </div>

      {tab === 'Visão Geral'              && <OverviewTab risks={risks} checklist={checklist} />}
      {tab === 'Riscos Identificados'     && <RisksTab risks={risks} />}
      {tab === 'Plano de Melhoria'        && <ImprovementsTab improvements={improvements} />}
      {tab === 'Checklist de Controlos'   && <ChecklistTab checklist={checklist} />}
      {tab === 'Histórico de Alterações'  && <ChangelogTab changelog={changelog} />}
    </div>
  )
}
