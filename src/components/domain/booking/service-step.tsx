'use client'

import type { PublicService } from '@/app/(public)/agendar/[slug]/types'
import { ServicePickerWithCategories, type PickerService } from '@/components/domain/services/service-picker-with-categories'

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

export function ServiceStep({
  services,
  onSelect,
}: {
  services: PublicService[]
  onSelect: (service: PublicService) => void
  primaryColor: string
}) {
  const categories = deriveCategories(services)
  const pickerServices = services.map(toPickerService)

  function handleSelect(picked: PickerService) {
    const original = services.find((s) => s.id === picked.id)
    if (original) onSelect(original)
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Escolha o serviço</h2>
        <p className="text-sm text-slate-500 mt-1">
          Selecione o serviço que deseja agendar
        </p>
      </div>

      <ServicePickerWithCategories
        services={pickerServices}
        categories={categories}
        onSelect={handleSelect}
      />
    </div>
  )
}
