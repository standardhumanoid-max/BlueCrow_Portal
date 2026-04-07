import { useEffect, useRef } from 'react'
import { useStore } from '@/store/useStore'
import { ShieldAlert, X, AlertTriangle } from 'lucide-react'
import type { SecurityAlert } from '@/types'

const SEV_STYLE: Record<SecurityAlert['severity'], string> = {
  Crítico: 'bg-red-600   border-red-700',
  Alto:    'bg-orange-500 border-orange-600',
  Médio:   'bg-amber-500  border-amber-600',
}

function Toast({ alert, onDismiss }: { alert: SecurityAlert; onDismiss: () => void }) {
  // Auto-dismiss após 10 segundos
  useEffect(() => {
    const t = setTimeout(onDismiss, 10_000)
    return () => clearTimeout(t)
  }, [onDismiss])

  return (
    <div className={`flex items-start gap-3 text-white rounded-xl border px-4 py-3 shadow-xl w-80 ${SEV_STYLE[alert.severity]} animate-in slide-in-from-right-4 duration-300`}>
      <ShieldAlert size={16} className="flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <div className="text-[12px] font-semibold leading-snug">{alert.title}</div>
        <div className="text-[11px] opacity-90 mt-0.5 leading-snug">{alert.message}</div>
        <div className="text-[10px] opacity-60 mt-1 flex items-center gap-1">
          <AlertTriangle size={9} /> Alerta de Segurança · {alert.severity}
        </div>
      </div>
      <button onClick={onDismiss} className="flex-shrink-0 opacity-70 hover:opacity-100 transition-opacity mt-0.5">
        <X size={14} />
      </button>
    </div>
  )
}

export function SecurityAlertToast() {
  const { securityAlerts, dismissSecurityAlert } = useStore()
  const shown = securityAlerts.filter(a => !a.dismissed)

  // Só mostra o alerta mais recente (o primeiro da lista)
  if (shown.length === 0) return null

  return (
    <div className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2 pointer-events-none">
      {shown.slice(0, 3).map(alert => (
        <div key={alert.id} className="pointer-events-auto">
          <Toast alert={alert} onDismiss={() => dismissSecurityAlert(alert.id)} />
        </div>
      ))}
    </div>
  )
}
