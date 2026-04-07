const express   = require('express')
const router    = express.Router()
const speakeasy = require('speakeasy')
const QRCode    = require('qrcode')
const { compPool } = require('../db')

// GET /api/auth/2fa/setup/:userId  — gera segredo + QR (sem ativar ainda)
router.get('/2fa/setup/:userId', async (req, res) => {
  try {
    const { rows } = await compPool.query(
      'SELECT id, email, name FROM portal_users WHERE id=$1',
      [req.params.userId]
    )
    if (!rows.length) return res.status(404).json({ error: 'Utilizador não encontrado' })
    const u = rows[0]

    const secret = speakeasy.generateSecret({
      name:   `BlueCrow:${u.email}`,
      issuer: 'BlueCrow Capital',
      length: 20,
    })

    // Guarda o segredo mas não ativa ainda (aguarda confirmação com token)
    await compPool.query(
      'UPDATE portal_users SET totp_secret=$1, totp_enabled=FALSE WHERE id=$2',
      [secret.base32, req.params.userId]
    )

    const qr = await QRCode.toDataURL(secret.otpauth_url)
    res.json({ qr, secret: secret.base32 })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// POST /api/auth/2fa/enable  — confirma token e ativa 2FA
router.post('/2fa/enable', async (req, res) => {
  const { userId, token } = req.body
  if (!userId || !token) return res.status(400).json({ error: 'userId e token obrigatórios' })
  try {
    const { rows } = await compPool.query(
      'SELECT totp_secret FROM portal_users WHERE id=$1',
      [userId]
    )
    if (!rows.length || !rows[0].totp_secret) {
      return res.status(400).json({ error: 'Segredo não encontrado. Gere um novo QR code.' })
    }

    const valid = speakeasy.totp.verify({
      secret:   rows[0].totp_secret,
      encoding: 'base32',
      token,
      window:   1,
    })
    if (!valid) return res.status(400).json({ error: 'Código inválido. Verifique a hora do dispositivo.' })

    await compPool.query('UPDATE portal_users SET totp_enabled=TRUE WHERE id=$1', [userId])
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// POST /api/auth/2fa/verify  — verifica durante o login (2.º fator)
router.post('/2fa/verify', async (req, res) => {
  const { userId, token } = req.body
  if (!userId || !token) return res.status(400).json({ error: 'userId e token obrigatórios' })
  try {
    const { rows } = await compPool.query(
      'SELECT totp_secret, totp_enabled FROM portal_users WHERE id=$1',
      [userId]
    )
    if (!rows.length || !rows[0].totp_enabled || !rows[0].totp_secret) {
      return res.status(400).json({ error: '2FA não configurado para este utilizador' })
    }

    const valid = speakeasy.totp.verify({
      secret:   rows[0].totp_secret,
      encoding: 'base32',
      token,
      window:   1,
    })
    if (!valid) return res.status(401).json({ error: 'Código inválido. Tente novamente.' })
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// DELETE /api/auth/2fa/:userId  — desativa 2FA (admin)
router.delete('/2fa/:userId', async (req, res) => {
  try {
    await compPool.query(
      'UPDATE portal_users SET totp_secret=NULL, totp_enabled=FALSE WHERE id=$1',
      [req.params.userId]
    )
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

module.exports = router
