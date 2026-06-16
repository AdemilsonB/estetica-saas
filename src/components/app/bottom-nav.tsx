'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Calendar, Users, Plus, DollarSign, Menu } from 'lucide-react'
import { cn } from '@/lib/utils'

interface BottomNavProps {
  onNewAppointment: () => void
  onOpenMenu: () => void
}

const NAV_ITEMS = [
  { icon: Calendar, label: 'Agenda', href: '/agenda' },
  { icon: Users, label: 'Clientes', href: '/clientes' },
  null, // slot do FAB central
  { icon: DollarSign, label: 'Financeiro', href: '/financeiro' },
] as const

export function BottomNav({ onNewAppointment, onOpenMenu }: BottomNavProps) {
  const pathname = usePathname()

  return (
    <nav
      aria-label="Navegação principal mobile"
      className="fixed bottom-0 left-0 right-0 z-40 flex items-end justify-around border-t border-border/50 bg-background/95 pt-2 backdrop-blur md:hidden"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 0.5rem)' }}
    >
      {NAV_ITEMS.map((item, i) => {
        if (item === null) {
          return (
            <button
              key="fab"
              onClick={onNewAppointment}
              aria-label="Novo agendamento"
              className="-mt-5 flex size-14 items-center justify-center rounded-full bg-primary shadow-lg shadow-primary/30 text-primary-foreground transition hover:opacity-90 active:scale-95"
            >
              <Plus className="size-6" />
            </button>
          )
        }
        const Icon = item.icon
        const isActive = pathname.startsWith(item.href)
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex flex-col items-center gap-0.5 px-3 pb-1 text-[10px] font-medium',
              isActive ? 'text-primary' : 'text-muted-foreground',
            )}
          >
            <Icon className={cn('size-5', isActive && 'fill-primary/15')} />
            <span>{item.label}</span>
          </Link>
        )
      })}

      <button
        onClick={onOpenMenu}
        className="flex flex-col items-center gap-0.5 px-3 pb-1 text-[10px] font-medium text-muted-foreground"
      >
        <Menu className="size-5" />
        <span>Menu</span>
      </button>
    </nav>
  )
}
