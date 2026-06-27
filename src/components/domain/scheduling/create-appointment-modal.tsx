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
import { Textarea } from '@/components/ui/textarea'
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
import { useServiceCategories } from '@/hooks/scheduling/use-service-categories'
import { ServicePickerWithCategories } from '@/components/domain/services/service-picker-with-categories'
import { useCustomersSearch } from '@/hooks/crm/use-customers-search'
import { useCreateAppointment } from '@/hooks/scheduling/use-appointments'
import { useAvailableSlots } from '@/hooks/scheduling/use-availability'
import { useTeamMembers, useProfessionalsByService } from '@/hooks/iam/use-team'
import { useCurrentUser } from '@/hooks/use-current-user'
import { usePermissions } from '@/hooks/use-permissions'

type Props = {
  open: boolean
  onClose: () => void
  defaultDate?: string
  defaultCustomerId?: string
  defaultCustomerName?: string
}

function toDateInput(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function formatDateLabel(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  })
}

function formatHour(time: string): string {
  return time.replace(':', 'h')
}

const CONFIRM_TEMPLATE =
  'Olá, {nome}! Seu agendamento de {serviço} foi criado para {data} às {hora} com {profissional}. Te esperamos! 🤍'

function renderConfirmTemplate(params: {
  nome: string
  serviço: string
  data: string
  hora: string
  profissional: string
}): string {
  return CONFIRM_TEMPLATE
    .replace('{nome}', params.nome)
    .replace('{serviço}', params.serviço)
    .replace('{data}', params.data)
    .replace('{hora}', params.hora)
    .replace('{profissional}', params.profissional)
}

export function CreateAppointmentModal({ open, onClose, defaultDate, defaultCustomerId, defaultCustomerName }: Props) {
  const { data: currentUser } = useCurrentUser()
  const { can } = usePermissions()
  const { data: services = [] } = useServices()
  const { data: categories = [] } = useServiceCategories()
  const { data: teamMembers = [] } = useTeamMembers()
  const createAppointment = useCreateAppointment()

  const canManage = can('agenda', 'edit')

  const [professionalId, setProfessionalId] = useState('')
  const [serviceId, setServiceId] = useState('')
  const [date, setDate] = useState(defaultDate ?? toDateInput(new Date()))
  const [selectedTime, setSelectedTime] = useState('')
  const [customTime, setCustomTime] = useState('')
  const [customerSearch, setCustomerSearch] = useState('')
  const [customerId, setCustomerId] = useState('')
  const [allowOverlap, setAllowOverlap] = useState(false)
  const [notificationMessage, setNotificationMessage] = useState('')

  const { data: professionalsByService } = useProfessionalsByService(serviceId || null)

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
    if (defaultCustomerId) {
      setCustomerId(defaultCustomerId)
    }
  }, [defaultCustomerId])

  useEffect(() => {
    setSelectedTime('')
    setCustomTime('')
  }, [professionalId, date, serviceId])

  useEffect(() => {
    if (canManage) {
      setProfessionalId('')
    }
  }, [serviceId, canManage])

  useEffect(() => {
    if (!customerId || !serviceId || !date || !selectedTime || !professionalId) return

    const customerName = defaultCustomerName
      ? defaultCustomerName.split(' ')[0]
      : customers.find((c) => c.id === customerId)?.name.split(' ')[0]
    const service = services.find((s) => s.id === serviceId)
    const professional = teamMembers.find((m) => m.id === professionalId)
    if (!customerName || !service || !professional) return

    setNotificationMessage(
      renderConfirmTemplate({
        nome: customerName,
        serviço: service.name,
        data: formatDateLabel(date),
        hora: formatHour(selectedTime),
        profissional: professional.name.split(' ')[0],
      }),
    )
  }, [customerId, serviceId, date, selectedTime, professionalId, customers, services, teamMembers, defaultCustomerName])

  function handleClose() {
    setProfessionalId(canManage ? '' : (currentUser?.id ?? ''))
    setServiceId('')
    setDate(defaultDate ?? toDateInput(new Date()))
    setSelectedTime('')
    setCustomTime('')
    setCustomerSearch('')
    setCustomerId(defaultCustomerId ?? '')
    setAllowOverlap(false)
    setNotificationMessage('')
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
        notificationMessage: notificationMessage || undefined,
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
  const selectedCustomer = defaultCustomerId ? null : customers.find((c) => c.id === customerId)
  const allEligible = teamMembers.filter((m) =>
    ['OWNER', 'MANAGER', 'PROFESSIONAL'].includes(m.role),
  )

  const professionals = serviceId && professionalsByService
    ? professionalsByService.professionals
    : allEligible

  const showServiceWarning =
    serviceId && professionalsByService && !professionalsByService.filtered
  const isFormValid = customerId && serviceId && professionalId && date && selectedTime

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo agendamento</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="min-w-0 space-y-5">
          {/* 1. Serviço — sempre primeiro */}
          <div className="min-w-0 space-y-2">
            <Label>Serviço</Label>
            <ServicePickerWithCategories
              services={activeServices}
              categories={categories}
              selectedId={serviceId}
              onSelect={(s) => setServiceId(s.id)}
            />
          </div>

          {/* 2. Profissional — filtrado pelo serviço, só para quem pode gerenciar */}
          {canManage && (
            <>
              {showServiceWarning && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  Nenhum profissional configurado para este serviço. Configure na aba{' '}
                  <span className="font-medium">Equipe</span>.
                </div>
              )}
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
            </>
          )}

          {/* 3. Data */}
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

          {/* 4. Horário — só aparece quando profissional + serviço + data estão definidos */}
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
                    <Skeleton key={i} className="h-12 rounded-xl" />
                  ))}
                </div>
              ) : slots.length === 0 ? (
                <p className="text-sm text-slate-500 py-2">
                  Nenhum horário disponível neste dia.
                </p>
              ) : (
                <div className="grid grid-cols-4 gap-2">
                  {slots.map((slot) => {
                    const isSelected = selectedTime === slot.time
                    const isOccupied = !slot.available
                    const isClickable = slot.available || allowOverlap

                    return (
                      <button
                        key={slot.time}
                        type="button"
                        disabled={!isClickable}
                        onClick={() => {
                          setSelectedTime(slot.time)
                          setCustomTime(slot.time)
                        }}
                        className={cn(
                          'rounded-xl border px-2 py-2 text-sm font-medium transition flex flex-col items-center gap-0.5 min-h-[40px]',
                          isSelected && !isOccupied
                            ? 'border-primary bg-primary text-primary-foreground'
                            : isSelected && isOccupied
                            ? 'border-orange-500 bg-orange-50 text-orange-700'
                            : !isOccupied
                            ? 'border-slate-200 bg-white text-slate-700 hover:border-primary/40 hover:bg-primary/5'
                            : allowOverlap
                            ? 'border-slate-200 bg-slate-50 text-slate-400 hover:border-orange-300 hover:bg-orange-50'
                            : 'cursor-not-allowed border-slate-200 bg-slate-50 text-slate-300',
                        )}
                      >
                        <span className={isOccupied ? 'line-through' : ''}>{slot.time}</span>
                        {slot.bookedBy && (
                          <span className="text-xs font-normal leading-none">{slot.bookedBy}</span>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="custom-time" className="text-xs text-slate-500">
                  Ou informe um horário específico:
                </Label>
                <Input
                  id="custom-time"
                  type="time"
                  value={customTime}
                  onChange={(e) => {
                    setCustomTime(e.target.value)
                    setSelectedTime(e.target.value)
                  }}
                  className="h-8 text-sm"
                />
              </div>
            </div>
          )}

          {/* 5. Cliente */}
          <div className="space-y-2">
            <Label>Cliente</Label>
            {defaultCustomerId ? (
              <div className="flex h-9 w-full items-center rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700">
                {defaultCustomerName ?? 'Cliente selecionado'}
              </div>
            ) : (
              <>
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
                          className="w-full px-4 py-2 text-left text-sm hover:bg-primary/5"
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
              </>
            )}
          </div>

          {/* 6. Mensagem WhatsApp — só quando formulário completo */}
          {isFormValid && (
            <div className="space-y-1.5">
              <Label>Mensagem enviada ao cliente via WhatsApp</Label>
              <Textarea
                value={notificationMessage}
                onChange={(e) => setNotificationMessage(e.target.value)}
                placeholder="A mensagem será gerada automaticamente ao selecionar o horário..."
                className="min-h-[90px] resize-none text-sm"
              />
              {selectedCustomer && !selectedCustomer.phone && (
                <p className="text-xs text-slate-400">
                  Este cliente não tem telefone cadastrado. A mensagem não será enviada.
                </p>
              )}
            </div>
          )}

          {/* 7. Botões */}
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
