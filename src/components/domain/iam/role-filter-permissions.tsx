'use client'

import { Checkbox } from '@/components/ui/checkbox'
import type { NavSection } from '@/shared/permissions/nav-registry'

type Props = {
  sections: NavSection[]
  permissions: Record<string, string[]>
  onChange: (next: Record<string, string[]>) => void
  disabled?: boolean
}

export function RoleFilterPermissions({ sections, permissions, onChange, disabled }: Props) {
  const filterSections = sections.filter(
    (s) => s.filterLabel && s.actions.includes('view_all'),
  )

  if (filterSections.length === 0) return null

  function toggle(sectionKey: string, checked: boolean) {
    const current = permissions[sectionKey] ?? []
    const next = checked
      ? [...new Set([...current, 'view_all'])]
      : current.filter((a) => a !== 'view_all')
    onChange({ ...permissions, [sectionKey]: next })
  }

  return (
    <div className="space-y-2">
      {filterSections.map((section) => {
        const checked = (permissions[section.key] ?? []).includes('view_all')
        return (
          <div key={section.key} className="flex items-center gap-3">
            <Checkbox
              checked={checked}
              disabled={disabled}
              onCheckedChange={(v) => toggle(section.key, Boolean(v))}
            />
            <span className="text-sm text-slate-700">
              {section.filterLabel}
              <span className="ml-1 text-slate-400">— {section.label}</span>
            </span>
          </div>
        )
      })}
    </div>
  )
}
