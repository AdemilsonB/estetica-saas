// src/components/domain/crm/create-customer-modal.tsx
'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { ContactRound } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useCreateCustomer } from '@/hooks/crm/use-customers'
import { formatBrazilianPhone } from '@/shared/utils/phone'
import { PickContactModal } from './pick-contact-modal'

type Props = {
  open: boolean
  onClose: () => void
  onCreated?: (customer: { id: string; name: string }) => void
  /** false quando este modal é aberto empilhado sobre outro Dialog — evita o bug do Radix
   * em que dois Dialogs modais simultâneos deixam `aria-hidden` preso na tela ao fechar o de baixo. */
  modal?: boolean
}

export function CreateCustomerModal({ open, onClose, onCreated, modal = true }: Props) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [pickerOpen, setPickerOpen] = useState(false)
  // Desmarcado por padrão: a profissional marca quando o cliente autoriza. Cadastro
  // feito na recepção é o momento mais realista de perguntar.
  const [consentGiven, setConsentGiven] = useState(false)
  const createCustomer = useCreateCustomer()

  function handleClose() {
    setName('')
    setPhone('')
    setEmail('')
    setBirthDate('')
    setConsentGiven(false)
    onClose()
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return

    createCustomer.mutate(
      {
        name: name.trim(),
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        birthDate: birthDate || undefined,
        consentGiven,
      },
      {
        onSuccess: (customer) => {
          toast.success(`${customer.name} cadastrado com sucesso`)
          onCreated?.({ id: customer.id, name: customer.name })
          handleClose()
        },
        onError: (err) => {
          toast.error(err instanceof Error ? err.message : 'Erro ao cadastrar cliente')
        },
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()} modal={modal}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-sm" stacked={!modal}>
        <DialogHeader>
          <DialogTitle>Novo cliente</DialogTitle>
        </DialogHeader>

        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent py-2.5 text-sm font-medium text-accent-foreground transition hover:opacity-90"
        >
          <ContactRound className="size-4" />
          Importar contato (WhatsApp ou celular)
        </button>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>Nome *</Label>
            <Input
              placeholder="Nome completo"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Telefone</Label>
            <Input
              placeholder="(00) 00000-0000"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              type="tel"
            />
          </div>

          <div className="space-y-1.5">
            <Label>E-mail</Label>
            <Input
              placeholder="email@exemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="birthDate">Data de nascimento</Label>
            <Input
              id="birthDate"
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
            />
          </div>

          <div className="flex items-start justify-between gap-3 rounded-lg border p-3">
            <div className="space-y-0.5">
              <Label htmlFor="new-consent" className="text-sm font-medium">
                Receber promoções e novidades
              </Label>
              <p className="text-xs text-muted-foreground">
                Avisos sobre horários agendados são enviados de qualquer forma.
              </p>
            </div>
            <Switch
              id="new-consent"
              className="mt-0.5"
              checked={consentGiven}
              onCheckedChange={setConsentGiven}
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={handleClose}
              disabled={createCustomer.isPending}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
              disabled={!name.trim() || createCustomer.isPending}
            >
              {createCustomer.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </form>
      </DialogContent>

      <PickContactModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={(contact) => {
          setName(contact.name)
          setPhone(formatBrazilianPhone(contact.phone))
        }}
      />
    </Dialog>
  )
}
