import { useMutation } from '@tanstack/react-query'

async function sendLink(customerId: string, message: string) {
  const res = await fetch(`/api/crm/customers/${customerId}/anamnese/send-link`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  })
  if (!res.ok) throw new Error('Falha ao enviar link')
  return res.json()
}

export function useSendAnamneseLink(customerId: string) {
  return useMutation({
    mutationFn: (message: string) => sendLink(customerId, message),
  })
}
