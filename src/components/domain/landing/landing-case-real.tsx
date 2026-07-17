// src/components/domain/landing/landing-case-real.tsx
import type { LandingTestimonial } from '@prisma/client'
import { Reveal } from './landing-reveal'

type FeaturedTestimonial = Pick<LandingTestimonial, 'authorName' | 'authorRole' | 'quote'>

export function LandingCaseReal({ testimonial }: { testimonial: FeaturedTestimonial | null }) {
  if (!testimonial) return null

  return (
    <section className="bg-white px-4 py-16 sm:px-6 sm:py-20">
      <Reveal className="mx-auto max-w-3xl">
        <div className="rounded-3xl bg-gradient-to-br from-[#4C1D95] to-[#7C3AED] p-8 text-white shadow-2xl shadow-violet-300/40 sm:p-11">
          <p className="text-xs font-extrabold uppercase tracking-wide text-violet-200">
            Quem já vive no automático
          </p>
          <blockquote className="font-display mt-4 text-[clamp(1.25rem,3.5vw,1.6rem)] font-bold leading-snug">
            “{testimonial.quote}”
          </blockquote>
          <div className="mt-6 border-t border-white/20 pt-5">
            <div className="text-base font-extrabold">{testimonial.authorName}</div>
            <div className="text-sm text-violet-200">{testimonial.authorRole}</div>
          </div>
        </div>
      </Reveal>
    </section>
  )
}
