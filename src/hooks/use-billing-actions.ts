'use client'

import { useState } from 'react'
import { toast } from 'sonner'

export function useBillingActions() {
  const [loadingKey, setLoadingKey] = useState<string | null>(null)
  const [loadingPortal, setLoadingPortal] = useState(false)

  async function startUpgrade(planName: string, skipTrial = false) {
    const key = skipTrial ? `${planName}_direct` : `${planName}_trial`
    setLoadingKey(key)
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planName, skipTrial }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast.error(err?.message ?? 'Erro ao iniciar checkout. Tente novamente.')
        return
      }
      const { checkoutUrl } = await res.json()
      window.location.href = checkoutUrl
    } catch {
      toast.error('Erro de conexão. Tente novamente.')
    } finally {
      setLoadingKey(null)
    }
  }

  async function openPortal() {
    setLoadingPortal(true)
    try {
      const res = await fetch('/api/billing/portal', { method: 'POST' })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast.error(err?.message ?? 'Erro ao abrir portal. Tente novamente.')
        return
      }
      const { portalUrl } = await res.json()
      window.location.href = portalUrl
    } catch {
      toast.error('Erro de conexão. Tente novamente.')
    } finally {
      setLoadingPortal(false)
    }
  }

  return { startUpgrade, openPortal, loadingKey, loadingPortal }
}
