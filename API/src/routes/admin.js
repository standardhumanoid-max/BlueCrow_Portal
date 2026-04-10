const express = require('express')
const router  = express.Router()
const bcrypt  = require('bcrypt')
const { compPool } = require('../db')
const { requireAuth, requireAdmin } = require('../middleware/auth')

// Todas as rotas admin requerem autenticação + role admin
router.use(requireAuth, requireAdmin)

// ── GET /api/admin/users ───────────────────────────────────────────────────────
router.get('/users', async (req, res) => {
  try {
    const { rows } = await compPool.query(
      `SELECT id, email, name, initials, role, active, portals, totp_enabled, created_at
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

  // Validar role
  const VALID_ROLES = ['admin', 'gestor', 'analista', 'viewer']
  if (role && !VALID_ROLES.includes(role)) {
    return res.status(400).json({ error: 'Role inválido' })
  }

  try {
    if (isNew) {
      if (!password) return res.status(400).json({ error: 'password obrigatória para novo utilizador' })
      const hashedPw = await bcrypt.hash(password, 12)
      const { rows } = await compPool.query(
        `INSERT INTO portal_users (id, email, name, initials, role, active, password, portals)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         RETURNING id, email, name, initials, role, active, portals`,
        [uid, email, name, initials, role, active ?? true, hashedPw, JSON.stringify(portals ?? [])]
      )
      return res.json(rows[0])
    }

    // Update — password é opcional (vazio = manter actual)
    let q, params
    if (password) {
      const hashedPw = await bcrypt.hash(password, 12)
      q = `UPDATE portal_users
           SET email=$2, name=$3, initials=$4, role=$5, active=$6, password=$7, portals=$8
           WHERE id=$1
           RETURNING id, email, name, initials, role, active, portals`
      params = [id, email, name, initials, role, active, hashedPw, JSON.stringify(portals ?? [])]
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
  // Admin não pode apagar a si próprio
  if (req.user.id === req.params.id) {
    return res.status(400).json({ error: 'Não pode eliminar a sua própria conta' })
  }
  try {
    await compPool.query('DELETE FROM portal_users WHERE id=$1', [req.params.id])
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

module.exports = router
