'use client'

import type { ElementType, ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface StatusBadge {
  label: string
  variant: 'ok' | 'warn' | 'info' | 'neutral'
}

interface SettingsCardProps {
  icon: ElementType
  title: string
  subtitle: string
  statusBadge?: StatusBadge
  onEdit?: () => void
  isStatic?: boolean
  children?: ReactNode
}

const BADGE_STYLES: Record<StatusBadge['variant'], string> = {
  ok:      'bg-emerald-50 text-emerald-700 border-emerald-200',
  warn:    'bg-amber-50 text-amber-700 border-amber-200',
  info:    'bg-blue-50 text-blue-700 border-blue-200',
  neutral: 'bg-slate-100 text-slate-600 border-slate-200',
}

export function SettingsCard({
  icon: Icon,
  title,
  subtitle,
  statusBadge,
  onEdit,
  isStatic = false,
  children,
}: SettingsCardProps) {
  return (
    <div className="rounded-2xl border border-white/80 bg-white/85 shadow-sm">
      <div className="flex items-start gap-3 p-4 sm:p-5">
        <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent/50 text-foreground">
          <Icon className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-foreground">{title}</span>
            {statusBadge && (
              <span className={cn(
                'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium',
                BADGE_STYLES[statusBadge.variant],
              )}>
                {statusBadge.label}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
          {children}
        </div>
        {!isStatic && onEdit && (
          <Button size="sm" variant="outline" onClick={onEdit} className="shrink-0">
            Editar
          </Button>
        )}
      </div>
    </div>
  )
}
