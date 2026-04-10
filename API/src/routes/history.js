const express = require('express')
const router  = require('express').Router()
const { compPool, avPool } = require('../db')

// Tabelas da BD asset valuation
const AV_TABLES = new Set([
  'av_companies', 'av_tranches', 'av_sales', 'av_financials', 'av_cap_table',
  'av_runway', 'av_pipeline', 'av_documents', 'av_log', 'av_valuations',
  'av_debt_assessment', 'av_funds',
  'companies', 'funds', 'tranches', 'sales', 'valuations', 'company_log',
])

function getPool(table) {
  return AV_TABLES.has(table) ? avPool : compPool
}

// GET /api/history?table=xxx&id=xxx — últimas entradas de um registo
router.get('/', async (req, res) => {
  const { table, id } = req.query
  if (!table || !id) return res.status(400).json({ error: 'table e id obrigatórios' })
  try {
    const { rows } = await getPool(table).query(
      `SELECT * FROM _row_history WHERE table_name=$1 AND row_id=$2 ORDER BY changed_at DESC LIMIT 20`,
      [table, id]
    )
    res.json(rows)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// POST /api/history/restore — restaura um registo a partir dos dados guardados
router.post('/restore', async (req, res) => {
  const { table, row_data } = req.body
  if (!table || !row_data || typeof row_data !== 'object') {
    return res.status(400).json({ error: 'table e row_data obrigatórios' })
  }
  try {
    const pool   = getPool(table)
    const fields = Object.keys(row_data)
    const values = Object.values(row_data).map(v =>
      (v !== null && typeof v === 'object') ? JSON.stringify(v) : v
    )
    const setClauses   = fields.filter(f => f !== 'id').map(f => `${f}=EXCLUDED.${f}`).join(', ')
    const placeholders = fields.map((_, i) => `$${i + 1}`).join(', ')
    const { rows } = await pool.query(
      `INSERT INTO ${table} (${fields.join(', ')})
       VALUES (${placeholders})
       ON CONFLICT (id) DO UPDATE SET ${setClauses}
       RETURNING *`,
      values
    )
    res.json({ ok: true, restored: rows[0] })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

module.exports = router
