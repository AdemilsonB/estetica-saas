// src/hooks/inventory/use-products.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

export type ProductCategory = { id: string; name: string }

export type Product = {
  id: string
  name: string
  categoryId: string | null
  category: ProductCategory | null
  costPrice: string
  salePrice: string
  stockQuantity: number
  lowStockAlert: number
  active: boolean
  imageUrl: string | null
}

export type ProductsResponse = {
  data: Product[]
  total: number
  page: number
  pageSize: number
}

export type CreateProductInput = {
  name: string
  categoryId?: string
  costPrice: number
  salePrice: number
  stockQuantity?: number
  lowStockAlert?: number
  imageUrl?: string
}

export type UpdateProductInput = Partial<CreateProductInput>

export type RecordPurchaseInput = {
  quantity: number
  unitPrice: number
  notes?: string
}

export type RecordSaleInput = {
  quantity: number
  unitPrice?: number
  customerId?: string
}

type ListProductsParams = {
  name?: string
  categoryId?: string
  lowStock?: boolean
  page?: number
  pageSize?: number
}

async function listProducts(params: ListProductsParams): Promise<ProductsResponse> {
  const url = new URL('/api/products', window.location.origin)
  if (params.name) url.searchParams.set('name', params.name)
  if (params.categoryId) url.searchParams.set('categoryId', params.categoryId)
  if (params.lowStock) url.searchParams.set('lowStock', 'true')
  if (params.page) url.searchParams.set('page', String(params.page))
  if (params.pageSize) url.searchParams.set('pageSize', String(params.pageSize))
  const res = await fetch(url)
  if (!res.ok) throw new Error('Falha ao buscar produtos')
  return res.json()
}

async function createProduct(input: CreateProductInput): Promise<Product> {
  const res = await fetch('/api/products', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { message?: string }).message ?? 'Falha ao criar produto')
  }
  return res.json()
}

async function updateProduct({
  id,
  ...input
}: UpdateProductInput & { id: string }): Promise<Product> {
  const res = await fetch(`/api/products/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { message?: string }).message ?? 'Falha ao atualizar produto')
  }
  return res.json()
}

async function deleteProduct(id: string): Promise<void> {
  const res = await fetch(`/api/products/${id}`, { method: 'DELETE' })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { message?: string }).message ?? 'Falha ao excluir produto')
  }
}

async function recordPurchase({
  productId,
  ...input
}: RecordPurchaseInput & { productId: string }): Promise<unknown> {
  const res = await fetch(`/api/products/${productId}/purchase`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { message?: string }).message ?? 'Falha ao registrar compra')
  }
  return res.json()
}

async function recordSale({
  productId,
  ...input
}: RecordSaleInput & { productId: string }): Promise<unknown> {
  const res = await fetch(`/api/products/${productId}/sell`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { message?: string }).message ?? 'Falha ao registrar venda')
  }
  return res.json()
}

export function useProducts(params: ListProductsParams = {}) {
  return useQuery({
    queryKey: ['products', params],
    queryFn: () => listProducts(params),
    staleTime: 30 * 1000,
  })
}

export function useCreateProduct() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createProduct,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
    },
  })
}

export function useUpdateProduct() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: updateProduct,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
    },
  })
}

export function useDeleteProduct() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deleteProduct,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
    },
  })
}

export function useRecordPurchase(productId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: RecordPurchaseInput) => recordPurchase({ ...input, productId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['stock-movements'] })
    },
  })
}

export function useRecordSale(productId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: RecordSaleInput) => recordSale({ ...input, productId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['stock-movements'] })
    },
  })
}
