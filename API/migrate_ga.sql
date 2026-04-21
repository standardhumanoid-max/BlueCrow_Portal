-- ══════════════════════════════════════════════════════════════════
-- Gestão de Ativos — clean schema migration
-- Drops old tables, creates ga_assets + related tables
-- matching exact Excel headers
-- ══════════════════════════════════════════════════════════════════

-- Drop old tables
DROP TABLE IF EXISTS asset_files  CASCADE;
DROP TABLE IF EXISTS tenancies     CASCADE;
DROP TABLE IF EXISTS bovs          CASCADE;
DROP TABLE IF EXISTS notes         CASCADE;
DROP TABLE IF EXISTS valuations    CASCADE;
DROP TABLE IF EXISTS assets        CASCADE;

-- Drop new tables if rerunning
DROP TABLE IF EXISTS ga_files      CASCADE;
DROP TABLE IF EXISTS ga_tenancies  CASCADE;
DROP TABLE IF EXISTS ga_bovs       CASCADE;
DROP TABLE IF EXISTS ga_notes      CASCADE;
DROP TABLE IF EXISTS ga_valuations CASCADE;
DROP TABLE IF EXISTS ga_assets     CASCADE;

-- ── Main assets table ─────────────────────────────────────────────
CREATE TABLE ga_assets (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identity (matches Excel headers exactly)
  name              TEXT        NOT NULL,
  spv               TEXT,
  location          TEXT,
  typology          TEXT,
  land_area         NUMERIC(15,2),
  build_area        NUMERIC(15,2),
  tenant            TEXT,
  acquisition_date  DATE,
  maps_link         TEXT,
  general_notes     TEXT,

  -- Acquisition costs
  purchase_price    NUMERIC(15,2) NOT NULL DEFAULT 0,
  stamp_duty        NUMERIC(15,2) NOT NULL DEFAULT 0,
  notary_fees       NUMERIC(15,2) NOT NULL DEFAULT 0,

  -- CAPEX / OPEX
  capex_current     NUMERIC(15,2) NOT NULL DEFAULT 0,
  opex_current      NUMERIC(15,2) NOT NULL DEFAULT 0,

  -- Capital cost  (capital_cost = rate %, capital_cost_v = override value)
  capital_cost      NUMERIC(10,4) NOT NULL DEFAULT 6.5,
  capital_cost_v    NUMERIC(15,2),

  -- Income (annual)
  income_current    NUMERIC(15,2) NOT NULL DEFAULT 0,

  -- Sale / Commercialisation
  bidding_offer     NUMERIC(15,2),
  transaction_fee   NUMERIC(10,4) NOT NULL DEFAULT 5,
  commercialization NUMERIC(10,4) NOT NULL DEFAULT 15,
  asking_price      NUMERIC(15,2),

  -- Status
  status            TEXT NOT NULL DEFAULT 'sem_rendimento'
                    CHECK (status IN ('em_rendimento','sem_rendimento','em_venda','vendido')),

  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ga_assets_spv_idx    ON ga_assets(spv);
CREATE INDEX ga_assets_status_idx ON ga_assets(status);

-- ── Valuations (year → value) ─────────────────────────────────────
CREATE TABLE ga_valuations (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id    UUID        NOT NULL REFERENCES ga_assets(id) ON DELETE CASCADE,
  year        TEXT        NOT NULL,
  value       NUMERIC(15,2),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (asset_id, year)
);

-- ── BOVs ─────────────────────────────────────────────────────────
CREATE TABLE ga_bovs (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id    UUID        NOT NULL REFERENCES ga_assets(id) ON DELETE CASCADE,
  label       TEXT        NOT NULL,
  value       NUMERIC(15,2),
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (asset_id, label)
);

-- ── Notes ────────────────────────────────────────────────────────
CREATE TABLE ga_notes (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id    UUID        NOT NULL REFERENCES ga_assets(id) ON DELETE CASCADE,
  body        TEXT,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (asset_id)
);

-- ── Tenancies ────────────────────────────────────────────────────
CREATE TABLE ga_tenancies (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id        UUID        NOT NULL REFERENCES ga_assets(id) ON DELETE CASCADE,
  tenant_name     TEXT,
  tenant_nif      TEXT,
  lease_status    TEXT        NOT NULL DEFAULT 'ativo'
                  CHECK (lease_status IN ('ativo','negociacao','terminado','vacante')),
  monthly_rent    NUMERIC(15,2),
  contract_start  DATE,
  contract_end    DATE,
  document_link   TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Files ────────────────────────────────────────────────────────
CREATE TABLE ga_files (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id        UUID        NOT NULL REFERENCES ga_assets(id) ON DELETE CASCADE,
  category        TEXT        NOT NULL DEFAULT 'other',
  title           TEXT,
  resource_link   TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Done
SELECT 'Schema ga_assets criado com sucesso.' AS resultado;
