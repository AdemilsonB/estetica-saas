// src/components/domain/scheduling/appointment-card.tsx
import { Pencil } from 'lucide-react'
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
  onConfirm?: (appointment: Appointment) => void
  onPay?: (appointment: Appointment) => void
}

export function AppointmentCard({ appointment, onClick, onReschedule, onConfirm, onPay }: Props) {
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
          className="absolute right-3 bottom-3 rounded-full p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
        >
          <Pencil className="size-4" />
        </button>
      )}

      {/* Quick actions — visíveis apenas em mobile (sm:hidden) */}
      {(onConfirm || onPay) && (
        <div className="mt-3 flex gap-2 sm:hidden border-t border-slate-100 pt-3">
          {onConfirm && appointment.status === 'SCHEDULED' && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onConfirm(appointment)
              }}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-blue-50 px-3 py-2 text-xs font-medium text-blue-700 hover:bg-blue-100 transition min-h-11"
            >
              <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Confirmar
            </button>
          )}
          {onPay && (appointment.status === 'CONFIRMED' || appointment.status === 'SCHEDULED') && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onPay(appointment)
              }}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700 hover:bg-emerald-100 transition min-h-11"
            >
              <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Fechar pagamento
            </button>
          )}
        </div>
      )}
    </div>
  )
}
