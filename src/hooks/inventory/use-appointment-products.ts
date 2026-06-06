// src/hooks/inventory/use-appointment-products.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

export type AppointmentProduct = {
  productId: string
  quantity: number
  product: { id: string; name: string; salePrice: string }
}

export type AppointmentProductsInput = {
  products: Array<{ productId: string; quantity: number }>
  stockAction?: 'apply' | 'none'
}

async function getAppointmentProducts(appointmentId: string): Promise<AppointmentProduct[]> {
  const res = await fetch(`/api/appointments/${appointmentId}/products`)
  if (!res.ok) throw new Error('Falha ao buscar produtos do agendamento')
  return res.json()
}

async function saveAppointmentProducts(
  appointmentId: string,
  input: AppointmentProductsInput,
): Promise<AppointmentProduct[]> {
  const res = await fetch(`/api/appointments/${appointmentId}/products`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(
      (err as { message?: string }).message ?? 'Falha ao salvar produtos do agendamento',
    )
  }
  return res.json()
}

export function useAppointmentProducts(appointmentId?: string) {
  return useQuery({
    queryKey: ['appointment-products', appointmentId],
    queryFn: () => getAppointmentProducts(appointmentId!),
    enabled: !!appointmentId,
    staleTime: 30 * 1000,
  })
}

export function useSaveAppointmentProducts(appointmentId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: AppointmentProductsInput) => saveAppointmentProducts(appointmentId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointment-products', appointmentId] })
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['stock-movements'] })
    },
  })
}
