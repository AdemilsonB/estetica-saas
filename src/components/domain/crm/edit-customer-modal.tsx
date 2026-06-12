// src/components/domain/crm/edit-customer-modal.tsx
'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useUpdateCustomer } from '@/hooks/crm/use-customers'

type Customer = {
  id: string
  name: string
  phone: string | null
  email: string | null
  birthDate: string | null
  notes: string | null
}

type Props = {
  open: boolean
  onClose: () => void
  customer: Customer
}

export function EditCustomerModal({ open, onClose, customer }: Props) {
  const { mutate: update, isPending } = useUpdateCustomer()

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    if (open && customer) {
      setName(customer.name)
      setPhone(customer.phone ?? '')
      setEmail(customer.email ?? '')
      // birthDate pode vir como ISO string (ex: "1990-03-15T00:00:00.000Z") ou YYYY-MM-DD
      setBirthDate(customer.birthDate ? customer.birthDate.substring(0, 10) : '')
      setNotes(customer.notes ?? '')
    }
  }, [open, customer])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    update(
      {
        id: customer.id,
        input: {
          name: name.trim() || undefined,
          phone: phone.trim() || undefined,
          email: email.trim() || undefined,
          birthDate: birthDate || undefined,
          notes: notes.trim() || undefined,
        },
      },
      {
        onSuccess: () => {
          toast.success('Dados atualizados com sucesso')
          onClose()
        },
        onError: (err) => {
          toast.error(err instanceof Error ? err.message : 'Erro ao atualizar dados')
        },
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar dados do cliente</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="edit-name">
              Nome <span className="text-rose-500">*</span>
            </Label>
            <Input
              id="edit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-phone">Telefone</Label>
            <Input
              id="edit-phone"
              type="tel"
              placeholder="(00) 00000-0000"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-email">E-mail</Label>
            <Input
              id="edit-email"
              type="email"
              placeholder="email@exemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-birthdate">Data de nascimento</Label>
            <Input
              id="edit-birthdate"
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-notes">Observações</Label>
            <Input
              id="edit-notes"
              placeholder="Alergias, preferências..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isPending}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={!name.trim() || isPending}
              className="flex-1 bg-slate-950 text-white hover:bg-slate-800"
            >
              {isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
