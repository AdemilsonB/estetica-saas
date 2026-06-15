'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { BusinessSegment } from '@prisma/client'

// ---- tipos ----

export interface CatalogCategory {
  id: string
  slug: string
  name: string
  segments: BusinessSegment[]
  order: number
  active: boolean
}

export interface CatalogServiceItem {
  id: string
  slug: string
  name: string
  description: string | null
  segments: BusinessSegment[]
  categoryId: string | null
  category: CatalogCategory | null
  suggestedDuration: number
  suggestedPrice: string // Decimal serializado como string
  priceType: 'FIXED' | 'STARTING_FROM'
  active: boolean
  order: number
  metadata: Record<string, unknown> | null
}

export interface CatalogProductItem {
  id: string
  slug: string
  name: string
  description: string | null
  segments: BusinessSegment[]
  categoryId: string | null
  category: CatalogCategory | null
  suggestedPrice: string
  active: boolean
  order: number
  metadata: Record<string, unknown> | null
}

interface PaginatedResponse<T> { data: T[]; total: number; page: number; pageSize: number }

// ---- helpers ----

function buildParams(filters: Record<string, unknown>) {
  const p = new URLSearchParams()
  for (const [key, val] of Object.entries(filters)) {
    if (val === undefined || val === null || val === '') continue
    if (Array.isArray(val)) val.forEach(v => p.append(key, String(v)))
    else p.set(key, String(val))
  }
  return p.toString()
}

// ---- hooks de listagem ----

export function useAdminCatalogServices(filters: {
  segments?: BusinessSegment[]
  categoryId?: string
  name?: string
  active?: boolean
  page?: number
  pageSize?: number
}) {
  return useQuery<PaginatedResponse<CatalogServiceItem>>({
    queryKey: ['admin', 'catalog', 'services', filters],
    queryFn: async () => {
      const res = await fetch(`/api/admin/catalogo/services?${buildParams(filters)}`)
      if (!res.ok) throw new Error('Erro ao carregar serviços')
      return res.json()
    },
  })
}

export function useAdminCatalogProducts(filters: {
  segments?: BusinessSegment[]
  categoryId?: string
  name?: string
  active?: boolean
  page?: number
  pageSize?: number
}) {
  return useQuery<PaginatedResponse<CatalogProductItem>>({
    queryKey: ['admin', 'catalog', 'products', filters],
    queryFn: async () => {
      const res = await fetch(`/api/admin/catalogo/products?${buildParams(filters)}`)
      if (!res.ok) throw new Error('Erro ao carregar produtos')
      return res.json()
    },
  })
}

export function useAdminCatalogCategories() {
  return useQuery<{ services: CatalogCategory[]; products: CatalogCategory[] }>({
    queryKey: ['admin', 'catalog', 'categories'],
    queryFn: async () => {
      const res = await fetch('/api/admin/catalogo/categories')
      if (!res.ok) throw new Error('Erro ao carregar categorias')
      return res.json()
    },
    staleTime: 5 * 60 * 1000,
  })
}

// ---- hooks de mutação — serviços ----

export function useCreateCatalogService() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: Omit<CatalogServiceItem, 'id' | 'category' | 'createdAt' | 'updatedAt'>) => {
      const res = await fetch('/api/admin/catalogo/services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error((err as { error?: { message?: string } })?.error?.message ?? 'Erro ao criar serviço')
      }
      return res.json() as Promise<CatalogServiceItem>
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'catalog', 'services'] }),
  })
}

export function useUpdateCatalogService() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<CatalogServiceItem> & { id: string }) => {
      const res = await fetch(`/api/admin/catalogo/services/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error((err as { error?: { message?: string } })?.error?.message ?? 'Erro ao atualizar serviço')
      }
      return res.json() as Promise<CatalogServiceItem>
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'catalog', 'services'] }),
  })
}

export function useDeactivateCatalogService() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/catalogo/services/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Erro ao desativar serviço')
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'catalog', 'services'] }),
  })
}

// ---- hooks de mutação — produtos ----

export function useCreateCatalogProduct() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: Omit<CatalogProductItem, 'id' | 'category' | 'createdAt' | 'updatedAt'>) => {
      const res = await fetch('/api/admin/catalogo/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error((err as { error?: { message?: string } })?.error?.message ?? 'Erro ao criar produto')
      }
      return res.json() as Promise<CatalogProductItem>
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'catalog', 'products'] }),
  })
}

export function useUpdateCatalogProduct() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<CatalogProductItem> & { id: string }) => {
      const res = await fetch(`/api/admin/catalogo/products/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error((err as { error?: { message?: string } })?.error?.message ?? 'Erro ao atualizar produto')
      }
      return res.json() as Promise<CatalogProductItem>
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'catalog', 'products'] }),
  })
}

export function useDeactivateCatalogProduct() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/catalogo/products/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Erro ao desativar produto')
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'catalog', 'products'] }),
  })
}
