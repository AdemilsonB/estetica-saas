import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

export type PromoItemService = { id: string; name: string; price: string }
export type PromoItemPackage = { id: string; name: string; price: string }

export type PromotionItem = {
  id: string
  serviceId: string | null
  packageId: string | null
  service: PromoItemService | null
  package: PromoItemPackage | null
}

export type Promotion = {
  id: string
  name: string
  description: string | null
  discountType: 'PERCENTAGE' | 'FIXED'
  discountValue: string
  startsAt: string | null
  endsAt: string | null
  active: boolean
  imageUrl: string | null
  expired: boolean
  items: PromotionItem[]
}

export type PromoItemInput = {
  serviceId?: string
  packageId?: string
}

export type CreatePromotionInput = {
  name: string
  description?: string
  discountType: 'PERCENTAGE' | 'FIXED'
  discountValue: string
  startsAt?: string
  endsAt?: string
  imageUrl?: string
  items: PromoItemInput[]
}

export type UpdatePromotionInput = {
  name?: string
  description?: string
  discountType?: 'PERCENTAGE' | 'FIXED'
  discountValue?: string
  startsAt?: string | null
  endsAt?: string | null
  active?: boolean
  imageUrl?: string | null
  items?: PromoItemInput[]
}

async function listPromotions(): Promise<Promotion[]> {
  const res = await fetch('/api/scheduling/promotions')
  if (!res.ok) throw new Error('Falha ao carregar promoções')
  return res.json()
}

async function createPromotion(input: CreatePromotionInput): Promise<Promotion> {
  const res = await fetch('/api/scheduling/promotions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...input, discountValue: parseFloat(input.discountValue) }),
  })
  if (!res.ok) throw new Error('Falha ao criar promoção')
  return res.json()
}

async function updatePromotion({ id, ...input }: UpdatePromotionInput & { id: string }): Promise<Promotion> {
  const res = await fetch(`/api/scheduling/promotions/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...input,
      discountValue: input.discountValue !== undefined ? parseFloat(input.discountValue) : undefined,
    }),
  })
  if (!res.ok) throw new Error('Falha ao atualizar promoção')
  return res.json()
}

async function deactivatePromotion(id: string): Promise<void> {
  const res = await fetch(`/api/scheduling/promotions/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Falha ao desativar promoção')
}

export function usePromotions() {
  return useQuery({ queryKey: ['promotions'], queryFn: listPromotions, staleTime: 5 * 60 * 1000 })
}

export function useCreatePromotion() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createPromotion,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['promotions'] }),
  })
}

export function useUpdatePromotion() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: updatePromotion,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['promotions'] }),
  })
}

export function useDeactivatePromotion() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deactivatePromotion,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['promotions'] }),
  })
}
