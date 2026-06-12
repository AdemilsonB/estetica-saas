// src/components/domain/landing/landing-proof-bar.tsx
import type { LandingMetric } from '@prisma/client'

interface LandingProofBarProps {
  metrics: Pick<LandingMetric, 'id' | 'value' | 'label'>[]
}

export function LandingProofBar({ metrics }: LandingProofBarProps) {
  if (metrics.length === 0) return null

  return (
    <section className="border-y border-violet-100 bg-white px-6 py-8">
      <div className="mx-auto grid max-w-4xl grid-cols-2 gap-6 md:grid-cols-4">
        {metrics.map((metric) => (
          <div key={metric.id} className="text-center">
            <div className="bg-gradient-to-r from-violet-600 to-pink-600 bg-clip-text text-3xl font-extrabold text-transparent">
              {metric.value}
            </div>
            <div className="mt-1 text-xs text-slate-500">{metric.label}</div>
          </div>
        ))}
      </div>
    </section>
  )
}
