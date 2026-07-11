'use client'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { formatDuration } from '@/lib/format-duration'
import { EntityImage } from '@/components/domain/shared/entity-image'
import {
  formatCurrency,
  computePromotionPricing,
  cheapestPromotionOption,
  type PickerService,
  type PickerPackage,
  type PickerPromotion,
  type PickerSelection,
} from './service-picker-with-categories'

export type PickerDetailItem =
  | { kind: 'service'; data: PickerService }
  | { kind: 'package'; data: PickerPackage }
  | { kind: 'promotion'; data: PickerPromotion }

type Props = {
  item: PickerDetailItem | null
  onClose: () => void
  onSelect: (selection: PickerSelection) => void
}

function formatServicePriceLabel(service: PickerService): string {
  if (service.priceType === 'ON_CONSULTATION') return 'Sob consulta'
  if (service.priceType === 'RANGE' && service.priceMax != null) {
    return `${formatCurrency(service.price)} – ${formatCurrency(service.priceMax)}`
  }
  if (service.priceType === 'STARTING_FROM') return `A partir de ${formatCurrency(service.price)}`
  return formatCurrency(service.price)
}

function formatDiscountLabel(promo: PickerPromotion): string {
  return promo.discountType === 'PERCENTAGE'
    ? `${Number(promo.discountValue)}% OFF`
    : `${formatCurrency(promo.discountValue)} OFF`
}

export function PickerDetailModal({ item, onClose, onSelect }: Props) {
  return (
    <Dialog open={item !== null} onOpenChange={(o) => !o && onClose()} modal={false}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        {item?.kind === 'service' && (
          <ServiceDetail service={item.data} onSelect={onSelect} />
        )}
        {item?.kind === 'package' && (
          <PackageDetail pkg={item.data} onSelect={onSelect} />
        )}
        {item?.kind === 'promotion' && (
          <PromotionDetail promo={item.data} onSelect={onSelect} />
        )}
      </DialogContent>
    </Dialog>
  )
}

function ServiceDetail({ service, onSelect }: { service: PickerService; onSelect: (s: PickerSelection) => void }) {
  return (
    <div className="min-w-0 space-y-4">
      <DialogHeader>
        <DialogTitle>{service.name}</DialogTitle>
      </DialogHeader>
      <EntityImage
        src={service.imageUrl}
        alt={service.name}
        shape="portrait"
        cropX={service.imageCropX}
        cropY={service.imageCropY}
        cropZoom={service.imageCropZoom}
        className="mx-auto w-full max-w-56"
        fallback={<span className="text-4xl text-muted-foreground/30">✂</span>}
      />
      {service.description && (
        <p className="whitespace-pre-line text-sm text-muted-foreground">{service.description}</p>
      )}
      <div className="flex items-center justify-between rounded-xl border bg-muted/30 px-3 py-2">
        <span className="text-sm font-semibold text-primary">{formatServicePriceLabel(service)}</span>
        <span className="text-sm text-muted-foreground">{formatDuration(service.duration)}</span>
      </div>
      <Button type="button" className="w-full" onClick={() => onSelect({ type: 'service', item: service })}>
        Selecionar
      </Button>
    </div>
  )
}

function PackageDetail({ pkg, onSelect }: { pkg: PickerPackage; onSelect: (s: PickerSelection) => void }) {
  const totalDuration = pkg.items.reduce((s, i) => s + i.service.duration, 0)
  return (
    <div className="min-w-0 space-y-4">
      <DialogHeader>
        <DialogTitle>{pkg.name}</DialogTitle>
      </DialogHeader>
      <EntityImage
        src={pkg.imageUrl}
        alt={pkg.name}
        shape="portrait"
        cropX={pkg.imageCropX}
        cropY={pkg.imageCropY}
        cropZoom={pkg.imageCropZoom}
        className="mx-auto w-full max-w-56"
        fallback={<span className="text-4xl text-muted-foreground/30">🎁</span>}
      />
      {pkg.description && (
        <p className="whitespace-pre-line text-sm text-muted-foreground">{pkg.description}</p>
      )}
      <div className="space-y-1.5">
        <p className="text-xs font-medium text-muted-foreground">Serviços inclusos</p>
        {pkg.items.map((i) => (
          <div key={i.service.id} className="flex items-center justify-between rounded-xl border px-3 py-2">
            <span className="text-sm">{i.service.name}</span>
            <span className="text-xs text-muted-foreground">{formatDuration(i.service.duration)}</span>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between rounded-xl border bg-muted/30 px-3 py-2">
        <span className="text-sm font-semibold text-primary">{formatCurrency(pkg.price)}</span>
        <span className="text-sm text-muted-foreground">{formatDuration(totalDuration)}</span>
      </div>
      <Button type="button" className="w-full" onClick={() => onSelect({ type: 'package', item: pkg })}>
        Selecionar
      </Button>
    </div>
  )
}

function PromotionDetail({ promo, onSelect }: { promo: PickerPromotion; onSelect: (s: PickerSelection) => void }) {
  const priced = computePromotionPricing(promo)
  const cheapest = cheapestPromotionOption(promo)

  return (
    <div className="min-w-0 space-y-4">
      <DialogHeader>
        <DialogTitle>{promo.name}</DialogTitle>
      </DialogHeader>
      <EntityImage
        src={promo.imageUrl}
        alt={promo.name}
        shape="portrait"
        cropX={promo.imageCropX}
        cropY={promo.imageCropY}
        cropZoom={promo.imageCropZoom}
        className="mx-auto w-full max-w-56"
        fallback={<span className="text-4xl text-muted-foreground/30">%</span>}
      />
      <span className="inline-flex w-fit items-center rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
        {formatDiscountLabel(promo)}
      </span>
      {promo.description && (
        <p className="whitespace-pre-line text-sm text-muted-foreground">{promo.description}</p>
      )}
      <div className="space-y-1.5">
        <p className="text-xs font-medium text-muted-foreground">Serviços com desconto</p>
        {priced.map(({ serviceId, service, originalPrice, discountedPrice }) => (
          <button
            key={serviceId}
            type="button"
            onClick={() => onSelect({
              type: 'promotion',
              promotionId: promo.id,
              service: { id: serviceId, name: service.name, price: discountedPrice, duration: service.duration ?? 0 },
            })}
            className="flex min-h-11 w-full items-center justify-between rounded-xl border px-3 py-2 text-left transition-colors hover:border-primary/40"
          >
            <div className="min-w-0">
              <span className="block text-sm line-clamp-1">{service.name}</span>
              <span className="text-xs text-muted-foreground">{formatDuration(service.duration ?? 0)}</span>
            </div>
            <div className="shrink-0 text-right">
              <span className="block text-sm font-semibold text-emerald-600">{formatCurrency(discountedPrice)}</span>
              <span className="text-xs text-slate-400 line-through">{formatCurrency(originalPrice)}</span>
            </div>
          </button>
        ))}
      </div>
      {cheapest && (
        <Button
          type="button"
          className="w-full"
          onClick={() => onSelect({
            type: 'promotion',
            promotionId: promo.id,
            service: {
              id: cheapest.serviceId,
              name: cheapest.service.name,
              price: cheapest.discountedPrice,
              duration: cheapest.service.duration ?? 0,
            },
          })}
        >
          Selecionar o mais barato
        </Button>
      )}
    </div>
  )
}
