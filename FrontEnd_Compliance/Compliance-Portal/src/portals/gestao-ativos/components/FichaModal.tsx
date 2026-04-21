import { useState, useEffect } from 'react'
import { X, MapPin, Trash2 } from 'lucide-react'
import type { AssetDetail } from '../lib/api'
import { fetchAsset, deleteAsset } from '../lib/api'
import { FichaSheetVenda } from './FichaSheetVenda'
import { FichaSheetArrendamentos } from './FichaSheetArrendamentos'

type Sheet = 'venda' | 'arrendamentos'

const STATUS_LABELS: Record<string, string> = {
  em_rendimento:  'Em Rendimento',
  sem_rendimento: 'Sem Rendimento',
  em_venda:       'Em Venda',
  vendido:        'Vendido',
}

interface Props {
  assetId: string
  onClose: () => void
  onDeleted: () => void
  onUpdated: () => void
}

export function FichaModal({ assetId, onClose, onDeleted, onUpdated }: Props) {
  const [detail,   setDetail]   = useState<AssetDetail | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState<string | null>(null)
  const [sheet,    setSheet]    = useState<Sheet>('venda')
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

  async function handleRefresh() {
    await load()
    onUpdated()
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

  return (
    <div className="ga-ficha-overlay" onClick={onClose}>
      <div className="ga-ficha-panel" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="ga-ficha-header">
          <div className="ga-ficha-eyebrow">Investment Memo</div>
          <div className="ga-ficha-header-row">
            <div className="ga-ficha-title">
              {loading ? 'A carregar…' : (detail?.name ?? 'Ativo')}
            </div>
            <div className="ga-ficha-header-actions">
              {detail && (
                <>
                  <button
                    className="ga-ficha-delete-btn"
                    onClick={handleDelete}
                    disabled={deleting}
                    title="Eliminar ativo">
                    <Trash2 size={14} />
                  </button>
                  <button className="ga-ficha-close" onClick={onClose}>
                    <X size={18} />
                  </button>
                </>
              )}
              {!detail && (
                <button className="ga-ficha-close" onClick={onClose}>
                  <X size={18} />
                </button>
              )}
            </div>
          </div>

          {detail && (
            <>
              {/* Meta row */}
              <div className="ga-ficha-meta">
                {detail.spv && <span>{detail.spv}</span>}
                {detail.location && (
                  <span className="ga-ficha-meta-loc">
                    {detail.maps_link
                      ? <a href={detail.maps_link} target="_blank" rel="noreferrer"
                          className="ga-ficha-maps-link" onClick={e => e.stopPropagation()}>
                          <MapPin size={12} /> {detail.location}
                        </a>
                      : <><MapPin size={12} /> {detail.location}</>
                    }
                  </span>
                )}
                {detail.typology && <span>{detail.typology}</span>}
              </div>

              {/* Status pills */}
              <div className="ga-ficha-pills">
                <span className={`ga-pill ${
                  detail.status === 'em_venda'       ? 'venda'          :
                  detail.status === 'em_rendimento'  ? 'rendimento'     :
                  detail.status === 'sem_rendimento' ? 'sem-rendimento' : 'vendido'
                }`}>
                  {STATUS_LABELS[detail.status] ?? detail.status}
                </span>
                {detail.land_area && (
                  <span className="ga-pill neutral">{detail.land_area.toLocaleString('pt-PT')} m² terreno</span>
                )}
                {detail.build_area && (
                  <span className="ga-pill neutral">{detail.build_area.toLocaleString('pt-PT')} m² construção</span>
                )}
              </div>
            </>
          )}
        </div>

        {/* Sheet tabs */}
        {detail && (
          <div className="ga-sheet-tabs">
            <button
              className={`ga-sheet-tab${sheet === 'venda' ? ' active' : ''}`}
              onClick={() => setSheet('venda')}>
              Ficha de Venda
            </button>
            <button
              className={`ga-sheet-tab${sheet === 'arrendamentos' ? ' active' : ''}`}
              onClick={() => setSheet('arrendamentos')}>
              Arrendamentos & Docs
            </button>
          </div>
        )}

        {/* Content */}
        <div className="ga-ficha-body">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-7 h-7 border-2 border-[#C25A2E] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : error ? (
            <div className="p-6 text-red-600 text-sm">{error}</div>
          ) : detail ? (
            sheet === 'venda'
              ? <FichaSheetVenda detail={detail} onRefresh={handleRefresh} />
              : <FichaSheetArrendamentos detail={detail} onRefresh={handleRefresh} />
          ) : null}
        </div>
      </div>
    </div>
  )
}
