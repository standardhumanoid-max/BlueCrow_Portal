const express = require('express')
const router  = express.Router()
const { compPool } = require('../db')

const CORE = [
  'id', 'name', 'short_name', 'legal_type', 'status',
  'currency', 'domicile', 'is_subfund', 'parent_fund_id',
]

const BY_PORTAL = {
  compliance:          ['cmvm_registration', 'compliance_status', 'last_compliance_review', 'next_reporting_deadline', 'aml_risk_class', 'prospectus_date', 'regulatory_entity'],
  asset_valuation:     ['nav', 'nav_date', 'total_aum', 'benchmark', 'valuation_frequency', 'last_valuation_date'],
  gestao_ativos:       ['inception_date', 'strategy', 'investment_focus', 'geographic_focus', 'management_fee_pct', 'performance_fee_pct', 'hurdle_rate_pct', 'gp_name', 'depositary'],
  investment_analysis: ['vintage_year', 'investment_period_end', 'fund_term_years', 'target_irr_pct', 'target_moic', 'capital_committed', 'capital_called', 'capital_deployed'],
  asset_finance:       ['has_asset_finance', 'typical_tenor_years', 'typical_yield_pct'],
}

const ALL = [...CORE.filter(c => c !== 'id'), ...Object.values(BY_PORTAL).flat()]

const VALID_PORTALS = new Set(Object.keys(BY_PORTAL))

function validatePortal(portal) {
  return VALID_PORTALS.has(portal) ? portal : null
}

function selectCols(user, portal) {
  if (user.role === 'admin') return ['id', ...ALL]
  return [...CORE, ...(BY_PORTAL[validatePortal(portal)] ?? [])]
}

// GET /api/bc-funds?portal=investment_analysis
router.get('/', async (req, res) => {
  try {
    const { rows } = await compPool.query(
      `SELECT ${selectCols(req.user, req.query.portal).join(', ')}
       FROM bc_funds ORDER BY is_subfund, id`
    )
    res.json(rows)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// GET /api/bc-funds/:id
router.get('/:id', async (req, res) => {
  try {
    const c = selectCols(req.user, req.query.portal)
    const { rows } = await compPool.query(
      `SELECT ${c.join(', ')} FROM bc_funds WHERE id=$1`, [req.params.id]
    )
    if (!rows.length) return res.status(404).json({ error: 'Fundo não encontrado' })
    res.json(rows[0])
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// PUT /api/bc-funds/:id
router.put('/:id', async (req, res) => {
  try {
    const portal = validatePortal(req.query.portal)
    const allowable = req.user.role === 'admin' ? ALL : (BY_PORTAL[portal] ?? [])
    const updates = Object.entries(req.body).filter(([k]) => allowable.includes(k))
    if (!updates.length) return res.status(400).json({ error: 'Sem campos para atualizar' })
    const sets = updates.map(([k], i) => `${k}=$${i + 1}`)
    const vals = [...updates.map(([, v]) => v), req.params.id]
    await compPool.query(
      `UPDATE bc_funds SET ${sets.join(', ')}, updated_at=NOW() WHERE id=$${vals.length}`, vals
    )
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

module.exports = router
