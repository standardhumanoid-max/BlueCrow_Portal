const express = require('express')
const router  = express.Router()
const { compPool } = require('../db')

// GET /api/settings/:key
router.get('/:key', async (req, res) => {
  try {
    const { rows } = await compPool.query(
      'SELECT value, updated_at FROM portal_settings WHERE key=$1',
      [req.params.key]
    )
    res.json(rows[0] ?? { value: '', updated_at: null })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// PUT /api/settings/:key
router.put('/:key', async (req, res) => {
  const { value } = req.body
  if (value === undefined) return res.status(400).json({ error: 'value obrigatório' })
  try {
    const { rows } = await compPool.query(
      `INSERT INTO portal_settings (key, value, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (key) DO UPDATE SET value=$2, updated_at=NOW()
       RETURNING *`,
      [req.params.key, value]
    )
    res.json(rows[0])
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

module.exports = router
