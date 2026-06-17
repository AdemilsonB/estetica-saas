'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Flame, Timer } from 'lucide-react'

type PromoService = {
  id: string
  name: string
  duration: number
  originalPrice: number
}

type PublicPromotion = {
  id: string
  name: string
  description?: string | null
  imageUrl?: string | null
  discountType: 'PERCENTAGE' | 'FIXED'
  discountValue: number
  endsAt?: string | null
  services: PromoService[]
}

type Props = {
  promotions: PublicPromotion[]
  bookingBaseUrl: string
  primaryColor: string
}

function calcFinalPrice(original: number, type: 'PERCENTAGE' | 'FIXED', value: number): number {
  if (type === 'PERCENTAGE') return Math.max(0, original * (1 - value / 100))
  return Math.max(0, original - value)
}

function Countdown({ endsAt }: { endsAt: string }) {
  const [remaining, setRemaining] = useState('')

  useEffect(() => {
    function update() {
      const diff = new Date(endsAt).getTime() - Date.now()
      if (diff <= 0) { setRemaining('Encerrada'); return }
      const d = Math.floor(diff / 86400000)
      const h = Math.floor((diff % 86400000) / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      const s = Math.floor((diff % 60000) / 1000)
      if (d > 0) setRemaining(`${d}d ${h}h`)
      else setRemaining(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`)
    }
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [endsAt])

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-semibold text-orange-700">
      <Timer className="size-3" />
      {remaining}
    </span>
  )
}

export function VitrinePromotionsSection({ promotions, bookingBaseUrl, primaryColor }: Props) {
  if (promotions.length === 0) return null

  return (
    <section id="promocoes" className="mx-auto max-w-3xl px-4 pt-8">
      <h2 className="mb-5 flex items-center gap-2 text-lg font-bold">
        <Flame className="size-5 text-orange-500" />
        Promoções
      </h2>
      <div className="space-y-3">
        {promotions.map((promo) => (
          <div key={promo.id} className="rounded-2xl border bg-card overflow-hidden">
            <div className="flex gap-3 p-3">
              {/* Thumbnail */}
              <div className="size-[72px] shrink-0 overflow-hidden rounded-xl bg-muted flex items-center justify-center">
                {promo.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={promo.imageUrl} alt={promo.name} className="h-full w-full object-cover" />
                ) : (
                  <span className="text-2xl">🎉</span>
                )}
              </div>

              {/* Conteúdo */}
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex items-start justify-between gap-1">
                  <p className="text-sm font-semibold leading-snug">{promo.name}</p>
                  <span
                    className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold text-white"
                    style={{ backgroundColor: primaryColor }}
                  >
                    {promo.discountType === 'PERCENTAGE'
                      ? `${promo.discountValue}% OFF`
                      : `R$ ${promo.discountValue.toFixed(2)} OFF`}
                  </span>
                </div>

                {promo.description && (
                  <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                    {promo.description}
                  </p>
                )}

                {/* Serviços com preço original vs final */}
                {promo.services.length > 0 && (
                  <div className="mt-1 space-y-0.5">
                    {promo.services.slice(0, 3).map((s) => {
                      const final = calcFinalPrice(s.originalPrice, promo.discountType, promo.discountValue)
                      return (
                        <p key={s.id} className="text-xs text-muted-foreground">
                          {s.name}:{' '}
                          <span className="line-through">R$ {s.originalPrice.toFixed(2)}</span>
                          {' → '}
                          <span className="font-semibold" style={{ color: primaryColor }}>
                            R$ {final.toFixed(2)}
                          </span>
                        </p>
                      )
                    })}
                  </div>
                )}

                <div className="mt-1.5 flex items-center justify-between gap-2">
                  {promo.endsAt && <Countdown endsAt={promo.endsAt} />}
                  {!promo.endsAt && (
                    <span className="text-[10px] text-muted-foreground">Tempo limitado</span>
                  )}
                  <Link
                    href={bookingBaseUrl}
                    className="inline-flex h-8 items-center justify-center rounded-xl px-4 text-xs font-semibold text-white"
                    style={{ backgroundColor: primaryColor }}
                  >
                    Aproveitar
                  </Link>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
