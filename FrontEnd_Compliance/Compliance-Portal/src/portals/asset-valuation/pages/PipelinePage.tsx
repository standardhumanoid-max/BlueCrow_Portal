import { useMemo, useState } from 'react'

import { useDatabase } from '../hooks/useDatabase'
import type {
  AppDatabase,
  Company,
  PipelineData,
  PipelineHistoryEntry,
} from '../types/database'

const STAGES = [
  'Não iniciado',
  'BP Em Preparação',
  'BP Recebido',
  'BP Aprovado',
  'Enviado Auditoria',
  'Auditoria Aprovada',
  'No Valutico',
  'Avaliação Concluída',
  'Enviado Backoffice',
  'Reportado CMVM',
] as const

type Stage = typeof STAGES[number]

function uid() {
  return crypto.randomUUID()
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

function getPipeline(company: Company): PipelineData {
  const pipeline = company.pipeline

  return {
    currentStage: pipeline?.currentStage || STAGES[0],
    dates: { ...(pipeline?.dates || {}) },
    notes: pipeline?.notes || '',
    history: [...(pipeline?.history || [])],
  }
}

function latestHistoryEntry(company: Company): PipelineHistoryEntry | null {
  const history = getPipeline(company).history || []
  return history.length ? history[history.length - 1] : null
}

export function PipelinePage() {
  const { db, save, loading, error } = useDatabase()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [pendingStages, setPendingStages] = useState<Partial<Record<string, Stage>>>(
    {},
  )
  const [transitionNotes, setTransitionNotes] = useState<Record<string, string>>(
    {},
  )
  const [notesDrafts, setNotesDrafts] = useState<Record<string, string>>({})

  const companies = useMemo(() => {
    if (!db) return []

    return [...db.companies].sort((a, b) => (a.name || '').localeCompare(b.name || ''))
  }, [db])

  const selectedCompany =
    companies.find((company) => company.id === selectedId) || companies[0] || null

  if (loading) {
    return (
      <div className="page-shell">
        <p style={{ color: 'var(--text-muted)' }}>A carregar...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="page-shell">
        <p style={{ color: 'var(--crimson-400)' }}>Erro: {error}</p>
      </div>
    )
  }

  if (!db) return null
  const currentDb: AppDatabase = db

  async function updateCompanyPipeline(
    companyId: string,
    updater: (pipeline: PipelineData) => PipelineData,
  ) {
    const updated: AppDatabase = {
      ...currentDb,
      companies: currentDb.companies.map((company) =>
        company.id === companyId
          ? { ...company, pipeline: updater(getPipeline(company)) }
          : company,
      ),
    }

    await save(updated)
  }

  async function changeStage(company: Company, nextStage: Stage, note?: string) {
    const currentPipeline = getPipeline(company)
    const currentStage = currentPipeline.currentStage || STAGES[0]

    if (currentStage === nextStage && !note?.trim()) {
      return
    }

    await updateCompanyPipeline(company.id, (pipeline) => ({
      ...pipeline,
      currentStage: nextStage,
      dates: {
        ...(pipeline.dates || {}),
        [nextStage]: (pipeline.dates || {})[nextStage] || today(),
      },
      history:
        currentStage === nextStage
          ? pipeline.history || []
          : [
              ...(pipeline.history || []),
              {
                id: uid(),
                fromStage: currentStage,
                toStage: nextStage,
                changedAt: today(),
                note: note?.trim() || undefined,
              },
            ],
    }))

    setPendingStages((prev) => ({ ...prev, [company.id]: nextStage }))
    setTransitionNotes((prev) => ({ ...prev, [company.id]: '' }))
  }

  async function updateStageDate(
    companyId: string,
    stage: Stage,
    value: string | undefined,
  ) {
    await updateCompanyPipeline(companyId, (pipeline) => {
      const dates = { ...(pipeline.dates || {}) }

      if (value) {
        dates[stage] = value
      } else {
        delete dates[stage]
      }

      return { ...pipeline, dates }
    })
  }

  async function saveControlNotes(companyId: string) {
    const nextNotes = notesDrafts[companyId] ?? ''

    await updateCompanyPipeline(companyId, (pipeline) => ({
      ...pipeline,
      notes: nextNotes || undefined,
    }))
  }

  return (
    <div className="page-shell">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Pipeline</h1>
          <p className="page-subtitle">
            Controlo do processo desde o BP até ao reporte final
          </p>
        </div>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Empresa</th>
                <th>Etapa Atual</th>
                <th>Última Mudança</th>
                <th>Notas</th>
              </tr>
            </thead>
            <tbody>
              {companies.length === 0 && (
                <tr>
                  <td colSpan={4} className="empty-state">
                    Sem empresas em pipeline
                  </td>
                </tr>
              )}

              {companies.map((company) => {
                const pipeline = getPipeline(company)
                const latestEntry = latestHistoryEntry(company)
                const currentStage = pipeline.currentStage || STAGES[0]

                return (
                  <tr
                    key={company.id}
                    onClick={() => setSelectedId(company.id)}
                    style={{
                      cursor: 'pointer',
                      background:
                        selectedCompany?.id === company.id
                          ? 'var(--gold-100)'
                          : undefined,
                    }}
                  >
                    <td>
                      <div
                        style={{ fontWeight: 600, color: 'var(--text-primary)' }}
                      >
                        {company.name}
                      </div>
                      {company.sector ? (
                        <div
                          style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}
                        >
                          {company.sector}
                        </div>
                      ) : null}
                    </td>
                    <td onClick={(event) => event.stopPropagation()}>
                      <select
                        className="filter-select"
                        value={currentStage}
                        onChange={(event) =>
                          void changeStage(company, event.target.value as Stage)
                        }
                      >
                        {STAGES.map((stage) => (
                          <option key={stage} value={stage}>
                            {stage}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      {latestEntry ? (
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                          {latestEntry.changedAt}
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>—</span>
                      )}
                    </td>
                    <td>
                      {pipeline.notes ? (
                        <div
                          style={{
                            fontSize: 12,
                            color: 'var(--text-muted)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            maxWidth: 280,
                          }}
                        >
                          {pipeline.notes}
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {selectedCompany ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1.2fr) minmax(320px, 0.8fr)',
            gap: 16,
            marginTop: 16,
            alignItems: 'start',
          }}
        >
          <div className="card">
            <div className="card-header">
              <span className="card-title">Etapas e Datas</span>
            </div>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Etapa</th>
                    <th>Data</th>
                  </tr>
                </thead>
                <tbody>
                  {STAGES.map((stage) => {
                    const pipeline = getPipeline(selectedCompany)

                    return (
                      <tr key={stage}>
                        <td>{stage}</td>
                        <td>
                          <input
                            type="date"
                            value={pipeline.dates?.[stage] || ''}
                            onChange={(event) =>
                              void updateStageDate(
                                selectedCompany.id,
                                stage,
                                event.target.value || undefined,
                              )
                            }
                            style={dateInputStyle}
                          />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="card" style={{ padding: 18 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 14,
                  gap: 12,
                }}
              >
                <div>
                  <div
                    style={{ fontWeight: 700, color: 'var(--text-primary)' }}
                  >
                    {selectedCompany.name}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {getPipeline(selectedCompany).currentStage || STAGES[0]}
                  </div>
                </div>

                <select
                  className="filter-select"
                  value={
                    pendingStages[selectedCompany.id] ||
                    (getPipeline(selectedCompany).currentStage as Stage) ||
                    STAGES[0]
                  }
                  onChange={(event) =>
                    setPendingStages((prev) => ({
                      ...prev,
                      [selectedCompany.id]: event.target.value as Stage,
                    }))
                  }
                >
                  {STAGES.map((stage) => (
                    <option key={stage} value={stage}>
                      {stage}
                    </option>
                  ))}
                </select>
              </div>

              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: 'var(--text-muted)',
                  marginBottom: 6,
                }}
              >
                Nota da mudança
              </div>
              <textarea
                value={transitionNotes[selectedCompany.id] ?? ''}
                onChange={(event) =>
                  setTransitionNotes((prev) => ({
                    ...prev,
                    [selectedCompany.id]: event.target.value,
                  }))
                }
                rows={3}
                placeholder="Ex: BP recebido e enviado para auditoria."
                style={textareaStyle}
              />

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
                <button
                  onClick={() =>
                    void changeStage(
                      selectedCompany,
                      pendingStages[selectedCompany.id] ||
                        (getPipeline(selectedCompany).currentStage as Stage) ||
                        STAGES[0],
                      transitionNotes[selectedCompany.id],
                    )
                  }
                  style={primaryActionBtn}
                >
                  Registar mudança
                </button>
              </div>
            </div>

            <div className="card" style={{ padding: 18 }}>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: 'var(--text-muted)',
                  marginBottom: 6,
                }}
              >
                Notas de Controlo
              </div>
              <textarea
                value={
                  notesDrafts[selectedCompany.id] ??
                  getPipeline(selectedCompany).notes ??
                  ''
                }
                onChange={(event) =>
                  setNotesDrafts((prev) => ({
                    ...prev,
                    [selectedCompany.id]: event.target.value,
                  }))
                }
                onBlur={() => void saveControlNotes(selectedCompany.id)}
                rows={4}
                placeholder="Notas gerais, próximos passos, pendências, etc."
                style={textareaStyle}
              />
            </div>

            <div className="card">
              <div className="card-header">
                <span className="card-title">Histórico</span>
              </div>
              <div style={{ padding: 14 }}>
                {(getPipeline(selectedCompany).history || []).length === 0 ? (
                  <div className="empty-state" style={{ padding: 20 }}>
                    Sem registo de mudanças
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {[...(getPipeline(selectedCompany).history || [])]
                      .slice()
                      .reverse()
                      .map((entry) => (
                        <div
                          key={entry.id}
                          style={{
                            border: '1px solid var(--border)',
                            borderRadius: 8,
                            padding: '10px 12px',
                            background: 'var(--surface-raised)',
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              gap: 12,
                              fontSize: 12,
                              marginBottom: 4,
                            }}
                          >
                            <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                              {entry.fromStage ? `${entry.fromStage} → ${entry.toStage}` : entry.toStage}
                            </span>
                            <span style={{ color: 'var(--text-muted)' }}>
                              {entry.changedAt}
                            </span>
                          </div>
                          {entry.note ? (
                            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                              {entry.note}
                            </div>
                          ) : null}
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

const dateInputStyle: React.CSSProperties = {
  border: '1px solid var(--border-strong)',
  borderRadius: 6,
  background: 'var(--surface)',
  color: 'var(--text-primary)',
  padding: '4px 8px',
  fontSize: 12,
  outline: 'none',
}

const textareaStyle: React.CSSProperties = {
  width: '100%',
  border: '1px solid var(--border-strong)',
  borderRadius: 8,
  background: 'var(--surface-raised)',
  padding: '9px 12px',
  color: 'var(--text-primary)',
  fontSize: 13,
  resize: 'vertical',
  outline: 'none',
  fontFamily: 'var(--font-body)',
  lineHeight: 1.5,
  boxSizing: 'border-box',
}

const primaryActionBtn: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  padding: '8px 12px',
  borderRadius: 6,
  border: 'none',
  background: 'var(--gold-500)',
  color: '#fff',
  cursor: 'pointer',
}
