import { useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import './portal.css'

import { DashboardPage }   from './pages/DashboardPage'
import { PortfolioPage }   from './pages/PortfolioPage'
import { ParticipadasPage } from './pages/ParticipadasPage'
import { AvaliacoesPage }  from './pages/AvaliacoesPage'
import { PipelinePage }    from './pages/PipelinePage'
import { CapitalPage }     from './pages/CapitalPage'
import { CashflowsPage }  from './pages/CashflowsPage'
import { SettingsPage }    from './pages/SettingsPage'

// ── Page type ────────────────────────────────────────────────────────────────
type AvPage = 'dashboard' | 'portfolio' | 'participadas' | 'avaliacoes' | 'pipeline' | 'capital' | 'cashflows' | 'configuracoes'

interface NavState {
  page: AvPage
  companyId?: string | null
  tab?: string | null
}

// ── Sidebar nav config ────────────────────────────────────────────────────────
const NAV: { label: string; items: { id: AvPage; label: string; icon: React.ReactNode }[] }[] = [
  {
    label: 'Principal',
    items: [
      { id: 'dashboard',    label: 'Dashboard',    icon: <IconDashboard /> },
      { id: 'portfolio',    label: 'Portfólio',    icon: <IconBriefcase /> },
      { id: 'participadas', label: 'Participadas', icon: <IconBuilding /> },
    ],
  },
  {
    label: 'Análise',
    items: [
      { id: 'avaliacoes', label: 'Avaliações', icon: <IconChart /> },
      { id: 'pipeline',   label: 'Pipeline',   icon: <IconFunnel /> },
      { id: 'capital',    label: 'Capital',    icon: <IconCoins /> },
      { id: 'cashflows',  label: 'Cashflows',  icon: <IconCashflow /> },
    ],
  },
  {
    label: 'Sistema',
    items: [
      { id: 'configuracoes', label: 'Configurações', icon: <IconGear /> },
    ],
  },
]

// ── Portal shell ──────────────────────────────────────────────────────────────
export function AssetValuationPortal({ onBackToHub }: { onBackToHub: () => void }) {
  const { user, logout } = useAuth()
  const [nav, setNav] = useState<NavState>({ page: 'dashboard' })

  function navigate(page: string, options?: { companyId?: string; tab?: string }) {
    setNav({ page: page as AvPage, companyId: options?.companyId, tab: options?.tab })
  }

  function renderPage() {
    switch (nav.page) {
      case 'dashboard':    return <DashboardPage />
      case 'portfolio':    return <PortfolioPage onNavigate={navigate} />
      case 'participadas': return <ParticipadasPage initialCompanyId={nav.companyId} onNavigate={navigate} />
      case 'avaliacoes':   return <AvaliacoesPage onNavigate={navigate} />
      case 'pipeline':     return <PipelinePage />
      case 'capital':      return <CapitalPage />
      case 'cashflows':    return <CashflowsPage />
      case 'configuracoes': return <SettingsPage initialCompanyId={nav.companyId} initialTab={nav.tab} />
      default:             return <DashboardPage />
    }
  }

  const initials = user?.name
    ? user.name.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()
    : (user?.email ? user.email.slice(0, 2).toUpperCase() : 'BC')

  return (
    <div className="av-portal">
      <div className="app-shell">
        {/* ── SIDEBAR ── */}
        <aside className="sidebar">
          <div className="brand">
            <img src="/simbolo.ico" alt="BlueCrow" style={{ width: 32, height: 32, objectFit: 'contain', filter: 'brightness(0) invert(1)' }} />
            <div className="brand-info">
              <span className="brand-title">BlueCrow Capital</span>
              <span className="brand-subtitle">Avaliação de Ativos</span>
            </div>
          </div>

          <nav className="nav-section" aria-label="Navegação">
            {NAV.map(group => (
              <div key={group.label}>
                <div className="nav-section-label">{group.label}</div>
                {group.items.map(item => (
                  <button
                    key={item.id}
                    className={`nav-link${nav.page === item.id ? ' active' : ''}`}
                    onClick={() => setNav({ page: item.id })}
                  >
                    {item.icon}
                    {item.label}
                  </button>
                ))}
              </div>
            ))}
          </nav>

          <div className="sidebar-footer">
            <div className="sidebar-user">
              <div className="sidebar-user-avatar">{initials}</div>
              <span className="sidebar-user-email">{user?.email ?? ''}</span>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="button" className="ghost-button" onClick={onBackToHub} style={{ flex: 1 }}>
                Portal
              </button>
              <button type="button" className="ghost-button" onClick={() => { logout(); onBackToHub() }} style={{ flex: 1 }}>
                Sair
              </button>
            </div>
          </div>
        </aside>

        {/* ── CONTENT ── */}
        <main className="content">
          {renderPage()}
        </main>
      </div>
    </div>
  )
}

// ── SVG Icons ─────────────────────────────────────────────────────────────────
function IconDashboard() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  )
}
function IconBriefcase() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M20 7H4a2 2 0 00-2 2v10a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2z" />
      <path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2" />
    </svg>
  )
}
function IconBuilding() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 21h18" />
      <path d="M5 21V7l7-4 7 4v14" />
      <path d="M9 21v-4h6v4" />
    </svg>
  )
}
function IconChart() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M18 20V10" />
      <path d="M12 20V4" />
      <path d="M6 20v-6" />
    </svg>
  )
}
function IconFunnel() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V20l-4-3v-5.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
    </svg>
  )
}
function IconCoins() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v10M9.5 9.5C9.5 8.67 10.67 8 12 8s2.5.67 2.5 1.5-1.12 1.5-2.5 1.5-2.5.67-2.5 1.5S10.67 14 12 14s2.5.67 2.5 1.5" />
    </svg>
  )
}
function IconCashflow() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 3v18h18" />
      <path d="M7 16l4-4 4 4 4-4" />
    </svg>
  )
}
function IconGear() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
    </svg>
  )
}
