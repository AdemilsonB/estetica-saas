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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useProducts } from '@/hooks/inventory/use-products'

type Props = {
  open: boolean
  onClose: () => void
}

export function StockSaleModal({ open, onClose }: Props) {
  const queryClient = useQueryClient()
  const { data: productsResponse } = useProducts({ pageSize: 200 })
  const products = productsResponse?.data ?? []

  const [productId, setProductId] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [unitPrice, setUnitPrice] = useState<string>('')
  const [loading, setLoading] = useState(false)

  const selectedProduct = products.find((p) => p.id === productId)

  // Pré-preenche o unitPrice com o salePrice do produto selecionado
  useEffect(() => {
    if (selectedProduct) {
      setUnitPrice(selectedProduct.salePrice)
    }
  }, [productId, selectedProduct])

  function handleClose() {
    setProductId('')
    setQuantity(1)
    setUnitPrice('')
    onClose()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!productId) {
      toast.error('Selecione um produto')
      return
    }
    if (quantity <= 0) {
      toast.error('Quantidade deve ser maior que zero')
      return
    }
    if (
      selectedProduct &&
      selectedProduct.stockQuantity !== undefined &&
      quantity > selectedProduct.stockQuantity
    ) {
      toast.error(
        `Estoque insuficiente. Disponível: ${selectedProduct.stockQuantity} unidade(s)`,
      )
      return
    }

    setLoading(true)
    try {
      const body: { quantity: number; unitPrice?: number } = { quantity }
      const parsedPrice = parseFloat(unitPrice)
      if (!isNaN(parsedPrice) && parsedPrice > 0) {
        body.unitPrice = parsedPrice
      }

      const res = await fetch(`/api/products/${productId}/sell`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(
          (err as { error?: { message?: string } })?.error?.message ??
            (err as { message?: string })?.message ??
            'Erro ao registrar venda',
        )
      }
      await queryClient.invalidateQueries({ queryKey: ['products'] })
      await queryClient.invalidateQueries({ queryKey: ['stock-movements'] })
      toast.success('Venda registrada com sucesso')
      handleClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao registrar venda')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar Venda Avulsa</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>
              Produto <span className="text-rose-500">*</span>
            </Label>
            <Select value={productId} onValueChange={setProductId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecionar produto" />
              </SelectTrigger>
              <SelectContent>
                {products.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                    {p.category ? ` · ${p.category.name}` : ''}
                    {' · '}
                    <span className="text-slate-400">{p.stockQuantity} em estoque</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedProduct && (
              <p className="text-xs text-slate-500">
                Estoque disponível:{' '}
                <span className="font-medium">{selectedProduct.stockQuantity} unidade(s)</span>
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="sale-qty">
                Quantidade <span className="text-rose-500">*</span>
              </Label>
              <Input
                id="sale-qty"
                type="number"
                min="1"
                max={selectedProduct?.stockQuantity}
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="sale-price">Valor Unitário (R$)</Label>
              <Input
                id="sale-price"
                type="number"
                step="0.01"
                min="0"
                placeholder="Opcional"
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
              />
            </div>
          </div>

          {unitPrice && !isNaN(parseFloat(unitPrice)) && parseFloat(unitPrice) > 0 && quantity > 0 && (
            <p className="text-sm text-slate-500">
              Total:{' '}
              <span className="font-medium text-slate-700">
                R$ {(parseFloat(unitPrice) * quantity).toFixed(2)}
              </span>
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading || !productId}>
              {loading ? 'Registrando...' : 'Registrar venda'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
