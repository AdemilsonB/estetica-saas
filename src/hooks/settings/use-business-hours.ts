import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

export type DayConfig = {
  open: string
  close: string
  active: boolean
}

export type BusinessHours = Record<string, DayConfig>

const DAY_LABELS: Record<string, string> = {
  '1': 'Segunda', '2': 'Terça', '3': 'Quarta',
  '4': 'Quinta', '5': 'Sexta', '6': 'Sábado', '0': 'Domingo',
}

export const DAY_ORDER = ['1', '2', '3', '4', '5', '6', '0']
export { DAY_LABELS }

async function fetchBusinessHours(): Promise<BusinessHours> {
  const res = await fetch('/api/iam/tenant/business-hours')
  if (!res.ok) throw new Error('Falha ao carregar horários')
  return res.json()
}

async function updateBusinessHours(hours: BusinessHours): Promise<BusinessHours> {
  const res = await fetch('/api/iam/tenant/business-hours', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(hours),
  })
  if (!res.ok) throw new Error('Falha ao salvar horários')
  return res.json()
}

export function useBusinessHours() {
  return useQuery({
    queryKey: ['business-hours'],
    queryFn: fetchBusinessHours,
    staleTime: 60 * 1000,
  })
}

export function useUpdateBusinessHours() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: updateBusinessHours,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['business-hours'] }),
  })
}
