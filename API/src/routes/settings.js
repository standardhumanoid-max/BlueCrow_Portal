const express = require('express')
const router  = express.Router()
const { compPool } = require('../db')
const { encrypt } = require('../cryptoUtils')

// ── Specific routes must come BEFORE the /:key wildcard ──────────────────────

// GET /api/settings/apikey — verifica se o utilizador tem chave configurada
router.get('/apikey', async (req, res) => {
  try {
    const { rows } = await compPool.query(
      'SELECT settings FROM portal_users WHERE id=$1',
      [req.user.id]
    )
    const settings = rows[0]?.settings ?? {}
    res.json({ hasKey: !!settings.apikey })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// PUT /api/settings/apikey — guarda chave encriptada
router.put('/apikey', async (req, res) => {
  const { key } = req.body
  if (!key?.trim()) return res.status(400).json({ error: 'key obrigatória' })
  try {
    const encrypted = encrypt(key.trim())
    await compPool.query(
      `UPDATE portal_users
       SET settings = COALESCE(settings, '{}') || $1::jsonb
       WHERE id=$2`,
      [JSON.stringify({ apikey: encrypted }), req.user.id]
    )
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// DELETE /api/settings/apikey — remove chave
router.delete('/apikey', async (req, res) => {
  try {
    await compPool.query(
      `UPDATE portal_users SET settings = COALESCE(settings, '{}') - 'apikey' WHERE id=$1`,
      [req.user.id]
    )
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ── Generic portal_settings table CRUD ───────────────────────────────────────

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
