// src/components/domain/scheduling/appointment-card.tsx
import { CalendarDays } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import type { Appointment, AppointmentStatus } from '@/hooks/scheduling/use-appointments'

const STATUS_CONFIG: Record<
  AppointmentStatus,
  { label: string; cardClass: string; badgeClass: string }
> = {
  SCHEDULED: {
    label: 'Agendado',
    cardClass: 'border-slate-200 bg-white',
    badgeClass: 'bg-slate-100 text-slate-700',
  },
  CONFIRMED: {
    label: 'Confirmado',
    cardClass: 'border-blue-200 bg-blue-50',
    badgeClass: 'bg-blue-100 text-blue-700',
  },
  COMPLETED: {
    label: 'Concluído',
    cardClass: 'border-emerald-200 bg-emerald-50',
    badgeClass: 'bg-emerald-100 text-emerald-700',
  },
  CANCELLED: {
    label: 'Cancelado',
    cardClass: 'border-red-200 bg-red-50 opacity-60',
    badgeClass: 'bg-red-100 text-red-700',
  },
  NO_SHOW: {
    label: 'Não compareceu',
    cardClass: 'border-orange-200 bg-orange-50 opacity-60',
    badgeClass: 'bg-orange-100 text-orange-700',
  },
}

const RESCHEDULABLE_STATUSES: AppointmentStatus[] = ['SCHEDULED', 'CONFIRMED']

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

type Props = {
  appointment: Appointment
  onClick: (appointment: Appointment) => void
  onReschedule?: (appointment: Appointment) => void
}

export function AppointmentCard({ appointment, onClick, onReschedule }: Props) {
  const config = STATUS_CONFIG[appointment.status]
  const canReschedule = RESCHEDULABLE_STATUSES.includes(appointment.status)

  return (
    <div className={cn('relative w-full rounded-2xl border p-4 transition hover:-translate-y-0.5 hover:shadow-md', config.cardClass)}>
      <button
        onClick={() => onClick(appointment)}
        className="w-full text-left"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 pr-6">
            <p className="truncate text-sm font-semibold text-slate-950">
              {appointment.customer.name}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              {appointment.service.name} · {appointment.professional.name}
            </p>
          </div>
          <Badge className={cn('shrink-0 text-xs', config.badgeClass)}>
            {config.label}
          </Badge>
        </div>
        <p className="mt-3 text-xs font-medium text-slate-600">
          {formatTime(appointment.startsAt)} – {formatTime(appointment.endsAt)}
        </p>
      </button>

      {canReschedule && onReschedule && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onReschedule(appointment)
          }}
          title="Remarcar"
          className="absolute right-3 top-3 rounded-full p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
        >
          <CalendarDays className="size-4" />
        </button>
      )}
    </div>
  )
}
