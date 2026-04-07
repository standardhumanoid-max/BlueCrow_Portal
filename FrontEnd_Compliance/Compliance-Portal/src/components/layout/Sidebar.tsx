import { clsx } from 'clsx'
import {
  LayoutDashboard, Shield, CheckSquare, AlertTriangle,
  FileSearch, Lock, Users, BarChart3, FileText,
  BookOpen, GraduationCap, Building2, Scale, LogOut, LayoutGrid,
  Sparkles, ClipboardList, Map,
} from 'lucide-react'
import { useStore } from '@/store/useStore'
import { useAuth }  from '@/context/AuthContext'
import { ROLE_LABELS, type Role } from '@/config/users'
import type { PageId } from '@/types'

interface NavItem {
  id:      PageId
  label:   string
  icon:    React.ReactNode
  badge?:  { text: string; variant: 'red' | 'amber' | 'blue' | 'green' }
  adminOnly?: boolean
  roles?: Role[]   // se definido, só visível para utilizadores com esses roles
}
interface NavSection {
  label: string
  items: NavItem[]
}

const NAV: NavSection[] = [
  {
    label: 'Geral',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={14} /> },
    ],
  },
  {
    label: 'Áreas',
    items: [
      { id: 'compliance',  label: 'Compliance',       icon: <Shield size={14} />,       badge: { text: '2', variant: 'red' } },
      { id: 'controlo',    label: 'Controlo Interno', icon: <CheckSquare size={14} /> },
      { id: 'riscos',      label: 'Gestão de Riscos', icon: <AlertTriangle size={14} />, badge: { text: '2', variant: 'amber' } },
      { id: 'pbcft',       label: 'PBC/FT',           icon: <FileSearch size={14} />,   badge: { text: '1', variant: 'red' } },
      { id: 'rgpd',        label: 'RGPD',             icon: <Lock size={14} /> },
      { id: 'oia',         label: 'Investimentos', icon: <Users size={14} /> },
      { id: 'scr',         label: 'Fundos',            icon: <BarChart3 size={14} /> },
      { id: 'cmvm',        label: 'CMVM',             icon: <Scale size={14} />,         badge: { text: 'novo', variant: 'blue' } },
    ],
  },
  {
    label: 'Recursos',
    items: [
      { id: 'regulatorio', label: 'Quadro Regulatório',        icon: <Scale size={14} /> },
      { id: 'legislacao',  label: 'Legislação',                icon: <BookOpen size={14} /> },
      { id: 'politicas',   label: 'Políticas e Procedimentos', icon: <FileText size={14} /> },
      { id: 'formacao',    label: 'Formação',                  icon: <GraduationCap size={14} /> },
      { id: 'estrutura',   label: 'Estrutura Org.',            icon: <Building2 size={14} /> },
    ],
  },
  {
    label: 'Ferramentas',
    items: [
      { id: 'reportes',   label: 'Reportes',      icon: <ClipboardList size={14} /> },
      { id: 'assistente', label: 'Assistente IA',  icon: <Sparkles size={14} /> },
    ],
  },
  {
    label: 'Administração',
    items: [
      { id: 'roadmap', label: 'Roadmap', icon: <Map size={14} />, roles: ['admin', 'gestor'] },
    ],
  },
]

const badgeClasses = {
  red:   'bg-red-100 text-red-700',
  amber: 'bg-amber-100 text-amber-700',
  blue:  'bg-blue-100 text-blue-700',
  green: 'bg-green-100 text-green-700',
}

export function Sidebar({ onBackToHub }: { onBackToHub?: () => void }) {
  const { currentPage, setPage } = useStore()
  const { user, logout, isAdmin } = useAuth()
  const userRole = user?.role

  async function handleLogout() {
    await logout()
    onBackToHub?.()
  }

  const initials  = user?.initials ?? '?'
  const name      = user?.name    ?? '—'
  const roleLabel = user ? ROLE_LABELS[user.role] : ''

  return (
    <aside className="w-[220px] min-w-[220px] bg-white border-r border-gray-200 flex flex-col overflow-hidden">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 py-4 border-b border-gray-200">
        <div className="w-8 h-8 flex-shrink-0">
          <img src="/simbolo.ico" alt="BlueCrow" className="w-8 h-8 object-contain" />
        </div>
        <div className="min-w-0">
          <div className="text-[12px] font-semibold text-gray-900 leading-tight">BlueCrow</div>
          <div className="text-[10px] text-gray-400 leading-tight">Compliance</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-2">
        {NAV.map((section) => {
          const visibleItems = section.items.filter(item => {
            if (item.adminOnly && !isAdmin) return false
            if (item.roles && userRole && !item.roles.includes(userRole)) return false
            return true
          })
          if (visibleItems.length === 0) return null
          return (
            <div key={section.label}>
              <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest px-3.5 pt-3 pb-1">
                {section.label}
              </div>
              {visibleItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setPage(item.id)}
                  className={clsx(
                    'w-full flex items-center gap-2 px-3.5 py-1.5 text-[12.5px] border-l-2 transition-colors duration-100',
                    currentPage === item.id
                      ? 'bg-blue-50 text-blue-700 border-l-blue-700 font-medium'
                      : 'text-gray-500 border-l-transparent hover:bg-gray-50 hover:text-gray-900',
                  )}
                >
                  <span className={clsx('flex-shrink-0', currentPage === item.id ? 'opacity-100' : 'opacity-60')}>
                    {item.icon}
                  </span>
                  <span className="flex-1 text-left">{item.label}</span>
                  {item.badge && (
                    <span className={clsx('text-[10px] font-medium px-1.5 py-0.5 rounded-full', badgeClasses[item.badge.variant])}>
                      {item.badge.text}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )
        })}
      </nav>

      {/* User footer */}
      <div className="border-t border-gray-200 px-3.5 py-3 space-y-2.5">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-[#1e3a5f] text-white flex items-center justify-center text-[10px] font-semibold flex-shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[11px] font-medium text-gray-900 truncate">{name}</div>
            <div className="text-[10px] text-gray-400 truncate">{roleLabel}</div>
          </div>
        </div>
        <div className="flex gap-1.5">
          {onBackToHub && (
            <button
              onClick={onBackToHub}
              className="flex-1 flex items-center justify-center gap-1.5 text-[11px] font-medium text-gray-500 hover:text-gray-900 hover:bg-gray-100 px-2 py-1.5 rounded-lg transition-colors border border-gray-200"
            >
              <LayoutGrid size={11} />
              Portal
            </button>
          )}
          <button
            onClick={handleLogout}
            className="flex-1 flex items-center justify-center gap-1.5 text-[11px] font-medium text-gray-500 hover:text-red-600 hover:bg-red-50 px-2 py-1.5 rounded-lg transition-colors border border-gray-200"
          >
            <LogOut size={11} />
            Sair
          </button>
        </div>
      </div>
    </aside>
  )
}
