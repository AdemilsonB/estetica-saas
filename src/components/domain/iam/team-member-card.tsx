// src/components/domain/iam/team-member-card.tsx
'use client'

import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useUpdateMemberRole, type TeamMember, type UserRole } from '@/hooks/iam/use-team'
import { useCurrentUser } from '@/hooks/use-current-user'
import { cn } from '@/lib/utils'

const ROLE_LABELS: Record<UserRole, string> = {
  OWNER:         'Dono',
  MANAGER:       'Gerente',
  PROFESSIONAL:  'Profissional',
  RECEPTIONIST:  'Recepcionista',
}

const ROLE_COLORS: Record<UserRole, string> = {
  OWNER:         'bg-slate-950 text-white',
  MANAGER:       'bg-blue-100 text-blue-700',
  PROFESSIONAL:  'bg-emerald-100 text-emerald-700',
  RECEPTIONIST:  'bg-purple-100 text-purple-700',
}

type Props = {
  member: TeamMember
  canManage: boolean
}

export function TeamMemberCard({ member, canManage }: Props) {
  const { data: currentUser } = useCurrentUser()
  const updateRole = useUpdateMemberRole()
  const isCurrentUser = currentUser?.id === member.id
  const isOwner = member.role === 'OWNER'
  const canEditRole = canManage && !isCurrentUser && !isOwner

  function handleRoleChange(newRole: string) {
    updateRole.mutate(
      { userId: member.id, role: newRole as Exclude<UserRole, 'OWNER'> },
      {
        onSuccess: () => toast.success('Papel atualizado'),
        onError: (err) => toast.error(err instanceof Error ? err.message : 'Erro ao atualizar'),
      },
    )
  }

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-700">
        {member.name.slice(0, 2).toUpperCase()}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-slate-950">{member.name}</p>
          {isCurrentUser && (
            <span className="text-xs text-slate-400">(você)</span>
          )}
        </div>
        <p className="text-xs text-slate-500">{member.email}</p>
      </div>

      {canEditRole ? (
        <Select
          value={member.role}
          onValueChange={handleRoleChange}
          disabled={updateRole.isPending}
        >
          <SelectTrigger className="w-36 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="MANAGER">Gerente</SelectItem>
            <SelectItem value="PROFESSIONAL">Profissional</SelectItem>
            <SelectItem value="RECEPTIONIST">Recepcionista</SelectItem>
          </SelectContent>
        </Select>
      ) : (
        <Badge className={cn('text-xs', ROLE_COLORS[member.role])}>
          {ROLE_LABELS[member.role]}
        </Badge>
      )}
    </div>
  )
}
