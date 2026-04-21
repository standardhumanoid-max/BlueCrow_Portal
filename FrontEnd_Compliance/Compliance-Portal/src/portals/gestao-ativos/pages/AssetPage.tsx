import { useState, useEffect } from 'react'
import { ArrowLeft, Trash2, MapPin, Calendar, Layers } from 'lucide-react'
import type { AssetDetail, Asset } from '../lib/api'
import { fetchAsset, deleteAsset } from '../lib/api'
import { FichaSheetVenda } from '../components/FichaSheetVenda'
import { FichaSheetArrendamentos } from '../components/FichaSheetArrendamentos'
import {
  calcTotalCost, calcCapitalCost, calcBreakEven,
  calcYieldOnCost, calcAskingBCC, calcBluecrowNet,
  fmtEur, fmtPct,
} from '../lib/finance'
import { STATUS_LABELS, STATUS_CLS } from '../lib/status'

type Sheet = 'ficha' | 'arrendamentos'

interface Props {
  assetId: string
  onBack: () => void
  onDeleted: () => void
}

export function AssetPage({ assetId, onBack, onDeleted }: Props) {
  const [detail,   setDetail]   = useState<AssetDetail | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState<string | null>(null)
  const [sheet,    setSheet]    = useState<Sheet>('ficha')
  const [deleting, setDeleting] = useState(false)

  async function load() {
    try {
      setLoading(true)
      setError(null)
      const d = await fetchAsset(assetId)
      setDetail(d)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [assetId])

  async function handleDelete() {
    if (!detail) return
    if (!confirm(`Eliminar "${detail.name}"? Esta ação não pode ser revertida.`)) return
    setDeleting(true)
    try {
      await deleteAsset(assetId)
      onDeleted()
    } finally {
      setDeleting(false)
    }
  }

  // ── Loading ──
  if (loading) {
    return (
      <div className="ga-asset-page">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300 }}>
          <div className="w-7 h-7 border-2 border-[#C25A2E] border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="ga-asset-page" style={{ padding: 24 }}>
        <button className="ga-btn-secondary" onClick={onBack} style={{ marginBottom: 16 }}>
          <ArrowLeft size={14} /> Portefólio
        </button>
        <div style={{ color: 'var(--red)', fontSize: 13 }}>{error}</div>
      </div>
    )
  }

  if (!detail) return null

  const a = detail as Asset
  const totalCost   = calcTotalCost(a)
  const capitalCost = calcCapitalCost(a)
  const breakEven   = calcBreakEven(a)
  const yieldOnCost = calcYieldOnCost(a)
  const askingBCC   = calcAskingBCC(a)
  const effectiveAsking = a.asking_price ?? askingBCC
  const bcNet       = calcBluecrowNet(a)

  const statusCls = STATUS_CLS[a.status] ?? 'sem-rendimento'

  // Parse location: "Município - Freguesia" → show both parts
  const [municipio, freguesia] = (a.location ?? '').split(' - ')

  return (
    <div className="ga-asset-page">

      {/* ── HERO HEADER ── */}
      <div className="ga-asset-hero">
        <div className="ga-asset-hero-nav">
          <button className="ga-asset-back-btn" onClick={onBack}>
            <ArrowLeft size={14} /> Portefólio
          </button>
          <div className="ga-asset-hero-actions">
            {a.maps_link && (
              <a href={a.maps_link} target="_blank" rel="noreferrer" className="ga-asset-maps-btn">
                <MapPin size={13} /> Google Maps
              </a>
            )}
            <button className="ga-asset-delete-btn" onClick={handleDelete} disabled={deleting}>
              <Trash2 size={13} /> {deleting ? 'A eliminar…' : 'Eliminar'}
            </button>
          </div>
        </div>

        <div className="ga-asset-hero-body">
          <div className="ga-asset-hero-left">
            {a.spv && <div className="ga-asset-eyebrow">{a.spv}</div>}
            <h1 className="ga-asset-name">{a.name}</h1>

            <div className="ga-asset-meta-row">
              {a.location && (
                <span className="ga-asset-meta-item">
                  <MapPin size={11} />
                  {municipio}{freguesia ? <span style={{ opacity: 0.6 }}> · {freguesia}</span> : null}
                </span>
              )}
              {a.acquisition_date && (
                <span className="ga-asset-meta-item">
                  <Calendar size={11} />
                  {new Date(a.acquisition_date).toLocaleDateString('pt-PT', { year: 'numeric', month: 'short' })}
                </span>
              )}
              {(a.land_area && a.land_area > 0) && (
                <span className="ga-asset-meta-item">
                  <Layers size={11} />
                  {a.land_area.toLocaleString('pt-PT')} m² terreno
                </span>
              )}
              {(a.build_area && a.build_area > 0) && (
                <span className="ga-asset-meta-item">
                  {a.build_area.toLocaleString('pt-PT')} m² construção
                </span>
              )}
            </div>

            <div className="ga-asset-pills-row">
              <span className={`ga-pill ${statusCls}`}>{STATUS_LABELS[a.status]}</span>
              {a.typology && <span className="ga-pill neutral">{a.typology}</span>}
              {detail.tenancies.filter(t => t.lease_status === 'ativo').length > 0 && (
                <span className="ga-pill rendimento">
                  {detail.tenancies.filter(t => t.lease_status === 'ativo').length} arrendamento(s) ativo(s)
                </span>
              )}
            </div>

            {a.general_notes && a.general_notes !== '0' && (
              <div className="ga-asset-entity-note">{a.general_notes}</div>
            )}
          </div>

          {/* Right: KPI strip */}
          <div className="ga-asset-hero-kpis">
            <HeroKpi label="Custo Total"     value={fmtEur(totalCost, true)}      />
            <HeroKpi label="Custo Capital"   value={fmtEur(capitalCost, true)}    dim />
            <HeroKpi label="Break-Even"      value={fmtEur(breakEven, true)}      accent />
            <HeroKpi label="Yield on Cost"   value={fmtPct(yieldOnCost)}
              color={yieldOnCost > 0.06 ? 'green' : yieldOnCost > 0.02 ? undefined : 'red'} />
            <HeroKpi label="Asking Price"    value={fmtEur(effectiveAsking, true)} />
            {a.bidding_offer
              ? <HeroKpi label="Oferta"      value={fmtEur(a.bidding_offer, true)}
                  color={bcNet >= 0 ? 'green' : 'red'} />
              : <HeroKpi label="BlueCrow Net" value="—" dim />
            }
          </div>
        </div>
      </div>

      {/* ── SHEET TABS ── */}
      <div className="ga-asset-sheet-tabs">
        <button className={`ga-asset-sheet-tab${sheet === 'ficha' ? ' active' : ''}`}
          onClick={() => setSheet('ficha')}>
          Ficha de Investimento
        </button>
        <button className={`ga-asset-sheet-tab${sheet === 'arrendamentos' ? ' active' : ''}`}
          onClick={() => setSheet('arrendamentos')}>
          Arrendamentos &amp; Documentos
          {detail.tenancies.length > 0 && (
            <span className="ga-tab-badge">{detail.tenancies.length}</span>
          )}
        </button>
      </div>

      {/* ── CONTENT ── */}
      <div className="ga-asset-body">
        {sheet === 'ficha'
          ? <FichaSheetVenda detail={detail} onRefresh={load} />
          : <FichaSheetArrendamentos detail={detail} onRefresh={load} />
        }
      </div>
    </div>
  )
}

// ── HeroKpi ────────────────────────────────────────────────────────────────────

function HeroKpi({ label, value, accent, dim, color }: {
  label: string; value: string
  accent?: boolean; dim?: boolean; color?: 'green' | 'red'
}) {
  const valueColor = color === 'green' ? '#6ee7b7'
    : color === 'red'   ? '#fca5a5'
    : accent            ? '#e8906a'
    : dim               ? 'rgba(255,255,255,0.35)'
    : 'rgba(255,255,255,0.9)'

  return (
    <div className="ga-hero-kpi">
      <div className="ga-hero-kpi-label">{label}</div>
      <div className="ga-hero-kpi-value" style={{ color: valueColor }}>{value}</div>
    </div>
  )
}
