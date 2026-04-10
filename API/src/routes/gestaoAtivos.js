const express = require('express')
const router  = express.Router()
const { gaPool } = require('../db')

// ── Helper ────────────────────────────────────────────────────────────────────
async function notFound(res, id) {
  res.status(404).json({ error: `Ativo ${id} não encontrado` })
}

// ─────────────────────────────────────────────────────────────────────────────
// ASSETS
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/ga/assets
router.get('/assets', async (req, res) => {
  try {
    const { rows } = await gaPool.query(
      'SELECT * FROM assets ORDER BY created_at DESC'
    )
    res.json(rows)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// GET /api/ga/assets/:id  (com valuations, bovs, notes, tenancies, files)
router.get('/assets/:id', async (req, res) => {
  const { id } = req.params
  try {
    const [asset, valuations, bovs, notes, tenancies, files] = await Promise.all([
      gaPool.query('SELECT * FROM assets WHERE id=$1', [id]),
      gaPool.query('SELECT * FROM valuations WHERE asset_id=$1 ORDER BY year ASC', [id]),
      gaPool.query('SELECT * FROM bovs WHERE asset_id=$1 ORDER BY label ASC', [id]),
      gaPool.query('SELECT * FROM notes WHERE asset_id=$1', [id]),
      gaPool.query('SELECT * FROM tenancies WHERE asset_id=$1 ORDER BY created_at ASC', [id]),
      gaPool.query('SELECT * FROM asset_files WHERE asset_id=$1 ORDER BY created_at ASC', [id]),
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
    const { rows } = await gaPool.query(`
      INSERT INTO assets (
        name, spv, sector, location, typology, land_area, build_area,
        tenant, acquisition_date, deed_type, maps_link, general_notes,
        purchase_price, stamp_duty, notary_fees, imt_paid, imt_due, imi_paid, imi_due,
        capex_prev, capex_current, opex_prev, opex_current,
        capital_cost_rate, capital_cost_value, capital_cost_override,
        income_prev, income_current,
        bidding_offer, transaction_fee_pct, commercialization_margin, asking_price_final,
        status
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,
        $13,$14,$15,$16,$17,$18,$19,
        $20,$21,$22,$23,
        $24,$25,$26,
        $27,$28,
        $29,$30,$31,$32,$33
      ) RETURNING *`,
      [
        f.name, f.spv??null, f.sector??null, f.location??null, f.typology??null,
        f.land_area??null, f.build_area??null, f.tenant??null,
        f.acquisition_date??null, f.deed_type??null, f.maps_link??null, f.general_notes??null,
        f.purchase_price??0, f.stamp_duty??0, f.notary_fees??0,
        f.imt_paid??0, f.imt_due??0, f.imi_paid??0, f.imi_due??0,
        f.capex_prev??0, f.capex_current??0, f.opex_prev??0, f.opex_current??0,
        f.capital_cost_rate??6.5, f.capital_cost_value??null, f.capital_cost_override??false,
        f.income_prev??0, f.income_current??0,
        f.bidding_offer??null, f.transaction_fee_pct??5, f.commercialization_margin??15,
        f.asking_price_final??null, f.status??'sem_rendimento',
      ]
    )
    res.status(201).json(rows[0])
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// PATCH /api/ga/assets/:id  (update)
router.patch('/assets/:id', async (req, res) => {
  const { id } = req.params
  const fields = req.body
  if (!Object.keys(fields).length) return res.status(400).json({ error: 'Nenhum campo enviado' })
  try {
    const allowed = [
      'name','spv','sector','location','typology','land_area','build_area',
      'tenant','acquisition_date','deed_type','maps_link','general_notes',
      'purchase_price','stamp_duty','notary_fees','imt_paid','imt_due','imi_paid','imi_due',
      'capex_prev','capex_current','opex_prev','opex_current',
      'capital_cost_rate','capital_cost_value','capital_cost_override',
      'income_prev','income_current',
      'bidding_offer','transaction_fee_pct','commercialization_margin','asking_price_final','status',
    ]
    const keys = Object.keys(fields).filter(k => allowed.includes(k))
    if (!keys.length) return res.status(400).json({ error: 'Nenhum campo valido' })
    const setClauses = keys.map((k, i) => `${k}=$${i + 1}`).join(', ')
    const vals = keys.map(k => fields[k])
    const { rows } = await gaPool.query(
      `UPDATE assets SET ${setClauses} WHERE id=$${keys.length + 1} RETURNING *`,
      [...vals, id]
    )
    if (!rows[0]) return notFound(res, id)
    res.json(rows[0])
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// DELETE /api/ga/assets/:id
router.delete('/assets/:id', async (req, res) => {
  try {
    const { rows } = await gaPool.query('DELETE FROM assets WHERE id=$1 RETURNING *', [req.params.id])
    if (!rows[0]) return notFound(res, req.params.id)
    res.json({ ok: true, deleted: rows[0] })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ─────────────────────────────────────────────────────────────────────────────
// VALUATIONS
// ─────────────────────────────────────────────────────────────────────────────

// PUT /api/ga/assets/:id/valuations/:year
router.put('/assets/:id/valuations/:year', async (req, res) => {
  const { id, year } = req.params
  const { value } = req.body
  try {
    const { rows } = await gaPool.query(`
      INSERT INTO valuations (asset_id, year, value)
      VALUES ($1, $2, $3)
      ON CONFLICT (asset_id, year) DO UPDATE SET value=$3
      RETURNING *`,
      [id, year, value]
    )
    res.json(rows[0])
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// DELETE /api/ga/assets/:id/valuations/:year
router.delete('/assets/:id/valuations/:year', async (req, res) => {
  const { id, year } = req.params
  try {
    await gaPool.query('DELETE FROM valuations WHERE asset_id=$1 AND year=$2', [id, year])
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ─────────────────────────────────────────────────────────────────────────────
// BOVS
// ─────────────────────────────────────────────────────────────────────────────

// PUT /api/ga/assets/:id/bovs/:label
router.put('/assets/:id/bovs/:label', async (req, res) => {
  const { id, label } = req.params
  const { value, notes } = req.body
  try {
    const { rows } = await gaPool.query(`
      INSERT INTO bovs (asset_id, label, value, notes)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (asset_id, label) DO UPDATE SET value=$3, notes=$4
      RETURNING *`,
      [id, label, value ?? null, notes ?? null]
    )
    res.json(rows[0])
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// DELETE /api/ga/assets/:id/bovs/:label
router.delete('/assets/:id/bovs/:label', async (req, res) => {
  const { id, label } = req.params
  try {
    await gaPool.query('DELETE FROM bovs WHERE asset_id=$1 AND label=$2', [id, label])
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ─────────────────────────────────────────────────────────────────────────────
// NOTES
// ─────────────────────────────────────────────────────────────────────────────

// PUT /api/ga/assets/:id/notes
router.put('/assets/:id/notes', async (req, res) => {
  const { id } = req.params
  const { body } = req.body
  try {
    const { rows } = await gaPool.query(`
      INSERT INTO notes (asset_id, body)
      VALUES ($1, $2)
      ON CONFLICT (asset_id) DO UPDATE SET body=$2, updated_at=now()
      RETURNING *`,
      [id, body ?? '']
    )
    res.json(rows[0])
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ─────────────────────────────────────────────────────────────────────────────
// TENANCIES
// ─────────────────────────────────────────────────────────────────────────────

// POST /api/ga/assets/:id/tenancies
router.post('/assets/:id/tenancies', async (req, res) => {
  const { id } = req.params
  const t = req.body
  try {
    const { rows } = await gaPool.query(`
      INSERT INTO tenancies (asset_id, tenant_name, tenant_nif, lease_status, monthly_rent, contract_start, contract_end, document_link, notes)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [id, t.tenant_name??null, t.tenant_nif??null, t.lease_status??'ativo',
       t.monthly_rent??null, t.contract_start??null, t.contract_end??null,
       t.document_link??null, t.notes??null]
    )
    // Sincronizar income_current com soma de contratos ativos
    await syncIncome(id)
    res.status(201).json(rows[0])
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// PATCH /api/ga/tenancies/:tid
router.patch('/tenancies/:tid', async (req, res) => {
  const { tid } = req.params
  const t = req.body
  try {
    const allowed = ['tenant_name','tenant_nif','lease_status','monthly_rent','contract_start','contract_end','document_link','notes']
    const keys = Object.keys(t).filter(k => allowed.includes(k))
    if (!keys.length) return res.status(400).json({ error: 'Nenhum campo valido' })
    const setClauses = keys.map((k, i) => `${k}=$${i + 1}`).join(', ')
    const { rows } = await gaPool.query(
      `UPDATE tenancies SET ${setClauses} WHERE id=$${keys.length + 1} RETURNING *`,
      [...keys.map(k => t[k]), tid]
    )
    if (!rows[0]) return res.status(404).json({ error: 'Arrendamento nao encontrado' })
    await syncIncome(rows[0].asset_id)
    res.json(rows[0])
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// DELETE /api/ga/tenancies/:tid
router.delete('/tenancies/:tid', async (req, res) => {
  try {
    const { rows } = await gaPool.query('DELETE FROM tenancies WHERE id=$1 RETURNING *', [req.params.tid])
    if (!rows[0]) return res.status(404).json({ error: 'Arrendamento nao encontrado' })
    await syncIncome(rows[0].asset_id)
    res.json({ ok: true, deleted: rows[0] })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ─────────────────────────────────────────────────────────────────────────────
// ASSET FILES
// ─────────────────────────────────────────────────────────────────────────────

// POST /api/ga/assets/:id/files
router.post('/assets/:id/files', async (req, res) => {
  const { id } = req.params
  const f = req.body
  try {
    const { rows } = await gaPool.query(`
      INSERT INTO asset_files (asset_id, category, title, resource_link, notes)
      VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [id, f.category??'other', f.title??null, f.resource_link??null, f.notes??null]
    )
    res.status(201).json(rows[0])
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// PATCH /api/ga/files/:fid
router.patch('/files/:fid', async (req, res) => {
  const { fid } = req.params
  const f = req.body
  try {
    const allowed = ['category','title','resource_link','notes']
    const keys = Object.keys(f).filter(k => allowed.includes(k))
    if (!keys.length) return res.status(400).json({ error: 'Nenhum campo valido' })
    const setClauses = keys.map((k, i) => `${k}=$${i + 1}`).join(', ')
    const { rows } = await gaPool.query(
      `UPDATE asset_files SET ${setClauses} WHERE id=$${keys.length + 1} RETURNING *`,
      [...keys.map(k => f[k]), fid]
    )
    if (!rows[0]) return res.status(404).json({ error: 'Ficheiro nao encontrado' })
    res.json(rows[0])
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// DELETE /api/ga/files/:fid
router.delete('/files/:fid', async (req, res) => {
  try {
    const { rows } = await gaPool.query('DELETE FROM asset_files WHERE id=$1 RETURNING *', [req.params.fid])
    if (!rows[0]) return res.status(404).json({ error: 'Ficheiro nao encontrado' })
    res.json({ ok: true, deleted: rows[0] })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ─────────────────────────────────────────────────────────────────────────────
// Helper: sincronizar income_current com soma de rendas ativas
// ─────────────────────────────────────────────────────────────────────────────
async function syncIncome(assetId) {
  try {
    await gaPool.query(`
      UPDATE assets SET income_current = (
        SELECT COALESCE(SUM(monthly_rent * 12), 0)
        FROM tenancies
        WHERE asset_id = $1 AND lease_status = 'ativo' AND monthly_rent IS NOT NULL
      ) WHERE id = $1`,
      [assetId]
    )
  } catch { /* non-critical */ }
}

module.exports = router
