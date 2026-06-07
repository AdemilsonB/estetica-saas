import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

export type ServiceCategory = {
  id: string
  name: string
  order: number
  active: boolean
}

async function listCategories(): Promise<ServiceCategory[]> {
  const res = await fetch('/api/scheduling/service-categories')
  if (!res.ok) throw new Error('Falha ao carregar categorias')
  return res.json()
}

async function createCategory(input: { name: string }): Promise<ServiceCategory> {
  const res = await fetch('/api/scheduling/service-categories', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) throw new Error('Falha ao criar categoria')
  return res.json()
}

async function updateCategory({ id, ...input }: { id: string; name?: string; order?: number }): Promise<ServiceCategory> {
  const res = await fetch(`/api/scheduling/service-categories/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) throw new Error('Falha ao atualizar categoria')
  return res.json()
}

async function deleteCategory(id: string): Promise<void> {
  const res = await fetch(`/api/scheduling/service-categories/${id}`, { method: 'DELETE' })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body?.message ?? 'Falha ao remover categoria')
  }
}

export function useServiceCategories() {
  return useQuery({
    queryKey: ['service-categories'],
    queryFn: listCategories,
    staleTime: 5 * 60 * 1000,
  })
}

export function useCreateCategory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createCategory,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['service-categories'] }),
  })
}

export function useUpdateCategory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: updateCategory,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['service-categories'] }),
  })
}

export function useDeleteCategory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deleteCategory,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['service-categories'] }),
  })
}
