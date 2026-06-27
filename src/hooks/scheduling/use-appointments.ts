// src/hooks/scheduling/use-appointments.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

export type AppointmentStatus =
  | 'SCHEDULED'
  | 'CONFIRMED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'NO_SHOW'

export type AppointmentPaymentStatus = 'PENDING' | 'PAID' | 'COURTESY' | 'DEBT' | 'REFUNDED'

export type Appointment = {
  id: string
  customerId: string
  professionalId: string
  serviceId: string
  startsAt: string
  endsAt: string
  status: AppointmentStatus
  paymentStatus: AppointmentPaymentStatus
  notes: string | null
  price: string
  confirmedPrice: string | null
  customer: { id: string; name: string; phone: string | null; notes: string | null }
  professional: { id: string; name: string }
  service: { id: string; name: string; duration: number }
}

export type CreateAppointmentInput = {
  customerId: string
  professionalId: string
  serviceId: string
  startsAt: string
  notes?: string
  allowOverlap?: boolean
  allowPastDate?: boolean
  notificationMessage?: string
}

export type UpdateAppointmentInput = {
  startsAt?: string
  endsAt?: string
  professionalId?: string
  serviceId?: string
  notificationMessage?: string
}

type ListParams = {
  from?: string
  to?: string
  professionalId?: string
}

async function listAppointments(params: ListParams): Promise<Appointment[]> {
  const url = new URL('/api/scheduling/appointments', window.location.origin)
  if (params.from) url.searchParams.set('from', params.from)
  if (params.to) url.searchParams.set('to', params.to)
  if (params.professionalId)
    url.searchParams.set('professionalId', params.professionalId)
  const res = await fetch(url)
  if (!res.ok) throw new Error('Falha ao carregar agendamentos')
  return res.json()
}

async function createAppointment(input: CreateAppointmentInput): Promise<Appointment> {
  const res = await fetch('/api/scheduling/appointments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message ?? 'Falha ao criar agendamento')
  }
  return res.json()
}

async function rescheduleAppointment(
  id: string,
  data: UpdateAppointmentInput,
): Promise<Appointment> {
  const res = await fetch(`/api/scheduling/appointments/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message ?? 'Falha ao remarcar agendamento')
  }
  return res.json()
}

async function updateAppointmentStatus(
  id: string,
  status: AppointmentStatus,
  notificationMessage?: string,
  confirmedPrice?: number,
): Promise<Appointment> {
  const res = await fetch(`/api/scheduling/appointments/${id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status, notificationMessage, confirmedPrice }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message ?? 'Falha ao atualizar status')
  }
  return res.json()
}

export function useAppointments(params: ListParams) {
  return useQuery({
    queryKey: ['appointments', params],
    queryFn: () => listAppointments(params),
    staleTime: 30 * 1000,
  })
}

export function useCreateAppointment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createAppointment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] })
    },
  })
}

export function useUpdateAppointmentStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      status,
      notificationMessage,
      confirmedPrice,
    }: {
      id: string
      status: AppointmentStatus
      notificationMessage?: string
      confirmedPrice?: number
    }) => updateAppointmentStatus(id, status, notificationMessage, confirmedPrice),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] })
    },
  })
}

export function useRescheduleAppointment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & UpdateAppointmentInput) =>
      rescheduleAppointment(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] })
    },
  })
}

async function refundAppointment(id: string): Promise<void> {
  const res = await fetch(`/api/scheduling/appointments/${id}/refund`, {
    method: 'POST',
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message ?? 'Falha ao registrar estorno')
  }
}

export function useRefundAppointment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: refundAppointment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] })
    },
  })
}
