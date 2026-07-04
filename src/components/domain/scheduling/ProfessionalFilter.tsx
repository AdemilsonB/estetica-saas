'use client'

import { cn } from '@/lib/utils'
import { useTeamMembers } from '@/hooks/iam/use-team'

interface ProfessionalFilterProps {
  selectedIds: string[]
  onChange: (ids: string[]) => void
  currentUserId: string
}

export function ProfessionalFilter({
  selectedIds,
  onChange,
  currentUserId,
}: ProfessionalFilterProps) {
  const { data: members = [] } = useTeamMembers()

  const allIds = members.map((m) => m.id)
  const allSelected = allIds.length > 0 && allIds.every((id) => selectedIds.includes(id))

  function toggleAll() {
    onChange(allSelected ? [] : allIds)
  }

  function toggle(id: string) {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((s) => s !== id))
    } else {
      onChange([...selectedIds, id])
    }
  }

  const sorted = [...members].sort((a, b) => {
    if (a.id === currentUserId) return -1
    if (b.id === currentUserId) return 1
    return a.name.localeCompare(b.name)
  })

  return (
    <div className="flex flex-wrap gap-1.5">
      <button
        onClick={toggleAll}
        className={cn(
          'rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors',
          allSelected
            ? 'border-primary bg-primary text-primary-foreground'
            : 'border-slate-200 bg-white text-slate-600 hover:border-primary/40 hover:text-slate-900',
        )}
      >
        Todos
      </button>
      {sorted.map((member) => {
        const isSelected = selectedIds.includes(member.id)
        return (
          <button
            key={member.id}
            onClick={() => toggle(member.id)}
            className={cn(
              'rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors',
              isSelected
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-slate-200 bg-white text-slate-600 hover:border-primary/40 hover:text-slate-900',
            )}
          >
            {member.name}
          </button>
        )
      })}
    </div>
  )
}
