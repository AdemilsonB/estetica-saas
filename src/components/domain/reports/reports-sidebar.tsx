'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { BarChart2, Calendar, Users } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'

const REPORT_ITEMS = [
  { label: 'Financeiro', href: '/relatorios/financeiro', icon: BarChart2 },
  { label: 'Agendamentos', href: '/relatorios/agendamentos', icon: Calendar },
  { label: 'Clientes', href: '/relatorios/clientes', icon: Users },
] as const

export function ReportsSidebar() {
  const pathname = usePathname()
  const router = useRouter()

  const activeHref =
    REPORT_ITEMS.find((i) => pathname === i.href || pathname.startsWith(i.href + '/'))?.href ??
    REPORT_ITEMS[0].href

  return (
    <>
      {/* Mobile: Select */}
      <div className="md:hidden">
        <Select value={activeHref} onValueChange={(v) => router.push(v)}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Tipo de relatório" />
          </SelectTrigger>
          <SelectContent>
            {REPORT_ITEMS.map(({ label, href }) => (
              <SelectItem key={href} value={href}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Desktop: lista de links */}
      <nav className="hidden md:flex flex-col gap-1">
        <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
          Tipo de relatório
        </p>
        {REPORT_ITEMS.map(({ label, href, icon: Icon }) => {
          const isActive = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition',
                isActive
                  ? 'bg-accent text-primary'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950',
              )}
            >
              <Icon className="size-4 shrink-0" />
              {label}
            </Link>
          )
        })}
      </nav>
    </>
  )
}
