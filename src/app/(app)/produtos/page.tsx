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
import { StockPurchaseModal } from '@/components/domain/inventory/StockPurchaseModal'
import { StockSaleModal } from '@/components/domain/inventory/StockSaleModal'
import { StockMovementsTable } from '@/components/domain/inventory/StockMovementsTable'
import { toast } from 'sonner'

// Subconjunto compatível com ProductsTable (que declara seu próprio tipo local)
type TableProduct = {
  id: string
  name: string
  category: { id: string; name: string } | null
  salePrice: string
  stockQuantity: number
  lowStockAlert: number
}

export default function ProdutosPage() {
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string | undefined>()
  const [categoryModalOpen, setCategoryModalOpen] = useState(false)
  const [productModalOpen, setProductModalOpen] = useState(false)
  const [purchaseModalOpen, setPurchaseModalOpen] = useState(false)
  const [saleModalOpen, setSaleModalOpen] = useState(false)
  // Product do hook é superconjunto do tipo local do ProductFormModal — compatível
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)

  const { data: productsData, isLoading: loadingProducts } = useProducts({
    name: search || undefined,
    categoryId: categoryFilter,
  })
  const { data: categories = [] } = useProductCategories()
  const { data: purchasesData } = useStockMovements({ type: 'PURCHASE' })
  const { data: salesData } = useStockMovements({ type: 'SALE' })
  const deleteProduct = useDeleteProduct()

  const products: Product[] = productsData?.data ?? []
  const purchases: StockMovement[] = purchasesData?.data ?? []
  const sales: StockMovement[] = salesData?.data ?? []

  const totalStock = products.reduce((acc, p) => acc + p.stockQuantity, 0)
  const totalPatrimony = products.reduce(
    (acc, p) => acc + Number(p.salePrice) * p.stockQuantity,
    0,
  )

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
    // O array products contém Product completo (superconjunto); buscamos pelo id
    const full = products.find((p) => p.id === product.id) ?? null
    setEditingProduct(full)
    setProductModalOpen(true)
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

        {/* ─── Aba Produtos ─── */}
        <TabsContent value="produtos" className="space-y-4 mt-4">
          {/* Resumo */}
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

          {/* Filtros e ações */}
          <div className="flex flex-wrap items-center gap-3">
            <Input
              placeholder="Buscar produto..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-xs"
            />
            <Select
              onValueChange={(v) => setCategoryFilter(v === 'all' ? undefined : v)}
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
              <Button
                variant="outline"
                onClick={() => setCategoryModalOpen(true)}
              >
                <Tags className="mr-2 size-4" />
                CATEGORIAS
              </Button>
              <Button
                onClick={() => {
                  setEditingProduct(null)
                  setProductModalOpen(true)
                }}
              >
                <Plus className="mr-2 size-4" />
                ADICIONAR PRODUTO
              </Button>
            </div>
          </div>

          {loadingProducts ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Carregando...
            </div>
          ) : (
            <ProductsTable
              products={products}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          )}
        </TabsContent>

        {/* ─── Aba Compras ─── */}
        <TabsContent value="compras" className="space-y-4 mt-4">
          <div className="flex justify-end">
            <Button onClick={() => setPurchaseModalOpen(true)}>
              <Plus className="mr-2 size-4" />
              REGISTRAR COMPRA
            </Button>
          </div>
          <StockMovementsTable movements={purchases} mode="purchase" />
        </TabsContent>

        {/* ─── Aba Vendas ─── */}
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

      <CategoryManagerModal
        open={categoryModalOpen}
        onClose={() => setCategoryModalOpen(false)}
      />
      <ProductFormModal
        open={productModalOpen}
        onClose={() => {
          setProductModalOpen(false)
          setEditingProduct(null)
        }}
        product={editingProduct}
      />
      <StockPurchaseModal
        open={purchaseModalOpen}
        onClose={() => setPurchaseModalOpen(false)}
      />
      <StockSaleModal
        open={saleModalOpen}
        onClose={() => setSaleModalOpen(false)}
      />
    </div>
  )
}
