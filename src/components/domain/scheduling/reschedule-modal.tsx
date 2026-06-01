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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { useAvailableSlots } from '@/hooks/scheduling/use-availability'
import { useTeamMembers } from '@/hooks/iam/use-team'
import { useRescheduleAppointment } from '@/hooks/scheduling/use-appointments'
import type { Appointment } from '@/hooks/scheduling/use-appointments'

const RESCHEDULE_TEMPLATE =
  'Olá, {nome}! Seu agendamento de {serviço} foi remarcado para {data} às {hora} com {profissional}. Qualquer dúvida, estamos à disposição. Te esperamos! 🤍'

function formatDateLabel(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  })
}

function formatHour(time: string): string {
  return time.replace(':', 'h')
}

function renderTemplate(params: {
  nome: string
  serviço: string
  data: string
  hora: string
  profissional: string
}): string {
  return RESCHEDULE_TEMPLATE.replace('{nome}', params.nome)
    .replace('{serviço}', params.serviço)
    .replace('{data}', params.data)
    .replace('{hora}', params.hora)
    .replace('{profissional}', params.profissional)
}

function toDateInput(d: Date): string {
  return d.toISOString().slice(0, 10)
}

type Props = {
  appointment: Appointment | null
  open: boolean
  onClose: () => void
}

export function RescheduleModal({ appointment, open, onClose }: Props) {
  const { data: teamMembers = [] } = useTeamMembers()
  const reschedule = useRescheduleAppointment()

  const [professionalId, setProfessionalId] = useState('')
  const [date, setDate] = useState('')
  const [selectedTime, setSelectedTime] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (appointment && open) {
      setProfessionalId(appointment.professionalId)
      setDate(toDateInput(new Date(appointment.startsAt)))
      setSelectedTime('')
      setMessage('')
    }
  }, [appointment, open])

  const { data: slots = [], isLoading: loadingSlots } = useAvailableSlots(
    professionalId || null,
    date || null,
    appointment?.serviceId ?? null,
  )

  const professionalName =
    teamMembers.find((m) => m.id === professionalId)?.name ??
    appointment?.professional.name ??
    ''

  useEffect(() => {
    if (!appointment || !selectedTime || !date) return
    setMessage(
      renderTemplate({
        nome: appointment.customer.name.split(' ')[0],
        serviço: appointment.service.name,
        data: formatDateLabel(date),
        hora: formatHour(selectedTime),
        profissional: professionalName,
      }),
    )
  }, [selectedTime, date, professionalName, appointment])

  if (!appointment) return null

  const selectedSlot = slots.find((s) => s.time === selectedTime)
  const serviceDuration = appointment.service.duration
  const canConfirm = selectedTime && selectedSlot?.available

  function handleConfirm() {
    if (!canConfirm || !appointment) return

    const newStartsAt = new Date(`${date}T${selectedTime}:00`)
    const newEndsAt = new Date(newStartsAt.getTime() + serviceDuration * 60 * 1000)

    reschedule.mutate(
      {
        id: appointment.id,
        startsAt: newStartsAt.toISOString(),
        endsAt: newEndsAt.toISOString(),
        professionalId,
        notificationMessage: message,
      },
      {
        onSuccess: () => {
          toast.success('Agendamento remarcado com sucesso')
          onClose()
        },
        onError: (err) => {
          toast.error(err instanceof Error ? err.message : 'Erro ao remarcar')
        },
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Remarcar agendamento</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          {/* Info somente leitura */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-sm font-semibold text-slate-950">
              {appointment.customer.name}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">{appointment.service.name}</p>
          </div>

          {/* Profissional */}
          <div className="space-y-1.5">
            <Label>Profissional</Label>
            <Select value={professionalId} onValueChange={setProfessionalId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um profissional" />
              </SelectTrigger>
              <SelectContent>
                {teamMembers.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Data */}
          <div className="space-y-1.5">
            <Label>Nova data</Label>
            <input
              type="date"
              value={date}
              onChange={(e) => {
                setDate(e.target.value)
                setSelectedTime('')
              }}
              min={toDateInput(new Date())}
              className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-950"
            />
          </div>

          {/* Horários */}
          <div className="space-y-1.5">
            <Label>Horário</Label>
            {loadingSlots ? (
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-8 w-16 rounded-full" />
                ))}
              </div>
            ) : slots.length === 0 ? (
              <p className="text-sm text-slate-400">Nenhum horário disponível nesta data.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {slots.map((slot) => (
                  <button
                    key={slot.time}
                    disabled={!slot.available}
                    onClick={() => setSelectedTime(slot.time)}
                    className={cn(
                      'rounded-full border px-3 py-1.5 text-xs font-medium transition',
                      slot.available
                        ? selectedTime === slot.time
                          ? 'border-slate-950 bg-slate-950 text-white'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400'
                        : 'cursor-not-allowed border-slate-100 bg-slate-50 text-slate-300',
                    )}
                  >
                    {formatHour(slot.time)}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Mensagem */}
          <div className="space-y-1.5">
            <Label>Mensagem enviada ao cliente via WhatsApp</Label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Selecione um horário para pré-preencher a mensagem..."
              className="min-h-[100px] resize-none text-sm"
            />
            {!appointment.customer.phone && (
              <p className="text-xs text-slate-400">
                Este cliente não tem telefone cadastrado. A mensagem não será enviada.
              </p>
            )}
          </div>

          {/* Botões */}
          <div className="flex gap-2 pt-1">
            <Button
              variant="outline"
              className="flex-1"
              onClick={onClose}
              disabled={reschedule.isPending}
            >
              Cancelar
            </Button>
            <Button
              className="flex-1 bg-slate-950 text-white hover:bg-slate-800"
              onClick={handleConfirm}
              disabled={!canConfirm || reschedule.isPending}
            >
              {reschedule.isPending ? 'Remarcando...' : 'Confirmar remarcação'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
