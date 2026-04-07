import { useEffect, useState, useMemo } from 'react'
import { useStore } from '@/store/useStore'
import { useAuth } from '@/context/AuthContext'
import type { AuditLog, AuditAction } from '@/types'
import { Shield, LogIn, LogOut, Plus, Edit2, Trash2, Download, Search, Filter, FileSpreadsheet, ShieldAlert, X, AlertTriangle } from 'lucide-react'
import { utils, writeFile } from 'xlsx'
import type { SecurityAlert } from '@/types'

// ─── Helpers ─────────────────────────────────────────────────────────────────
const ACTION_LABEL: Record<AuditAction, string> = {
  CREATE:       'Criação',
  UPDATE:       'Atualização',
  DELETE:       'Eliminação',
  LOGIN:        'Login',
  LOGIN_FAILED: 'Login Falhado',
  LOGOUT:       'Logout',
  EXPORT:       'Exportação',
}

const ACTION_COLOR: Record<AuditAction, string> = {
  CREATE:       'bg-green-100 text-green-700',
  UPDATE:       'bg-blue-100 text-blue-700',
  DELETE:       'bg-red-100 text-red-700',
  LOGIN:        'bg-indigo-100 text-indigo-700',
  LOGIN_FAILED: 'bg-orange-100 text-orange-700',
  LOGOUT:       'bg-gray-100 text-gray-600',
  EXPORT:       'bg-purple-100 text-purple-700',
}

const ACTION_ICON: Record<AuditAction, React.ReactNode> = {
  CREATE:       <Plus size={11} />,
  UPDATE:       <Edit2 size={11} />,
  DELETE:       <Trash2 size={11} />,
  LOGIN:        <LogIn size={11} />,
  LOGIN_FAILED: <Shield size={11} />,
  LOGOUT:       <LogOut size={11} />,
  EXPORT:       <Download size={11} />,
}

function fmtDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' })
    + ' ' + d.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })
}

// ─── Stats card ───────────────────────────────────────────────────────────────
function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col gap-1">
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      <div className="text-xs text-gray-500">{label}</div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export function Auditoria() {
  const { auditLogs, loadAuditLogs, securityAlerts, dismissSecurityAlert } = useStore()
  const { isAdmin } = useAuth()

  const [search, setSearch]       = useState('')
  const [filterAction, setFilterAction] = useState<AuditAction | ''>('')
  const [filterEntity, setFilterEntity] = useState('')
  const [filterUser, setFilterUser]     = useState('')
  const [filterDate, setFilterDate]     = useState('')

  useEffect(() => {
    loadAuditLogs()
  }, [])

  const entities = useMemo(
    () => [...new Set(auditLogs.map(l => l.entity))].sort(),
    [auditLogs]
  )
  const users = useMemo(
    () => [...new Set(auditLogs.map(l => l.user_name))].sort(),
    [auditLogs]
  )

  const filtered = useMemo(() => {
    return auditLogs.filter(log => {
      if (filterAction && log.action !== filterAction) return false
      if (filterEntity && log.entity !== filterEntity) return false
      if (filterUser && log.user_name !== filterUser) return false
      if (filterDate && !log.created_at.startsWith(filterDate)) return false
      if (search) {
        const q = search.toLowerCase()
        if (
          !log.entity_label.toLowerCase().includes(q) &&
          !log.user_name.toLowerCase().includes(q) &&
          !log.entity.toLowerCase().includes(q)
        ) return false
      }
      return true
    })
  }, [auditLogs, filterAction, filterEntity, filterUser, filterDate, search])

  // stats
  const stats = useMemo(() => ({
    total:    auditLogs.length,
    creates:  auditLogs.filter(l => l.action === 'CREATE').length,
    updates:  auditLogs.filter(l => l.action === 'UPDATE').length,
    deletes:  auditLogs.filter(l => l.action === 'DELETE').length,
    logins:   auditLogs.filter(l => l.action === 'LOGIN').length,
    failures: auditLogs.filter(l => l.action === 'LOGIN_FAILED').length,
  }), [auditLogs])

  function exportExcel() {
    const rows = filtered.map(l => ({
      'Data/Hora':    fmtDate(l.created_at),
      'Utilizador':   l.user_name,
      'Ação':         ACTION_LABEL[l.action],
      'Módulo':       l.entity,
      'Registo':      l.entity_label,
    }))
    const ws = utils.json_to_sheet(rows)
    ws['!cols'] = [{ wch: 18 }, { wch: 22 }, { wch: 14 }, { wch: 20 }, { wch: 45 }]
    const wb = utils.book_new()
    utils.book_append_sheet(wb, ws, 'Audit Log')
    writeFile(wb, `auditoria_${new Date().toISOString().slice(0, 10)}.xlsx`)
    useStore.getState().addAuditLog({ action: 'EXPORT', entity: 'Auditoria', entity_label: `Exportação de ${filtered.length} registos` })
  }

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Shield size={40} className="text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">Acesso restrito a administradores.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-5 max-w-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Registo de Auditoria</h1>
          <p className="text-xs text-gray-400 mt-0.5">Histórico de todas as ações realizadas no portal</p>
        </div>
        <button
          onClick={exportExcel}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white text-xs rounded-lg hover:bg-emerald-700 transition-colors"
        >
          <FileSpreadsheet size={13} />
          Exportar Excel
        </button>
      </div>

      {/* Security Alerts panel */}
      {securityAlerts.filter(a => !a.dismissed).length > 0 && (
        <div className="space-y-2">
          {securityAlerts.filter(a => !a.dismissed).map((alert: SecurityAlert) => (
            <div key={alert.id} className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${
              alert.severity === 'Crítico' ? 'bg-red-50 border-red-200'
              : alert.severity === 'Alto'  ? 'bg-orange-50 border-orange-200'
              :                              'bg-amber-50 border-amber-200'
            }`}>
              <ShieldAlert size={15} className={`flex-shrink-0 mt-0.5 ${
                alert.severity === 'Crítico' ? 'text-red-500'
                : alert.severity === 'Alto'  ? 'text-orange-500'
                :                              'text-amber-500'
              }`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs font-semibold ${
                    alert.severity === 'Crítico' ? 'text-red-800'
                    : alert.severity === 'Alto'  ? 'text-orange-800'
                    :                              'text-amber-800'
                  }`}>{alert.title}</span>
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                    alert.severity === 'Crítico' ? 'bg-red-100 text-red-700'
                    : alert.severity === 'Alto'  ? 'bg-orange-100 text-orange-700'
                    :                              'bg-amber-100 text-amber-700'
                  }`}>{alert.severity}</span>
                </div>
                <p className="text-xs text-gray-600 mt-0.5">{alert.message}</p>
                <p className="text-[10px] text-gray-400 mt-0.5 flex items-center gap-1">
                  <AlertTriangle size={9} /> {new Date(alert.created_at).toLocaleString('pt-PT')}
                </p>
              </div>
              <button
                onClick={() => dismissSecurityAlert(alert.id)}
                className="flex-shrink-0 text-gray-400 hover:text-gray-700 transition-colors mt-0.5"
                title="Dispensar alerta"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard label="Total" value={stats.total} color="text-gray-800" />
        <StatCard label="Criações" value={stats.creates} color="text-green-600" />
        <StatCard label="Atualizações" value={stats.updates} color="text-blue-600" />
        <StatCard label="Eliminações" value={stats.deletes} color="text-red-600" />
        <StatCard label="Logins" value={stats.logins} color="text-indigo-600" />
        <StatCard label="Falhas de Login" value={stats.failures} color="text-orange-600" />
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-wrap gap-3 items-end">
          {/* Search */}
          <div className="flex-1 min-w-[160px]">
            <label className="block text-[10px] font-medium text-gray-500 mb-1 uppercase tracking-wide">Pesquisa</label>
            <div className="relative">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Registo, utilizador, módulo…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-7 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Action filter */}
          <div>
            <label className="block text-[10px] font-medium text-gray-500 mb-1 uppercase tracking-wide">Ação</label>
            <select
              value={filterAction}
              onChange={e => setFilterAction(e.target.value as AuditAction | '')}
              className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">Todas</option>
              {(Object.keys(ACTION_LABEL) as AuditAction[]).map(a => (
                <option key={a} value={a}>{ACTION_LABEL[a]}</option>
              ))}
            </select>
          </div>

          {/* Entity filter */}
          <div>
            <label className="block text-[10px] font-medium text-gray-500 mb-1 uppercase tracking-wide">Módulo</label>
            <select
              value={filterEntity}
              onChange={e => setFilterEntity(e.target.value)}
              className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">Todos</option>
              {entities.map(e => <option key={e} value={e}>{e}</option>)}
            </select>
          </div>

          {/* User filter */}
          <div>
            <label className="block text-[10px] font-medium text-gray-500 mb-1 uppercase tracking-wide">Utilizador</label>
            <select
              value={filterUser}
              onChange={e => setFilterUser(e.target.value)}
              className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">Todos</option>
              {users.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>

          {/* Date filter */}
          <div>
            <label className="block text-[10px] font-medium text-gray-500 mb-1 uppercase tracking-wide">Data</label>
            <input
              type="date"
              value={filterDate}
              onChange={e => setFilterDate(e.target.value)}
              className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Clear */}
          {(search || filterAction || filterEntity || filterUser || filterDate) && (
            <button
              onClick={() => { setSearch(''); setFilterAction(''); setFilterEntity(''); setFilterUser(''); setFilterDate('') }}
              className="text-xs text-gray-400 hover:text-gray-700 px-2 py-1.5 flex items-center gap-1"
            >
              <Filter size={11} /> Limpar
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-2.5 border-b border-gray-100 flex items-center justify-between">
          <span className="text-xs text-gray-500">{filtered.length} registos</span>
        </div>

        {filtered.length === 0 ? (
          <div className="py-16 text-center text-sm text-gray-400">Nenhum registo encontrado.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-4 py-2 font-medium text-gray-500 whitespace-nowrap">Data / Hora</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-500">Utilizador</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-500">Ação</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-500">Módulo</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-500">Registo</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((log, i) => (
                  <tr
                    key={log.id}
                    className={`border-b border-gray-50 hover:bg-gray-50 transition-colors ${i % 2 === 0 ? '' : 'bg-gray-50/40'}`}
                  >
                    <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap font-mono text-[10px]">
                      {fmtDate(log.created_at)}
                    </td>
                    <td className="px-4 py-2.5 text-gray-800 font-medium">{log.user_name}</td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${ACTION_COLOR[log.action]}`}>
                        {ACTION_ICON[log.action]}
                        {ACTION_LABEL[log.action]}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-gray-600">{log.entity}</td>
                    <td className="px-4 py-2.5 text-gray-700 max-w-xs truncate" title={log.entity_label}>
                      {log.entity_label}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
