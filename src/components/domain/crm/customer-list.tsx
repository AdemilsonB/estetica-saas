'use client'

import { useState, useEffect } from 'react'
import { Plus, Search, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { CustomerCard } from './customer-card'
import { CreateCustomerModal } from './create-customer-modal'
import { FilterBar } from './filter-bar'
import { useCustomers, type CustomerListParams } from '@/hooks/crm/use-customers'
import { usePermissions } from '@/hooks/use-permissions'

function useDebounce(value: string, delay: number) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}

export function CustomerList() {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [createOpen, setCreateOpen] = useState(false)
  const [advancedFilters, setAdvancedFilters] = useState<CustomerListParams>({})
  const { can } = usePermissions()

  const debouncedSearch = useDebounce(search, 300)

  const params: CustomerListParams = {
    search: debouncedSearch || undefined,
    page,
    pageSize: 10,
    ...advancedFilters,
  }

  const { data, isLoading, isError, refetch } = useCustomers(params)
  const totalPages = data ? Math.ceil(data.total / data.pageSize) : 1

  const activeFilterCount = Object.values(advancedFilters).filter(
    (v) => v != null && v !== false,
  ).length

  function handleFilterChange(filters: CustomerListParams) {
    setAdvancedFilters(filters)
    setPage(1)
  }

  return (
    <div className="space-y-4">
      {/* Barra de ações */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Buscar por nome ou telefone..."
            className="pl-9"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
          />
        </div>
        {can('clientes', 'create') && (
          <Button
            onClick={() => setCreateOpen(true)}
            className="shrink-0 rounded-full bg-slate-950 text-white hover:bg-slate-800"
          >
            <Plus className="size-4" />
            <span className="hidden sm:inline">Novo cliente</span>
          </Button>
        )}
      </div>

      {/* FilterBar */}
      <FilterBar filters={advancedFilters} onChange={handleFilterChange} />

      {/* Lista */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-2xl" />
          ))}
        </div>
      ) : isError ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
          <p className="text-sm text-red-600">Erro ao carregar clientes.</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => refetch()}>
            Tentar novamente
          </Button>
        </div>
      ) : !data || data.data.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white/60 py-16 text-center">
          <Users className="size-10 text-slate-300" />
          <p className="mt-4 text-sm font-medium text-slate-500">
            {debouncedSearch || activeFilterCount > 0
              ? 'Nenhum cliente encontrado para esta busca'
              : 'Nenhum cliente cadastrado ainda'}
          </p>
          {!debouncedSearch && activeFilterCount === 0 && can('clientes', 'create') && (
            <Button
              variant="outline"
              size="sm"
              className="mt-4 rounded-full"
              onClick={() => setCreateOpen(true)}
            >
              <Plus className="size-4" />
              Cadastrar primeiro cliente
            </Button>
          )}
        </div>
      ) : (
        <>
          {data.data.length > 0 && (
            <p className="text-xs text-muted-foreground mb-2">
              {data.data.length} cliente{data.data.length !== 1 ? 's' : ''} encontrado{data.data.length !== 1 ? 's' : ''}
            </p>
          )}
          <div className="space-y-3">
            {data.data.map((customer) => (
              <CustomerCard key={customer.id} customer={customer} />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => p - 1)}
                disabled={page <= 1}
              >
                Anterior
              </Button>
              <span className="text-xs text-slate-500">
                {page} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= totalPages}
              >
                Próxima
              </Button>
            </div>
          )}
        </>
      )}

      <CreateCustomerModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  )
}
