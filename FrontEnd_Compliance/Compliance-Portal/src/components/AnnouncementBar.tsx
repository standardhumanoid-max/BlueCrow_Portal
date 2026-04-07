import { useState, useEffect } from 'react'
import { Megaphone } from 'lucide-react'
import { API_BASE } from '@/lib/api'

const SETTINGS_API = `${API_BASE}/api/settings`

export function AnnouncementBar() {
  const [message, setMessage] = useState('')

  useEffect(() => {
    fetch(`${SETTINGS_API}/announcement`)
      .then(r => r.json())
      .then(d => setMessage(d.value ?? ''))
      .catch(() => {})

    // Actualiza a cada 60 segundos para apanhar alterações do admin
    const id = setInterval(() => {
      fetch(`${SETTINGS_API}/announcement`)
        .then(r => r.json())
        .then(d => setMessage(d.value ?? ''))
        .catch(() => {})
    }, 60_000)
    return () => clearInterval(id)
  }, [])

  if (!message.trim()) return null

  return (
    <div className="w-full bg-amber-50 border-b border-amber-200 px-5 py-2.5 flex items-start gap-2.5 shrink-0">
      <Megaphone className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
      <p className="text-[12px] text-amber-800 leading-relaxed">{message}</p>
    </div>
  )
}
