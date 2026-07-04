'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { CurrencyInput } from '@/components/ui/currency-input'
import { PercentageInput } from '@/components/ui/percentage-input'
import { ImageUploadField } from '@/components/ui/image-upload-field'
import type { CropValues } from '@/components/domain/shared/image-crop-editor'
import { useServices } from '@/hooks/scheduling/use-services'
import { usePackages } from '@/hooks/scheduling/use-packages'
import {
  useCreatePromotion,
  useUpdatePromotion,
  type Promotion,
  type PromoItemInput,
} from '@/hooks/scheduling/use-promotions'

type Props = {
  open: boolean
  onClose: () => void
  promotion?: Promotion
}

export function PromotionFormModal({ open, onClose, promotion }: Props) {
  const isEditing = !!promotion
  const { data: services } = useServices()
  const { data: packages } = usePackages()
  const { mutate: create, isPending: creating } = useCreatePromotion()
  const { mutate: update, isPending: updating } = useUpdatePromotion()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [discountType, setDiscountType] = useState<'PERCENTAGE' | 'FIXED'>('PERCENTAGE')
  const [discountValue, setDiscountValue] = useState('')
  const [startsAt, setStartsAt] = useState('')
  const [endsAt, setEndsAt] = useState('')
  const [selectedItems, setSelectedItems] = useState<PromoItemInput[]>([])
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [crop, setCrop] = useState<CropValues | null>(null)

  useEffect(() => {
    if (open && promotion) {
      setName(promotion.name)
      setDescription(promotion.description ?? '')
      setDiscountType(promotion.discountType)
      setDiscountValue(Number(promotion.discountValue).toFixed(2))
      setStartsAt(promotion.startsAt ? promotion.startsAt.slice(0, 16) : '')
      setEndsAt(promotion.endsAt ? promotion.endsAt.slice(0, 16) : '')
      setSelectedItems(
        promotion.items.map((i) => ({
          serviceId: i.serviceId ?? undefined,
          packageId: i.packageId ?? undefined,
        })),
      )
      setImageUrl(promotion.imageUrl ?? null)
      setCrop(
        promotion.imageCropX != null && promotion.imageCropY != null && promotion.imageCropZoom != null
          ? { cropX: promotion.imageCropX, cropY: promotion.imageCropY, cropZoom: promotion.imageCropZoom }
          : null,
      )
    } else if (!open) {
      setName('')
      setDescription('')
      setDiscountType('PERCENTAGE')
      setDiscountValue('')
      setStartsAt('')
      setEndsAt('')
      setSelectedItems([])
      setImageUrl(null)
      setCrop(null)
    }
  }, [open, promotion])

  function toggleService(id: string) {
    setSelectedItems((prev) => {
      const exists = prev.some((i) => i.serviceId === id)
      return exists ? prev.filter((i) => i.serviceId !== id) : [...prev, { serviceId: id }]
    })
  }

  function togglePackage(id: string) {
    setSelectedItems((prev) => {
      const exists = prev.some((i) => i.packageId === id)
      return exists ? prev.filter((i) => i.packageId !== id) : [...prev, { packageId: id }]
    })
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const valueNum = parseFloat(discountValue)
    if (isNaN(valueNum) || valueNum <= 0 || selectedItems.length === 0) return

    const payload = {
      name: name.trim(),
      description: description.trim() || undefined,
      discountType,
      discountValue,
      startsAt: startsAt ? new Date(startsAt).toISOString() : undefined,
      endsAt: endsAt ? new Date(endsAt).toISOString() : undefined,
      items: selectedItems,
    }

    if (isEditing) {
      update(
        {
          id: promotion.id,
          ...payload,
          imageUrl,
          imageCropX: crop?.cropX ?? null,
          imageCropY: crop?.cropY ?? null,
          imageCropZoom: crop?.cropZoom ?? null,
        },
        { onSuccess: onClose },
      )
    } else {
      create(payload, { onSuccess: onClose })
    }
  }

  const isPending = creating || updating

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar promoção' : 'Nova promoção'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="promo-name">Nome da promoção</Label>
            <Input id="promo-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Janeiro com desconto" required minLength={2} maxLength={100} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="promo-desc">Descrição (opcional)</Label>
            <Textarea
              id="promo-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descreva a promoção"
              maxLength={500}
              className="min-h-20 resize-none"
            />
          </div>

          {isEditing ? (
            <ImageUploadField
              entityType="promotions"
              entityId={promotion.id}
              value={imageUrl}
              onChange={setImageUrl}
              cropShape="portrait"
              crop={crop}
              onCropChange={setCrop}
              label="Imagem da promoção"
              savePromptMessage="Salve a promoção primeiro para adicionar uma imagem."
            />
          ) : (
            <p className="text-xs text-muted-foreground">
              Salve a promoção para adicionar uma imagem.
            </p>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tipo de desconto</Label>
              <Select
                value={discountType}
                onValueChange={(v) => {
                  setDiscountType(v as 'PERCENTAGE' | 'FIXED')
                  setDiscountValue('')
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PERCENTAGE">Percentual (%)</SelectItem>
                  <SelectItem value="FIXED">Valor fixo (R$)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Valor do desconto</Label>
              {discountType === 'PERCENTAGE' ? (
                <PercentageInput value={discountValue} onChange={setDiscountValue} required />
              ) : (
                <CurrencyInput value={discountValue} onChange={setDiscountValue} placeholder="R$ 0,00" required />
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="promo-starts">Início (opcional)</Label>
              <Input id="promo-starts" type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="promo-ends">Validade (opcional)</Label>
              <Input id="promo-ends" type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Itens incluídos <span className="text-destructive">*</span></Label>
            <div className="max-h-48 space-y-3 overflow-y-auto rounded-xl border border-border p-3">
              {services && services.filter((s) => s.active).length > 0 && (
                <div>
                  <p className="mb-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">Serviços</p>
                  {services.filter((s) => s.active).map((service) => (
                    <label key={service.id} className="flex cursor-pointer items-center gap-3 py-1">
                      <Checkbox
                        checked={selectedItems.some((i) => i.serviceId === service.id)}
                        onCheckedChange={() => toggleService(service.id)}
                      />
                      <span className="text-sm">{service.name}</span>
                      <span className="ml-auto text-xs text-muted-foreground">
                        {Number(service.price).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </span>
                    </label>
                  ))}
                </div>
              )}
              {packages && packages.length > 0 && (
                <div>
                  <p className="mb-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">Pacotes</p>
                  {packages.map((pkg) => (
                    <label key={pkg.id} className="flex cursor-pointer items-center gap-3 py-1">
                      <Checkbox
                        checked={selectedItems.some((i) => i.packageId === pkg.id)}
                        onCheckedChange={() => togglePackage(pkg.id)}
                      />
                      <span className="text-sm">{pkg.name}</span>
                      <span className="ml-auto text-xs text-muted-foreground">
                        {Number(pkg.price).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>
            {selectedItems.length === 0 && (
              <p className="text-xs text-destructive">Selecione ao menos 1 item.</p>
            )}
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">Cancelar</Button>
            <Button type="submit" disabled={isPending || selectedItems.length === 0} className="flex-1">
              {isPending ? 'Salvando...' : isEditing ? 'Salvar' : 'Criar promoção'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
