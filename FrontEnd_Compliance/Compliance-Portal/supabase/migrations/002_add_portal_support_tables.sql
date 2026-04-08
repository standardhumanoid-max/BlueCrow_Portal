-- ============================================================
-- 002: tabelas adicionais do portal vistas no dashboard Supabase
-- Objetivo:
-- - completar as tabelas já referenciadas pelo frontend
-- - respeitar dois padrões de persistência já usados no projeto:
--   1) tabelas nativas com colunas explícitas
--   2) tabelas genéricas com { id, data, created_at }
-- ============================================================

-- ------------------------------------------------------------
-- Helper: padrão JSONB genérico para módulos com sbLoad/sbSaveAll
-- ------------------------------------------------------------

create table if not exists roadmap_items (
  id         text primary key,
  data       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists compliance_avaliacoes_iniciais (
  id         text primary key,
  data       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists rgpd_dpias_full (
  id         text primary key,
  data       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists leg_diplomas (
  id         text primary key,
  data       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists leg_analises (
  id         text primary key,
  data       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists leg_consultas (
  id         text primary key,
  data       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists oia_companies (
  id         text primary key,
  data       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists oia_comparacoes (
  id         text primary key,
  data       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists oia_pipeline_inv (
  id         text primary key,
  data       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists oia_pipeline_deinv (
  id         text primary key,
  data       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists scr_fund_docs (
  id         text primary key,
  data       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists scr_fund_info (
  id         text primary key,
  data       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Audit log
-- ------------------------------------------------------------

create table if not exists audit_log (
  id           text primary key,
  user_id      text not null,
  user_name    text not null,
  action       text not null,
  entity       text not null,
  entity_id    text,
  entity_label text not null,
  created_at   timestamptz not null default now()
);

create index if not exists idx_audit_log_created_at on audit_log (created_at desc);
create index if not exists idx_audit_log_action on audit_log (action);
create index if not exists idx_audit_log_entity on audit_log (entity);

-- ------------------------------------------------------------
-- CMVM: o frontend grava e lê colunas explícitas
-- ------------------------------------------------------------

create table if not exists cmvm_supervisoes (
  id                 text primary key,
  identificacao      text not null,
  data_comunicacao   text not null,
  assunto            text not null,
  detalhes           text not null default '',
  responsaveis       text not null default '',
  departamento       text not null default '',
  resposta_bc        text not null default '',
  data_resposta_bc   text not null default '',
  data_limite        text not null default '',
  estado             text not null default 'Pendente',
  observacoes        text not null default '',
  created_at         timestamptz not null default now()
);

create table if not exists cmvm_sup_comunicacoes (
  id             text primary key,
  supervisao_id  text not null,
  ref            text not null default '',
  data           text not null default '',
  tipo           text not null default 'Outra',
  assunto        text not null default '',
  responsavel    text not null default '',
  estado         text not null default 'Pendente',
  observacoes    text not null default '',
  created_at     timestamptz not null default now()
);

create index if not exists idx_cmvm_sup_comunicacoes_supervisao_id
  on cmvm_sup_comunicacoes (supervisao_id);

create table if not exists cmvm_respostas (
  id              text primary key,
  supervisao_ids  jsonb not null default '[]'::jsonb,
  data            text not null default '',
  descricao       text not null default '',
  responsavel     text not null default '',
  ficheiros       jsonb not null default '[]'::jsonb,
  created_at      timestamptz not null default now()
);

create table if not exists cmvm_comunicacoes (
  id             text primary key,
  ref            text not null default '',
  data           text not null default '',
  tipo           text not null default 'Outra',
  assunto        text not null default '',
  destinatario   text not null default '',
  responsavel    text not null default '',
  estado         text not null default 'Pendente',
  observacoes    text not null default '',
  created_at     timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Profiles: base mínima para futura migração de auth
-- ------------------------------------------------------------

create table if not exists profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text,
  full_name   text,
  role        text not null default 'viewer',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ------------------------------------------------------------
-- RLS desativado por agora, alinhado com o resto do projeto
-- ------------------------------------------------------------

alter table if exists roadmap_items disable row level security;
alter table if exists compliance_avaliacoes_iniciais disable row level security;
alter table if exists rgpd_dpias_full disable row level security;
alter table if exists leg_diplomas disable row level security;
alter table if exists leg_analises disable row level security;
alter table if exists leg_consultas disable row level security;
alter table if exists oia_companies disable row level security;
alter table if exists oia_comparacoes disable row level security;
alter table if exists oia_pipeline_inv disable row level security;
alter table if exists oia_pipeline_deinv disable row level security;
alter table if exists scr_fund_docs disable row level security;
alter table if exists scr_fund_info disable row level security;
alter table if exists audit_log disable row level security;
alter table if exists cmvm_supervisoes disable row level security;
alter table if exists cmvm_sup_comunicacoes disable row level security;
alter table if exists cmvm_respostas disable row level security;
alter table if exists cmvm_comunicacoes disable row level security;
alter table if exists profiles disable row level security;
