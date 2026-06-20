'use client'

import { useState } from 'react'
import { Pencil } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { type TeamMember } from '@/hooks/iam/use-team'
import { useCurrentUser } from '@/hooks/use-current-user'
import { EditMemberModal } from './edit-member-modal'

type Props = {
  member: TeamMember
  canManage: boolean
}

export function TeamMemberCard({ member, canManage }: Props) {
  const { data: currentUser } = useCurrentUser()
  const [editOpen, setEditOpen] = useState(false)

  const isCurrentUser = currentUser?.id === member.id
  const canEdit = canManage || isCurrentUser

  const initials = member.name.slice(0, 2).toUpperCase()

  return (
    <>
      <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4">
        <div className="shrink-0">
          {member.avatarUrl ? (
            <img
              src={member.avatarUrl}
              alt={member.name}
              className="size-10 rounded-full object-cover border border-slate-200"
            />
          ) : (
            <div className="flex size-10 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-700">
              {initials}
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-slate-950">{member.name}</p>
            {isCurrentUser && (
              <span className="text-xs text-slate-400">(você)</span>
            )}
          </div>
          <p className="text-xs text-slate-500">{member.email}</p>

          {member.services.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {member.services.map((svc) => (
                <span
                  key={svc.id}
                  className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600"
                >
                  {svc.name}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {member.isOwner ? (
            <Badge className="text-xs bg-slate-950 text-white">Dono</Badge>
          ) : (
            <Badge className="text-xs bg-slate-100 text-slate-700">{member.roleName}</Badge>
          )}

          {canEdit && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 text-slate-400 hover:text-slate-700"
                  onClick={() => setEditOpen(true)}
                  aria-label="Editar membro"
                >
                  <Pencil className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Editar membro</TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>

      <EditMemberModal
        member={editOpen ? member : null}
        open={editOpen}
        onClose={() => setEditOpen(false)}
      />
    </>
  )
}
