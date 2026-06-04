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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { useServices } from '@/hooks/scheduling/use-services'
import { useCustomersSearch } from '@/hooks/crm/use-customers-search'
import { useCreateAppointment } from '@/hooks/scheduling/use-appointments'
import { useAvailableSlots } from '@/hooks/scheduling/use-availability'
import { useTeamMembers } from '@/hooks/iam/use-team'
import { useCurrentUser } from '@/hooks/use-current-user'
import { usePermissions } from '@/hooks/use-permissions'

type Props = {
  open: boolean
  onClose: () => void
  defaultDate?: string
}

function toDateInput(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export function CreateAppointmentModal({ open, onClose, defaultDate }: Props) {
  const { data: currentUser } = useCurrentUser()
  const { can } = usePermissions()
  const { data: services = [] } = useServices()
  const { data: teamMembers = [] } = useTeamMembers()
  const createAppointment = useCreateAppointment()

  const canManage = can('agenda', 'edit')

  const [professionalId, setProfessionalId] = useState('')
  const [serviceId, setServiceId] = useState('')
  const [date, setDate] = useState(defaultDate ?? toDateInput(new Date()))
  const [selectedTime, setSelectedTime] = useState('')
  const [customerSearch, setCustomerSearch] = useState('')
  const [customerId, setCustomerId] = useState('')
  const [allowOverlap, setAllowOverlap] = useState(false)

  const { data: customers = [], isLoading: searchingCustomers } =
    useCustomersSearch(customerSearch)

  const { data: slots = [], isLoading: loadingSlots } = useAvailableSlots(
    professionalId || null,
    date || null,
    serviceId || null,
  )

  useEffect(() => {
    if (currentUser && !canManage) {
      setProfessionalId(currentUser.id)
    }
  }, [currentUser, canManage])

  useEffect(() => {
    if (defaultDate) setDate(defaultDate)
  }, [defaultDate])

  useEffect(() => {
    setSelectedTime('')
  }, [professionalId, date, serviceId])

  function handleClose() {
    setProfessionalId(canManage ? '' : (currentUser?.id ?? ''))
    setServiceId('')
    setDate(toDateInput(new Date()))
    setSelectedTime('')
    setCustomerSearch('')
    setCustomerId('')
    setAllowOverlap(false)
    onClose()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!customerId || !serviceId || !professionalId || !date || !selectedTime) return

    const startsAt = new Date(`${date}T${selectedTime}:00`).toISOString()

    createAppointment.mutate(
      {
        customerId,
        professionalId,
        serviceId,
        startsAt,
        allowOverlap,
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
  const selectedCustomer = customers.find((c) => c.id === customerId)
  const professionals = teamMembers.filter((m) =>
    ['OWNER', 'MANAGER', 'PROFESSIONAL'].includes(m.role),
  )

  const visibleSlots = allowOverlap ? slots : slots.filter((s) => s.available)
  const isFormValid = customerId && serviceId && professionalId && date && selectedTime

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo agendamento</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          {canManage && (
            <div className="space-y-2">
              <Label>Profissional</Label>
              <Select value={professionalId} onValueChange={setProfessionalId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar profissional" />
                </SelectTrigger>
                <SelectContent>
                  {professionals.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label>Serviço</Label>
            <Select value={serviceId} onValueChange={setServiceId}>
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

          <div className="space-y-2">
            <Label htmlFor="apt-date">Data</Label>
            <Input
              id="apt-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>

          {professionalId && serviceId && date && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Horário</Label>
                {canManage && (
                  <div className="flex items-center gap-2">
                    <Switch
                      id="allow-overlap"
                      checked={allowOverlap}
                      onCheckedChange={setAllowOverlap}
                    />
                    <Label htmlFor="allow-overlap" className="text-xs text-slate-500 cursor-pointer">
                      Autorizar conflito
                    </Label>
                  </div>
                )}
              </div>

              {loadingSlots ? (
                <div className="grid grid-cols-4 gap-2">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 rounded-xl" />
                  ))}
                </div>
              ) : visibleSlots.length === 0 ? (
                <p className="text-sm text-slate-500 py-2">
                  Nenhum horário disponível neste dia.
                </p>
              ) : (
                <div className="grid grid-cols-4 gap-2">
                  {visibleSlots.map((slot) => (
                    <button
                      key={slot.time}
                      type="button"
                      onClick={() => setSelectedTime(slot.time)}
                      className={cn(
                        'rounded-xl border px-2 py-2 text-sm font-medium transition',
                        selectedTime === slot.time
                          ? 'border-rose-500 bg-rose-50 text-rose-700'
                          : slot.available
                          ? 'border-slate-200 bg-white text-slate-700 hover:border-rose-300 hover:bg-rose-50'
                          : 'border-slate-200 bg-slate-50 text-slate-400 line-through',
                      )}
                    >
                      {slot.time}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label>Cliente</Label>
            <Input
              placeholder="Buscar por nome ou telefone..."
              value={selectedCustomer ? selectedCustomer.name : customerSearch}
              onChange={(e) => {
                setCustomerSearch(e.target.value)
                setCustomerId('')
              }}
            />
            {customerSearch.length >= 2 && !customerId && (
              <div className="rounded-xl border bg-white shadow-sm max-h-40 overflow-y-auto">
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
                        setCustomerId(c.id)
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

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={!isFormValid || createAppointment.isPending}
            >
              {createAppointment.isPending ? 'Criando...' : 'Criar agendamento'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
