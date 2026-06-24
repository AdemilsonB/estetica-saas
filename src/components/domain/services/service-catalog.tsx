'use client'

import { useState } from 'react'
import { Edit2, Plus, Power } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useActivateService, useDeactivateService, useServices, type Service } from '@/hooks/scheduling/use-services'
import { useServiceCategories } from '@/hooks/scheduling/use-service-categories'
import { EntityImage } from '@/components/domain/shared/entity-image'
import { ServiceFormModal } from './service-form-modal'

const PAGE_SIZE = 10

export function ServiceCatalog() {
  const { data: services, isLoading, isError, refetch } = useServices()
  const { data: categories = [] } = useServiceCategories()
  const { mutate: deactivate } = useDeactivateService()
  const { mutate: activate } = useActivateService()
  const [modalOpen, setModalOpen] = useState(false)
  const [editingService, setEditingService] = useState<Service | undefined>()
  const [page, setPage] = useState(1)
  const [categoryFilter, setCategoryFilter] = useState<string | undefined>()

  const filteredServices = services?.filter(
    (service) => !categoryFilter || service.categoryId === categoryFilter,
  )

  function handleEdit(service: Service) {
    setEditingService(service)
    setModalOpen(true)
  }

  function handleCreate() {
    setEditingService(undefined)
    setModalOpen(true)
  }

  function handleDeactivate(service: Service) {
    if (!confirm(`Desativar "${service.name}"?`)) return
    deactivate(service.id)
  }

  function handleActivate(service: Service) {
    if (!confirm(`Reativar "${service.name}"?`)) return
    activate(service.id)
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20 w-full rounded-2xl" />
        ))}
      </div>
    )
  }

  if (isError) {
    return (
      <div className="rounded-2xl border border-dashed border-destructive/30 px-6 py-10 text-center">
        <p className="text-sm text-destructive">Erro ao carregar serviços.</p>
        <Button onClick={() => refetch()} variant="outline" size="sm" className="mt-3">
          Tentar novamente
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {filteredServices?.length ?? 0} serviço(s) cadastrado(s)
        </p>
        <Button onClick={handleCreate} size="sm" className="gap-2">
          <Plus className="size-4" />
          Novo serviço
        </Button>
      </div>

      {services && services.length > 0 && (
        <Select
          value={categoryFilter ?? 'all'}
          onValueChange={(v) => {
            setCategoryFilter(v === 'all' ? undefined : v)
            setPage(1)
          }}
        >
          <SelectTrigger className="w-full sm:w-52">
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
      )}

      {services?.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border px-6 py-10 text-center">
          <p className="text-sm text-muted-foreground">Nenhum serviço cadastrado ainda.</p>
          <Button onClick={handleCreate} variant="outline" size="sm" className="mt-3">
            Criar primeiro serviço
          </Button>
        </div>
      )}

      {services && services.length > 0 && filteredServices?.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border px-6 py-10 text-center">
          <p className="text-sm text-muted-foreground">Nenhum serviço encontrado nesta categoria.</p>
        </div>
      )}

      {filteredServices && filteredServices.length > 0 && (
        <>
          <div className="space-y-2">
            {(() => {
              const totalPages = Math.ceil(filteredServices.length / PAGE_SIZE)
              const pageItems = filteredServices.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
              return pageItems.map((service) => (
                <div
                  key={service.id}
                  className="flex items-center gap-4 rounded-2xl border border-border/50 bg-card px-4 py-3 shadow-sm"
                >
                  {service.imageUrl && (
                    <EntityImage
                      src={service.imageUrl}
                      alt={service.name}
                      shape="square"
                      cropX={service.imageCropX}
                      cropY={service.imageCropY}
                      cropZoom={service.imageCropZoom}
                      className="size-12 shrink-0 rounded-xl"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">{service.name}</span>
                      {service.category && (
                        <Badge variant="outline" className="text-xs font-normal">{service.category.name}</Badge>
                      )}
                      {!service.active && (
                        <Badge variant="secondary" className="text-xs">Inativo</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {service.duration} min ·{' '}
                      {service.priceType === 'STARTING_FROM'
                        ? `A partir de ${Number(service.price).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`
                        : Number(service.price).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(service)}
                      className="size-8"
                      title="Editar"
                    >
                      <Edit2 className="size-3.5" />
                    </Button>
                    {service.active ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeactivate(service)}
                        className="size-8 text-muted-foreground hover:text-destructive"
                        title="Desativar"
                      >
                        <Power className="size-3.5" />
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleActivate(service)}
                        className="size-8 text-muted-foreground hover:text-green-600"
                        title="Reativar"
                      >
                        <Power className="size-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              ))
            })()}
          </div>

          {(() => {
            const totalPages = Math.ceil(filteredServices.length / PAGE_SIZE)
            return totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-muted-foreground">
                  Página {page} de {totalPages}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page === 1}
                    onClick={() => setPage(p => p - 1)}
                  >
                    Anterior
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage(p => p + 1)}
                  >
                    Próxima
                  </Button>
                </div>
              </div>
            )
          })()}
        </>
      )}

      <ServiceFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        service={editingService}
      />
    </div>
  )
}
