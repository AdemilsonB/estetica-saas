// src/components/domain/financial/register-payment-modal.tsx
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
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useCreateTransaction } from '@/hooks/financial/use-transactions'
import type { Appointment } from '@/hooks/scheduling/use-appointments'

const PAYMENT_METHODS = [
  { value: 'PIX',              label: 'PIX' },
  { value: 'Cartão de débito', label: 'Cartão de débito' },
  { value: 'Cartão de crédito', label: 'Cartão de crédito' },
  { value: 'Dinheiro',         label: 'Dinheiro' },
  { value: 'Outro',            label: 'Outro' },
]

type Props = {
  appointment: Appointment | null
  open: boolean
  onClose: () => void
}

export function RegisterPaymentModal({ appointment, open, onClose }: Props) {
  const [paymentMethod, setPaymentMethod] = useState('')
  const createTransaction = useCreateTransaction()

  function handleClose() {
    setPaymentMethod('')
    onClose()
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!appointment || !paymentMethod) return

    createTransaction.mutate(
      {
        appointmentId: appointment.id,
        type: 'INCOME',
        category: 'service',
        description: `${appointment.service.name} - ${appointment.customer.name} (${paymentMethod})`,
        amount: Number(appointment.price),
        paidAt: new Date().toISOString(),
      },
      {
        onSuccess: () => {
          toast.success('Pagamento registrado com sucesso')
          handleClose()
        },
        onError: (err) => {
          toast.error(err instanceof Error ? err.message : 'Erro ao registrar pagamento')
        },
      },
    )
  }

  if (!appointment) return null

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Registrar pagamento</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Resumo do atendimento */}
          <div className="rounded-xl bg-slate-50 p-3 text-sm">
            <p className="font-semibold text-slate-950">{appointment.service.name}</p>
            <p className="text-slate-500">{appointment.customer.name}</p>
            <p className="mt-1 text-lg font-bold text-emerald-700">
              R${Number(appointment.price).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>Forma de pagamento *</Label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={handleClose}
              disabled={createTransaction.isPending}
            >
              Pular
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-emerald-600 text-white hover:bg-emerald-700"
              disabled={!paymentMethod || createTransaction.isPending}
            >
              {createTransaction.isPending ? 'Salvando...' : 'Confirmar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
