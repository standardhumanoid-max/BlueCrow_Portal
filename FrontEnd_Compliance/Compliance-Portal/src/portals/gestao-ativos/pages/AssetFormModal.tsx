import { useState } from 'react'
import { X } from 'lucide-react'
import type { Asset } from '../lib/api'

const STATUSES  = ['em_rendimento', 'sem_rendimento', 'em_venda', 'vendido'] as const
const STATUS_LABEL: Record<string, string> = {
  em_rendimento: 'Em Rendimento', sem_rendimento: 'Sem Rendimento',
  em_venda: 'Em Venda', vendido: 'Vendido',
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
    name: '', spv: '', location: '', typology: '',
    land_area: null, build_area: null, tenant: '',
    acquisition_date: null, maps_link: '', general_notes: '',
    purchase_price: 0, stamp_duty: 0, notary_fees: 0,
    capex_current: 0, opex_current: 0,
    capital_cost: 6.5, capital_cost_v: null,
    income_current: 0,
    bidding_offer: null, transaction_fee: 5, commercialization: 15,
    asking_price: null, status: 'sem_rendimento',
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
          {/* Identificação */}
          <div>
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3">Identificação</div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Nome *">
                <input className={inputCls} value={f.name ?? ''} onChange={e => set('name', e.target.value)} required />
              </Field>
              <Field label="SPV">
                <input className={inputCls} value={f.spv ?? ''} onChange={e => set('spv', e.target.value)} />
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
              <Field label="Inquilino">
                <input className={inputCls} value={f.tenant ?? ''} onChange={e => set('tenant', e.target.value)} />
              </Field>
              <Field label="Data Aquisição">
                <input className={inputCls} type="date" value={f.acquisition_date ?? ''} onChange={e => set('acquisition_date', e.target.value || null)} />
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
              {([['Preço Compra', 'purchase_price'], ['Sisa / IS', 'stamp_duty'], ['Notariado', 'notary_fees']] as [string, keyof Asset][]).map(([label, key]) => (
                <Field key={key} label={label}>
                  <input className={numCls} type="number" step="0.01" value={(f as any)[key] ?? 0} onChange={num(key)} />
                </Field>
              ))}
            </div>
          </div>

          {/* CAPEX / OPEX */}
          <div>
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3">CAPEX / OPEX</div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="CAPEX (€)">
                <input className={numCls} type="number" step="0.01" value={f.capex_current ?? 0} onChange={num('capex_current')} />
              </Field>
              <Field label="OPEX (€)">
                <input className={numCls} type="number" step="0.01" value={f.opex_current ?? 0} onChange={num('opex_current')} />
              </Field>
            </div>
          </div>

          {/* Custo de Capital */}
          <div>
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3">Custo de Capital</div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Taxa (%)">
                <input className={numCls} type="number" step="0.01" value={f.capital_cost ?? 6.5} onChange={num('capital_cost')} />
              </Field>
              <Field label="Override Valor (€)">
                <input className={numCls} type="number" step="0.01" value={f.capital_cost_v ?? ''} onChange={num('capital_cost_v')} placeholder="—" />
              </Field>
            </div>
          </div>

          {/* Rendimento */}
          <div>
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3">Rendimento</div>
            <div className="grid grid-cols-1 gap-4">
              <Field label="Rendimento Anual (€)">
                <input className={numCls} type="number" step="0.01" value={f.income_current ?? 0} onChange={num('income_current')} />
              </Field>
            </div>
          </div>

          {/* Venda */}
          <div>
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3">Comercialização</div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Fee Transação (%)">
                <input className={numCls} type="number" step="0.1" value={f.transaction_fee ?? 5} onChange={num('transaction_fee')} />
              </Field>
              <Field label="Margem Comercialização (%)">
                <input className={numCls} type="number" step="0.1" value={f.commercialization ?? 15} onChange={num('commercialization')} />
              </Field>
              <Field label="Asking Price Override (€)">
                <input className={numCls} type="number" step="1000" value={f.asking_price ?? ''} onChange={num('asking_price')} placeholder="(automático)" />
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
