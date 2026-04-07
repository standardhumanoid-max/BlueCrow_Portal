require('dotenv').config()
const express  = require('express')
const cors     = require('cors')
const { avPool, compPool } = require('./db')
const { migrate } = require('./migrate')

const fundsRouter      = require('./routes/funds')
const companiesRouter  = require('./routes/companies')
const pipelineRouter   = require('./routes/pipeline')
const complianceRouter = require('./routes/compliance')
const appStateRouter   = require('./routes/appState')
const compStoreRouter  = require('./routes/compStore')
const cmvmRouter       = require('./routes/cmvm')
const adminRouter      = require('./routes/admin')
const authRouter       = require('./routes/auth')

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

// ── Start ──────────────────────────────────────────────────────────────────────
app.listen(PORT, async () => {
  console.log(`BlueCrow API running on http://localhost:${PORT}`)
  console.log(`Health check: http://localhost:${PORT}/api/health`)
  await migrate()
})
