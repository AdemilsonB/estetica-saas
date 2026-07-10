'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Plus, ChevronLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { RoleEditor } from './role-editor'
import { useInviteMember } from '@/hooks/iam/use-team'
import { useRoles, useCreateRole } from '@/hooks/iam/use-roles'
import { useNavSections } from '@/hooks/iam/use-nav-sections'
import { useCurrentUser } from '@/hooks/use-current-user'
import type { NavSection } from '@/shared/permissions/nav-registry'

type Props = {
  open: boolean
  onClose: () => void
}

export function InviteMemberModal({ open, onClose }: Props) {
  const [email, setEmail] = useState('')
  const [roleId, setRoleId] = useState('')
  const { data: currentUser } = useCurrentUser()
  const [creatingRole, setCreatingRole] = useState<'name' | 'permissions' | null>(null)
  const [newRoleName, setNewRoleName] = useState('')
  const [newRoleId, setNewRoleId] = useState<string | null>(null)
  const invite = useInviteMember()
  const { data: roles = [], isLoading: loadingRoles } = useRoles()
  const { data: sections = [] } = useNavSections()
  const createRole = useCreateRole()

  function handleClose() {
    setEmail('')
    setRoleId('')
    setCreatingRole(null)
    setNewRoleName('')
    setNewRoleId(null)
    onClose()
  }

  function handleCreateRoleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!newRoleName.trim()) return
    createRole.mutate(
      { name: newRoleName.trim(), permissions: {} },
      {
        onSuccess: (created) => {
          setNewRoleId(created.id)
          setCreatingRole('permissions')
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : 'Erro ao criar cargo'),
      },
    )
  }

  const newRole = roles.find((r) => r.id === newRoleId)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email || !roleId) return
    invite.mutate(
      { email: email.trim(), roleId },
      {
        onSuccess: () => {
          toast.success(`Convite enviado para ${email}`)
          handleClose()
        },
        onError: (err) => {
          toast.error(err instanceof Error ? err.message : 'Erro ao enviar convite')
        },
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent
        className={cn(
          'max-h-[90vh] overflow-y-auto',
          creatingRole === 'permissions' ? 'sm:max-w-xl' : 'sm:max-w-sm',
        )}
      >
        <DialogHeader>
          <DialogTitle>
            {creatingRole ? 'Novo cargo' : 'Convidar membro'}
          </DialogTitle>
        </DialogHeader>

        {creatingRole === 'permissions' && newRole ? (
          <div className="pt-2">
            <button
              type="button"
              onClick={() => {
                setRoleId(newRole.id)
                setCreatingRole(null)
                setNewRoleId(null)
              }}
              className="mb-4 flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"
            >
              <ChevronLeft className="size-4" />
              Voltar ao convite
            </button>
            <RoleEditor
              role={newRole}
              sections={sections as NavSection[]}
              onCancel={() => {
                setRoleId(newRole.id)
                setCreatingRole(null)
                setNewRoleId(null)
              }}
            />
          </div>
        ) : creatingRole === 'name' ? (
          <form onSubmit={handleCreateRoleSubmit} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>Nome do cargo *</Label>
              <Input
                value={newRoleName}
                onChange={(e) => setNewRoleName(e.target.value)}
                placeholder="Ex: Esteticista"
                maxLength={50}
                autoFocus
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => { setCreatingRole(null); setNewRoleName('') }}
                disabled={createRole.isPending}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
                disabled={!newRoleName.trim() || createRole.isPending}
              >
                {createRole.isPending ? 'Criando...' : 'Criar e definir permissões'}
              </Button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>E-mail *</Label>
              <Input
                type="email"
                placeholder="profissional@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label>Cargo *</Label>
              <div className="flex gap-2">
                <Select value={roleId} onValueChange={setRoleId} disabled={loadingRoles}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Selecione o cargo..." />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map((role) => (
                      <SelectItem key={role.id} value={role.id}>
                        {role.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {currentUser?.isOwner && (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    title="Criar novo cargo"
                    onClick={() => setCreatingRole('name')}
                  >
                    <Plus className="size-4" />
                  </Button>
                )}
              </div>
            </div>

            <p className="text-xs text-slate-500">
              Um e-mail de convite será enviado. O link expira em 7 dias.
            </p>

            <div className="flex gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={handleClose}
                disabled={invite.isPending}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
                disabled={!email || !roleId || invite.isPending}
              >
                {invite.isPending ? 'Enviando...' : 'Enviar convite'}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
