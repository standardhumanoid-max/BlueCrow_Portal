const express = require('express')
const router  = express.Router()
const { compPool } = require('../db')

// Tabelas permitidas (whitelist de segurança)
const ALLOWED = new Set([
  'comp_tasks', 'comp_risks', 'comp_clients', 'comp_incumprimentos',
  'comp_checklist', 'comp_matriz', 'comp_dpias', 'comp_roadmap', 'comp_audit',
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
])

// Cache de deteção JSONB (evita uma query extra por request)
const jsonbCache = new Map()
async function isJsonb(table) {
  if (jsonbCache.has(table)) return jsonbCache.get(table)
  const { rows } = await compPool.query(
    `SELECT 1 FROM information_schema.columns
     WHERE table_schema='public' AND table_name=$1 AND column_name='data' AND data_type='jsonb'`,
    [table]
  )
  const result = rows.length > 0
  jsonbCache.set(table, result)
  return result
}

// GET /api/comp/:table
router.get('/:table', async (req, res) => {
  const table = req.params.table
  if (!ALLOWED.has(table)) return res.status(400).json({ error: 'Tabela inválida' })
  try {
    if (await isJsonb(table)) {
      const { rows } = await compPool.query(`SELECT id, data, created_at FROM ${table} ORDER BY created_at ASC`)
      res.json(rows)
    } else {
      const { rows } = await compPool.query(`SELECT * FROM ${table} ORDER BY created_at ASC`)
      res.json(rows)
    }
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// POST /api/comp/:table  (upsert)
router.post('/:table', async (req, res) => {
  const table = req.params.table
  if (!ALLOWED.has(table)) return res.status(400).json({ error: 'Tabela inválida' })
  const { id, data } = req.body
  if (!id) return res.status(400).json({ error: 'id obrigatório' })
  try {
    if (await isJsonb(table)) {
      const { rows } = await compPool.query(
        `INSERT INTO ${table} (id, data) VALUES ($1, $2)
         ON CONFLICT (id) DO UPDATE SET data=$2 RETURNING *`,
        [id, JSON.stringify(data)]
      )
      res.json(rows[0])
    } else {
      // Tabela flat — expande o objeto 'data' em colunas individuais
      const fields = data && typeof data === 'object' ? data : {}
      const cols   = Object.keys(fields).map(k => k.toLowerCase())
      // Arrays/objects → JSON.stringify so JSONB columns receive valid JSON
      const vals   = Object.values(fields).map(v =>
        (v !== null && typeof v === 'object') ? JSON.stringify(v) : v
      )
      if (cols.length === 0) {
        const { rows } = await compPool.query(
          `INSERT INTO ${table} (id) VALUES ($1) ON CONFLICT (id) DO NOTHING RETURNING *`, [id]
        )
        return res.json(rows[0] || { id })
      }
      const setClauses = cols.map(c => `${c}=EXCLUDED.${c}`).join(',')
      const { rows } = await compPool.query(
        `INSERT INTO ${table} (id, ${cols.join(',')})
         VALUES ($1, ${cols.map((_,i) => `$${i+2}`).join(',')})
         ON CONFLICT (id) DO UPDATE SET ${setClauses}
         RETURNING *`,
        [id, ...vals]
      )
      res.json(rows[0])
    }
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// POST /api/comp/:table/bulk  (substitui toda a tabela)
router.post('/:table/bulk', async (req, res) => {
  const table = req.params.table
  if (!ALLOWED.has(table)) return res.status(400).json({ error: 'Tabela inválida' })
  const { rows: items } = req.body
  if (!Array.isArray(items)) return res.status(400).json({ error: 'rows deve ser array' })
  try {
    await compPool.query(`DELETE FROM ${table}`)
    if (items.length > 0) {
      if (await isJsonb(table)) {
        const values = items.map((_, i) => `($${i * 2 + 1}, $${i * 2 + 2})`).join(',')
        const params = items.flatMap(item => [item.id, JSON.stringify(item.data)])
        await compPool.query(`INSERT INTO ${table} (id, data) VALUES ${values}`, params)
      } else {
        // Tabela flat — cada item tem { id, data: {...} }; expande data em colunas
        for (const item of items) {
          const fields = item.data && typeof item.data === 'object' ? item.data : item
          const { id, data: _d, created_at: _c, ...rest } = fields
          const actualId = item.id
          const cols  = Object.keys(rest).map(k => k.toLowerCase())
          const vals  = Object.values(rest).map(v =>
            (v !== null && typeof v === 'object') ? JSON.stringify(v) : v
          )
          if (cols.length === 0) {
            await compPool.query(
              `INSERT INTO ${table} (id) VALUES ($1) ON CONFLICT (id) DO NOTHING`, [actualId]
            )
          } else {
            const setClauses = cols.map(c => `${c}=EXCLUDED.${c}`).join(',')
            await compPool.query(
              `INSERT INTO ${table} (id, ${cols.join(',')})
               VALUES ($1, ${cols.map((_,i) => `$${i+2}`).join(',')})
               ON CONFLICT (id) DO UPDATE SET ${setClauses}`,
              [actualId, ...vals]
            )
          }
        }
      }
    }
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// DELETE /api/comp/:table/:id
router.delete('/:table/:id', async (req, res) => {
  const table = req.params.table
  if (!ALLOWED.has(table)) return res.status(400).json({ error: 'Tabela inválida' })
  try {
    const { rows } = await compPool.query(`DELETE FROM ${table} WHERE id=$1 RETURNING *`, [req.params.id])
    res.json({ ok: true, deleted: rows[0] ?? null })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

module.exports = router
