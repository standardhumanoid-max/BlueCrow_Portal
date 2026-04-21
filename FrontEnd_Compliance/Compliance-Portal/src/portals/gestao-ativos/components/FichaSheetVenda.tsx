import { useState } from 'react'
import { Plus } from 'lucide-react'
import type { AssetDetail, Asset, Valuation, Bov } from '../lib/api'
import { updateAsset, upsertValuation, upsertBov, upsertNote } from '../lib/api'
import {
  calcTotalCost, calcCapitalCost, calcBreakEven, calcBreakEvenCash,
  calcYieldOnCost, calcAskingBCC, calcBluecrowGross, calcBluecrowNet,
  calcTransactionFee, fmtEur, fmtPct, fmtPctRaw
} from '../lib/finance'

interface Props {
  detail: AssetDetail
  onRefresh: () => void
}

type EditSection = 'identity' | 'costs' | 'capex' | 'capital' | 'income' | 'sale' | null

export function FichaSheetVenda({ detail, onRefresh }: Props) {
  const [editSection, setEditSection] = useState<EditSection>(null)
  const [draft,       setDraft]       = useState<Partial<Asset>>({})
  const [saving,      setSaving]      = useState(false)
  const [noteBody,    setNoteBody]    = useState(detail.note?.body ?? '')
  const [editNote,    setEditNote]    = useState(false)
  const [newValYear,  setNewValYear]  = useState('')
  const [newValValue, setNewValValue] = useState('')
  const [newBovLabel, setNewBovLabel] = useState('')
  const [newBovValue, setNewBovValue] = useState('')
  const [newBovNotes, setNewBovNotes] = useState('')
  const [addingVal,   setAddingVal]   = useState(false)
  const [addingBov,   setAddingBov]   = useState(false)

  const a = editSection ? { ...detail, ...draft } : detail

  function startEdit(section: EditSection) {
    setDraft({ ...detail })
    setEditSection(section)
  }

  async function saveSection() {
    setSaving(true)
    try {
      await updateAsset(detail.id, draft)
      await onRefresh()
      setEditSection(null)
    } finally {
      setSaving(false)
    }
  }

  function cancelEdit() {
    setEditSection(null)
    setDraft({})
  }

  const totalCost    = calcTotalCost(a as Asset)
  const capitalCost  = calcCapitalCost(a as Asset)
  const breakEven    = calcBreakEven(a as Asset)
  const breakEvenCash = calcBreakEvenCash(a as Asset)
  const yieldOnCost  = calcYieldOnCost(a as Asset)
  const askingBCC    = calcAskingBCC(a as Asset)
  const txFee        = calcTransactionFee(a as Asset)
  const bcGross      = calcBluecrowGross(a as Asset)
  const bcNet        = calcBluecrowNet(a as Asset)

  const valuations = [...detail.valuations].sort((x, y) => y.year.localeCompare(x.year))
  const bovs = [...detail.bovs]

  return (
    <div className="ga-sheet-body">

      {/* 1. Identificação */}
      <EditableSection title="Identificação"
        editing={editSection === 'identity'} onEdit={() => startEdit('identity')}
        onSave={saveSection} onCancel={cancelEdit} saving={saving}>
        {editSection === 'identity' ? (
          <div className="ga-inline-form-grid">
            <FieldInput label="Nome" value={draft.name ?? ''} onChange={v => setDraft(d => ({ ...d, name: v }))} />
            <FieldInput label="SPV" value={draft.spv ?? ''} onChange={v => setDraft(d => ({ ...d, spv: v }))} />
            <FieldInput label="Localização" value={draft.location ?? ''} onChange={v => setDraft(d => ({ ...d, location: v }))} />
            <FieldInput label="Tipologia" value={draft.typology ?? ''} onChange={v => setDraft(d => ({ ...d, typology: v }))} />
            <FieldInput label="Inquilino" value={draft.tenant ?? ''} onChange={v => setDraft(d => ({ ...d, tenant: v }))} />
            <FieldInput label="Área Terreno (m²)" type="number" value={String(draft.land_area ?? '')} onChange={v => setDraft(d => ({ ...d, land_area: parseFloat(v) || null }))} />
            <FieldInput label="Área Construção (m²)" type="number" value={String(draft.build_area ?? '')} onChange={v => setDraft(d => ({ ...d, build_area: parseFloat(v) || null }))} />
            <FieldInput label="Data Aquisição" type="date" value={draft.acquisition_date ?? ''} onChange={v => setDraft(d => ({ ...d, acquisition_date: v }))} />
            <FieldInput label="Link Google Maps" value={draft.maps_link ?? ''} onChange={v => setDraft(d => ({ ...d, maps_link: v }))} className="col-span-2" />
            <FieldSelect label="Status" value={draft.status ?? ''} onChange={v => setDraft(d => ({ ...d, status: v as any }))}
              options={[['em_rendimento','Em Rendimento'],['sem_rendimento','Sem Rendimento'],['em_venda','Em Venda'],['vendido','Vendido']]} />
            <FieldInput label="Notas gerais" value={draft.general_notes ?? ''} onChange={v => setDraft(d => ({ ...d, general_notes: v }))} className="col-span-2" />
          </div>
        ) : (
          <div className="ga-field-grid">
            <Field label="SPV"          value={detail.spv} />
            <Field label="Localização"  value={detail.location} />
            <Field label="Tipologia"    value={detail.typology} />
            <Field label="Inquilino"    value={detail.tenant} />
            <Field label="Área Terreno" value={detail.land_area ? `${detail.land_area} m²` : null} />
            <Field label="Área Construção" value={detail.build_area ? `${detail.build_area} m²` : null} />
            <Field label="Data Aquisição" value={detail.acquisition_date ? new Date(detail.acquisition_date).toLocaleDateString('pt-PT') : null} />
            <Field label="Status"       value={detail.status} />
            {detail.general_notes && <Field label="Notas" value={detail.general_notes} />}
          </div>
        )}
      </EditableSection>

      {/* 2. Custos de Aquisição */}
      <EditableSection title="Custos de Aquisição"
        editing={editSection === 'costs'} onEdit={() => startEdit('costs')}
        onSave={saveSection} onCancel={cancelEdit} saving={saving}>
        {editSection === 'costs' ? (
          <div className="ga-inline-form-grid">
            <FieldInput label="Preço Compra (€)" type="number" value={String(draft.purchase_price ?? '')} onChange={v => setDraft(d => ({ ...d, purchase_price: parseFloat(v) || 0 }))} />
            <FieldInput label="Sisa / IS (€)" type="number" value={String(draft.stamp_duty ?? '')} onChange={v => setDraft(d => ({ ...d, stamp_duty: parseFloat(v) || 0 }))} />
            <FieldInput label="Escritura/Notário (€)" type="number" value={String(draft.notary_fees ?? '')} onChange={v => setDraft(d => ({ ...d, notary_fees: parseFloat(v) || 0 }))} />
          </div>
        ) : (
          <div className="ga-field-grid">
            <Field label="Preço Compra"    value={fmtEur(detail.purchase_price)} />
            <Field label="Sisa / IS"       value={fmtEur(detail.stamp_duty)} />
            <Field label="Escritura/Notário" value={fmtEur(detail.notary_fees)} />
          </div>
        )}
      </EditableSection>

      {/* 3. CAPEX / OPEX */}
      <EditableSection title="CAPEX / OPEX"
        editing={editSection === 'capex'} onEdit={() => startEdit('capex')}
        onSave={saveSection} onCancel={cancelEdit} saving={saving}>
        {editSection === 'capex' ? (
          <div className="ga-inline-form-grid">
            <FieldInput label="CAPEX (€)" type="number" value={String(draft.capex_current ?? '')} onChange={v => setDraft(d => ({ ...d, capex_current: parseFloat(v) || 0 }))} />
            <FieldInput label="OPEX (€)" type="number" value={String(draft.opex_current ?? '')} onChange={v => setDraft(d => ({ ...d, opex_current: parseFloat(v) || 0 }))} />
          </div>
        ) : (
          <div className="ga-field-grid">
            <Field label="CAPEX" value={fmtEur(detail.capex_current)} />
            <Field label="OPEX"  value={fmtEur(detail.opex_current)} />
          </div>
        )}
      </EditableSection>

      {/* 4. Custo de Capital */}
      <EditableSection title="Custo de Capital"
        editing={editSection === 'capital'} onEdit={() => startEdit('capital')}
        onSave={saveSection} onCancel={cancelEdit} saving={saving}>
        {editSection === 'capital' ? (
          <div className="ga-inline-form-grid">
            <FieldInput label="Taxa (%)" type="number" value={String(draft.capital_cost ?? '')} onChange={v => setDraft(d => ({ ...d, capital_cost: parseFloat(v) || 0 }))} />
            <FieldInput label="Override Valor (€)" type="number" value={String(draft.capital_cost_v ?? '')} onChange={v => setDraft(d => ({ ...d, capital_cost_v: parseFloat(v) || null }))} />
            <div className="col-span-2" style={{ fontSize: 11, color: 'var(--ink-faint)' }}>
              Se definir um Override, esse valor é usado diretamente em vez do calculado pela taxa.
            </div>
          </div>
        ) : (
          <div className="ga-field-grid">
            <Field label="Taxa"            value={fmtPctRaw(detail.capital_cost)} />
            <Field label="Valor Calculado" value={fmtEur(capitalCost)} />
            <Field label="Override"        value={detail.capital_cost_v != null ? fmtEur(detail.capital_cost_v) : '—'} />
          </div>
        )}
      </EditableSection>

      {/* 5. Rendimento */}
      <EditableSection title="Rendimento"
        editing={editSection === 'income'} onEdit={() => startEdit('income')}
        onSave={saveSection} onCancel={cancelEdit} saving={saving}>
        {editSection === 'income' ? (
          <div className="ga-inline-form-grid">
            <FieldInput label="Rendimento Anual (€)" type="number" value={String(draft.income_current ?? '')} onChange={v => setDraft(d => ({ ...d, income_current: parseFloat(v) || 0 }))} />
          </div>
        ) : (
          <div className="ga-field-grid">
            <Field label="Rendimento Atual" value={fmtEur(detail.income_current)} />
          </div>
        )}
        <div className="ga-metrics-divider" />
        <div className="ga-metrics-grid">
          <MetricRow label="Custo Total"           value={fmtEur(totalCost)} />
          <MetricRow label="Custo de Capital"      value={fmtEur(capitalCost)} />
          <MetricRow label="Break-Even (c/ renda)" value={fmtEur(breakEven)} />
          <MetricRow label="Break-Even Cash"       value={fmtEur(breakEvenCash)} />
          <MetricRow label="Yield on Cost"         value={fmtPct(yieldOnCost)} accent={yieldOnCost > 0.06 ? 'green' : yieldOnCost > 0.03 ? undefined : 'red'} />
        </div>
      </EditableSection>

      {/* 6. Análise de Venda */}
      <EditableSection title="Análise de Venda"
        editing={editSection === 'sale'} onEdit={() => startEdit('sale')}
        onSave={saveSection} onCancel={cancelEdit} saving={saving}>
        {editSection === 'sale' ? (
          <div className="ga-inline-form-grid">
            <FieldInput label="Oferta (Bidding Offer) (€)" type="number" value={String(draft.bidding_offer ?? '')} onChange={v => setDraft(d => ({ ...d, bidding_offer: parseFloat(v) || null }))} />
            <FieldInput label="Fee Transação (%)" type="number" value={String(draft.transaction_fee ?? '')} onChange={v => setDraft(d => ({ ...d, transaction_fee: parseFloat(v) || 0 }))} />
            <FieldInput label="Margem Comercialização (%)" type="number" value={String(draft.commercialization ?? '')} onChange={v => setDraft(d => ({ ...d, commercialization: parseFloat(v) || 0 }))} />
            <FieldInput label="Asking Price (€)" type="number" value={String(draft.asking_price ?? '')} onChange={v => setDraft(d => ({ ...d, asking_price: parseFloat(v) || null }))} />
          </div>
        ) : (
          <div className="ga-field-grid">
            <Field label="Oferta"                value={fmtEur(detail.bidding_offer)} />
            <Field label="Fee Transação"         value={fmtPctRaw(detail.transaction_fee)} />
            <Field label="Margem Comercialização" value={fmtPctRaw(detail.commercialization)} />
            <Field label="Asking Price"          value={detail.asking_price ? fmtEur(detail.asking_price) : '(automático)'} />
          </div>
        )}
        <div className="ga-metrics-divider" />
        <div className="ga-metrics-grid">
          <MetricRow label="Asking BCC (teórico)" value={fmtEur(askingBCC)} />
          <MetricRow label="Fee"                  value={fmtEur(txFee)} />
          <MetricRow label="BlueCrow Gross"       value={fmtEur(bcGross)} accent={bcGross < 0 ? 'red' : 'green'} />
          <MetricRow label="BlueCrow Net"         value={fmtEur(bcNet)}   accent={bcNet  < 0 ? 'red' : 'green'} />
        </div>
      </EditableSection>

      {/* 7. Avaliações */}
      <div className="ga-sheet-section">
        <div className="ga-sheet-section-header">
          <div className="ga-sheet-section-title">Avaliações por Ano</div>
          <button className="ga-btn-secondary" onClick={() => setAddingVal(v => !v)}>
            <Plus size={13} /> Adicionar
          </button>
        </div>

        {addingVal && (
          <div className="ga-tenancy-card editing">
            <div className="ga-inline-form-grid">
              <FieldInput label="Ano" value={newValYear} onChange={setNewValYear} />
              <FieldInput label="Valor (€)" type="number" value={newValValue} onChange={setNewValValue} />
            </div>
            <div className="ga-inline-form-actions">
              <button className="ga-btn-secondary" onClick={() => setAddingVal(false)}>Cancelar</button>
              <button className="ga-btn-primary" onClick={async () => {
                if (!newValYear) return
                await upsertValuation(detail.id, newValYear, parseFloat(newValValue) || 0)
                await onRefresh()
                setNewValYear(''); setNewValValue(''); setAddingVal(false)
              }}>Guardar</button>
            </div>
          </div>
        )}

        <div className="ga-year-cards">
          {valuations.length === 0 && !addingVal
            ? <div className="ga-empty-state">Nenhuma avaliação registada.</div>
            : valuations.map(v => (
              <div key={v.id} className="ga-year-card">
                <div className="ga-year-label">{v.year}</div>
                <div className="ga-year-value">{fmtEur(v.value, true)}</div>
              </div>
            ))
          }
        </div>
      </div>

      {/* 8. BOVs */}
      <div className="ga-sheet-section">
        <div className="ga-sheet-section-header">
          <div className="ga-sheet-section-title">BOVs</div>
          <button className="ga-btn-secondary" onClick={() => setAddingBov(v => !v)}>
            <Plus size={13} /> Adicionar
          </button>
        </div>

        {addingBov && (
          <div className="ga-tenancy-card editing">
            <div className="ga-inline-form-grid">
              <FieldInput label="Label" value={newBovLabel} onChange={setNewBovLabel} />
              <FieldInput label="Valor (€)" type="number" value={newBovValue} onChange={setNewBovValue} />
              <FieldInput label="Notas" value={newBovNotes} onChange={setNewBovNotes} className="col-span-2" />
            </div>
            <div className="ga-inline-form-actions">
              <button className="ga-btn-secondary" onClick={() => setAddingBov(false)}>Cancelar</button>
              <button className="ga-btn-primary" onClick={async () => {
                if (!newBovLabel) return
                await upsertBov(detail.id, newBovLabel, parseFloat(newBovValue) || null, newBovNotes || null)
                await onRefresh()
                setNewBovLabel(''); setNewBovValue(''); setNewBovNotes(''); setAddingBov(false)
              }}>Guardar</button>
            </div>
          </div>
        )}

        <div className="ga-year-cards">
          {bovs.length === 0 && !addingBov
            ? <div className="ga-empty-state">Nenhum BOV registado.</div>
            : bovs.map(b => (
              <div key={b.id} className="ga-year-card">
                <div className="ga-year-label">{b.label}</div>
                <div className="ga-year-value">{fmtEur(b.value, true)}</div>
                {b.notes && <div className="ga-year-notes">{b.notes}</div>}
              </div>
            ))
          }
        </div>
      </div>

      {/* 9. Notas */}
      <div className="ga-sheet-section">
        <div className="ga-sheet-section-header">
          <div className="ga-sheet-section-title">Notas</div>
          {!editNote && (
            <button className="ga-btn-secondary" onClick={() => {
              setNoteBody(detail.note?.body ?? '')
              setEditNote(true)
            }}>Editar</button>
          )}
        </div>
        {editNote ? (
          <div>
            <textarea className="ga-inline-input w-full" rows={5}
              value={noteBody} onChange={e => setNoteBody(e.target.value)} />
            <div className="ga-inline-form-actions" style={{ marginTop: '0.5rem' }}>
              <button className="ga-btn-secondary" onClick={() => setEditNote(false)}>Cancelar</button>
              <button className="ga-btn-primary" onClick={async () => {
                await upsertNote(detail.id, noteBody)
                await onRefresh()
                setEditNote(false)
              }}>Guardar</button>
            </div>
          </div>
        ) : (
          <div className="ga-note-body">
            {detail.note?.body || <span className="ga-empty-state">Sem notas.</span>}
          </div>
        )}
      </div>

    </div>
  )
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function EditableSection({ title, editing, onEdit, onSave, onCancel, saving, children }: {
  title: string; editing: boolean
  onEdit: () => void; onSave: () => void; onCancel: () => void
  saving: boolean; children: React.ReactNode
}) {
  return (
    <div className="ga-sheet-section">
      <div className="ga-sheet-section-header">
        <div className="ga-sheet-section-title">{title}</div>
        {editing
          ? <div className="ga-inline-form-actions" style={{ margin: 0 }}>
              <button className="ga-btn-secondary" onClick={onCancel}>Cancelar</button>
              <button className="ga-btn-primary" onClick={onSave} disabled={saving}>
                {saving ? 'A guardar…' : 'Guardar'}
              </button>
            </div>
          : <button className="ga-btn-secondary" onClick={onEdit}>Editar</button>
        }
      </div>
      {children}
    </div>
  )
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="ga-field">
      <div className="ga-field-label">{label}</div>
      <div className="ga-field-value">{value ?? '—'}</div>
    </div>
  )
}

function FieldInput({ label, value, onChange, type = 'text', className }: {
  label: string; value: string; onChange: (v: string) => void
  type?: string; className?: string
}) {
  return (
    <label className={className}>
      <span>{label}</span>
      <input className="ga-inline-input" type={type} value={value} onChange={e => onChange(e.target.value)} />
    </label>
  )
}

function FieldSelect({ label, value, onChange, options, className }: {
  label: string; value: string; onChange: (v: string) => void
  options: [string, string][]; className?: string
}) {
  return (
    <label className={className}>
      <span>{label}</span>
      <select className="ga-inline-input" value={value} onChange={e => onChange(e.target.value)}>
        {options.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </select>
    </label>
  )
}

function MetricRow({ label, value, accent }: { label: string; value: string; accent?: 'red' | 'green' }) {
  const cls = accent === 'red' ? 'text-red-600' : accent === 'green' ? 'text-green-700' : ''
  return (
    <div className="ga-metric-row">
      <span className="ga-metric-label">{label}</span>
      <span className={`ga-metric-value ga-table-mono ${cls}`}>{value}</span>
    </div>
  )
}
