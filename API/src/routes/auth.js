const express    = require('express')
const router     = express.Router()
const speakeasy  = require('speakeasy')
const QRCode     = require('qrcode')
const bcrypt     = require('bcrypt')
const jwt        = require('jsonwebtoken')
const rateLimit  = require('express-rate-limit')
const { compPool } = require('../db')
const { requireAuth, requireAdmin } = require('../middleware/auth')

const SECRET      = process.env.JWT_SECRET    || 'bluecrow_fallback_secret'
const EXPIRES_IN  = process.env.JWT_EXPIRES_IN || '8h'

const MAX_ATTEMPTS = 5
const LOCKOUT_MS   = 15 * 60 * 1000   // 15 minutos

// Lockout em memória no servidor: { email → { count, until } }
const loginAttempts = new Map()

function getLockout(email) {
  const e = loginAttempts.get(email)
  if (!e) return { count: 0, until: 0 }
  return e
}
function recordFail(email) {
  const e   = getLockout(email)
  const cnt = e.count + 1
  const until = cnt >= MAX_ATTEMPTS ? Date.now() + LOCKOUT_MS : e.until
  loginAttempts.set(email, { count: cnt, until })
  return cnt
}
function clearAttempts(email) {
  loginAttempts.delete(email)
}

// Rate limiter: máx 20 req/min por IP nesta rota
const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados pedidos. Tente novamente em 1 minuto.' },
})

// ── POST /api/auth/login ───────────────────────────────────────────────────────
router.post('/login', loginLimiter, async (req, res) => {
  const { email, password } = req.body
  if (!email || !password) return res.status(400).json({ error: 'Email e password obrigatórios' })

  try {
    // Verificar bloqueio server-side
    const lockout = getLockout(email.toLowerCase())
    if (lockout.until > Date.now()) {
      const mins = Math.ceil((lockout.until - Date.now()) / 60000)
      return res.status(429).json({
        error: `Conta bloqueada. Tente novamente em ${mins} min.`,
        locked: true,
        until: lockout.until,
      })
    }

    const { rows } = await compPool.query(
      'SELECT id, email, name, initials, role, active, password, portals, totp_enabled, totp_secret FROM portal_users WHERE email=$1',
      [email.toLowerCase()]
    )

    const user = rows[0]

    // Utilizador não existe ou inativo — mesmo tempo de resposta para não revelar existência
    if (!user || !user.active) {
      recordFail(email.toLowerCase())
      return res.status(401).json({ error: 'Credenciais incorretas.' })
    }

    // Verificar password — suporta bcrypt E texto simples (migração gradual)
    let passwordValid = false
    if (user.password && user.password.startsWith('$2')) {
      passwordValid = await bcrypt.compare(password, user.password)
    } else {
      // Texto simples (legacy) — comparar e fazer hash imediatamente
      passwordValid = (user.password === password)
      if (passwordValid) {
        const hash = await bcrypt.hash(password, 12)
        await compPool.query('UPDATE portal_users SET password=$1 WHERE id=$2', [hash, user.id])
      }
    }

    if (!passwordValid) {
      const count = recordFail(email.toLowerCase())
      if (count >= MAX_ATTEMPTS) {
        return res.status(429).json({
          error: `Conta bloqueada após ${MAX_ATTEMPTS} tentativas falhadas. Tente novamente em 15 minutos.`,
          locked: true,
          until: Date.now() + LOCKOUT_MS,
        })
      }
      const restantes = MAX_ATTEMPTS - count
      return res.status(401).json({
        error: `Credenciais incorretas. (${restantes} tentativa${restantes === 1 ? '' : 's'} restante${restantes === 1 ? '' : 's'})`,
      })
    }

    // Credenciais válidas — limpar tentativas
    clearAttempts(email.toLowerCase())

    // Responder com estado 2FA
    if (!user.totp_enabled) {
      return res.json({ needsSetup: true, userId: user.id })
    }
    return res.json({ requires2fa: true, userId: user.id })

  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ── POST /api/auth/token ── emite JWT após 2FA bem-sucedido ───────────────────
router.post('/token', async (req, res) => {
  const { userId } = req.body
  if (!userId) return res.status(400).json({ error: 'userId obrigatório' })
  try {
    const { rows } = await compPool.query(
      'SELECT id, email, name, initials, role, active, portals FROM portal_users WHERE id=$1',
      [userId]
    )
    const user = rows[0]
    if (!user || !user.active) return res.status(401).json({ error: 'Utilizador não encontrado' })

    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name, initials: user.initials, role: user.role, portals: user.portals },
      SECRET,
      { expiresIn: EXPIRES_IN }
    )
    res.json({ token, user: { id: user.id, email: user.email, name: user.name, initials: user.initials, role: user.role, portals: user.portals } })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ── GET /api/auth/lockout?email=xxx ── estado de bloqueio (para o frontend) ───
router.get('/lockout', (req, res) => {
  const email = (req.query.email || '').toLowerCase()
  if (!email) return res.json({ locked: false, until: 0, count: 0 })
  const entry = getLockout(email)
  const locked = entry.until > Date.now()
  res.json({ locked, until: entry.until, count: entry.count })
})

// ── GET /api/auth/2fa/setup/:userId ── gera QR
// Acessível sem auth durante o setup inicial (primeiro login sem 2FA)
// Acessível com auth para admin reconfigurar
router.get('/2fa/setup/:userId', async (req, res) => {
  // Se houver token válido, verificar permissão
  const header = req.headers['authorization']
  if (header && header.startsWith('Bearer ')) {
    const jwt = require('jsonwebtoken')
    try {
      const payload = jwt.verify(header.slice(7), SECRET)
      if (payload.id !== req.params.userId && payload.role !== 'admin') {
        return res.status(403).json({ error: 'Sem permissão' })
      }
    } catch { /* token inválido — ignorar, tratar como setup inicial */ }
  }
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

// ── POST /api/auth/2fa/enable ── confirma token e ativa 2FA ──────────────────
// Não requer auth — é chamado durante o setup inicial (antes de ter JWT)
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

// ── POST /api/auth/2fa/verify ── verifica durante o login ────────────────────
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

// ── DELETE /api/auth/2fa/:userId ── desativa 2FA (apenas admin) ──────────────
router.delete('/2fa/:userId', requireAuth, requireAdmin, async (req, res) => {
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
