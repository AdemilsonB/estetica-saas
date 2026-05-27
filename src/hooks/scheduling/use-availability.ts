import { useQuery } from '@tanstack/react-query'

export type TimeSlot = {
  time: string
  available: boolean
}

async function fetchSlots(
  professionalId: string,
  date: string,
  serviceId: string,
): Promise<TimeSlot[]> {
  const url = new URL('/api/scheduling/availability', window.location.origin)
  url.searchParams.set('professionalId', professionalId)
  url.searchParams.set('date', date)
  url.searchParams.set('serviceId', serviceId)
  const res = await fetch(url)
  if (!res.ok) throw new Error('Falha ao carregar horários')
  const data: { slots: TimeSlot[] } = await res.json()
  return data.slots
}

export function useAvailableSlots(
  professionalId: string | null,
  date: string | null,
  serviceId: string | null,
) {
  return useQuery({
    queryKey: ['availability', professionalId, date, serviceId],
    queryFn: () => fetchSlots(professionalId!, date!, serviceId!),
    enabled: !!(professionalId && date && serviceId),
    staleTime: 30 * 1000,
  })
}
