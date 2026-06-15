'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { CatalogServiceCard } from './CatalogServiceCard'
import { CatalogProductCard } from './CatalogProductCard'

// ---------------------------------------------------------------------------
// Tipos de item do catálogo mestre
// ---------------------------------------------------------------------------

interface CatalogServiceItem {
  id: string
  name: string
  description: string | null
  imageUrl: string | null
  suggestedDuration: number
  suggestedPrice: number
  priceType: 'FIXED' | 'STARTING_FROM'
  category: { name: string } | null
}

interface CatalogProductItem {
  id: string
  name: string
  description: string | null
  imageUrl: string | null
  suggestedPrice: number
  category: { name: string } | null
}

interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface CatalogGridProps {
  type: 'services' | 'products'
  segments?: string[]
  serviceEditBasePath?: string
  productEditBasePath?: string
  activatedCatalogIds?: Set<string>
  /** Mapa catalogItemId → tenantItemId para montar o href de edição */
  activatedIdMap?: Map<string, string>
}

// ---------------------------------------------------------------------------
// Sub-componentes internos
// ---------------------------------------------------------------------------

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="rounded-lg border p-4 space-y-3">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <div className="flex items-center justify-between pt-2">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-8 w-16" />
          </div>
        </div>
      ))}
    </div>
  )
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 py-12 text-center">
      <p className="text-sm text-muted-foreground">
        Erro ao carregar o catálogo. Tente novamente.
      </p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        Tentar novamente
      </Button>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex items-center justify-center py-12">
      <p className="text-sm text-muted-foreground">
        Nenhum item encontrado para os filtros selecionados.
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

export function CatalogGrid({
  type,
  segments,
  serviceEditBasePath,
  productEditBasePath,
  activatedCatalogIds,
  activatedIdMap,
}: CatalogGridProps) {
  const queryClient = useQueryClient()

  // Estado de busca com debounce
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  // IDs sendo ativados no momento (estado otimista local)
  const [activatingIds, setActivatingIds] = useState<Set<string>>(new Set())

  // Debounce: atualiza `search` 300ms após o usuário parar de digitar
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput)
      setPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchInput])

  // ---------------------------------------------------------------------------
  // Query de serviços
  // ---------------------------------------------------------------------------

  const servicesQuery = useQuery<PaginatedResponse<CatalogServiceItem>>({
    queryKey: ['catalog', 'services', { segments, search, page }],
    queryFn: async () => {
      const params = new URLSearchParams()
      segments?.forEach(s => params.append('segments', s))
      if (search) params.set('name', search)
      params.set('page', String(page))
      params.set('pageSize', '20')
      const res = await fetch(`/api/catalog/services?${params}`)
      if (!res.ok) throw new Error('Erro ao carregar catálogo de serviços')
      return res.json() as Promise<PaginatedResponse<CatalogServiceItem>>
    },
    staleTime: Infinity,
    enabled: type === 'services',
  })

  // ---------------------------------------------------------------------------
  // Query de produtos
  // ---------------------------------------------------------------------------

  const productsQuery = useQuery<PaginatedResponse<CatalogProductItem>>({
    queryKey: ['catalog', 'products', { segments, search, page }],
    queryFn: async () => {
      const params = new URLSearchParams()
      segments?.forEach(s => params.append('segments', s))
      if (search) params.set('name', search)
      params.set('page', String(page))
      params.set('pageSize', '20')
      const res = await fetch(`/api/catalog/products?${params}`)
      if (!res.ok) throw new Error('Erro ao carregar catálogo de produtos')
      return res.json() as Promise<PaginatedResponse<CatalogProductItem>>
    },
    staleTime: Infinity,
    enabled: type === 'products',
  })

  // Query ativa de acordo com o tipo
  const activeQuery = type === 'services' ? servicesQuery : productsQuery

  // ---------------------------------------------------------------------------
  // Mutation de ativação
  // ---------------------------------------------------------------------------

  const activateMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/catalog/${type}/${id}/activate`, {
        method: 'POST',
      })
      if (!res.ok) throw new Error('Erro ao ativar item do catálogo')
      return res.json() as Promise<{ id: string; name: string }>
    },
    onMutate: (id) => {
      setActivatingIds(prev => new Set(prev).add(id))
    },
    onSettled: (_data, _error, id) => {
      setActivatingIds(prev => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
      // Invalida a lista de itens do tenant para refletir a ativação
      queryClient.invalidateQueries({
        queryKey: [type === 'services' ? 'services' : 'products'],
      })
    },
  })

  // ---------------------------------------------------------------------------
  // Derived state
  // ---------------------------------------------------------------------------

  const { isLoading, isError, refetch } = activeQuery

  const responseData =
    type === 'services'
      ? servicesQuery.data
      : productsQuery.data

  const hasMore = responseData
    ? responseData.total > responseData.page * responseData.pageSize
    : false

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------

  function buildEditHref(catalogId: string): string | undefined {
    const tenantId = activatedIdMap?.get(catalogId)
    if (!tenantId) return undefined
    const base =
      type === 'services' ? serviceEditBasePath : productEditBasePath
    if (!base) return undefined
    return `${base}/${tenantId}`
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-4">
      {/* Busca */}
      <Input
        placeholder="Buscar..."
        value={searchInput}
        onChange={e => setSearchInput(e.target.value)}
        className="max-w-sm"
      />

      {/* Conteúdo principal */}
      {isLoading ? (
        <SkeletonGrid />
      ) : isError ? (
        <ErrorState onRetry={refetch} />
      ) : type === 'services' ? (
        (() => {
          const items = servicesQuery.data?.data ?? []
          if (items.length === 0) return <EmptyState />
          return (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {items.map(service => (
                  <CatalogServiceCard
                    key={service.id}
                    service={service}
                    isActivated={activatedCatalogIds?.has(service.id) ?? false}
                    activatedHref={buildEditHref(service.id)}
                    onActivate={id => activateMutation.mutate(id)}
                    isActivating={activatingIds.has(service.id)}
                  />
                ))}
              </div>
              {hasMore && (
                <div className="flex justify-center pt-2">
                  <Button
                    variant="outline"
                    onClick={() => setPage(p => p + 1)}
                    disabled={isLoading}
                  >
                    Carregar mais
                  </Button>
                </div>
              )}
            </>
          )
        })()
      ) : (
        (() => {
          const items = productsQuery.data?.data ?? []
          if (items.length === 0) return <EmptyState />
          return (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {items.map(product => (
                  <CatalogProductCard
                    key={product.id}
                    product={product}
                    isActivated={activatedCatalogIds?.has(product.id) ?? false}
                    activatedHref={buildEditHref(product.id)}
                    onActivate={id => activateMutation.mutate(id)}
                    isActivating={activatingIds.has(product.id)}
                  />
                ))}
              </div>
              {hasMore && (
                <div className="flex justify-center pt-2">
                  <Button
                    variant="outline"
                    onClick={() => setPage(p => p + 1)}
                    disabled={isLoading}
                  >
                    Carregar mais
                  </Button>
                </div>
              )}
            </>
          )
        })()
      )}
    </div>
  )
}
