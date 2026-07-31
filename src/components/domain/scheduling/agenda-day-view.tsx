// src/components/domain/scheduling/agenda-day-view.tsx
'use client'

import { useState, useEffect } from 'react'
import { Plus, CalendarDays, LayoutList, CalendarRange } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { AppointmentDrawer } from './appointment-drawer'
import { CreateAppointmentModal } from './create-appointment-modal'
import { RegisterPaymentModal } from '@/components/domain/financial/register-payment-modal'
import { ConfirmAppointmentModal } from './confirm-appointment-modal'
import { AgendaWeekStrip } from './agenda-week-strip'
import { AgendaMonthView } from './agenda-month-view'
import { AgendaWeekGrid } from './agenda-week-grid'
import { AgendaDayTimeline, type TimelineColumn } from './agenda-day-timeline'
import { useAppointments, useUpdateAppointmentStatus } from '@/hooks/scheduling/use-appointments'
import type { Appointment } from '@/hooks/scheduling/use-appointments'
import { usePermissions } from '@/hooks/use-permissions'
import { useCurrentUser } from '@/hooks/use-current-user'
import { useTeamMembers } from '@/hooks/iam/use-team'
import type { TeamMember } from '@/hooks/iam/use-team'
import { useBusinessHours } from '@/hooks/scheduling/use-business-hours'
import {
  appointmentSlotTimes,
  buildDaySlots,
  occupiesSlot,
  toDateInputLocal,
} from '@/shared/utils/day-slots'
import { ProfessionalFilter } from './ProfessionalFilter'
import { useAgendaDateStore } from '@/stores/agenda-date.store'

function startOfDay(d: Date) {
  const r = new Date(d)
  r.setHours(0, 0, 0, 0)
  return r
}

function endOfDay(d: Date) {
  const r = new Date(d)
  r.setHours(23, 59, 59, 999)
  return r
}

function startOfWeek(d: Date) {
  const r = new Date(d)
  const day = r.getDay()
  r.setDate(r.getDate() - day + (day === 0 ? -6 : 1))
  r.setHours(0, 0, 0, 0)
  return r
}

function formatDayLabel(d: Date) {
  const today = new Date()
  const isToday = d.toDateString() === today.toDateString()
  const label = d.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  })
  return isToday ? `Hoje, ${label}` : label
}

function groupByDay(appointments: Appointment[]) {
  const groups: Record<string, Appointment[]> = {}
  for (const appt of appointments) {
    const key = new Date(appt.startsAt).toDateString()
    if (!groups[key]) groups[key] = []
    groups[key].push(appt)
  }
  return groups
}

type ViewMode = 'day' | 'week' | 'month'

type CreateDraft = {
  date?: string
  professionalId?: string
  time?: string
}

export function AgendaDayView() {
  const selectedDate = useAgendaDateStore((s) => s.selectedDate)
  const setSelectedDate = useAgendaDateStore((s) => s.setSelectedDate)
  const [viewMode, setViewMode] = useState<ViewMode>('day')
  const [selectedAppointment, setSelectedAppointment] =
    useState<Appointment | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [createDraft, setCreateDraft] = useState<CreateDraft | null>(null)
  const [paymentAppointment, setPaymentAppointment] = useState<Appointment | null>(null)
  const [paymentModalOpen, setPaymentModalOpen] = useState(false)
  const [confirmModalAppointment, setConfirmModalAppointment] = useState<Appointment | null>(null)
  const [drawerEditMode, setDrawerEditMode] = useState(false)
  const { can } = usePermissions()
  const updateStatus = useUpdateAppointmentStatus()

  // Esconde o bottom nav quando o drawer está aberto
  useEffect(() => {
    document.dispatchEvent(
      new CustomEvent('agenda:drawer-toggle', { detail: { open: drawerOpen } })
    )
  }, [drawerOpen])

  function handleConfirmInline(appt: Appointment) {
    setConfirmModalAppointment(appt)
  }

  function handlePayInline(appt: Appointment) {
    setPaymentAppointment(appt)
    setPaymentModalOpen(true)
  }

  // Mesma sequência do botão "Concluir atendimento" da gaveta de detalhe: o pagamento é
  // registrado primeiro e só depois o agendamento vira COMPLETED (onAfterCheckout do
  // RegisterPaymentModal). Antes esse handler não existia aqui — pagar pelo card deixava o
  // agendamento para sempre CONFIRMED (pago, mas nunca concluído).
  function handleAfterCheckoutInline() {
    const appt = paymentAppointment
    setPaymentModalOpen(false)
    setPaymentAppointment(null)
    if (!appt) return
    updateStatus.mutate(
      { id: appt.id, status: 'COMPLETED' },
      {
        onSuccess: () => toast.success('Atendimento concluído'),
        onError: (err) => toast.error(err instanceof Error ? err.message : 'Erro ao concluir atendimento'),
      },
    )
  }

  function handleEditInline(appt: Appointment) {
    setSelectedAppointment(appt)
    setDrawerEditMode(true)
    setDrawerOpen(true)
  }

  const { data: currentUser } = useCurrentUser()
  const canViewAll = can('agenda', 'view_all')
  const { data: teamMembers = [] } = useTeamMembers()

  const FILTER_KEY = 'agenda:professional-filter'

  const [selectedProfessionalIds, setSelectedProfessionalIds] = useState<string[]>(() => {
    if (typeof window === 'undefined') return []
    try {
      const saved = localStorage.getItem(FILTER_KEY)
      return saved ? (JSON.parse(saved) as string[]) : []
    } catch {
      return []
    }
  })

  // Só aplica "todos selecionados" quando não há preferência salva ainda
  const [hasStoredPreference] = useState(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem(FILTER_KEY) !== null
  })

  useEffect(() => {
    if (!canViewAll || teamMembers.length === 0 || hasStoredPreference) return
    const allIds = teamMembers.map((m) => m.id)
    setSelectedProfessionalIds(allIds)
    localStorage.setItem(FILTER_KEY, JSON.stringify(allIds))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canViewAll, teamMembers])

  function handleFilterChange(ids: string[]) {
    setSelectedProfessionalIds(ids)
    localStorage.setItem(FILTER_KEY, JSON.stringify(ids))
  }

  const queryProfessionalId = !canViewAll
    ? currentUser?.roleId
      ? currentUser.id
      : undefined
    : selectedProfessionalIds.length === 1
      ? selectedProfessionalIds[0]
      : undefined

  const weekStart = startOfWeek(selectedDate)
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 6)
  weekEnd.setHours(23, 59, 59, 999)

  const from =
    viewMode === 'day'
      ? startOfDay(selectedDate).toISOString()
      : weekStart.toISOString()
  const to =
    viewMode === 'day'
      ? endOfDay(selectedDate).toISOString()
      : weekEnd.toISOString()

  const {
    data: appointments = [],
    isLoading,
    error,
    refetch,
  } = useAppointments({ from, to, professionalId: queryProfessionalId })

  const filteredAppointments =
    canViewAll && selectedProfessionalIds.length > 1
      ? appointments.filter((a) => selectedProfessionalIds.includes(a.professionalId))
      : appointments

  const sorted = [...filteredAppointments].sort(
    (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
  )

  const dayGroups = groupByDay(sorted)
  const dayKeys = Object.keys(dayGroups).sort(
    (a, b) => new Date(a).getTime() - new Date(b).getTime(),
  )

  const byProfessional = selectedProfessionalIds.map((profId) => ({
    professional: teamMembers.find((m) => m.id === profId) ?? ({
      id: profId,
      name: 'Profissional',
      email: '',
      role: 'PROFESSIONAL' as const,
      isOwner: false,
      roleId: null,
      roleName: '',
      avatarUrl: null,
      avatarCropX: null,
      avatarCropY: null,
      avatarCropZoom: null,
      bio: null,
      services: [],
      createdAt: '',
    } satisfies TeamMember),
    appointments: sorted.filter((a) => a.professionalId === profId),
  }))

  // Visão Dia: timeline de slots de 30 em 30 min (vazios inclusive), com 1
  // coluna quando 0/1 profissional está no filtro (ou não pode ver todos), N
  // colunas quando N profissionais estão selecionados.
  const { data: businessHoursData, isLoading: isLoadingBusinessHours } = useBusinessHours()
  const slotIntervalMinutes = businessHoursData?.slotIntervalMinutes ?? 30
  const multiColumn = canViewAll && selectedProfessionalIds.length > 1

  const singleColumn: TimelineColumn = !canViewAll
    ? { professionalId: currentUser?.id ?? '', professionalName: currentUser?.name ?? 'Você' }
    : selectedProfessionalIds.length === 1
      ? {
          professionalId: selectedProfessionalIds[0],
          professionalName: teamMembers.find((m) => m.id === selectedProfessionalIds[0])?.name ?? 'Profissional',
        }
      : { professionalId: '', professionalName: 'Todos' }

  const timelineColumns: TimelineColumn[] = multiColumn
    ? byProfessional.map(({ professional }) => ({ professionalId: professional.id, professionalName: professional.name }))
    : [singleColumn]

  const appointmentsByProfessional: Record<string, Appointment[]> = multiColumn
    ? Object.fromEntries(byProfessional.map(({ professional, appointments: a }) => [professional.id, a]))
    : { [singleColumn.professionalId]: sorted }

  const generatedSlots = buildDaySlots(
    businessHoursData?.businessHours?.[String(selectedDate.getDay())],
    slotIntervalMinutes,
  )
  // Agendamento fora do expediente entra na grade com TODAS as linhas da sua
  // duração, não só a de início — senão a grade fica com buraco (ex.: 08:00
  // seguido de 09:00 num grid de 30min) e o cálculo de span, que assume
  // linhas uniformes, passa a bloquear o intervalo errado. Desmarcado /
  // não compareceu não ocupam horário, então não criam linha própria.
  const apptSlots = sorted.flatMap((a) =>
    occupiesSlot(a.status) ? appointmentSlotTimes(a.startsAt, a.endsAt, slotIntervalMinutes) : [],
  )
  const daySlots = [...new Set([...generatedSlots, ...apptSlots])].sort()

  const isEmpty = viewMode === 'day' ? daySlots.length === 0 : dayKeys.length === 0

  function canClickSlot(professionalId: string): boolean {
    if (!can('agenda', 'create')) return false
    if (!professionalId) return false
    if (professionalId === currentUser?.id) return true
    return can('agenda', 'edit')
  }

  function handleSlotClick(professionalId: string, time: string) {
    setCreateDraft({ date: toDateInputLocal(selectedDate), professionalId, time })
    setCreateModalOpen(true)
  }

  function openCreateModal() {
    setCreateDraft({ date: toDateInputLocal(selectedDate) })
    setCreateModalOpen(true)
  }

  function handleCardClick(appt: Appointment) {
    setSelectedAppointment(appt)
    setDrawerOpen(true)
  }

  function handleSelectDay(d: Date) {
    setSelectedDate(d)
    setViewMode('day')
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Strip semanal (oculto no modo mês) */}
      {viewMode !== 'month' && (
        <AgendaWeekStrip
          selectedDate={selectedDate}
          onSelectDate={handleSelectDay}
        />
      )}

      {/* Linha de controles: [Dia|Semana|Mês] + [filtro prof] + [+] */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1 rounded-full border border-slate-200 bg-white p-1">
          <Button
            variant={viewMode === 'day' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('day')}
            className="rounded-full"
          >
            <LayoutList className="size-4" />
            <span className="hidden sm:inline">Dia</span>
          </Button>
          <Button
            variant={viewMode === 'week' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('week')}
            className="rounded-full"
          >
            <CalendarRange className="size-4" />
            <span className="hidden sm:inline">Semana</span>
          </Button>
          {/* Mês → AgendaMonthView com anéis de ocupação */}
          <Button
            variant={viewMode === 'month' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setViewMode(viewMode === 'month' ? 'day' : 'month')}
            className="rounded-full"
          >
            <CalendarDays className="size-4" />
            <span className="hidden sm:inline">Mês</span>
          </Button>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          {canViewAll && currentUser && (
            <ProfessionalFilter
              selectedIds={selectedProfessionalIds}
              onChange={handleFilterChange}
              currentUserId={currentUser.id}
            />
          )}

          {can('agenda', 'create') && (
            <Button
              onClick={openCreateModal}
              size="icon"
              className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90 size-8 shrink-0"
              aria-label="Novo agendamento"
            >
              <Plus className="size-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Label do dia selecionado. Quando a timeline aparece, ela renderiza a
          própria data dentro da faixa fixa (pra data acompanhar o scroll junto
          com os nomes dos profissionais) — aqui fica só nos estados em que a
          timeline não é montada, senão a data apareceria duas vezes. */}
      {viewMode === 'day' && (isLoading || isLoadingBusinessHours || !!error || isEmpty) && (
        <p className="text-sm font-semibold capitalize text-slate-600">
          {formatDayLabel(selectedDate)}
        </p>
      )}

      {/* Modo Mês — AgendaMonthView com anéis de ocupação */}
      {viewMode === 'month' && (
        <AgendaMonthView
          selectedDate={selectedDate}
          onSelectDate={(d) => setSelectedDate(d)}
          onSelectDayView={() => setViewMode('day')}
        />
      )}

      {/* Modos Dia e Semana */}
      {viewMode !== 'month' && (
        <>
          {isLoading || (viewMode === 'day' && isLoadingBusinessHours) ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-24 w-full rounded-2xl" />
              ))}
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
              <p className="text-sm text-red-600">Erro ao carregar agendamentos.</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => refetch()}
              >
                Tentar novamente
              </Button>
            </div>
          ) : isEmpty ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white/60 py-16 text-center">
              <CalendarDays className="size-10 text-slate-300" />
              <p className="mt-4 text-sm font-medium text-slate-500">
                {viewMode === 'week'
                  ? 'Nenhum agendamento para esta semana'
                  : 'Nenhum agendamento para este dia'}
              </p>
              {can('agenda', 'create') && (
                <Button
                  onClick={openCreateModal}
                  variant="outline"
                  size="sm"
                  className="mt-4 rounded-full"
                >
                  <Plus className="size-4" />
                  Criar primeiro agendamento
                </Button>
              )}
            </div>
          ) : viewMode === 'week' ? (
            <AgendaWeekGrid
              selectedDate={selectedDate}
              onSelectDate={(d) => {
                setSelectedDate(d)
                setViewMode('day')
              }}
              onAppointmentClick={handleCardClick}
              professionalId={queryProfessionalId}
            />
          ) : (
            <AgendaDayTimeline
              slots={daySlots}
              columns={timelineColumns}
              appointmentsByProfessional={appointmentsByProfessional}
              slotIntervalMinutes={slotIntervalMinutes}
              dateLabel={formatDayLabel(selectedDate)}
              canClickSlot={canClickSlot}
              onSlotClick={handleSlotClick}
              onAppointmentClick={handleCardClick}
              onConfirm={handleConfirmInline}
              onPay={handlePayInline}
              onEdit={handleEditInline}
            />
          )}
        </>
      )}

      <AppointmentDrawer
        appointment={selectedAppointment}
        open={drawerOpen}
        startInEditMode={drawerEditMode}
        onClose={() => {
          setDrawerOpen(false)
          setSelectedAppointment(null)
          setDrawerEditMode(false)
        }}
      />

      <CreateAppointmentModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        defaultDate={createDraft?.date}
        defaultProfessionalId={createDraft?.professionalId}
        defaultTime={createDraft?.time}
      />

      <RegisterPaymentModal
        appointment={paymentAppointment}
        open={paymentModalOpen}
        onClose={() => {
          setPaymentModalOpen(false)
          setPaymentAppointment(null)
        }}
        onAfterCheckout={handleAfterCheckoutInline}
      />

      {confirmModalAppointment && (
        <ConfirmAppointmentModal
          appointment={confirmModalAppointment}
          open={!!confirmModalAppointment}
          onClose={() => setConfirmModalAppointment(null)}
        />
      )}
    </div>
  )
}
