'use client'

import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { CurrencyInput } from '@/components/ui/currency-input'
import { Skeleton } from '@/components/ui/skeleton'
import { CustomerMessageToggle } from '@/components/domain/notifications/customer-message-toggle'
import { useUpdateAppointmentStatus } from '@/hooks/scheduling/use-appointments'
import type { Appointment } from '@/hooks/scheduling/use-appointments'
import type { SugestaoPreco } from '@/domains/crm/price-suggestion'
import type { CapilarBlock } from '@/domains/crm/anamnese-blocks.types'

type AnamneseData = {
  anamnese: {
    id: string
    blocks: { capilar?: CapilarBlock }
    blockTypes: string[]
    updatedAt: string
  }
  sugestaoPreco: SugestaoPreco | null
}

function formatCurrency(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
}

type Props = {
  appointment: Appointment
  open: boolean
  onClose: () => void
}

export function ConfirmAppointmentModal({ appointment, open, onClose }: Props) {
  const queryClient = useQueryClient()
  const updateStatus = useUpdateAppointmentStatus()

  const { data: anamneseData, isLoading: anamneseLoading } = useQuery<AnamneseData | null>({
    queryKey: ['appointment-anamnese', appointment.id],
    queryFn: async () => {
      const res = await fetch(`/api/scheduling/appointments/${appointment.id}/anamnese`)
      if (!res.ok) return null
      return res.json()
    },
    staleTime: 2 * 60 * 1000,
  })

  const [valorFinal, setValorFinal] = useState<string>(Number(appointment.price).toFixed(2))
  const [mensagem, setMensagem] = useState<string>('')
  const [notify, setNotify] = useState<boolean | undefined>(undefined)

  useEffect(() => {
    if (!open) return
    const price = anamneseData?.sugestaoPreco?.valorSugerido ?? Number(appointment.price)
    setValorFinal(price.toFixed(2))
    setMensagem('')
    setNotify(undefined)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const suggestedPrice = anamneseData?.sugestaoPreco?.valorSugerido ?? null

  // Vazio nao e zero: sem valor informado, o envio fica bloqueado.
  const valorPreenchido = valorFinal !== ''

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!valorPreenchido) return
    updateStatus.mutate(
      {
        id: appointment.id,
        status: 'CONFIRMED',
        notificationMessage: mensagem || undefined,
        confirmedPrice: Number(valorFinal),
        notify,
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ['appointment-anamnese', appointment.id] })
          toast.success('Agendamento confirmado')
          onClose()
        },
        onError: (err) => {
          toast.error(err instanceof Error ? err.message : 'Erro ao confirmar')
        },
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Confirmar agendamento</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm space-y-1">
            <p className="font-medium text-slate-900">{appointment.customer.name}</p>
            <p className="text-slate-500">
              {appointment.service?.name ?? appointment.package?.name ?? appointment.promotion?.name ?? 'Serviço'} · {appointment.professional?.name ?? '—'}
            </p>
            {anamneseLoading ? (
              <Skeleton className="h-20 w-full rounded-lg" />
            ) : anamneseData ? (
              suggestedPrice !== null && suggestedPrice !== Number(appointment.price) && (
                <p className="text-xs text-amber-700">
                  Sugestão da ficha: {formatCurrency(suggestedPrice)}
                </p>
              )
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="valor-final">Valor a cobrar (R$)</Label>
            <CurrencyInput
              id="valor-final"
              value={valorFinal}
              onChange={setValorFinal}
              required
            />
          </div>

          <CustomerMessageToggle
            event="appointment_confirmed"
            appointmentId={appointment.id}
            customerId={appointment.customerId}
            value={notify}
            onChange={setNotify}
            message={mensagem}
            onMessageChange={setMensagem}
          />

          <div className="flex gap-2 pt-1">
            <Button
              type="button"
              variant="ghost"
              className="flex-1"
              onClick={onClose}
              disabled={updateStatus.isPending}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-blue-600 text-white hover:bg-blue-700"
              disabled={updateStatus.isPending || !valorPreenchido}
            >
              {updateStatus.isPending ? 'Confirmando...' : 'Confirmar e enviar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
