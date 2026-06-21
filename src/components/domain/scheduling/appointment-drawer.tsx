// src/components/domain/scheduling/appointment-drawer.tsx
'use client'

import { useState, useEffect } from 'react'
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
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useUpdateAppointmentStatus, useRescheduleAppointment } from '@/hooks/scheduling/use-appointments'
import type { Appointment } from '@/hooks/scheduling/use-appointments'
import { useAvailableSlots } from '@/hooks/scheduling/use-availability'
import { useTeamMembers } from '@/hooks/iam/use-team'
import { cn } from '@/lib/utils'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { CancelAppointmentModal } from './cancel-appointment-modal'
import { ConfirmAppointmentModal } from './confirm-appointment-modal'
import { AppointmentProductsSection } from '@/components/domain/inventory/AppointmentProductsSection'
import { AppointmentAnamnesePanel } from './appointment-anamnese-panel'

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

const RESCHEDULE_TEMPLATE =
  'Olá, {nome}! Seu agendamento de {serviço} foi remarcado para {data} às {hora} com {profissional}. Qualquer dúvida, estamos à disposição. Te esperamos! 🤍'

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function toDateInput(iso: string) {
  const d = new Date(iso)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function toTimeInput(iso: string) {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
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
  const [confirmModalOpen, setConfirmModalOpen] = useState(false)
  const [noShowModalOpen, setNoShowModalOpen] = useState(false)

  const [isEditing, setIsEditing] = useState(false)
  const [editProfessionalId, setEditProfessionalId] = useState('')
  const [editDate, setEditDate] = useState('')
  const [editTime, setEditTime] = useState('')
  const [editMessage, setEditMessage] = useState('')

  const { data: teamMembers = [] } = useTeamMembers()
  const reschedule = useRescheduleAppointment()

  const { data: slots = [], isLoading: loadingSlots } = useAvailableSlots(
    isEditing ? editProfessionalId || null : null,
    isEditing ? editDate || null : null,
    isEditing ? (appointment?.serviceId ?? null) : null,
  )

  useEffect(() => {
    if (!appointment || !editTime || !editDate) return
    const professionalName =
      teamMembers.find((m) => m.id === editProfessionalId)?.name ??
      appointment.professional.name
    const dateLabel = new Date(editDate + 'T12:00:00').toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
    })
    setEditMessage(
      RESCHEDULE_TEMPLATE
        .replace('{nome}', appointment.customer.name.split(' ')[0])
        .replace('{serviço}', appointment.service.name)
        .replace('{data}', dateLabel)
        .replace('{hora}', editTime.replace(':', 'h'))
        .replace('{profissional}', professionalName.split(' ')[0]),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editTime, editDate, editProfessionalId])

  function startEditing() {
    if (!appointment) return
    setEditProfessionalId(appointment.professionalId)
    setEditDate(toDateInput(appointment.startsAt))
    setEditTime(toTimeInput(appointment.startsAt))
    setEditMessage('')
    setIsEditing(true)
  }

  function handleSaveEdit() {
    if (!appointment || !editTime) return
    const newStartsAt = new Date(`${editDate}T${editTime}:00`).toISOString()
    const newEndsAt = new Date(
      new Date(newStartsAt).getTime() + appointment.service.duration * 60 * 1000,
    ).toISOString()
    reschedule.mutate(
      {
        id: appointment.id,
        startsAt: newStartsAt,
        endsAt: newEndsAt,
        professionalId: editProfessionalId,
        notificationMessage: editMessage,
      },
      {
        onSuccess: () => {
          toast.success('Agendamento atualizado')
          setIsEditing(false)
          onClose()
        },
        onError: (err) => {
          toast.error(err instanceof Error ? err.message : 'Erro ao atualizar')
        },
      },
    )
  }

  function handleClose() {
    setIsEditing(false)
    onClose()
  }

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

  const originalProfessionalId = appointment?.professionalId ?? ''
  const originalDate = appointment ? toDateInput(appointment.startsAt) : ''
  const originalTime = appointment ? toTimeInput(appointment.startsAt) : ''
  const hasChanged =
    editProfessionalId !== originalProfessionalId ||
    editDate !== originalDate ||
    (editTime !== '' && editTime !== originalTime)

  if (!appointment) return null

  const isActive = !['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(appointment.status)

  return (
    <>
      <Sheet open={open} onOpenChange={(o) => !o && handleClose()}>
        <SheetContent className="flex flex-col" style={{ width: '100%', maxWidth: '520px' }}>
          <SheetHeader>
            <SheetTitle>Detalhes do agendamento</SheetTitle>
          </SheetHeader>

          <div className="mt-6 space-y-6 overflow-y-auto flex-1 pb-6 pr-1">
            {isEditing ? (
              <div className="space-y-5">
                {/* Profissional */}
                <div className="space-y-1.5">
                  <Label>Profissional</Label>
                  <Select value={editProfessionalId} onValueChange={setEditProfessionalId}>
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
                    value={editDate}
                    onChange={(e) => {
                      setEditDate(e.target.value)
                      setEditTime('')
                    }}
                    min={toDateInput(new Date().toISOString())}
                    className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-950"
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
                          type="button"
                          disabled={!slot.available}
                          onClick={() => setEditTime(slot.time)}
                          className={cn(
                            'rounded-full border px-3 py-1.5 text-xs font-medium transition',
                            slot.available
                              ? editTime === slot.time
                                ? 'border-slate-950 bg-slate-950 text-white'
                                : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400'
                              : 'cursor-not-allowed border-slate-100 bg-slate-50 text-slate-300',
                          )}
                        >
                          {slot.time.replace(':', 'h')}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Mensagem WhatsApp */}
                <div className="space-y-1.5">
                  <Label>Mensagem enviada ao cliente via WhatsApp</Label>
                  <Textarea
                    value={editMessage}
                    onChange={(e) => setEditMessage(e.target.value)}
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
                    onClick={() => setIsEditing(false)}
                    disabled={reschedule.isPending}
                  >
                    Cancelar edição
                  </Button>
                  <Button
                    className="flex-1 bg-slate-950 text-white hover:bg-slate-800"
                    onClick={handleSaveEdit}
                    disabled={!hasChanged || !editTime || reschedule.isPending}
                  >
                    {reschedule.isPending ? 'Salvando...' : 'Salvar alterações'}
                  </Button>
                </div>
              </div>
            ) : (
              <>
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
                      {appointment.service.duration} min
                      {appointment.confirmedPrice && Number(appointment.confirmedPrice) !== Number(appointment.price) ? (
                        <>
                          {' · '}
                          <span className="font-medium text-slate-700">
                            R${Number(appointment.confirmedPrice).toFixed(2)}
                          </span>
                          <span className="ml-1 line-through">
                            R${Number(appointment.price).toFixed(2)}
                          </span>
                        </>
                      ) : (
                        <> · R${Number(appointment.price).toFixed(2)}</>
                      )}
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

                {/* Ficha de anamnese e sugestão de preço */}
                <AppointmentAnamnesePanel appointmentId={appointment.id} />

                {/* Produtos utilizados no atendimento — opcional */}
                <AppointmentProductsSection
                  appointmentId={appointment.id}
                  serviceId={appointment.serviceId}
                  defaultExpanded={isActive}
                  isCompleted={!isActive}
                />

                {isActive && (
                  <div className="space-y-2">
                    {appointment.status === 'SCHEDULED' && !isEditing && (
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={startEditing}
                      >
                        Editar agendamento
                      </Button>
                    )}
                    {appointment.status === 'SCHEDULED' && (
                      <Button
                        className="w-full"
                        onClick={() => setConfirmModalOpen(true)}
                      >
                        Confirmar presença
                      </Button>
                    )}
                    {['SCHEDULED', 'CONFIRMED'].includes(appointment.status) && (
                      <Button
                        className="w-full bg-green-600 text-white hover:bg-green-700"
                        onClick={() => handleStatus('COMPLETED')}
                        disabled={updateStatus.isPending}
                      >
                        Concluir atendimento
                      </Button>
                    )}
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        className="flex-1 border-amber-200 text-amber-700 hover:bg-amber-50"
                        onClick={() => setNoShowModalOpen(true)}
                        disabled={updateStatus.isPending}
                      >
                        Não compareceu
                      </Button>
                      <Button
                        variant="destructive"
                        className="flex-1"
                        onClick={() => setCancelModalOpen(true)}
                        disabled={updateStatus.isPending}
                      >
                        Cancelar
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={noShowModalOpen} onOpenChange={setNoShowModalOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Registrar não comparecimento?</AlertDialogTitle>
            <AlertDialogDescription>
              O agendamento será marcado como não compareceu. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleStatus('NO_SHOW')}
              className="bg-orange-600 hover:bg-orange-700"
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <CancelAppointmentModal
        appointment={appointment}
        open={cancelModalOpen}
        onClose={() => {
          setCancelModalOpen(false)
          onClose()
        }}
      />

      <ConfirmAppointmentModal
        appointment={appointment}
        open={confirmModalOpen}
        onClose={() => {
          setConfirmModalOpen(false)
          onClose()
        }}
      />
    </>
  )
}
