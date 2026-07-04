'use client'

import type { PublicPackage, PublicPromotion, PublicService } from '@/app/(public)/agendar/[slug]/types'
import {
  ServicePickerWithCategories,
  type PickerService,
  type PickerPackage,
  type PickerPromotion,
  type PickerSelection,
} from '@/components/domain/services/service-picker-with-categories'

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
    imageCropX: s.imageCropX,
    imageCropY: s.imageCropY,
    imageCropZoom: s.imageCropZoom,
    categoryId: s.categoryId,
    categoryName: s.categoryName,
  }
}

function toPickerPackage(p: PublicPackage): PickerPackage {
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    price: p.price,
    imageUrl: p.imageUrl ?? null,
    imageCropX: p.imageCropX ?? null,
    imageCropY: p.imageCropY ?? null,
    imageCropZoom: p.imageCropZoom ?? null,
    items: p.services.map((s) => ({
      service: { id: s.id, name: s.name, duration: s.duration },
    })),
  }
}

function toPickerPromotion(p: PublicPromotion): PickerPromotion {
  return {
    id: p.id,
    name: p.name,
    description: p.description ?? null,
    discountType: p.discountType,
    discountValue: p.discountValue,
    imageUrl: p.imageUrl ?? null,
    imageCropX: p.imageCropX ?? null,
    imageCropY: p.imageCropY ?? null,
    imageCropZoom: p.imageCropZoom ?? null,
    items: p.services.map((s) => ({
      serviceId: s.id,
      service: { id: s.id, name: s.name, price: String(s.originalPrice), duration: s.duration },
    })),
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

  function handleSelect(selection: PickerSelection) {
    if (selection.type === 'service') {
      const original = services.find((s) => s.id === selection.item.id)
      if (original) onSelect(original)
    } else if (selection.type === 'package') {
      const original = packages?.find((p) => p.id === selection.item.id)
      if (original) onPackageSelect?.(original)
    } else if (selection.type === 'promotion') {
      const promo = promotions?.find((p) => p.id === selection.promotionId)
      if (!promo) return
      const svc = promo.services.find((s) => s.id === selection.service.id)
      if (!svc) return
      const discountedPrice = promo.discountType === 'PERCENTAGE'
        ? svc.originalPrice * (1 - promo.discountValue / 100)
        : Math.max(0, svc.originalPrice - promo.discountValue)
      onPromotionServiceSelect?.(promo.id, {
        id: svc.id,
        name: svc.name,
        duration: svc.duration,
        discountedPrice,
      })
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Escolha o serviço</h2>
        <p className="text-sm text-slate-500 mt-1">Selecione o serviço que deseja agendar</p>
      </div>
      <ServicePickerWithCategories
        services={services.map(toPickerService)}
        packages={packages?.map(toPickerPackage)}
        promotions={promotions?.map(toPickerPromotion)}
        categories={categories}
        onSelect={handleSelect}
      />
    </div>
  )
}
