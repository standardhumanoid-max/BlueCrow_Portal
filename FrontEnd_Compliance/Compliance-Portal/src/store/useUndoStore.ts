import { create } from 'zustand'
import { API_BASE, authFetch } from '@/lib/api'

export interface UndoItem {
  table: string
  label: string
  rowData: Record<string, unknown>
}

interface UndoState {
  item: UndoItem | null
  showUndo: (item: UndoItem) => void
  clearUndo: () => void
  restore: () => Promise<void>
}

export const useUndoStore = create<UndoState>((set, get) => ({
  item: null,

  showUndo: (item) => set({ item }),

  clearUndo: () => set({ item: null }),

  restore: async () => {
    const { item } = get()
    if (!item) return
    set({ item: null })
    try {
      await authFetch(`${API_BASE}/api/history/restore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table: item.table, row_data: item.rowData }),
      })
    } catch (e) {
      console.error('[undo] Restore failed:', e)
    }
  },
}))
