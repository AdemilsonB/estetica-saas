'use client'

import { useState } from 'react'
import { Plus, Tags } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useProducts, useDeleteProduct, type Product } from '@/hooks/inventory/use-products'
import { useProductCategories } from '@/hooks/inventory/use-product-categories'
import { useStockMovements, type StockMovement } from '@/hooks/inventory/use-stock-movements'
import { ProductsTable } from '@/components/domain/inventory/ProductsTable'
import { CategoryManagerModal } from '@/components/domain/inventory/CategoryManagerModal'
import { ProductFormModal } from '@/components/domain/inventory/ProductFormModal'
import { AdjustStockModal } from '@/components/domain/inventory/AdjustStockModal'
import { StockPurchaseModal } from '@/components/domain/inventory/StockPurchaseModal'
import { StockSaleModal } from '@/components/domain/inventory/StockSaleModal'
import { StockMovementsTable } from '@/components/domain/inventory/StockMovementsTable'
import { toast } from 'sonner'

type TableProduct = {
  id: string
  name: string
  category: { id: string; name: string } | null
  salePrice: string
  stockQuantity: number
  lowStockAlert: number
}

export function ProdutosClient() {
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string | undefined>()
  const [page, setPage] = useState(1)
  const [categoryModalOpen, setCategoryModalOpen] = useState(false)
  const [productModalOpen, setProductModalOpen] = useState(false)
  const [purchaseModalOpen, setPurchaseModalOpen] = useState(false)
  const [saleModalOpen, setSaleModalOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [adjustingProduct, setAdjustingProduct] = useState<Product | null>(null)

  const PAGE_SIZE = 10
  const { data: productsData, isLoading: loadingProducts } = useProducts({
    name: search || undefined,
    categoryId: categoryFilter,
    page,
    pageSize: PAGE_SIZE,
  })
  const { data: categories = [] } = useProductCategories()
  const { data: purchasesData } = useStockMovements({ type: 'PURCHASE' })
  const { data: salesData } = useStockMovements({ type: 'SALE' })
  const deleteProduct = useDeleteProduct()

  const products: Product[] = productsData?.data ?? []
  const purchases: StockMovement[] = purchasesData?.data ?? []
  const sales: StockMovement[] = salesData?.data ?? []

  const totalStock = productsData?.totalStock ?? 0
  const totalPatrimony = productsData?.totalPatrimony ?? 0

  async function handleDelete(product: TableProduct) {
    if (!confirm(`Remover "${product.name}" do catálogo?`)) return
    try {
      await deleteProduct.mutateAsync(product.id)
      toast.success('Produto removido do catálogo')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao remover produto')
    }
  }

  function handleEdit(product: TableProduct) {
    const full = products.find((p) => p.id === product.id) ?? null
    setEditingProduct(full)
    setProductModalOpen(true)
  }

  function handleAdjustStock(product: TableProduct) {
    const full = products.find((p) => p.id === product.id) ?? null
    setAdjustingProduct(full)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
          Produtos &amp; Estoque
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Gerencie seu catálogo, estoque e vendas
        </p>
      </div>

      <Tabs defaultValue="produtos">
        <TabsList>
          <TabsTrigger value="produtos">Produtos</TabsTrigger>
          <TabsTrigger value="compras">Compra de Estoque</TabsTrigger>
          <TabsTrigger value="vendas">Vendas</TabsTrigger>
        </TabsList>

        <TabsContent value="produtos" className="space-y-4 mt-4">
          <div className="rounded-xl border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
            Quantidade total em estoque:{' '}
            <strong className="text-foreground">{totalStock}</strong>
            {' · '}
            Patrimônio total:{' '}
            <strong className="text-foreground">
              {totalPatrimony.toLocaleString('pt-BR', {
                style: 'currency',
                currency: 'BRL',
              })}
            </strong>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Input
              placeholder="Buscar produto..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              className="max-w-xs"
            />
            <Select
              onValueChange={(v) => {
                setCategoryFilter(v === 'all' ? undefined : v)
                setPage(1)
              }}
            >
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Todas categorias" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas categorias</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="ml-auto flex gap-2">
              <Button variant="outline" onClick={() => setCategoryModalOpen(true)}>
                <Tags className="mr-2 size-4" />
                CATEGORIAS
              </Button>
              <Button onClick={() => { setEditingProduct(null); setProductModalOpen(true) }}>
                <Plus className="mr-2 size-4" />
                ADICIONAR PRODUTO
              </Button>
            </div>
          </div>

          {loadingProducts ? (
            <div className="py-12 text-center text-sm text-muted-foreground">Carregando...</div>
          ) : (
            <>
              <ProductsTable products={products} onEdit={handleEdit} onDelete={handleDelete} onAdjustStock={handleAdjustStock} />
              {productsData && productsData.total > 0 && (() => {
                const totalPages = Math.ceil(productsData.total / PAGE_SIZE)
                return (
                  <div className="flex items-center justify-between mt-4">
                    <p className="text-sm text-muted-foreground">Página {page} de {totalPages}</p>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Anterior</Button>
                      <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Próxima</Button>
                    </div>
                  </div>
                )
              })()}
            </>
          )}
        </TabsContent>

        <TabsContent value="compras" className="space-y-4 mt-4">
          <div className="flex justify-end">
            <Button onClick={() => setPurchaseModalOpen(true)}>
              <Plus className="mr-2 size-4" />
              REGISTRAR COMPRA
            </Button>
          </div>
          <StockMovementsTable movements={purchases} mode="purchase" />
        </TabsContent>

        <TabsContent value="vendas" className="space-y-4 mt-4">
          <div className="flex justify-end">
            <Button onClick={() => setSaleModalOpen(true)}>
              <Plus className="mr-2 size-4" />
              REGISTRAR VENDA
            </Button>
          </div>
          <StockMovementsTable movements={sales} mode="sale" />
        </TabsContent>
      </Tabs>

      <AdjustStockModal
        open={!!adjustingProduct}
        onClose={() => setAdjustingProduct(null)}
        product={adjustingProduct}
      />
      <CategoryManagerModal open={categoryModalOpen} onClose={() => setCategoryModalOpen(false)} />
      <ProductFormModal
        open={productModalOpen}
        onClose={() => { setProductModalOpen(false); setEditingProduct(null) }}
        product={editingProduct}
      />
      <StockPurchaseModal open={purchaseModalOpen} onClose={() => setPurchaseModalOpen(false)} />
      <StockSaleModal open={saleModalOpen} onClose={() => setSaleModalOpen(false)} />
    </div>
  )
}
