'use client'

import { useState, type ElementType, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PendingDot } from '@/components/domain/shared/pending-dot'

interface StatusBadge {
  label: string
  variant: 'ok' | 'warn' | 'info' | 'neutral'
}

interface SettingsCardProps {
  icon: ElementType
  title: string
  subtitle: string
  statusBadge?: StatusBadge
  pending?: boolean
  children?: ReactNode
  defaultExpanded?: boolean
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
  pending,
  children,
  defaultExpanded = false,
}: SettingsCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const isInteractive = Boolean(children)

  return (
    <div className="rounded-2xl border border-white/80 bg-white/85 shadow-sm">
      <button
        type="button"
        onClick={() => { if (isInteractive) setExpanded(v => !v) }}
        className={cn(
          'flex w-full items-start gap-3 p-4 text-left sm:p-5',
          isInteractive && 'cursor-pointer transition hover:bg-black/2',
          !isInteractive && 'cursor-default',
        )}
        aria-expanded={isInteractive ? expanded : undefined}
      >
        <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent/50 text-foreground">
          <Icon className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-foreground">{title}</span>
            {pending && <PendingDot label={`${title} pendente`} />}
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
        </div>
        {isInteractive && (
          <ChevronDown
            className={cn(
              'mt-1 size-4 shrink-0 text-muted-foreground transition-transform duration-200',
              expanded && 'rotate-180',
            )}
          />
        )}
      </button>
      {isInteractive && expanded && (
        <div className="border-t border-border/50 px-4 py-5 sm:px-5">
          {children}
        </div>
      )}
    </div>
  )
}
