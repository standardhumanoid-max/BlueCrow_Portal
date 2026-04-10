import { useEffect } from 'react'
import { useUndoStore } from '@/store/useUndoStore'
import { RotateCcw, X } from 'lucide-react'

const TIMEOUT_MS = 10_000

export function UndoToast() {
  const { item, clearUndo, restore } = useUndoStore()

  // Auto-dismiss após 10 segundos
  useEffect(() => {
    if (!item) return
    const t = setTimeout(clearUndo, TIMEOUT_MS)
    return () => clearTimeout(t)
  }, [item, clearUndo])

  if (!item) return null

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999]
                    flex items-center gap-3
                    bg-slate-800 text-white text-[12px] font-medium
                    px-4 py-2.5 rounded-xl shadow-2xl border border-white/10
                    animate-in slide-in-from-top-2 duration-300 pointer-events-auto">
      <span className="text-slate-300 max-w-[260px] truncate">
        <span className="text-white font-semibold">{item.label}</span> apagado.
      </span>
      <button
        onClick={restore}
        className="flex items-center gap-1.5 text-blue-400 hover:text-blue-300
                   transition-colors font-semibold whitespace-nowrap"
      >
        <RotateCcw size={12} /> Reverter
      </button>
      <button
        onClick={clearUndo}
        className="text-slate-500 hover:text-slate-300 transition-colors ml-1"
      >
        <X size={13} />
      </button>
    </div>
  )
}
