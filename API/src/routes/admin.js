const express = require('express')
const router  = express.Router()
const { compPool } = require('../db')

// ── GET /api/admin/users ───────────────────────────────────────────────────────
router.get('/users', async (req, res) => {
  try {
    const { rows } = await compPool.query(
      `SELECT id, email, name, initials, role, active, portals, created_at
       FROM portal_users ORDER BY name ASC`
    )
    res.json(rows)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ── POST /api/admin/users  (create or update) ─────────────────────────────────
router.post('/users', async (req, res) => {
  const { id, email, name, initials, role, active, password, portals } = req.body
  const isNew = !id
  const uid   = id || `u-${Date.now()}-${Math.random().toString(36).slice(2,6)}`

  try {
    if (isNew) {
      if (!password) return res.status(400).json({ error: 'password obrigatória para novo utilizador' })
      const { rows } = await compPool.query(
        `INSERT INTO portal_users (id, email, name, initials, role, active, password, portals)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         RETURNING id, email, name, initials, role, active, portals`,
        [uid, email, name, initials, role, active ?? true, password, JSON.stringify(portals ?? [])]
      )
      return res.json(rows[0])
    }

    // Update — password is optional (blank = manter actual)
    let q, params
    if (password) {
      q = `UPDATE portal_users
           SET email=$2, name=$3, initials=$4, role=$5, active=$6, password=$7, portals=$8
           WHERE id=$1
           RETURNING id, email, name, initials, role, active, portals`
      params = [id, email, name, initials, role, active, password, JSON.stringify(portals ?? [])]
    } else {
      q = `UPDATE portal_users
           SET email=$2, name=$3, initials=$4, role=$5, active=$6, portals=$7
           WHERE id=$1
           RETURNING id, email, name, initials, role, active, portals`
      params = [id, email, name, initials, role, active, JSON.stringify(portals ?? [])]
    }

    const { rows } = await compPool.query(q, params)
    if (!rows.length) return res.status(404).json({ error: 'Utilizador não encontrado' })
    return res.json(rows[0])
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ── DELETE /api/admin/users/:id ───────────────────────────────────────────────
router.delete('/users/:id', async (req, res) => {
  try {
    await compPool.query('DELETE FROM portal_users WHERE id=$1', [req.params.id])
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

module.exports = router
