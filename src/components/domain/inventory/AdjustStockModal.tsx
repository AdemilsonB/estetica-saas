'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAdjustStock } from '@/hooks/inventory/use-products'

type Props = {
  open: boolean
  onClose: () => void
  product: { id: string; name: string; stockQuantity: number } | null
}

export function AdjustStockModal({ open, onClose, product }: Props) {
  const [quantity, setQuantity] = useState('')
  const adjust = useAdjustStock()

  function handleOpenChange(isOpen: boolean) {
    if (!isOpen) {
      setQuantity('')
      onClose()
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!product) return
    const targetQuantity = parseInt(quantity, 10)
    if (isNaN(targetQuantity) || targetQuantity < 0) {
      toast.error('Informe uma quantidade válida (número inteiro ≥ 0)')
      return
    }
    try {
      await adjust.mutateAsync({ productId: product.id, targetQuantity })
      toast.success(`Estoque de "${product.name}" ajustado para ${targetQuantity} unidade(s)`)
      handleOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao ajustar estoque')
    }
  }

  if (!product) return null

  const current = product.stockQuantity
  const target = parseInt(quantity, 10)
  const diff = !isNaN(target) ? target - current : null

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Ajustar Estoque</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="rounded-lg bg-muted/40 px-4 py-3 text-sm">
            <p className="text-muted-foreground">{product.name}</p>
            <p className="mt-0.5 font-semibold text-foreground">
              Estoque atual: <span className="text-primary">{current} unidade(s)</span>
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="adjust-qty">Nova quantidade (unidades)</Label>
            <Input
              id="adjust-qty"
              type="number"
              min={0}
              step={1}
              placeholder={String(current)}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
            {diff !== null && (
              <p className={`text-xs ${diff === 0 ? 'text-muted-foreground' : diff > 0 ? 'text-emerald-600' : 'text-orange-600'}`}>
                {diff === 0
                  ? 'Sem alteração'
                  : diff > 0
                  ? `+${diff} unidade(s) adicionada(s)`
                  : `${diff} unidade(s) removida(s)`}
              </p>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            Este ajuste atualiza o estoque diretamente e não gera lançamento financeiro.
          </p>

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={adjust.isPending || quantity === ''}>
              {adjust.isPending ? 'Salvando...' : 'Confirmar ajuste'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
