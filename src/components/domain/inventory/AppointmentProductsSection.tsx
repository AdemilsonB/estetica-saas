'use client'

import { useState, useEffect } from 'react'
import { ChevronDown, ChevronUp, Minus, Plus, Save } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
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
import { usePermissions } from '@/hooks/use-permissions'

type ProductItem = {
  productId: string
  quantity: number
  name: string
  stockQuantity: number
  costPrice: number
}

type DiffLine =
  | { productId: string; name: string; diff: number; newStock: number; costTotal: number; hasError: false }
  | { productId: string; name: string; diff: number; available: number; needed: number; hasError: true }

type Props = {
  appointmentId: string
  serviceId: string
  defaultExpanded?: boolean
  isCompleted?: boolean
}

export function AppointmentProductsSection({
  appointmentId,
  serviceId,
  defaultExpanded = false,
  isCompleted = false,
}: Props) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const [items, setItems] = useState<ProductItem[]>([])
  const [initialized, setInitialized] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [stockAction, setStockAction] = useState<'apply' | 'none'>('none')
  const [diffLines, setDiffLines] = useState<DiffLine[]>([])

  const { can } = usePermissions()
  const canView = can('produtos', 'view')
  const canEdit = can('produtos', 'edit')

  const { data: savedProducts } = useAppointmentProducts(expanded && canView ? appointmentId : undefined)
  const { data: template } = useServiceTemplate(
    expanded && !initialized && canView ? serviceId : undefined,
  )
  const { data: productsData } = useProducts({ pageSize: 100, enabled: canView })
  const saveProducts = useSaveAppointmentProducts(appointmentId)

  const allProducts = productsData?.data ?? []

  useEffect(() => {
    if (!expanded || initialized) return
    if (savedProducts !== undefined) {
      const saved = Array.isArray(savedProducts) ? savedProducts : []
      if (saved.length > 0) {
        setItems(
          saved.map(
            (p: { productId: string; quantity: number; product: { name: string } }) => {
              const stock = allProducts.find((a) => a.id === p.productId)
              return {
                productId: p.productId,
                quantity: p.quantity,
                name: p.product.name,
                stockQuantity: stock?.stockQuantity ?? 999,
                costPrice: Number(stock?.costPrice ?? 0),
              }
            },
          ),
        )
        setInitialized(true)
      } else if (template !== undefined) {
        const templateItems = Array.isArray(template) ? template : []
        setItems(
          templateItems.map(
            (t: { productId: string; quantity: number; product: { name: string } }) => {
              const stock = allProducts.find((a) => a.id === t.productId)
              return {
                productId: t.productId,
                quantity: t.quantity,
                name: t.product.name,
                stockQuantity: stock?.stockQuantity ?? 999,
                costPrice: Number(stock?.costPrice ?? 0),
              }
            },
          ),
        )
        setInitialized(true)
      }
    }
  }, [expanded, initialized, savedProducts, template, allProducts])

  function handleExpand() {
    setExpanded((prev) => !prev)
    if (!expanded) setInitialized(false)
  }

  function updateQuantity(productId: string, delta: number) {
    setItems((prev) =>
      prev.map((item) => {
        if (item.productId !== productId) return item
        const newQty = item.quantity + delta
        if (newQty < 1) return item
        if (delta > 0 && newQty > item.stockQuantity && !isCompleted) return item
        return { ...item, quantity: newQty }
      }),
    )
  }

  function removeItem(productId: string) {
    setItems((prev) => prev.filter((i) => i.productId !== productId))
  }

  function addProduct(productId: string) {
    if (items.find((i) => i.productId === productId)) return
    const product = allProducts.find((p) => p.id === productId)
    if (!product) return
    setItems((prev) => [
      ...prev,
      {
        productId,
        quantity: 1,
        name: product.name,
        stockQuantity: product.stockQuantity,
        costPrice: Number(product.costPrice),
      },
    ])
  }

  function computeDiff(): DiffLine[] {
    const savedList = Array.isArray(savedProducts) ? savedProducts : []
    const oldMap = new Map(
      savedList.map((p: { productId: string; quantity: number }) => [p.productId, p.quantity])
    )
    const lines: DiffLine[] = []

    const allPids = new Set([
      ...oldMap.keys(),
      ...items.map((i) => i.productId),
    ])

    for (const pid of allPids) {
      const oldQty = oldMap.get(pid) ?? 0
      const item = items.find((i) => i.productId === pid)
      const newQty = item?.quantity ?? 0
      const diff = newQty - oldQty
      if (diff === 0) continue

      const stock = allProducts.find((p) => p.id === pid)
      const name = item?.name ?? stock?.name ?? pid
      const costPrice = Number(item?.costPrice ?? stock?.costPrice ?? 0)

      if (diff > 0) {
        const available = item?.stockQuantity ?? stock?.stockQuantity ?? 0
        if (available < diff) {
          lines.push({ productId: pid, name, diff, available, needed: diff, hasError: true })
        } else {
          lines.push({
            productId: pid,
            name,
            diff,
            newStock: available - diff,
            costTotal: costPrice * diff,
            hasError: false,
          })
        }
      } else {
        lines.push({
          productId: pid,
          name,
          diff,
          newStock: (item?.stockQuantity ?? stock?.stockQuantity ?? 0) + Math.abs(diff),
          costTotal: 0,
          hasError: false,
        })
      }
    }
    return lines
  }

  async function handleSave() {
    if (isCompleted) {
      setStockAction('none')
      setDiffLines([])
      setDialogOpen(true)
      return
    }
    await doSave('none')
  }

  async function doSave(action: 'apply' | 'none') {
    try {
      await saveProducts.mutateAsync({
        products: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
        stockAction: action,
      })
      const msg =
        action === 'apply'
          ? 'Estoque e financeiro atualizados com as diferenças do atendimento'
          : 'Produtos salvos — estoque não alterado'
      toast.success(msg)
      setDialogOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar produtos')
    }
  }

  const availableProducts = allProducts.filter((p) => !items.find((i) => i.productId === p.id))

  if (!canView) return null

  return (
    <>
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

            {!canEdit && (
              <p className="text-xs text-amber-600">
                Você não tem permissão para editar produtos do atendimento — fale com o
                dono ou gerente para liberar em Cargos e permissões.
              </p>
            )}

            {items.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-2">
                Nenhum produto adicionado
              </p>
            )}

            {items.map((item) => {
              const overStock = !isCompleted && item.quantity >= item.stockQuantity
              return (
                <div key={item.productId} className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="flex-1 text-sm truncate">{item.name}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      onClick={() => updateQuantity(item.productId, -1)}
                      disabled={!canEdit}
                    >
                      <Minus className="size-3" />
                    </Button>
                    <span className="w-6 text-center text-sm tabular-nums">{item.quantity}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      onClick={() => updateQuantity(item.productId, 1)}
                      disabled={overStock || !canEdit}
                    >
                      <Plus className="size-3" />
                    </Button>
                    <button
                      type="button"
                      className="text-destructive hover:text-destructive/80 text-sm px-1 disabled:opacity-40"
                      onClick={() => removeItem(item.productId)}
                      disabled={!canEdit}
                      aria-label="Remover produto"
                    >
                      ×
                    </button>
                  </div>
                  {overStock && (
                    <p className="text-xs text-destructive pl-1">
                      Estoque insuficiente — disponível: {item.stockQuantity} unidades
                    </p>
                  )}
                </div>
              )
            })}

            {availableProducts.length > 0 && (
              <Select onValueChange={addProduct} disabled={!canEdit}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="+ Adicionar produto" />
                </SelectTrigger>
                <SelectContent>
                  {availableProducts.map((p) => (
                    <SelectItem
                      key={p.id}
                      value={p.id}
                      disabled={p.stockQuantity === 0}
                    >
                      {p.stockQuantity === 0
                        ? `${p.name} — sem estoque`
                        : `${p.name} (${p.stockQuantity} un.)`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <Button
              size="sm"
              className="w-full"
              onClick={handleSave}
              disabled={saveProducts.isPending || !canEdit}
            >
              <Save className="size-3.5 mr-1.5" />
              {saveProducts.isPending ? 'Salvando...' : 'Salvar consumo'}
            </Button>
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={(o) => !o && setDialogOpen(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Atualizar estoque?</DialogTitle>
          </DialogHeader>

          <div className="space-y-2">
            <button
              type="button"
              className={`w-full text-left rounded-lg border p-3 transition ${
                stockAction === 'none'
                  ? 'border-slate-950 bg-slate-50'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
              onClick={() => { setStockAction('none'); setDiffLines([]) }}
            >
              <p className="text-sm font-medium text-slate-900">Não alterar o estoque</p>
              <p className="text-xs text-slate-500 mt-0.5">
                Salva apenas o registro do atendimento. O estoque permanece como está.
              </p>
            </button>

            <button
              type="button"
              className={`w-full text-left rounded-lg border p-3 transition ${
                stockAction === 'apply'
                  ? 'border-slate-950 bg-slate-50'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
              onClick={() => { setStockAction('apply'); setDiffLines(computeDiff()) }}
            >
              <p className="text-sm font-medium text-slate-900">Aplicar diferença no estoque</p>
              <p className="text-xs text-slate-500 mt-0.5">
                Calcula automaticamente o que mudou: produtos adicionados são descontados,
                produtos removidos são devolvidos ao estoque.
              </p>
            </button>

            {stockAction === 'apply' && diffLines.length > 0 && (
              <div className="mt-3 space-y-1 rounded-lg border border-border/50 p-3">
                {diffLines.map((line) =>
                  line.hasError ? (
                    <div key={line.productId} className="text-xs text-destructive flex justify-between">
                      <span>✕ {line.name}</span>
                      <span>disponível: {line.available}, necessário: {line.needed}</span>
                    </div>
                  ) : line.diff > 0 ? (
                    <div key={line.productId} className="text-xs flex justify-between text-slate-700">
                      <span>▼ {line.name}  −{line.diff} un. (estoque: → {line.newStock})</span>
                      <span className="text-destructive">−R$ {line.costTotal.toFixed(2)}</span>
                    </div>
                  ) : (
                    <div key={line.productId} className="text-xs flex justify-between text-slate-700">
                      <span>▲ {line.name}  +{Math.abs(line.diff)} un. (devolvido)</span>
                    </div>
                  )
                )}
              </div>
            )}

            {stockAction === 'apply' && diffLines.length === 0 && (
              <p className="text-xs text-slate-500 text-center py-1">Nenhuma diferença detectada.</p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => doSave(stockAction)}
              disabled={
                saveProducts.isPending ||
                (stockAction === 'apply' && diffLines.some((l) => l.hasError))
              }
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {saveProducts.isPending ? 'Salvando...' : 'Confirmar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
