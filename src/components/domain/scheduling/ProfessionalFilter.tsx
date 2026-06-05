'use client'

import { useState } from 'react'
import { Check, ChevronsUpDown, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from '@/components/ui/command'
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

  function toggle(id: string) {
    if (id === currentUserId) return
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((s) => s !== id))
    } else {
      onChange([...selectedIds, id])
    }
  }

  const label =
    selectedIds.length === 0
      ? 'Nenhum profissional'
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
          className="max-w-[220px] justify-between"
        >
          <Users className="mr-2 size-4 shrink-0" />
          <span className="truncate">{open ? '' : label}</span>
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[220px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar profissional..." />
          <CommandEmpty>Nenhum profissional encontrado.</CommandEmpty>
          <CommandGroup>
            {sorted.map((member) => {
              const isCurrentUser = member.id === currentUserId
              const isSelected = selectedIds.includes(member.id)
              return (
                <CommandItem
                  key={member.id}
                  value={member.name}
                  onSelect={() => toggle(member.id)}
                  disabled={isCurrentUser}
                  className={cn(isCurrentUser && 'cursor-default opacity-70')}
                >
                  <Check
                    className={cn(
                      'mr-2 size-4',
                      isSelected ? 'opacity-100' : 'opacity-0',
                    )}
                  />
                  <span className="truncate">
                    {member.name}
                    {isCurrentUser && (
                      <span className="ml-1 text-xs text-slate-400">(você)</span>
                    )}
                  </span>
                </CommandItem>
              )
            })}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
