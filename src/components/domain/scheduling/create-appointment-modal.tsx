'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { useServices } from '@/hooks/scheduling/use-services'
import { useCustomersSearch } from '@/hooks/crm/use-customers-search'
import { useCreateAppointment } from '@/hooks/scheduling/use-appointments'
import { useCurrentUser } from '@/hooks/use-current-user'

type Props = {
  open: boolean
  onClose: () => void
  defaultStartsAt?: string
}

export function CreateAppointmentModal({ open, onClose, defaultStartsAt }: Props) {
  const { data: currentUser } = useCurrentUser()
  const { data: services = [] } = useServices()
  const createAppointment = useCreateAppointment()

  const [customerSearch, setCustomerSearch] = useState('')
  const [selectedCustomerId, setSelectedCustomerId] = useState('')
  const [selectedServiceId, setSelectedServiceId] = useState('')
  const [startsAt, setStartsAt] = useState(defaultStartsAt ?? '')

  const { data: customers = [], isLoading: searchingCustomers } =
    useCustomersSearch(customerSearch)

  useEffect(() => {
    if (defaultStartsAt) setStartsAt(defaultStartsAt)
  }, [defaultStartsAt])

  function handleClose() {
    setCustomerSearch('')
    setSelectedCustomerId('')
    setSelectedServiceId('')
    setStartsAt('')
    onClose()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedCustomerId || !selectedServiceId || !startsAt || !currentUser) return

    createAppointment.mutate(
      {
        customerId: selectedCustomerId,
        professionalId: currentUser.id,
        serviceId: selectedServiceId,
        startsAt: new Date(startsAt).toISOString(),
      },
      {
        onSuccess: () => {
          toast.success('Agendamento criado com sucesso')
          handleClose()
        },
        onError: (err) => {
          toast.error(err instanceof Error ? err.message : 'Erro ao criar agendamento')
        },
      },
    )
  }

  const activeServices = services.filter((s) => s.active)
  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId)

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Novo agendamento</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Passo 1: Cliente */}
          <div className="space-y-2">
            <Label>Cliente</Label>
            <Input
              placeholder="Buscar por nome ou telefone..."
              value={selectedCustomer ? selectedCustomer.name : customerSearch}
              onChange={(e) => {
                setCustomerSearch(e.target.value)
                setSelectedCustomerId('')
              }}
            />
            {customerSearch.length >= 2 && !selectedCustomerId && (
              <div className="rounded-xl border bg-white shadow-sm">
                {searchingCustomers ? (
                  <p className="p-3 text-sm text-slate-500">Buscando...</p>
                ) : customers.length === 0 ? (
                  <p className="p-3 text-sm text-slate-500">Nenhum cliente encontrado</p>
                ) : (
                  customers.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setSelectedCustomerId(c.id)
                        setCustomerSearch(c.name)
                      }}
                      className="w-full px-4 py-2 text-left text-sm hover:bg-rose-50"
                    >
                      <span className="font-medium">{c.name}</span>
                      {c.phone && (
                        <span className="ml-2 text-slate-400">{c.phone}</span>
                      )}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Passo 2: Serviço */}
          <div className="space-y-2">
            <Label>Serviço</Label>
            <Select value={selectedServiceId} onValueChange={setSelectedServiceId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecionar serviço" />
              </SelectTrigger>
              <SelectContent>
                {activeServices.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name} · {s.duration}min · R${Number(s.price).toFixed(2)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Passo 3: Horário */}
          <div className="space-y-2">
            <Label>Data e horário</Label>
            <Input
              type="datetime-local"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
              required
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={
                !selectedCustomerId ||
                !selectedServiceId ||
                !startsAt ||
                createAppointment.isPending
              }
              className="bg-slate-950 text-white hover:bg-slate-800"
            >
              {createAppointment.isPending ? 'Criando...' : 'Criar agendamento'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
