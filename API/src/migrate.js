const { compPool, avPool } = require('./db')

async function migrate() {
  // ── Tabelas normalizadas Asset Valuation (avPool) ───────────────────────────
  const avMigrations = [
    `CREATE TABLE IF NOT EXISTS av_companies (
      id                   TEXT PRIMARY KEY,
      name                 TEXT NOT NULL DEFAULT '',
      company_type         TEXT,
      sector               TEXT,
      country              TEXT,
      website              TEXT,
      balancete_url        TEXT,
      summary              TEXT,
      total_shares         NUMERIC,
      esop                 NUMERIC,
      other_dilutive       NUMERIC,
      series_b_shares      NUMERIC,
      series_b_price       NUMERIC,
      priority             TEXT,
      score_financial      NUMERIC,
      score_liquidity      NUMERIC,
      score_strategic      NUMERIC,
      fund_shares          JSONB,
      fund_shares_override JSONB,
      created_at           TIMESTAMPTZ DEFAULT NOW(),
      updated_at           TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS av_tranches (
      id                    TEXT PRIMARY KEY,
      company_id            TEXT NOT NULL REFERENCES av_companies(id) ON DELETE CASCADE,
      fund                  TEXT NOT NULL,
      type                  TEXT NOT NULL,
      amount                NUMERIC DEFAULT 0,
      shares                NUMERIC,
      price_per_share       NUMERIC,
      date                  TEXT,
      converted             BOOLEAN DEFAULT FALSE,
      from_conversion       BOOLEAN DEFAULT FALSE,
      total_shares_at_event NUMERIC,
      ownership_override    NUMERIC
    )`,
    `CREATE TABLE IF NOT EXISTS av_sales (
      id         TEXT PRIMARY KEY,
      company_id TEXT NOT NULL REFERENCES av_companies(id) ON DELETE CASCADE,
      fund       TEXT NOT NULL,
      amount     NUMERIC DEFAULT 0,
      shares     NUMERIC,
      date       TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS av_financials (
      id               TEXT PRIMARY KEY,
      company_id       TEXT NOT NULL REFERENCES av_companies(id) ON DELETE CASCADE,
      year             INTEGER NOT NULL,
      revenue          NUMERIC,
      equity           NUMERIC,
      total_assets     NUMERIC,
      total_liabilities NUMERIC,
      net_profit       NUMERIC
    )`,
    `CREATE TABLE IF NOT EXISTS av_cap_table (
      id         TEXT PRIMARY KEY,
      company_id TEXT NOT NULL REFERENCES av_companies(id) ON DELETE CASCADE,
      name       TEXT NOT NULL DEFAULT '',
      type       TEXT NOT NULL DEFAULT 'Other',
      shares     NUMERIC,
      pct        NUMERIC,
      round      TEXT,
      notes      TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS av_runway (
      company_id    TEXT PRIMARY KEY REFERENCES av_companies(id) ON DELETE CASCADE,
      cash_balance  NUMERIC,
      monthly_burn  NUMERIC,
      last_updated  TEXT,
      notes         TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS av_pipeline (
      company_id    TEXT PRIMARY KEY REFERENCES av_companies(id) ON DELETE CASCADE,
      current_stage TEXT,
      dates         JSONB DEFAULT '{}',
      notes         TEXT,
      history       JSONB DEFAULT '[]'
    )`,
    `CREATE TABLE IF NOT EXISTS av_documents (
      id         TEXT PRIMARY KEY,
      company_id TEXT NOT NULL REFERENCES av_companies(id) ON DELETE CASCADE,
      title      TEXT NOT NULL DEFAULT '',
      url        TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS av_log (
      id         TEXT PRIMARY KEY,
      company_id TEXT NOT NULL REFERENCES av_companies(id) ON DELETE CASCADE,
      date       TEXT NOT NULL,
      text       TEXT NOT NULL DEFAULT ''
    )`,
    `CREATE TABLE IF NOT EXISTS av_valuations (
      id                  TEXT PRIMARY KEY,
      company_id          TEXT NOT NULL,
      date                TEXT NOT NULL,
      equity_value        NUMERIC DEFAULT 0,
      method              TEXT,
      wacc                NUMERIC,
      beta                NUMERIC,
      ke                  NUMERIC,
      kd                  NUMERIC,
      notes               TEXT,
      bp_path             TEXT,
      bp_revenue_cagr     NUMERIC,
      bp_ebitda_margin_ty NUMERIC,
      bp_ebit_margin_ty   NUMERIC,
      bp_capex_revenue_ty NUMERIC,
      bp_nwc_revenue_ty   NUMERIC,
      bp_explicit_years   NUMERIC,
      bp_notes            TEXT,
      created_at          TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS av_debt_assessment (
      id              TEXT PRIMARY KEY,
      valuation_id    TEXT NOT NULL REFERENCES av_valuations(id) ON DELETE CASCADE,
      label           TEXT NOT NULL DEFAULT '',
      instrument_type TEXT,
      nominal_value   NUMERIC DEFAULT 0,
      fair_value      NUMERIC DEFAULT 0,
      rate            NUMERIC,
      kd              NUMERIC,
      notes           TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS av_funds (
      fund        TEXT PRIMARY KEY,
      subscrito   NUMERIC DEFAULT 0,
      adjustments JSONB DEFAULT '[]'
    )`,
  ]

  for (const sql of avMigrations) {
    try {
      await avPool.query(sql)
    } catch (e) {
      console.error('[migrate] AV Erro:', e.message, '\nSQL:', sql.slice(0, 80))
    }
  }


  const migrations = [
    // 2FA columns on portal_users
    `ALTER TABLE portal_users ADD COLUMN IF NOT EXISTS totp_secret TEXT`,
    `ALTER TABLE portal_users ADD COLUMN IF NOT EXISTS totp_enabled BOOLEAN NOT NULL DEFAULT FALSE`,

    // Tabela de configurações globais do portal
    `CREATE TABLE IF NOT EXISTS portal_settings (
      key        TEXT PRIMARY KEY,
      value      TEXT NOT NULL DEFAULT '',
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    `INSERT INTO portal_settings (key, value) VALUES ('announcement', '')
     ON CONFLICT (key) DO NOTHING`,

    // comp_clients
    `ALTER TABLE comp_clients ADD COLUMN IF NOT EXISTS motivo TEXT DEFAULT ''`,

    // comp_rgpd_avaliacoes_iniciais — recriar com colunas próprias se ainda for JSONB envelope
    // (só executa o DROP se a coluna 'data' existir e não existir 'processo')
    // Feito via lógica abaixo

    // Tabelas em falta
    `CREATE TABLE IF NOT EXISTS comp_rgpd_plano (
      id          TEXT PRIMARY KEY,
      acao        TEXT DEFAULT '',
      responsavel TEXT DEFAULT '',
      prazo       TEXT DEFAULT '',
      estado      TEXT DEFAULT '',
      notas       TEXT DEFAULT '',
      created_at  TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS comp_rgpd_retencao (
      id             TEXT PRIMARY KEY,
      categoria      TEXT DEFAULT '',
      prazo_retencao TEXT DEFAULT '',
      base_legal     TEXT DEFAULT '',
      responsavel    TEXT DEFAULT '',
      notas          TEXT DEFAULT '',
      created_at     TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS comp_rgpd_incidentes (
      id          TEXT PRIMARY KEY,
      descricao   TEXT DEFAULT '',
      data        TEXT DEFAULT '',
      gravidade   TEXT DEFAULT '',
      estado      TEXT DEFAULT '',
      responsavel TEXT DEFAULT '',
      notas       TEXT DEFAULT '',
      created_at  TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS comp_pbcft_registos (
      id          TEXT PRIMARY KEY,
      tipo        TEXT DEFAULT '',
      descricao   TEXT DEFAULT '',
      data        TEXT DEFAULT '',
      estado      TEXT DEFAULT '',
      responsavel TEXT DEFAULT '',
      notas       TEXT DEFAULT '',
      created_at  TIMESTAMPTZ DEFAULT NOW()
    )`,
  ]

  for (const sql of migrations) {
    try {
      await compPool.query(sql)
    } catch (e) {
      console.error('[migrate] Erro:', e.message, '\nSQL:', sql.slice(0, 80))
    }
  }

  // Tratar tabelas JSONB envelope (comp_rgpd_avaliacoes_iniciais, comp_rgpd_dpias_full)
  // Se só têm coluna 'data' JSONB e estão vazias, recriar com colunas próprias
  for (const [tbl, cols] of [
    ['comp_rgpd_avaliacoes_iniciais', `
      id TEXT PRIMARY KEY,
      processo TEXT DEFAULT '',
      responsavel TEXT DEFAULT '',
      data_avaliacao TEXT DEFAULT '',
      resultado TEXT DEFAULT '',
      notas TEXT DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT NOW()
    `],
    ['comp_rgpd_dpias_full', `
      id TEXT PRIMARY KEY,
      nome TEXT DEFAULT '',
      responsavel TEXT DEFAULT '',
      data_inicio TEXT DEFAULT '',
      estado TEXT DEFAULT '',
      risco_residual TEXT DEFAULT '',
      medidas TEXT DEFAULT '',
      notas TEXT DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT NOW()
    `],
  ]) {
    try {
      const { rows } = await compPool.query(
        `SELECT column_name FROM information_schema.columns
         WHERE table_name=$1 AND column_name='data' AND data_type='jsonb'`, [tbl]
      )
      if (rows.length > 0) {
        const { rows: cnt } = await compPool.query(`SELECT COUNT(*) FROM ${tbl}`)
        if (parseInt(cnt[0].count) === 0) {
          await compPool.query(`DROP TABLE ${tbl}`)
          await compPool.query(`CREATE TABLE ${tbl} (${cols})`)
          console.log(`[migrate] Recriada tabela ${tbl} com colunas próprias`)
        }
      }
    } catch (e) {
      console.error(`[migrate] Erro ao processar ${tbl}:`, e.message)
    }
  }

  // ── Infraestrutura de histórico (triggers automáticos) ────────────────────
  const COMP_HISTORY_TABLES = [
    'comp_tasks', 'comp_risks', 'comp_clients', 'comp_incumprimentos',
    'comp_checklist', 'comp_matriz', 'comp_dpias', 'comp_roadmap',
    'comp_cmvm_supervisoes', 'comp_cmvm_sup_coms', 'comp_cmvm_respostas', 'comp_cmvm_comunicacoes',
    'comp_available_years',
    'comp_leg_diplomas', 'comp_leg_analises', 'comp_leg_consultas',
    'comp_scr_fund_docs', 'comp_scr_fund_info',
    'comp_oia_companies', 'comp_oia_funds', 'comp_oia_comparacoes',
    'comp_oia_pipeline_inv', 'comp_oia_pipeline_deinv',
    'portal_users',
    'comp_rgpd_dpias_full', 'comp_rgpd_avaliacoes_iniciais',
    'comp_rgpd_plano', 'comp_rgpd_retencao', 'comp_rgpd_incidentes',
    'comp_pbcft_registos',
    'comp_reportes', 'comp_reportes_comunicacoes',
    'comp_quadro_reg',
    'comp_ciber_risks', 'comp_ciber_improvements', 'comp_ciber_checklist', 'comp_ciber_changelog',
  ]
  const AV_HISTORY_TABLES = [
    'av_companies', 'av_tranches', 'av_sales', 'av_financials', 'av_cap_table',
    'av_runway', 'av_pipeline', 'av_documents', 'av_log', 'av_valuations',
    'av_debt_assessment', 'av_funds',
  ]

  for (const [pool, tables] of [[compPool, COMP_HISTORY_TABLES], [avPool, AV_HISTORY_TABLES]]) {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS _row_history (
          history_id BIGSERIAL PRIMARY KEY,
          table_name TEXT NOT NULL,
          operation  TEXT NOT NULL,
          changed_at TIMESTAMPTZ DEFAULT NOW(),
          row_id     TEXT NOT NULL,
          row_data   JSONB NOT NULL
        )
      `)
      await pool.query(`
        CREATE OR REPLACE FUNCTION _save_row_history() RETURNS TRIGGER AS $$
        BEGIN
          INSERT INTO _row_history(table_name, operation, row_id, row_data)
          VALUES (TG_TABLE_NAME, TG_OP, OLD.id::TEXT, to_jsonb(OLD));
          RETURN OLD;
        END;
        $$ LANGUAGE plpgsql;
      `)
      for (const table of tables) {
        const trig = `trg_history_${table}`
        try {
          await pool.query(`
            DO $do$
            BEGIN
              IF NOT EXISTS (
                SELECT 1 FROM pg_trigger t
                JOIN pg_class c ON c.oid = t.tgrelid
                WHERE t.tgname = '${trig}' AND c.relname = '${table}'
              ) THEN
                EXECUTE 'CREATE TRIGGER ${trig}
                  BEFORE DELETE OR UPDATE ON ${table}
                  FOR EACH ROW EXECUTE FUNCTION _save_row_history()';
              END IF;
            END $do$;
          `)
        } catch (e) {
          console.error(`[migrate] Trigger ${trig}:`, e.message)
        }
      }
    } catch (e) {
      console.error('[migrate] History infra:', e.message)
    }
  }

  console.log('[migrate] Migrações aplicadas.')
}

module.exports = { migrate }
