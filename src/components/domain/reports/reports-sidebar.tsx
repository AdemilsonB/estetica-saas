'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BarChart2, Calendar, Users, Scissors } from 'lucide-react'
import { cn } from '@/lib/utils'

const REPORT_ITEMS = [
  { label: 'Financeiro', href: '/relatorios/financeiro', icon: BarChart2 },
  { label: 'Agendamentos', href: '/relatorios/agendamentos', icon: Calendar },
  { label: 'Clientes', href: '/relatorios/clientes', icon: Users },
  { label: 'Profissionais', href: '/relatorios/profissionais', icon: Scissors },
] as const

export function ReportsSidebar() {
  const pathname = usePathname()

  return (
    <nav className="flex flex-col gap-1">
      <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
        Tipo de relatório
      </p>
      {REPORT_ITEMS.map(({ label, href, icon: Icon }) => {
        const isActive = pathname.startsWith(href)
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition',
              isActive
                ? 'bg-rose-50 text-rose-700'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950',
            )}
          >
            <Icon className="size-4 shrink-0" />
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
