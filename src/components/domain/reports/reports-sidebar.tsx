'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { BarChart2, Calendar, LineChart, Lock, Users, type LucideIcon } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { useCapabilities } from '@/hooks/billing/use-capabilities'
import { useUpgradeModal } from '@/stores/upgrade-modal.store'
import { REPORT_CAPABILITIES } from '@/shared/permissions/report-capabilities'

const ICON_BY_HREF: Record<string, LucideIcon> = {
  '/relatorios': LineChart,
  '/relatorios/financeiro': BarChart2,
  '/relatorios/agendamentos': Calendar,
  '/relatorios/clientes': Users,
}

function isItemActive(pathname: string, href: string): boolean {
  if (href === '/relatorios') return pathname === '/relatorios'
  return pathname === href || pathname.startsWith(href + '/')
}

export function ReportsSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { data: caps } = useCapabilities()
  const openUpgrade = useUpgradeModal((s) => s.openUpgrade)

  const items = REPORT_CAPABILITIES.map((item) => {
    const status = caps?.[item.capability]
    // Enquanto carrega (caps undefined), trata como permitido para não piscar cadeado.
    const locked = status ? status.allowed === false : false
    return { ...item, locked, requiredPlan: status?.requiredPlan, requiredPlanLabel: status?.requiredPlanLabel }
  })

  const activeHref = items.find((i) => isItemActive(pathname, i.href))?.href ?? items[0].href

  function handleLockedClick(item: (typeof items)[number]) {
    openUpgrade({
      capabilityKey: item.capability,
      requiredPlan: item.requiredPlan,
      requiredPlanLabel: item.requiredPlanLabel,
    })
  }

  return (
    <>
      {/* Mobile: Select */}
      <div className="md:hidden">
        <Select
          value={activeHref}
          onValueChange={(v) => {
            const item = items.find((i) => i.href === v)
            if (item?.locked) {
              handleLockedClick(item)
              return
            }
            router.push(v)
          }}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Tipo de relatório" />
          </SelectTrigger>
          <SelectContent>
            {items.map((item) => (
              <SelectItem key={item.href} value={item.href}>
                <span className="flex items-center gap-2">
                  {item.locked && <Lock className="size-3.5 shrink-0" />}
                  {item.label}
                  {item.locked && item.requiredPlanLabel && (
                    <span className="text-xs text-muted-foreground">
                      ({item.requiredPlanLabel})
                    </span>
                  )}
                </span>
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
        {items.map((item) => {
          const isActive = isItemActive(pathname, item.href)
          const Icon = ICON_BY_HREF[item.href] ?? LineChart

          if (item.locked) {
            return (
              <button
                key={item.href}
                type="button"
                aria-label={`${item.label} — disponível no plano ${item.requiredPlanLabel ?? 'superior'}`}
                onClick={() => handleLockedClick(item)}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              >
                <Lock className="size-4 shrink-0" />
                {item.label}
              </button>
            )
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition',
                isActive
                  ? 'bg-accent text-primary'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950',
              )}
            >
              <Icon className="size-4 shrink-0" />
              {item.label}
            </Link>
          )
        })}
      </nav>
    </>
  )
}
