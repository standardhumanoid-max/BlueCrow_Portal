-- ─── 001: compliance_tasks ──────────────────────────────────────────────────
create table if not exists compliance_tasks (
  id          text primary key,
  tarefa      text not null,
  area        text,
  responsavel text,
  prazo       text,
  prioridade  text check (prioridade in ('Alta','Média','Baixa')),
  estado      text check (estado in ('Em curso','Por iniciar','Em atraso','Concluído')),
  progresso   integer default 0 check (progresso between 0 and 100),
  created_at  timestamptz default now()
);

-- ─── 002: risks ───────────────────────────────────────────────────────────────
create table if not exists risks (
  id            text primary key,
  risco         text not null,
  categoria     text,
  probabilidade integer check (probabilidade between 1 and 5),
  impacto       integer check (impacto between 1 and 5),
  estado        text check (estado in ('Crítico','Alto','Médio','Baixo')),
  responsavel   text,
  mitigacao     text,
  created_at    timestamptz default now()
);

-- ─── 003: kyc_clients ────────────────────────────────────────────────────────
create table if not exists kyc_clients (
  id          text primary key,
  name        text not null,
  type        text,
  nif         text,
  nat         text,
  dom         text,
  ubo         text,
  inv         text,
  funds       jsonb default '[]',
  risk        text check (risk in ('Baixo','Médio','Alto')),
  status      text check (status in ('Aceite','Em Revisão','Pendente','Recusado')),
  pep         boolean default false,
  entrada     text,
  aceite      text,
  comment     text,
  docs        jsonb default '[]',
  created_at  timestamptz default now()
);

-- ─── 004: rgpd_checklist ─────────────────────────────────────────────────────
create table if not exists rgpd_checklist (
  id          text primary key,
  secao       text,
  item        text not null,
  prioridade  text,
  responsavel text,
  frequencia  text,
  referencia  text,
  evidencias  text,
  done        boolean default false,
  user_id     uuid references auth.users(id),
  created_at  timestamptz default now()
);

-- ─── 005: matriz_tratamento ──────────────────────────────────────────────────
create table if not exists matriz_tratamento (
  id              text primary key,
  nome            text not null,
  dept            text,
  descricao       text,
  base_legal      text,
  prazo           text,
  dados_sensiveis text check (dados_sensiveis in ('Sim','Não')),
  pia             text check (pia in ('Sim','Não')),
  partilha        text,
  risco           text check (risco in ('Baixo','Médio','Alto')),
  created_at      timestamptz default now()
);

-- ─── 006: dpias ───────────────────────────────────────────────────────────────
create table if not exists dpias (
  id              text primary key default gen_random_uuid()::text,
  nome            text not null,
  controller      text,
  importadores    text,
  pais            text,
  dpo             text,
  mecanismo       text,
  risco_residual  text check (risco_residual in ('Baixo','Médio','Alto')),
  cnpd            text check (cnpd in ('Sim','Não')),
  finalidades     text,
  mitigacao       text,
  created_at      timestamptz default now()
);

-- ─── 007: incumprimentos ─────────────────────────────────────────────────────
create table if not exists incumprimentos (
  id          text primary key,
  descricao   text not null,
  area        text,
  data        text,
  gravidade   text check (gravidade in ('Alta','Média','Baixa')),
  estado      text check (estado in ('Em análise','Atribuída','Resolvida','Fechada')),
  created_at  timestamptz default now()
);

-- ─── 008: legislacao ─────────────────────────────────────────────────────────
create table if not exists legislacao (
  id          text primary key default gen_random_uuid()::text,
  nome        text not null,
  tipo        text check (tipo in ('PDF','Word')),
  tamanho     text,
  data_upload text,
  base64      text,  -- store in Supabase Storage instead for large files
  summary     jsonb,
  chats       jsonb default '[]',
  created_at  timestamptz default now()
);

-- ─── Row Level Security ───────────────────────────────────────────────────────
-- Enable RLS on all tables (uncomment when auth is configured)
-- alter table compliance_tasks enable row level security;
-- alter table risks enable row level security;
-- alter table kyc_clients enable row level security;
-- create policy "authenticated users only" on compliance_tasks for all using (auth.role() = 'authenticated');
