'use client'

import { useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

type GroupBadge = 'essencial'

interface SettingsGroupProps {
  title: string
  badge?: GroupBadge
  defaultExpanded?: boolean
  children: ReactNode
}

export function SettingsGroup({ title, badge, defaultExpanded = false, children }: SettingsGroupProps) {
  const [expanded, setExpanded] = useState(defaultExpanded)

  return (
    <div className="space-y-3">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-3 text-left"
        aria-expanded={expanded}
      >
        <span className="text-base font-semibold text-foreground">{title}</span>
        {badge === 'essencial' && (
          <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700">
            Essencial
          </span>
        )}
        <ChevronDown
          className={cn(
            'ml-auto size-4 shrink-0 text-muted-foreground transition-transform duration-200',
            expanded && 'rotate-180',
          )}
        />
      </button>
      {expanded && <div className="space-y-3">{children}</div>}
    </div>
  )
}
