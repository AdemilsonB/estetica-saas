'use client'

import type { ReactNode } from 'react'

type GroupBadge = 'essencial'

interface SettingsGroupProps {
  title: string
  badge?: GroupBadge
  children: ReactNode
}

export function SettingsGroup({ title, badge, children }: SettingsGroupProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <span className="text-base font-semibold text-foreground">{title}</span>
        {badge === 'essencial' && (
          <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700">
            Essencial
          </span>
        )}
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  )
}
