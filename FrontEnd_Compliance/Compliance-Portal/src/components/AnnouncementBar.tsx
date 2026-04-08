import { useState, useEffect, useRef } from 'react'
import { Megaphone, X } from 'lucide-react'
import { API_BASE } from '@/lib/api'

const SETTINGS_API = `${API_BASE}/api/settings`

export function AnnouncementBar() {
  const [message,   setMessage]   = useState('')
  const [dismissed, setDismissed] = useState(false)
  const [showClose, setShowClose] = useState(false)
  const iterRef    = useRef(0)
  const prevMsgRef = useRef('')

  useEffect(() => {
    fetch(`${SETTINGS_API}/announcement`)
      .then(r => r.json())
      .then(d => setMessage(d.value ?? ''))
      .catch(() => {})

    const id = setInterval(() => {
      fetch(`${SETTINGS_API}/announcement`)
        .then(r => r.json())
        .then(d => setMessage(d.value ?? ''))
        .catch(() => {})
    }, 60_000)
    return () => clearInterval(id)
  }, [])

  // Quando a mensagem muda, reset do estado de fecho
  useEffect(() => {
    if (message !== prevMsgRef.current) {
      prevMsgRef.current = message
      setDismissed(false)
      setShowClose(false)
      iterRef.current = 0
    }
  }, [message])

  function handleIteration() {
    iterRef.current += 1
    if (iterRef.current >= 2) setShowClose(true)
  }

  if (!message.trim() || dismissed) return null

  // Duração proporcional ao comprimento da mensagem (mínimo 12s, ~0.12s por caracter)
  const duration = Math.max(12, Math.round(message.length * 0.14))

  return (
    <>
      <style>{`
        @keyframes ticker {
          0%   { transform: translateX(100vw); }
          100% { transform: translateX(-100%); }
        }
      `}</style>
      <div className="w-full bg-amber-50 border-b border-amber-200 flex items-center shrink-0 overflow-hidden" style={{ height: 34 }}>
        {/* Ícone fixo à esquerda */}
        <div className="flex items-center gap-1.5 px-3 shrink-0 z-10 bg-amber-50 border-r border-amber-200 h-full">
          <Megaphone className="w-3.5 h-3.5 text-amber-600" />
          <span className="text-[10px] font-semibold text-amber-700 uppercase tracking-wider">Comunicado</span>
        </div>

        {/* Ticker */}
        <div className="flex-1 overflow-hidden h-full flex items-center">
          <span
            className="text-[12px] text-amber-800 whitespace-nowrap font-medium"
            style={{
              display: 'inline-block',
              animation: `ticker ${duration}s linear infinite`,
            }}
            onAnimationIteration={handleIteration}
          >
            {message}
            <span className="mx-16 text-amber-300">◆</span>
            {message}
          </span>
        </div>

        {/* Botão fechar — aparece após 2 voltas */}
        {showClose && (
          <button
            onClick={() => setDismissed(true)}
            className="shrink-0 px-3 h-full flex items-center text-amber-500 hover:text-amber-800 hover:bg-amber-100 transition-colors"
            title="Fechar"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </>
  )
}
