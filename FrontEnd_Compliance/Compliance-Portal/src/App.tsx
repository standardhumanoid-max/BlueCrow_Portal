import { useState, useEffect } from 'react'
import { AuthProvider, useAuth } from '@/context/AuthContext'
import { Sidebar } from '@/components/layout/Sidebar'
import { Topbar }  from '@/components/layout/Topbar'
import { useStore } from '@/store/useStore'
import { PortalHub, type PortalId } from '@/portals/hub/PortalHub'
import { AssetValuationPortal } from '@/portals/asset-valuation/AssetValuationPortal'
import { AdminPortal }          from '@/portals/admin/AdminPortal'
import { GestaoAtivosPortal }   from '@/portals/gestao-ativos/GestaoAtivosPortal'

// Pages
import { Dashboard }       from '@/pages/Dashboard'
import { Compliance }      from '@/pages/Compliance'
import { ControloInterno } from '@/pages/ControloInterno'
import { GestaoRiscos }    from '@/pages/GestaoRiscos'
import { PBCFT }           from '@/pages/PBCFT'
import { RGPD }            from '@/pages/RGPD'
import { QuadroRegulatorio } from '@/pages/QuadroRegulatorio'
import { OIA }             from '@/pages/OIA'
import { AssistenteIA }   from '@/pages/AssistenteIA'
import { Placeholder }     from '@/pages/Placeholder'
import { Reportes }       from '@/pages/Reportes'
import { Roadmap }           from '@/pages/Roadmap'
import { CMVM }              from '@/pages/CMVM'
import { Fundos }           from '@/pages/SCR'
import { Legislacao }        from '@/pages/Legislacao'
import { SecurityAlertToast } from '@/components/SecurityAlertToast'
import { AnnouncementBar }    from '@/components/AnnouncementBar'
import { UndoToast }          from '@/components/UndoToast'

// ── Authenticated shell ────────────────────────────────────────────────────────
function AppShell({ onBackToHub }: { onBackToHub: () => void }) {
  const { currentPage, loadAll, loading } = useStore()
  const { user } = useAuth()

  useEffect(() => {
    // Só carrega dados se houver sessão com token válido
    const session = sessionStorage.getItem('compliance_session')
    const token = session ? JSON.parse(session)?.token : null
    if (token) {
      loadAll()
    } else {
      // Sessão antiga sem JWT — forçar logout para login novo
      sessionStorage.removeItem('compliance_session')
      onBackToHub()
    }
  }, [])

  function renderPage() {
    switch (currentPage) {
      case 'dashboard':    return <Dashboard />
      case 'compliance':   return <Compliance />
      case 'controlo':     return <ControloInterno />
      case 'riscos':       return <GestaoRiscos />
      case 'pbcft':        return <PBCFT />
      case 'rgpd':         return <RGPD />
      case 'regulatorio':  return <QuadroRegulatorio />
      case 'legislacao':   return <Legislacao />
      case 'politicas':    return <Placeholder title="Políticas e Procedimentos"     description="Inventário documental BCR-COMP — em desenvolvimento." />
      case 'formacao':     return <Placeholder title="Formação"                      description="Plano e registo de formações — em desenvolvimento." />
      case 'estrutura':    return <Placeholder title="Estrutura Organizacional"      description="Organograma e responsabilidades — em desenvolvimento." />
      case 'oia':          return <OIA />
      case 'scr':          return <Fundos />
      case 'cmvm':         return <CMVM />
      case 'assistente':   return <AssistenteIA />
      case 'reportes':     return <Reportes />
      case 'roadmap':      return <Roadmap />
      default:               return <Dashboard />
    }
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#f5f6fa]">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500">A carregar dados…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#f5f6fa]">
      <Sidebar onBackToHub={onBackToHub} />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Topbar />
        <AnnouncementBar />
        <main className={currentPage === 'assistente' ? 'flex-1 overflow-hidden' : 'flex-1 overflow-y-auto'}>
          {renderPage()}
        </main>
      </div>
      <SecurityAlertToast />
      <UndoToast />
    </div>
  )
}

// ── Root ───────────────────────────────────────────────────────────────────────
export default function App() {
  const [activePortal, setActivePortal] = useState<'hub' | PortalId>('hub')

  return (
    <AuthProvider>
      <AppContent
        activePortal={activePortal}
        onSelectPortal={setActivePortal}
      />
    </AuthProvider>
  )
}

function AppContent({
  activePortal,
  onSelectPortal,
}: {
  activePortal: 'hub' | PortalId
  onSelectPortal: (p: 'hub' | PortalId) => void
}) {
  const { user, authLoading } = useAuth()

  // Fallback: sessão expirou enquanto dentro de um portal → volta ao hub
  useEffect(() => {
    if (!authLoading && !user && activePortal !== 'hub') {
      onSelectPortal('hub')
    }
  }, [authLoading, user, activePortal])

  if (activePortal === 'hub') {
    return <PortalHub onSelectPortal={onSelectPortal} />
  }

  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#f5f6fa]">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500">A verificar sessão…</p>
        </div>
      </div>
    )
  }

  if (!user) return null

  if (activePortal === 'asset-valuation') {
    return <AssetValuationPortal onBackToHub={() => onSelectPortal('hub')} />
  }

  if (activePortal === 'gestao-ativos') {
    return <GestaoAtivosPortal onBackToHub={() => onSelectPortal('hub')} />
  }

  if (activePortal === 'admin-panel') {
    return <AdminPortal onBackToHub={() => onSelectPortal('hub')} />
  }

  return <AppShell onBackToHub={() => onSelectPortal('hub')} />
}
