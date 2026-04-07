import { useState, useEffect, useCallback } from 'react'
import { loadDb, saveDb } from '../lib/db'
import type { AppDatabase } from '../types/database'

export function useDatabase(userEmail?: string) {
  const [db, setDb] = useState<AppDatabase | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadDb()
      .then(data => { setDb(data); setLoading(false) })
      .catch(err => { setError(err.message); setLoading(false) })
  }, [])

  const save = useCallback(async (updated: AppDatabase) => {
    setDb(updated)
    await saveDb(updated, userEmail)
  }, [userEmail])

  return { db, loading, error, save }
}
