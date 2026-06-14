import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { AnamneseBlocks } from '@/domains/crm/anamnese-blocks.types'

type CustomerAnamneseData = {
  id: string
  blocks: AnamneseBlocks
  blockTypes: string[]
  version: number
  updatedAt: string
} | null

export function useCustomerAnamnese(customerId: string) {
  return useQuery<CustomerAnamneseData>({
    queryKey: ['customer-anamnese', customerId],
    queryFn: async () => {
      const res = await fetch(`/api/crm/customers/${customerId}/anamnese`)
      if (!res.ok) return null
      return res.json()
    },
    staleTime: 2 * 60 * 1000,
  })
}

export function useSaveCustomerAnamnese(customerId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { blockType: string; data: unknown }) => {
      const res = await fetch(`/api/crm/customers/${customerId}/anamnese`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
      if (!res.ok) throw new Error('Falha ao salvar anamnese')
      return res.json()
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['customer-anamnese', customerId] }),
  })
}
