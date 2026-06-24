import Image from 'next/image'
import type { LandingTestimonial } from '@prisma/client'

interface LandingTestimonialsProps {
  testimonials: Pick<LandingTestimonial, 'id' | 'authorName' | 'authorRole' | 'quote' | 'rating' | 'avatarUrl'>[]
}

export function LandingTestimonials({ testimonials }: LandingTestimonialsProps) {
  if (testimonials.length === 0) return null

  return (
    <section id="depoimentos" className="bg-white px-6 py-20">
      <div className="mx-auto max-w-5xl">
        <div className="mb-14 text-center">
          <h2 className="text-3xl font-extrabold text-slate-900 md:text-4xl">
            Quem já usa, não volta atrás
          </h2>
          <p className="mt-3 text-lg text-slate-500">Resultados reais de donas de salão como você</p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {testimonials.map((t) => (
            <div key={t.id} className="rounded-2xl border border-violet-100 bg-violet-50/50 p-6">
              {/* Estrelas */}
              <div className="mb-3 flex gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <span key={i} className={i < t.rating ? 'text-amber-400' : 'text-slate-200'}>
                    ★
                  </span>
                ))}
              </div>

              {/* Citação */}
              <p className="mb-5 italic leading-relaxed text-slate-600 whitespace-pre-line">"{t.quote}"</p>

              {/* Autor */}
              <div className="flex items-center gap-3">
                {t.avatarUrl ? (
                  <Image
                    src={t.avatarUrl}
                    alt={t.authorName}
                    width={40}
                    height={40}
                    className="h-10 w-10 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-pink-600 text-sm font-bold text-white">
                    {t.authorName.charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <div className="text-sm font-bold text-slate-900">{t.authorName}</div>
                  <div className="text-xs text-slate-400">{t.authorRole}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
