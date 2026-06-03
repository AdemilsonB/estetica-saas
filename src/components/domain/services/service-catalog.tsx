'use client'

import { useState } from 'react'
import { Edit2, Plus, Power } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useDeactivateService, useServices, type Service } from '@/hooks/scheduling/use-services'
import { ServiceFormModal } from './service-form-modal'

export function ServiceCatalog() {
  const { data: services, isLoading, isError, refetch } = useServices()
  const { mutate: deactivate } = useDeactivateService()
  const [modalOpen, setModalOpen] = useState(false)
  const [editingService, setEditingService] = useState<Service | undefined>()

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
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {services?.length ?? 0} serviço(s) cadastrado(s)
        </p>
        <Button onClick={handleCreate} size="sm" className="gap-2">
          <Plus className="size-4" />
          Novo serviço
        </Button>
      </div>

      {services?.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border px-6 py-10 text-center">
          <p className="text-sm text-muted-foreground">Nenhum serviço cadastrado ainda.</p>
          <Button onClick={handleCreate} variant="outline" size="sm" className="mt-3">
            Criar primeiro serviço
          </Button>
        </div>
      )}

      {services && services.length > 0 && (
        <div className="space-y-2">
          {services.map((service) => (
            <div
              key={service.id}
              className="flex items-center gap-4 rounded-2xl border border-border/50 bg-card px-4 py-3 shadow-sm"
            >
              {service.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={service.imageUrl}
                  alt={service.name}
                  className="size-12 shrink-0 rounded-xl object-cover"
                />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground">{service.name}</span>
                  {!service.active && (
                    <Badge variant="secondary" className="text-xs">Inativo</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {service.duration} min ·{' '}
                  {Number(service.price).toLocaleString('pt-BR', {
                    style: 'currency',
                    currency: 'BRL',
                  })}
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
                {service.active && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeactivate(service)}
                    className="size-8 text-muted-foreground hover:text-destructive"
                    title="Desativar"
                  >
                    <Power className="size-3.5" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <ServiceFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        service={editingService}
      />
    </div>
  )
}
