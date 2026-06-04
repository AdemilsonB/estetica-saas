import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

type PlatformSettings = {
  id: string
  requireEmailVerification: boolean
  updatedAt: string
}

async function fetchSettings(): Promise<PlatformSettings> {
  const res = await fetch('/api/admin/settings')
  if (!res.ok) throw new Error('Erro ao carregar configurações')
  return res.json()
}

export function usePlatformSettings() {
  return useQuery({ queryKey: ['platform-settings'], queryFn: fetchSettings })
}

export function useUpdatePlatformSettings() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: Partial<Omit<PlatformSettings, 'id' | 'updatedAt'>>) => {
      const res = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Erro ao salvar configurações')
      return res.json()
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['platform-settings'] }),
  })
}
