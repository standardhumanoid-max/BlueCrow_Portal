const express = require('express')
const router  = express.Router()
const { compPool: pool } = require('../db')

// ── Users ──────────────────────────────────────────────────────────────────────
router.get('/users', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM portal_users ORDER BY name')
    res.json(rows)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.post('/users', async (req, res) => {
  const { id, email, name, role, active } = req.body
  try {
    const { rows } = await pool.query(
      'INSERT INTO portal_users (id,email,name,role,active) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [id, email, name, role, active ?? true]
    )
    res.status(201).json(rows[0])
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.put('/users/:id', async (req, res) => {
  const { email, name, role, active } = req.body
  try {
    const { rows } = await pool.query(
      'UPDATE portal_users SET email=$1,name=$2,role=$3,active=$4,updated_at=NOW() WHERE id=$5 RETURNING *',
      [email, name, role, active, req.params.id]
    )
    res.json(rows[0])
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.delete('/users/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM portal_users WHERE id=$1', [req.params.id])
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ── Tasks ──────────────────────────────────────────────────────────────────────
router.get('/tasks', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM compliance_tasks ORDER BY due_date')
    res.json(rows)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.post('/tasks', async (req, res) => {
  const { id, title, category, status, priority, due_date, owner, description } = req.body
  try {
    const { rows } = await pool.query(
      `INSERT INTO compliance_tasks (id,title,category,status,priority,due_date,owner,description)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [id, title, category, status, priority, due_date, owner, description]
    )
    res.status(201).json(rows[0])
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.put('/tasks/:id', async (req, res) => {
  const { title, category, status, priority, due_date, owner, description } = req.body
  try {
    const { rows } = await pool.query(
      `UPDATE compliance_tasks SET title=$1,category=$2,status=$3,priority=$4,due_date=$5,owner=$6,description=$7,updated_at=NOW()
       WHERE id=$8 RETURNING *`,
      [title, category, status, priority, due_date, owner, description, req.params.id]
    )
    res.json(rows[0])
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.delete('/tasks/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM compliance_tasks WHERE id=$1', [req.params.id])
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ── Risks ──────────────────────────────────────────────────────────────────────
router.get('/risks', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM risks ORDER BY created_at DESC')
    res.json(rows)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.post('/risks', async (req, res) => {
  const { id, title, category, probability, impact, status, owner, mitigation, review_date } = req.body
  try {
    const { rows } = await pool.query(
      `INSERT INTO risks (id,title,category,probability,impact,status,owner,mitigation,review_date)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [id, title, category, probability, impact, status, owner, mitigation, review_date]
    )
    res.status(201).json(rows[0])
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.put('/risks/:id', async (req, res) => {
  const { title, category, probability, impact, status, owner, mitigation, review_date } = req.body
  try {
    const { rows } = await pool.query(
      `UPDATE risks SET title=$1,category=$2,probability=$3,impact=$4,status=$5,owner=$6,mitigation=$7,review_date=$8,updated_at=NOW()
       WHERE id=$9 RETURNING *`,
      [title, category, probability, impact, status, owner, mitigation, review_date, req.params.id]
    )
    res.json(rows[0])
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.delete('/risks/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM risks WHERE id=$1', [req.params.id])
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ── KYC Clients ────────────────────────────────────────────────────────────────
router.get('/kyc', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM kyc_clients ORDER BY name')
    res.json(rows)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.post('/kyc', async (req, res) => {
  const { id, name, type, nif, risk_level, status, review_date, notes } = req.body
  try {
    const { rows } = await pool.query(
      `INSERT INTO kyc_clients (id,name,type,nif,risk_level,status,review_date,notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [id, name, type, nif, risk_level, status, review_date, notes]
    )
    res.status(201).json(rows[0])
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.put('/kyc/:id', async (req, res) => {
  const { name, type, nif, risk_level, status, review_date, notes } = req.body
  try {
    const { rows } = await pool.query(
      `UPDATE kyc_clients SET name=$1,type=$2,nif=$3,risk_level=$4,status=$5,review_date=$6,notes=$7,updated_at=NOW()
       WHERE id=$8 RETURNING *`,
      [name, type, nif, risk_level, status, review_date, notes, req.params.id]
    )
    res.json(rows[0])
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.delete('/kyc/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM kyc_clients WHERE id=$1', [req.params.id])
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ── Audit Logs ─────────────────────────────────────────────────────────────────
router.get('/audit', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 500')
    res.json(rows)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.post('/audit', async (req, res) => {
  const { id, user_email, action, entity, entity_id, detail, ip } = req.body
  try {
    const { rows } = await pool.query(
      `INSERT INTO audit_logs (id,user_email,action,entity,entity_id,detail,ip)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [id, user_email, action, entity, entity_id, detail, ip]
    )
    res.status(201).json(rows[0])
  } catch (e) { res.status(500).json({ error: e.message }) }
})

module.exports = router
