const jwt = require('jsonwebtoken')

const SECRET = process.env.JWT_SECRET || 'bluecrow_fallback_secret'

/**
 * Middleware que valida o JWT enviado no header Authorization: Bearer <token>
 * Em caso de falha devolve 401. Em caso de sucesso adiciona req.user.
 */
function requireAuth(req, res, next) {
  const header = req.headers['authorization']
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Autenticação necessária' })
  }
  const token = header.slice(7)
  try {
    const payload = jwt.verify(token, SECRET)
    req.user = payload   // { id, email, role, portals }
    next()
  } catch (e) {
    return res.status(401).json({ error: 'Sessão inválida ou expirada' })
  }
}

/**
 * Middleware que exige role admin.
 * Deve ser usado DEPOIS de requireAuth.
 */
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Acesso reservado a administradores' })
  }
  next()
}

module.exports = { requireAuth, requireAdmin }
