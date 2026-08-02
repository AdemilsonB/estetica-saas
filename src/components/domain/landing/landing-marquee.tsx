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
    <div className="flex items-center gap-3 whitespace-nowrap rounded-none border-t-[3px] border-[#EDE1D1] bg-[#FBF4EA]/60 px-5 py-3.5">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#B9673C] text-sm font-extrabold text-white">
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
    <section className="overflow-hidden border-y border-[#EDE1D1] bg-white py-8">
      <p className="mb-6 px-6 text-center text-xs font-extrabold uppercase tracking-wide text-[#B9673C]">
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
