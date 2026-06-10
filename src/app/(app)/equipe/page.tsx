// src/app/(app)/equipe/page.tsx
'use client'

import { useState } from 'react'
import { Settings2, UserPlus, Users, Mail, X, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { toast } from 'sonner'
import { TeamMemberCard } from '@/components/domain/iam/team-member-card'
import { InviteMemberModal } from '@/components/domain/iam/invite-member-modal'
import { RolesManager } from '@/components/domain/iam/roles-manager'
import { useTeamMembers, useTeamInvites, useCancelInvite, type UserRole } from '@/hooks/iam/use-team'
import { usePermissions } from '@/hooks/use-permissions'

const ROLE_LABELS: Record<UserRole, string> = {
  OWNER: 'Dono',
  MANAGER: 'Gerente',
  PROFESSIONAL: 'Profissional',
  RECEPTIONIST: 'Recepcionista',
}

export default function EquipePage() {
  const [inviteOpen, setInviteOpen] = useState(false)
  const [rolesOpen, setRolesOpen] = useState(false)
  const { can, user } = usePermissions()
  const {
    data: members,
    isLoading: loadingMembers,
    isError: errorMembers,
    refetch: refetchMembers,
  } = useTeamMembers()
  const { data: invites, isLoading: loadingInvites } = useTeamInvites()

  const canManage = can('equipe', 'edit')
  const canInvite = can('equipe', 'create')

  const [cancelingInviteId, setCancelingInviteId] = useState<string | null>(null)
  const cancelMutation = useCancelInvite()

  function handleConfirmCancel() {
    if (!cancelingInviteId) return
    cancelMutation.mutate(cancelingInviteId, {
      onSuccess: () => {
        toast.success('Convite cancelado')
        setCancelingInviteId(null)
      },
      onError: (err) => {
        toast.error(err.message)
        setCancelingInviteId(null)
      },
    })
  }

  const cancelingInvite = invites?.find((i) => i.id === cancelingInviteId)

  if (!can('equipe', 'view')) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
          <p className="text-sm font-medium text-red-700">
            Apenas donos e gerentes podem acessar a gestão de equipe.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
            Equipe
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Gerencie os membros e convites do seu negócio
          </p>
        </div>
        <div className="flex w-full gap-2 sm:w-auto sm:justify-end">
          {user?.isOwner && (
            <Button
              variant="outline"
              onClick={() => setRolesOpen(true)}
              className="flex-1 rounded-full sm:flex-none"
            >
              <Settings2 className="size-4" />
              Cargos
            </Button>
          )}
          {canInvite && (
            <Button
              onClick={() => setInviteOpen(true)}
              className="flex-1 rounded-full bg-slate-950 text-white hover:bg-slate-800 sm:flex-none"
            >
              <UserPlus className="size-4" />
              Convidar
            </Button>
          )}
        </div>
      </div>

      {/* Membros ativos */}
      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
          Membros ativos
        </h2>

        {loadingMembers ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-2xl" />
            ))}
          </div>
        ) : errorMembers ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
            <p className="text-sm text-red-600">Erro ao carregar equipe.</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => refetchMembers()}>
              Tentar novamente
            </Button>
          </div>
        ) : !members || members.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white/60 py-12 text-center">
            <Users className="size-8 text-slate-300" />
            <p className="mt-3 text-sm text-slate-500">Nenhum membro ainda</p>
          </div>
        ) : (
          <div className="space-y-3">
            {members.map((member) => (
              <TeamMemberCard
                key={member.id}
                member={member}
                canManage={canManage}
              />
            ))}
          </div>
        )}
      </div>

      {/* Convites pendentes */}
      {!loadingInvites && invites && invites.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
            Convites pendentes
          </h2>
          <div className="space-y-3">
            {invites.map((invite) => (
              <div
                key={invite.id}
                className="flex items-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-4"
              >
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-slate-200">
                  <Mail className="size-4 text-slate-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-700">
                    {invite.email}
                  </p>
                  <p className="text-xs text-slate-400">
                    Expira em{' '}
                    {new Date(invite.expiresAt).toLocaleDateString('pt-BR')}
                  </p>
                </div>
                <Badge className="shrink-0 bg-amber-100 text-amber-700 text-xs">
                  {ROLE_LABELS[invite.role]}
                </Badge>
                {user?.isOwner && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0 size-8 text-slate-400 hover:text-red-600 hover:bg-red-50"
                    disabled={cancelMutation.isPending && cancelingInviteId === invite.id}
                    onClick={() => setCancelingInviteId(invite.id)}
                    aria-label="Cancelar convite"
                  >
                    {cancelMutation.isPending && cancelingInviteId === invite.id ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <X className="size-4" />
                    )}
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AlertDialog de confirmação */}
      <AlertDialog
        open={cancelingInviteId !== null && !cancelMutation.isPending}
        onOpenChange={(open) => { if (!open) setCancelingInviteId(null) }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar convite</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja cancelar o convite enviado para{' '}
              <span className="font-medium text-slate-900">{cancelingInvite?.email}</span>?
              {' '}O link do email deixará de funcionar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Manter convite</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={handleConfirmCancel}
            >
              Cancelar convite
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={rolesOpen} onOpenChange={setRolesOpen}>
        <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-5xl">
          <DialogHeader className="pr-8">
            <DialogTitle>Cargos e permissões</DialogTitle>
            <DialogDescription>
              Defina o que cada cargo pode ver e fazer no sistema.
            </DialogDescription>
          </DialogHeader>
          <RolesManager />
        </DialogContent>
      </Dialog>

      <InviteMemberModal open={inviteOpen} onClose={() => setInviteOpen(false)} />
    </div>
  )
}
