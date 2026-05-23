// src/hooks/scheduling/use-services.ts
import { useQuery } from '@tanstack/react-query'

export type Service = {
  id: string
  name: string
  duration: number
  price: string
  active: boolean
}

async function listServices(): Promise<Service[]> {
  const res = await fetch('/api/scheduling/services')
  if (!res.ok) throw new Error('Falha ao carregar servicos')
  return res.json()
}

export function useServices() {
  return useQuery({
    queryKey: ['services'],
    queryFn: listServices,
    staleTime: 5 * 60 * 1000,
  })
}
