'use client'

import { useState } from 'react'
import { Edit2, Plus, Power } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { usePackages, useDeactivatePackage, type ServicePackage } from '@/hooks/scheduling/use-packages'
import { PackageFormModal } from './package-form-modal'

const PAGE_SIZE = 10

export function PackageCatalog() {
  const { data: packages, isLoading, isError, refetch } = usePackages()
  const { mutate: deactivate } = useDeactivatePackage()
  const [modalOpen, setModalOpen] = useState(false)
  const [editingPackage, setEditingPackage] = useState<ServicePackage | undefined>()
  const [page, setPage] = useState(1)

  function handleEdit(pkg: ServicePackage) {
    setEditingPackage(pkg)
    setModalOpen(true)
  }

  function handleCreate() {
    setEditingPackage(undefined)
    setModalOpen(true)
  }

  function handleDeactivate(pkg: ServicePackage) {
    if (!confirm(`Desativar pacote "${pkg.name}"?`)) return
    deactivate(pkg.id)
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full rounded-2xl" />)}
      </div>
    )
  }

  if (isError) {
    return (
      <div className="rounded-2xl border border-dashed border-destructive/30 px-6 py-10 text-center">
        <p className="text-sm text-destructive">Erro ao carregar pacotes.</p>
        <Button onClick={() => refetch()} variant="outline" size="sm" className="mt-3">Tentar novamente</Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{packages?.length ?? 0} pacote(s) cadastrado(s)</p>
        <Button onClick={handleCreate} size="sm" className="gap-2">
          <Plus className="size-4" />
          Novo pacote
        </Button>
      </div>

      {packages?.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border px-6 py-10 text-center">
          <p className="text-sm text-muted-foreground">Nenhum pacote cadastrado ainda.</p>
          <Button onClick={handleCreate} variant="outline" size="sm" className="mt-3">Criar primeiro pacote</Button>
        </div>
      )}

      {packages && packages.length > 0 && (
        <>
          <div className="space-y-2">
            {(() => {
              const totalPages = Math.ceil(packages.length / PAGE_SIZE)
              const pageItems = packages.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
              return pageItems.map((pkg) => (
                <div key={pkg.id} className="flex items-center gap-4 rounded-2xl border border-border/50 bg-card px-4 py-3 shadow-sm">
                  {pkg.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={pkg.imageUrl} alt={pkg.name} className="size-12 shrink-0 rounded-xl object-cover" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-foreground">{pkg.name}</span>
                      <Badge variant="secondary" className="text-xs">
                        {pkg.items.length} serviço(s)
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {Number(pkg.price).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </p>
                    {pkg.items.length > 0 && (
                      <p className="mt-0.5 text-xs text-muted-foreground/70">
                        {pkg.items.map((i) => i.service.name).join(' + ')}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(pkg)} className="size-8" title="Editar">
                      <Edit2 className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeactivate(pkg)}
                      className="size-8 text-muted-foreground hover:text-destructive"
                      title="Desativar"
                    >
                      <Power className="size-3.5" />
                    </Button>
                  </div>
                </div>
              ))
            })()}
          </div>

          {(() => {
            const totalPages = Math.ceil(packages.length / PAGE_SIZE)
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

      <PackageFormModal open={modalOpen} onClose={() => setModalOpen(false)} pkg={editingPackage} />
    </div>
  )
}
