'use client'

import { Pencil, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

type ProductCategory = { id: string; name: string }

type Product = {
  id: string
  name: string
  category: ProductCategory | null
  salePrice: string
  stockQuantity: number
  lowStockAlert: number
}

type Props = {
  products: Product[]
  onEdit: (product: Product) => void
  onDelete: (product: Product) => void
}

function formatCurrency(value: string | number) {
  return Number(value).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

export function ProductsTable({ products, onEdit, onDelete }: Props) {
  if (products.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-muted-foreground">
        Nenhum produto encontrado. Adicione o primeiro produto.
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-border/50 overflow-hidden">
      {/* Cabeçalho */}
      <div className="hidden sm:grid grid-cols-12 bg-accent/30 gap-4 p-4 text-sm font-semibold text-muted-foreground border-b border-border/50">
        <div className="col-span-3">Produto</div>
        <div className="col-span-2">Categoria</div>
        <div className="col-span-2 text-right">Preço de Venda</div>
        <div className="col-span-2 text-right">Estoque</div>
        <div className="col-span-2 text-right">Patrimônio</div>
        <div className="col-span-1" />
      </div>

      {/* Linhas */}
      <div className="divide-y divide-border/50">
        {products.map((product) => {
          const isLowStock = product.stockQuantity <= product.lowStockAlert
          const patrimony = Number(product.salePrice) * product.stockQuantity
          return (
            <div key={product.id} className="p-4">
              {/* Mobile Card */}
              <div className="sm:hidden space-y-2 mb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-slate-950">{product.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {product.category?.name ?? 'Sem categoria'}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      onClick={() => onEdit(product)}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 text-destructive hover:text-destructive"
                      onClick={() => onDelete(product)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <p className="text-muted-foreground">Preço</p>
                    <p className="font-semibold">
                      {formatCurrency(product.salePrice)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Estoque</p>
                    <Badge
                      variant="secondary"
                      className={
                        isLowStock
                          ? 'bg-orange-100 text-orange-700 text-xs'
                          : 'bg-emerald-100 text-emerald-700 text-xs'
                      }
                    >
                      {product.stockQuantity}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Patrimônio</p>
                    <p className="font-semibold">
                      {formatCurrency(patrimony)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Desktop Row */}
              <div className="hidden sm:grid grid-cols-12 gap-4 items-center text-sm">
                <div className="col-span-3 font-semibold text-slate-950">
                  {product.name}
                </div>
                <div className="col-span-2 text-muted-foreground">
                  {product.category?.name ?? '—'}
                </div>
                <div className="col-span-2 text-right font-medium">
                  {formatCurrency(product.salePrice)}
                </div>
                <div className="col-span-2 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <span>{product.stockQuantity}</span>
                    <Badge
                      variant="secondary"
                      className={
                        isLowStock
                          ? 'bg-orange-100 text-orange-700 text-xs'
                          : 'bg-emerald-100 text-emerald-700 text-xs'
                      }
                    >
                      {isLowStock ? 'POUCO' : 'OK'}
                    </Badge>
                  </div>
                </div>
                <div className="col-span-2 text-right font-medium">
                  {formatCurrency(patrimony)}
                </div>
                <div className="col-span-1 flex items-center justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    onClick={() => onEdit(product)}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 text-destructive hover:text-destructive"
                    onClick={() => onDelete(product)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
