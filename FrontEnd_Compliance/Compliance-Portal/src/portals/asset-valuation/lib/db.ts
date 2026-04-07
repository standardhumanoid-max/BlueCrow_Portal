import type { AppDatabase, Fund, FundData } from '../types/database'
import { FUNDS } from '../types/database'

const API = 'http://localhost:3001/api/av/state'

function emptyDb(): AppDatabase {
  const funds: Partial<Record<Fund, FundData>> = {}
  for (const f of FUNDS) funds[f] = { subscrito: 0, adjustments: [] }
  return { companies: [], valuations: [], funds }
}

function ensureDbShape(data: unknown): AppDatabase {
  const safe = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>
  const db = emptyDb()
  if (Array.isArray(safe.companies)) db.companies = safe.companies
  if (Array.isArray(safe.valuations)) db.valuations = safe.valuations
  if (safe.funds && typeof safe.funds === 'object') {
    const f = safe.funds as Record<string, unknown>
    for (const fund of FUNDS) {
      const fd = f[fund] as Record<string, unknown> | undefined
      db.funds[fund] = {
        subscrito: Number(fd?.subscrito) || 0,
        adjustments: Array.isArray(fd?.adjustments) ? fd.adjustments : [],
      }
    }
  }
  for (const c of db.companies) {
    if (!c.log) c.log = []
    if (!c.sales) c.sales = []
    if (!c.tranches) c.tranches = []
    if (!c.pipeline) c.pipeline = { currentStage: '', dates: {}, notes: '' }
  }
  return db
}

export async function loadDb(): Promise<AppDatabase> {
  const res = await fetch(API)
  if (!res.ok) throw new Error(`Erro ao carregar dados: ${res.status}`)
  const data = await res.json()
  return ensureDbShape(data)
}

export async function saveDb(db: AppDatabase, userEmail?: string): Promise<void> {
  const res = await fetch(API, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ payload: db, userEmail }),
  })
  if (!res.ok) throw new Error(`Erro ao guardar dados: ${res.status}`)
}
