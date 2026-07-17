// src/components/domain/landing/landing-proof-bar.tsx
'use client'

import { useRef } from 'react'
import { useInView } from 'framer-motion'
import type { LandingMetric } from '@prisma/client'
import { useCountUp } from './use-count-up'

interface LandingProofBarProps {
  metrics: Pick<LandingMetric, 'id' | 'value' | 'label'>[]
}

function MetricItem({ value, label, active }: { value: string; label: string; active: boolean }) {
  const display = useCountUp(value, active)
  return (
    <div className="text-center">
      <div className="font-display bg-gradient-to-r from-violet-600 to-pink-600 bg-clip-text text-3xl font-extrabold text-transparent sm:text-4xl">
        {display}
      </div>
      <div className="mt-1 text-xs text-slate-500 sm:text-sm">{label}</div>
    </div>
  )
}

export function LandingProofBar({ metrics }: LandingProofBarProps) {
  const ref = useRef<HTMLElement>(null)
  const inView = useInView(ref, { once: true, amount: 0.6 })

  if (metrics.length === 0) return null

  return (
    <section ref={ref} className="border-y border-violet-100 bg-white px-6 py-8 sm:py-10">
      <div className="mx-auto grid max-w-4xl grid-cols-2 gap-6 md:grid-cols-4">
        {metrics.map((metric) => (
          <MetricItem key={metric.id} value={metric.value} label={metric.label} active={inView} />
        ))}
      </div>
    </section>
  )
}
