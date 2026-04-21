import { useState, useRef, useEffect, useMemo } from 'react'
import { Plus, ChevronDown, Download, Upload, ArrowLeft } from 'lucide-react'
import type { Asset } from '../lib/api'

interface Props {
  activeSPV: string | null
  assets: Asset[]
  fichaId: string | null
  onAddAsset: () => void
  onBackFromAsset?: () => void
  onBackFromSPV?: () => void
  onImport?: () => void
  onExport?: () => void
}

export function Topbar({ activeSPV, assets, fichaId, onAddAsset, onBackFromAsset, onBackFromSPV, onImport, onExport }: Props) {
  const [maisOpen, setMaisOpen] = useState(false)
  const maisRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (maisRef.current && !maisRef.current.contains(e.target as Node)) {
        setMaisOpen(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  // ── Asset page mode ──
  if (fichaId) {
    const asset = assets.find(a => a.id === fichaId)
    return (
      <div className="ga-topbar">
        <div className="ga-topbar-left" style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <button className="ga-btn-secondary" onClick={onBackFromAsset} style={{ flexShrink: 0 }}>
            <ArrowLeft size={13} /> {activeSPV ?? 'Portefólio'}
          </button>
          <div style={{ width: 1, height: 18, background: 'var(--border-mid)', flexShrink: 0 }} />
          <div className="ga-topbar-title" style={{ fontSize: 13 }}>
            {asset?.name ?? 'Ativo'}
          </div>
          {asset?.spv && (
            <span className="ga-pill neutral" style={{ fontSize: 10 }}>{asset.spv}</span>
          )}
        </div>
        <div className="ga-topbar-right">
          <button className="ga-btn-primary" onClick={onAddAsset}>
            <Plus size={14} /> Adicionar Ativo
          </button>
        </div>
      </div>
    )
  }

  // ── SPV page mode ──
  if (activeSPV) {
    const list = assets.filter(a => (a.spv ?? 'Sem SPV') === activeSPV)

    return (
      <div className="ga-topbar">
        <div className="ga-topbar-left" style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <button className="ga-btn-secondary" onClick={onBackFromSPV} style={{ flexShrink: 0 }}>
            <ArrowLeft size={13} /> Portefólio
          </button>
          <div style={{ width: 1, height: 18, background: 'var(--border-mid)', flexShrink: 0 }} />
          <div className="ga-topbar-title" style={{ fontSize: 13 }}>{activeSPV}</div>
          <div className="ga-metabar"><StatusPills list={list} /></div>
        </div>
        <div className="ga-topbar-right">
          <div className="ga-mais-wrapper" ref={maisRef}>
            <button className="ga-btn-secondary" onClick={() => setMaisOpen(o => !o)}>
              Mais <ChevronDown size={13} />
            </button>
            {maisOpen && (
              <div className="ga-dropdown">
                <button className="ga-dropdown-item" onClick={() => { onExport?.(); setMaisOpen(false) }}>
                  <Download size={13} /> Exportar CSV
                </button>
                <button className="ga-dropdown-item" onClick={() => { onImport?.(); setMaisOpen(false) }}>
                  <Upload size={13} /> Importar Excel
                </button>
              </div>
            )}
          </div>
          <button className="ga-btn-primary" onClick={onAddAsset}>
            <Plus size={14} /> Adicionar Ativo
          </button>
        </div>
      </div>
    )
  }

  // ── Portfolio overview mode ──
  return (
    <div className="ga-topbar">
      <div className="ga-topbar-left">
        <div className="ga-topbar-title">Portefólio</div>
        <div className="ga-metabar"><StatusPills list={assets} /></div>
      </div>

      <div className="ga-topbar-right">
        <div className="ga-mais-wrapper" ref={maisRef}>
          <button className="ga-btn-secondary" onClick={() => setMaisOpen(o => !o)}>
            Mais <ChevronDown size={13} />
          </button>
          {maisOpen && (
            <div className="ga-dropdown">
              <button className="ga-dropdown-item" onClick={() => { onExport?.(); setMaisOpen(false) }}>
                <Download size={13} /> Exportar CSV
              </button>
              <button className="ga-dropdown-item" onClick={() => { onImport?.(); setMaisOpen(false) }}>
                <Upload size={13} /> Importar Excel
              </button>
            </div>
          )}
        </div>
        <button className="ga-btn-primary" onClick={onAddAsset}>
          <Plus size={14} /> Adicionar Ativo
        </button>
      </div>
    </div>
  )
}

function StatusPills({ list }: { list: Asset[] }) {
  const counts = useMemo(() => {
    let rendimento = 0, venda = 0, semRendimento = 0, vendido = 0
    for (const a of list) {
      if (a.status === 'em_rendimento')  rendimento++
      else if (a.status === 'em_venda')  venda++
      else if (a.status === 'vendido')   vendido++
      else                               semRendimento++
    }
    return { rendimento, venda, semRendimento, vendido }
  }, [list])

  return (
    <>
      {counts.rendimento > 0    && <span className="ga-pill rendimento">{counts.rendimento} em rendimento</span>}
      {counts.venda > 0         && <span className="ga-pill venda">{counts.venda} em venda</span>}
      {counts.semRendimento > 0 && <span className="ga-pill sem-rendimento">{counts.semRendimento} sem rendimento</span>}
      {counts.vendido > 0       && <span className="ga-pill vendido">{counts.vendido} vendido{counts.vendido > 1 ? 's' : ''}</span>}
    </>
  )
}
