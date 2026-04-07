import { Construction } from 'lucide-react'

interface Props {
  title: string
  description?: string
}

export function Placeholder({ title, description }: Props) {
  return (
    <div className="p-6 flex items-center justify-center min-h-[300px]">
      <div className="text-center">
        <Construction size={32} className="text-gray-300 mx-auto mb-3" />
        <div className="text-[14px] font-semibold text-gray-700 mb-1">{title}</div>
        <div className="text-[12px] text-gray-400">
          {description ?? 'Conteúdo desta secção a desenvolver.'}
        </div>
      </div>
    </div>
  )
}
