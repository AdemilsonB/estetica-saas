import { useQuery } from '@tanstack/react-query'

export type BusinessHoursDay = { open: string; close: string; active: boolean }
export type BusinessHours = Record<string, BusinessHoursDay>

type BusinessHoursResponse = {
  businessHours: BusinessHours
  slotIntervalMinutes: number
}

async function fetchBusinessHours(): Promise<BusinessHoursResponse> {
  const res = await fetch('/api/scheduling/business-hours')
  if (!res.ok) throw new Error('Falha ao carregar horário de expediente')
  return res.json()
}

export function useBusinessHours() {
  return useQuery({
    queryKey: ['scheduling', 'business-hours'],
    queryFn: fetchBusinessHours,
    staleTime: 5 * 60 * 1000,
  })
}
