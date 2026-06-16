'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useCreateCategory, useUpdateCategory, type ServiceCategory } from '@/hooks/scheduling/use-service-categories'

type Props = {
  open: boolean
  onClose: () => void
  category?: ServiceCategory
}

export function CategoryFormModal({ open, onClose, category }: Props) {
  const isEditing = !!category
  const { mutate: create, isPending: creating } = useCreateCategory()
  const { mutate: update, isPending: updating } = useUpdateCategory()
  const [name, setName] = useState(category?.name ?? '')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (isEditing) {
      update({ id: category.id, name: name.trim() }, { onSuccess: onClose })
    } else {
      create({ name: name.trim() }, { onSuccess: onClose })
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-xs">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar categoria' : 'Nova categoria'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="cat-name">Nome da categoria</Label>
            <Input
              id="cat-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Alisamentos"
              required
              minLength={2}
              maxLength={60}
            />
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1" disabled={creating || updating}>
              Cancelar
            </Button>
            <Button type="submit" className="flex-1" disabled={creating || updating}>
              {creating || updating ? 'Salvando...' : isEditing ? 'Salvar' : 'Criar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
