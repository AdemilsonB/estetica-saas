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
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
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

function buildDefaultMessage(appointment: Appointment, valorFinal: number): string {
  const data = new Date(appointment.startsAt)
  const dia = data.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
  })
  const hora = data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  return `Olá ${appointment.customer.name}! Seu agendamento de ${appointment.service.name} com ${appointment.professional.name} em ${dia} às ${hora} foi confirmado. Valor: ${formatCurrency(valorFinal)}. Aguardamos você!`
}

type Props = {
  appointment: Appointment
  open: boolean
  onClose: () => void
}

export function ConfirmAppointmentModal({ appointment, open, onClose }: Props) {
  const queryClient = useQueryClient()
  const updateStatus = useUpdateAppointmentStatus()

  const { data: anamneseData } = useQuery<AnamneseData | null>({
    queryKey: ['appointment-anamnese', appointment.id],
    queryFn: async () => {
      const res = await fetch(`/api/scheduling/appointments/${appointment.id}/anamnese`)
      if (!res.ok) return null
      return res.json()
    },
    staleTime: 2 * 60 * 1000,
  })

  const [valorFinal, setValorFinal] = useState<number>(Number(appointment.price))
  const [mensagem, setMensagem] = useState<string>('')

  useEffect(() => {
    if (!open) return
    const price = anamneseData?.sugestaoPreco?.valorSugerido ?? Number(appointment.price)
    setValorFinal(price)
    setMensagem(buildDefaultMessage(appointment, price))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const suggestedPrice = anamneseData?.sugestaoPreco?.valorSugerido ?? null

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    updateStatus.mutate(
      {
        id: appointment.id,
        status: 'CONFIRMED',
        notificationMessage: mensagem,
        confirmedPrice: valorFinal,
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Confirmar agendamento</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm space-y-1">
            <p className="font-medium text-slate-900">{appointment.customer.name}</p>
            <p className="text-slate-500">
              {appointment.service.name} · {appointment.professional.name}
            </p>
            {suggestedPrice !== null && suggestedPrice !== Number(appointment.price) && (
              <p className="text-xs text-amber-700">
                Sugestão da ficha: {formatCurrency(suggestedPrice)}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="valor-final">Valor a cobrar (R$)</Label>
            <Input
              id="valor-final"
              type="number"
              min={0}
              max={999999.99}
              step={0.01}
              value={valorFinal}
              onChange={(e) => {
                const novoValor = Number(e.target.value)
                setValorFinal(novoValor)
                setMensagem((prev) =>
                  prev.replace(/R\$\s*[\d.,]+/, formatCurrency(novoValor)),
                )
              }}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="mensagem-cliente">Mensagem para o cliente</Label>
            <Textarea
              id="mensagem-cliente"
              value={mensagem}
              onChange={(e) => setMensagem(e.target.value)}
              rows={4}
              className="resize-none text-sm"
            />
          </div>

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
              disabled={updateStatus.isPending}
            >
              {updateStatus.isPending ? 'Confirmando...' : 'Confirmar e enviar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
