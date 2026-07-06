'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Loader2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useUpgradeModal } from '@/stores/upgrade-modal.store'
import { usePublicPlans } from '@/hooks/billing/use-capabilities'
import { useBillingActions } from '@/hooks/billing/use-billing-actions'
import { getCapability } from '@/shared/permissions/capability-registry'

export function UpgradeModal() {
  const { open, context, close } = useUpgradeModal()
  const { data: plans } = usePublicPlans()
  const { startUpgrade, isLoading } = useBillingActions()
  const router = useRouter()

  // Registra interesse ao abrir a partir de um lock de capacidade (fire-and-forget).
  // Não registra no modo limite (402), pois ali não há uma capability específica.
  useEffect(() => {
    if (open && context?.capabilityKey) {
      fetch('/api/billing/capability-interest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ capabilityKey: context.capabilityKey }),
      }).catch(() => {})
    }
  }, [open, context?.capabilityKey])

  const requiredPlan = context?.requiredPlan ?? null
  const requiredPlanLabel = context?.requiredPlanLabel ?? 'um plano superior'
  // Modo capacidade: veio do FeatureLock, com plano exigido conhecido.
  // Modo limite: veio do 402 (PlanLimitError), sem plano exigido — não há CTA de upgrade direto.
  const isLimitMode = !requiredPlan && Boolean(context?.limitType)
  const targetPlan = plans?.find((p) => p.name === requiredPlan) ?? null
  const capabilityLabel = context?.capabilityKey
    ? (getCapability(context.capabilityKey)?.label ?? 'este recurso')
    : 'este recurso'

  function handleSeePlans() {
    close()
    router.push('/configuracoes/planos')
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) close() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          {isLimitMode ? (
            <>
              <DialogTitle>Você atingiu um limite do seu plano</DialogTitle>
              <DialogDescription>
                O plano atual chegou ao limite para este recurso. Veja os planos disponíveis para aumentar sua capacidade.
              </DialogDescription>
            </>
          ) : (
            <>
              <DialogTitle>Desbloqueie {capabilityLabel}</DialogTitle>
              <DialogDescription>
                Disponível no plano <Badge variant="secondary">{requiredPlanLabel}</Badge> ou superior.
              </DialogDescription>
            </>
          )}
        </DialogHeader>

        {!isLimitMode && targetPlan && targetPlan.benefits.length > 0 && (
          <ul className="space-y-1.5 text-sm text-slate-600">
            {targetPlan.benefits.slice(0, 6).map((b) => (
              <li key={b} className="flex items-start gap-2">
                <Check className="mt-0.5 size-4 shrink-0 text-green-500" />
                {b}
              </li>
            ))}
          </ul>
        )}

        {!isLimitMode && (
          <p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
            O upgrade é <span className="font-medium text-slate-700">imediato</span> — o recurso libera na hora.
            Você paga apenas a <span className="font-medium text-slate-700">diferença proporcional</span> (proration)
            do período atual; não há cobrança dupla. O plano anterior é substituído automaticamente.
          </p>
        )}

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button variant="outline" onClick={close} disabled={isLoading}>Agora não</Button>
          {isLimitMode ? (
            <Button onClick={handleSeePlans} className="bg-slate-950 text-white hover:bg-slate-800">
              Ver planos
            </Button>
          ) : (
            <Button
              onClick={() => requiredPlan && startUpgrade(requiredPlan)}
              disabled={isLoading || !requiredPlan}
              className="bg-slate-950 text-white hover:bg-slate-800"
            >
              {isLoading ? (<><Loader2 className="mr-2 size-4 animate-spin" />Redirecionando...</>) : `Fazer upgrade para ${requiredPlanLabel}`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
