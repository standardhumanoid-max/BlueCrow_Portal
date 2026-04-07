import type { Company, Valuation, Fund } from '../types/database'
import { FUNDS, CONVERTIBLE } from '../types/database'

// ── FORMATTERS ──
export function fmtE(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return '—'
  return '€' + Number(n).toLocaleString('pt-PT', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}
export function fmtP(n: number | null | undefined, dec = 1): string {
  if (n == null || isNaN(n)) return '—'
  return (n > 0 ? '+' : '') + Number(n).toFixed(dec) + '%'
}
export function fmtPAbs(n: number | null | undefined, dec = 2): string {
  if (n == null || isNaN(n)) return '—'
  return Number(n).toFixed(dec) + '%'
}
export function fmtX(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return '—'
  return Number(n).toFixed(2) + 'x'
}
export function fmtN(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return '—'
  return Number(n).toLocaleString('pt-PT')
}

// ── DATE HELPERS ──
function parseDate(s: string): Date | null {
  if (!s) return null
  s = s.trim()
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
    const [d, m, y] = s.split('/')
    const dt = new Date(+y, +m - 1, +d)
    return isNaN(dt.getTime()) ? null : dt
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const dt = new Date(s + 'T00:00:00')
    return isNaN(dt.getTime()) ? null : dt
  }
  return null
}

export function semOf(s: string): string {
  const dt = parseDate(s)
  if (!dt) return '—'
  return dt.getMonth() < 6 ? `${dt.getFullYear()}-H1` : `${dt.getFullYear()}-H2`
}

// ── CAP TABLE TIMELINE ──
function capTotalAt(c: Company, isoDate: string): number {
  const d = new Date(isoDate + 'T23:59:59')
  const events = (c.tranches || [])
    .filter(t =>
      t.totalSharesAtEvent &&
      t.date &&
      new Date(t.date) <= d &&
      (t.type === 'Equity' || t.type === 'Evento Cap Table' || t.fromConversion)
    )
    .sort((a, b) => new Date(b.date!).getTime() - new Date(a.date!).getTime())
  return events.length ? +(events[0].totalSharesAtEvent!) : +(c.totalShares || 0)
}

function grossFundSharesAt(c: Company, fund: string, isoDate: string): number {
  const d = new Date(isoDate + 'T23:59:59')
  return (c.tranches || [])
    .filter(t =>
      !t.converted &&
      t.type !== 'Evento Cap Table' &&
      !(CONVERTIBLE as readonly string[]).includes(t.type) &&
      t.fund === fund &&
      (t.shares || 0) > 0 &&
      t.date &&
      new Date(t.date) <= d
    )
    .reduce((s, t) => s + (+(t.shares || 0)), 0)
}

function soldSharesAt(c: Company, fund: string, isoDate: string): number {
  const d = new Date(isoDate + 'T23:59:59')
  return (c.sales || [])
    .filter(s => s?.fund === fund && s?.date && new Date(s.date) <= d)
    .reduce((sum, s) => sum + (+(s.shares || 0)), 0)
}

export function fundSharesAt(c: Company, fund: string, isoDate: string): number {
  return Math.max(0, grossFundSharesAt(c, fund, isoDate) - soldSharesAt(c, fund, isoDate))
}

export function computedFundShares(c: Company): Record<string, number> {
  const fs: Record<string, number> = {}
  for (const f of FUNDS) fs[f] = 0
  for (const t of c.tranches || []) {
    if (t.converted || t.type === 'Evento Cap Table') continue
    if (t.fund && (t.shares || 0) > 0) fs[t.fund] = (fs[t.fund] || 0) + +(t.shares || 0)
  }
  for (const f of FUNDS) {
    if (c.fundSharesOverride?.[f] != null) fs[f] = +c.fundSharesOverride[f]
  }
  for (const sale of c.sales || []) {
    if (!sale?.fund) continue
    fs[sale.fund] = Math.max(0, (fs[sale.fund] || 0) - +(sale.shares || 0))
  }
  return fs
}

// ── NAV CALCULATION (multi-class aware) ──
export function computeNAV(
  c: Company,
  fund: string | string[] | null,
  ev: number | null,
  totalDil: number,
  quasiDeduction = 0
): number | null {
  const selected = normalizeSelection(fund)
  const tl = (c.tranches || []).filter(t =>
    !t.converted &&
    t.type === 'Equity' &&
    (selected.length ? selected.includes(t.fund) : true)
  )

  const fixedNav = tl
    .filter(t => +(t.pricePerShare || 0) > 0 && +(t.shares || 0) > 0)
    .reduce((s, t) => s + +(t.pricePerShare!) * +(t.shares!), 0)

  if (ev == null) return fixedNav > 0 ? fixedNav : null

  // Deduct quasi-equity claims (SAFE, Prest. Suplementares) before distributing to ordinary equity
  const adjustedEV = Math.max(0, ev - quasiDeduction)
  const seriesBPool = (+(c.seriesBShares || 0)) * (+(c.seriesBPrice || 0))
  const ordinaryEV = adjustedEV - seriesBPool
  const ordinaryDil = Math.max(1, totalDil - (+(c.seriesBShares || 0)))

  let varOwnPct = 0, grossVar = 0
  for (const t of tl.filter(t => !(+(t.pricePerShare || 0) > 0))) {
    grossVar += +(t.shares || 0)
    if (t.ownershipOverride != null && t.ownershipOverride !== '') {
      varOwnPct += +(t.ownershipOverride)
    } else {
      varOwnPct += +(t.shares || 0) / ordinaryDil * 100
    }
  }

  if (grossVar > 0) {
    const today = new Date().toISOString().slice(0, 10)
    const currentVar = selected.length
      ? selected.reduce((s, f) => s + fundSharesAt(c, f, today), 0)
      : grossVar
    if (currentVar >= 0 && currentVar < grossVar) varOwnPct *= currentVar / grossVar
  }

  return fixedNav + ordinaryEV * (varOwnPct / 100)
}

export function computeOwnership(
  c: Company,
  fund: string | string[] | null,
  totalDil: number,
  isoDate?: string
): number {
  const selected = normalizeSelection(fund)
  const tl = (c.tranches || []).filter(t =>
    !t.converted &&
    t.type === 'Equity' &&
    (selected.length ? selected.includes(t.fund) : true)
  )
  let own = 0, grossShares = 0
  for (const t of tl) {
    grossShares += +(t.shares || 0)
    if (t.ownershipOverride != null && t.ownershipOverride !== '') {
      own += +(t.ownershipOverride)
    } else {
      own += totalDil > 0 ? (+(t.shares || 0) / totalDil) * 100 : 0
    }
  }
  const targetDate = isoDate || new Date().toISOString().slice(0, 10)
  const currentShares = selected.length
    ? selected.reduce((s, f) => s + fundSharesAt(c, f, targetDate), 0)
    : Object.values(computedFundShares(c)).reduce((s, v) => s + (+(v || 0)), 0)
  if (grossShares > 0 && currentShares >= 0 && currentShares < grossShares) {
    own *= currentShares / grossShares
  } else if (grossShares === 0 && selected.length > 0) {
    // Fallback when tranches have no shares set:
    // if there are sales with shares recorded and current = 0, treat as fully exited
    const totalSoldShares = selected.reduce((s, f) => s + soldSharesAt(c, f, targetDate), 0)
    if (totalSoldShares > 0 && currentShares === 0) own = 0
  }
  return own
}

function normalizeSelection(v: string | string[] | null | undefined): string[] {
  if (v == null || v === '') return []
  if (Array.isArray(v)) return [...new Set(v.filter(Boolean).map(String))]
  return [String(v)]
}

export function nonEquityInstrumentValues(
  c: Company,
  fund: string | string[] | null,
  valuation: Valuation | null,
) {
  const selected = normalizeSelection(fund)
  const assessmentById = new Map(
    (valuation?.debtAssessment || []).map((item) => [item.id, +(item.fairValue || 0)]),
  )

  return (c.tranches || [])
    .filter(
      (t) =>
        !t.converted &&
        t.type !== 'Equity' &&
        t.type !== 'Evento Cap Table' &&
        (selected.length ? selected.includes(t.fund) : true),
    )
    .map((t) => ({
      id: t.id,
      fund: t.fund,
      type: t.type,
      value: assessmentById.has(t.id)
        ? +(assessmentById.get(t.id) || 0)
        : +(t.amount || 0),
    }))
}

// ── LATEST VALUATION ──
export function latestVal(companyId: string, valuations: Valuation[]): Valuation | null {
  return valuations
    .filter(v => v.companyId === companyId)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0] || null
}

// ── XIRR ──
function xirr(cashflows: number[], dates: string[]): number | null {
  if (cashflows.length < 2) return null
  const dts = dates.map(d => new Date(d))
  const t0 = dts[0]
  const years = dts.map(d => (d.getTime() - t0.getTime()) / (365.25 * 24 * 3600 * 1000))
  let rate = 0.1
  for (let i = 0; i < 100; i++) {
    let npv = 0, dnpv = 0
    for (let j = 0; j < cashflows.length; j++) {
      const pv = cashflows[j] / Math.pow(1 + rate, years[j])
      npv += pv
      dnpv += -years[j] * cashflows[j] / Math.pow(1 + rate, years[j] + 1)
    }
    if (Math.abs(dnpv) < 1e-10) break
    const newRate = rate - npv / dnpv
    if (Math.abs(newRate - rate) < 1e-8) { rate = newRate; break }
    rate = newRate
    if (rate <= -1) return null
  }
  return (rate > -1 && rate < 50) ? rate * 100 : null
}

// ── METRICS ──
export function metrics(c: Company, valuations: Valuation[], ff?: string | string[] | null) {
  const selected = normalizeSelection(ff)
  const tl = c.tranches || []
  const tFil = (selected.length ? tl.filter(t => selected.includes(t.fund)) : tl).filter(t => !t.converted)
  const totInv = tFil.reduce((s, t) => s + (+(t.amount || 0)), 0)
  const eqInv = tFil.filter(t => t.type === 'Equity').reduce((s, t) => s + (+(t.amount || 0)), 0)
  const quasiInv = tFil.filter(t => (CONVERTIBLE as readonly string[]).includes(t.type)).reduce((s, t) => s + (+(t.amount || 0)), 0)
  const debtInv = tFil.filter(t => t.type === 'Mútuo').reduce((s, t) => s + (+(t.amount || 0)), 0)
  const realised = (c.sales || [])
    .filter(s => selected.length ? selected.includes(s.fund) : true)
    .reduce((sum, s) => sum + (+(s.amount || 0)), 0)
  const netInv = Math.max(totInv - realised, 0)
  const lv = latestVal(c.id, valuations)
  const ev = lv ? +lv.equityValue : null
  const todayISO = new Date().toISOString().slice(0, 10)
  const ts = capTotalAt(c, todayISO) || (+(c.totalShares || 0))
  const esop = +(c.esop || 0), od = +(c.otherDilutive || 0)
  const dil = ts + esop + od + (+(c.seriesBShares || 0))
  const own = computeOwnership(c, selected.length ? selected : null, dil)
  // quasiDeduction must use ALL sources (all funds + external) regardless of fund filter
  const allNonEquityValues = nonEquityInstrumentValues(c, null, lv)
  const trancheIds = new Set((c.tranches || []).map(t => t.id))
  const externalQuasi = (lv?.debtAssessment || [])
    .filter(item => !trancheIds.has(item.id) && (item.instrumentType === 'SAFE' || item.instrumentType === 'Prest. Suplementares'))
    .reduce((s, item) => s + +(item.fairValue || 0), 0)
  const quasiDeduction = allNonEquityValues.reduce((sum, item) => {
    return sum + (item.type === 'SAFE' || item.type === 'Prest. Suplementares' ? item.value : 0)
  }, 0) + externalQuasi
  // nonEquityNav only adds back the selected fund's own instruments
  const nonEquityValues = nonEquityInstrumentValues(c, selected.length ? selected : null, lv)
  const equityNav = computeNAV(c, selected.length ? selected : null, ev, dil, quasiDeduction)
  const nonEquityNav = nonEquityValues.reduce((sum, item) => sum + item.value, 0)
  const nav = equityNav != null || nonEquityNav > 0 ? (equityNav ?? 0) + nonEquityNav : null
  const _fs = computedFundShares(c)
  const fsh = selected.length
    ? selected.reduce((s, f) => s + (+((_fs as Record<string, number>)[f] || 0)), 0)
    : Object.values(_fs).reduce((s, v) => s + (+(v || 0)), 0)
  const moic = totInv > 0 && nav != null ? nav / totInv : null
  const re = eqInv > 0 && equityNav != null ? ((equityNav / eqInv) - 1) * 100 : null
  return { totInv, eqInv, quasiInv, debtInv, realised, netInv, ev, nav, equityNav, nonEquityNav, own, moic, re, dil, fsh, lv }
}

export function companyIRR(c: Company, valuations: Valuation[]): number | null {
  const nav = metrics(c, valuations).nav
  const cfs: { cf: number; date: string }[] = []
  for (const t of (c.tranches || []).filter(x =>
    !x.converted && x.date && (+(x.amount || 0)) > 0 &&
    (x.type === 'Equity' || x.fromConversion)
  )) {
    cfs.push({ cf: -(+(t.amount || 0)), date: t.date! })
  }
  for (const s of c.sales || []) {
    if (!s?.date || !(+(s.amount || 0) > 0)) continue
    cfs.push({ cf: +(s.amount), date: s.date })
  }
  if (nav && nav > 0) cfs.push({ cf: nav, date: new Date().toISOString().slice(0, 10) })
  if (cfs.length < 2) return null
  cfs.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  return xirr(cfs.map(x => x.cf), cfs.map(x => x.date))
}

export function hasActiveExposure(c: Company, funds?: string[] | null): boolean {
  const selected = normalizeSelection(funds)
  const today = new Date().toISOString().slice(0, 10)
  const fundsToCheck = selected.length ? selected : [...FUNDS]
  const hasShares = fundsToCheck.some(f => fundSharesAt(c, f, today) > 0)
  if (hasShares) return true
  return (c.tranches || []).some(t =>
    !t.converted &&
    t.type !== 'Evento Cap Table' &&
    (selected.length ? selected.includes(t.fund) : true) &&
    ((CONVERTIBLE as readonly string[]).includes(t.type) || t.type === 'Mútuo')
  )
}

type BadgeStyle = { background: string; color: string; border: string }

export function getFundBadgeStyle(fund: Fund | string): BadgeStyle {
  // BIF family → blue
  if (String(fund).startsWith('BIF')) {
    return { background: '#dbeafe', color: '#1e40af', border: '1px solid #bfdbfe' }
  }
  const map: Record<string, BadgeStyle> = {
    'Next Tech': { background: '#dcfce7', color: '#15803d', border: '1px solid #bbf7d0' },
    'Global G.': { background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a' },
    'Growth':    { background: '#f3e8ff', color: '#6d28d9', border: '1px solid #e9d5ff' },
  }
  return map[fund] ?? { background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0' }
}

export function getFundBadgeColor(fund: Fund | string): string {
  return getFundBadgeStyle(fund).color
}
