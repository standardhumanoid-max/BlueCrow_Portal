const express = require('express')
const router  = express.Router()
const { avPool } = require('../db')

const APP_KEY = 'controlo-participadas'

// GET /api/av/state
router.get('/', async (req, res) => {
  try {
    const { rows } = await avPool.query(
      'SELECT payload FROM app_state WHERE app_key=$1',
      [APP_KEY]
    )
    res.json(rows[0]?.payload ?? {})
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// PUT /api/av/state
router.put('/', async (req, res) => {
  const { payload, userEmail } = req.body
  try {
    await avPool.query(
      `INSERT INTO app_state (app_key, payload, updated_at, updated_by)
       VALUES ($1, $2, NOW(), $3)
       ON CONFLICT (app_key) DO UPDATE
         SET payload=$2, updated_at=NOW(), updated_by=$3`,
      [APP_KEY, JSON.stringify(payload), userEmail ?? null]
    )
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

module.exports = router
