import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

export type Customer = {
  id: string
  name: string
  phone: string | null
  email: string | null
  notes: string | null
  tags: string[]
  isVip: boolean
  vipUpdatedAt: string | null
  birthDate: string | null
  createdAt: string
  updatedAt: string
}

export type CreateCustomerInput = {
  name: string
  phone?: string
  email?: string
  notes?: string
  tags?: string[]
}

export type CustomersPage = {
  data: Customer[]
  total: number
  page: number
  pageSize: number
}

export type CustomerListParams = {
  search?: string
  page?: number
  pageSize?: number
  onlyVip?: boolean
  birthdayMonth?: number
  noAppointmentDays?: number
  minAvgTicket?: number
  hasPendingDebt?: boolean
}

async function listCustomers(params: CustomerListParams): Promise<CustomersPage> {
  const url = new URL('/api/crm/customers', window.location.origin)
  if (params.search) url.searchParams.set('search', params.search)
  if (params.page) url.searchParams.set('page', String(params.page))
  if (params.pageSize) url.searchParams.set('pageSize', String(params.pageSize))
  if (params.onlyVip) url.searchParams.set('onlyVip', 'true')
  if (params.birthdayMonth != null)
    url.searchParams.set('birthdayMonth', String(params.birthdayMonth))
  if (params.noAppointmentDays != null)
    url.searchParams.set('noAppointmentDays', String(params.noAppointmentDays))
  if (params.minAvgTicket != null)
    url.searchParams.set('minAvgTicket', String(params.minAvgTicket))
  if (params.hasPendingDebt) url.searchParams.set('hasPendingDebt', 'true')
  const res = await fetch(url)
  if (!res.ok) throw new Error('Falha ao carregar clientes')
  return res.json()
}

async function createCustomer(input: CreateCustomerInput): Promise<Customer> {
  const res = await fetch('/api/crm/customers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: { message?: string } }).error?.message ?? 'Falha ao cadastrar cliente')
  }
  return res.json()
}

async function updateCustomer(
  id: string,
  input: Partial<CreateCustomerInput>,
): Promise<Customer> {
  const res = await fetch(`/api/crm/customers/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: { message?: string } }).error?.message ?? 'Falha ao atualizar cliente')
  }
  return res.json()
}

export function useCustomers(params: CustomerListParams = {}) {
  return useQuery({
    queryKey: ['customers', params],
    queryFn: () => listCustomers(params),
    staleTime: 30 * 1000,
  })
}

export function useCreateCustomer() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createCustomer,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] })
    },
  })
}

export function useUpdateCustomer() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<CreateCustomerInput> }) =>
      updateCustomer(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      queryClient.invalidateQueries({ queryKey: ['customer'] })
    },
  })
}
