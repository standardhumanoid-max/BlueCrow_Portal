require('dotenv').config()
const express    = require('express')
const cors       = require('cors')
const path       = require('path')
const rateLimit  = require('express-rate-limit')
const { avPool, compPool, gaPool } = require('./db')
const { migrate } = require('./migrate')
const { requireAuth } = require('./middleware/auth')

const DIST = path.join(__dirname, '../../FrontEnd_Compliance/Compliance-Portal/dist')

const fundsRouter      = require('./routes/funds')
const companiesRouter  = require('./routes/companies')
const pipelineRouter   = require('./routes/pipeline')
const complianceRouter = require('./routes/compliance')
const appStateRouter   = require('./routes/appState')
const compStoreRouter  = require('./routes/compStore')
const cmvmRouter       = require('./routes/cmvm')
const adminRouter      = require('./routes/admin')
const authRouter       = require('./routes/auth')
const settingsRouter   = require('./routes/settings')
const historyRouter      = require('./routes/history')
const gestaoAtivosRouter = require('./routes/gestaoAtivos')
const scrRouter          = require('./routes/scr')

const app  = express()
const PORT = process.env.PORT || 3001

// ── CORS — apenas origens locais/rede interna ──────────────────────────────────
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:5173',
  'http://127.0.0.1:3001',
  'http://127.0.0.1:5173',
]
app.use(cors({
  origin: (origin, callback) => {
    // Permitir requests sem origin (ex: ferramentas internas, curl)
    if (!origin) return callback(null, true)
    // Permitir qualquer IP da rede local (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
    const isLAN = /^https?:\/\/(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(origin)
    if (allowedOrigins.includes(origin) || isLAN) return callback(null, true)
    callback(new Error('CORS: origem não permitida'))
  },
  credentials: true,
}))

app.use(express.json({ limit: '10mb' }))

// ── Rate limiting global: 200 req/min por IP ──────────────────────────────────
app.use(rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === '/api/health',
  message: { error: 'Demasiados pedidos. Tente novamente em breve.' },
}))

// ── Middleware ─────────────────────────────────────────────────────────────────

// ── Rotas públicas (sem autenticação) ─────────────────────────────────────────
app.use('/api/auth',     authRouter)    // login, 2fa

app.get('/api/health', async (req, res) => {
  try {
    await avPool.query('SELECT 1')
    await compPool.query('SELECT 1')
    await gaPool.query('SELECT 1')
    res.json({ status: 'ok', databases: { asset_valuation: 'connected', compliance: 'connected', asset_management: 'connected' }, time: new Date().toISOString() })
  } catch (e) {
    res.status(500).json({ status: 'error', error: e.message })
  }
})

// ── Rotas protegidas (requerem JWT válido) ─────────────────────────────────────
app.use('/api/funds',      requireAuth, fundsRouter)
app.use('/api/companies',  requireAuth, companiesRouter)
app.use('/api/pipeline',   requireAuth, pipelineRouter)
app.use('/api/compliance', requireAuth, complianceRouter)
app.use('/api/av/state',   requireAuth, appStateRouter)
app.use('/api/comp',       requireAuth, compStoreRouter)
app.use('/api/cmvm',       requireAuth, cmvmRouter)
app.use('/api/admin',      adminRouter)   // auth+admin já dentro do router
app.use('/api/settings',   requireAuth, settingsRouter)
app.use('/api/history',    requireAuth, historyRouter)
app.use('/api/ga',         requireAuth, gestaoAtivosRouter)
app.use('/api/scr',        requireAuth, scrRouter)

// ── Frontend estático ──────────────────────────────────────────────────────────
app.use(express.static(DIST))
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next()
  res.sendFile(path.join(DIST, 'index.html'))
})

// ── Start ──────────────────────────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', async () => {
  console.log(`BlueCrow API running on http://localhost:${PORT}`)
  console.log(`Health check: http://localhost:${PORT}/api/health`)
  await migrate()
})
