'use client'

import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'
import { usePendingCompletionAppointments } from '@/hooks/scheduling/use-appointments'
import { usePermissions } from '@/hooks/use-permissions'

function formatWhen(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

/**
 * Só aparece quando há pendência — atendimento vencido (SCHEDULED/CONFIRMED
 * com endsAt já passado além da tolerância de `SchedulingPolicy`) que ninguém
 * concluiu, cancelou ou marcou falta.
 */
export function PendingCompletionCard() {
  const { can } = usePermissions()
  const canViewAgenda = can('agenda', 'view')
  const { data: appointments, isLoading } = usePendingCompletionAppointments()

  if (!canViewAgenda || isLoading || !appointments || appointments.length === 0) {
    return null
  }

  const preview = appointments.slice(0, 3)
  const remaining = appointments.length - preview.length

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 sm:p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-600" />
        <div className="min-w-0 flex-1 space-y-2">
          <div>
            <h3 className="font-semibold text-amber-900">
              {appointments.length === 1
                ? '1 atendimento sem conclusão'
                : `${appointments.length} atendimentos sem conclusão`}
            </h3>
            <p className="text-sm text-amber-800">
              Passaram do horário e continuam agendados. Confirme, registre falta ou conclua
              para não perder no faturamento.
            </p>
          </div>
          <ul className="space-y-1">
            {preview.map((a) => (
              <li key={a.id} className="truncate text-sm text-amber-900">
                <span className="font-medium">{a.customer.name}</span>
                {' · '}
                {a.service?.name ?? a.package?.name ?? a.promotion?.name ?? 'Serviço'}
                {' · '}
                {formatWhen(a.startsAt)}
              </li>
            ))}
          </ul>
          {remaining > 0 && (
            <p className="text-xs text-amber-700">+{remaining} outro(s)</p>
          )}
          <Link
            href="/agenda"
            className="inline-block text-sm font-medium text-amber-900 underline underline-offset-2 hover:text-amber-950"
          >
            Ver e concluir →
          </Link>
        </div>
      </div>
    </div>
  )
}
