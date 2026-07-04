'use client'

import { useState } from 'react'
import { ChevronsUpDown, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
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
  const [open, setOpen] = useState(false)
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

  const label =
    selectedIds.length === 0
      ? 'Todos os profissionais'
      : selectedIds.length <= 2
        ? selectedIds
            .map((id) => members.find((m) => m.id === id)?.name ?? id)
            .join(', ')
        : `${selectedIds.length} profissionais`

  const sorted = [...members].sort((a, b) => {
    if (a.id === currentUserId) return -1
    if (b.id === currentUserId) return 1
    return a.name.localeCompare(b.name)
  })

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="max-w-50 justify-between h-8 text-xs px-3"
        >
          <Users className="mr-1.5 size-3.5 shrink-0" />
          <span className="truncate">{label}</span>
          <ChevronsUpDown className="ml-1.5 size-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-55 p-2" align="start">
        <div className="space-y-0.5">
          <button
            onClick={toggleAll}
            className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-sm hover:bg-slate-50 transition-colors"
          >
            <span className={cn(
              'flex size-4 shrink-0 items-center justify-center rounded-sm border transition-colors',
              allSelected ? 'border-primary bg-primary' : 'border-slate-300 bg-white',
            )}>
              {allSelected && (
                <svg viewBox="0 0 10 8" className="size-2.5 fill-current text-white">
                  <path d="M1 4l2.5 2.5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                </svg>
              )}
            </span>
            <span className="font-medium text-slate-800">Todos</span>
          </button>

          <div className="my-1 border-t border-slate-100" />

          {sorted.map((member) => {
            const isSelected = selectedIds.includes(member.id)
            return (
              <button
                key={member.id}
                onClick={() => toggle(member.id)}
                className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-sm hover:bg-slate-50 transition-colors"
              >
                <span className={cn(
                  'flex size-4 shrink-0 items-center justify-center rounded-sm border transition-colors',
                  isSelected ? 'border-primary bg-primary' : 'border-slate-300 bg-white',
                )}>
                  {isSelected && (
                    <svg viewBox="0 0 10 8" className="size-2.5 fill-current text-white">
                      <path d="M1 4l2.5 2.5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                    </svg>
                  )}
                </span>
                <span className="truncate text-slate-700">{member.name}</span>
              </button>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}
