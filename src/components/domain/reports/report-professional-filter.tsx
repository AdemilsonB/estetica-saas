'use client'

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useTeamMembers } from '@/hooks/iam/use-team'

type Props = {
  value: string
  onChange: (id: string) => void
}

export function ReportProfessionalFilter({ value, onChange }: Props) {
  const { data: members = [] } = useTeamMembers()

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-full sm:w-52">
        <SelectValue placeholder="Todos os profissionais" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">Todos os profissionais</SelectItem>
        {members.map((m) => (
          <SelectItem key={m.id} value={m.id}>
            {m.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
