import { useState, useEffect } from 'react'
import { LayoutGrid, LogOut, Building2, BarChart3, ShoppingBag, Plus } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import type { Asset } from './lib/api'
import { fetchAssets, createAsset } from './lib/api'
import { DashboardPage } from './pages/DashboardPage'
import { AssetDetailPage } from './pages/AssetDetailPage'
import { AssetFormModal } from './pages/AssetFormModal'

type View = 'dashboard' | 'detail'

interface SidebarItem {
  id:    string
  label: string
  icon:  React.ReactNode
}

const NAV: SidebarItem[] = [
  { id: 'dashboard', label: 'Portefólio',       icon: <Building2 size={15} /> },
  { id: 'analise',   label: 'Análise',           icon: <BarChart3 size={15} /> },
  { id: 'comercial', label: 'Comercialização',   icon: <ShoppingBag size={15} /> },
]

export function GestaoAtivosPortal({ onBackToHub }: { onBackToHub: () => void }) {
  const { user, logout } = useAuth()

  const [assets,     setAssets]     = useState<Asset[]>([])
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState<string | null>(null)
  const [view,       setView]       = useState<View>('dashboard')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [navId,      setNavId]      = useState('dashboard')
  const [createOpen, setCreateOpen] = useState(false)

  async function loadAssets() {
    try {
      setLoading(true)
      const data = await fetchAssets()
      setAssets(data)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadAssets() }, [])

  async function handleCreate(data: Partial<Asset>) {
    const created = await createAsset(data)
    await loadAssets()
    setSelectedId(created.id)
    setView('detail')
  }

  function handleSelectAsset(id: string) {
    setSelectedId(id)
    setView('detail')
  }

  function handleBackToDashboard() {
    setView('dashboard')
    setSelectedId(null)
    loadAssets()
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#f5f6fa]">
      {/* Sidebar */}
      <aside className="w-52 bg-slate-900 flex flex-col flex-shrink-0">
        {/* Logo */}
        <div className="px-4 py-5 border-b border-white/5">
          <div className="flex items-center gap-2.5">
            <img src="/simbolo.ico" alt="BlueCrow" className="w-6 h-6 object-contain"
              style={{ filter: 'brightness(0) invert(1)' }} />
            <div>
              <div className="text-white text-[12px] font-bold leading-none">BlueCrow</div>
              <div className="text-slate-400 text-[10px] mt-0.5">Gestão de Ativos</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {NAV.map(item => (
            <button key={item.id} onClick={() => { setNavId(item.id); if (item.id === 'dashboard') handleBackToDashboard() }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[12px] font-medium transition-colors ${
                navId === item.id
                  ? 'bg-white/10 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}>
              {item.icon}
              {item.label}
            </button>
          ))}

          <div className="pt-3 pb-1">
            <div className="text-[10px] font-bold text-slate-600 uppercase tracking-widest px-3 mb-1">Ativos</div>
          </div>

          {loading ? (
            <div className="px-3 py-2 text-slate-600 text-[11px]">A carregar…</div>
          ) : assets.length === 0 ? (
            <div className="px-3 py-2 text-slate-600 text-[11px]">Nenhum ativo</div>
          ) : assets.slice(0, 12).map(a => (
            <button key={a.id} onClick={() => handleSelectAsset(a.id)}
              className={`w-full flex items-start gap-2 px-3 py-1.5 rounded-lg text-[11px] transition-colors ${
                selectedId === a.id
                  ? 'bg-white/10 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}>
              <Building2 size={11} className="mt-0.5 flex-shrink-0" />
              <span className="truncate text-left leading-tight">{a.name}</span>
            </button>
          ))}
          {assets.length > 12 && (
            <div className="px-3 py-1 text-[10px] text-slate-600">+{assets.length - 12} ativos</div>
          )}
        </nav>

        {/* Footer */}
        <div className="px-4 py-4 border-t border-white/5 space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white text-[9px] font-bold">
              {user?.initials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-slate-200 text-[11px] font-semibold leading-none truncate">{user?.name.split(' ')[0]}</div>
              <div className="text-slate-500 text-[9px] mt-0.5 capitalize">{user?.role}</div>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={onBackToHub}
              className="flex-1 flex items-center justify-center gap-1.5 text-[11px] font-medium
                         text-slate-400 hover:text-white hover:bg-white/10 px-2.5 py-1.5
                         rounded-lg transition-colors border border-white/10">
              <LayoutGrid size={11} /> Portal
            </button>
            <button onClick={() => { logout(); onBackToHub() }}
              className="flex-1 flex items-center justify-center gap-1.5 text-[11px] font-medium
                         text-slate-400 hover:text-red-400 hover:bg-red-500/10 px-2.5 py-1.5
                         rounded-lg transition-colors border border-white/10">
              <LogOut size={11} /> Sair
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-hidden flex flex-col">
        {/* Topbar */}
        <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between flex-shrink-0">
          <div className="text-sm font-semibold text-slate-700">
            {view === 'detail' && selectedId
              ? assets.find(a => a.id === selectedId)?.name ?? 'Ativo'
              : 'Portefólio de Ativos'}
          </div>
          <button onClick={() => setCreateOpen(true)}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-[#1e3a5f] hover:bg-[#162d4a] text-white text-sm font-medium rounded-lg transition-colors">
            <Plus size={14} /> Novo Ativo
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {error ? (
            <div className="p-6 text-red-600 text-sm bg-red-50 m-6 rounded-xl border border-red-200">
              Erro ao carregar dados: {error}
            </div>
          ) : view === 'detail' && selectedId ? (
            <AssetDetailPage
              assetId={selectedId}
              onBack={handleBackToDashboard}
              onDeleted={handleBackToDashboard}
            />
          ) : (
            <DashboardPage assets={assets} onSelect={handleSelectAsset} />
          )}
        </div>
      </main>

      {createOpen && (
        <AssetFormModal mode="create" onSave={handleCreate} onClose={() => setCreateOpen(false)} />
      )}
    </div>
  )
}
