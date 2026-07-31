'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { AlertTriangle } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { CustomerMessageToggle } from '@/components/domain/notifications/customer-message-toggle'
import { useUpdateAppointmentStatus } from '@/hooks/scheduling/use-appointments'
import type { Appointment } from '@/hooks/scheduling/use-appointments'

type Props = {
  appointment: Appointment | null
  open: boolean
  onClose: () => void
}

export function CancelAppointmentModal({ appointment, open, onClose }: Props) {
  const updateStatus = useUpdateAppointmentStatus()
  const [message, setMessage] = useState('')
  const [notify, setNotify] = useState<boolean | undefined>(undefined)

  useEffect(() => {
    if (open) {
      setMessage('')
      setNotify(undefined)
    }
  }, [open])

  if (!appointment) return null

  const isPaid = appointment.paymentStatus === 'PAID'

  function handleConfirm() {
    if (!appointment) return
    updateStatus.mutate(
      {
        id: appointment.id,
        status: 'CANCELLED',
        notificationMessage: message || undefined,
        notify,
      },
      {
        onSuccess: () => {
          toast.success('Agendamento desmarcado')
          onClose()
        },
        onError: (err) => {
          toast.error(err instanceof Error ? err.message : 'Erro ao desmarcar agendamento')
        },
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Desmarcar agendamento</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-sm font-semibold text-slate-950">
              {appointment.customer.name}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">{appointment.service?.name ?? appointment.package?.name ?? appointment.promotion?.name ?? 'Serviço'}</p>
          </div>

          {isPaid && (
            <div className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
              <AlertTriangle className="size-4 shrink-0 mt-0.5" />
              <p>
                Este atendimento já foi pago. O cancelamento <strong>não estorna o valor automaticamente</strong> —
                trate o estorno manualmente no financeiro.
              </p>
            </div>
          )}

          <CustomerMessageToggle
            event="appointment_cancelled"
            appointmentId={appointment.id}
            customerId={appointment.customerId}
            value={notify}
            onChange={setNotify}
            message={message}
            onMessageChange={setMessage}
          />

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
              {updateStatus.isPending ? 'Desmarcando...' : 'Confirmar desmarcação'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
