'use client'

import type { PublicPackage, PublicPromotion, PublicService } from '@/app/(public)/agendar/[slug]/types'
import { ServicePickerWithCategories, type PickerService } from '@/components/domain/services/service-picker-with-categories'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

function deriveCategories(services: PublicService[]): Array<{ id: string; name: string }> {
  const seen = new Set<string>()
  const result: Array<{ id: string; name: string }> = []
  for (const s of services) {
    if (s.categoryId && s.categoryName && !seen.has(s.categoryId)) {
      seen.add(s.categoryId)
      result.push({ id: s.categoryId, name: s.categoryName })
    }
  }
  return result
}

function toPickerService(s: PublicService): PickerService {
  return {
    id: s.id,
    name: s.name,
    duration: s.duration,
    price: s.price,
    priceType: s.priceType,
    priceMax: s.priceMax,
    description: s.description,
    imageUrl: s.imageUrl,
    categoryId: s.categoryId,
    categoryName: s.categoryName,
  }
}

export type PromotionServiceSelection = {
  id: string
  name: string
  duration: number
  discountedPrice: number
}

export function ServiceStep({
  services,
  onSelect,
  packages,
  promotions,
  onPackageSelect,
  onPromotionServiceSelect,
}: {
  services: PublicService[]
  onSelect: (service: PublicService) => void
  primaryColor: string
  packages?: PublicPackage[]
  promotions?: PublicPromotion[]
  onPackageSelect?: (pkg: PublicPackage) => void
  onPromotionServiceSelect?: (promotionId: string, service: PromotionServiceSelection) => void
}) {
  const categories = deriveCategories(services)
  const pickerServices = services.map(toPickerService)

  const hasPackages = packages && packages.length > 0
  const hasPromotions = promotions && promotions.length > 0
  const showTabs = hasPackages || hasPromotions

  function handleSelect(picked: PickerService) {
    const original = services.find((s) => s.id === picked.id)
    if (original) onSelect(original)
  }

  const servicesContent = (
    <ServicePickerWithCategories
      services={pickerServices}
      categories={categories}
      onSelect={handleSelect}
    />
  )

  if (!showTabs) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Escolha o serviço</h2>
          <p className="text-sm text-slate-500 mt-1">
            Selecione o serviço que deseja agendar
          </p>
        </div>
        {servicesContent}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Escolha o serviço</h2>
        <p className="text-sm text-slate-500 mt-1">
          Selecione o serviço que deseja agendar
        </p>
      </div>

      <Tabs defaultValue="services">
        <TabsList className="w-full">
          <TabsTrigger value="services" className="flex-1">Serviços</TabsTrigger>
          {hasPackages && (
            <TabsTrigger value="packages" className="flex-1">Pacotes</TabsTrigger>
          )}
          {hasPromotions && (
            <TabsTrigger value="promotions" className="flex-1">Promoções</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="services" className="mt-4">
          {servicesContent}
        </TabsContent>

        {hasPackages && (
          <TabsContent value="packages" className="mt-4 space-y-3">
            {packages.map((pkg) => (
              <button
                key={pkg.id}
                onClick={() => onPackageSelect?.(pkg)}
                className="w-full text-left p-4 rounded-lg border border-slate-200 hover:border-[--booking-primary,#191919] transition-colors bg-white"
              >
                <div className="font-medium text-slate-900">{pkg.name}</div>
                {pkg.description && (
                  <p className="text-sm text-slate-500 mt-0.5">{pkg.description}</p>
                )}
                <div className="text-sm text-slate-600 mt-1">
                  {pkg.services.map((s) => s.name).join(' + ')}
                  {' · '}
                  {pkg.duration} min
                  {' · '}
                  R$ {Number(pkg.price).toFixed(2).replace('.', ',')}
                </div>
              </button>
            ))}
          </TabsContent>
        )}

        {hasPromotions && (
          <TabsContent value="promotions" className="mt-4 space-y-3">
            {promotions.map((promo) => (
              <div key={promo.id} className="p-4 rounded-lg border border-slate-200 bg-white">
                <div className="font-medium text-slate-900">{promo.name}</div>
                {promo.description && (
                  <p className="text-sm text-slate-500 mt-0.5">{promo.description}</p>
                )}
                <div className="text-xs text-slate-400 mt-1">
                  Desconto:{' '}
                  {promo.discountType === 'PERCENTAGE'
                    ? `${promo.discountValue}%`
                    : `R$ ${Number(promo.discountValue).toFixed(2).replace('.', ',')}`}
                </div>
                <div className="mt-2 space-y-2">
                  {promo.services.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => {
                        const discountedPrice =
                          promo.discountType === 'PERCENTAGE'
                            ? s.originalPrice * (1 - promo.discountValue / 100)
                            : Math.max(0, s.originalPrice - promo.discountValue)
                        if (onPromotionServiceSelect) {
                          onPromotionServiceSelect(promo.id, {
                            id: s.id,
                            name: s.name,
                            duration: s.duration,
                            discountedPrice,
                          })
                        } else {
                          onSelect({
                            id: s.id,
                            name: s.name,
                            duration: s.duration,
                            price: discountedPrice,
                            priceType: 'FIXED',
                            anamneseMode: 'NONE',
                            anamneseBlocks: [],
                            anamneseValidityDays: 90,
                          })
                        }
                      }}
                      className="w-full text-left p-2 rounded border border-slate-200 hover:border-[--booking-primary,#191919] transition-colors text-sm"
                    >
                      <span className="font-medium text-slate-900">{s.name}</span>
                      <span className="text-slate-500">
                        {' · '}
                        {s.duration} min
                        {' · '}
                        <span className="line-through text-slate-400">
                          R$ {Number(s.originalPrice).toFixed(2).replace('.', ',')}
                        </span>
                        {' '}
                        <span className="text-green-700 font-medium">
                          R${' '}
                          {(promo.discountType === 'PERCENTAGE'
                            ? s.originalPrice * (1 - promo.discountValue / 100)
                            : Math.max(0, s.originalPrice - promo.discountValue)
                          ).toFixed(2).replace('.', ',')}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}
