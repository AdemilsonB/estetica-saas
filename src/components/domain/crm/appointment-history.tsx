// src/components/domain/crm/appointment-history.tsx
'use client'

import { CalendarDays } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { CustomerAppointment } from '@/hooks/crm/use-customer'

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  SCHEDULED:  { label: 'Agendado',       className: 'bg-slate-100 text-slate-700' },
  CONFIRMED:  { label: 'Confirmado',     className: 'bg-blue-100 text-blue-700' },
  COMPLETED:  { label: 'Concluído',      className: 'bg-emerald-100 text-emerald-700' },
  CANCELLED:  { label: 'Cancelado',      className: 'bg-red-100 text-red-700' },
  NO_SHOW:    { label: 'Não compareceu', className: 'bg-orange-100 text-orange-700' },
}

type Props = {
  appointments: CustomerAppointment[]
}

export function AppointmentHistory({ appointments }: Props) {
  if (appointments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white/60 py-12 text-center">
        <CalendarDays className="size-8 text-slate-300" />
        <p className="mt-3 text-sm text-slate-500">Nenhum atendimento registrado</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {appointments.map((appt) => {
        const config = STATUS_CONFIG[appt.status] ?? STATUS_CONFIG.SCHEDULED
        return (
          <div
            key={appt.id}
            className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-950">
                {appt.service.name}
              </p>
              <p className="text-xs text-slate-500">
                {new Date(appt.startsAt).toLocaleString('pt-BR', {
                  weekday: 'short',
                  day: '2-digit',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
                {' · '}
                {appt.professional.name}
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <Badge className={cn('text-xs', config.className)}>
                {config.label}
              </Badge>
              <span className="text-xs font-medium text-slate-700">
                R${Number(appt.price).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
