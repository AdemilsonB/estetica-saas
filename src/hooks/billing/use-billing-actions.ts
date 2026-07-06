'use client'

import { useState } from 'react'
import { toast } from 'sonner'

import { apiFetch, ApiError } from '@/shared/http/api-fetch'

type PortalResponse = { portalUrl: string }
type CheckoutResponse = { checkoutUrl: string }

/**
 * Inicia um upgrade: se o tenant já tem assinatura Stripe (com stripeCustomerId),
 * abre o Portal (proration imediata); senão, o Portal responde 400 (NO_STRIPE_CUSTOMER)
 * e cai no fallback de Checkout. Ambos redirecionam o browser.
 */
export function useBillingActions() {
  const [isLoading, setIsLoading] = useState(false)

  async function startUpgrade(planName: string): Promise<void> {
    setIsLoading(true)
    try {
      const origin = window.location.origin

      // 1) Tenta o Portal (tenant já assinante). Não recebe body — o returnUrl
      // é definido no backend (stripe-billing.service.ts). Responde 400
      // (NO_STRIPE_CUSTOMER) quando o tenant ainda não tem cadastro no Stripe.
      try {
        const portalRes = await apiFetch('/api/billing/portal', { method: 'POST' })
        const { portalUrl } = (await portalRes.json()) as PortalResponse
        window.location.href = portalUrl
        return
      } catch (error) {
        if (!(error instanceof ApiError) || error.code !== 'NO_STRIPE_CUSTOMER') {
          throw error
        }
        // Sem cadastro no Stripe: segue para o Checkout.
      }

      // 2) Fallback: Checkout direto do plano exigido.
      const checkoutRes = await apiFetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planName,
          skipTrial: true,
          successUrl: `${origin}/dashboard?stripe=success`,
          cancelUrl: `${origin}/dashboard?stripe=cancelled`,
        }),
      })
      const { checkoutUrl } = (await checkoutRes.json()) as CheckoutResponse
      window.location.href = checkoutUrl
    } catch (error) {
      const message =
        error instanceof ApiError ? error.message : 'Erro de conexão. Tente novamente.'
      toast.error(message)
    } finally {
      setIsLoading(false)
    }
  }

  return { startUpgrade, isLoading }
}
