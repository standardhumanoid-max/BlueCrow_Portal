const express = require('express')
const router  = express.Router()
const { avPool } = require('../db')

// ── Helpers ───────────────────────────────────────────────────────────────────
function n(v) { return v == null ? null : Number(v) }
function b(v) { return v == null ? false : Boolean(v) }
function s(v) { return v == null ? undefined : String(v) }

// ── GET /api/av/state ─────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const [
      compRows, trancheRows, saleRows, financialRows,
      capRows, runwayRows, pipelineRows, docRows, logRows,
      valRows, debtRows, fundRows,
    ] = await Promise.all([
      avPool.query('SELECT * FROM av_companies ORDER BY name ASC'),
      avPool.query('SELECT * FROM av_tranches'),
      avPool.query('SELECT * FROM av_sales'),
      avPool.query('SELECT * FROM av_financials'),
      avPool.query('SELECT * FROM av_cap_table'),
      avPool.query('SELECT * FROM av_runway'),
      avPool.query('SELECT * FROM av_pipeline'),
      avPool.query('SELECT * FROM av_documents'),
      avPool.query('SELECT * FROM av_log'),
      avPool.query('SELECT * FROM av_valuations ORDER BY date DESC'),
      avPool.query('SELECT * FROM av_debt_assessment'),
      avPool.query('SELECT * FROM av_funds'),
    ])

    // ── Build company map ──────────────────────────────────────────────────────
    const compMap = {}
    for (const c of compRows.rows) {
      compMap[c.id] = {
        id: c.id, name: c.name,
        companyType:          s(c.company_type),
        sector:               s(c.sector),
        country:              s(c.country),
        website:              s(c.website),
        balanceteUrl:         s(c.balancete_url),
        summary:              s(c.summary),
        totalShares:          n(c.total_shares),
        esop:                 n(c.esop),
        otherDilutive:        n(c.other_dilutive),
        seriesBShares:        n(c.series_b_shares),
        seriesBPrice:         n(c.series_b_price),
        priority:             s(c.priority),
        scoreFinancial:       n(c.score_financial),
        scoreLiquidity:       n(c.score_liquidity),
        scoreStrategic:       n(c.score_strategic),
        fundShares:           c.fund_shares ?? undefined,
        fundSharesOverride:   c.fund_shares_override ?? undefined,
        tranches: [], sales: [], financials: [],
        capTable: [], log: [], documents: [],
        runway: {}, pipeline: {},
      }
    }

    for (const t of trancheRows.rows) {
      if (!compMap[t.company_id]) continue
      compMap[t.company_id].tranches.push({
        id: t.id, fund: t.fund, type: t.type,
        amount:             n(t.amount) ?? 0,
        shares:             n(t.shares),
        pricePerShare:      n(t.price_per_share),
        date:               s(t.date),
        converted:          b(t.converted),
        fromConversion:     b(t.from_conversion),
        totalSharesAtEvent: n(t.total_shares_at_event),
        ownershipOverride:  n(t.ownership_override),
      })
    }

    for (const s_ of saleRows.rows) {
      if (!compMap[s_.company_id]) continue
      compMap[s_.company_id].sales.push({
        id: s_.id, fund: s_.fund,
        amount: n(s_.amount) ?? 0,
        shares: n(s_.shares),
        date:   s(s_.date),
      })
    }

    for (const f of financialRows.rows) {
      if (!compMap[f.company_id]) continue
      compMap[f.company_id].financials.push({
        id: f.id, year: Number(f.year),
        revenue:           n(f.revenue),
        equity:            n(f.equity),
        totalAssets:       n(f.total_assets),
        totalLiabilities:  n(f.total_liabilities),
        netProfit:         n(f.net_profit),
      })
    }

    for (const c of capRows.rows) {
      if (!compMap[c.company_id]) continue
      compMap[c.company_id].capTable.push({
        id: c.id, name: c.name, type: c.type,
        shares: n(c.shares), pct: n(c.pct),
        round: s(c.round), notes: s(c.notes),
      })
    }

    for (const r of runwayRows.rows) {
      if (!compMap[r.company_id]) continue
      compMap[r.company_id].runway = {
        cashBalance:  n(r.cash_balance),
        monthlyBurn:  n(r.monthly_burn),
        lastUpdated:  s(r.last_updated),
        notes:        s(r.notes),
      }
    }

    for (const p of pipelineRows.rows) {
      if (!compMap[p.company_id]) continue
      compMap[p.company_id].pipeline = {
        currentStage: s(p.current_stage),
        dates:        p.dates ?? {},
        notes:        s(p.notes),
        history:      p.history ?? [],
      }
    }

    for (const d of docRows.rows) {
      if (!compMap[d.company_id]) continue
      compMap[d.company_id].documents.push({ id: d.id, title: d.title, url: s(d.url) })
    }

    for (const l of logRows.rows) {
      if (!compMap[l.company_id]) continue
      compMap[l.company_id].log.push({ id: l.id, date: l.date, text: l.text })
    }

    // ── Build valuations ───────────────────────────────────────────────────────
    const debtMap = {}
    for (const d of debtRows.rows) {
      if (!debtMap[d.valuation_id]) debtMap[d.valuation_id] = []
      debtMap[d.valuation_id].push({
        id: d.id, label: d.label,
        instrumentType: s(d.instrument_type),
        nominalValue:   n(d.nominal_value) ?? 0,
        fairValue:      n(d.fair_value) ?? 0,
        rate: n(d.rate), kd: n(d.kd), notes: s(d.notes),
      })
    }

    const valuations = valRows.rows.map(v => ({
      id: v.id, companyId: v.company_id,
      date: v.date, equityValue: n(v.equity_value) ?? 0,
      method: s(v.method),
      wacc: n(v.wacc), beta: n(v.beta), ke: n(v.ke), kd: n(v.kd),
      notes: s(v.notes), bpPath: s(v.bp_path),
      bpAssumptions: {
        revenueCagr:    n(v.bp_revenue_cagr),
        ebitdaMarginTY: n(v.bp_ebitda_margin_ty),
        ebitMarginTY:   n(v.bp_ebit_margin_ty),
        capexRevenueTY: n(v.bp_capex_revenue_ty),
        nwcRevenueTY:   n(v.bp_nwc_revenue_ty),
        explicitYears:  n(v.bp_explicit_years),
        notes:          s(v.bp_notes),
      },
      debtAssessment: debtMap[v.id] ?? [],
    }))

    // ── Build funds ────────────────────────────────────────────────────────────
    const funds = {}
    for (const f of fundRows.rows) {
      funds[f.fund] = { subscrito: n(f.subscrito) ?? 0, adjustments: f.adjustments ?? [] }
    }

    res.json({ companies: Object.values(compMap), valuations, funds })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ── PUT /api/av/state ─────────────────────────────────────────────────────────
router.put('/', async (req, res) => {
  const { payload } = req.body
  if (!payload) return res.status(400).json({ error: 'payload obrigatório' })

  const { companies = [], valuations = [], funds = {} } = payload
  const client = await avPool.connect()

  try {
    await client.query('BEGIN')

    // ── Companies ──────────────────────────────────────────────────────────────
    const incomingCompanyIds = companies.map(c => c.id)

    // Delete companies no longer present (cascade deletes related records)
    if (incomingCompanyIds.length > 0) {
      await client.query(
        'DELETE FROM av_companies WHERE id != ALL($1::text[])',
        [incomingCompanyIds]
      )
    } else {
      await client.query('DELETE FROM av_companies')
    }

    for (const c of companies) {
      await client.query(
        `INSERT INTO av_companies
           (id, name, company_type, sector, country, website, balancete_url, summary,
            total_shares, esop, other_dilutive, series_b_shares, series_b_price,
            priority, score_financial, score_liquidity, score_strategic,
            fund_shares, fund_shares_override, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,NOW())
         ON CONFLICT (id) DO UPDATE SET
           name=$2, company_type=$3, sector=$4, country=$5, website=$6,
           balancete_url=$7, summary=$8, total_shares=$9, esop=$10,
           other_dilutive=$11, series_b_shares=$12, series_b_price=$13,
           priority=$14, score_financial=$15, score_liquidity=$16, score_strategic=$17,
           fund_shares=$18, fund_shares_override=$19, updated_at=NOW()`,
        [
          c.id, c.name ?? '',
          c.companyType ?? null, c.sector ?? null, c.country ?? null,
          c.website ?? null, c.balanceteUrl ?? null, c.summary ?? null,
          c.totalShares ?? null, c.esop ?? null, c.otherDilutive ?? null,
          c.seriesBShares ?? null, c.seriesBPrice ?? null,
          c.priority ?? null,
          c.scoreFinancial ?? null, c.scoreLiquidity ?? null, c.scoreStrategic ?? null,
          c.fundShares ? JSON.stringify(c.fundShares) : null,
          c.fundSharesOverride ? JSON.stringify(c.fundSharesOverride) : null,
        ]
      )

      // Replace child records (delete + insert)
      await client.query('DELETE FROM av_tranches WHERE company_id=$1', [c.id])
      for (const t of c.tranches ?? []) {
        await client.query(
          `INSERT INTO av_tranches (id,company_id,fund,type,amount,shares,price_per_share,date,converted,from_conversion,total_shares_at_event,ownership_override)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
          [t.id, c.id, t.fund, t.type, t.amount ?? 0, t.shares ?? null,
           t.pricePerShare ?? null, t.date ?? null, t.converted ?? false,
           t.fromConversion ?? false, t.totalSharesAtEvent ?? null,
           typeof t.ownershipOverride === 'number' ? t.ownershipOverride : null]
        )
      }

      await client.query('DELETE FROM av_sales WHERE company_id=$1', [c.id])
      for (const s_ of c.sales ?? []) {
        await client.query(
          `INSERT INTO av_sales (id,company_id,fund,amount,shares,date) VALUES ($1,$2,$3,$4,$5,$6)`,
          [s_.id, c.id, s_.fund, s_.amount ?? 0, s_.shares ?? null, s_.date ?? null]
        )
      }

      await client.query('DELETE FROM av_financials WHERE company_id=$1', [c.id])
      for (const f of c.financials ?? []) {
        await client.query(
          `INSERT INTO av_financials (id,company_id,year,revenue,equity,total_assets,total_liabilities,net_profit)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [f.id, c.id, f.year, f.revenue ?? null, f.equity ?? null,
           f.totalAssets ?? null, f.totalLiabilities ?? null, f.netProfit ?? null]
        )
      }

      await client.query('DELETE FROM av_cap_table WHERE company_id=$1', [c.id])
      for (const ct of c.capTable ?? []) {
        await client.query(
          `INSERT INTO av_cap_table (id,company_id,name,type,shares,pct,round,notes)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [ct.id, c.id, ct.name ?? '', ct.type ?? 'Other',
           ct.shares ?? null, ct.pct ?? null, ct.round ?? null, ct.notes ?? null]
        )
      }

      // Runway (1:1)
      const rw = c.runway ?? {}
      await client.query(
        `INSERT INTO av_runway (company_id,cash_balance,monthly_burn,last_updated,notes)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (company_id) DO UPDATE SET
           cash_balance=$2,monthly_burn=$3,last_updated=$4,notes=$5`,
        [c.id, rw.cashBalance ?? null, rw.monthlyBurn ?? null,
         rw.lastUpdated ?? null, rw.notes ?? null]
      )

      // Pipeline (1:1)
      const pp = c.pipeline ?? {}
      await client.query(
        `INSERT INTO av_pipeline (company_id,current_stage,dates,notes,history)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (company_id) DO UPDATE SET
           current_stage=$2,dates=$3,notes=$4,history=$5`,
        [c.id, pp.currentStage ?? null,
         JSON.stringify(pp.dates ?? {}), pp.notes ?? null,
         JSON.stringify(pp.history ?? [])]
      )

      await client.query('DELETE FROM av_documents WHERE company_id=$1', [c.id])
      for (const d of c.documents ?? []) {
        await client.query(
          `INSERT INTO av_documents (id,company_id,title,url) VALUES ($1,$2,$3,$4)`,
          [d.id, c.id, d.title ?? '', d.url ?? null]
        )
      }

      await client.query('DELETE FROM av_log WHERE company_id=$1', [c.id])
      for (const l of c.log ?? []) {
        await client.query(
          `INSERT INTO av_log (id,company_id,date,text) VALUES ($1,$2,$3,$4)`,
          [l.id, c.id, l.date, l.text ?? '']
        )
      }
    }

    // ── Valuations ─────────────────────────────────────────────────────────────
    const incomingValIds = valuations.map(v => v.id)
    if (incomingValIds.length > 0) {
      await client.query(
        'DELETE FROM av_valuations WHERE id != ALL($1::text[])',
        [incomingValIds]
      )
    } else {
      await client.query('DELETE FROM av_valuations')
    }

    for (const v of valuations) {
      const bp = v.bpAssumptions ?? {}
      await client.query(
        `INSERT INTO av_valuations
           (id,company_id,date,equity_value,method,wacc,beta,ke,kd,notes,bp_path,
            bp_revenue_cagr,bp_ebitda_margin_ty,bp_ebit_margin_ty,
            bp_capex_revenue_ty,bp_nwc_revenue_ty,bp_explicit_years,bp_notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
         ON CONFLICT (id) DO UPDATE SET
           company_id=$2,date=$3,equity_value=$4,method=$5,wacc=$6,beta=$7,
           ke=$8,kd=$9,notes=$10,bp_path=$11,bp_revenue_cagr=$12,
           bp_ebitda_margin_ty=$13,bp_ebit_margin_ty=$14,bp_capex_revenue_ty=$15,
           bp_nwc_revenue_ty=$16,bp_explicit_years=$17,bp_notes=$18`,
        [v.id, v.companyId, v.date, v.equityValue ?? 0,
         v.method ?? null, v.wacc ?? null, v.beta ?? null,
         v.ke ?? null, v.kd ?? null, v.notes ?? null, v.bpPath ?? null,
         bp.revenueCagr ?? null, bp.ebitdaMarginTY ?? null, bp.ebitMarginTY ?? null,
         bp.capexRevenueTY ?? null, bp.nwcRevenueTY ?? null,
         bp.explicitYears ?? null, bp.notes ?? null]
      )

      await client.query('DELETE FROM av_debt_assessment WHERE valuation_id=$1', [v.id])
      for (const d of v.debtAssessment ?? []) {
        await client.query(
          `INSERT INTO av_debt_assessment (id,valuation_id,label,instrument_type,nominal_value,fair_value,rate,kd,notes)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [d.id, v.id, d.label ?? '', d.instrumentType ?? null,
           d.nominalValue ?? 0, d.fairValue ?? 0,
           d.rate ?? null, d.kd ?? null, d.notes ?? null]
        )
      }
    }

    // ── Funds ──────────────────────────────────────────────────────────────────
    for (const [fund, data] of Object.entries(funds)) {
      await client.query(
        `INSERT INTO av_funds (fund,subscrito,adjustments)
         VALUES ($1,$2,$3)
         ON CONFLICT (fund) DO UPDATE SET subscrito=$2,adjustments=$3`,
        [fund, data.subscrito ?? 0, JSON.stringify(data.adjustments ?? [])]
      )
    }

    await client.query('COMMIT')
    res.json({ ok: true })
  } catch (e) {
    await client.query('ROLLBACK')
    res.status(500).json({ error: e.message })
  } finally {
    client.release()
  }
})

module.exports = router
