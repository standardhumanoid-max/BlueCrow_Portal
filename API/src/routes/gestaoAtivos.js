const express = require('express')
const router  = express.Router()
const { gaPool } = require('../db')

async function notFound(res, id) {
  res.status(404).json({ error: `Ativo ${id} não encontrado` })
}

const ASSET_COLS = `name, spv, location, typology, land_area, build_area,
        tenant, acquisition_date, maps_link, general_notes,
        purchase_price, stamp_duty, notary_fees,
        capex_current, opex_current,
        capital_cost, capital_cost_v,
        income_current,
        bidding_offer, transaction_fee, commercialization, asking_price,
        status`

const ASSET_PLACEHOLDERS = `$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23`

function buildAssetParams(f) {
  return [
    f.name,
    f.spv             ?? null,
    f.location        ?? null,
    f.typology        ?? null,
    f.land_area       ?? null,
    f.build_area      ?? null,
    f.tenant          ?? null,
    f.acquisition_date ?? null,
    f.maps_link       ?? null,
    f.general_notes   ?? null,
    f.purchase_price  ?? 0,
    f.stamp_duty      ?? 0,
    f.notary_fees     ?? 0,
    f.capex_current   ?? 0,
    f.opex_current    ?? 0,
    f.capital_cost    ?? 6.5,
    f.capital_cost_v  ?? null,
    f.income_current  ?? 0,
    f.bidding_offer   ?? null,
    f.transaction_fee ?? 5,
    f.commercialization ?? 15,
    f.asking_price    ?? null,
    f.status          ?? 'sem_rendimento',
  ]
}

// ─────────────────────────────────────────────────────────────────
// ASSETS
// ─────────────────────────────────────────────────────────────────

// GET /api/ga/assets
router.get('/assets', async (req, res) => {
  try {
    const { rows } = await gaPool.query(
      'SELECT * FROM ga_assets ORDER BY spv NULLS LAST, name'
    )
    res.json(rows)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// GET /api/ga/assets/:id
router.get('/assets/:id', async (req, res) => {
  const { id } = req.params
  try {
    const [asset, valuations, bovs, notes, tenancies, files] = await Promise.all([
      gaPool.query('SELECT * FROM ga_assets WHERE id=$1', [id]),
      gaPool.query('SELECT * FROM ga_valuations WHERE asset_id=$1 ORDER BY year ASC', [id]),
      gaPool.query('SELECT * FROM ga_bovs WHERE asset_id=$1 ORDER BY label ASC', [id]),
      gaPool.query('SELECT * FROM ga_notes WHERE asset_id=$1', [id]),
      gaPool.query('SELECT * FROM ga_tenancies WHERE asset_id=$1 ORDER BY created_at ASC', [id]),
      gaPool.query('SELECT * FROM ga_files WHERE asset_id=$1 ORDER BY created_at ASC', [id]),
    ])
    if (!asset.rows[0]) return notFound(res, id)
    res.json({
      ...asset.rows[0],
      valuations: valuations.rows,
      bovs:       bovs.rows,
      note:       notes.rows[0] ?? null,
      tenancies:  tenancies.rows,
      files:      files.rows,
    })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// POST /api/ga/assets  (create)
router.post('/assets', async (req, res) => {
  const f = req.body
  try {
    const { rows } = await gaPool.query(
      `INSERT INTO ga_assets (${ASSET_COLS}) VALUES (${ASSET_PLACEHOLDERS}) RETURNING *`,
      buildAssetParams(f)
    )
    res.status(201).json(rows[0])
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// PATCH /api/ga/assets/:id
router.patch('/assets/:id', async (req, res) => {
  const { id } = req.params
  const fields = req.body
  if (!Object.keys(fields).length) return res.status(400).json({ error: 'Nenhum campo enviado' })
  try {
    const allowed = [
      'name','spv','location','typology','land_area','build_area',
      'tenant','acquisition_date','maps_link','general_notes',
      'purchase_price','stamp_duty','notary_fees',
      'capex_current','opex_current',
      'capital_cost','capital_cost_v',
      'income_current',
      'bidding_offer','transaction_fee','commercialization','asking_price',
      'status',
    ]
    const keys = Object.keys(fields).filter(k => allowed.includes(k))
    if (!keys.length) return res.status(400).json({ error: 'Nenhum campo valido' })
    const setClauses = keys.map((k, i) => `${k}=$${i + 1}`).join(', ')
    const vals = keys.map(k => fields[k])
    const { rows } = await gaPool.query(
      `UPDATE ga_assets SET ${setClauses}, updated_at=now() WHERE id=$${keys.length + 1} RETURNING *`,
      [...vals, id]
    )
    if (!rows[0]) return notFound(res, id)
    res.json(rows[0])
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// POST /api/ga/assets/upsert — upsert by name (used in import)
router.post('/assets/upsert', async (req, res) => {
  const f = req.body
  if (!f.name) return res.status(400).json({ error: 'name é obrigatório' })
  try {
    const { rows } = await gaPool.query(`
      INSERT INTO ga_assets (${ASSET_COLS}) VALUES (${ASSET_PLACEHOLDERS})
      ON CONFLICT (name) DO UPDATE SET
        spv              = EXCLUDED.spv,
        location         = EXCLUDED.location,
        typology         = EXCLUDED.typology,
        land_area        = EXCLUDED.land_area,
        build_area       = EXCLUDED.build_area,
        tenant           = EXCLUDED.tenant,
        acquisition_date = EXCLUDED.acquisition_date,
        maps_link        = EXCLUDED.maps_link,
        general_notes    = EXCLUDED.general_notes,
        purchase_price   = EXCLUDED.purchase_price,
        stamp_duty       = EXCLUDED.stamp_duty,
        notary_fees      = EXCLUDED.notary_fees,
        capex_current    = EXCLUDED.capex_current,
        opex_current     = EXCLUDED.opex_current,
        capital_cost     = EXCLUDED.capital_cost,
        capital_cost_v   = EXCLUDED.capital_cost_v,
        income_current   = EXCLUDED.income_current,
        bidding_offer    = EXCLUDED.bidding_offer,
        transaction_fee  = EXCLUDED.transaction_fee,
        commercialization = EXCLUDED.commercialization,
        asking_price     = EXCLUDED.asking_price,
        status           = EXCLUDED.status,
        updated_at       = now()
      RETURNING *`,
      buildAssetParams(f)
    )
    res.json(rows[0])
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// GET /api/ga/avaliacoes  — all assets with their valuations + bovs
router.get('/avaliacoes', async (req, res) => {
  try {
    const [assets, valuations, bovs] = await Promise.all([
      gaPool.query('SELECT id, name, spv, purchase_price, stamp_duty, notary_fees, capex_current, opex_current, capital_cost, capital_cost_v, income_current, asking_price, bidding_offer, transaction_fee, commercialization, status FROM ga_assets ORDER BY spv NULLS LAST, name'),
      gaPool.query('SELECT * FROM ga_valuations ORDER BY asset_id, year ASC'),
      gaPool.query('SELECT * FROM ga_bovs ORDER BY asset_id, label ASC'),
    ])
    const valMap = {}
    const bovMap = {}
    for (const v of valuations.rows) {
      if (!valMap[v.asset_id]) valMap[v.asset_id] = []
      valMap[v.asset_id].push(v)
    }
    for (const b of bovs.rows) {
      if (!bovMap[b.asset_id]) bovMap[b.asset_id] = []
      bovMap[b.asset_id].push(b)
    }
    const result = assets.rows.map(a => ({
      ...a,
      valuations: valMap[a.id] ?? [],
      bovs:       bovMap[a.id] ?? [],
    }))
    res.json(result)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// DELETE /api/ga/assets/:id
router.delete('/assets/:id', async (req, res) => {
  try {
    const { rows } = await gaPool.query('DELETE FROM ga_assets WHERE id=$1 RETURNING *', [req.params.id])
    if (!rows[0]) return notFound(res, req.params.id)
    res.json({ ok: true, deleted: rows[0] })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ─────────────────────────────────────────────────────────────────
// VALUATIONS
// ─────────────────────────────────────────────────────────────────

router.put('/assets/:id/valuations/:year', async (req, res) => {
  const { id, year } = req.params
  const { value } = req.body
  try {
    const { rows } = await gaPool.query(`
      INSERT INTO ga_valuations (asset_id, year, value)
      VALUES ($1,$2,$3)
      ON CONFLICT (asset_id, year) DO UPDATE SET value=$3
      RETURNING *`,
      [id, year, value]
    )
    res.json(rows[0])
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.delete('/assets/:id/valuations/:year', async (req, res) => {
  const { id, year } = req.params
  try {
    await gaPool.query('DELETE FROM ga_valuations WHERE asset_id=$1 AND year=$2', [id, year])
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ─────────────────────────────────────────────────────────────────
// BOVS
// ─────────────────────────────────────────────────────────────────

router.put('/assets/:id/bovs/:label', async (req, res) => {
  const { id, label } = req.params
  const { value, notes } = req.body
  try {
    const { rows } = await gaPool.query(`
      INSERT INTO ga_bovs (asset_id, label, value, notes)
      VALUES ($1,$2,$3,$4)
      ON CONFLICT (asset_id, label) DO UPDATE SET value=$3, notes=$4
      RETURNING *`,
      [id, label, value ?? null, notes ?? null]
    )
    res.json(rows[0])
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.delete('/assets/:id/bovs/:label', async (req, res) => {
  const { id, label } = req.params
  try {
    await gaPool.query('DELETE FROM ga_bovs WHERE asset_id=$1 AND label=$2', [id, label])
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ─────────────────────────────────────────────────────────────────
// NOTES
// ─────────────────────────────────────────────────────────────────

router.put('/assets/:id/notes', async (req, res) => {
  const { id } = req.params
  const { body } = req.body
  try {
    const { rows } = await gaPool.query(`
      INSERT INTO ga_notes (asset_id, body)
      VALUES ($1,$2)
      ON CONFLICT (asset_id) DO UPDATE SET body=$2, updated_at=now()
      RETURNING *`,
      [id, body ?? '']
    )
    res.json(rows[0])
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ─────────────────────────────────────────────────────────────────
// TENANCIES
// ─────────────────────────────────────────────────────────────────

router.post('/assets/:id/tenancies', async (req, res) => {
  const { id } = req.params
  const t = req.body
  try {
    const { rows } = await gaPool.query(`
      INSERT INTO ga_tenancies (asset_id, tenant_name, tenant_nif, lease_status, monthly_rent, contract_start, contract_end, document_link, notes)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [id, t.tenant_name??null, t.tenant_nif??null, t.lease_status??'ativo',
       t.monthly_rent??null, t.contract_start??null, t.contract_end??null,
       t.document_link??null, t.notes??null]
    )
    await syncIncome(id)
    res.status(201).json(rows[0])
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.patch('/tenancies/:tid', async (req, res) => {
  const { tid } = req.params
  const t = req.body
  try {
    const allowed = ['tenant_name','tenant_nif','lease_status','monthly_rent','contract_start','contract_end','document_link','notes']
    const keys = Object.keys(t).filter(k => allowed.includes(k))
    if (!keys.length) return res.status(400).json({ error: 'Nenhum campo valido' })
    const setClauses = keys.map((k, i) => `${k}=$${i + 1}`).join(', ')
    const { rows } = await gaPool.query(
      `UPDATE ga_tenancies SET ${setClauses} WHERE id=$${keys.length + 1} RETURNING *`,
      [...keys.map(k => t[k]), tid]
    )
    if (!rows[0]) return res.status(404).json({ error: 'Arrendamento nao encontrado' })
    await syncIncome(rows[0].asset_id)
    res.json(rows[0])
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.delete('/tenancies/:tid', async (req, res) => {
  try {
    const { rows } = await gaPool.query('DELETE FROM ga_tenancies WHERE id=$1 RETURNING *', [req.params.tid])
    if (!rows[0]) return res.status(404).json({ error: 'Arrendamento nao encontrado' })
    await syncIncome(rows[0].asset_id)
    res.json({ ok: true, deleted: rows[0] })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ─────────────────────────────────────────────────────────────────
// FILES
// ─────────────────────────────────────────────────────────────────

router.post('/assets/:id/files', async (req, res) => {
  const { id } = req.params
  const f = req.body
  try {
    const { rows } = await gaPool.query(`
      INSERT INTO ga_files (asset_id, category, title, resource_link, notes)
      VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [id, f.category??'other', f.title??null, f.resource_link??null, f.notes??null]
    )
    res.status(201).json(rows[0])
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.patch('/files/:fid', async (req, res) => {
  const { fid } = req.params
  const f = req.body
  try {
    const allowed = ['category','title','resource_link','notes']
    const keys = Object.keys(f).filter(k => allowed.includes(k))
    if (!keys.length) return res.status(400).json({ error: 'Nenhum campo valido' })
    const setClauses = keys.map((k, i) => `${k}=$${i + 1}`).join(', ')
    const { rows } = await gaPool.query(
      `UPDATE ga_files SET ${setClauses} WHERE id=$${keys.length + 1} RETURNING *`,
      [...keys.map(k => f[k]), fid]
    )
    if (!rows[0]) return res.status(404).json({ error: 'Ficheiro nao encontrado' })
    res.json(rows[0])
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.delete('/files/:fid', async (req, res) => {
  try {
    const { rows } = await gaPool.query('DELETE FROM ga_files WHERE id=$1 RETURNING *', [req.params.fid])
    if (!rows[0]) return res.status(404).json({ error: 'Ficheiro nao encontrado' })
    res.json({ ok: true, deleted: rows[0] })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ─────────────────────────────────────────────────────────────────
// Helper: sync income_current from active tenancies
// ─────────────────────────────────────────────────────────────────
async function syncIncome(assetId) {
  try {
    await gaPool.query(`
      UPDATE ga_assets SET income_current = (
        SELECT COALESCE(SUM(monthly_rent * 12), 0)
        FROM ga_tenancies
        WHERE asset_id=$1 AND lease_status='ativo' AND monthly_rent IS NOT NULL
      ), updated_at=now() WHERE id=$1`,
      [assetId]
    )
  } catch { /* non-critical */ }
}

module.exports = router
