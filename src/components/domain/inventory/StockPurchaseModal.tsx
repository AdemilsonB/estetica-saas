'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { CurrencyInput } from '@/components/ui/currency-input'
import { NumberInput } from '@/components/ui/number-input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ComboboxField } from '@/components/ui/combobox-field'
import { Skeleton } from '@/components/ui/skeleton'
import { useProducts } from '@/hooks/inventory/use-products'

type Props = {
  open: boolean
  onClose: () => void
}

export function StockPurchaseModal({ open, onClose }: Props) {
  const queryClient = useQueryClient()
  const { data: productsResponse, isLoading: productsLoading } = useProducts({ pageSize: 100 })
  const products = productsResponse?.data ?? []

  const [productId, setProductId] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [unitPrice, setUnitPrice] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)

  // Pré-preenche o unitPrice com o costPrice do produto selecionado
  useEffect(() => {
    const selected = products.find((p) => p.id === productId)
    if (selected) {
      setUnitPrice((parseFloat(selected.costPrice) || 0).toFixed(2))
    }
  }, [productId, products])

  // Campo vazio vale 0 nos cálculos, mas continua vazio na tela.
  const quantityNum = quantity === '' ? 0 : Number(quantity)
  const unitPriceNum = unitPrice === '' ? 0 : Number(unitPrice)

  function handleClose() {
    setProductId('')
    setQuantity('1')
    setUnitPrice('')
    setNotes('')
    onClose()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!productId) {
      toast.error('Selecione um produto')
      return
    }
    if (quantityNum <= 0) {
      toast.error('Quantidade deve ser maior que zero')
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/products/${productId}/purchase`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quantity: quantityNum,
          unitPrice: unitPriceNum,
          notes: notes || undefined,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(
          (err as { error?: { message?: string } })?.error?.message ??
            (err as { message?: string })?.message ??
            'Erro ao registrar compra',
        )
      }
      await queryClient.invalidateQueries({ queryKey: ['products'] })
      await queryClient.invalidateQueries({ queryKey: ['stock-movements'] })
      toast.success('Compra registrada com sucesso')
      handleClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao registrar compra')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar Compra de Estoque</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>
              Produto <span className="text-rose-500">*</span>
            </Label>
            {productsLoading ? (
              <Skeleton className="h-10 w-full rounded-lg" />
            ) : (
              <ComboboxField
                options={products.map((p) => ({
                  value: p.id,
                  label: p.name + (p.category ? ` · ${p.category.name}` : ''),
                }))}
                value={productId || undefined}
                onChange={(v) => setProductId(v ?? '')}
                placeholder="Selecionar produto..."
                searchPlaceholder="Buscar produto..."
              />
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="purchase-qty">
                Quantidade <span className="text-rose-500">*</span>
              </Label>
              <NumberInput
                id="purchase-qty"
                min={1}
                suffix="un"
                value={quantity}
                onChange={setQuantity}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="purchase-price">Valor Unitário (R$)</Label>
              <CurrencyInput
                id="purchase-price"
                value={unitPrice}
                onChange={setUnitPrice}
              />
            </div>
          </div>

          {unitPriceNum > 0 && quantityNum > 0 && (
            <p className="text-sm text-slate-500">
              Total:{' '}
              <span className="font-medium text-slate-700">
                R$ {(unitPriceNum * quantityNum).toFixed(2)}
              </span>
            </p>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="purchase-notes">Observações</Label>
            <Textarea
              id="purchase-notes"
              placeholder="Fornecedor, número de nota, etc..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="resize-none"
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading || !productId || quantity === ''}>
              {loading ? 'Registrando...' : 'Registrar compra'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
