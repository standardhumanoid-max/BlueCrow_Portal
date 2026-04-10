/**
 * supabaseStore.ts — substituído por chamadas à API local (Express + PostgreSQL)
 * Interface mantida igual para não quebrar o store existente.
 */

import { API_BASE, authFetch } from '@/lib/api'
import { useUndoStore } from '@/store/useUndoStore'
const API = `${API_BASE}/api/comp`
const fetch = authFetch

// Mapa: nome da tabela Supabase → nome da tabela local
const TABLE_MAP: Record<string, string> = {
  compliance_tasks:       'comp_tasks',
  risks:                  'comp_risks',
  kyc_clients:            'comp_clients',
  incumprimentos:         'comp_incumprimentos',
  rgpd_checklist:         'comp_checklist',
  rgpd_matriz_tratamento: 'comp_matriz',
  dpias:                  'comp_dpias',
  roadmap_items:          'comp_roadmap',
  audit_logs:             'comp_audit',
  leg_diplomas:           'comp_leg_diplomas',
  leg_analises:           'comp_leg_analises',
  leg_consultas:          'comp_leg_consultas',
  scr_fund_docs:          'comp_scr_fund_docs',
  scr_fund_info:          'comp_scr_fund_info',
  oia_companies:          'comp_oia_companies',
  oia_funds:              'comp_oia_funds',
  oia_comparacoes:        'comp_oia_comparacoes',
  oia_pipeline_inv:       'comp_oia_pipeline_inv',
  oia_pipeline_deinv:     'comp_oia_pipeline_deinv',
  available_years:             'comp_available_years',
  rgpd_dpias_full:             'comp_rgpd_dpias_full',
  rgpd_avaliacoes_iniciais:    'comp_rgpd_avaliacoes_iniciais',
  rgpd_plano:                  'comp_rgpd_plano',
  rgpd_retencao:               'comp_rgpd_retencao',
  rgpd_incidentes:             'comp_rgpd_incidentes',
  pbcft_registos:              'comp_pbcft_registos',
  reportes:                    'comp_reportes',
  reportes_comunicacoes:       'comp_reportes_comunicacoes',
  quadro_reg:                  'comp_quadro_reg',
  ciber_risks:                 'comp_ciber_risks',
  ciber_improvements:          'comp_ciber_improvements',
  ciber_checklist:             'comp_ciber_checklist',
  ciber_changelog:             'comp_ciber_changelog',
}

function localTable(table: string): string {
  return TABLE_MAP[table] ?? table
}

// ─── localStorage helpers ──────────────────────────────────────────────────────
function _loadLocal<T>(key: string): T[] {
  try {
    const s = localStorage.getItem(key)
    return s ? JSON.parse(s) : []
  } catch { return [] }
}
function _saveLocal<T>(key: string, data: T[]): void {
  try { localStorage.setItem(key, JSON.stringify(data)) } catch {}
}

// ─── camelCase normalizer (PostgreSQL returns all-lowercase column names) ──────
function camelKeys(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const k of Object.keys(row)) {
    const camel = k.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())
    out[camel] = row[k]
    if (camel !== k) out[k] = row[k]  // keep original key too so nothing breaks
  }
  return out
}

// ─── Leitura ──────────────────────────────────────────────────────────────────
export async function sbLoad<T extends { id: string }>(
  table: string,
  localKey: string,
  seed: T[] = [],
): Promise<T[]> {
  try {
    const res = await fetch(`${API}/${localTable(table)}`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const rows: { id: string; data: Omit<T, 'id'>; created_at: string }[] = await res.json()

    if (rows.length === 0) {
      const local = _loadLocal<T>(localKey)
      if (local.length > 0) {
        await sbSeedFromLocal<T>(table, localKey)
        return local
      }
      return seed
    }

    const items = rows.map(row =>
      ('data' in row && row.data !== null && typeof row.data === 'object')
        ? { ...(row.data as Record<string, unknown>), id: row.id }
        : camelKeys(row as Record<string, unknown>)
    ) as T[]
    _saveLocal(localKey, items)
    return items
  } catch (err) {
    console.warn(`[store] Falha ao carregar "${table}", a usar localStorage:`, err)
    const local = _loadLocal<T>(localKey)
    return local.length > 0 ? local : seed
  }
}

// ─── Upsert individual ────────────────────────────────────────────────────────
export async function sbSave<T extends { id: string }>(
  table: string,
  localKey: string,
  item: T,
): Promise<void> {
  const local = _loadLocal<T>(localKey)
  const exists = local.findIndex(x => x.id === item.id)
  const updated = exists >= 0
    ? local.map(x => x.id === item.id ? item : x)
    : [...local, item]
  _saveLocal(localKey, updated)

  try {
    const { id, ...rest } = item as Record<string, unknown>
    await fetch(`${API}/${localTable(table)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, data: rest }),
    })
  } catch (err) {
    console.warn(`[store] Falha ao guardar em "${table}":`, err)
  }
}

// ─── Substituição total da lista (via upsert individual — evita bulk DELETE que polui history) ───
export async function sbSaveAll<T extends { id: string }>(
  table: string,
  localKey: string,
  items: T[],
): Promise<void> {
  _saveLocal(localKey, items)

  try {
    const lt = localTable(table)
    await Promise.all(items.map(item => {
      const { id, ...rest } = item as Record<string, unknown>
      return fetch(`${API}/${lt}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, data: rest }),
      })
    }))
  } catch (err) {
    console.warn(`[store] Falha ao guardar lista em "${table}":`, err)
  }
}

// ─── Remoção ──────────────────────────────────────────────────────────────────
export async function sbDelete<T extends { id: string }>(
  table: string,
  localKey: string,
  id: string,
  label?: string,
): Promise<void> {
  const local = _loadLocal<T>(localKey)
  _saveLocal(localKey, local.filter(x => x.id !== id))

  try {
    const res  = await fetch(`${API}/${localTable(table)}/${id}`, { method: 'DELETE' })
    const json = await res.json().catch(() => ({}))
    if (json.deleted && label) {
      useUndoStore.getState().showUndo({ table: localTable(table), label, rowData: json.deleted })
    }
  } catch (err) {
    console.warn(`[store] Falha ao eliminar em "${table}":`, err)
  }
}

// ─── Migração localStorage → API ─────────────────────────────────────────────
export async function sbSeedFromLocal<T extends { id: string }>(
  table: string,
  localKey: string,
): Promise<void> {
  const local = _loadLocal<T>(localKey)
  if (local.length === 0) return
  try {
    for (const item of local) {
      const { id, ...rest } = item as Record<string, unknown>
      await fetch(`${API}/${localTable(table)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, data: rest }),
      })
    }
    console.info(`[store] Migrados ${local.length} registos de "${localKey}" → "${table}"`)
  } catch (err) {
    console.warn(`[store] Falha na migração de "${localKey}":`, err)
  }
}

export interface SupabaseRow<T> {
  id: string
  data: T
  created_at?: string
}
