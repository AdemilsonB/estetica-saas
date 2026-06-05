// src/hooks/inventory/use-product-categories.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

export type ProductCategory = {
  id: string
  name: string
  tenantId: string
}

async function listCategories(): Promise<ProductCategory[]> {
  const res = await fetch('/api/products/categories')
  if (!res.ok) throw new Error('Falha ao buscar categorias')
  return res.json()
}

async function createCategory(name: string): Promise<ProductCategory> {
  const res = await fetch('/api/products/categories', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { message?: string }).message ?? 'Falha ao criar categoria')
  }
  return res.json()
}

async function deleteCategory(id: string): Promise<void> {
  const res = await fetch(`/api/products/categories/${id}`, { method: 'DELETE' })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { message?: string }).message ?? 'Falha ao excluir categoria')
  }
}

export function useProductCategories() {
  return useQuery({
    queryKey: ['product-categories'],
    queryFn: listCategories,
    staleTime: 5 * 60 * 1000,
  })
}

export function useCreateCategory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (name: string) => createCategory(name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-categories'] })
    },
  })
}

export function useDeleteCategory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deleteCategory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-categories'] })
      queryClient.invalidateQueries({ queryKey: ['products'] })
    },
  })
}
