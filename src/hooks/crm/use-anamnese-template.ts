import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { FieldDef } from '@/domains/crm/types'

export type AnamneseTemplate = {
  id: string
  tenantId: string
  fields: FieldDef[]
  linkMessage: string | null
  updatedAt: string
}

async function fetchTemplate(): Promise<AnamneseTemplate> {
  const res = await fetch('/api/crm/anamnese/template')
  if (!res.ok) throw new Error('Falha ao carregar template')
  return res.json()
}

async function updateTemplate(input: { fields: FieldDef[]; linkMessage?: string }) {
  const res = await fetch('/api/crm/anamnese/template', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) throw new Error('Falha ao salvar template')
  return res.json()
}

export function useAnamneseTemplate() {
  return useQuery({
    queryKey: ['anamnese-template'],
    queryFn: fetchTemplate,
    staleTime: 5 * 60 * 1000,
  })
}

export function useUpdateAnamneseTemplate() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: updateTemplate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['anamnese-template'] })
    },
  })
}
