// src/components/domain/landing/landing-marquee.tsx
import type { LandingTestimonial } from '@prisma/client'

type Salon = Pick<LandingTestimonial, 'id' | 'authorName' | 'authorRole'>

function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
}

function SalonCard({ salon }: { salon: Salon }) {
  return (
    <div className="flex items-center gap-3 whitespace-nowrap rounded-2xl border border-violet-100 bg-violet-50/40 px-5 py-3.5">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-pink-500 text-sm font-extrabold text-white">
        {initials(salon.authorName)}
      </span>
      <div>
        <div className="font-display text-sm font-extrabold text-slate-900">{salon.authorName}</div>
        <div className="text-xs text-slate-500">{salon.authorRole}</div>
      </div>
    </div>
  )
}

export function LandingMarquee({ salons }: { salons: Salon[] }) {
  if (salons.length === 0) return null

  return (
    <section className="overflow-hidden border-y border-violet-100 bg-white py-8">
      <p className="mb-6 px-6 text-center text-xs font-extrabold uppercase tracking-wide text-violet-600">
        Salões, barbearias e clínicas que já vivem no automático
      </p>
      <div
        className="marquee-wrap relative"
        style={{
          maskImage: 'linear-gradient(90deg,transparent,#000 8%,#000 92%,transparent)',
          WebkitMaskImage: 'linear-gradient(90deg,transparent,#000 8%,#000 92%,transparent)',
        }}
      >
        <div className="animate-marquee flex w-max gap-4">
          {[...salons, ...salons].map((salon, i) => (
            <SalonCard key={`${salon.id}-${i}`} salon={salon} />
          ))}
        </div>
      </div>
    </section>
  )
}
