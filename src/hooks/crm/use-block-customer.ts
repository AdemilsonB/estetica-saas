// src/hooks/crm/use-block-customer.ts
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

type BlockInput = {
  customerId: string
  reason?: string
}

type UnblockInput = {
  customerId: string
}

async function blockCustomer({ customerId, reason }: BlockInput) {
  const res = await fetch(`/api/crm/customers/${customerId}/block`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(
      (err as { error?: { message?: string } }).error?.message ?? 'Falha ao bloquear cliente',
    )
  }
  return res.json()
}

async function unblockCustomer({ customerId }: UnblockInput) {
  const res = await fetch(`/api/crm/customers/${customerId}/block`, {
    method: 'DELETE',
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(
      (err as { error?: { message?: string } }).error?.message ?? 'Falha ao desbloquear cliente',
    )
  }
  return res.json()
}

export function useBlockCustomer(customerId: string) {
  const queryClient = useQueryClient()

  const blockMutation = useMutation({
    mutationFn: (input: { reason?: string }) =>
      blockCustomer({ customerId, reason: input.reason }),
    onSuccess: () => {
      toast.success('Cliente bloqueado com sucesso')
      queryClient.invalidateQueries({ queryKey: ['customer', customerId] })
      queryClient.invalidateQueries({ queryKey: ['customers'] })
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })

  const unblockMutation = useMutation({
    mutationFn: () => unblockCustomer({ customerId }),
    onSuccess: () => {
      toast.success('Cliente desbloqueado com sucesso')
      queryClient.invalidateQueries({ queryKey: ['customer', customerId] })
      queryClient.invalidateQueries({ queryKey: ['customers'] })
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })

  return {
    block: blockMutation.mutate,
    unblock: unblockMutation.mutate,
    isBlocking: blockMutation.isPending,
    isUnblocking: unblockMutation.isPending,
  }
}
