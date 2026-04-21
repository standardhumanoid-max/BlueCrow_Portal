import { useState } from 'react'
import { Plus, Trash2, ExternalLink } from 'lucide-react'
import type { AssetDetail, Tenancy, AssetFile } from '../lib/api'
import { createTenancy, updateTenancy, deleteTenancy, createFile, deleteFile } from '../lib/api'
import { fmtEur } from '../lib/finance'

interface Props {
  detail: AssetDetail
  onRefresh: () => void
}

const LEASE_STATUS_LABELS: Record<string, string> = {
  ativo:      'Ativo',
  negociacao: 'Em Negociação',
  terminado:  'Terminado',
  vacante:    'Vacante',
}

const FILE_CAT_LABELS: Record<string, string> = {
  sale_pack:  'Sale Pack',
  photo:      'Fotografia',
  lease_doc:  'Documento Arrendamento',
  finance:    'Financeiro',
  other:      'Outro',
}

const FILE_CATS = ['sale_pack', 'photo', 'lease_doc', 'finance', 'other'] as const

export function FichaSheetArrendamentos({ detail, onRefresh }: Props) {
  const [addingTenancy, setAddingTenancy] = useState(false)
  const [addingFile,    setAddingFile]    = useState(false)
  const [editTenId,     setEditTenId]     = useState<string | null>(null)

  const activeRent = detail.tenancies
    .filter(t => t.lease_status === 'ativo')
    .reduce((s, t) => s + (t.monthly_rent ?? 0), 0)

  return (
    <div className="ga-sheet-body">
      {/* Lease summary */}
      <div className="ga-sheet-section">
        <div className="ga-sheet-section-title">Resumo de Arrendamentos</div>
        <div className="ga-metrics-grid">
          <div className="ga-metric-row">
            <span className="ga-metric-label">Total arrendamentos</span>
            <span className="ga-metric-value ga-table-mono">{detail.tenancies.length}</span>
          </div>
          <div className="ga-metric-row">
            <span className="ga-metric-label">Ativos</span>
            <span className="ga-metric-value ga-table-mono">
              {detail.tenancies.filter(t => t.lease_status === 'ativo').length}
            </span>
          </div>
          <div className="ga-metric-row">
            <span className="ga-metric-label">Renda mensal total</span>
            <span className="ga-metric-value ga-table-mono">{fmtEur(activeRent)}</span>
          </div>
          <div className="ga-metric-row">
            <span className="ga-metric-label">Renda anual total</span>
            <span className="ga-metric-value ga-table-mono">{fmtEur(activeRent * 12)}</span>
          </div>
        </div>
      </div>

      {/* Tenancies */}
      <div className="ga-sheet-section">
        <div className="ga-sheet-section-header">
          <div className="ga-sheet-section-title">Arrendamentos</div>
          <button className="ga-btn-secondary" onClick={() => setAddingTenancy(true)}>
            <Plus size={13} /> Adicionar
          </button>
        </div>

        {addingTenancy && (
          <TenancyForm
            assetId={detail.id}
            onSave={async data => {
              await createTenancy(detail.id, data)
              await onRefresh()
              setAddingTenancy(false)
            }}
            onCancel={() => setAddingTenancy(false)}
          />
        )}

        {detail.tenancies.length === 0 ? (
          <div className="ga-empty-state">Nenhum arrendamento registado.</div>
        ) : detail.tenancies.map(t => (
          <TenancyCard
            key={t.id}
            tenancy={t}
            editing={editTenId === t.id}
            onEdit={() => setEditTenId(t.id)}
            onSave={async data => {
              await updateTenancy(t.id, data)
              await onRefresh()
              setEditTenId(null)
            }}
            onCancel={() => setEditTenId(null)}
            onDelete={async () => {
              if (!confirm('Eliminar arrendamento?')) return
              await deleteTenancy(t.id)
              await onRefresh()
            }}
          />
        ))}
      </div>

      {/* Files by category */}
      <div className="ga-sheet-section">
        <div className="ga-sheet-section-header">
          <div className="ga-sheet-section-title">Documentos</div>
          <button className="ga-btn-secondary" onClick={() => setAddingFile(true)}>
            <Plus size={13} /> Adicionar
          </button>
        </div>

        {addingFile && (
          <FileForm
            onSave={async data => {
              await createFile(detail.id, data)
              await onRefresh()
              setAddingFile(false)
            }}
            onCancel={() => setAddingFile(false)}
          />
        )}

        {FILE_CATS.map(cat => {
          const files = detail.files.filter(f => f.category === cat)
          if (files.length === 0) return null
          return (
            <div key={cat} className="ga-file-group">
              <div className="ga-file-group-title">{FILE_CAT_LABELS[cat]}</div>
              {files.map(f => (
                <div key={f.id} className="ga-file-card">
                  <div className="ga-file-info">
                    <div className="ga-file-title">{f.title || '(sem título)'}</div>
                    {f.notes && <div className="ga-file-notes">{f.notes}</div>}
                  </div>
                  <div className="ga-file-actions">
                    {f.resource_link && (
                      <a href={f.resource_link} target="_blank" rel="noreferrer" className="ga-icon-btn">
                        <ExternalLink size={13} />
                      </a>
                    )}
                    <button className="ga-icon-btn danger" onClick={async () => {
                      if (!confirm('Eliminar documento?')) return
                      await deleteFile(f.id)
                      await onRefresh()
                    }}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        })}
        {detail.files.length === 0 && !addingFile && (
          <div className="ga-empty-state">Nenhum documento registado.</div>
        )}
      </div>
    </div>
  )
}

// ── TenancyCard ────────────────────────────────────────────────────────────────

function TenancyCard({ tenancy: t, editing, onEdit, onSave, onCancel, onDelete }: {
  tenancy: Tenancy; editing: boolean
  onEdit: () => void
  onSave: (d: Partial<Tenancy>) => void
  onCancel: () => void
  onDelete: () => void
}) {
  const [draft, setDraft] = useState<Partial<Tenancy>>({
    tenant_name:   t.tenant_name,
    tenant_nif:    t.tenant_nif,
    lease_status:  t.lease_status,
    monthly_rent:  t.monthly_rent,
    contract_start: t.contract_start,
    contract_end:  t.contract_end,
    document_link: t.document_link,
    notes:         t.notes,
  })

  if (editing) {
    return (
      <div className="ga-tenancy-card editing">
        <div className="ga-inline-form-grid">
          <label>
            <span>Inquilino</span>
            <input className="ga-inline-input" value={draft.tenant_name ?? ''} onChange={e => setDraft(d => ({ ...d, tenant_name: e.target.value }))} />
          </label>
          <label>
            <span>NIF</span>
            <input className="ga-inline-input" value={draft.tenant_nif ?? ''} onChange={e => setDraft(d => ({ ...d, tenant_nif: e.target.value }))} />
          </label>
          <label>
            <span>Estado</span>
            <select className="ga-inline-input" value={draft.lease_status ?? 'ativo'} onChange={e => setDraft(d => ({ ...d, lease_status: e.target.value as Tenancy['lease_status'] }))}>
              {Object.entries(LEASE_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <label>
            <span>Renda Mensal (€)</span>
            <input className="ga-inline-input" type="number" value={draft.monthly_rent ?? ''} onChange={e => setDraft(d => ({ ...d, monthly_rent: parseFloat(e.target.value) || null }))} />
          </label>
          <label>
            <span>Início</span>
            <input className="ga-inline-input" type="date" value={draft.contract_start ?? ''} onChange={e => setDraft(d => ({ ...d, contract_start: e.target.value || null }))} />
          </label>
          <label>
            <span>Fim</span>
            <input className="ga-inline-input" type="date" value={draft.contract_end ?? ''} onChange={e => setDraft(d => ({ ...d, contract_end: e.target.value || null }))} />
          </label>
          <label className="col-span-2">
            <span>Link Documento</span>
            <input className="ga-inline-input" value={draft.document_link ?? ''} onChange={e => setDraft(d => ({ ...d, document_link: e.target.value || null }))} />
          </label>
          <label className="col-span-2">
            <span>Notas</span>
            <textarea className="ga-inline-input" rows={2} value={draft.notes ?? ''} onChange={e => setDraft(d => ({ ...d, notes: e.target.value || null }))} />
          </label>
        </div>
        <div className="ga-inline-form-actions">
          <button className="ga-btn-secondary" onClick={onCancel}>Cancelar</button>
          <button className="ga-btn-primary" onClick={() => onSave(draft)}>Guardar</button>
        </div>
      </div>
    )
  }

  return (
    <div className="ga-tenancy-card">
      <div className="ga-tenancy-header">
        <div>
          <div className="ga-tenancy-name">{t.tenant_name || '(sem nome)'}</div>
          {t.tenant_nif && <div className="ga-tenancy-nif">NIF {t.tenant_nif}</div>}
        </div>
        <div className="ga-tenancy-right">
          <span className={`ga-pill ${t.lease_status === 'ativo' ? 'rendimento' : t.lease_status === 'negociacao' ? 'venda' : 'sem-rendimento'}`}>
            {LEASE_STATUS_LABELS[t.lease_status]}
          </span>
          <div className="ga-tenancy-rent">{fmtEur(t.monthly_rent)}/mês</div>
        </div>
      </div>
      {(t.contract_start || t.contract_end) && (
        <div className="ga-tenancy-dates">
          {t.contract_start ?? '—'} → {t.contract_end ?? '—'}
        </div>
      )}
      {t.notes && <div className="ga-tenancy-notes">{t.notes}</div>}
      <div className="ga-tenancy-actions">
        {t.document_link && (
          <a href={t.document_link} target="_blank" rel="noreferrer" className="ga-icon-btn"><ExternalLink size={13} /></a>
        )}
        <button className="ga-icon-btn" onClick={onEdit}>Editar</button>
        <button className="ga-icon-btn danger" onClick={onDelete}><Trash2 size={13} /></button>
      </div>
    </div>
  )
}

// ── TenancyForm ────────────────────────────────────────────────────────────────

function TenancyForm({ assetId, onSave, onCancel }: {
  assetId: string
  onSave: (d: Partial<Tenancy>) => void
  onCancel: () => void
}) {
  const [draft, setDraft] = useState<Partial<Tenancy>>({ lease_status: 'ativo' })
  return (
    <div className="ga-tenancy-card editing">
      <div className="ga-inline-form-grid">
        <label>
          <span>Inquilino</span>
          <input className="ga-inline-input" value={draft.tenant_name ?? ''} onChange={e => setDraft(d => ({ ...d, tenant_name: e.target.value }))} />
        </label>
        <label>
          <span>NIF</span>
          <input className="ga-inline-input" value={draft.tenant_nif ?? ''} onChange={e => setDraft(d => ({ ...d, tenant_nif: e.target.value }))} />
        </label>
        <label>
          <span>Estado</span>
          <select className="ga-inline-input" value={draft.lease_status ?? 'ativo'} onChange={e => setDraft(d => ({ ...d, lease_status: e.target.value as Tenancy['lease_status'] }))}>
            {Object.entries(LEASE_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <label>
          <span>Renda Mensal (€)</span>
          <input className="ga-inline-input" type="number" value={draft.monthly_rent ?? ''} onChange={e => setDraft(d => ({ ...d, monthly_rent: parseFloat(e.target.value) || null }))} />
        </label>
        <label>
          <span>Início</span>
          <input className="ga-inline-input" type="date" value={draft.contract_start ?? ''} onChange={e => setDraft(d => ({ ...d, contract_start: e.target.value || null }))} />
        </label>
        <label>
          <span>Fim</span>
          <input className="ga-inline-input" type="date" value={draft.contract_end ?? ''} onChange={e => setDraft(d => ({ ...d, contract_end: e.target.value || null }))} />
        </label>
      </div>
      <div className="ga-inline-form-actions">
        <button className="ga-btn-secondary" onClick={onCancel}>Cancelar</button>
        <button className="ga-btn-primary" onClick={() => onSave(draft)}>Guardar</button>
      </div>
    </div>
  )
}

// ── FileForm ──────────────────────────────────────────────────────────────────

function FileForm({ onSave, onCancel }: {
  onSave: (d: Partial<AssetFile>) => void
  onCancel: () => void
}) {
  const [draft, setDraft] = useState<Partial<AssetFile>>({ category: 'other' })
  return (
    <div className="ga-tenancy-card editing">
      <div className="ga-inline-form-grid">
        <label>
          <span>Título</span>
          <input className="ga-inline-input" value={draft.title ?? ''} onChange={e => setDraft(d => ({ ...d, title: e.target.value }))} />
        </label>
        <label>
          <span>Categoria</span>
          <select className="ga-inline-input" value={draft.category ?? 'other'} onChange={e => setDraft(d => ({ ...d, category: e.target.value as AssetFile['category'] }))}>
            {FILE_CATS.map(k => <option key={k} value={k}>{FILE_CAT_LABELS[k]}</option>)}
          </select>
        </label>
        <label className="col-span-2">
          <span>Link</span>
          <input className="ga-inline-input" value={draft.resource_link ?? ''} onChange={e => setDraft(d => ({ ...d, resource_link: e.target.value || null }))} />
        </label>
        <label className="col-span-2">
          <span>Notas</span>
          <input className="ga-inline-input" value={draft.notes ?? ''} onChange={e => setDraft(d => ({ ...d, notes: e.target.value || null }))} />
        </label>
      </div>
      <div className="ga-inline-form-actions">
        <button className="ga-btn-secondary" onClick={onCancel}>Cancelar</button>
        <button className="ga-btn-primary" onClick={() => onSave(draft)}>Guardar</button>
      </div>
    </div>
  )
}
