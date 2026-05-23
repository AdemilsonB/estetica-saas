'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useCreateService, useUpdateService, type Service } from '@/hooks/scheduling/use-services'

type Props = {
  open: boolean
  onClose: () => void
  service?: Service
}

export function ServiceFormModal({ open, onClose, service }: Props) {
  const isEditing = !!service
  const { mutate: create, isPending: creating } = useCreateService()
  const { mutate: update, isPending: updating } = useUpdateService()

  const [name, setName] = useState('')
  const [duration, setDuration] = useState('60')
  const [price, setPrice] = useState('')

  useEffect(() => {
    if (open && service) {
      setName(service.name)
      setDuration(String(service.duration))
      setPrice(String(Number(service.price)))
    } else if (!open) {
      setName('')
      setDuration('60')
      setPrice('')
    }
  }, [open, service])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const durationNum = parseInt(duration, 10)
    const priceNum = parseFloat(price)
    if (isNaN(durationNum) || isNaN(priceNum)) return

    if (isEditing) {
      update(
        { id: service.id, name: name.trim(), duration: durationNum, price: priceNum },
        { onSuccess: onClose },
      )
    } else {
      create(
        { name: name.trim(), duration: durationNum, price: priceNum },
        { onSuccess: onClose },
      )
    }
  }

  const isPending = creating || updating

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar serviço' : 'Novo serviço'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="service-name">Nome do serviço</Label>
            <Input
              id="service-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Corte masculino"
              required
              minLength={2}
              maxLength={100}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="service-duration">Duração (min)</Label>
              <Input
                id="service-duration"
                type="number"
                min={5}
                max={480}
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="service-price">Preço (R$)</Label>
              <Input
                id="service-price"
                type="number"
                min={0.01}
                step={0.01}
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0,00"
                required
              />
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending} className="flex-1">
              {isPending ? 'Salvando...' : isEditing ? 'Salvar' : 'Criar serviço'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
