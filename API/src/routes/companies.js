const express = require('express')
const router  = express.Router()
const { avPool: pool } = require('../db')

// GET /api/companies
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM companies ORDER BY name')
    res.json(rows)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// GET /api/companies/:id
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM companies WHERE id=$1', [req.params.id])
    if (!rows.length) return res.status(404).json({ error: 'Company not found' })
    res.json(rows[0])
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// POST /api/companies
router.post('/', async (req, res) => {
  const {
    id, name, sector, stage, country, website, description,
    founded_year, employees, currency, status, fund_id, pipeline_stage
  } = req.body
  try {
    const { rows } = await pool.query(
      `INSERT INTO companies
         (id, name, sector, stage, country, website, description, founded_year, employees, currency, status, fund_id, pipeline_stage)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [id, name, sector, stage, country, website, description, founded_year, employees, currency, status, fund_id, pipeline_stage]
    )
    res.status(201).json(rows[0])
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// PUT /api/companies/:id
router.put('/:id', async (req, res) => {
  const {
    name, sector, stage, country, website, description,
    founded_year, employees, currency, status, fund_id, pipeline_stage
  } = req.body
  try {
    const { rows } = await pool.query(
      `UPDATE companies SET
         name=$1, sector=$2, stage=$3, country=$4, website=$5, description=$6,
         founded_year=$7, employees=$8, currency=$9, status=$10,
         fund_id=$11, pipeline_stage=$12, updated_at=NOW()
       WHERE id=$13 RETURNING *`,
      [name, sector, stage, country, website, description, founded_year, employees, currency, status, fund_id, pipeline_stage, req.params.id]
    )
    if (!rows.length) return res.status(404).json({ error: 'Company not found' })
    res.json(rows[0])
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// DELETE /api/companies/:id
router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM companies WHERE id=$1', [req.params.id])
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// GET /api/companies/:id/tranches
router.get('/:id/tranches', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM tranches WHERE company_id=$1 ORDER BY date',
      [req.params.id]
    )
    res.json(rows)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// POST /api/companies/:id/tranches
router.post('/:id/tranches', async (req, res) => {
  const { id, fund_id, date, amount, instrument, shares, share_price, currency } = req.body
  try {
    const { rows } = await pool.query(
      `INSERT INTO tranches (id, company_id, fund_id, date, amount, instrument, shares, share_price, currency)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [id, req.params.id, fund_id, date, amount, instrument, shares, share_price, currency]
    )
    res.status(201).json(rows[0])
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// PUT /api/tranches/:id
router.put('/tranches/:id', async (req, res) => {
  const { fund_id, date, amount, instrument, shares, share_price, currency } = req.body
  try {
    const { rows } = await pool.query(
      `UPDATE tranches SET fund_id=$1, date=$2, amount=$3, instrument=$4, shares=$5, share_price=$6, currency=$7, updated_at=NOW()
       WHERE id=$8 RETURNING *`,
      [fund_id, date, amount, instrument, shares, share_price, currency, req.params.id]
    )
    res.json(rows[0])
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// DELETE /api/tranches/:id
router.delete('/tranches/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM tranches WHERE id=$1', [req.params.id])
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// GET /api/companies/:id/sales
router.get('/:id/sales', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM sales WHERE company_id=$1 ORDER BY date',
      [req.params.id]
    )
    res.json(rows)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// POST /api/companies/:id/sales
router.post('/:id/sales', async (req, res) => {
  const { id, fund_id, date, proceeds, shares_sold, currency } = req.body
  try {
    const { rows } = await pool.query(
      `INSERT INTO sales (id, company_id, fund_id, date, proceeds, shares_sold, currency)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [id, req.params.id, fund_id, date, proceeds, shares_sold, currency]
    )
    res.status(201).json(rows[0])
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// DELETE /api/sales/:id
router.delete('/sales/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM sales WHERE id=$1', [req.params.id])
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// GET /api/companies/:id/valuations
router.get('/:id/valuations', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM valuations WHERE company_id=$1 ORDER BY date',
      [req.params.id]
    )
    res.json(rows)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// POST /api/companies/:id/valuations
router.post('/:id/valuations', async (req, res) => {
  const { id, fund_id, date, method, nav, currency, notes, assumptions } = req.body
  try {
    const { rows } = await pool.query(
      `INSERT INTO valuations (id, company_id, fund_id, date, method, nav, currency, notes, assumptions)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [id, req.params.id, fund_id, date, method, nav, currency, notes, assumptions ? JSON.stringify(assumptions) : null]
    )
    res.status(201).json(rows[0])
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// PUT /api/valuations/:id
router.put('/valuations/:id', async (req, res) => {
  const { fund_id, date, method, nav, currency, notes, assumptions } = req.body
  try {
    const { rows } = await pool.query(
      `UPDATE valuations SET fund_id=$1, date=$2, method=$3, nav=$4, currency=$5, notes=$6, assumptions=$7, updated_at=NOW()
       WHERE id=$8 RETURNING *`,
      [fund_id, date, method, nav, currency, notes, assumptions ? JSON.stringify(assumptions) : null, req.params.id]
    )
    res.json(rows[0])
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// DELETE /api/valuations/:id
router.delete('/valuations/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM valuations WHERE id=$1', [req.params.id])
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// GET /api/companies/:id/log
router.get('/:id/log', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM company_log WHERE company_id=$1 ORDER BY created_at DESC',
      [req.params.id]
    )
    res.json(rows)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// POST /api/companies/:id/log
router.post('/:id/log', async (req, res) => {
  const { id, user_email, action, detail } = req.body
  try {
    const { rows } = await pool.query(
      'INSERT INTO company_log (id, company_id, user_email, action, detail) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [id, req.params.id, user_email, action, detail]
    )
    res.status(201).json(rows[0])
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

module.exports = router
