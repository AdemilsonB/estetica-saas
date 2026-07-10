'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, Edit2, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { useServiceCategories, useDeleteCategory, useUpdateCategory, type ServiceCategory } from '@/hooks/scheduling/use-service-categories'
import { CategoryFormModal } from './category-form-modal'

export function CategoryCatalog() {
  const { data: categories = [], isLoading, isError, refetch } = useServiceCategories()
  const { mutate: deleteCategory } = useDeleteCategory()
  const { mutate: updateCategory } = useUpdateCategory()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<ServiceCategory | undefined>()

  function handleMove(cat: ServiceCategory, direction: 'up' | 'down') {
    const newOrder = direction === 'up' ? Math.max(0, cat.order - 1) : cat.order + 1
    updateCategory({ id: cat.id, order: newOrder })
  }

  if (isLoading) {
    return <div className="space-y-2">{[1, 2].map((i) => <Skeleton key={i} className="h-12 w-full rounded-xl" />)}</div>
  }

  if (isError) {
    return (
      <div className="rounded-xl border border-dashed border-destructive/30 px-6 py-8 text-center">
        <p className="text-sm text-destructive">Erro ao carregar categorias.</p>
        <Button onClick={() => refetch()} variant="outline" size="sm" className="mt-2">Tentar novamente</Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{categories.length} categoria(s)</p>
        <Button size="sm" className="gap-2" onClick={() => { setEditing(undefined); setModalOpen(true) }}>
          <Plus className="size-4" />Nova categoria
        </Button>
      </div>

      {categories.length === 0 && (
        <div className="rounded-xl border border-dashed border-border px-6 py-8 text-center">
          <p className="text-sm text-muted-foreground">Nenhuma categoria cadastrada.</p>
          <Button variant="outline" size="sm" className="mt-2" onClick={() => { setEditing(undefined); setModalOpen(true) }}>
            Criar primeira categoria
          </Button>
        </div>
      )}

      {categories.length > 0 && (
        <div className="space-y-2">
          {categories.map((cat, idx) => (
            <div key={cat.id} className="flex items-center gap-3 rounded-xl border border-border/50 bg-card px-4 py-3 shadow-sm">
              <div className="flex flex-col gap-0.5">
                <Button variant="ghost" size="icon" className="size-5" onClick={() => handleMove(cat, 'up')} disabled={idx === 0}>
                  <ChevronUp className="size-3" />
                </Button>
                <Button variant="ghost" size="icon" className="size-5" onClick={() => handleMove(cat, 'down')} disabled={idx === categories.length - 1}>
                  <ChevronDown className="size-3" />
                </Button>
              </div>
              <span className="flex-1 font-medium text-sm">{cat.name}</span>
              <Button variant="ghost" size="icon" className="size-8" onClick={() => { setEditing(cat); setModalOpen(true) }}>
                <Edit2 className="size-3.5" />
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 text-muted-foreground hover:text-destructive"
                    aria-label={`Excluir categoria ${cat.name}`}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Excluir a categoria &quot;{cat.name}&quot;?</AlertDialogTitle>
                    <AlertDialogDescription>
                      A categoria deixa de aparecer para novos serviços. Só é possível excluir
                      categorias sem serviços vinculados — caso contrário, remova o vínculo antes.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive text-white hover:bg-destructive/90"
                      onClick={() =>
                        deleteCategory(cat.id, {
                          onError: (err) =>
                            toast.error(err instanceof Error ? err.message : 'Erro ao remover categoria.'),
                        })
                      }
                    >
                      Excluir
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          ))}
        </div>
      )}

      <CategoryFormModal open={modalOpen} onClose={() => setModalOpen(false)} category={editing} />
    </div>
  )
}
