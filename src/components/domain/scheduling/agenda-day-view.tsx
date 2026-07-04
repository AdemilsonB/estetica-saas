// src/components/domain/scheduling/agenda-day-view.tsx
'use client'

import { useState, useEffect } from 'react'
import { Plus, CalendarDays, LayoutList, CalendarRange } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { AppointmentCard } from './appointment-card'
import { AppointmentDrawer } from './appointment-drawer'
import { CreateAppointmentModal } from './create-appointment-modal'
import { RegisterPaymentModal } from '@/components/domain/financial/register-payment-modal'
import { ConfirmAppointmentModal } from './confirm-appointment-modal'
import { AgendaWeekStrip } from './agenda-week-strip'
import { AgendaMonthView } from './agenda-month-view'
import { AgendaWeekGrid } from './agenda-week-grid'
import { useAppointments } from '@/hooks/scheduling/use-appointments'
import type { Appointment } from '@/hooks/scheduling/use-appointments'
import { usePermissions } from '@/hooks/use-permissions'
import { useCurrentUser } from '@/hooks/use-current-user'
import { useTeamMembers } from '@/hooks/iam/use-team'
import type { TeamMember } from '@/hooks/iam/use-team'
import { ProfessionalFilter } from './ProfessionalFilter'

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

function groupByHour(appointments: Appointment[]) {
  const groups: Record<string, Appointment[]> = {}
  for (const appt of appointments) {
    const hour = new Date(appt.startsAt).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    })
    if (!groups[hour]) groups[hour] = []
    groups[hour].push(appt)
  }
  return groups
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

function toHour(appt: Appointment) {
  return new Date(appt.startsAt).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

type ViewMode = 'day' | 'week' | 'month'

export function AgendaDayView() {
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [viewMode, setViewMode] = useState<ViewMode>('day')
  const [selectedAppointment, setSelectedAppointment] =
    useState<Appointment | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [paymentAppointment, setPaymentAppointment] = useState<Appointment | null>(null)
  const [paymentModalOpen, setPaymentModalOpen] = useState(false)
  const [confirmModalAppointment, setConfirmModalAppointment] = useState<Appointment | null>(null)
  const { can } = usePermissions()

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

  // Indica se já existe preferência salva (evita sobrescrever com "todos" na primeira carga)
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

  const groups = groupByHour(sorted)
  const hours = Object.keys(groups).sort()

  const dayGroups = groupByDay(sorted)
  const dayKeys = Object.keys(dayGroups).sort(
    (a, b) => new Date(a).getTime() - new Date(b).getTime(),
  )

  const isEmpty = viewMode === 'day' ? hours.length === 0 : dayKeys.length === 0

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

  const allColumnHours = [
    ...new Set(byProfessional.flatMap(({ appointments: a }) => a.map(toHour))),
  ].sort()

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
              onClick={() => setCreateModalOpen(true)}
              size="icon"
              className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90 size-8 shrink-0"
              aria-label="Novo agendamento"
            >
              <Plus className="size-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Label do dia selecionado (só no modo dia) */}
      {viewMode === 'day' && (
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
          {isLoading ? (
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
                  onClick={() => setCreateModalOpen(true)}
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
          ) : viewMode === 'day' && canViewAll && selectedProfessionalIds.length > 1 ? (
            <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
              <div className="inline-flex min-w-full flex-col">
                <div className="mb-2 flex">
                  <div className="w-10 sm:w-14 shrink-0" />
                  {byProfessional.map(({ professional }) => (
                    <div key={professional.id} className="min-w-44 sm:min-w-60 flex-1 px-1 sm:px-2">
                      <div className="flex items-center gap-1.5 sm:gap-2">
                        <div className="flex size-6 sm:size-7 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[10px] sm:text-xs font-semibold text-slate-600">
                          {professional.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="truncate text-xs sm:text-sm font-medium text-slate-700">
                          {professional.name}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                {allColumnHours.map((hour) => (
                  <div key={hour} className="flex items-start border-t border-slate-100/80">
                    <div className="sticky left-0 z-10 w-10 sm:w-14 shrink-0 bg-background pt-1.5">
                      <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wide text-slate-400">
                        {hour}
                      </span>
                    </div>
                    {byProfessional.map(({ professional, appointments: profAppts }) => {
                      const appts = profAppts.filter((a) => toHour(a) === hour)
                      return (
                        <div
                          key={professional.id}
                          className="min-w-44 sm:min-w-60 flex-1 space-y-1.5 px-1 pb-2"
                        >
                          {appts.map((appt) => (
                            <AppointmentCard
                              key={appt.id}
                              appointment={appt}
                              onClick={handleCardClick}
                              onConfirm={handleConfirmInline}
                              onPay={handlePayInline}
                            />
                          ))}
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
            </div>
          ) : viewMode === 'day' ? (
            <div className="space-y-6">
              {hours.map((hour) => (
                <div key={hour}>
                  <p className="mb-2 text-xs font-semibold tracking-wide text-slate-400 uppercase">
                    {hour}
                  </p>
                  <div className="space-y-2">
                    {groups[hour].map((appt) => (
                      <AppointmentCard
                        key={appt.id}
                        appointment={appt}
                        onClick={handleCardClick}
                        onConfirm={handleConfirmInline}
                        onPay={handlePayInline}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </>
      )}

      <AppointmentDrawer
        appointment={selectedAppointment}
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false)
          setSelectedAppointment(null)
        }}
        onCompleted={(appt) => {
          setPaymentAppointment(appt)
          setPaymentModalOpen(true)
        }}
      />

      <CreateAppointmentModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
      />

      <RegisterPaymentModal
        appointment={paymentAppointment}
        open={paymentModalOpen}
        onClose={() => {
          setPaymentModalOpen(false)
          setPaymentAppointment(null)
        }}
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
