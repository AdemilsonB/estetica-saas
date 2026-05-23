// src/components/domain/iam/invite-member-modal.tsx
'use client'

import { useState } from 'react'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useInviteMember, type UserRole } from '@/hooks/iam/use-team'

type Props = {
  open: boolean
  onClose: () => void
}

export function InviteMemberModal({ open, onClose }: Props) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<Exclude<UserRole, 'OWNER'> | ''>('')
  const invite = useInviteMember()

  function handleClose() {
    setEmail('')
    setRole('')
    onClose()
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email || !role) return

    invite.mutate(
      { email: email.trim(), role: role as Exclude<UserRole, 'OWNER'> },
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
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Convidar membro</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>E-mail *</Label>
            <Input
              type="email"
              placeholder="profissional@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label>Papel *</Label>
            <Select
              value={role}
              onValueChange={(v) => setRole(v as Exclude<UserRole, 'OWNER'>)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o papel..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MANAGER">Gerente</SelectItem>
                <SelectItem value="PROFESSIONAL">Profissional</SelectItem>
                <SelectItem value="RECEPTIONIST">Recepcionista</SelectItem>
              </SelectContent>
            </Select>
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
              className="flex-1 bg-slate-950 text-white hover:bg-slate-800"
              disabled={!email || !role || invite.isPending}
            >
              {invite.isPending ? 'Enviando...' : 'Enviar convite'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
