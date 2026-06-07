import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

export type Service = {
  id: string
  name: string
  duration: number
  price: string
  priceType: 'FIXED' | 'STARTING_FROM' | 'RANGE' | 'ON_CONSULTATION'
  priceMin: string | null
  priceMax: string | null
  description: string | null
  imageUrl: string | null
  categoryId: string | null
  category: { id: string; name: string } | null
  active: boolean
}

export type CreateServiceInput = {
  name: string
  duration: number
  price: number
  priceType?: 'FIXED' | 'STARTING_FROM' | 'RANGE' | 'ON_CONSULTATION'
  priceMin?: number | null
  priceMax?: number | null
  description?: string | null
  categoryId?: string | null
  active?: boolean
}

export type UpdateServiceInput = {
  name?: string
  duration?: number
  price?: number
  priceType?: 'FIXED' | 'STARTING_FROM' | 'RANGE' | 'ON_CONSULTATION'
  priceMin?: number | null
  priceMax?: number | null
  description?: string | null
  categoryId?: string | null
  imageUrl?: string | null
}

async function listServices(): Promise<Service[]> {
  const res = await fetch('/api/scheduling/services')
  if (!res.ok) throw new Error('Falha ao carregar servicos')
  return res.json()
}

async function createService(input: CreateServiceInput): Promise<Service> {
  const res = await fetch('/api/scheduling/services', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) throw new Error('Falha ao criar servico')
  return res.json()
}

async function updateService({ id, ...input }: UpdateServiceInput & { id: string }): Promise<Service> {
  const res = await fetch(`/api/scheduling/services/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) throw new Error('Falha ao atualizar servico')
  return res.json()
}

async function deactivateService(id: string): Promise<void> {
  const res = await fetch(`/api/scheduling/services/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Falha ao desativar servico')
}

export function useServices() {
  return useQuery({
    queryKey: ['services'],
    queryFn: listServices,
    staleTime: 5 * 60 * 1000,
  })
}

export function useCreateService() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createService,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['services'] }),
  })
}

export function useUpdateService() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: updateService,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['services'] }),
  })
}

export function useDeactivateService() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deactivateService,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['services'] }),
  })
}
