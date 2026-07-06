'use client'

import { Lock } from 'lucide-react'
import type { ReactNode } from 'react'
import { useCapabilities } from '@/hooks/billing/use-capabilities'
import { useUpgradeModal } from '@/stores/upgrade-modal.store'

type FeatureLockProps = {
  capability: string
  mode?: 'overlay' | 'badge'
  children: ReactNode
}

export function FeatureLock({ capability, mode = 'overlay', children }: FeatureLockProps) {
  const { data } = useCapabilities()
  const openUpgrade = useUpgradeModal((s) => s.openUpgrade)

  const cap = data?.[capability]
  // Enquanto carrega ou se a capability não é gateável, não bloqueia.
  if (!cap || cap.allowed) return <>{children}</>

  const label = cap.requiredPlanLabel ?? 'um plano superior'
  const selo = (
    <button
      type="button"
      onClick={() => openUpgrade({ capabilityKey: capability, requiredPlan: cap.requiredPlan, requiredPlanLabel: cap.requiredPlanLabel })}
      className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-3 py-1 text-xs font-medium text-white hover:bg-slate-700"
    >
      <Lock className="size-3" />
      Disponível no plano {label}
    </button>
  )

  if (mode === 'badge') return selo

  return (
    <div className="relative">
      <div className="pointer-events-none select-none blur-sm" aria-hidden>{children}</div>
      <div className="absolute inset-0 flex items-center justify-center">{selo}</div>
    </div>
  )
}
