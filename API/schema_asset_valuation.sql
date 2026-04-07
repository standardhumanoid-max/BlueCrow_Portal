-- ═══════════════════════════════════════════════════════════════════════════════
-- BlueCrow — Base de dados: bluecrow_asset_valuation
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

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
  type       TEXT NOT NULL,
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
  status         TEXT DEFAULT 'active',
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
  instrument  TEXT DEFAULT 'equity',
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
  method      TEXT NOT NULL,
  nav         NUMERIC(18,2) NOT NULL,
  currency    TEXT DEFAULT 'EUR',
  notes       TEXT,
  assumptions JSONB,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS valuation_debt_assessment (
  id           BIGSERIAL PRIMARY KEY,
  valuation_id TEXT NOT NULL REFERENCES valuations(id) ON DELETE CASCADE,
  label        TEXT NOT NULL,
  amount       NUMERIC(18,2) DEFAULT 0,
  currency     TEXT DEFAULT 'EUR',
  created_at   TIMESTAMPTZ DEFAULT NOW()
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
  id          BIGSERIAL PRIMARY KEY,
  company_id  TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  year        INTEGER NOT NULL,
  revenue     NUMERIC(18,2),
  ebitda      NUMERIC(18,2),
  ebit        NUMERIC(18,2),
  net_income  NUMERIC(18,2),
  total_debt  NUMERIC(18,2),
  cash        NUMERIC(18,2),
  currency    TEXT DEFAULT 'EUR',
  is_forecast BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
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

-- Índices
CREATE INDEX IF NOT EXISTS idx_companies_fund     ON companies(fund_id);
CREATE INDEX IF NOT EXISTS idx_tranches_company   ON tranches(company_id);
CREATE INDEX IF NOT EXISTS idx_valuations_company ON valuations(company_id);

-- Dados iniciais
INSERT INTO funds (id, name, vintage, currency) VALUES
  ('BIF1',   'BIF1',      2018, 'EUR'),
  ('BIF2',   'BIF2',      2019, 'EUR'),
  ('BIF3',   'BIF3',      2020, 'EUR'),
  ('BIF4',   'BIF4',      2021, 'EUR'),
  ('BIF5',   'BIF5',      2022, 'EUR'),
  ('NEXT',   'Next Tech', 2021, 'EUR'),
  ('GLOBAL', 'Global G.', 2020, 'EUR'),
  ('GROWTH', 'Growth',    2023, 'EUR')
ON CONFLICT (id) DO NOTHING;
