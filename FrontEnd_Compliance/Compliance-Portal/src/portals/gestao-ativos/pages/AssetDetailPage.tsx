import { useState, useEffect, useCallback } from 'react'
import { ArrowLeft, Pencil, Trash2, Plus, Save, X, ExternalLink, FileText, Home } from 'lucide-react'
import type { AssetDetail, Tenancy, AssetFile } from '../lib/api'
import {
  fetchAsset, updateAsset, upsertValuation, upsertBov, upsertNote,
  createTenancy, updateTenancy, deleteTenancy, createFile, deleteFile,
} from '../lib/api'
import { AssetFormModal } from './AssetFormModal'

type Tab = 'ficha' | 'arrendamentos' | 'documentos' | 'notas'

function fmt(n: number | null | undefined, decimals = 0) {
  if (n == null) return '—'
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: decimals }).format(n)
}
function fmtN(n: number | null | undefined) {
  if (n == null) return '—'
  return new Intl.NumberFormat('pt-PT').format(n)
}

const STATUS_LABEL: Record<string, string> = {
  em_rendimento: 'Em Rendimento', sem_rendimento: 'Sem Rendimento',
  em_venda: 'Em Venda', vendido: 'Vendido',
}
const LEASE_LABEL: Record<string, string> = {
  ativo: 'Ativo', negociacao: 'Negociação', terminado: 'Terminado', vacante: 'Vacante',
}
const LEASE_COLOR: Record<string, string> = {
  ativo: 'bg-emerald-100 text-emerald-700', negociacao: 'bg-amber-100 text-amber-700',
  terminado: 'bg-gray-100 text-gray-600', vacante: 'bg-red-100 text-red-600',
}
const FILE_CAT_LABEL: Record<string, string> = {
  sale_pack: 'Sale Pack', photo: 'Fotografia', lease_doc: 'Contrato Arrendamento',
  finance: 'Financeiro', other: 'Outro',
}

const inputCls = 'border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full'

interface Props {
  assetId: string
  onBack: () => void
  onDeleted: () => void
}

export function AssetDetailPage({ assetId, onBack, onDeleted }: Props) {
  const [asset, setAsset]   = useState<AssetDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab]       = useState<Tab>('ficha')
  const [editOpen, setEditOpen] = useState(false)
  const [error, setError]   = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const d = await fetchAsset(assetId)
      setAsset(d)
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }, [assetId])

  useEffect(() => { load() }, [load])

  async function handleSaveEdit(data: any) {
    await updateAsset(assetId, data)
    await load()
  }

  async function handleDelete() {
    if (!window.confirm(`Eliminar "${asset?.name}"? Esta ação é irreversível — todos os dados associados serão apagados.`)) return
    const { deleteAsset } = await import('../lib/api')
    await deleteAsset(assetId)
    onDeleted()
  }

  if (loading) return (
    <div className="flex-1 flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )
  if (error || !asset) return (
    <div className="p-6 text-red-600 text-sm">{error ?? 'Ativo não encontrado'}</div>
  )

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center gap-3 mb-3">
          <button onClick={onBack} className="text-gray-400 hover:text-gray-600 flex items-center gap-1.5 text-sm">
            <ArrowLeft size={15} /> Portefólio
          </button>
        </div>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-800">{asset.name}</h1>
            <div className="flex items-center gap-3 mt-1 text-sm text-slate-500">
              {asset.spv && <span className="font-medium text-slate-600">{asset.spv}</span>}
              {asset.location && <span>{asset.location}</span>}
              {asset.sector && <span className="capitalize">{asset.sector}</span>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
              asset.status === 'em_rendimento' ? 'bg-emerald-100 text-emerald-700' :
              asset.status === 'em_venda' ? 'bg-amber-100 text-amber-700' :
              asset.status === 'vendido' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
            }`}>{STATUS_LABEL[asset.status] ?? asset.status}</span>
            <button onClick={() => setEditOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-600 hover:text-slate-800 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              <Pencil size={13} /> Editar
            </button>
            <button onClick={handleDelete}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-500 hover:text-red-700 border border-red-100 rounded-lg hover:bg-red-50 transition-colors">
              <Trash2 size={13} /> Eliminar
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mt-4">
          {([['ficha', 'Ficha'], ['arrendamentos', 'Arrendamentos'], ['documentos', 'Documentos'], ['notas', 'Notas']] as [Tab, string][]).map(([t, l]) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-1.5 text-sm rounded-lg font-medium transition-colors ${
                tab === t ? 'bg-[#1e3a5f] text-white' : 'text-slate-500 hover:text-slate-700 hover:bg-gray-100'}`}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {tab === 'ficha'        && <FichaTab asset={asset} onReload={load} />}
        {tab === 'arrendamentos' && <ArrendamentosTab asset={asset} onReload={load} />}
        {tab === 'documentos'   && <DocumentosTab asset={asset} onReload={load} />}
        {tab === 'notas'        && <NotasTab asset={asset} onReload={load} />}
      </div>

      {editOpen && (
        <AssetFormModal mode="edit" initial={asset} onSave={handleSaveEdit} onClose={() => setEditOpen(false)} />
      )}
    </div>
  )
}

// ── Ficha Tab ─────────────────────────────────────────────────────────────────
function FichaTab({ asset, onReload }: { asset: AssetDetail; onReload: () => void }) {
  const totalCusto = (asset.purchase_price ?? 0) + (asset.stamp_duty ?? 0) + (asset.notary_fees ?? 0)
    + (asset.imt_paid ?? 0) + (asset.imi_paid ?? 0)
  const capitalCost = asset.capital_cost_override && asset.capital_cost_value != null
    ? asset.capital_cost_value
    : totalCusto * ((asset.capital_cost_rate ?? 6.5) / 100)

  // Valuations editing
  const [valEdit, setValEdit] = useState<Record<string, string>>({})
  const [savingVal, setSavingVal] = useState<string | null>(null)
  const [bovEdit, setBovEdit]   = useState<{ label: string; value: string; notes: string } | null>(null)
  const [newBovLabel, setNewBovLabel] = useState('')

  async function saveVal(year: string) {
    const v = parseFloat(valEdit[year])
    if (isNaN(v)) return
    setSavingVal(year)
    try { await upsertValuation(asset.id, year, v); await onReload() }
    finally { setSavingVal(null); setValEdit(p => { const n = { ...p }; delete n[year]; return n }) }
  }

  async function saveBov() {
    if (!bovEdit) return
    await upsertBov(asset.id, bovEdit.label, parseFloat(bovEdit.value) || null, bovEdit.notes || null)
    setBovEdit(null); await onReload()
  }

  async function addBov() {
    if (!newBovLabel.trim()) return
    await upsertBov(asset.id, newBovLabel.trim(), null, null)
    setNewBovLabel(''); await onReload()
  }

  const currentYear = new Date().getFullYear()
  const years = Array.from(new Set([
    ...asset.valuations.map(v => v.year),
    String(currentYear - 1), String(currentYear),
  ])).sort()

  return (
    <div className="space-y-6">
      {/* Resumo financeiro */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          ['Custo Total', fmt(totalCusto)],
          ['Custo de Capital', fmt(capitalCost)],
          ['Rendimento Anual', fmt(asset.income_current)],
          ['Yield Bruta', asset.income_current && totalCusto ? `${((asset.income_current / totalCusto) * 100).toFixed(2)}%` : '—'],
        ].map(([l, v]) => (
          <div key={l} className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="text-xs text-slate-500 mb-1">{l}</div>
            <div className="text-xl font-bold text-slate-800">{v}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Custos detalhados */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Custos de Aquisição</div>
          <table className="w-full text-sm">
            <tbody>
              {[
                ['Preço de Compra', fmt(asset.purchase_price)],
                ['Imposto do Selo', fmt(asset.stamp_duty)],
                ['Notariado', fmt(asset.notary_fees)],
                ['IMT Pago', fmt(asset.imt_paid)],
                ['IMT Devido', fmt(asset.imt_due)],
                ['IMI Pago', fmt(asset.imi_paid)],
                ['IMI Devido', fmt(asset.imi_due)],
              ].map(([l, v]) => (
                <tr key={l} className="border-b border-gray-50 last:border-0">
                  <td className="py-2 text-slate-500">{l}</td>
                  <td className="py-2 text-right font-medium text-slate-700">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Áreas e detalhes */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Detalhes do Ativo</div>
          {[
            ['Tipologia', asset.typology],
            ['Área de Terreno', asset.land_area ? `${fmtN(asset.land_area)} m²` : null],
            ['Área de Construção', asset.build_area ? `${fmtN(asset.build_area)} m²` : null],
            ['Arrendatário', asset.tenant],
            ['Data de Aquisição', asset.acquisition_date ? new Date(asset.acquisition_date).toLocaleDateString('pt-PT') : null],
            ['Tipo de Escritura', asset.deed_type],
          ].map(([l, v]) => v ? (
            <div key={l as string} className="flex justify-between text-sm">
              <span className="text-slate-500">{l}</span>
              <span className="font-medium text-slate-700">{v}</span>
            </div>
          ) : null)}
          {asset.maps_link && (
            <a href={asset.maps_link} target="_blank" rel="noreferrer"
              className="flex items-center gap-1.5 text-sm text-blue-500 hover:text-blue-700">
              <ExternalLink size={13} /> Ver no Google Maps
            </a>
          )}
        </div>
      </div>

      {/* Avaliações */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Avaliações por Ano</div>
        <div className="flex flex-wrap gap-3">
          {years.map(year => {
            const existing = asset.valuations.find(v => v.year === year)
            const editing  = year in valEdit
            return (
              <div key={year} className="border border-gray-200 rounded-xl px-4 py-3 min-w-[130px]">
                <div className="text-xs text-slate-400 font-semibold mb-1.5">{year}</div>
                {editing ? (
                  <div className="flex gap-1.5 items-center">
                    <input type="number" className="border border-gray-200 rounded px-2 py-1 text-sm w-24 text-right"
                      value={valEdit[year]} onChange={e => setValEdit(p => ({ ...p, [year]: e.target.value }))}
                      autoFocus onKeyDown={e => e.key === 'Enter' && saveVal(year)} />
                    <button onClick={() => saveVal(year)} disabled={savingVal === year}
                      className="text-blue-600 hover:text-blue-800"><Save size={14} /></button>
                    <button onClick={() => setValEdit(p => { const n = { ...p }; delete n[year]; return n })}
                      className="text-gray-400 hover:text-gray-600"><X size={14} /></button>
                  </div>
                ) : (
                  <button onClick={() => setValEdit(p => ({ ...p, [year]: String(existing?.value ?? '') }))}
                    className="text-base font-bold text-slate-700 hover:text-blue-600 transition-colors text-left w-full">
                    {existing?.value != null ? fmt(existing.value) : <span className="text-gray-300 text-sm">+ Adicionar</span>}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* BOVs */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">Broker Opinions of Value</div>
          <div className="flex gap-2 items-center">
            <input className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs w-32"
              placeholder="Nova label…" value={newBovLabel} onChange={e => setNewBovLabel(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addBov()} />
            <button onClick={addBov} className="text-blue-600 hover:text-blue-800"><Plus size={15} /></button>
          </div>
        </div>
        {asset.bovs.length === 0
          ? <div className="text-sm text-slate-400">Nenhum BOV registado.</div>
          : (
            <div className="flex flex-wrap gap-3">
              {asset.bovs.map(b => (
                <div key={b.id} className="border border-gray-200 rounded-xl px-4 py-3 min-w-[150px]">
                  <div className="text-xs text-slate-400 font-semibold mb-1.5">{b.label}</div>
                  {bovEdit?.label === b.label ? (
                    <div className="space-y-1.5">
                      <input type="number" className="border border-gray-200 rounded px-2 py-1 text-sm w-full text-right"
                        value={bovEdit.value} onChange={e => setBovEdit(p => p ? { ...p, value: e.target.value } : p)} />
                      <input className="border border-gray-200 rounded px-2 py-1 text-xs w-full"
                        placeholder="Notas…" value={bovEdit.notes}
                        onChange={e => setBovEdit(p => p ? { ...p, notes: e.target.value } : p)} />
                      <div className="flex gap-1.5">
                        <button onClick={saveBov} className="text-blue-600 hover:text-blue-800"><Save size={13} /></button>
                        <button onClick={() => setBovEdit(null)} className="text-gray-400 hover:text-gray-600"><X size={13} /></button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => setBovEdit({ label: b.label, value: String(b.value ?? ''), notes: b.notes ?? '' })}
                      className="text-base font-bold text-slate-700 hover:text-blue-600 transition-colors text-left w-full">
                      {b.value != null ? fmt(b.value) : <span className="text-gray-300 text-sm">+ Valor</span>}
                    </button>
                  )}
                  {b.notes && <div className="text-xs text-slate-400 mt-1">{b.notes}</div>}
                </div>
              ))}
            </div>
          )
        }
      </div>
    </div>
  )
}

// ── Arrendamentos Tab ─────────────────────────────────────────────────────────
function ArrendamentosTab({ asset, onReload }: { asset: AssetDetail; onReload: () => void }) {
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId]     = useState<string | null>(null)
  const [form, setForm]         = useState<Partial<Tenancy>>({})
  const [saving, setSaving]     = useState(false)

  const incomeAnual = asset.tenancies
    .filter(t => t.lease_status === 'ativo' && t.monthly_rent)
    .reduce((s, t) => s + (t.monthly_rent! * 12), 0)

  function openCreate() {
    setForm({ lease_status: 'ativo' }); setEditId(null); setShowForm(true)
  }
  function openEdit(t: Tenancy) {
    setForm(t); setEditId(t.id); setShowForm(true)
  }

  async function handleSave() {
    setSaving(true)
    try {
      if (editId) await updateTenancy(editId, form)
      else await createTenancy(asset.id, form)
      setShowForm(false); await onReload()
    } finally { setSaving(false) }
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Eliminar arrendamento?')) return
    await deleteTenancy(id); await onReload()
  }

  const set = (k: keyof Tenancy, v: unknown) => setForm(p => ({ ...p, [k]: v }))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-slate-500">
          Rendimento anual consolidado (contratos ativos):
          <span className="ml-2 font-bold text-emerald-600">{fmt(incomeAnual)}</span>
        </div>
        <button onClick={openCreate}
          className="flex items-center gap-1.5 px-4 py-2 bg-[#1e3a5f] hover:bg-[#162d4a] text-white text-sm font-medium rounded-lg transition-colors">
          <Plus size={14} /> Novo Arrendamento
        </button>
      </div>

      {asset.tenancies.length === 0
        ? <div className="bg-white rounded-xl border border-gray-200 py-12 text-center text-sm text-slate-400">Nenhum arrendamento registado.</div>
        : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-[11px] uppercase tracking-wide text-slate-400">
                  <th className="px-5 py-3 text-left">Arrendatário</th>
                  <th className="px-4 py-3 text-left">NIF</th>
                  <th className="px-4 py-3 text-left">Estado</th>
                  <th className="px-4 py-3 text-right">Renda Mensal</th>
                  <th className="px-4 py-3 text-left">Início</th>
                  <th className="px-4 py-3 text-left">Fim</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {asset.tenancies.map(t => (
                  <tr key={t.id} className="border-b border-gray-50 last:border-0 hover:bg-slate-50">
                    <td className="px-5 py-3 font-medium text-slate-700">{t.tenant_name ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-500">{t.tenant_nif ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${LEASE_COLOR[t.lease_status] ?? 'bg-gray-100 text-gray-600'}`}>
                        {LEASE_LABEL[t.lease_status] ?? t.lease_status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-slate-700">{fmt(t.monthly_rent)}</td>
                    <td className="px-4 py-3 text-slate-500">{t.contract_start ? new Date(t.contract_start).toLocaleDateString('pt-PT') : '—'}</td>
                    <td className="px-4 py-3 text-slate-500">{t.contract_end   ? new Date(t.contract_end).toLocaleDateString('pt-PT')   : '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2 justify-end">
                        <button onClick={() => openEdit(t)} className="text-gray-400 hover:text-blue-600"><Pencil size={13} /></button>
                        <button onClick={() => handleDelete(t.id)} className="text-gray-400 hover:text-red-600"><Trash2 size={13} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      }

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="text-[14px] font-semibold text-slate-800">{editId ? 'Editar Arrendamento' : 'Novo Arrendamento'}</h3>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {[['Arrendatário', 'tenant_name', 'text'], ['NIF', 'tenant_nif', 'text'],
                  ['Renda Mensal (€)', 'monthly_rent', 'number'], ['Link Documento', 'document_link', 'text'],
                  ['Início', 'contract_start', 'date'], ['Fim', 'contract_end', 'date']].map(([l, k, t]) => (
                  <div key={k as string}>
                    <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">{l}</label>
                    <input type={t as string} className={inputCls}
                      value={(form as any)[k] ?? ''}
                      onChange={e => set(k as keyof Tenancy, t === 'number' ? (e.target.value === '' ? null : parseFloat(e.target.value)) : (e.target.value || null))} />
                  </div>
                ))}
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Estado</label>
                  <select className={inputCls} value={form.lease_status ?? 'ativo'} onChange={e => set('lease_status', e.target.value)}>
                    {Object.entries(LEASE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Notas</label>
                <textarea className={inputCls + ' resize-none'} rows={2}
                  value={form.notes ?? ''} onChange={e => set('notes', e.target.value || null)} />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-600">Cancelar</button>
              <button onClick={handleSave} disabled={saving}
                className="px-5 py-2 bg-[#1e3a5f] hover:bg-[#162d4a] disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors">
                {saving ? 'A guardar…' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Documentos Tab ────────────────────────────────────────────────────────────
function DocumentosTab({ asset, onReload }: { asset: AssetDetail; onReload: () => void }) {
  const [showForm, setShowForm] = useState(false)
  const [form, setForm]         = useState<Partial<AssetFile>>({ category: 'other' })
  const [saving, setSaving]     = useState(false)
  const set = (k: keyof AssetFile, v: unknown) => setForm(p => ({ ...p, [k]: v }))

  async function handleSave() {
    setSaving(true)
    try { await createFile(asset.id, form); setShowForm(false); await onReload() }
    finally { setSaving(false) }
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Eliminar documento?')) return
    await deleteFile(id); await onReload()
  }

  const byCategory = Object.entries(FILE_CAT_LABEL).map(([cat, label]) => ({
    cat, label, files: asset.files.filter(f => f.category === cat),
  })).filter(g => g.files.length > 0)

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-[#1e3a5f] hover:bg-[#162d4a] text-white text-sm font-medium rounded-lg transition-colors">
          <Plus size={14} /> Novo Documento
        </button>
      </div>

      {asset.files.length === 0
        ? <div className="bg-white rounded-xl border border-gray-200 py-12 text-center text-sm text-slate-400">Nenhum documento registado.</div>
        : byCategory.map(({ cat, label, files }) => (
          <div key={cat} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 text-xs font-bold text-slate-400 uppercase tracking-widest">{label}</div>
            <div className="divide-y divide-gray-50">
              {files.map(f => (
                <div key={f.id} className="px-5 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FileText size={16} className="text-slate-400 flex-shrink-0" />
                    <div>
                      <div className="text-sm font-medium text-slate-700">{f.title ?? 'Sem título'}</div>
                      {f.notes && <div className="text-xs text-slate-400 mt-0.5">{f.notes}</div>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {f.resource_link && (
                      <a href={f.resource_link} target="_blank" rel="noreferrer"
                        className="text-blue-500 hover:text-blue-700 flex items-center gap-1 text-xs">
                        <ExternalLink size={12} /> Abrir
                      </a>
                    )}
                    <button onClick={() => handleDelete(f.id)} className="text-gray-400 hover:text-red-600"><Trash2 size={13} /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      }

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="text-[14px] font-semibold text-slate-800">Novo Documento</h3>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              {[['Título', 'title', 'text'], ['Link / URL', 'resource_link', 'text']].map(([l, k, t]) => (
                <div key={k as string}>
                  <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">{l}</label>
                  <input type={t as string} className={inputCls} value={(form as any)[k] ?? ''} onChange={e => set(k as keyof AssetFile, e.target.value || null)} />
                </div>
              ))}
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Categoria</label>
                <select className={inputCls} value={form.category ?? 'other'} onChange={e => set('category', e.target.value)}>
                  {Object.entries(FILE_CAT_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Notas</label>
                <input className={inputCls} value={form.notes ?? ''} onChange={e => set('notes', e.target.value || null)} />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-600">Cancelar</button>
              <button onClick={handleSave} disabled={saving}
                className="px-5 py-2 bg-[#1e3a5f] hover:bg-[#162d4a] disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors">
                {saving ? 'A guardar…' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Notas Tab ─────────────────────────────────────────────────────────────────
function NotasTab({ asset, onReload }: { asset: AssetDetail; onReload: () => void }) {
  const [body, setBody] = useState(asset.note?.body ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved]   = useState(false)

  async function handleSave() {
    setSaving(true)
    try { await upsertNote(asset.id, body); setSaved(true); setTimeout(() => setSaved(false), 2000) }
    finally { setSaving(false) }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
      <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">Notas de Investimento</div>
      <textarea className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        rows={12} value={body} onChange={e => setBody(e.target.value)}
        placeholder="Escreve aqui as notas de investimento, observações ou contexto relevante para este ativo…" />
      <div className="flex justify-end">
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 px-5 py-2 bg-[#1e3a5f] hover:bg-[#162d4a] disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors">
          <Save size={14} /> {saving ? 'A guardar…' : saved ? 'Guardado!' : 'Guardar Notas'}
        </button>
      </div>
    </div>
  )
}
