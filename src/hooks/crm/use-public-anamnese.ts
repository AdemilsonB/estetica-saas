import { useQuery, useMutation } from '@tanstack/react-query'
import type { FieldDef } from '@/domains/crm/types'

export type PublicAnamneseData = {
  fields: FieldDef[]
  data: Record<string, string | string[] | boolean | null>
  filledAt: string | null
  customerName: string
}

async function fetchPublicAnamnese(token: string): Promise<PublicAnamneseData> {
  const res = await fetch(`/api/anamnese/${token}`)
  if (!res.ok) throw new Error('Link inválido')
  return res.json()
}

async function submitPublicAnamnese(
  token: string,
  data: Record<string, string | string[] | boolean | null>,
) {
  const res = await fetch(`/api/anamnese/${token}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data }),
  })
  if (!res.ok) throw new Error('Falha ao enviar ficha')
  return res.json()
}

export function usePublicAnamnese(token: string) {
  return useQuery({
    queryKey: ['public-anamnese', token],
    queryFn: () => fetchPublicAnamnese(token),
    retry: false,
  })
}

export function useSubmitPublicAnamnese(token: string) {
  return useMutation({
    mutationFn: (data: Record<string, string | string[] | boolean | null>) =>
      submitPublicAnamnese(token, data),
  })
}
