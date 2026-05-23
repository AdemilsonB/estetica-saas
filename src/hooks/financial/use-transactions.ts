// src/hooks/financial/use-transactions.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

export type TransactionType = 'INCOME' | 'EXPENSE'

export type Transaction = {
  id: string
  type: TransactionType
  category: string
  description: string
  amount: string
  paidAt: string | null
  appointmentId: string | null
  createdAt: string
}

export type TransactionsPage = {
  data: Transaction[]
  total: number
  page: number
  pageSize: number
}

export type CreateTransactionInput = {
  appointmentId?: string
  type: TransactionType
  category: string
  description: string
  amount: number
  paidAt?: string
}

type ListParams = {
  from?: string
  to?: string
  type?: TransactionType
  page?: number
  pageSize?: number
}

async function listTransactions(params: ListParams): Promise<TransactionsPage> {
  const url = new URL('/api/financial/transactions', window.location.origin)
  if (params.from) url.searchParams.set('from', params.from)
  if (params.to) url.searchParams.set('to', params.to)
  if (params.type) url.searchParams.set('type', params.type)
  if (params.page) url.searchParams.set('page', String(params.page))
  if (params.pageSize) url.searchParams.set('pageSize', String(params.pageSize))
  const res = await fetch(url)
  if (!res.ok) throw new Error('Falha ao carregar transações')
  return res.json()
}

async function createTransaction(input: CreateTransactionInput): Promise<Transaction> {
  const res = await fetch('/api/financial/transactions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message ?? 'Falha ao registrar transação')
  }
  return res.json()
}

export function useTransactions(params: ListParams = {}) {
  return useQuery({
    queryKey: ['transactions', params],
    queryFn: () => listTransactions(params),
    staleTime: 30 * 1000,
  })
}

export function useCreateTransaction() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createTransaction,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
    },
  })
}
