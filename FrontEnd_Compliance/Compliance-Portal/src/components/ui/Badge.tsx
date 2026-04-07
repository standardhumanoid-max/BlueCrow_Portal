import { clsx } from 'clsx'

type Variant = 'blue' | 'green' | 'amber' | 'red' | 'gray' | 'dark'

const variants: Record<Variant, string> = {
  blue:  'bg-blue-50 text-blue-700',
  green: 'bg-green-50 text-green-700',
  amber: 'bg-amber-50 text-amber-700',
  red:   'bg-red-50 text-red-700',
  gray:  'bg-gray-100 text-gray-600',
  dark:  'bg-[#1e3a5f] text-white rounded',
}

interface Props {
  variant?: Variant
  children: React.ReactNode
  className?: string
}

export function Badge({ variant = 'gray', children, className }: Props) {
  return (
    <span className={clsx(
      'inline-flex items-center text-[10px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap',
      variants[variant],
      className
    )}>
      {children}
    </span>
  )
}

export function prioVariant(p: string): Variant {
  const map: Record<string, Variant> = {
    'Q1': 'red', 'Q2': 'amber', 'Q3': 'blue', 'Q4': 'gray', 'Ongoing': 'dark',
    'Alta': 'red', 'Média': 'amber', 'Baixa': 'green',
  }
  return map[p] ?? 'gray'
}

export function estadoVariant(e: string): Variant {
  const map: Record<string, Variant> = {
    'Em andamento': 'blue', 'Em curso': 'blue', 'Por iniciar': 'gray', 'Em atraso': 'red', 'Concluído': 'green',
    'Crítico': 'red',   'Alto': 'amber',        'Médio': 'blue',    'Baixo': 'green',
    'Ativo': 'green',   'Em revisão': 'amber',
    'Aceite': 'green',  'Em Revisão': 'amber',  'Pendente': 'blue', 'Recusado': 'red',
    'Completo': 'green','Expirado': 'red',       'Muito Alto': 'red',
    'Vigente': 'green', 'Em elaboração': 'amber','Revogado': 'red',
    'Em análise': 'amber', 'Atribuída': 'blue', 'Resolvida': 'green', 'Fechada': 'gray',
    'Sim': 'amber', 'Não': 'gray',
  }
  return map[e] ?? 'gray'
}
