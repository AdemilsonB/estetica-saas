import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

export type AutomationsConfig = {
  reminderLeadHours:      number
  autoReplyEnabled:       boolean
  autoReplyIntervalHours: number
  autoReplyMessage:       string | null
  offHoursEnabled:        boolean
  offHoursMessage:        string | null
  dailyStatusEnabled:     boolean
  dailyStatusHour:        number
  birthdayEnabled:        boolean
  birthdayMessage:        string | null
  birthdayGiftServiceId:  string | null
}

async function fetchAutomations(): Promise<AutomationsConfig> {
  const res = await fetch('/api/settings/automations')
  if (!res.ok) throw new Error('Falha ao carregar automações')
  return res.json()
}

async function updateAutomations(input: Partial<AutomationsConfig>): Promise<AutomationsConfig> {
  const res = await fetch('/api/settings/automations', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) throw new Error('Falha ao salvar automações')
  return res.json()
}

export function useAutomations() {
  return useQuery({
    queryKey: ['automations'],
    queryFn: fetchAutomations,
    staleTime: 60_000,
  })
}

export function useUpdateAutomations() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: updateAutomations,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['automations'] }),
  })
}
