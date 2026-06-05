'use client'

import { useEffect, useState } from 'react'
import { Minus, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { CurrencyInput } from '@/components/ui/currency-input'
import { useCreateService, useUpdateService, type Service } from '@/hooks/scheduling/use-services'
import { useProducts } from '@/hooks/inventory/use-products'

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

  const [name, setName] = useState('')
  const [duration, setDuration] = useState('60')
  const [price, setPrice] = useState('')
  const [productItems, setProductItems] = useState<ProductItem[]>([])
  const [savingTemplate, setSavingTemplate] = useState(false)

  const { data: productsData } = useProducts({ pageSize: 100 })
  const allProducts = productsData?.data ?? []

  // Carrega campos do serviço e template de produtos ao abrir
  useEffect(() => {
    if (open && service) {
      setName(service.name)
      setDuration(String(service.duration))
      setPrice(Number(service.price).toFixed(2))
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
      setDuration('60')
      setPrice('')
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
    const durationNum = parseInt(duration, 10)
    const priceNum = parseFloat(price)
    if (isNaN(durationNum) || isNaN(priceNum) || priceNum <= 0) return

    setSavingTemplate(true)

    if (isEditing) {
      update(
        { id: service.id, name: name.trim(), duration: durationNum, price: priceNum },
        {
          onSuccess: async () => {
            try { await saveTemplate(service.id) } catch { /* ignore */ }
            setSavingTemplate(false)
            onClose()
          },
          onError: () => setSavingTemplate(false),
        },
      )
    } else {
      create(
        { name: name.trim(), duration: durationNum, price: priceNum },
        {
          onSuccess: async (created) => {
            try { await saveTemplate(created.id) } catch { /* ignore */ }
            setSavingTemplate(false)
            onClose()
          },
          onError: () => setSavingTemplate(false),
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar serviço' : 'Novo serviço'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Campos básicos */}
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

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="service-duration">Duração (min)</Label>
              <Input
                id="service-duration"
                type="number"
                min={5}
                max={480}
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                required
              />
            </div>
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
              <Select onValueChange={addProduct}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="+ Adicionar produto ao kit" />
                </SelectTrigger>
                <SelectContent>
                  {availableProducts.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
