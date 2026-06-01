// src/hooks/crm/use-customer.ts
import { useQuery } from '@tanstack/react-query'
import type { Customer } from './use-customers'

export type CustomerAppointment = {
  id: string
  startsAt: string
  endsAt: string
  status: string
  price: string
  service: { id: string; name: string }
  professional: { id: string; name: string }
}

export type CustomerProfile = Customer & {
  appointments: CustomerAppointment[]
  noShowCount: number
}

async function fetchCustomerProfile(id: string): Promise<CustomerProfile> {
  const res = await fetch(`/api/crm/customers/${id}`)
  if (!res.ok) throw new Error('Cliente não encontrado')
  return res.json()
}

export function useCustomer(id: string) {
  return useQuery({
    queryKey: ['customer', id],
    queryFn: () => fetchCustomerProfile(id),
    staleTime: 30 * 1000,
    enabled: !!id,
  })
}
