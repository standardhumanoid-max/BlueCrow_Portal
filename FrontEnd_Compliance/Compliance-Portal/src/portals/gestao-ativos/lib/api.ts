import { API_BASE, authFetch } from '@/lib/api'

export const GA_API = `${API_BASE}/api/ga`

export interface Asset {
  id: string
  name: string
  spv: string | null
  sector: 'industrial' | 'agricultura' | 'leisure' | 'outro' | null
  location: string | null
  typology: string | null
  land_area: number | null
  build_area: number | null
  tenant: string | null
  acquisition_date: string | null
  deed_type: 'escritura' | 'asset_deal' | 'cessao_quotas' | 'equity_deal' | 'acoes_creditos' | null
  maps_link: string | null
  general_notes: string | null
  purchase_price: number
  stamp_duty: number
  notary_fees: number
  imt_paid: number
  imt_due: number
  imi_paid: number
  imi_due: number
  capex_prev: number
  capex_current: number
  opex_prev: number
  opex_current: number
  capital_cost_rate: number
  capital_cost_value: number | null
  capital_cost_override: boolean
  income_prev: number
  income_current: number
  bidding_offer: number | null
  transaction_fee_pct: number
  commercialization_margin: number
  asking_price_final: number | null
  status: 'em_rendimento' | 'sem_rendimento' | 'em_venda' | 'vendido'
  created_at: string
  updated_at: string
}

export interface Valuation {
  id: string
  asset_id: string
  year: string
  value: number | null
  created_at: string
}

export interface Bov {
  id: string
  asset_id: string
  label: string
  value: number | null
  notes: string | null
  created_at: string
}

export interface Note {
  id: string
  asset_id: string
  body: string | null
  updated_at: string
}

export interface Tenancy {
  id: string
  asset_id: string
  tenant_name: string | null
  tenant_nif: string | null
  lease_status: 'ativo' | 'negociacao' | 'terminado' | 'vacante'
  monthly_rent: number | null
  contract_start: string | null
  contract_end: string | null
  document_link: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface AssetFile {
  id: string
  asset_id: string
  category: 'sale_pack' | 'photo' | 'lease_doc' | 'finance' | 'other'
  title: string | null
  resource_link: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface AssetDetail extends Asset {
  valuations: Valuation[]
  bovs: Bov[]
  note: Note | null
  tenancies: Tenancy[]
  files: AssetFile[]
}

// ── API calls ─────────────────────────────────────────────────────────────────

export async function fetchAssets(): Promise<Asset[]> {
  const res = await authFetch(`${GA_API}/assets`)
  if (!res.ok) throw new Error(`Erro ${res.status}`)
  return res.json()
}

export async function fetchAsset(id: string): Promise<AssetDetail> {
  const res = await authFetch(`${GA_API}/assets/${id}`)
  if (!res.ok) throw new Error(`Erro ${res.status}`)
  return res.json()
}

export async function createAsset(data: Partial<Asset>): Promise<Asset> {
  const res = await authFetch(`${GA_API}/assets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? `Erro ${res.status}`) }
  return res.json()
}

export async function updateAsset(id: string, data: Partial<Asset>): Promise<Asset> {
  const res = await authFetch(`${GA_API}/assets/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? `Erro ${res.status}`) }
  return res.json()
}

export async function deleteAsset(id: string): Promise<void> {
  const res = await authFetch(`${GA_API}/assets/${id}`, { method: 'DELETE' })
  if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? `Erro ${res.status}`) }
}

export async function upsertValuation(assetId: string, year: string, value: number): Promise<Valuation> {
  const res = await authFetch(`${GA_API}/assets/${assetId}/valuations/${year}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value }),
  })
  if (!res.ok) throw new Error(`Erro ${res.status}`)
  return res.json()
}

export async function upsertBov(assetId: string, label: string, value: number | null, notes: string | null): Promise<Bov> {
  const res = await authFetch(`${GA_API}/assets/${assetId}/bovs/${encodeURIComponent(label)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value, notes }),
  })
  if (!res.ok) throw new Error(`Erro ${res.status}`)
  return res.json()
}

export async function upsertNote(assetId: string, body: string): Promise<Note> {
  const res = await authFetch(`${GA_API}/assets/${assetId}/notes`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ body }),
  })
  if (!res.ok) throw new Error(`Erro ${res.status}`)
  return res.json()
}

export async function createTenancy(assetId: string, data: Partial<Tenancy>): Promise<Tenancy> {
  const res = await authFetch(`${GA_API}/assets/${assetId}/tenancies`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? `Erro ${res.status}`) }
  return res.json()
}

export async function updateTenancy(tid: string, data: Partial<Tenancy>): Promise<Tenancy> {
  const res = await authFetch(`${GA_API}/tenancies/${tid}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? `Erro ${res.status}`) }
  return res.json()
}

export async function deleteTenancy(tid: string): Promise<void> {
  const res = await authFetch(`${GA_API}/tenancies/${tid}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`Erro ${res.status}`)
}

export async function createFile(assetId: string, data: Partial<AssetFile>): Promise<AssetFile> {
  const res = await authFetch(`${GA_API}/assets/${assetId}/files`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? `Erro ${res.status}`) }
  return res.json()
}

export async function deleteFile(fid: string): Promise<void> {
  const res = await authFetch(`${GA_API}/files/${fid}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`Erro ${res.status}`)
}
