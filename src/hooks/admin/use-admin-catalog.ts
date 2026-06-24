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

// Tipos de input para mutations (usam number para price, string[] para segments)
export interface CatalogServiceCreateInput {
  slug: string
  name: string
  description?: string
  segments: string[]
  categoryId?: string
  suggestedDuration: number
  suggestedPrice: number
  priceType: 'FIXED' | 'STARTING_FROM'
  order: number
  active?: boolean
  metadata?: Record<string, unknown>
}

export interface CatalogProductCreateInput {
  slug: string
  name: string
  description?: string
  segments: string[]
  categoryId?: string
  suggestedPrice: number
  order: number
  active?: boolean
  metadata?: Record<string, unknown>
}

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

export function useAdminCatalogCategories(includeInactive = false) {
  return useQuery<{ services: CatalogCategory[]; products: CatalogCategory[] }>({
    queryKey: ['admin', 'catalog', 'categories', { includeInactive }],
    queryFn: async () => {
      const res = await fetch(`/api/admin/catalogo/categories?includeInactive=${includeInactive}`)
      if (!res.ok) throw new Error('Erro ao carregar categorias')
      return res.json()
    },
    staleTime: 5 * 60 * 1000,
  })
}

// ---- hooks de mutação — categorias ----

export interface CatalogCategoryCreateInput {
  slug: string
  name: string
  segments: string[]
  order?: number
}

function useCreateCatalogCategory(kind: 'services' | 'products') {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: CatalogCategoryCreateInput) => {
      const res = await fetch(`/api/admin/catalogo/categories/${kind}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error((err as { error?: { message?: string } })?.error?.message ?? 'Erro ao criar categoria')
      }
      return res.json() as Promise<CatalogCategory>
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'catalog', 'categories'] }),
  })
}

function useUpdateCatalogCategory(kind: 'services' | 'products') {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<CatalogCategoryCreateInput> & { id: string; active?: boolean }) => {
      const res = await fetch(`/api/admin/catalogo/categories/${kind}/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error((err as { error?: { message?: string } })?.error?.message ?? 'Erro ao atualizar categoria')
      }
      return res.json() as Promise<CatalogCategory>
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'catalog', 'categories'] }),
  })
}

function useDeactivateCatalogCategory(kind: 'services' | 'products') {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/catalogo/categories/${kind}/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Erro ao desativar categoria')
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'catalog', 'categories'] }),
  })
}

export const useCreateCatalogServiceCategory = () => useCreateCatalogCategory('services')
export const useUpdateCatalogServiceCategory = () => useUpdateCatalogCategory('services')
export const useDeactivateCatalogServiceCategory = () => useDeactivateCatalogCategory('services')

export const useCreateCatalogProductCategory = () => useCreateCatalogCategory('products')
export const useUpdateCatalogProductCategory = () => useUpdateCatalogCategory('products')
export const useDeactivateCatalogProductCategory = () => useDeactivateCatalogCategory('products')

// ---- hooks de mutação — serviços ----

export function useCreateCatalogService() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: CatalogServiceCreateInput) => {
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
    mutationFn: async ({ id, ...data }: Partial<CatalogServiceCreateInput> & { id: string }) => {
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
    mutationFn: async (data: CatalogProductCreateInput) => {
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
    mutationFn: async ({ id, ...data }: Partial<CatalogProductCreateInput> & { id: string }) => {
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
