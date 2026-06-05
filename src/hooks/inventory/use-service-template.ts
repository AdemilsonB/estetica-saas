// src/hooks/inventory/use-service-template.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

export type ServiceTemplateProduct = {
  productId: string
  quantity: number
  product: { id: string; name: string }
}

export type ServiceTemplateInput = {
  products: Array<{ productId: string; quantity: number }>
}

async function getServiceTemplate(serviceId: string): Promise<ServiceTemplateProduct[]> {
  const res = await fetch(`/api/scheduling/services/${serviceId}/products`)
  if (!res.ok) throw new Error('Falha ao buscar template de serviço')
  return res.json()
}

async function saveServiceTemplate(
  serviceId: string,
  input: ServiceTemplateInput,
): Promise<ServiceTemplateProduct[]> {
  const res = await fetch(`/api/scheduling/services/${serviceId}/products`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { message?: string }).message ?? 'Falha ao salvar template de serviço')
  }
  return res.json()
}

export function useServiceTemplate(serviceId?: string) {
  return useQuery({
    queryKey: ['service-template', serviceId],
    queryFn: () => getServiceTemplate(serviceId!),
    enabled: !!serviceId,
    staleTime: 5 * 60 * 1000,
  })
}

export function useSaveServiceTemplate(serviceId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: ServiceTemplateInput) => saveServiceTemplate(serviceId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['service-template', serviceId] })
    },
  })
}
