import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

export type CustomerAnamnese = {
  id: string
  customerId: string
  data: Record<string, string | string[] | boolean | null>
  publicToken: string
  filledAt: string | null
  filledBy: string | null
  history: { data: Record<string, unknown>; savedAt: string; savedBy: string }[]
}

async function fetchAnamnese(customerId: string): Promise<CustomerAnamnese | null> {
  const res = await fetch(`/api/crm/customers/${customerId}/anamnese`)
  if (!res.ok) throw new Error('Falha ao carregar anamnese')
  return res.json()
}

async function saveAnamnese(
  customerId: string,
  data: Record<string, string | string[] | boolean | null>,
) {
  const res = await fetch(`/api/crm/customers/${customerId}/anamnese`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data }),
  })
  if (!res.ok) throw new Error('Falha ao salvar anamnese')
  return res.json()
}

export function useCustomerAnamnese(customerId: string) {
  return useQuery({
    queryKey: ['customer-anamnese', customerId],
    queryFn: () => fetchAnamnese(customerId),
    staleTime: 30 * 1000,
  })
}

export function useSaveAnamnese(customerId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: Record<string, string | string[] | boolean | null>) =>
      saveAnamnese(customerId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-anamnese', customerId] })
    },
  })
}
