// src/hooks/inventory/use-stock-movements.ts
import { useQuery } from '@tanstack/react-query'

export type StockMovementType = 'PURCHASE' | 'SALE' | 'APPOINTMENT_USE' | 'ADJUSTMENT'

export type StockMovement = {
  id: string
  productId: string
  type: StockMovementType
  quantity: number
  unitPrice: string | null
  totalAmount: string | null
  notes: string | null
  createdAt: string
  product: { id: string; name: string }
}

export type StockMovementsResponse = {
  data: StockMovement[]
  total: number
  page: number
  pageSize: number
}

type ListMovementsParams = {
  type?: StockMovementType
  productId?: string
  from?: string
  to?: string
  page?: number
  pageSize?: number
}

async function listMovements(params: ListMovementsParams): Promise<StockMovementsResponse> {
  const url = new URL('/api/products/movements', window.location.origin)
  if (params.type) url.searchParams.set('type', params.type)
  if (params.productId) url.searchParams.set('productId', params.productId)
  if (params.from) url.searchParams.set('from', params.from)
  if (params.to) url.searchParams.set('to', params.to)
  if (params.page) url.searchParams.set('page', String(params.page))
  if (params.pageSize) url.searchParams.set('pageSize', String(params.pageSize))
  const res = await fetch(url)
  if (!res.ok) throw new Error('Falha ao buscar movimentações de estoque')
  return res.json()
}

export function useStockMovements(params: ListMovementsParams = {}) {
  return useQuery({
    queryKey: ['stock-movements', params],
    queryFn: () => listMovements(params),
    staleTime: 30 * 1000,
  })
}
