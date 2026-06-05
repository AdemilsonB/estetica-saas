'use client'

import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  useProductCategories,
  useCreateCategory,
  useDeleteCategory,
} from '@/hooks/inventory/use-product-categories'

type Props = { open: boolean; onClose: () => void }

export function CategoryManagerModal({ open, onClose }: Props) {
  const [name, setName] = useState('')
  const { data: categories = [], isLoading } = useProductCategories()
  const createCategory = useCreateCategory()
  const deleteCategory = useDeleteCategory()

  async function handleCreate() {
    if (!name.trim()) return
    try {
      await createCategory.mutateAsync(name.trim())
      setName('')
      toast.success('Categoria criada')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao criar categoria')
    }
  }

  async function handleDelete(id: string, catName: string) {
    try {
      await deleteCategory.mutateAsync(id)
      toast.success(`Categoria "${catName}" removida`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao remover categoria')
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Gerenciar Categorias</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Nome da categoria"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            />
            <Button
              onClick={handleCreate}
              disabled={createCategory.isPending || !name.trim()}
            >
              <Plus className="size-4" />
            </Button>
          </div>

          <div className="max-h-60 overflow-y-auto space-y-1">
            {isLoading && (
              <p className="text-sm text-muted-foreground">Carregando...</p>
            )}
            {(categories as Array<{ id: string; name: string }>).map((cat) => (
              <div
                key={cat.id}
                className="flex items-center justify-between rounded-lg border px-3 py-2"
              >
                <span className="text-sm">{cat.name}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 text-destructive hover:text-destructive"
                  onClick={() => handleDelete(cat.id, cat.name)}
                  disabled={deleteCategory.isPending}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ))}
            {!isLoading && categories.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhuma categoria cadastrada
              </p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
