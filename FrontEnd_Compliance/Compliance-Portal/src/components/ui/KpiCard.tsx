import { clsx } from 'clsx'

type Color = 'blue' | 'green' | 'amber' | 'red' | 'gray'

const colors: Record<Color, string> = {
  blue:  'border-b-blue-500',
  green: 'border-b-green-600',
  amber: 'border-b-amber-600',
  red:   'border-b-red-600',
  gray:  'border-b-gray-300',
}

interface Props {
  label: string
  value: string | number
  sub?: string
  color?: Color
  trend?: 'up' | 'down' | 'neutral'
  onClick?: () => void
  active?: boolean
}

export function KpiCard({ label, value, sub, color = 'blue', trend, onClick, active }: Props) {
  return (
    <div
      onClick={onClick}
      className={clsx(
        'bg-white rounded-lg border p-4 border-b-[3px] transition-all',
        colors[color],
        onClick && 'cursor-pointer hover:shadow-md',
        active ? 'ring-2 ring-offset-1 shadow-md' : 'border-gray-200',
        active && color === 'red'   && 'ring-red-400',
        active && color === 'amber' && 'ring-amber-400',
        active && color === 'blue'  && 'ring-blue-400',
        active && color === 'green' && 'ring-green-500',
      )}
    >
      <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
        {label}
      </div>
      <div className="text-[24px] font-semibold text-gray-900 leading-none">
        {value}
      </div>
      {sub && (
        <div className={clsx('text-[11px] mt-1.5', {
          'text-green-600': trend === 'up',
          'text-red-600':   trend === 'down',
          'text-gray-400':  trend === 'neutral' || !trend,
        })}>
          {sub}
        </div>
      )}
    </div>
  )
}
