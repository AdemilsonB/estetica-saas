// src/components/domain/scheduling/appointment-drawer.tsx
'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { StickyNote } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { useUpdateAppointmentStatus } from '@/hooks/scheduling/use-appointments'
import type { Appointment } from '@/hooks/scheduling/use-appointments'
import { cn } from '@/lib/utils'
import { CancelAppointmentModal } from './cancel-appointment-modal'
import { AppointmentProductsSection } from '@/components/domain/inventory/AppointmentProductsSection'

const STATUS_LABELS: Record<string, string> = {
  SCHEDULED: 'Agendado',
  CONFIRMED: 'Confirmado',
  COMPLETED: 'Concluído',
  CANCELLED: 'Cancelado',
  NO_SHOW: 'Não compareceu',
}

const STATUS_BADGE: Record<string, string> = {
  SCHEDULED: 'bg-slate-100 text-slate-700',
  CONFIRMED: 'bg-blue-100 text-blue-700',
  COMPLETED: 'bg-emerald-100 text-emerald-700',
  CANCELLED: 'bg-red-100 text-red-700',
  NO_SHOW: 'bg-orange-100 text-orange-700',
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

type Props = {
  appointment: Appointment | null
  open: boolean
  onClose: () => void
  onCompleted?: (appointment: Appointment) => void
}

export function AppointmentDrawer({ appointment, open, onClose, onCompleted }: Props) {
  const updateStatus = useUpdateAppointmentStatus()
  const [cancelModalOpen, setCancelModalOpen] = useState(false)

  function handleStatus(status: 'CONFIRMED' | 'COMPLETED' | 'NO_SHOW') {
    if (!appointment) return
    updateStatus.mutate(
      { id: appointment.id, status },
      {
        onSuccess: (updated) => {
          const labels: Record<string, string> = {
            CONFIRMED: 'Agendamento confirmado',
            COMPLETED: 'Atendimento concluído',
            NO_SHOW: 'No-show registrado',
          }
          toast.success(labels[status])
          if (status === 'COMPLETED') onCompleted?.(updated)
          onClose()
        },
        onError: (err) => {
          toast.error(err instanceof Error ? err.message : 'Erro ao atualizar status')
        },
      },
    )
  }

  if (!appointment) return null

  const isActive = !['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(appointment.status)

  return (
    <>
      <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
        <SheetContent className="w-full sm:max-w-md flex flex-col">
          <SheetHeader>
            <SheetTitle>Detalhes do agendamento</SheetTitle>
          </SheetHeader>

          <div className="mt-6 space-y-6 overflow-y-auto flex-1 pb-6 pr-1">
            <div className="flex items-center gap-3">
              <Badge className={cn('text-sm', STATUS_BADGE[appointment.status])}>
                {STATUS_LABELS[appointment.status]}
              </Badge>
            </div>

            <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div>
                <p className="text-xs font-medium text-slate-400 uppercase">Cliente</p>
                <p className="mt-0.5 text-sm font-semibold text-slate-950">
                  {appointment.customer.name}
                </p>
                {appointment.customer.phone && (
                  <p className="text-xs text-slate-500">{appointment.customer.phone}</p>
                )}
              </div>
              <Separator />
              <div>
                <p className="text-xs font-medium text-slate-400 uppercase">Serviço</p>
                <p className="mt-0.5 text-sm font-semibold text-slate-950">
                  {appointment.service.name}
                </p>
                <p className="text-xs text-slate-500">
                  {appointment.service.duration} min · R${Number(appointment.price).toFixed(2)}
                </p>
              </div>
              <Separator />
              <div>
                <p className="text-xs font-medium text-slate-400 uppercase">Profissional</p>
                <p className="mt-0.5 text-sm font-semibold text-slate-950">
                  {appointment.professional.name}
                </p>
              </div>
              <Separator />
              <div>
                <p className="text-xs font-medium text-slate-400 uppercase">Horário</p>
                <p className="mt-0.5 text-sm font-semibold text-slate-950">
                  {formatDateTime(appointment.startsAt)}
                </p>
              </div>
              {appointment.customer.notes && (
                <>
                  <Separator />
                  <div>
                    <p className="text-xs font-medium text-slate-400 uppercase">
                      Observações do cliente
                    </p>
                    <div className="mt-1.5 flex items-start gap-1.5">
                      <StickyNote className="mt-0.5 size-3.5 shrink-0 text-slate-400" />
                      <p className="text-sm text-slate-600">{appointment.customer.notes}</p>
                    </div>
                  </div>
                </>
              )}
              {appointment.notes && (
                <>
                  <Separator />
                  <div>
                    <p className="text-xs font-medium text-slate-400 uppercase">Observações do atendimento</p>
                    <p className="mt-0.5 text-sm text-slate-700">{appointment.notes}</p>
                  </div>
                </>
              )}
            </div>

            {/* Produtos utilizados no atendimento — opcional */}
            <AppointmentProductsSection
              appointmentId={appointment.id}
              serviceId={appointment.serviceId}
              defaultExpanded={isActive}
              isCompleted={!isActive}
            />

            {isActive && (
              <div className="space-y-2">
                {appointment.status === 'SCHEDULED' && (
                  <Button
                    className="w-full bg-blue-600 text-white hover:bg-blue-700"
                    onClick={() => handleStatus('CONFIRMED')}
                    disabled={updateStatus.isPending}
                  >
                    Confirmar presença
                  </Button>
                )}
                {['SCHEDULED', 'CONFIRMED'].includes(appointment.status) && (
                  <Button
                    className="w-full bg-emerald-600 text-white hover:bg-emerald-700"
                    onClick={() => handleStatus('COMPLETED')}
                    disabled={updateStatus.isPending}
                  >
                    Concluir atendimento
                  </Button>
                )}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1 border-orange-200 text-orange-700 hover:bg-orange-50"
                    onClick={() => handleStatus('NO_SHOW')}
                    disabled={updateStatus.isPending}
                  >
                    Não compareceu
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 border-red-200 text-red-700 hover:bg-red-50"
                    onClick={() => setCancelModalOpen(true)}
                    disabled={updateStatus.isPending}
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <CancelAppointmentModal
        appointment={appointment}
        open={cancelModalOpen}
        onClose={() => {
          setCancelModalOpen(false)
          onClose()
        }}
      />
    </>
  )
}
