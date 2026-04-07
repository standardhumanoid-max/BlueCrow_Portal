const express = require('express')
const router  = express.Router()
const { avPool: pool } = require('../db')

// GET /api/funds
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM funds ORDER BY name')
    res.json(rows)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// GET /api/funds/:id
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM funds WHERE id = $1', [req.params.id])
    if (!rows.length) return res.status(404).json({ error: 'Fund not found' })
    res.json(rows[0])
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// PUT /api/funds/:id
router.put('/:id', async (req, res) => {
  const { name, vintage, commitment, called, distributed, nav_override, currency, active } = req.body
  try {
    const { rows } = await pool.query(
      `UPDATE funds SET
        name=$1, vintage=$2, commitment=$3, called=$4, distributed=$5,
        nav_override=$6, currency=$7, active=$8, updated_at=NOW()
       WHERE id=$9 RETURNING *`,
      [name, vintage, commitment, called, distributed, nav_override, currency, active, req.params.id]
    )
    if (!rows.length) return res.status(404).json({ error: 'Fund not found' })
    res.json(rows[0])
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// POST /api/funds
router.post('/', async (req, res) => {
  const { id, name, vintage, commitment, called, distributed, nav_override, currency, active } = req.body
  try {
    const { rows } = await pool.query(
      `INSERT INTO funds (id, name, vintage, commitment, called, distributed, nav_override, currency, active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [id, name, vintage, commitment, called, distributed, nav_override, currency, active ?? true]
    )
    res.status(201).json(rows[0])
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// GET /api/funds/:id/adjustments
router.get('/:id/adjustments', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM fund_adjustments WHERE fund_id=$1 ORDER BY date',
      [req.params.id]
    )
    res.json(rows)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// POST /api/funds/:id/adjustments
router.post('/:id/adjustments', async (req, res) => {
  const { date, type, amount, note } = req.body
  try {
    const { rows } = await pool.query(
      'INSERT INTO fund_adjustments (fund_id, date, type, amount, note) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [req.params.id, date, type, amount, note]
    )
    res.status(201).json(rows[0])
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// DELETE /api/funds/adjustments/:adjId
router.delete('/adjustments/:adjId', async (req, res) => {
  try {
    await pool.query('DELETE FROM fund_adjustments WHERE id=$1', [req.params.adjId])
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

module.exports = router
