'use client'

import { useState, useEffect } from 'react'
import { ChevronDown, ChevronUp, Minus, Plus, Save } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  useAppointmentProducts,
  useSaveAppointmentProducts,
} from '@/hooks/inventory/use-appointment-products'
import { useServiceTemplate } from '@/hooks/inventory/use-service-template'
import { useProducts } from '@/hooks/inventory/use-products'

type ProductItem = { productId: string; quantity: number; name: string }

type Props = {
  appointmentId: string
  serviceId: string
}

export function AppointmentProductsSection({ appointmentId, serviceId }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [items, setItems] = useState<ProductItem[]>([])
  const [initialized, setInitialized] = useState(false)

  const { data: savedProducts } = useAppointmentProducts(expanded ? appointmentId : undefined)
  const { data: template } = useServiceTemplate(
    expanded && !initialized ? serviceId : undefined,
  )
  const { data: productsData } = useProducts({ pageSize: 100 })
  const saveProducts = useSaveAppointmentProducts(appointmentId)

  const allProducts: Array<{ id: string; name: string }> = productsData?.data ?? []

  // Inicializa items quando os dados chegam
  useEffect(() => {
    if (!expanded || initialized) return
    if (savedProducts !== undefined) {
      const saved = Array.isArray(savedProducts) ? savedProducts : []
      if (saved.length > 0) {
        setItems(
          saved.map(
            (p: { productId: string; quantity: number; product: { name: string } }) => ({
              productId: p.productId,
              quantity: p.quantity,
              name: p.product.name,
            }),
          ),
        )
        setInitialized(true)
      } else if (template !== undefined) {
        const templateItems = Array.isArray(template) ? template : []
        setItems(
          templateItems.map(
            (t: { productId: string; quantity: number; product: { name: string } }) => ({
              productId: t.productId,
              quantity: t.quantity,
              name: t.product.name,
            }),
          ),
        )
        setInitialized(true)
      }
    }
  }, [expanded, initialized, savedProducts, template])

  function handleExpand() {
    setExpanded((prev) => !prev)
    if (!expanded) setInitialized(false)
  }

  function updateQuantity(productId: string, delta: number) {
    setItems((prev) =>
      prev.map((item) =>
        item.productId === productId
          ? { ...item, quantity: Math.max(1, item.quantity + delta) }
          : item,
      ),
    )
  }

  function removeItem(productId: string) {
    setItems((prev) => prev.filter((i) => i.productId !== productId))
  }

  function addProduct(productId: string) {
    if (items.find((i) => i.productId === productId)) return
    const product = allProducts.find((p) => p.id === productId)
    if (!product) return
    setItems((prev) => [...prev, { productId, quantity: 1, name: product.name }])
  }

  async function handleSave() {
    try {
      await saveProducts.mutateAsync({
        products: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
      })
      toast.success('Produtos do atendimento salvos')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar produtos')
    }
  }

  const availableProducts = allProducts.filter((p) => !items.find((i) => i.productId === p.id))

  return (
    <div className="rounded-xl border border-border/50">
      <button
        type="button"
        className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-left"
        onClick={handleExpand}
      >
        <span>Produtos Utilizados</span>
        {expanded ? (
          <ChevronUp className="size-4 shrink-0" />
        ) : (
          <ChevronDown className="size-4 shrink-0" />
        )}
      </button>

      {expanded && (
        <div className="border-t border-border/50 px-4 pb-4 pt-3 space-y-3">
          <p className="text-xs text-muted-foreground">
            Opcional — pré-preenchido pelo template do serviço
          </p>

          {items.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-2">
              Nenhum produto adicionado
            </p>
          )}

          {items.map((item) => (
            <div key={item.productId} className="flex items-center gap-2">
              <span className="flex-1 text-sm truncate">{item.name}</span>
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                onClick={() => updateQuantity(item.productId, -1)}
              >
                <Minus className="size-3" />
              </Button>
              <span className="w-6 text-center text-sm tabular-nums">{item.quantity}</span>
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                onClick={() => updateQuantity(item.productId, 1)}
              >
                <Plus className="size-3" />
              </Button>
              <button
                type="button"
                className="text-destructive hover:text-destructive/80 text-sm px-1"
                onClick={() => removeItem(item.productId)}
                aria-label="Remover produto"
              >
                ×
              </button>
            </div>
          ))}

          {availableProducts.length > 0 && (
            <Select onValueChange={addProduct}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="+ Adicionar produto" />
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

          <Button
            size="sm"
            className="w-full"
            onClick={handleSave}
            disabled={saveProducts.isPending}
          >
            <Save className="size-3.5 mr-1.5" />
            {saveProducts.isPending ? 'Salvando...' : 'Salvar consumo'}
          </Button>
        </div>
      )}
    </div>
  )
}
