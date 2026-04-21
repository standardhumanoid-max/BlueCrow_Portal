import { useState } from 'react'
import { X, CheckCircle, AlertCircle, Loader, AlertTriangle } from 'lucide-react'
import * as XLSX from 'xlsx'
import { parseImportFile, normaliseKey, ASSET_COL_MAP, IGNORED_COLS } from '../lib/importExcel'
import type { ParsedImport } from '../lib/importExcel'
import { upsertAssetByName, upsertValuation } from '../lib/api'
import type { Asset } from '../lib/api'

interface Props {
  onClose: () => void
  onComplete: () => void
}

type Phase = 'idle' | 'parsing' | 'preview' | 'importing' | 'done' | 'error'

interface PreviewState {
  file: File
  assetCount: number
  valuationCount: number
  parseErrors: string[]
  /** [excel header, mapped field or null, sample value] */
  mappings: [string, string | null, string][]
  unmappedCount: number
}

interface ProgressState { current: number; total: number; label: string }
interface ResultState { created: number; updated: number; valuations: number; skipped: string[]; errors: string[] }


export function ImportModal({ onClose, onComplete }: Props) {
  const [phase,        setPhase]        = useState<Phase>('idle')
  const [preview,      setPreview]      = useState<PreviewState | null>(null)
  const [parsedImport, setParsedImport] = useState<ParsedImport | null>(null)
  const [progress,     setProgress]     = useState<ProgressState>({ current: 0, total: 0, label: '' })
  const [result,       setResult]       = useState<ResultState | null>(null)
  const [errMsg,       setErrMsg]       = useState<string | null>(null)

  // ── Step 1: read file → show preview ──────────────────────────────────────
  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    setPhase('parsing')
    setErrMsg(null)

    try {
      const [data, parsed] = await Promise.all([
        file.arrayBuffer(),
        parseImportFile(file),
      ])

      const wb = XLSX.read(new Uint8Array(data), { type: 'array', raw: false })

      const assetsSheetName = wb.SheetNames.find(s => s.toUpperCase() === 'APP_ASSETS')
      const valuationsSheetName = wb.SheetNames.find(s => s.toUpperCase() === 'APP_VALUATIONS')

      if (!assetsSheetName) {
        setErrMsg('Folha APP_ASSETS não encontrada no ficheiro.')
        setPhase('error')
        return
      }

      const rawRows: Record<string, any>[] = XLSX.utils.sheet_to_json(
        wb.Sheets[assetsSheetName], { defval: null, raw: false }
      )

      const firstRow = rawRows[0] ?? {}
      const headers = Object.keys(firstRow)

      const mappings: [string, string | null, string][] = headers.map(h => {
        const norm = normaliseKey(h)
        const ignored = IGNORED_COLS.has(norm)
        const mapped = ignored ? '(ignorado)' : (ASSET_COL_MAP[norm] ?? null)
        const sample = firstRow[h] != null ? String(firstRow[h]).slice(0, 30) : '—'
        return [h, mapped as string | null, sample]
      })

      const unmappedCount = mappings.filter(([, m]) => m === null).length

      let valuationCount = 0
      if (valuationsSheetName) {
        const vRows: any[] = XLSX.utils.sheet_to_json(wb.Sheets[valuationsSheetName], { defval: null, raw: false })
        vRows.forEach(r => {
          const keys = Object.keys(r).slice(1)
          keys.forEach(k => { if (/^\d{4}$/.test(k) && r[k] != null) valuationCount++ })
        })
      }

      setParsedImport(parsed)
      setPreview({
        file,
        assetCount: rawRows.length,
        valuationCount,
        parseErrors: [],
        mappings,
        unmappedCount,
      })
      setPhase('preview')
    } catch (err: any) {
      setErrMsg(`Erro ao ler ficheiro: ${err.message}`)
      setPhase('error')
    }
  }

  // ── Step 2: confirm → run import ──────────────────────────────────────────
  async function runImport() {
    if (!preview || !parsedImport) return
    setPhase('importing')
    setErrMsg(null)

    const { assets: importedAssets, valuations: importedValuations, errors: parseErrors } = parsedImport
    const res: ResultState = { created: 0, updated: 0, valuations: 0, skipped: [...parseErrors], errors: [] }

    try {
      const nameToId = new Map<string, string>()
      let step = 0
      const total = importedAssets.length + importedValuations.length

      for (const row of importedAssets) {
        step++
        if (!row.name) continue
        setProgress({ current: step, total, label: `A importar: ${row.name}` })
        try {
          const saved = await upsertAssetByName(row)
          nameToId.set(row.name.trim().toLowerCase(), saved.id)
          res.created++  // upsert — treat all as created for simplicity
        } catch (err: any) {
          res.errors.push(`${row.name}: ${err.message}`)
        }
      }

      for (const valRow of importedValuations) {
        step++
        const normName = valRow.asset_name.trim().toLowerCase()
        const assetId = nameToId.get(normName)
        setProgress({ current: step, total, label: `Avaliações: ${valRow.asset_name}` })
        if (!assetId) {
          res.skipped.push(`Avaliações de "${valRow.asset_name}" — ativo não encontrado.`)
          continue
        }
        for (const { year, value } of valRow.years) {
          if (value === null) continue
          try { await upsertValuation(assetId, year, value); res.valuations++ }
          catch (err: any) { res.errors.push(`Avaliação ${valRow.asset_name}/${year}: ${err.message}`) }
        }
      }

      setResult(res)
      setPhase('done')
      onComplete()
    } catch (err: any) {
      setErrMsg(`Erro durante importação: ${err.message}`)
      setPhase('error')
    }
  }

  const pct = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0

  return (
    <div className="ga-modal-overlay" onClick={phase === 'idle' ? onClose : undefined}>
      <div className="ga-modal-box" style={{ maxWidth: 640 }} onClick={e => e.stopPropagation()}>

        <div className="ga-modal-header">
          <div className="ga-modal-title">Importar do Excel</div>
          {(phase === 'idle' || phase === 'preview' || phase === 'done' || phase === 'error') && (
            <button className="ga-modal-close" onClick={onClose}><X size={16} /></button>
          )}
        </div>

        <div style={{ padding: '20px' }}>

          {/* IDLE */}
          {phase === 'idle' && (
            <div>
              <p style={{ fontSize: 13, color: 'var(--ink-muted)', marginBottom: 16, lineHeight: 1.6 }}>
                Selecione um ficheiro <strong>.xlsx</strong> com as folhas:
              </p>
              <ul style={{ fontSize: 13, color: 'var(--ink-muted)', marginBottom: 20, paddingLeft: 20, lineHeight: 2 }}>
                <li><code style={codeStyle}>APP_ASSETS</code> — dados dos ativos</li>
                <li><code style={codeStyle}>APP_VALUATIONS</code> — avaliações por ano (opcional)</li>
              </ul>
              <p style={{ fontSize: 12, color: 'var(--ink-faint)', marginBottom: 20 }}>
                Ativos existentes (mesmo nome) são <strong>atualizados</strong>. Novos são <strong>criados</strong>.
              </p>
              <label className="ga-btn-primary" style={{ cursor: 'pointer', display: 'inline-flex' }}>
                Selecionar ficheiro .xlsx
                <input type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={handleFile} />
              </label>
            </div>
          )}

          {/* PARSING */}
          {phase === 'parsing' && (
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <Loader size={28} className="animate-spin" style={{ color: 'var(--accent)', margin: '0 auto 12px' }} />
              <p style={{ fontSize: 13, color: 'var(--ink-muted)' }}>A analisar ficheiro…</p>
            </div>
          )}

          {/* PREVIEW */}
          {phase === 'preview' && preview && (
            <div>
              {/* Summary */}
              <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                <Badge label="Ativos" value={preview.assetCount} color="var(--navy)" />
                {preview.valuationCount > 0 && <Badge label="Avaliações" value={preview.valuationCount} color="var(--blue)" />}
                {preview.unmappedCount > 0 && <Badge label="Colunas não mapeadas" value={preview.unmappedCount} color="var(--amber)" />}
              </div>

              {preview.unmappedCount > 0 && (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, background: 'var(--amber-soft)', border: '1px solid rgba(138,91,18,0.15)', borderRadius: 8, padding: '10px 12px', marginBottom: 14, fontSize: 12, color: 'var(--amber)' }}>
                  <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                  <span>{preview.unmappedCount} coluna(s) sem mapeamento serão ignoradas. Verifique a tabela abaixo.</span>
                </div>
              )}

              {/* Mapping table */}
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-faint)', marginBottom: 6 }}>
                Mapeamento de colunas (APP_ASSETS)
              </div>
              <div style={{ maxHeight: 300, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8, marginBottom: 16 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: 'var(--cream)', borderBottom: '1px solid var(--border)' }}>
                      <th style={thStyle}>Coluna Excel</th>
                      <th style={thStyle}>Campo BD</th>
                      <th style={thStyle}>1ª linha</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.mappings.map(([header, mapped, sample], i) => {
                      const isIgnored = mapped === '(ignorado)'
                      const isUnmapped = mapped === null
                      return (
                        <tr key={i} style={{ borderBottom: '1px solid rgba(26,28,34,0.04)', background: isUnmapped ? 'rgba(138,91,18,0.04)' : 'transparent' }}>
                          <td style={{ padding: '7px 10px', fontFamily: 'var(--font-mono)', color: isUnmapped ? 'var(--amber)' : 'var(--ink)' }}>{header}</td>
                          <td style={{ padding: '7px 10px', fontFamily: 'var(--font-mono)', color: isIgnored ? 'var(--ink-faint)' : isUnmapped ? 'var(--amber)' : 'var(--green)' }}>
                            {isUnmapped ? '⚠ não mapeado' : mapped}
                          </td>
                          <td style={{ padding: '7px 10px', color: 'var(--ink-faint)', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sample}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button className="ga-btn-secondary" onClick={() => setPhase('idle')}>← Trocar ficheiro</button>
                <button className="ga-btn-primary" onClick={runImport}>Confirmar e Importar</button>
              </div>
            </div>
          )}

          {/* IMPORTING */}
          {phase === 'importing' && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <Loader size={16} className="animate-spin" style={{ color: 'var(--accent)', flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: 'var(--ink-muted)', flex: 1, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                  {progress.label}
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-faint)' }}>{pct}%</span>
              </div>
              <div style={{ background: 'var(--border)', borderRadius: 100, height: 6, overflow: 'hidden' }}>
                <div style={{ height: '100%', background: 'var(--accent)', borderRadius: 100, width: `${pct}%`, transition: 'width 0.2s ease' }} />
              </div>
              <p style={{ fontSize: 12, color: 'var(--ink-faint)', marginTop: 10 }}>
                {progress.current} / {progress.total} registos
              </p>
            </div>
          )}

          {/* ERROR */}
          {phase === 'error' && (
            <div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, color: 'var(--red)', marginBottom: 16 }}>
                <AlertCircle size={18} style={{ flexShrink: 0, marginTop: 1 }} />
                <pre style={{ fontSize: 12, whiteSpace: 'pre-wrap', margin: 0, lineHeight: 1.6 }}>{errMsg}</pre>
              </div>
              <button className="ga-btn-secondary" onClick={() => setPhase('idle')}>← Voltar</button>
            </div>
          )}

          {/* DONE */}
          {phase === 'done' && result && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--green)', marginBottom: 16 }}>
                <CheckCircle size={18} />
                <span style={{ fontSize: 14, fontWeight: 600 }}>Importação concluída</span>
              </div>
              <div style={{ background: 'var(--cream)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px', marginBottom: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                  <Stat label="Processados" value={result.created}    color="var(--green)" />
                  <Stat label="Atualizados" value={result.updated}    color="var(--accent)" />
                  <Stat label="Avaliações"  value={result.valuations} color="var(--blue)" />
                </div>
              </div>
              {result.errors.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--red)', marginBottom: 6 }}>{result.errors.length} erro(s):</p>
                  <ul style={{ fontSize: 12, color: 'var(--red)', paddingLeft: 18, lineHeight: 1.8 }}>
                    {result.errors.slice(0, 10).map((e, i) => <li key={i}>{e}</li>)}
                    {result.errors.length > 10 && <li>+{result.errors.length - 10} mais…</li>}
                  </ul>
                </div>
              )}
              {result.skipped.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-faint)', marginBottom: 6 }}>{result.skipped.length} aviso(s):</p>
                  <ul style={{ fontSize: 12, color: 'var(--ink-faint)', paddingLeft: 18, lineHeight: 1.8 }}>
                    {result.skipped.slice(0, 5).map((s, i) => <li key={i}>{s}</li>)}
                    {result.skipped.length > 5 && <li>+{result.skipped.length - 5} mais…</li>}
                  </ul>
                </div>
              )}
              <button className="ga-btn-primary" onClick={onClose}>Fechar</button>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const codeStyle: React.CSSProperties = { background: 'var(--navy-soft)', padding: '1px 6px', borderRadius: 4, fontFamily: 'var(--font-mono)' }
const thStyle: React.CSSProperties   = { padding: '7px 10px', textAlign: 'left', fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 600, color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '0.08em' }

function Badge({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ background: 'var(--cream)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', textAlign: 'center', flex: 1 }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--ink-faint)', marginTop: 2 }}>{label}</div>
    </div>
  )
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--ink-faint)', marginTop: 2 }}>{label}</div>
    </div>
  )
}
