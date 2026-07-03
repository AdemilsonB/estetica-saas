'use client'

import { cn } from '@/lib/utils'
import { useTeamMembers } from '@/hooks/iam/use-team'
import { EntityImage } from '@/components/domain/shared/entity-image'

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

  function toggle(id: string) {
    onChange(
      selectedIds.includes(id)
        ? selectedIds.filter((s) => s !== id)
        : [...selectedIds, id],
    )
  }

  function toggleAll() {
    onChange(allSelected ? [] : allIds)
  }

  const sorted = [...members].sort((a, b) => {
    if (a.id === currentUserId) return -1
    if (b.id === currentUserId) return 1
    return a.name.localeCompare(b.name)
  })

  if (members.length === 0) return null

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {sorted.map((member) => {
        const isSelected = selectedIds.includes(member.id)
        const initials = member.name
          .split(' ')
          .slice(0, 2)
          .map((w) => w[0]?.toUpperCase() ?? '')
          .join('')

        return (
          <button
            key={member.id}
            onClick={() => toggle(member.id)}
            title={member.name}
            aria-label={`${isSelected ? 'Remover' : 'Adicionar'} ${member.name}`}
            aria-pressed={isSelected}
            className={cn(
              'relative size-8 rounded-full overflow-hidden ring-2 ring-offset-1 transition-all shrink-0',
              isSelected
                ? 'ring-primary opacity-100'
                : 'ring-transparent opacity-35 grayscale',
            )}
          >
            {member.avatarUrl ? (
              <EntityImage
                src={member.avatarUrl}
                cropX={member.avatarCropX}
                cropY={member.avatarCropY}
                cropZoom={member.avatarCropZoom}
                alt={member.name}
                shape="circle"
                className="size-full"
              />
            ) : (
              <span className="flex size-full items-center justify-center bg-slate-200 text-[10px] font-semibold text-slate-600">
                {initials}
              </span>
            )}
          </button>
        )
      })}

      {members.length > 1 && (
        <button
          onClick={toggleAll}
          title={allSelected ? 'Deselecionar todos' : 'Selecionar todos'}
          aria-label={allSelected ? 'Deselecionar todos os profissionais' : 'Selecionar todos os profissionais'}
          className={cn(
            'h-6 rounded-full px-2 text-[10px] font-semibold ring-1 ring-offset-0 transition-all shrink-0',
            allSelected
              ? 'ring-primary bg-primary/10 text-primary'
              : 'ring-slate-200 bg-slate-100 text-slate-400',
          )}
        >
          Todos
        </button>
      )}
    </div>
  )
}
