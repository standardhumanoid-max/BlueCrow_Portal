-- ═══════════════════════════════════════════════════════════════════════════════
-- BlueCrow — Base de dados: bluecrow_compliance
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS portal_users (
  id            TEXT PRIMARY KEY,
  email         TEXT UNIQUE NOT NULL,
  name          TEXT NOT NULL,
  role          TEXT DEFAULT 'viewer',
  active        BOOLEAN DEFAULT TRUE,
  password_hash TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS compliance_tasks (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  category    TEXT,
  status      TEXT DEFAULT 'pending',
  priority    TEXT DEFAULT 'medium',
  due_date    DATE,
  owner       TEXT,
  description TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS risks (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  category    TEXT,
  probability TEXT DEFAULT 'medium',
  impact      TEXT DEFAULT 'medium',
  status      TEXT DEFAULT 'open',
  owner       TEXT,
  mitigation  TEXT,
  review_date DATE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS kyc_clients (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  type        TEXT DEFAULT 'individual',
  nif         TEXT,
  risk_level  TEXT DEFAULT 'low',
  status      TEXT DEFAULT 'active',
  review_date DATE,
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_email TEXT,
  action     TEXT NOT NULL,
  entity     TEXT,
  entity_id  TEXT,
  detail     TEXT,
  ip         TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rgpd_checklist (
  id         BIGSERIAL PRIMARY KEY,
  item       TEXT NOT NULL,
  category   TEXT,
  status     TEXT DEFAULT 'pending',
  notes      TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rgpd_matriz_tratamento (
  id               BIGSERIAL PRIMARY KEY,
  atividade        TEXT NOT NULL,
  finalidade       TEXT,
  base_legal       TEXT,
  dados_pessoais   TEXT,
  prazo_retencao   TEXT,
  destinatarios    TEXT,
  pais_destino     TEXT,
  medidas          TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rgpd_dpias (
  id            BIGSERIAL PRIMARY KEY,
  tratamento    TEXT NOT NULL,
  risco         TEXT,
  probabilidade TEXT,
  impacto       TEXT,
  medidas       TEXT,
  status        TEXT DEFAULT 'draft',
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cmvm_supervisoes (
  id          BIGSERIAL PRIMARY KEY,
  referencia  TEXT,
  tipo        TEXT,
  data_inicio DATE,
  data_fim    DATE,
  status      TEXT DEFAULT 'open',
  descricao   TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cmvm_comunicacoes (
  id            BIGSERIAL PRIMARY KEY,
  supervisao_id BIGINT REFERENCES cmvm_supervisoes(id) ON DELETE SET NULL,
  data          DATE,
  tipo          TEXT,
  assunto       TEXT,
  conteudo      TEXT,
  anexos        JSONB,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cmvm_respostas (
  id             BIGSERIAL PRIMARY KEY,
  comunicacao_id BIGINT REFERENCES cmvm_comunicacoes(id) ON DELETE CASCADE,
  data           DATE,
  conteudo       TEXT,
  status         TEXT DEFAULT 'draft',
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS legislacao_diplomas (
  id              BIGSERIAL PRIMARY KEY,
  referencia      TEXT NOT NULL,
  titulo          TEXT NOT NULL,
  tipo            TEXT,
  data_publicacao DATE,
  estado          TEXT DEFAULT 'vigente',
  resumo          TEXT,
  url_oficial     TEXT,
  tags            TEXT[],
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS legislacao_analises_ia (
  id         BIGSERIAL PRIMARY KEY,
  diploma_id BIGINT REFERENCES legislacao_diplomas(id) ON DELETE CASCADE,
  modelo     TEXT,
  resumo     TEXT,
  impacto    TEXT,
  acoes      TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS legislacao_consultas_publicas (
  id          BIGSERIAL PRIMARY KEY,
  titulo      TEXT NOT NULL,
  entidade    TEXT,
  data_inicio DATE,
  data_fim    DATE,
  status      TEXT DEFAULT 'open',
  url         TEXT,
  notas       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_audit_user   ON audit_logs(user_email);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity, entity_id);
