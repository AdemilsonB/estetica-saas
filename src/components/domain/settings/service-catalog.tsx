'use client'

import { useState } from 'react'
import { Edit2, Plus, Power } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useDeactivateService, useServices, type Service } from '@/hooks/scheduling/use-services'
import { ServiceFormModal } from './service-form-modal'

export function ServiceCatalog() {
  const { data: services, isLoading, isError } = useServices()
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          {services?.length ?? 0} serviço(s) cadastrado(s)
        </p>
        <Button onClick={handleCreate} size="sm" className="gap-2">
          <Plus className="size-4" />
          Novo serviço
        </Button>
      </div>

      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-2xl" />
          ))}
        </div>
      )}

      {isError && (
        <p className="text-sm text-rose-500">Erro ao carregar serviços.</p>
      )}

      {!isLoading && !isError && services?.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-200 px-6 py-10 text-center">
          <p className="text-sm text-slate-500">Nenhum serviço cadastrado ainda.</p>
          <Button onClick={handleCreate} variant="outline" size="sm" className="mt-3">
            Criar primeiro serviço
          </Button>
        </div>
      )}

      {!isLoading && services && services.length > 0 && (
        <div className="space-y-2">
          {services.map((service) => (
            <div
              key={service.id}
              className="flex items-center gap-4 rounded-2xl border border-white/80 bg-white/85 px-4 py-3 shadow-sm"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-slate-950">{service.name}</span>
                  {!service.active && (
                    <Badge variant="secondary" className="text-xs">Inativo</Badge>
                  )}
                </div>
                <p className="text-xs text-slate-500">
                  {service.duration} min ·{' '}
                  R${Number(service.price).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
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
                    className="size-8 text-slate-400 hover:text-rose-600"
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
