import { useState, useEffect, useMemo } from 'react'
import { LayoutGrid, LogOut, ChevronDown, ChevronRight, TableProperties, LayoutDashboard, BarChart2 } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import type { Asset } from '../lib/api'
import { fmtEur, calcTotalCost } from '../lib/finance'

interface Props {
  assets: Asset[]
  activeSPV: string | null
  selectedId: string | null
  page: 'dashboard' | 'tabela' | 'avaliacoes'
  onSelectSPV: (spv: string) => void
  onSelectAsset: (id: string) => void
  onSelectPage: (p: 'dashboard' | 'tabela' | 'avaliacoes') => void
  onBackToHub: () => void
}

const STATUS_DOT: Record<string, string> = {
  em_rendimento:  '#22c55e',
  sem_rendimento: 'rgba(255,255,255,0.18)',
  em_venda:       '#f59e0b',
  vendido:        '#60a5fa',
}

type PageId = 'dashboard' | 'tabela' | 'avaliacoes'

export function Sidebar({ assets, activeSPV, selectedId, page, onSelectSPV, onSelectAsset, onSelectPage, onBackToHub }: Props) {
  const { user, logout } = useAuth()

  const { spvMap, spvKeys } = useMemo(() => {
    const map: Record<string, Asset[]> = {}
    assets.forEach(a => {
      const key = a.spv || 'Sem SPV'
      if (!map[key]) map[key] = []
      map[key].push(a)
    })
    return { spvMap: map, spvKeys: Object.keys(map).sort() }
  }, [assets])

  const selectedSpv = useMemo(
    () => selectedId ? (assets.find(a => a.id === selectedId)?.spv ?? 'Sem SPV') : null,
    [selectedId, assets]
  )

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() => {
    // Start first SPV open, rest collapsed
    const init: Record<string, boolean> = {}
    spvKeys.forEach((k, i) => { if (i > 0) init[k] = true })
    return init
  })

  // Auto-expand when a selection changes
  useEffect(() => {
    const target = selectedSpv ?? activeSPV
    if (target) setCollapsed(c => ({ ...c, [target]: false }))
  }, [selectedSpv, activeSPV])

  const { totalCost, totalIncome, avgYield, active } = useMemo(() => {
    let cost = 0, income = 0, activeCount = 0
    for (const a of assets) {
      cost   += calcTotalCost(a)
      income += a.income_current ?? 0
      if (a.status !== 'vendido') activeCount++
    }
    return { totalCost: cost, totalIncome: income, avgYield: cost > 0 ? income / cost : 0, active: activeCount }
  }, [assets])

  return (
    <aside className="ga-sidebar">
      {/* Brand */}
      <div className="ga-sidebar-brand">
        <img src="/simbolo.ico" alt="BlueCrow" className="w-6 h-6 object-contain"
          style={{ filter: 'brightness(0) invert(1)' }} />
        <div>
          <div className="ga-brand-name">BlueCrow</div>
          <div className="ga-brand-sub">Gestão de Ativos</div>
        </div>
      </div>

      {/* Portfolio Pulse */}
      <div className="ga-pulse-card">
        <div className="ga-pulse-label">Portfolio Pulse</div>
        <div className="ga-pulse-grid">
          <div>
            <div className="ga-pulse-value">{active}</div>
            <div className="ga-pulse-desc">ativos</div>
          </div>
          <div>
            <div className="ga-pulse-value">{fmtEur(totalCost, true)}</div>
            <div className="ga-pulse-desc">custo total</div>
          </div>
          <div>
            <div className="ga-pulse-value">{(avgYield * 100).toFixed(1)}%</div>
            <div className="ga-pulse-desc">yield médio</div>
          </div>
          <div>
            <div className="ga-pulse-value">{fmtEur(totalIncome, true)}</div>
            <div className="ga-pulse-desc">renda anual</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <div className="ga-nav" style={{ paddingBottom: 0 }}>
        {([
          { id: 'dashboard',   label: 'Dashboard',   Icon: LayoutDashboard },
          { id: 'tabela',      label: 'Tabela',       Icon: TableProperties },
          { id: 'avaliacoes',  label: 'Avaliações',   Icon: BarChart2 },
        ] as { id: PageId; label: string; Icon: any }[]).map(({ id, label, Icon }) => (
          <button key={id}
            className={`ga-nav-item${page === id && !activeSPV && !selectedId ? ' active' : ''}`}
            onClick={() => onSelectPage(id)}>
            <Icon size={13} className="nav-icon" /> {label}
          </button>
        ))}
      </div>

      {/* SPV Groups */}
      <div className="ga-sidebar-section-label">
        Participadas &amp; Ativos
        <span style={{ marginLeft: 6, color: 'rgba(255,255,255,0.2)', fontWeight: 400 }}>{assets.length}</span>
      </div>

      <div className="ga-asset-list">
        {spvKeys.map(spv => {
          const list = spvMap[spv]
          const spvCost = list.reduce((s, a) => s + calcTotalCost(a), 0)
          const isCollapsed = collapsed[spv]
          const isActiveSPV = activeSPV === spv && !selectedId
          const hasSelected = list.some(a => a.id === selectedId)

          return (
            <div key={spv}>
              {/* SPV header — click to open SPV page */}
              <button
                className={`ga-spv-header${isActiveSPV ? ' spv-active' : ''}${hasSelected ? ' has-selected' : ''}`}
                onClick={() => {
                  onSelectSPV(spv)
                  setCollapsed(c => ({ ...c, [spv]: false }))
                }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1, minWidth: 0 }}>
                  <span onClick={e => { e.stopPropagation(); setCollapsed(c => ({ ...c, [spv]: !c[spv] })) }}
                    style={{ display: 'flex', alignItems: 'center', padding: '2px', opacity: 0.5 }}>
                    {isCollapsed ? <ChevronRight size={10} /> : <ChevronDown size={10} />}
                  </span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {spv}
                  </span>
                </span>
                <span className="ga-spv-meta">
                  <span className="ga-spv-count">{list.length}</span>
                  <span className="ga-spv-cost">{fmtEur(spvCost, true)}</span>
                </span>
              </button>

              {/* Asset list */}
              {!isCollapsed && list.map(a => {
                const isSelected = selectedId === a.id
                return (
                  <button key={a.id}
                    onClick={() => onSelectAsset(a.id)}
                    className={`ga-asset-item${isSelected ? ' active' : ''}`}>
                    <span className="ga-asset-dot" style={{ background: STATUS_DOT[a.status] }} />
                    <span className="ga-asset-item-name">{a.name}</span>
                    {a.location && (
                      <span className="ga-asset-item-loc">
                        {a.location.split(' - ')[0]}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          )
        })}

        {assets.length === 0 && (
          <div className="ga-asset-empty">Nenhum ativo registado.</div>
        )}
      </div>

      {/* Footer */}
      <div className="ga-sidebar-footer">
        <div className="ga-user-row">
          <div className="ga-user-avatar">{user?.initials}</div>
          <div className="ga-user-info">
            <div className="ga-user-name">{user?.name.split(' ')[0]}</div>
            <div className="ga-user-role">{user?.role}</div>
          </div>
        </div>
        <div className="ga-footer-btns">
          <button className="ga-footer-btn" onClick={onBackToHub}>
            <LayoutGrid size={11} /> Portal
          </button>
          <button className="ga-footer-btn danger" onClick={() => { logout(); onBackToHub() }}>
            <LogOut size={11} /> Sair
          </button>
        </div>
      </div>
    </aside>
  )
}
