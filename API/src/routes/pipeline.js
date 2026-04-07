const express = require('express')
const router  = express.Router()
const { avPool: pool } = require('../db')

// GET /api/pipeline
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM pipeline_history ORDER BY date DESC'
    )
    res.json(rows)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// POST /api/pipeline
router.post('/', async (req, res) => {
  const { id, company_id, date, stage, note } = req.body
  try {
    const { rows } = await pool.query(
      'INSERT INTO pipeline_history (id, company_id, date, stage, note) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [id, company_id, date, stage, note]
    )
    res.status(201).json(rows[0])
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// GET /api/pipeline/stage-dates/:companyId
router.get('/stage-dates/:companyId', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM pipeline_stage_dates WHERE company_id=$1 ORDER BY stage',
      [req.params.companyId]
    )
    res.json(rows)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// PUT /api/pipeline/stage-dates/:companyId/:stage
router.put('/stage-dates/:companyId/:stage', async (req, res) => {
  const { date } = req.body
  try {
    const { rows } = await pool.query(
      `INSERT INTO pipeline_stage_dates (company_id, stage, date)
       VALUES ($1,$2,$3)
       ON CONFLICT (company_id, stage) DO UPDATE SET date=$3 RETURNING *`,
      [req.params.companyId, req.params.stage, date]
    )
    res.json(rows[0])
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

module.exports = router
