import { useQuery } from '@tanstack/react-query'

export type TimeSlot = {
  time: string
  available: boolean
  bookedBy?: string
}

async function fetchSlots(
  professionalId: string,
  date: string,
  serviceId: string | null,
  packageId: string | null,
): Promise<TimeSlot[]> {
  const url = new URL('/api/scheduling/availability', window.location.origin)
  url.searchParams.set('professionalId', professionalId)
  url.searchParams.set('date', date)
  if (serviceId) url.searchParams.set('serviceId', serviceId)
  if (packageId) url.searchParams.set('packageId', packageId)
  const res = await fetch(url)
  if (!res.ok) throw new Error('Falha ao carregar horários')
  const data: { slots: TimeSlot[] } = await res.json()
  return data.slots
}

export function useAvailableSlots(
  professionalId: string | null,
  date: string | null,
  serviceId: string | null,
  packageId?: string | null,
) {
  return useQuery({
    queryKey: ['availability', professionalId, date, serviceId, packageId ?? null],
    queryFn: () => fetchSlots(professionalId!, date!, serviceId, packageId ?? null),
    enabled: !!(professionalId && date && (serviceId || packageId)),
    staleTime: 30 * 1000,
  })
}
