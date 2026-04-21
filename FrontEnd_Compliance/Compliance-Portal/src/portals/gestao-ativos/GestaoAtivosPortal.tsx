import { useState, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import { AnnouncementBar } from '@/components/AnnouncementBar'
import { Sidebar } from './components/Sidebar'
import { Topbar } from './components/Topbar'
import { DashboardPage } from './pages/DashboardPage'
import { SpvPage } from './pages/SpvPage'
import { AssetPage } from './pages/AssetPage'
import { VisaoGeralPage } from './pages/VisaoGeralPage'
import { AvaliacoesPage } from './pages/AvaliacoesPage'
import { AssetFormModal } from './pages/AssetFormModal'
import { ImportModal } from './components/ImportModal'
import type { Asset } from './lib/api'
import { fetchAssets, createAsset } from './lib/api'
import './portal.css'
import './portal-ext.css'
import './portal-page.css'

export function GestaoAtivosPortal({ onBackToHub }: { onBackToHub: () => void }) {
  const { user } = useAuth()

  const [assets,       setAssets]       = useState<Asset[]>([])
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState<string | null>(null)
  const [activeSPV,    setActiveSPV]    = useState<string | null>(null)
  const [fichaId,      setFichaId]      = useState<string | null>(null)
  const [page,         setPage]         = useState<'dashboard' | 'tabela' | 'avaliacoes'>('dashboard')
  const [createOpen,   setCreateOpen]   = useState(false)
  const [importOpen,   setImportOpen]   = useState(false)

  useEffect(() => {
    if (!user) { onBackToHub(); return }
    loadAssets()
  }, [])

  async function loadAssets() {
    try {
      setLoading(true)
      setError(null)
      const data = await fetchAssets()
      setAssets(data)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleCreate(data: Partial<Asset>) {
    const created = await createAsset(data)
    await loadAssets()
    setFichaId(created.id)
  }

  function handleSelectAsset(id: string) {
    const asset = assets.find(a => a.id === id)
    if (asset) setActiveSPV(asset.spv ?? 'Sem SPV')
    setFichaId(id)
  }

  function handleBackFromAsset() {
    setFichaId(null)
  }

  function handleBackFromSPV() {
    setActiveSPV(null)
    setFichaId(null)
  }

  function handleSelectPage(p: 'dashboard' | 'tabela' | 'avaliacoes') {
    setPage(p)
    setActiveSPV(null)
    setFichaId(null)
  }

  function handleSelectSPV(spv: string) {
    setActiveSPV(spv)
    setFichaId(null)
  }

  if (loading) {
    return (
      <div className="ga-portal flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-[#C25A2E] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500">A carregar ativos…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="ga-portal ga-layout">
      <Sidebar
        assets={assets}
        activeSPV={activeSPV}
        selectedId={fichaId}
        page={page}
        onSelectSPV={handleSelectSPV}
        onSelectAsset={handleSelectAsset}
        onSelectPage={handleSelectPage}
        onBackToHub={onBackToHub}
      />

      <div className="ga-main">
        <Topbar
          activeSPV={activeSPV}
          assets={assets}
          fichaId={fichaId}
          onAddAsset={() => setCreateOpen(true)}
          onBackFromAsset={handleBackFromAsset}
          onBackFromSPV={handleBackFromSPV}
          onImport={() => setImportOpen(true)}
        />

        <AnnouncementBar />

        <div className="ga-content">
          {fichaId ? (
            <AssetPage
              assetId={fichaId}
              onBack={handleBackFromAsset}
              onDeleted={() => { setFichaId(null); loadAssets() }}
            />
          ) : activeSPV ? (
            <SpvPage
              spv={activeSPV}
              assets={assets}
              onSelectAsset={handleSelectAsset}
            />
          ) : error ? (
            <div className="p-6 text-red-600 text-sm bg-red-50 m-6 rounded-xl border border-red-200">
              Erro ao carregar dados: {error}
            </div>
          ) : page === 'tabela' ? (
            <VisaoGeralPage
              assets={assets}
              onSelectAsset={handleSelectAsset}
            />
          ) : page === 'avaliacoes' ? (
            <AvaliacoesPage
              onSelectAsset={handleSelectAsset}
            />
          ) : (
            <DashboardPage
              assets={assets}
              onSelectAsset={handleSelectAsset}
            />
          )}
        </div>
      </div>

      {createOpen && (
        <AssetFormModal
          mode="create"
          onSave={handleCreate}
          onClose={() => setCreateOpen(false)}
        />
      )}

      {importOpen && (
        <ImportModal
          onClose={() => setImportOpen(false)}
          onComplete={loadAssets}
        />
      )}
    </div>
  )
}
