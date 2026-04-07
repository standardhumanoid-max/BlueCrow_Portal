require('dotenv').config()
const express  = require('express')
const cors     = require('cors')
const path     = require('path')
const { avPool, compPool } = require('./db')
const { migrate } = require('./migrate')

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

const app  = express()
const PORT = process.env.PORT || 3001

// ── Middleware ─────────────────────────────────────────────────────────────────
app.use(cors({ origin: true }))  // aceita qualquer origem (rede interna)
app.use(express.json())

// ── Routes ─────────────────────────────────────────────────────────────────────
app.use('/api/funds',      fundsRouter)
app.use('/api/companies',  companiesRouter)
app.use('/api/pipeline',   pipelineRouter)
app.use('/api/compliance', complianceRouter)
app.use('/api/av/state',   appStateRouter)
app.use('/api/comp',       compStoreRouter)
app.use('/api/cmvm',       cmvmRouter)
app.use('/api/admin',      adminRouter)
app.use('/api/auth',       authRouter)
app.use('/api/settings',   settingsRouter)

// ── Health check ───────────────────────────────────────────────────────────────
app.get('/api/health', async (req, res) => {
  try {
    await avPool.query('SELECT 1')
    await compPool.query('SELECT 1')
    res.json({ status: 'ok', databases: { asset_valuation: 'connected', compliance: 'connected' }, time: new Date().toISOString() })
  } catch (e) {
    res.status(500).json({ status: 'error', error: e.message })
  }
})

// ── Frontend estático (serve o build do React na raiz) ─────────────────────────
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
