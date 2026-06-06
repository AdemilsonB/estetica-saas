'use client'

import type { PublicService } from '@/app/(public)/agendar/[slug]/types'
import { Clock } from 'lucide-react'

function formatPrice(service: PublicService): string {
  if (service.priceType === 'ON_CONSULTATION') return 'Sob consulta'
  if (
    service.priceType === 'RANGE' &&
    service.priceMin != null &&
    service.priceMax != null
  ) {
    return `R$ ${Number(service.priceMin).toFixed(2).replace('.', ',')} – R$ ${Number(service.priceMax).toFixed(2).replace('.', ',')}`
  }
  return `R$ ${Number(service.price).toFixed(2).replace('.', ',')}`
}

export function ServiceStep({
  services,
  onSelect,
  primaryColor,
}: {
  services: PublicService[]
  onSelect: (service: PublicService) => void
  primaryColor: string
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Escolha o serviço</h2>
        <p className="text-sm text-slate-500 mt-1">
          Selecione o serviço que deseja agendar
        </p>
      </div>

      <div className="space-y-2">
        {services.map((service) => (
          <button
            key={service.id}
            onClick={() => onSelect(service)}
            className="w-full text-left rounded-xl border border-slate-200 bg-white p-4 hover:border-slate-400 hover:shadow-sm active:scale-[0.99] transition-all focus:outline-none focus:ring-2 focus:ring-offset-2"
            style={{ '--tw-ring-color': primaryColor } as React.CSSProperties}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium text-slate-900 text-sm leading-snug">
                  {service.name}
                </p>
                <div className="flex items-center gap-1 mt-1">
                  <Clock className="size-3 text-slate-400 shrink-0" />
                  <span className="text-xs text-slate-500">{service.duration} min</span>
                </div>
              </div>
              <span className="text-sm font-semibold text-slate-700 shrink-0 whitespace-nowrap">
                {formatPrice(service)}
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
