import { useState } from 'react'
import { X } from 'lucide-react'
import type { Asset } from '../lib/api'

const SECTORS = ['industrial', 'agricultura', 'leisure', 'outro'] as const
const DEED_TYPES = ['escritura', 'asset_deal', 'cessao_quotas', 'equity_deal', 'acoes_creditos'] as const
const STATUSES  = ['em_rendimento', 'sem_rendimento', 'em_venda', 'vendido'] as const
const STATUS_LABEL: Record<string, string> = {
  em_rendimento: 'Em Rendimento', sem_rendimento: 'Sem Rendimento',
  em_venda: 'Em Venda', vendido: 'Vendido',
}
const DEED_LABEL: Record<string, string> = {
  escritura: 'Escritura', asset_deal: 'Asset Deal',
  cessao_quotas: 'Cessão de Quotas', equity_deal: 'Equity Deal', acoes_creditos: 'Ações/Créditos',
}

type Mode = 'create' | 'edit'

interface Props {
  mode: Mode
  initial?: Partial<Asset>
  onSave: (data: Partial<Asset>) => Promise<void>
  onClose: () => void
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">{label}</label>
      {children}
    </div>
  )
}

const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
const numCls   = inputCls + ' text-right'

export function AssetFormModal({ mode, initial = {}, onSave, onClose }: Props) {
  const [f, setF] = useState<Partial<Asset>>({
    name: '', spv: '', sector: null, location: '', typology: '',
    land_area: null, build_area: null, tenant: '', acquisition_date: null,
    deed_type: null, maps_link: '', general_notes: '',
    purchase_price: 0, stamp_duty: 0, notary_fees: 0,
    imt_paid: 0, imt_due: 0, imi_paid: 0, imi_due: 0,
    capex_prev: 0, capex_current: 0, opex_prev: 0, opex_current: 0,
    capital_cost_rate: 6.5, capital_cost_value: null, capital_cost_override: false,
    income_prev: 0, income_current: 0,
    bidding_offer: null, transaction_fee_pct: 5, commercialization_margin: 15,
    asking_price_final: null, status: 'sem_rendimento',
    ...initial,
  })
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState<string | null>(null)

  const set = (key: keyof Asset, val: unknown) => setF(p => ({ ...p, [key]: val }))
  const num = (key: keyof Asset) => (e: React.ChangeEvent<HTMLInputElement>) =>
    set(key, e.target.value === '' ? null : parseFloat(e.target.value))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!f.name?.trim()) { setError('Nome do ativo é obrigatório.'); return }
    setSaving(true); setError(null)
    try {
      await onSave(f)
      onClose()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-[15px] font-semibold text-slate-800">
            {mode === 'create' ? 'Novo Ativo' : 'Editar Ativo'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto px-6 py-5 space-y-5 flex-1">
          {/* Identidade */}
          <div>
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3">Identificação</div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Nome *">
                <input className={inputCls} value={f.name ?? ''} onChange={e => set('name', e.target.value)} required />
              </Field>
              <Field label="SPV">
                <input className={inputCls} value={f.spv ?? ''} onChange={e => set('spv', e.target.value)} />
              </Field>
              <Field label="Setor">
                <select className={inputCls} value={f.sector ?? ''} onChange={e => set('sector', e.target.value || null)}>
                  <option value="">—</option>
                  {SECTORS.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                </select>
              </Field>
              <Field label="Estado">
                <select className={inputCls} value={f.status ?? 'sem_rendimento'} onChange={e => set('status', e.target.value)}>
                  {STATUSES.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                </select>
              </Field>
              <Field label="Localização">
                <input className={inputCls} value={f.location ?? ''} onChange={e => set('location', e.target.value)} />
              </Field>
              <Field label="Tipologia">
                <input className={inputCls} value={f.typology ?? ''} onChange={e => set('typology', e.target.value)} />
              </Field>
              <Field label="Área Terreno (m²)">
                <input className={numCls} type="number" value={f.land_area ?? ''} onChange={num('land_area')} />
              </Field>
              <Field label="Área Construção (m²)">
                <input className={numCls} type="number" value={f.build_area ?? ''} onChange={num('build_area')} />
              </Field>
              <Field label="Arrendatário">
                <input className={inputCls} value={f.tenant ?? ''} onChange={e => set('tenant', e.target.value)} />
              </Field>
              <Field label="Data Aquisição">
                <input className={inputCls} type="date" value={f.acquisition_date ?? ''} onChange={e => set('acquisition_date', e.target.value || null)} />
              </Field>
              <Field label="Tipo de Escritura">
                <select className={inputCls} value={f.deed_type ?? ''} onChange={e => set('deed_type', e.target.value || null)}>
                  <option value="">—</option>
                  {DEED_TYPES.map(d => <option key={d} value={d}>{DEED_LABEL[d]}</option>)}
                </select>
              </Field>
              <Field label="Link Google Maps">
                <input className={inputCls} value={f.maps_link ?? ''} onChange={e => set('maps_link', e.target.value)} placeholder="https://..." />
              </Field>
            </div>
          </div>

          {/* Custos */}
          <div>
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3">Custos de Aquisição</div>
            <div className="grid grid-cols-3 gap-4">
              {[
                ['Preço Compra', 'purchase_price'], ['Imposto do Selo', 'stamp_duty'],
                ['Notariado', 'notary_fees'], ['IMT Pago', 'imt_paid'],
                ['IMT Devido', 'imt_due'], ['IMI Pago', 'imi_paid'], ['IMI Devido', 'imi_due'],
              ].map(([label, key]) => (
                <Field key={key} label={label as string}>
                  <input className={numCls} type="number" step="0.01"
                    value={(f as any)[key] ?? 0} onChange={num(key as keyof Asset)} />
                </Field>
              ))}
            </div>
          </div>

          {/* Capex/Opex */}
          <div>
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3">Capex / Opex</div>
            <div className="grid grid-cols-4 gap-4">
              {[
                ['Capex Prev.', 'capex_prev'], ['Capex Atual', 'capex_current'],
                ['Opex Prev.', 'opex_prev'],  ['Opex Atual', 'opex_current'],
              ].map(([label, key]) => (
                <Field key={key} label={label as string}>
                  <input className={numCls} type="number" step="0.01"
                    value={(f as any)[key] ?? 0} onChange={num(key as keyof Asset)} />
                </Field>
              ))}
            </div>
          </div>

          {/* Rendimento */}
          <div>
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3">Rendimento</div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Rendimento Prev.">
                <input className={numCls} type="number" step="0.01" value={f.income_prev ?? 0} onChange={num('income_prev')} />
              </Field>
              <Field label="Rendimento Atual">
                <input className={numCls} type="number" step="0.01" value={f.income_current ?? 0} onChange={num('income_current')} />
              </Field>
            </div>
          </div>

          {/* Custo de capital */}
          <div>
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3">Custo de Capital</div>
            <div className="grid grid-cols-3 gap-4">
              <Field label="Taxa (%)">
                <input className={numCls} type="number" step="0.01" value={f.capital_cost_rate ?? 6.5} onChange={num('capital_cost_rate')} />
              </Field>
              <Field label="Valor Override">
                <input className={numCls} type="number" step="0.01" value={f.capital_cost_value ?? ''} onChange={num('capital_cost_value')} />
              </Field>
              <Field label="Usar Override">
                <div className="flex items-center h-9">
                  <input type="checkbox" checked={f.capital_cost_override ?? false}
                    onChange={e => set('capital_cost_override', e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600" />
                  <span className="ml-2 text-sm text-gray-600">Ativar</span>
                </div>
              </Field>
            </div>
          </div>

          {/* Notas */}
          <Field label="Notas Gerais">
            <textarea className={inputCls + ' resize-none'} rows={3}
              value={f.general_notes ?? ''} onChange={e => set('general_notes', e.target.value)} />
          </Field>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2 text-sm text-red-700">{error}</div>
          )}
        </form>

        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors">
            Cancelar
          </button>
          <button onClick={handleSubmit as any} disabled={saving}
            className="px-5 py-2 bg-[#1e3a5f] hover:bg-[#162d4a] disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors">
            {saving ? 'A guardar…' : mode === 'create' ? 'Criar Ativo' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}
