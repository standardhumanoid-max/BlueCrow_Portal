import { useState, useEffect } from 'react'
import { useDatabase } from '../hooks/useDatabase'
import { FUNDS, CONVERTIBLE, VALUATION_METHODS, COMPANY_TYPES } from '../types/database'
import type {
  CapTableShareholder,
  Company,
  DebtAssessmentItem,
  FinancialYear,
  RunwayData,
  Sale,
  ShareholderType,
  Tranche,
  TrancheType,
  Valuation,
  ValuationMethod,
} from '../types/database'

const TRANCHE_TYPES: TrancheType[] = ['Equity', ...CONVERTIBLE, 'Mútuo', 'Evento Cap Table']

function uid() {
  return crypto.randomUUID()
}

// ── EMPTY TEMPLATES ──
function emptyCompany(): Company {
  return {
    id: uid(),
    name: '',
    tranches: [],
    sales: [],
    log: [],
    financials: [],
    capTable: [],
    runway: {},
    pipeline: { currentStage: 'Não iniciado', dates: {}, notes: '', history: [] },
  }
}
function emptyTranche(): Tranche {
  return { id: uid(), fund: FUNDS[0], type: 'Equity', amount: 0 }
}
function emptyValuation(): Valuation {
  return { id: uid(), companyId: '', date: new Date().toISOString().slice(0, 10), equityValue: 0 }
}
function emptySale(): Sale {
  return { id: uid(), fund: FUNDS[0], amount: 0 }
}
function emptyFinancialYear(): FinancialYear {
  return { id: uid(), year: new Date().getFullYear() }
}
function emptyCapTableShareholder(): CapTableShareholder {
  return { id: uid(), name: '', type: 'Other' }
}

interface SettingsPageProps {
  initialCompanyId?: string | null
  initialTab?: string | null
}

export function SettingsPage({ initialCompanyId, initialTab }: SettingsPageProps = {}) {
  const { db, loading, error, save } = useDatabase()
  const [selectedId, setSelectedId] = useState<string | null>(initialCompanyId ?? null)
  const [draft, setDraft] = useState<Company | null>(null)
  const [tab, setTab] = useState<'details' | 'info' | 'tranches' | 'avaliacoes' | 'vendas'>(
    () => (['details', 'info', 'tranches', 'avaliacoes', 'vendas'].includes(initialTab ?? '')
      ? initialTab as 'details' | 'info' | 'tranches' | 'avaliacoes' | 'vendas'
      : 'details')
  )
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)

  // Sync draft when selection changes
  useEffect(() => {
    if (!db || !selectedId) { setDraft(null); setDirty(false); return }
    const c = db.companies.find(c => c.id === selectedId) ?? null
    setDraft(c ? JSON.parse(JSON.stringify(c)) : null)
    setDirty(false)
  }, [selectedId, db])

  if (loading) return <div className="page-shell"><p style={{ color: 'var(--text-muted)' }}>A carregar...</p></div>
  if (error) return <div className="page-shell"><p style={{ color: 'var(--crimson-400)' }}>Erro: {error}</p></div>
  if (!db) return null

  function updateDraft(patch: Partial<Company>) {
    setDraft(prev => prev ? { ...prev, ...patch } : prev)
    setDirty(true)
  }

  async function handleSave() {
    if (!draft || !db) return
    setSaving(true)
    const updated = { ...db, companies: db.companies.map(c => c.id === draft.id ? draft : c) }
    await save(updated)
    setSaving(false)
    setDirty(false)
  }

  function handleAddCompany() {
    if (!db) return
    const c = emptyCompany()
    void save({ ...db, companies: [...db.companies, c] })
    setSelectedId(c.id)
    setTab('details')
  }

  function handleDeleteCompany() {
    if (!db || !selectedId) return
    if (!confirm('Eliminar esta empresa? Esta ação não pode ser revertida.')) return
    void save({ ...db, companies: db.companies.filter(c => c.id !== selectedId) })
    setSelectedId(null)
    setDraft(null)
  }

  // ── TRANCHE helpers ──
  function addTranche() {
    if (!draft) return
    setDraft({ ...draft, tranches: [...draft.tranches, emptyTranche()] })
    setDirty(true)
  }
  function updateTranche(id: string, patch: Partial<Tranche>) {
    if (!draft) return
    setDraft({ ...draft, tranches: draft.tranches.map(t => t.id === id ? { ...t, ...patch } : t) })
    setDirty(true)
  }
  function removeTranche(id: string) {
    if (!draft) return
    setDraft({ ...draft, tranches: draft.tranches.filter(t => t.id !== id) })
    setDirty(true)
  }

  // ── VALUATION helpers ──
  const companyValuations = db.valuations.filter(v => v.companyId === selectedId)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  async function addValuation() {
    if (!db || !selectedId) return
    const v = { ...emptyValuation(), companyId: selectedId }
    await save({ ...db, valuations: [...db.valuations, v] })
  }
  async function updateValuation(id: string, patch: Partial<Valuation>) {
    if (!db) return
    await save({ ...db, valuations: db.valuations.map(v => v.id === id ? { ...v, ...patch } : v) })
  }
  async function removeValuation(id: string) {
    if (!db) return
    await save({ ...db, valuations: db.valuations.filter(v => v.id !== id) })
  }

  // ── SALE helpers ──
  function updateSale(id: string, patch: Partial<Sale>) {
    if (!draft) return
    setDraft({ ...draft, sales: (draft.sales || []).map(s => s.id === id ? { ...s, ...patch } : s) })
    setDirty(true)
  }
  function removeSale(id: string) {
    if (!draft) return
    setDraft({ ...draft, sales: (draft.sales || []).filter(s => s.id !== id) })
    setDirty(true)
  }

  const companies = [...db.companies].sort((a, b) => (a.name || '').localeCompare(b.name || ''))

  return (
    <div className="page-shell">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Configurações</h1>
          <p className="page-subtitle">Gerir empresas, tranches e avaliações</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 16, alignItems: 'start' }}>

        {/* ── COMPANY LIST ── */}
        <div className="card" style={{ position: 'sticky', top: 20 }}>
          <div className="card-header">
            <span className="card-title">Empresas</span>
            <button style={iconBtn} onClick={handleAddCompany} title="Nova empresa">＋</button>
          </div>
          <div style={{ maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' }}>
            {companies.map(c => (
              <button
                key={c.id}
                onClick={() => { setSelectedId(c.id); setTab('details') }}
                style={{
                  display: 'block', width: '100%', textAlign: 'left',
                  padding: '9px 14px', border: 0, background: 'none', cursor: 'pointer',
                  fontSize: 13, borderBottom: '1px solid var(--border)',
                  color: c.id === selectedId ? 'var(--gold-500)' : 'var(--text-secondary)',
                  fontWeight: c.id === selectedId ? 600 : 400,
                  backgroundColor: c.id === selectedId ? 'var(--gold-100)' : 'transparent',
                  transition: 'background 120ms',
                }}
              >
                {c.name || <span style={{ color: 'var(--text-disabled)' }}>Nova empresa</span>}
              </button>
            ))}
            {companies.length === 0 && (
              <div className="empty-state" style={{ padding: 24 }}>Sem empresas</div>
            )}
          </div>
        </div>

        {/* ── EDITOR ── */}
        {!draft ? (
          <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
            Seleciona uma empresa para editar
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {/* Tabs */}
            <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)', marginBottom: 16 }}>
              {(['details', 'info', 'tranches', 'avaliacoes', 'vendas'] as const).map(t => (
                <button key={t} onClick={() => setTab(t)} style={{
                  padding: '8px 16px', border: 0, background: 'none', cursor: 'pointer',
                  fontSize: 12, fontWeight: 600, letterSpacing: '0.04em',
                  color: tab === t ? 'var(--gold-500)' : 'var(--text-muted)',
                  borderBottom: tab === t ? '2px solid var(--gold-500)' : '2px solid transparent',
                  marginBottom: -1, transition: 'color 130ms',
                }}>
                  {{ details: 'Dados', info: 'Info', tranches: 'Tranches', avaliacoes: 'Avaliações', vendas: 'Vendas' }[t]}
                </button>
              ))}
              <div style={{ flex: 1 }} />
              <button onClick={handleDeleteCompany} style={{ ...iconBtn, color: 'var(--crimson-400)', marginRight: 8 }} title="Eliminar empresa">🗑</button>
            </div>

            {/* ── TAB: DETAILS ── */}
            {tab === 'details' && (
              <div className="card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={twoCol}>
                  <Field label="Nome" value={draft.name} onChange={v => updateDraft({ name: v })} required />
                  <Field label="Sector" value={draft.sector ?? ''} onChange={v => updateDraft({ sector: v || undefined })} />
                </div>
                <div style={twoCol}>
                  <Field label="País" value={draft.country ?? ''} onChange={v => updateDraft({ country: v || undefined })} />
                  <div className="field">
                    <label className="field-label">Tipo</label>
                    <select
                      className="field-input"
                      value={draft.companyType ?? ''}
                      onChange={e => updateDraft({ companyType: e.target.value as typeof COMPANY_TYPES[number] || undefined })}
                      style={{ height: 36 }}
                    >
                      <option value="">—</option>
                      {COMPANY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                </div>
                <div style={twoCol}>
                  <FieldNum label="Total Ações" value={draft.totalShares} onChange={v => updateDraft({ totalShares: v })} />
                </div>
                <div style={twoCol}>
                  <FieldNum label="ESOP" value={draft.esop} onChange={v => updateDraft({ esop: v })} />
                  <FieldNum label="Outras dilutivas" value={draft.otherDilutive} onChange={v => updateDraft({ otherDilutive: v })} />
                </div>
                <div style={twoCol}>
                  <FieldNum label="Series B Ações" value={draft.seriesBShares} onChange={v => updateDraft({ seriesBShares: v })} />
                  <FieldNum label="Series B Preço (€)" value={draft.seriesBPrice} onChange={v => updateDraft({ seriesBPrice: v })} />
                </div>
              </div>
            )}

            {/* ── TAB: TRANCHES ── */}
            {tab === 'info' && (
              <div className="card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
                <div style={twoCol}>
                  <Field label="Website" value={draft.website ?? ''} onChange={v => updateDraft({ website: v || undefined })} />
                </div>

                <div className="field">
                  <label className="field-label">Resumo</label>
                  <textarea
                    value={draft.summary ?? ''}
                    onChange={e => updateDraft({ summary: e.target.value || undefined })}
                    rows={3}
                    style={textareaStyle}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>
                    Runway
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 160px', gap: 14 }}>
                    <FieldNum
                      label="Cash Balance (€)"
                      value={draft.runway?.cashBalance}
                      onChange={v => updateDraft({ runway: { ...(draft.runway ?? {}), cashBalance: v } satisfies RunwayData })}
                    />
                    <FieldNum
                      label="Monthly Burn (€/mês)"
                      value={draft.runway?.monthlyBurn}
                      onChange={v => updateDraft({ runway: { ...(draft.runway ?? {}), monthlyBurn: v } satisfies RunwayData })}
                    />
                    <div className="field">
                      <label className="field-label">Last Updated</label>
                      <InlineDate
                        value={draft.runway?.lastUpdated ?? ''}
                        onChange={v => updateDraft({ runway: { ...(draft.runway ?? {}), lastUpdated: v || undefined } satisfies RunwayData })}
                      />
                    </div>
                  </div>

                  <div className="field">
                    <label className="field-label">Notas</label>
                    <textarea
                      value={draft.runway?.notes ?? ''}
                      onChange={e => updateDraft({ runway: { ...(draft.runway ?? {}), notes: e.target.value || undefined } satisfies RunwayData })}
                      rows={3}
                      style={textareaStyle}
                    />
                  </div>
                </div>

                <div className="card">
                  <div className="card-header">
                    <span className="card-title">Financeiros</span>
                    <button style={iconBtn} onClick={() => updateDraft({ financials: [...(draft.financials || []), emptyFinancialYear()] })}>
                      ＋ Ano
                    </button>
                  </div>
                  <div className="table-wrap">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Ano</th>
                          <th className="right">Revenue</th>
                          <th className="right">Equity</th>
                          <th className="right">Total Assets</th>
                          <th className="right">Total Liabilities</th>
                          <th className="right">Net Profit</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {(draft.financials || []).length === 0 && (
                          <tr>
                            <td colSpan={7} className="empty-state">Sem dados financeiros</td>
                          </tr>
                        )}
                        {(draft.financials || []).map(row => (
                          <tr key={row.id}>
                            <td className="right">
                              <InlineNum
                                value={row.year}
                                onChange={v => updateDraft({
                                  financials: (draft.financials || []).map(item =>
                                    item.id === row.id ? { ...item, year: v ?? new Date().getFullYear() } : item,
                                  ),
                                })}
                              />
                            </td>
                            <td className="right"><InlineNum value={row.revenue} onChange={v => updateDraft({ financials: (draft.financials || []).map(item => item.id === row.id ? { ...item, revenue: v } : item) })} /></td>
                            <td className="right"><InlineNum value={row.equity} onChange={v => updateDraft({ financials: (draft.financials || []).map(item => item.id === row.id ? { ...item, equity: v } : item) })} /></td>
                            <td className="right"><InlineNum value={row.totalAssets} onChange={v => updateDraft({ financials: (draft.financials || []).map(item => item.id === row.id ? { ...item, totalAssets: v } : item) })} /></td>
                            <td className="right"><InlineNum value={row.totalLiabilities} onChange={v => updateDraft({ financials: (draft.financials || []).map(item => item.id === row.id ? { ...item, totalLiabilities: v } : item) })} /></td>
                            <td className="right"><InlineNum value={row.netProfit} onChange={v => updateDraft({ financials: (draft.financials || []).map(item => item.id === row.id ? { ...item, netProfit: v } : item) })} /></td>
                            <td>
                              <button style={{ ...iconBtn, color: 'var(--crimson-400)' }} onClick={() => updateDraft({ financials: (draft.financials || []).filter(item => item.id !== row.id) })}>✕</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="card">
                  <div className="card-header">
                    <span className="card-title">Cap Table Externo</span>
                    <button style={iconBtn} onClick={() => updateDraft({ capTable: [...(draft.capTable || []), emptyCapTableShareholder()] })}>
                      ＋ Acionista
                    </button>
                  </div>
                  <div className="table-wrap">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Type</th>
                          <th className="right">Shares</th>
                          <th className="right">Pct</th>
                          <th>Round</th>
                          <th>Notes</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {(draft.capTable || []).length === 0 && (
                          <tr>
                            <td colSpan={7} className="empty-state">Sem acionistas externos</td>
                          </tr>
                        )}
                        {(draft.capTable || []).map(row => (
                          <tr key={row.id}>
                            <td>
                              <input
                                value={row.name}
                                onChange={e => updateDraft({ capTable: (draft.capTable || []).map(item => item.id === row.id ? { ...item, name: e.target.value } : item) })}
                                style={{ ...inlineInput, width: '100%' }}
                              />
                            </td>
                            <td>
                              <select
                                style={inlineSelect}
                                value={row.type}
                                onChange={e => updateDraft({ capTable: (draft.capTable || []).map(item => item.id === row.id ? { ...item, type: e.target.value as ShareholderType } : item) })}
                              >
                                {(['Founders', 'VC', 'Employee', 'Other'] as ShareholderType[]).map(type => (
                                  <option key={type} value={type}>{type}</option>
                                ))}
                              </select>
                            </td>
                            <td className="right"><InlineNum value={row.shares} onChange={v => updateDraft({ capTable: (draft.capTable || []).map(item => item.id === row.id ? { ...item, shares: v } : item) })} /></td>
                            <td className="right"><InlineNum value={row.pct} onChange={v => updateDraft({ capTable: (draft.capTable || []).map(item => item.id === row.id ? { ...item, pct: v } : item) })} /></td>
                            <td>
                              <input
                                value={row.round ?? ''}
                                onChange={e => updateDraft({ capTable: (draft.capTable || []).map(item => item.id === row.id ? { ...item, round: e.target.value || undefined } : item) })}
                                style={{ ...inlineInput, width: '100%' }}
                              />
                            </td>
                            <td>
                              <input
                                value={row.notes ?? ''}
                                onChange={e => updateDraft({ capTable: (draft.capTable || []).map(item => item.id === row.id ? { ...item, notes: e.target.value || undefined } : item) })}
                                style={{ ...inlineInput, width: '100%' }}
                              />
                            </td>
                            <td>
                              <button style={{ ...iconBtn, color: 'var(--crimson-400)' }} onClick={() => updateDraft({ capTable: (draft.capTable || []).filter(item => item.id !== row.id) })}>✕</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {tab === 'tranches' && (
              <div className="card">
                <div className="card-header">
                  <span className="card-title">Tranches ({draft.tranches.length})</span>
                  <button style={iconBtn} onClick={addTranche}>＋ Adicionar</button>
                </div>
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Fundo</th>
                        <th>Tipo</th>
                        <th className="right">Montante (€)</th>
                        <th className="right">Ações</th>
                        <th className="right">Preço/Ação</th>
                        <th>Data</th>
                        <th>Conv.</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {draft.tranches.length === 0 && (
                        <tr><td colSpan={8} className="empty-state">Sem tranches</td></tr>
                      )}
                      {draft.tranches.map(t => (
                        <tr key={t.id}>
                          <td>
                            <select style={inlineSelect} value={t.fund} onChange={e => updateTranche(t.id, { fund: e.target.value as typeof FUNDS[number] })}>
                              {FUNDS.map(f => <option key={f} value={f}>{f}</option>)}
                            </select>
                          </td>
                          <td>
                            <select style={inlineSelect} value={t.type} onChange={e => updateTranche(t.id, { type: e.target.value as TrancheType })}>
                              {TRANCHE_TYPES.map(tt => <option key={tt} value={tt}>{tt}</option>)}
                            </select>
                          </td>
                          <td className="right"><InlineNum value={t.amount} onChange={v => updateTranche(t.id, { amount: v ?? 0 })} /></td>
                          <td className="right"><InlineNum value={t.shares} onChange={v => updateTranche(t.id, { shares: v ?? undefined })} /></td>
                          <td className="right"><InlineNum value={t.pricePerShare} onChange={v => updateTranche(t.id, { pricePerShare: v ?? undefined })} /></td>
                          <td><InlineDate value={t.date ?? ''} onChange={v => updateTranche(t.id, { date: v || undefined })} /></td>
                          <td style={{ textAlign: 'center' }}>
                            <input type="checkbox" checked={!!t.converted} onChange={e => updateTranche(t.id, { converted: e.target.checked })} />
                          </td>
                          <td>
                            <button style={{ ...iconBtn, color: 'var(--crimson-400)' }} onClick={() => removeTranche(t.id)}>✕</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ── TAB: AVALIAÇÕES ── */}
            {tab === 'avaliacoes' && (
              <ValuationEditor
                valuations={companyValuations}
                company={draft}
                onAdd={() => void addValuation()}
                onUpdate={(id, patch) => void updateValuation(id, patch)}
                onRemove={(id) => void removeValuation(id)}
              />
            )}

            {/* ── TAB: VENDAS ── */}
            {tab === 'vendas' && (() => {
              // Compute gross shares per fund from non-converted tranches
              const grossByFund: Record<string, number> = {}
              for (const t of draft.tranches || []) {
                if (t.converted || t.type === 'Evento Cap Table' || !(+(t.shares || 0) > 0) || !t.fund) continue
                grossByFund[t.fund] = (grossByFund[t.fund] || 0) + (+(t.shares || 0))
              }
              // Funds that have any equity position
              const fundsWithPositions = FUNDS.filter(f => (grossByFund[f] || 0) > 0)
              // Sold shares per fund (across all saved sales)
              const soldByFund: Record<string, number> = {}
              for (const s of draft.sales || []) {
                if (s.fund) soldByFund[s.fund] = (soldByFund[s.fund] || 0) + (+(s.shares || 0))
              }
              const availableByFund: Record<string, number> = {}
              for (const f of fundsWithPositions) {
                availableByFund[f] = Math.max(0, (grossByFund[f] || 0) - (soldByFund[f] || 0))
              }

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {/* Position summary */}
                  {fundsWithPositions.length > 0 && (
                    <div className="card" style={{ padding: '12px 16px' }}>
                      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 10 }}>
                        Posições de Equity
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {fundsWithPositions.map(f => {
                          const gross = grossByFund[f] || 0
                          const sold = soldByFund[f] || 0
                          const avail = availableByFund[f] || 0
                          return (
                            <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 12 }}>
                              <span style={{ fontWeight: 600, minWidth: 70, color: 'var(--text-secondary)' }}>{f}</span>
                              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                                {gross.toLocaleString('pt-PT')} ações totais
                              </span>
                              {sold > 0 && (
                                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--crimson-500)', fontSize: 11 }}>
                                  − {sold.toLocaleString('pt-PT')} vendidas
                                </span>
                              )}
                              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: avail > 0 ? 'var(--jade-500)' : 'var(--text-disabled)' }}>
                                = {avail.toLocaleString('pt-PT')} disponíveis
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  <div className="card">
                    <div className="card-header">
                      <span className="card-title">Vendas / Saídas ({(draft.sales || []).length})</span>
                      <button
                        style={iconBtn}
                        onClick={() => {
                          const defaultFund = fundsWithPositions[0] ?? FUNDS[0]
                          if (!draft) return
                          setDraft({ ...draft, sales: [...(draft.sales || []), { ...emptySale(), fund: defaultFund }] })
                          setDirty(true)
                        }}
                      >
                        ＋ Adicionar
                      </button>
                    </div>
                    <div className="table-wrap">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Fundo</th>
                            <th className="right">Ações vendidas</th>
                            <th style={{ fontSize: 10, color: 'var(--text-muted)' }}>Disponíveis</th>
                            <th className="right">Montante (€)</th>
                            <th>Data</th>
                            <th></th>
                          </tr>
                        </thead>
                        <tbody>
                          {(draft.sales || []).length === 0 && (
                            <tr><td colSpan={6} className="empty-state">Sem vendas</td></tr>
                          )}
                          {(draft.sales || []).map(s => {
                            const gross = grossByFund[s.fund] || 0
                            // available for this row = gross − all OTHER sales for this fund
                            const otherSold = (draft.sales || [])
                              .filter(x => x.id !== s.id && x.fund === s.fund)
                              .reduce((sum, x) => sum + (+(x.shares || 0)), 0)
                            const rowAvail = Math.max(0, gross - otherSold)
                            const over = (+(s.shares || 0)) > rowAvail && rowAvail > 0
                            return (
                              <tr key={s.id}>
                                <td>
                                  <select
                                    style={inlineSelect}
                                    value={s.fund}
                                    onChange={e => updateSale(s.id, { fund: e.target.value as typeof FUNDS[number] })}
                                  >
                                    {/* Show all funds with positions; also include current if somehow not in list */}
                                    {[...new Set([...fundsWithPositions, s.fund])].map(f => (
                                      <option key={f} value={f}>{f}</option>
                                    ))}
                                  </select>
                                </td>
                                <td className="right">
                                  <InlineNum value={s.shares} onChange={v => updateSale(s.id, { shares: v ?? undefined })} />
                                </td>
                                <td style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: over ? 'var(--crimson-500)' : 'var(--text-muted)', paddingLeft: 8 }}>
                                  {gross > 0 ? `${rowAvail.toLocaleString('pt-PT')} disp.` : '—'}
                                  {over && <span style={{ marginLeft: 4, fontWeight: 700 }}>⚠</span>}
                                </td>
                                <td className="right"><InlineNum value={s.amount} onChange={v => updateSale(s.id, { amount: v ?? 0 })} /></td>
                                <td><InlineDatePT value={s.date ?? ''} onChange={v => updateSale(s.id, { date: v || undefined })} /></td>
                                <td>
                                  <button style={{ ...iconBtn, color: 'var(--crimson-400)' }} onClick={() => removeSale(s.id)}>✕</button>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )
            })()}

            {/* ── SAVE BAR ── */}
            {(tab === 'details' || tab === 'info' || tab === 'tranches' || tab === 'vendas') && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 14 }}>
                {dirty && <span style={{ fontSize: 12, color: 'var(--amber-400)', alignSelf: 'center' }}>Alterações não guardadas</span>}
                <button
                  className="primary-button"
                  style={{ width: 'auto', height: 38, padding: '0 24px', fontSize: 13 }}
                  onClick={() => void handleSave()}
                  disabled={saving || !dirty}
                >
                  {saving ? 'A guardar...' : 'Guardar'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── SMALL COMPONENTS ──

function Field({ label, value, onChange, required }: { label: string; value: string; onChange: (v: string) => void; required?: boolean }) {
  return (
    <div className="field">
      <label className="field-label">{label}{required && ' *'}</label>
      <input className="field-input" value={value} onChange={e => onChange(e.target.value)} style={{ height: 38, fontSize: 13 }} />
    </div>
  )
}

function FieldNum({ label, value, onChange }: { label: string; value: number | undefined; onChange: (v: number | undefined) => void }) {
  return (
    <div className="field">
      <label className="field-label">{label}</label>
      <input
        className="field-input"
        type="number"
        value={value ?? ''}
        onChange={e => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
        style={{ height: 38, fontSize: 13 }}
      />
    </div>
  )
}

function InlineNum({ value, onChange }: { value: number | undefined; onChange: (v: number | undefined) => void }) {
  return (
    <input
      type="number"
      value={value ?? ''}
      onChange={e => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
      style={{ ...inlineInput, textAlign: 'right', width: 110 }}
    />
  )
}

function InlineDate({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      type="date"
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{ ...inlineInput, width: 130 }}
    />
  )
}

// Date input that stores dd/mm/yyyy (PT format) but uses native date picker
function InlineDatePT({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  // dd/mm/yyyy → yyyy-mm-dd for the input value
  function toISO(v: string): string {
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(v)) {
      const [d, m, y] = v.split('/')
      return `${y}-${m}-${d}`
    }
    return v
  }
  // yyyy-mm-dd → dd/mm/yyyy for storage
  function toPT(v: string): string {
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
      const [y, m, d] = v.split('-')
      return `${d}/${m}/${y}`
    }
    return v
  }
  return (
    <input
      type="date"
      value={toISO(value)}
      onChange={e => onChange(toPT(e.target.value))}
      style={{ ...inlineInput, width: 130 }}
    />
  )
}

// ── STYLE CONSTANTS ──
const twoCol: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }
const iconBtn: React.CSSProperties = {
  border: 0, background: 'none', cursor: 'pointer',
  fontSize: 12, color: 'var(--text-muted)', fontWeight: 600,
  padding: '2px 6px', borderRadius: 4,
}
const inlineSelect: React.CSSProperties = {
  border: '1px solid var(--border)', borderRadius: 4,
  background: 'var(--surface-raised)', color: 'var(--text-secondary)',
  padding: '2px 6px', fontSize: 12, cursor: 'pointer',
}
const inlineInput: React.CSSProperties = {
  border: '1px solid var(--border)', borderRadius: 4,
  background: 'var(--surface-raised)', color: 'var(--text-primary)',
  padding: '3px 7px', fontSize: 12, fontFamily: 'var(--font-mono)',
  outline: 'none',
}
const textareaStyle: React.CSSProperties = {
  border: '1px solid var(--border-strong)',
  borderRadius: 8,
  background: 'var(--surface-raised)',
  padding: '8px 12px',
  color: 'var(--text-primary)',
  fontSize: 13,
  resize: 'vertical',
  outline: 'none',
  fontFamily: 'var(--font-body)',
}

function methodBadgeStyle(method: string): React.CSSProperties {
  const map: Record<string, React.CSSProperties> = {
    'DCF':               { background: 'rgba(26,95,224,0.1)',  color: '#1a5fe0', borderColor: 'rgba(26,95,224,0.2)' },
    'TMR':               { background: 'rgba(109,40,217,0.1)', color: '#6d28d9', borderColor: 'rgba(109,40,217,0.2)' },
    'Custo de Aquisição':{ background: 'rgba(107,114,128,0.1)',color: '#4b5563', borderColor: 'rgba(107,114,128,0.2)' },
    'Múltiplos':         { background: 'rgba(22,163,74,0.1)',  color: '#15803d', borderColor: 'rgba(22,163,74,0.2)'  },
    'Outro':             { background: 'rgba(217,119,6,0.1)',  color: '#b45309', borderColor: 'rgba(217,119,6,0.2)'  },
  }
  return map[method] ?? { background: 'var(--surface-raised)', color: 'var(--text-muted)', borderColor: 'var(--border)' }
}

// ── VALUATION EDITOR ──
function ValuationEditor({
  valuations, company, onAdd, onUpdate, onRemove,
}: {
  valuations: Valuation[]
  company: Company
  onAdd: () => void
  onUpdate: (id: string, patch: Partial<Valuation>) => void
  onRemove: (id: string) => void
}) {
  const [expanded, setExpanded] = useState<string | null>(null)

  // Only debt-like tranches that are not converted
  const debtTranches = (company.tranches || []).filter(
    t => !t.converted && (t.type === 'Mútuo' || (CONVERTIBLE as readonly string[]).includes(t.type))
  )

  function updateDebtItem(v: Valuation, itemId: string, patch: Partial<DebtAssessmentItem>) {
    const items = (v.debtAssessment || []).map(d => d.id === itemId ? { ...d, ...patch } : d)
    onUpdate(v.id, { debtAssessment: items })
  }
  function addDebtItem(v: Valuation, tranche: Tranche) {
    const alreadyExists = (v.debtAssessment || []).some(d => d.id === tranche.id)
    if (alreadyExists) return
    const item: DebtAssessmentItem = {
      id: tranche.id,
      label: `${tranche.type} — ${tranche.fund}`,
      instrumentType: tranche.type,
      nominalValue: tranche.amount || 0,
      fairValue: tranche.amount || 0,
    }
    onUpdate(v.id, { debtAssessment: [...(v.debtAssessment || []), item] })
  }
  function addExternalDebtItem(v: Valuation) {
    const item: DebtAssessmentItem = {
      id: uid(),
      label: 'SAFE — Externo',
      instrumentType: 'SAFE',
      nominalValue: 0,
      fairValue: 0,
    }
    onUpdate(v.id, { debtAssessment: [...(v.debtAssessment || []), item] })
  }
  function removeDebtItem(v: Valuation, itemId: string) {
    onUpdate(v.id, { debtAssessment: (v.debtAssessment || []).filter(d => d.id !== itemId) })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>
          {valuations.length} avaliações
        </span>
        <button style={{ ...iconBtn, border: '1px solid var(--border)', padding: '4px 10px' }} onClick={onAdd}>
          ＋ Nova avaliação
        </button>
      </div>

      {valuations.length === 0 && (
        <div className="card" style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>Sem avaliações</div>
      )}

      {valuations.map(v => {
        const isOpen = expanded === v.id
        return (
          <div key={v.id} className="card">
            {/* Row header */}
            <div
              onClick={() => setExpanded(isOpen ? null : v.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                cursor: 'pointer', userSelect: 'none',
                background: isOpen ? 'var(--gold-100)' : 'var(--surface-raised)',
              }}
            >
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)', minWidth: 80 }}>{v.date || '—'}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', flex: 1 }}>
                €{(v.equityValue || 0).toLocaleString('pt-PT')}
              </span>
              {v.method && (
                <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 4, border: '1px solid', ...methodBadgeStyle(v.method) }}>
                  {v.method}
                </span>
              )}
              {(v.debtAssessment?.length ?? 0) > 0 && (
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>+ {v.debtAssessment!.length} dívida</span>
              )}
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{isOpen ? '▲' : '▼'}</span>
              <button style={{ ...iconBtn, color: 'var(--crimson-400)' }} onClick={e => { e.stopPropagation(); onRemove(v.id) }}>✕</button>
            </div>

            {isOpen && (
              <div style={{ padding: '16px 14px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* Row 1: date + equity value + method */}
                <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr 1fr', gap: 12 }}>
                  <div className="field">
                    <label className="field-label">Data</label>
                    <input className="field-input" type="date" value={v.date} onChange={e => onUpdate(v.id, { date: e.target.value })} style={{ height: 36, fontSize: 13 }} />
                  </div>
                  <div className="field">
                    <label className="field-label">Equity Value (€)</label>
                    <input className="field-input" type="number" value={v.equityValue || ''} onChange={e => onUpdate(v.id, { equityValue: Number(e.target.value) })} style={{ height: 36, fontSize: 13 }} />
                  </div>
                  <div className="field">
                    <label className="field-label">Método</label>
                    <select className="filter-select" style={{ height: 36, width: '100%' }} value={v.method ?? ''} onChange={e => onUpdate(v.id, { method: (e.target.value || undefined) as ValuationMethod | undefined })}>
                      <option value="">— Método —</option>
                      {VALUATION_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                </div>

                {/* Row 2: WACC, Beta, Ke, Kd */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                  {([['WACC (%)', 'wacc'], ['Beta (β)', 'beta'], ['Ke (%)', 'ke'], ['Kd (%)', 'kd']] as [string, keyof Valuation][]).map(([label, key]) => (
                    <div key={key} className="field">
                      <label className="field-label">{label}</label>
                      <input
                        className="field-input" type="number" step="0.01"
                        value={(v[key] as number | undefined) ?? ''}
                        onChange={e => onUpdate(v.id, { [key]: e.target.value === '' ? undefined : Number(e.target.value) })}
                        style={{ height: 36, fontSize: 13 }}
                      />
                    </div>
                  ))}
                </div>

                {/* Notes */}
                <div className="field">
                  <label className="field-label">Notas</label>
                  <textarea
                    value={v.notes ?? ''}
                    onChange={e => onUpdate(v.id, { notes: e.target.value || undefined })}
                    rows={2}
                    style={{
                      border: '1px solid var(--border-strong)', borderRadius: 8,
                      background: 'var(--surface-raised)', padding: '8px 12px',
                      color: 'var(--text-primary)', fontSize: 13, resize: 'vertical',
                      outline: 'none', fontFamily: 'var(--font-body)',
                    }}
                  />
                </div>

                {/* BP Path */}
                <div className="field">
                  <label className="field-label">Pasta do BP (caminho)</label>
                  <input
                    className="field-input" type="text" placeholder="ex: C:\BPs\2025-H2\Empresa"
                    value={v.bpPath ?? ''}
                    onChange={e => onUpdate(v.id, { bpPath: e.target.value || undefined })}
                    style={{ height: 36, fontSize: 12, fontFamily: 'var(--font-mono)' }}
                  />
                </div>

                {/* BP Assumptions */}
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 10 }}>
                    Pressupostos Operacionais BP
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 10 }}>
                    {([
                      ['Revenue CAGR (%)', 'revenueCagr'],
                      ['EBITDA Margin TY (%)', 'ebitdaMarginTY'],
                      ['EBIT Margin TY (%)', 'ebitMarginTY'],
                      ['CAPEX / Revenue TY (%)', 'capexRevenueTY'],
                      ['NWC / Revenue TY (%)', 'nwcRevenueTY'],
                      ['Anos período explícito', 'explicitYears'],
                    ] as [string, keyof import('../types/database').BPAssumptions][]).map(([label, key]) => (
                      <div key={key} className="field">
                        <label className="field-label">{label}</label>
                        <input
                          className="field-input" type="number" step="0.1"
                          value={v.bpAssumptions?.[key] ?? ''}
                          onChange={e => {
                            const val = e.target.value === '' ? undefined : +e.target.value
                            onUpdate(v.id, {
                              bpAssumptions: { ...(v.bpAssumptions || {}), [key]: val },
                            })
                          }}
                          style={{ height: 32, fontSize: 12, fontFamily: 'var(--font-mono)' }}
                        />
                      </div>
                    ))}
                  </div>
                  <div className="field">
                    <label className="field-label">Notas pressupostos</label>
                    <textarea
                      className="field-input"
                      rows={2}
                      value={v.bpAssumptions?.notes ?? ''}
                      onChange={e => onUpdate(v.id, {
                        bpAssumptions: { ...(v.bpAssumptions || {}), notes: e.target.value || undefined },
                      })}
                      style={{ fontSize: 12, resize: 'vertical', padding: '6px 10px' }}
                      placeholder="Ex: Revenue CAGR comprimido vs BP anterior. Margens terminais conservadoras."
                    />
                  </div>
                </div>

                {/* Debt assessment */}
                <div>
                  <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>
                      Avaliação de Dívida / Quasi-Equity
                    </span>
                    <button
                      onClick={() => addExternalDebtItem(v)}
                      style={{ fontSize: 11, fontWeight: 600, padding: '2px 9px', borderRadius: 5, border: '1px dashed var(--border-strong)', cursor: 'pointer', background: 'var(--surface)', color: 'var(--azure-500)' }}
                    >
                      ＋ Externo
                    </button>
                  </div>

                  {/* Available tranches to add */}
                  {debtTranches.length > 0 && (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                      {debtTranches.map(t => {
                        const added = (v.debtAssessment || []).some(d => d.id === t.id)
                        return (
                          <button
                            key={t.id}
                            disabled={added}
                            onClick={() => addDebtItem(v, t)}
                            style={{
                              fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 5,
                              border: '1px solid var(--border-strong)', cursor: added ? 'default' : 'pointer',
                              background: added ? 'var(--surface-raised)' : 'var(--surface)',
                              color: added ? 'var(--text-disabled)' : 'var(--text-secondary)',
                            }}
                          >
                            {added ? '✓ ' : '＋ '}{t.type} — {t.fund}
                          </button>
                        )
                      })}
                    </div>
                  )}

                  {/* Items in assessment */}
                  {(v.debtAssessment || []).map(item => {
                    const isExternal = !(company.tranches || []).some(t => t.id === item.id)
                    return (
                    <div key={item.id} style={{ display: 'grid', gridTemplateColumns: isExternal ? '120px 1fr 110px 110px 70px 70px 28px' : '1fr 110px 110px 70px 70px 28px', gap: 8, marginBottom: 8, alignItems: 'end' }}>
                      {isExternal && (
                        <div className="field" style={{ margin: 0 }}>
                          <label className="field-label" style={{ fontSize: 9 }}>Tipo</label>
                          <select
                            className="filter-select"
                            value={item.instrumentType ?? 'SAFE'}
                            onChange={e => updateDebtItem(v, item.id, { instrumentType: e.target.value as TrancheType })}
                            style={{ height: 32, width: '100%', fontSize: 11 }}
                          >
                            {(['SAFE', 'CLN', 'Prest. Suplementares', 'Mútuo'] as TrancheType[]).map(tt => (
                              <option key={tt} value={tt}>{tt}</option>
                            ))}
                          </select>
                        </div>
                      )}
                      <div className="field" style={{ margin: 0 }}>
                        <label className="field-label" style={{ fontSize: 9 }}>Instrumento{isExternal ? '/Detentor' : ''}</label>
                        <input className="field-input" value={item.label} onChange={e => updateDebtItem(v, item.id, { label: e.target.value })} style={{ height: 32, fontSize: 12 }} />
                      </div>
                      <div className="field" style={{ margin: 0 }}>
                        <label className="field-label" style={{ fontSize: 9 }}>Nominal (€)</label>
                        <input className="field-input" type="number" value={item.nominalValue || ''} onChange={e => updateDebtItem(v, item.id, { nominalValue: Number(e.target.value) })} style={{ height: 32, fontSize: 12 }} />
                      </div>
                      <div className="field" style={{ margin: 0 }}>
                        <label className="field-label" style={{ fontSize: 9 }}>Fair Value (€)</label>
                        <input className="field-input" type="number" value={item.fairValue || ''} onChange={e => updateDebtItem(v, item.id, { fairValue: Number(e.target.value) })} style={{ height: 32, fontSize: 12 }} />
                      </div>
                      <div className="field" style={{ margin: 0 }}>
                        <label className="field-label" style={{ fontSize: 9 }}>Taxa (%)</label>
                        <input className="field-input" type="number" step="0.01" value={item.rate ?? ''} onChange={e => updateDebtItem(v, item.id, { rate: e.target.value === '' ? undefined : Number(e.target.value) })} style={{ height: 32, fontSize: 12 }} />
                      </div>
                      <div className="field" style={{ margin: 0 }}>
                        <label className="field-label" style={{ fontSize: 9 }}>Kd (%)</label>
                        <input className="field-input" type="number" step="0.01" value={item.kd ?? ''} onChange={e => updateDebtItem(v, item.id, { kd: e.target.value === '' ? undefined : Number(e.target.value) })} style={{ height: 32, fontSize: 12 }} />
                      </div>
                      <button style={{ ...iconBtn, color: 'var(--crimson-400)', alignSelf: 'end', height: 32 }} onClick={() => removeDebtItem(v, item.id)}>✕</button>
                    </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
