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
            <CommandItem value="__all__" onSelect={toggleAll}>
              <Check
                className={cn('mr-2 size-4', allSelected ? 'opacity-100' : 'opacity-0')}
              />
              <span className="font-medium">Todos</span>
            </CommandItem>
            {sorted.map((member) => {
              const isSelected = selectedIds.includes(member.id)
              return (
                <CommandItem
                  key={member.id}
                  value={member.name}
                  onSelect={() => toggle(member.id)}
                >
                  <Check
                    className={cn('mr-2 size-4', isSelected ? 'opacity-100' : 'opacity-0')}
                  />
                  <span className="truncate">{member.name}</span>
                </CommandItem>
              )
            })}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
