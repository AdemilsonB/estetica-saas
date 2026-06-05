'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useUpdateAppointmentStatus } from '@/hooks/scheduling/use-appointments'
import type { Appointment } from '@/hooks/scheduling/use-appointments'

const CANCEL_TEMPLATE =
  'Olá, {nome}! Seu agendamento de {serviço} foi cancelado. Para reagendar, fale conosco. 😊'

function renderCancelTemplate(params: { nome: string; serviço: string }): string {
  return CANCEL_TEMPLATE
    .replace('{nome}', params.nome)
    .replace('{serviço}', params.serviço)
}

type Props = {
  appointment: Appointment | null
  open: boolean
  onClose: () => void
}

export function CancelAppointmentModal({ appointment, open, onClose }: Props) {
  const updateStatus = useUpdateAppointmentStatus()
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (appointment && open) {
      setMessage(
        renderCancelTemplate({
          nome: appointment.customer.name.split(' ')[0],
          serviço: appointment.service.name,
        }),
      )
    }
  }, [appointment, open])

  if (!appointment) return null

  function handleConfirm() {
    if (!appointment) return
    updateStatus.mutate(
      { id: appointment.id, status: 'CANCELLED', notificationMessage: message || undefined },
      {
        onSuccess: () => {
          toast.success('Agendamento cancelado')
          onClose()
        },
        onError: (err) => {
          toast.error(err instanceof Error ? err.message : 'Erro ao cancelar agendamento')
        },
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cancelar agendamento</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-sm font-semibold text-slate-950">
              {appointment.customer.name}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">{appointment.service.name}</p>
          </div>

          <div className="space-y-1.5">
            <Label>Mensagem enviada ao cliente via WhatsApp</Label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="min-h-[90px] resize-none text-sm"
            />
            {!appointment.customer.phone && (
              <p className="text-xs text-slate-400">
                Este cliente não tem telefone cadastrado. A mensagem não será enviada.
              </p>
            )}
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={onClose}
              disabled={updateStatus.isPending}
            >
              Voltar
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              onClick={handleConfirm}
              disabled={updateStatus.isPending}
            >
              {updateStatus.isPending ? 'Cancelando...' : 'Confirmar cancelamento'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
