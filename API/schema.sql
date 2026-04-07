-- ═══════════════════════════════════════════════════════════════════════════════
-- BlueCrow Portal — Schema completo
-- Executa no pgAdmin4: Tools → Query Tool → cole e prima F5
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── Extensões ──────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ══════════════════════════════════════════════════════════════════════════════
-- ASSET VALUATION
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS funds (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  vintage      INTEGER,
  commitment   NUMERIC(18,2) DEFAULT 0,
  called       NUMERIC(18,2) DEFAULT 0,
  distributed  NUMERIC(18,2) DEFAULT 0,
  nav_override NUMERIC(18,2),
  currency     TEXT DEFAULT 'EUR',
  active       BOOLEAN DEFAULT TRUE,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fund_adjustments (
  id         BIGSERIAL PRIMARY KEY,
  fund_id    TEXT NOT NULL REFERENCES funds(id) ON DELETE CASCADE,
  date       DATE NOT NULL,
  type       TEXT NOT NULL,   -- 'called' | 'distributed' | 'nav_adj'
  amount     NUMERIC(18,2) NOT NULL,
  note       TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS companies (
  id             TEXT PRIMARY KEY,
  name           TEXT NOT NULL,
  sector         TEXT,
  stage          TEXT,
  country        TEXT DEFAULT 'PT',
  website        TEXT,
  description    TEXT,
  founded_year   INTEGER,
  employees      INTEGER,
  currency       TEXT DEFAULT 'EUR',
  status         TEXT DEFAULT 'active',   -- 'active' | 'exited' | 'written-off'
  fund_id        TEXT REFERENCES funds(id),
  pipeline_stage TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tranches (
  id          TEXT PRIMARY KEY,
  company_id  TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  fund_id     TEXT REFERENCES funds(id),
  date        DATE NOT NULL,
  amount      NUMERIC(18,2) NOT NULL,
  instrument  TEXT DEFAULT 'equity',   -- 'equity' | 'convertible' | 'debt'
  shares      NUMERIC(18,6),
  share_price NUMERIC(18,6),
  currency    TEXT DEFAULT 'EUR',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sales (
  id          TEXT PRIMARY KEY,
  company_id  TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  fund_id     TEXT REFERENCES funds(id),
  date        DATE NOT NULL,
  proceeds    NUMERIC(18,2) NOT NULL,
  shares_sold NUMERIC(18,6),
  currency    TEXT DEFAULT 'EUR',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS valuations (
  id          TEXT PRIMARY KEY,
  company_id  TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  fund_id     TEXT REFERENCES funds(id),
  date        DATE NOT NULL,
  method      TEXT NOT NULL,   -- 'cost' | 'market' | 'dcf' | 'ebitda' | ...
  nav         NUMERIC(18,2) NOT NULL,
  currency    TEXT DEFAULT 'EUR',
  notes       TEXT,
  assumptions JSONB,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS valuation_debt_assessment (
  id            BIGSERIAL PRIMARY KEY,
  valuation_id  TEXT NOT NULL REFERENCES valuations(id) ON DELETE CASCADE,
  label         TEXT NOT NULL,
  amount        NUMERIC(18,2) DEFAULT 0,
  currency      TEXT DEFAULT 'EUR',
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cap_table_shareholders (
  id         BIGSERIAL PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  fund_id    TEXT REFERENCES funds(id),
  name       TEXT NOT NULL,
  shares     NUMERIC(18,6) DEFAULT 0,
  pct        NUMERIC(7,4) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS financial_years (
  id         BIGSERIAL PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  year       INTEGER NOT NULL,
  revenue    NUMERIC(18,2),
  ebitda     NUMERIC(18,2),
  ebit       NUMERIC(18,2),
  net_income NUMERIC(18,2),
  total_debt NUMERIC(18,2),
  cash       NUMERIC(18,2),
  currency   TEXT DEFAULT 'EUR',
  is_forecast BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, year)
);

CREATE TABLE IF NOT EXISTS pipeline_history (
  id         TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  date       DATE NOT NULL,
  stage      TEXT NOT NULL,
  note       TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pipeline_stage_dates (
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  stage      TEXT NOT NULL,
  date       DATE,
  PRIMARY KEY (company_id, stage)
);

CREATE TABLE IF NOT EXISTS company_log (
  id         TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_email TEXT,
  action     TEXT NOT NULL,
  detail     TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ══════════════════════════════════════════════════════════════════════════════
-- COMPLIANCE PORTAL
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS portal_users (
  id         TEXT PRIMARY KEY,
  email      TEXT UNIQUE NOT NULL,
  name       TEXT NOT NULL,
  role       TEXT DEFAULT 'viewer',   -- 'admin' | 'compliance' | 'viewer'
  active     BOOLEAN DEFAULT TRUE,
  password_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS compliance_tasks (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  category    TEXT,   -- 'PBCFT' | 'RGPD' | 'CMVM' | 'Interno' | ...
  status      TEXT DEFAULT 'pending',   -- 'pending' | 'in_progress' | 'done' | 'overdue'
  priority    TEXT DEFAULT 'medium',    -- 'low' | 'medium' | 'high' | 'critical'
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
  probability TEXT DEFAULT 'medium',   -- 'low' | 'medium' | 'high'
  impact      TEXT DEFAULT 'medium',   -- 'low' | 'medium' | 'high' | 'critical'
  status      TEXT DEFAULT 'open',     -- 'open' | 'mitigated' | 'accepted' | 'closed'
  owner       TEXT,
  mitigation  TEXT,
  review_date DATE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS kyc_clients (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  type        TEXT DEFAULT 'individual',   -- 'individual' | 'corporate'
  nif         TEXT,
  risk_level  TEXT DEFAULT 'low',   -- 'low' | 'medium' | 'high'
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
  id          BIGSERIAL PRIMARY KEY,
  item        TEXT NOT NULL,
  category    TEXT,
  status      TEXT DEFAULT 'pending',
  notes       TEXT,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
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
  id              BIGSERIAL PRIMARY KEY,
  tratamento      TEXT NOT NULL,
  risco           TEXT,
  probabilidade   TEXT,
  impacto         TEXT,
  medidas         TEXT,
  status          TEXT DEFAULT 'draft',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
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
  id             BIGSERIAL PRIMARY KEY,
  supervisao_id  BIGINT REFERENCES cmvm_supervisoes(id) ON DELETE SET NULL,
  data           DATE,
  tipo           TEXT,
  assunto        TEXT,
  conteudo       TEXT,
  anexos         JSONB,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cmvm_respostas (
  id              BIGSERIAL PRIMARY KEY,
  comunicacao_id  BIGINT REFERENCES cmvm_comunicacoes(id) ON DELETE CASCADE,
  data            DATE,
  conteudo        TEXT,
  status          TEXT DEFAULT 'draft',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS legislacao_diplomas (
  id            BIGSERIAL PRIMARY KEY,
  referencia    TEXT NOT NULL,
  titulo        TEXT NOT NULL,
  tipo          TEXT,
  data_publicacao DATE,
  estado        TEXT DEFAULT 'vigente',
  resumo        TEXT,
  url_oficial   TEXT,
  tags          TEXT[],
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS legislacao_analises_ia (
  id          BIGSERIAL PRIMARY KEY,
  diploma_id  BIGINT REFERENCES legislacao_diplomas(id) ON DELETE CASCADE,
  modelo      TEXT,
  resumo      TEXT,
  impacto     TEXT,
  acoes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS legislacao_consultas_publicas (
  id            BIGSERIAL PRIMARY KEY,
  titulo        TEXT NOT NULL,
  entidade      TEXT,
  data_inicio   DATE,
  data_fim      DATE,
  status        TEXT DEFAULT 'open',
  url           TEXT,
  notas         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── Índices úteis ──────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_companies_fund     ON companies(fund_id);
CREATE INDEX IF NOT EXISTS idx_tranches_company   ON tranches(company_id);
CREATE INDEX IF NOT EXISTS idx_valuations_company ON valuations(company_id);
CREATE INDEX IF NOT EXISTS idx_audit_user         ON audit_logs(user_email);
CREATE INDEX IF NOT EXISTS idx_audit_entity       ON audit_logs(entity, entity_id);

-- ── Dados iniciais dos fundos ──────────────────────────────────────────────────
INSERT INTO funds (id, name, vintage, currency) VALUES
  ('BIF1',    'BIF1',      2018, 'EUR'),
  ('BIF2',    'BIF2',      2019, 'EUR'),
  ('BIF3',    'BIF3',      2020, 'EUR'),
  ('BIF4',    'BIF4',      2021, 'EUR'),
  ('BIF5',    'BIF5',      2022, 'EUR'),
  ('NEXT',    'Next Tech', 2021, 'EUR'),
  ('GLOBAL',  'Global G.', 2020, 'EUR'),
  ('GROWTH',  'Growth',    2023, 'EUR')
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- FIM DO SCHEMA
-- ─────────────────────────────────────────────────────────────────────────────
