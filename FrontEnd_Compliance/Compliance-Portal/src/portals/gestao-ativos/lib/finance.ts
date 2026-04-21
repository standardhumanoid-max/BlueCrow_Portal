import type { Asset, Bov, Valuation } from './api'

// ── Cost basis ─────────────────────────────────────────────────────────────────

export function calcTotalCost(a: Asset): number {
  return (
    (a.purchase_price  ?? 0) +
    (a.stamp_duty      ?? 0) +
    (a.notary_fees     ?? 0) +
    (a.capex_current   ?? 0) +
    (a.opex_current    ?? 0)
  )
}

export function calcCapitalCost(a: Asset): number {
  if (a.capital_cost_v != null) return a.capital_cost_v
  return calcTotalCost(a) * ((a.capital_cost ?? 0) / 100)
}

// ── Break-even ────────────────────────────────────────────────────────────────

export function calcBreakEven(a: Asset): number {
  return calcTotalCost(a) + calcCapitalCost(a) - (a.income_current ?? 0)
}

export function calcBreakEvenCash(a: Asset): number {
  return calcTotalCost(a) + calcCapitalCost(a)
}

// ── Yield ─────────────────────────────────────────────────────────────────────

export function calcYieldOnCost(a: Asset): number {
  const cost = calcTotalCost(a)
  if (!cost) return 0
  return (a.income_current ?? 0) / cost
}

// ── Asking / sale analysis ────────────────────────────────────────────────────

/**
 * Theoretical asking price: breakEven / (1 - commercialization% - transaction_fee%)
 */
export function calcAskingBCC(a: Asset): number {
  const divisor = 1 - (a.commercialization ?? 0) / 100 - (a.transaction_fee ?? 0) / 100
  if (divisor <= 0) return 0
  return calcBreakEven(a) / divisor
}

/** Effective asking price (override if set, else theoretical) */
export function calcEffectiveAsking(a: Asset): number {
  return a.asking_price ?? calcAskingBCC(a)
}

/** Transaction fee on bidding offer */
export function calcTransactionFee(a: Asset): number {
  return (a.bidding_offer ?? 0) * ((a.transaction_fee ?? 0) / 100)
}

/** BlueCrow gross: offer minus total cost */
export function calcBluecrowGross(a: Asset): number {
  return (a.bidding_offer ?? 0) - calcTotalCost(a)
}

/** BlueCrow net: gross minus transaction fee */
export function calcBluecrowNet(a: Asset): number {
  return calcBluecrowGross(a) - calcTransactionFee(a)
}

/** Delta of offer vs asking price */
export function calcDeltaVsAsking(a: Asset): number {
  return (a.bidding_offer ?? 0) - calcEffectiveAsking(a)
}

/** Delta of offer vs most recent BOV */
export function calcDeltaVsBov(a: Asset, bovs: Bov[]): number {
  if (!bovs.length) return 0
  const sorted = [...bovs].sort((x, y) => new Date(y.created_at).getTime() - new Date(x.created_at).getTime())
  const latest = sorted[0].value ?? 0
  return (a.bidding_offer ?? 0) - latest
}

/** Latest valuation value */
export function latestValuation(valuations: Valuation[]): number | null {
  if (!valuations.length) return null
  const sorted = [...valuations].sort((a, b) => b.year.localeCompare(a.year))
  return sorted[0].value ?? null
}

// ── Formatters ────────────────────────────────────────────────────────────────

export function fmtEur(n: number | null | undefined, compact = false): string {
  if (n == null) return '—'
  if (compact && Math.abs(n) >= 1_000_000) {
    return `€${(n / 1_000_000).toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}M`
  }
  if (compact && Math.abs(n) >= 1_000) {
    return `€${(n / 1_000).toLocaleString('pt-PT', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}k`
  }
  return `€${n.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function fmtPct(n: number | null | undefined, decimals = 1): string {
  if (n == null) return '—'
  return `${(n * 100).toFixed(decimals)}%`
}

export function fmtPctRaw(n: number | null | undefined, decimals = 1): string {
  if (n == null) return '—'
  return `${n.toFixed(decimals)}%`
}
