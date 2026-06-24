'use client'

import { useState, useEffect } from 'react'
import { Plus, Pencil, PowerOff, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { CatalogServiceSheet } from '@/components/admin/catalog/CatalogServiceSheet'
import { CatalogProductSheet } from '@/components/admin/catalog/CatalogProductSheet'
import {
  useAdminCatalogServices,
  useAdminCatalogProducts,
  useAdminCatalogCategories,
  useDeactivateCatalogService,
  useDeactivateCatalogProduct,
  useUpdateCatalogService,
  useUpdateCatalogProduct,
  type CatalogServiceItem,
  type CatalogProductItem,
} from '@/hooks/admin/use-admin-catalog'

const SEGMENT_LABEL: Record<string, string> = {
  HAIR_SALON: 'Salão', BARBERSHOP: 'Barbearia',
  NAIL_DESIGN: 'Nail Design', AESTHETICS: 'Estética',
}

const formatBRL = (v: number | string) =>
  Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const formatDuration = (min: number) =>
  min < 60 ? `${min}min` : min % 60 === 0 ? `${min / 60}h` : `${Math.floor(min / 60)}h${min % 60}min`

function SegmentBadges({ segments }: { segments: string[] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {segments.map(s => (
        <span key={s} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
          {SEGMENT_LABEL[s] ?? s}
        </span>
      ))}
    </div>
  )
}

function TableSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 8 }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full rounded-lg" />
      ))}
    </div>
  )
}

export default function AdminCatalogoPage() {
  const { data: categories } = useAdminCatalogCategories()

  const [nameInput, setNameInput] = useState('')
  const [name, setName] = useState('')
  const [showInactive, setShowInactive] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setName(nameInput), 300)
    return () => clearTimeout(t)
  }, [nameInput])

  const [serviceSheet, setServiceSheet] = useState<{ open: boolean; item?: CatalogServiceItem | null }>({ open: false })
  const [productSheet, setProductSheet] = useState<{ open: boolean; item?: CatalogProductItem | null }>({ open: false })

  const serviceFilters = { name: name || undefined, active: showInactive ? undefined : true, pageSize: 100 }
  const productFilters = { name: name || undefined, active: showInactive ? undefined : true, pageSize: 100 }

  const { data: servicesData, isLoading: sLoading } = useAdminCatalogServices(serviceFilters)
  const { data: productsData, isLoading: pLoading } = useAdminCatalogProducts(productFilters)

  const deactivateService = useDeactivateCatalogService()
  const deactivateProduct = useDeactivateCatalogProduct()
  const updateService = useUpdateCatalogService()
  const updateProduct = useUpdateCatalogProduct()

  async function handleReactivateService(id: string) {
    try {
      await updateService.mutateAsync({ id, active: true })
      toast.success('Serviço reativado!')
    } catch {
      toast.error('Erro ao reativar serviço')
    }
  }

  async function handleReactivateProduct(id: string) {
    try {
      await updateProduct.mutateAsync({ id, active: true })
      toast.success('Produto reativado!')
    } catch {
      toast.error('Erro ao reativar produto')
    }
  }

  async function handleDeactivateService(id: string) {
    try {
      await deactivateService.mutateAsync(id)
      toast.success('Serviço desativado!')
    } catch {
      toast.error('Erro ao desativar serviço')
    }
  }

  async function handleDeactivateProduct(id: string) {
    try {
      await deactivateProduct.mutateAsync(id)
      toast.success('Produto desativado!')
    } catch {
      toast.error('Erro ao desativar produto')
    }
  }

  const services = servicesData?.data ?? []
  const products = productsData?.data ?? []

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-slate-950">Catálogo Mestre</h1>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        <Input
          placeholder="Buscar por nome..."
          value={nameInput}
          onChange={e => setNameInput(e.target.value)}
          className="w-full sm:w-64"
        />
        <div className="flex items-center gap-2">
          <Switch id="inactive" checked={showInactive} onCheckedChange={setShowInactive} />
          <Label htmlFor="inactive" className="text-sm text-slate-600">Mostrar inativos</Label>
        </div>
      </div>

      <Tabs defaultValue="services">
        <TabsList>
          <TabsTrigger value="services">
            Serviços {servicesData && <span className="ml-1.5 text-xs text-slate-400">({servicesData.total})</span>}
          </TabsTrigger>
          <TabsTrigger value="products">
            Produtos {productsData && <span className="ml-1.5 text-xs text-slate-400">({productsData.total})</span>}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="services" className="space-y-4 pt-4">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setServiceSheet({ open: true, item: null })}>
              <Plus className="size-4 mr-1.5" /> Novo Serviço
            </Button>
          </div>
          {sLoading ? <TableSkeleton /> : (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-100 bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-slate-500">Nome</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-500">Categoria</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-500">Segmentos</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-500">Duração</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-500">Preço</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-500">Status</th>
                    <th className="px-4 py-3 text-right font-medium text-slate-500">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {services.length === 0 ? (
                    <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">Nenhum serviço encontrado</td></tr>
                  ) : services.map(s => (
                    <tr key={s.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-slate-900">{s.name}</p>
                          <p className="text-xs text-slate-400">{s.slug}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{s.category?.name ?? '—'}</td>
                      <td className="px-4 py-3"><SegmentBadges segments={s.segments} /></td>
                      <td className="px-4 py-3 text-slate-600">{formatDuration(s.suggestedDuration)}</td>
                      <td className="px-4 py-3 text-slate-600">
                        {s.priceType === 'STARTING_FROM' ? `A partir de ${formatBRL(s.suggestedPrice)}` : formatBRL(s.suggestedPrice)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${s.active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                          {s.active ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button size="icon" variant="ghost" className="size-8"
                            onClick={() => setServiceSheet({ open: true, item: s })}>
                            <Pencil className="size-3.5" />
                          </Button>
                          {s.active ? (
                            <Button size="icon" variant="ghost" className="size-8 text-red-500 hover:text-red-600"
                              onClick={() => handleDeactivateService(s.id)}>
                              <PowerOff className="size-3.5" />
                            </Button>
                          ) : (
                            <Button size="icon" variant="ghost" className="size-8 text-green-600 hover:text-green-700"
                              onClick={() => handleReactivateService(s.id)}>
                              <RotateCcw className="size-3.5" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="products" className="space-y-4 pt-4">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setProductSheet({ open: true, item: null })}>
              <Plus className="size-4 mr-1.5" /> Novo Produto
            </Button>
          </div>
          {pLoading ? <TableSkeleton /> : (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-100 bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-slate-500">Nome</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-500">Categoria</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-500">Segmentos</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-500">Preço</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-500">Status</th>
                    <th className="px-4 py-3 text-right font-medium text-slate-500">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {products.length === 0 ? (
                    <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">Nenhum produto encontrado</td></tr>
                  ) : products.map(p => (
                    <tr key={p.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-slate-900">{p.name}</p>
                          <p className="text-xs text-slate-400">{p.slug}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{p.category?.name ?? '—'}</td>
                      <td className="px-4 py-3"><SegmentBadges segments={p.segments} /></td>
                      <td className="px-4 py-3 text-slate-600">{formatBRL(p.suggestedPrice)}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${p.active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                          {p.active ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button size="icon" variant="ghost" className="size-8"
                            onClick={() => setProductSheet({ open: true, item: p })}>
                            <Pencil className="size-3.5" />
                          </Button>
                          {p.active ? (
                            <Button size="icon" variant="ghost" className="size-8 text-red-500 hover:text-red-600"
                              onClick={() => handleDeactivateProduct(p.id)}>
                              <PowerOff className="size-3.5" />
                            </Button>
                          ) : (
                            <Button size="icon" variant="ghost" className="size-8 text-green-600 hover:text-green-700"
                              onClick={() => handleReactivateProduct(p.id)}>
                              <RotateCcw className="size-3.5" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <CatalogServiceSheet
        open={serviceSheet.open}
        item={serviceSheet.item}
        categories={categories?.services ?? []}
        onClose={() => setServiceSheet({ open: false })}
      />
      <CatalogProductSheet
        open={productSheet.open}
        item={productSheet.item}
        categories={categories?.products ?? []}
        onClose={() => setProductSheet({ open: false })}
      />
    </div>
  )
}
