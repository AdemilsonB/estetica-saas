'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { CurrencyInput } from '@/components/ui/currency-input'
import { useServices } from '@/hooks/scheduling/use-services'
import { useCreatePackage, useUpdatePackage, type ServicePackage } from '@/hooks/scheduling/use-packages'

type Props = {
  open: boolean
  onClose: () => void
  pkg?: ServicePackage
}

export function PackageFormModal({ open, onClose, pkg }: Props) {
  const isEditing = !!pkg
  const { data: services } = useServices()
  const { mutate: create, isPending: creating } = useCreatePackage()
  const { mutate: update, isPending: updating } = useUpdatePackage()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([])

  useEffect(() => {
    if (open && pkg) {
      setName(pkg.name)
      setDescription(pkg.description ?? '')
      setPrice(Number(pkg.price).toFixed(2))
      setSelectedServiceIds(pkg.items.map((i) => i.serviceId))
    } else if (!open) {
      setName('')
      setDescription('')
      setPrice('')
      setSelectedServiceIds([])
    }
  }, [open, pkg])

  function toggleService(id: string) {
    setSelectedServiceIds((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
    )
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const priceNum = parseFloat(price)
    if (isNaN(priceNum) || priceNum <= 0 || selectedServiceIds.length === 0) return

    if (isEditing) {
      update(
        { id: pkg.id, name: name.trim(), description: description.trim() || undefined, price, serviceIds: selectedServiceIds },
        { onSuccess: onClose },
      )
    } else {
      create(
        { name: name.trim(), description: description.trim() || undefined, price, serviceIds: selectedServiceIds },
        { onSuccess: onClose },
      )
    }
  }

  const isPending = creating || updating

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar pacote' : 'Novo pacote'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="pkg-name">Nome do pacote</Label>
            <Input id="pkg-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Combo Corte + Barba" required minLength={2} maxLength={100} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="pkg-description">Descrição (opcional)</Label>
            <Input id="pkg-description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descreva o que está incluído" maxLength={500} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="pkg-price">Preço do pacote</Label>
            <CurrencyInput id="pkg-price" value={price} onChange={setPrice} placeholder="R$ 0,00" required />
          </div>

          <div className="space-y-2">
            <Label>Serviços incluídos <span className="text-destructive">*</span></Label>
            {services?.length === 0 && (
              <p className="text-xs text-muted-foreground">Cadastre serviços primeiro.</p>
            )}
            <div className="max-h-40 space-y-2 overflow-y-auto rounded-xl border border-border p-3">
              {services?.filter((s) => s.active).map((service) => (
                <label key={service.id} className="flex cursor-pointer items-center gap-3">
                  <Checkbox
                    checked={selectedServiceIds.includes(service.id)}
                    onCheckedChange={() => toggleService(service.id)}
                  />
                  <span className="text-sm text-foreground">{service.name}</span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {Number(service.price).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </span>
                </label>
              ))}
            </div>
            {selectedServiceIds.length === 0 && (
              <p className="text-xs text-destructive">Selecione ao menos 1 serviço.</p>
            )}
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">Cancelar</Button>
            <Button type="submit" disabled={isPending || selectedServiceIds.length === 0} className="flex-1">
              {isPending ? 'Salvando...' : isEditing ? 'Salvar' : 'Criar pacote'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
