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
import { useUpdateMemberRole, type TeamMember } from '@/hooks/iam/use-team'
import { useCurrentUser } from '@/hooks/use-current-user'
import { useRoles } from '@/hooks/iam/use-roles'

type Props = {
  member: TeamMember
  canManage: boolean
}

export function TeamMemberCard({ member, canManage }: Props) {
  const { data: currentUser } = useCurrentUser()
  const { data: roles = [] } = useRoles()
  const updateRole = useUpdateMemberRole()
  const isCurrentUser = currentUser?.id === member.id
  const canEditRole = canManage && !isCurrentUser && !member.isOwner

  function handleRoleChange(newRoleId: string) {
    updateRole.mutate(
      { userId: member.id, roleId: newRoleId },
      {
        onSuccess: () => toast.success('Cargo atualizado'),
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

      {member.isOwner ? (
        <Badge className="text-xs bg-slate-950 text-white">Dono</Badge>
      ) : canEditRole ? (
        <Select
          value={member.roleId ?? ''}
          onValueChange={handleRoleChange}
          disabled={updateRole.isPending}
        >
          <SelectTrigger className="w-40 text-xs">
            <SelectValue>{member.roleName}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {roles.map((role) => (
              <SelectItem key={role.id} value={role.id}>
                {role.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <Badge className="text-xs bg-slate-100 text-slate-700">{member.roleName}</Badge>
      )}
    </div>
  )
}
