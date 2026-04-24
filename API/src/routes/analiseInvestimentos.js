const express = require('express')
const router  = express.Router()
const { compPool } = require('../db')
const { decrypt }  = require('../cryptoUtils')

let Anthropic = null
try {
  Anthropic = require('@anthropic-ai/sdk')
  if (Anthropic.default) Anthropic = Anthropic.default
} catch { /* SDK not installed */ }

const BALANCETE_SYSTEM = `És um especialista em análise financeira e contabilidade portuguesa (SNC — Sistema de Normalização Contabilística) e internacional (IFRS/GAAP).
O teu trabalho é analisar balancetes e extrair métricas financeiras com rigor.

Responde SEMPRE com JSON puro (sem markdown, sem blocos de código), seguindo exatamente esta estrutura:
{
  "meta": {
    "company_name": "nome da empresa se identificável, senão null",
    "period": "período ex: 2024-Q3 ou 2024-FY",
    "period_date": "YYYY-MM-DD — último dia do período",
    "currency": "EUR ou outra",
    "accounting_standard": "SNC, IFRS ou outro"
  },
  "pl": {
    "revenue": null,
    "cogs": null,
    "gross_profit": null,
    "fse": null,
    "staff_costs": null,
    "other_opex": null,
    "ebitda": null,
    "depreciation_amortization": null,
    "ebit": null,
    "financial_income": null,
    "financial_expenses": null,
    "financial_result": null,
    "ebt": null,
    "tax": null,
    "net_profit": null
  },
  "balance": {
    "total_assets": null,
    "fixed_assets": null,
    "intangible_assets": null,
    "current_assets": null,
    "inventory": null,
    "receivables": null,
    "other_current_assets": null,
    "cash": null,
    "equity": null,
    "share_capital": null,
    "retained_earnings": null,
    "total_liabilities": null,
    "lt_debt": null,
    "st_debt": null,
    "gross_debt": null,
    "payables": null,
    "other_current_liabilities": null,
    "net_debt": null
  },
  "operational": {
    "headcount": null,
    "arr": null,
    "mrr": null,
    "monthly_burn": null
  },
  "ratios": {
    "gross_margin_pct": null,
    "ebitda_margin_pct": null,
    "ebit_margin_pct": null,
    "net_margin_pct": null,
    "current_ratio": null,
    "quick_ratio": null,
    "cash_ratio": null,
    "debt_to_equity": null,
    "net_debt_ebitda": null,
    "interest_coverage": null,
    "roe_pct": null,
    "roa_pct": null,
    "roce_pct": null,
    "asset_turnover": null,
    "days_receivable": null,
    "days_payable": null,
    "days_inventory": null,
    "cash_conversion_cycle": null,
    "working_capital": null,
    "equity_ratio_pct": null,
    "debt_ratio_pct": null
  },
  "analysis": {
    "summary": "resumo executivo em 2-3 frases",
    "financial_health": "saudavel | atencao | critico",
    "strengths": ["ponto forte 1"],
    "risks": ["risco 1"],
    "key_observations": "análise detalhada dos principais indicadores",
    "red_flags": ["flag 1 se existir"]
  }
}
Todos os valores monetários em EUR (ou moeda do documento). Percentagens como número decimal (ex: 42.5 para 42.5%). Calcula os rácios derivados com base nos valores extraídos. Se um campo não for identificável no documento, coloca null.`

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}

// ── Companies ─────────────────────────────────────────────────────────────────
router.get('/companies', async (req, res) => {
  try {
    const { rows } = await compPool.query(`
      SELECT c.*, f.name AS fund_name, f.short_name AS fund_short_name
      FROM ai_companies c
      LEFT JOIN bc_funds f ON f.id = c.fund_id
      ORDER BY c.name
    `)
    res.json(rows)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.post('/companies', async (req, res) => {
  const {
    name, short_name, sector, company_type, country,
    fund_id, entry_date, entry_value, ownership_pct, instrument, status, website, notes,
  } = req.body
  if (!name?.trim()) return res.status(400).json({ error: 'name obrigatório' })
  try {
    const id = genId()
    await compPool.query(
      `INSERT INTO ai_companies
        (id, name, short_name, sector, company_type, country, fund_id, entry_date, entry_value, ownership_pct, instrument, status, website, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
      [id, name.trim(), short_name||null, sector||null, company_type||null, country||'Portugal',
       fund_id||null, entry_date||null, entry_value||null, ownership_pct||null,
       instrument||null, status||'active', website||null, notes||null]
    )
    const { rows } = await compPool.query(
      `SELECT c.*, f.name AS fund_name, f.short_name AS fund_short_name
       FROM ai_companies c LEFT JOIN bc_funds f ON f.id = c.fund_id WHERE c.id=$1`, [id]
    )
    res.json(rows[0])
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.put('/companies/:id', async (req, res) => {
  const allowed = ['name','short_name','sector','company_type','country','fund_id',
    'entry_date','entry_value','ownership_pct','instrument','status','website','notes']
  const updates = Object.entries(req.body).filter(([k]) => allowed.includes(k))
  if (!updates.length) return res.status(400).json({ error: 'Sem campos para atualizar' })
  const sets = updates.map(([k], i) => `${k}=$${i + 1}`)
  const vals = [...updates.map(([, v]) => v), req.params.id]
  try {
    await compPool.query(
      `UPDATE ai_companies SET ${sets.join(', ')}, updated_at=NOW() WHERE id=$${vals.length}`, vals
    )
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.delete('/companies/:id', async (req, res) => {
  try {
    await compPool.query('DELETE FROM ai_companies WHERE id=$1', [req.params.id])
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ── KPIs ──────────────────────────────────────────────────────────────────────
router.get('/companies/:id/kpis', async (req, res) => {
  try {
    const { rows } = await compPool.query(
      `SELECT * FROM ai_company_kpis WHERE company_id=$1
       ORDER BY COALESCE(period_date, '1970-01-01'), period`,
      [req.params.id]
    )
    res.json(rows)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.post('/companies/:id/kpis', async (req, res) => {
  const {
    period, period_date, revenue, gross_profit, ebitda, ebit, net_profit,
    total_assets, total_liabilities, equity, gross_debt, cash, net_debt,
    monthly_burn, arr, mrr, headcount, equity_value, notes,
  } = req.body
  if (!period?.trim()) return res.status(400).json({ error: 'period obrigatório' })
  try {
    const id = genId()
    await compPool.query(
      `INSERT INTO ai_company_kpis
        (id, company_id, period, period_date, revenue, gross_profit, ebitda, ebit, net_profit,
         total_assets, total_liabilities, equity, gross_debt, cash, net_debt,
         monthly_burn, arr, mrr, headcount, equity_value, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)`,
      [id, req.params.id, period.trim(), period_date||null,
       revenue??null, gross_profit??null, ebitda??null, ebit??null, net_profit??null,
       total_assets??null, total_liabilities??null, equity??null, gross_debt??null,
       cash??null, net_debt??null, monthly_burn??null, arr??null, mrr??null,
       headcount??null, equity_value??null, notes||null]
    )
    const { rows } = await compPool.query('SELECT * FROM ai_company_kpis WHERE id=$1', [id])
    res.json(rows[0])
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.put('/kpis/:id', async (req, res) => {
  const allowed = ['period','period_date','revenue','gross_profit','ebitda','ebit','net_profit',
    'total_assets','total_liabilities','equity','gross_debt','cash','net_debt',
    'monthly_burn','arr','mrr','headcount','equity_value','notes']
  const updates = Object.entries(req.body).filter(([k]) => allowed.includes(k))
  if (!updates.length) return res.status(400).json({ error: 'Sem campos para atualizar' })
  const sets = updates.map(([k], i) => `${k}=$${i + 1}`)
  const vals = [...updates.map(([, v]) => v), req.params.id]
  try {
    await compPool.query(
      `UPDATE ai_company_kpis SET ${sets.join(', ')} WHERE id=$${vals.length}`, vals
    )
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.delete('/kpis/:id', async (req, res) => {
  try {
    await compPool.query('DELETE FROM ai_company_kpis WHERE id=$1', [req.params.id])
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ── Balancete analysis ────────────────────────────────────────────────────────
router.post('/balancete', async (req, res) => {
  if (!Anthropic) return res.status(500).json({ error: 'SDK Anthropic não instalado no servidor' })

  const { fileBase64, fileMimeType, companyId, period: rawPeriod } = req.body
  if (!fileBase64) return res.status(400).json({ error: 'Ficheiro obrigatório' })
  // Sanitize period to prevent prompt injection — only allow alphanumeric, dash, space
  const period = typeof rawPeriod === 'string' ? rawPeriod.replace(/[^a-zA-Z0-9\-\s]/g, '').slice(0, 20) : ''

  try {
    const { rows } = await compPool.query('SELECT settings FROM portal_users WHERE id=$1', [req.user.id])
    const settings = rows[0]?.settings ?? {}
    if (!settings.apikey) return res.status(403).json({
      error: 'Chave API não configurada. Configure nas definições do perfil (ícone no hub).',
    })
    const apiKey = decrypt(settings.apikey)
    if (!apiKey) return res.status(500).json({ error: 'Erro ao desencriptar chave API' })

    let companyContext = ''
    if (companyId) {
      const { rows: comp } = await compPool.query('SELECT name, sector, company_type FROM ai_companies WHERE id=$1', [companyId])
      if (comp.length) companyContext = `\nContexto: empresa "${comp[0].name}"${comp[0].sector ? `, setor ${comp[0].sector}` : ''}.`
    }

    const client = new Anthropic({ apiKey })
    const response = await client.messages.create({
      model:      'claude-opus-4-7',
      max_tokens: 3000,
      system:     BALANCETE_SYSTEM + companyContext,
      messages: [{
        role: 'user',
        content: [
          {
            type:   'document',
            source: { type: 'base64', media_type: fileMimeType || 'application/pdf', data: fileBase64 },
          },
          {
            type: 'text',
            text: `Analisa este balancete${period ? ` (período: ${period})` : ''} e extrai todas as métricas. Retorna JSON puro sem markdown.`,
          },
        ],
      }],
    })

    const raw   = response.content.find(c => c.type === 'text')?.text ?? '{}'
    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) return res.status(500).json({ error: 'Resposta inválida do modelo' })

    let parsed
    try { parsed = JSON.parse(match[0]) }
    catch { return res.status(500).json({ error: 'Resposta do modelo não é JSON válido' }) }
    res.json(parsed)
  } catch (e) {
    if (e?.status === 401) return res.status(401).json({ error: 'Chave API inválida.' })
    res.status(500).json({ error: e.message })
  }
})

module.exports = router
