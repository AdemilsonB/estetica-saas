'use client'

import { useState } from 'react'

type PublicService = {
  id: string; name: string; duration: number; price: number
  priceType: 'FIXED' | 'STARTING_FROM' | 'RANGE' | 'ON_CONSULTATION'
  priceMin?: number | null; priceMax?: number | null; imageUrl?: string | null; categoryName?: string | null
}
type PublicPackage = {
  id: string; name: string; price: number; imageUrl?: string | null
  services: { name: string }[]
}
type PublicPromotion = {
  id: string; name: string; discountType: 'PERCENTAGE' | 'FIXED'; discountValue: number
  imageUrl?: string | null; endsAt?: string | null
  services: { name: string }[]
}
type PublicProduct = { id: string; name: string; salePrice: number; imageUrl?: string | null; categoryName?: string | null }

type Props = {
  services: PublicService[]
  packages: PublicPackage[]
  promotions: PublicPromotion[]
  products: PublicProduct[]
  bookingBaseUrl: string
  primaryColor: string
}

function formatPrice(s: PublicService): string {
  if (s.priceType === 'ON_CONSULTATION') return 'Sob consulta'
  if (s.priceType === 'RANGE' && s.priceMin != null && s.priceMax != null)
    return `R$ ${s.priceMin.toFixed(2)} – R$ ${s.priceMax.toFixed(2)}`
  if (s.priceType === 'STARTING_FROM') return `A partir de R$ ${s.price.toFixed(2)}`
  return `R$ ${s.price.toFixed(2)}`
}

type Tab = 'services' | 'packages' | 'promotions' | 'products'

export function VitrineTabs({ services, packages, promotions, products, bookingBaseUrl, primaryColor }: Props) {
  const allTabs: { key: Tab; label: string; count: number }[] = [
    { key: 'services' as Tab, label: 'Serviços', count: services.length },
    { key: 'packages' as Tab, label: 'Pacotes', count: packages.length },
    { key: 'promotions' as Tab, label: 'Promoções', count: promotions.length },
    { key: 'products' as Tab, label: 'Produtos', count: products.length },
  ]
  const tabs = allTabs.filter((t) => t.count > 0)

  const [active, setActive] = useState<Tab>(tabs[0]?.key ?? 'services')

  if (tabs.length === 0) return null

  return (
    <section className="mx-auto max-w-3xl px-4 pb-24">
      {/* Tab list */}
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActive(t.key)}
            className="shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors"
            style={
              active === t.key
                ? { backgroundColor: primaryColor, color: '#fff' }
                : { backgroundColor: 'transparent', border: '1px solid #d1d5db' }
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Services */}
      {active === 'services' && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {services.map((s) => (
            <div key={s.id} className="rounded-2xl border bg-card overflow-hidden flex flex-col">
              <div className="h-28 bg-muted flex items-center justify-center overflow-hidden">
                {s.imageUrl
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={s.imageUrl} alt={s.name} loading="lazy" decoding="async" className="h-full w-full object-cover" />
                  : <span className="text-3xl">✂️</span>}
              </div>
              <div className="flex flex-1 flex-col gap-1 p-3">
                <p className="text-sm font-medium leading-tight">{s.name}</p>
                <p className="text-xs text-muted-foreground">{formatPrice(s)} · {s.duration}min</p>
                <a
                  href={`${bookingBaseUrl}?serviceId=${s.id}`}
                  className="mt-auto inline-flex min-h-[44px] items-center justify-center rounded-xl text-sm font-medium text-white"
                  style={{ backgroundColor: primaryColor }}
                >
                  Agendar
                </a>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Packages */}
      {active === 'packages' && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {packages.map((p) => (
            <div key={p.id} className="rounded-2xl border bg-card overflow-hidden flex flex-col">
              <div className="h-28 bg-muted flex items-center justify-center overflow-hidden">
                {p.imageUrl
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={p.imageUrl} alt={p.name} loading="lazy" decoding="async" className="h-full w-full object-cover" />
                  : <span className="text-3xl">📦</span>}
              </div>
              <div className="flex flex-1 flex-col gap-1 p-3">
                <p className="text-sm font-medium leading-tight">{p.name}</p>
                <p className="text-xs text-muted-foreground">R$ {p.price.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {p.services.map((s) => s.name).join(', ')}
                </p>
                <a
                  href={`${bookingBaseUrl}?packageId=${p.id}`}
                  className="mt-auto inline-flex min-h-[44px] items-center justify-center rounded-xl text-sm font-medium text-white"
                  style={{ backgroundColor: primaryColor }}
                >
                  Agendar
                </a>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Promotions */}
      {active === 'promotions' && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {promotions.map((promo) => (
            <div key={promo.id} className="rounded-2xl border bg-card overflow-hidden flex flex-col">
              <div className="h-28 bg-muted flex items-center justify-center overflow-hidden">
                {promo.imageUrl
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={promo.imageUrl} alt={promo.name} loading="lazy" decoding="async" className="h-full w-full object-cover" />
                  : <span className="text-3xl">🎉</span>}
              </div>
              <div className="flex flex-1 flex-col gap-1 p-3">
                <p className="text-sm font-medium leading-tight">{promo.name}</p>
                <p className="text-xs font-semibold" style={{ color: primaryColor }}>
                  {promo.discountType === 'PERCENTAGE'
                    ? `${promo.discountValue}% OFF`
                    : `R$ ${promo.discountValue.toFixed(2)} OFF`}
                </p>
                {promo.endsAt && (
                  <p className="text-xs text-muted-foreground">
                    Até {new Date(promo.endsAt).toLocaleDateString('pt-BR')}
                  </p>
                )}
                <a
                  href={bookingBaseUrl}
                  className="mt-auto inline-flex min-h-[44px] items-center justify-center rounded-xl text-sm font-medium text-white"
                  style={{ backgroundColor: primaryColor }}
                >
                  Agendar
                </a>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Products (sem botão de agendar) */}
      {active === 'products' && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {products.map((p) => (
            <div key={p.id} className="rounded-2xl border bg-card overflow-hidden">
              <div className="h-28 bg-muted flex items-center justify-center overflow-hidden">
                {p.imageUrl
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={p.imageUrl} alt={p.name} loading="lazy" decoding="async" className="h-full w-full object-cover" />
                  : <span className="text-3xl">🧴</span>}
              </div>
              <div className="p-3">
                <p className="text-sm font-medium leading-tight">{p.name}</p>
                <p className="text-xs text-muted-foreground">R$ {p.salePrice.toFixed(2)}</p>
                {p.categoryName && (
                  <p className="text-xs text-muted-foreground">{p.categoryName}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
