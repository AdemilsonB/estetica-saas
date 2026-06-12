'use client'

import { useEffect, useState } from 'react'
import { Minus, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ComboboxField } from '@/components/ui/combobox-field'
import { Separator } from '@/components/ui/separator'
import { CurrencyInput } from '@/components/ui/currency-input'
import { ImageUploadField } from '@/components/ui/image-upload-field'
import { useCreateService, useUpdateService, type Service } from '@/hooks/scheduling/use-services'
import { useServiceCategories } from '@/hooks/scheduling/use-service-categories'
import { useProducts } from '@/hooks/inventory/use-products'
import { minutesToHHMM, hhmmToMinutes } from '@/lib/format-duration'

type ProductItem = { productId: string; quantity: number; name: string }

type Props = {
  open: boolean
  onClose: () => void
  service?: Service
}

export function ServiceFormModal({ open, onClose, service }: Props) {
  const isEditing = !!service
  const { mutate: create, isPending: creating } = useCreateService()
  const { mutate: update, isPending: updating } = useUpdateService()
  const { data: categories = [] } = useServiceCategories()

  const [name, setName] = useState('')
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [description, setDescription] = useState('')
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [priceType, setPriceType] = useState<'FIXED' | 'STARTING_FROM'>('FIXED')
  const [price, setPrice] = useState('')
  const [priceMax, setPriceMax] = useState('')
  const [durationHHMM, setDurationHHMM] = useState('01:00')
  const [productItems, setProductItems] = useState<ProductItem[]>([])
  const [savingTemplate, setSavingTemplate] = useState(false)

  const { data: productsData } = useProducts({ pageSize: 100 })
  const allProducts = productsData?.data ?? []

  // Carrega campos do serviço ao abrir no modo edição
  useEffect(() => {
    if (open && service) {
      setName(service.name)
      setCategoryId(service.categoryId ?? null)
      setDescription(service.description ?? '')
      setImageUrl(service.imageUrl ?? null)
      setPriceType(service.priceType === 'STARTING_FROM' ? 'STARTING_FROM' : 'FIXED')
      setPrice(Number(service.price).toFixed(2))
      setPriceMax(service.priceMax ? Number(service.priceMax).toFixed(2) : '')
      setDurationHHMM(minutesToHHMM(service.duration))
      // Busca template de produtos do serviço
      fetch(`/api/services/${service.id}/products`)
        .then((r) => r.json())
        .then((data: Array<{ productId: string; quantity: number; product: { name: string } }>) => {
          if (Array.isArray(data)) {
            setProductItems(data.map((t) => ({ productId: t.productId, quantity: t.quantity, name: t.product.name })))
          }
        })
        .catch(() => { /* silently ignore */ })
    } else if (!open) {
      setName('')
      setCategoryId(null)
      setDescription('')
      setImageUrl(null)
      setPriceType('FIXED')
      setPrice('')
      setPriceMax('')
      setDurationHHMM('01:00')
      setProductItems([])
    }
  }, [open, service])

  async function saveTemplate(serviceId: string) {
    if (productItems.length === 0) return
    await fetch(`/api/services/${serviceId}/products`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ products: productItems.map((i) => ({ productId: i.productId, quantity: i.quantity })) }),
    })
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const durationNum = hhmmToMinutes(durationHHMM)
    if (durationNum === null) {
      toast.error('Tempo médio inválido. Use o formato HH:MM (ex: 01:30).')
      return
    }

    const priceNum = parseFloat(price)
    if (isNaN(priceNum) || priceNum <= 0) return

    const priceMaxNum = priceMax ? parseFloat(priceMax) : null

    const payload = {
      name: name.trim(),
      duration: durationNum,
      price: priceNum,
      priceType,
      priceMax: priceMaxNum ?? null,
      description: description.trim() || null,
      categoryId: categoryId || null,
      imageUrl,
    }

    setSavingTemplate(true)

    if (isEditing) {
      update(
        { id: service.id, ...payload },
        {
          onSuccess: async () => {
            try { await saveTemplate(service.id) } catch { /* ignore */ }
            setSavingTemplate(false)
            onClose()
          },
          onError: () => {
            setSavingTemplate(false)
            toast.error('Falha ao salvar serviço. Verifique os dados e tente novamente.')
          },
        },
      )
    } else {
      create(
        payload,
        {
          onSuccess: async (created) => {
            try { await saveTemplate(created.id) } catch { /* ignore */ }
            setSavingTemplate(false)
            onClose()
          },
          onError: () => {
            setSavingTemplate(false)
            toast.error('Falha ao criar serviço. Verifique os dados e tente novamente.')
          },
        },
      )
    }
  }

  function addProduct(productId: string) {
    if (productItems.find((i) => i.productId === productId)) return
    const product = allProducts.find((p) => p.id === productId)
    if (!product) return
    setProductItems((prev) => [...prev, { productId, quantity: 1, name: product.name }])
  }

  function updateQty(productId: string, delta: number) {
    setProductItems((prev) =>
      prev.map((i) => i.productId === productId ? { ...i, quantity: Math.max(1, i.quantity + delta) } : i),
    )
  }

  function removeProduct(productId: string) {
    setProductItems((prev) => prev.filter((i) => i.productId !== productId))
  }

  const availableProducts = allProducts.filter((p) => !productItems.find((i) => i.productId === p.id))
  const isPending = creating || updating || savingTemplate

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar serviço' : 'Novo serviço'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">

          {/* Nome */}
          <div className="space-y-2">
            <Label htmlFor="service-name">Nome do serviço</Label>
            <Input
              id="service-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Corte masculino"
              required
              minLength={2}
              maxLength={100}
            />
          </div>

          {/* Categoria */}
          <div className="space-y-2">
            <Label htmlFor="service-category">Categoria</Label>
            <ComboboxField
              options={[
                { value: '__none__', label: 'Sem categoria' },
                ...categories.map((cat) => ({ value: cat.id, label: cat.name })),
              ]}
              value={categoryId ?? '__none__'}
              onChange={(v) => setCategoryId(v === '__none__' || !v ? null : v)}
              placeholder="Selecionar categoria..."
              searchPlaceholder="Buscar categoria..."
            />
          </div>

          {/* Descrição */}
          <div className="space-y-2">
            <Label htmlFor="service-description">Descrição</Label>
            <Textarea
              id="service-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descreva o serviço..."
              rows={3}
              maxLength={1000}
            />
          </div>

          {/* Imagem */}
          {isEditing ? (
            <ImageUploadField
              entityType="services"
              entityId={service.id}
              value={imageUrl}
              onChange={setImageUrl}
              label="Imagem do serviço"
              savePromptMessage="Salve o serviço primeiro para adicionar uma imagem."
            />
          ) : (
            <p className="text-xs text-muted-foreground">
              Salve o serviço para adicionar uma imagem.
            </p>
          )}

          {/* Tipo de preço */}
          <div className="space-y-2">
            <Label>Tipo de preço</Label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input
                  type="radio"
                  name="priceType"
                  value="FIXED"
                  checked={priceType === 'FIXED'}
                  onChange={() => setPriceType('FIXED')}
                  className="accent-primary"
                />
                Valor fixo
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input
                  type="radio"
                  name="priceType"
                  value="STARTING_FROM"
                  checked={priceType === 'STARTING_FROM'}
                  onChange={() => setPriceType('STARTING_FROM')}
                  className="accent-primary"
                />
                A partir de
              </label>
            </div>
          </div>

          {/* Campo(s) de preço */}
          {priceType === 'STARTING_FROM' ? (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="service-price">A partir de</Label>
                <CurrencyInput
                  id="service-price"
                  value={price}
                  onChange={setPrice}
                  placeholder="R$ 0,00"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="service-price-max">Até (opcional)</Label>
                <CurrencyInput
                  id="service-price-max"
                  value={priceMax}
                  onChange={setPriceMax}
                  placeholder="R$ 0,00"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="service-price">Preço</Label>
              <CurrencyInput
                id="service-price"
                value={price}
                onChange={setPrice}
                placeholder="R$ 0,00"
                required
              />
            </div>
          )}

          {/* Duração HH:MM */}
          <div className="space-y-2">
            <Label htmlFor="service-duration">Tempo médio (HH:MM)</Label>
            <Input
              id="service-duration"
              value={durationHHMM}
              onChange={(e) => setDurationHHMM(e.target.value)}
              placeholder="01:30"
              required
            />
          </div>

          <Separator />

          {/* Kit padrão de produtos */}
          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium">Kit de Produtos</p>
              <p className="text-xs text-muted-foreground">
                Produtos pré-selecionados ao registrar consumo neste serviço
              </p>
            </div>

            {productItems.map((item) => (
              <div key={item.productId} className="flex items-center gap-2">
                <span className="flex-1 text-sm truncate">{item.name}</span>
                <Button type="button" variant="ghost" size="icon" className="size-7 shrink-0" onClick={() => updateQty(item.productId, -1)}>
                  <Minus className="size-3" />
                </Button>
                <span className="w-6 text-center text-sm tabular-nums shrink-0">{item.quantity}</span>
                <Button type="button" variant="ghost" size="icon" className="size-7 shrink-0" onClick={() => updateQty(item.productId, 1)}>
                  <Plus className="size-3" />
                </Button>
                <button
                  type="button"
                  className="text-destructive hover:text-destructive/80 text-sm px-1 shrink-0"
                  onClick={() => removeProduct(item.productId)}
                  aria-label="Remover"
                >
                  ×
                </button>
              </div>
            ))}

            {productItems.length === 0 && (
              <p className="text-xs text-muted-foreground">Nenhum produto no kit</p>
            )}

            {availableProducts.length > 0 && (
              <ComboboxField
                options={availableProducts.map((p) => ({ value: p.id, label: p.name }))}
                value={undefined}
                onChange={(v) => { if (v) addProduct(v) }}
                placeholder="+ Adicionar produto ao kit..."
                searchPlaceholder="Buscar produto..."
                className="h-8 text-xs"
              />
            )}
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1" disabled={isPending}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending} className="flex-1">
              {isPending ? 'Salvando...' : isEditing ? 'Salvar' : 'Criar serviço'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
