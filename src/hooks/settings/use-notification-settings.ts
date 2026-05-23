import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

export type NotificationSettings = {
  zApiInstanceId: string | null
  zApiToken: string | null
  whatsappEnabled: boolean
}

export type UpdateNotificationSettingsInput = {
  zApiInstanceId?: string | null
  zApiToken?: string | null
  whatsappEnabled?: boolean
}

async function fetchSettings(): Promise<NotificationSettings> {
  const res = await fetch('/api/notifications/settings')
  if (!res.ok) throw new Error('Falha ao carregar configuracoes de notificacao')
  return res.json()
}

async function updateSettings(input: UpdateNotificationSettingsInput): Promise<NotificationSettings> {
  const res = await fetch('/api/notifications/settings', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) throw new Error('Falha ao salvar configuracoes de notificacao')
  return res.json()
}

export function useNotificationSettings() {
  return useQuery({
    queryKey: ['notification-settings'],
    queryFn: fetchSettings,
    staleTime: 60 * 1000,
  })
}

export function useUpdateNotificationSettings() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: updateSettings,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notification-settings'] }),
  })
}
