const { compPool } = require('./db')

async function migrate() {
  const migrations = [
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

  console.log('[migrate] Migrações aplicadas.')
}

module.exports = { migrate }
