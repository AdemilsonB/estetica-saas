'use client'

import { useState } from 'react'
import { Pencil } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { EntityImage } from '@/components/domain/shared/entity-image'
import { type TeamMember } from '@/hooks/iam/use-team'
import { useCurrentUser } from '@/hooks/use-current-user'
import { useRoles } from '@/hooks/iam/use-roles'
import { useNavSections } from '@/hooks/iam/use-nav-sections'
import { describeRolePermissions } from '@/shared/permissions/describe-role-permissions'
import { EditMemberModal } from './edit-member-modal'

type Props = {
  member: TeamMember
  canManage: boolean
  onViewRolePermissions?: (roleId: string) => void
}

const MAX_SERVICES_VISIVEIS = 2

export function TeamMemberCard({ member, canManage, onViewRolePermissions }: Props) {
  const { data: currentUser } = useCurrentUser()
  const { data: roles = [] } = useRoles()
  const { data: sections = [] } = useNavSections()
  const [editOpen, setEditOpen] = useState(false)
  const [servicesExpanded, setServicesExpanded] = useState(false)

  const isCurrentUser = currentUser?.id === member.id
  const canEdit = canManage || isCurrentUser

  const initials = member.name.slice(0, 2).toUpperCase()

  const memberRole = roles.find((r) => r.id === member.roleId)
  const permissionSummary = member.isOwner
    ? 'Acesso total a todas as telas'
    : memberRole
      ? describeRolePermissions(memberRole.permissions, sections)
      : null

  const hiddenServicesCount = member.services.length - MAX_SERVICES_VISIVEIS
  const visibleServices = servicesExpanded ? member.services : member.services.slice(0, MAX_SERVICES_VISIVEIS)

  return (
    <>
      <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4">
        <div className="shrink-0">
          <EntityImage
            src={member.avatarUrl}
            alt={member.name}
            shape="circle"
            cropX={member.avatarCropX}
            cropY={member.avatarCropY}
            cropZoom={member.avatarCropZoom}
            className="size-10 border border-slate-200"
            fallback={<span className="text-sm font-semibold text-slate-700">{initials}</span>}
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-slate-950">{member.name}</p>
            {isCurrentUser && (
              <span className="text-xs text-slate-400">(você)</span>
            )}
          </div>
          <p className="text-xs text-slate-500">{member.email}</p>

          {permissionSummary && (
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <span className="text-xs text-slate-500">{permissionSummary}</span>
              {!member.isOwner && member.roleId && onViewRolePermissions && (
                <button
                  type="button"
                  onClick={() => onViewRolePermissions(member.roleId as string)}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  Ver permissões
                </button>
              )}
            </div>
          )}

          {member.services.length > 0 && (
            <div className="mt-1.5 flex flex-wrap items-center gap-1">
              {visibleServices.map((svc) => (
                <span
                  key={svc.id}
                  className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600"
                >
                  {svc.name}
                </span>
              ))}
              {!servicesExpanded && hiddenServicesCount > 0 && (
                <button
                  type="button"
                  onClick={() => setServicesExpanded(true)}
                  className="inline-flex items-center rounded-full bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-500 hover:bg-slate-100"
                >
                  +{hiddenServicesCount}
                </button>
              )}
              {servicesExpanded && member.services.length > MAX_SERVICES_VISIVEIS && (
                <button
                  type="button"
                  onClick={() => setServicesExpanded(false)}
                  className="inline-flex items-center rounded-full bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-500 hover:bg-slate-100"
                >
                  ver menos
                </button>
              )}
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
