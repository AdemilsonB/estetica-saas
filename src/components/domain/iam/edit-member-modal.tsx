'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { AvatarUpload } from './avatar-upload'
import { MemberServicesSelector } from './member-services-selector'
import { useUpdateMemberProfile, useUpdateMemberRole, type TeamMember } from '@/hooks/iam/use-team'
import { useGetMemberServices, useSetMemberServices, type MemberService } from '@/hooks/iam/use-member-services'
import { useRoles } from '@/hooks/iam/use-roles'

const EMPTY_SERVICES: MemberService[] = []

type Props = {
  member: TeamMember | null
  open: boolean
  onClose: () => void
}

export function EditMemberModal({ member, open, onClose }: Props) {
  const { data: roles = [] } = useRoles()
  const { data: memberServices = EMPTY_SERVICES, isLoading: loadingServices } = useGetMemberServices(
    member?.id ?? null,
  )

  const updateProfile = useUpdateMemberProfile()
  const updateRole = useUpdateMemberRole()
  const setServices = useSetMemberServices()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [bio, setBio] = useState('')
  const [roleId, setRoleId] = useState('')
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([])
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)

  useEffect(() => {
    if (member) {
      setName(member.name)
      setEmail(member.email)
      setBio(member.bio ?? '')
      setRoleId(member.roleId ?? '')
      setAvatarUrl(member.avatarUrl)
    }
  }, [member])

  useEffect(() => {
    setSelectedServiceIds(memberServices.map((s) => s.id))
  }, [memberServices])

  function handleClose() {
    onClose()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!member) return

    const promises: Promise<unknown>[] = []

    if (name !== member.name || email !== member.email || bio !== (member.bio ?? '')) {
      promises.push(
        updateProfile.mutateAsync({ userId: member.id, name, email, bio: bio || null }).catch((err) => {
          throw new Error(`Perfil: ${err instanceof Error ? err.message : 'Erro'}`)
        }),
      )
    }

    if (roleId && roleId !== member.roleId) {
      promises.push(
        updateRole.mutateAsync({ userId: member.id, roleId }).catch((err) => {
          throw new Error(`Cargo: ${err instanceof Error ? err.message : 'Erro'}`)
        }),
      )
    }

    const currentIds = memberServices.map((s) => s.id).sort().join(',')
    const newIds = [...selectedServiceIds].sort().join(',')
    if (currentIds !== newIds) {
      promises.push(
        setServices.mutateAsync({ userId: member.id, serviceIds: selectedServiceIds }).catch((err) => {
          throw new Error(`Serviços: ${err instanceof Error ? err.message : 'Erro'}`)
        }),
      )
    }

    if (promises.length === 0) {
      handleClose()
      return
    }

    try {
      await Promise.all(promises)
      toast.success('Membro atualizado com sucesso')
      handleClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar alterações')
    }
  }

  const isPending = updateProfile.isPending || updateRole.isPending || setServices.isPending
  const isOwnerTarget = member?.isOwner

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar membro</DialogTitle>
        </DialogHeader>

        {member && (
          <form onSubmit={handleSubmit} className="space-y-5 pt-1">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-slate-600">Foto</Label>
              <AvatarUpload
                userId={member.id}
                currentAvatarUrl={avatarUrl}
                cropX={member.avatarCropX}
                cropY={member.avatarCropY}
                cropZoom={member.avatarCropZoom}
                name={name}
                onUploaded={(url) => setAvatarUrl(url)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-name">Nome *</Label>
              <Input
                id="edit-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={120}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-email">E-mail *</Label>
              <Input
                id="edit-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-bio">
                Sobre mim{' '}
                <span className="text-xs font-normal text-muted-foreground">(opcional)</span>
              </Label>
              <Textarea
                id="edit-bio"
                placeholder="Uma breve descrição sobre você..."
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                maxLength={280}
                rows={3}
              />
              <p className="text-xs text-slate-400 text-right">{bio.length}/280</p>
            </div>

            {!isOwnerTarget && (
              <div className="space-y-1.5">
                <Label>Cargo</Label>
                <Select value={roleId} onValueChange={setRoleId}>
                  <SelectTrigger>
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
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Serviços que realiza</Label>
              {loadingServices ? (
                <p className="text-sm text-slate-400">Carregando serviços...</p>
              ) : (
                <MemberServicesSelector
                  selectedIds={selectedServiceIds}
                  onChange={setSelectedServiceIds}
                />
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={handleClose}
                disabled={isPending}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
                disabled={isPending || !name || !email}
              >
                {isPending ? 'Salvando...' : 'Salvar alterações'}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
