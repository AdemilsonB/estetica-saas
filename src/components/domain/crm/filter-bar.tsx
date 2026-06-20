'use client'

import { useState } from 'react'
import { X, Crown, Cake, Clock, DollarSign, AlertCircle, SlidersHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import type { CustomerListParams } from '@/hooks/crm/use-customers'

type Props = {
  filters: CustomerListParams
  onChange: (filters: CustomerListParams) => void
}

const CURRENT_MONTH = new Date().getMonth() + 1

export function FilterBar({ filters, onChange }: Props) {
  const [noVisitInput, setNoVisitInput] = useState(
    filters.noAppointmentDays ? String(filters.noAppointmentDays) : '',
  )
  const [ticketInput, setTicketInput] = useState(
    filters.minAvgTicket != null ? String(filters.minAvgTicket) : '',
  )

  const activeCount = [
    filters.onlyVip,
    filters.birthdayMonth != null,
    filters.noAppointmentDays != null,
    filters.minAvgTicket != null,
    filters.hasPendingDebt,
  ].filter(Boolean).length

  function toggle<K extends keyof CustomerListParams>(
    key: K,
    value: CustomerListParams[K],
  ) {
    onChange({ ...filters, [key]: filters[key] != null ? undefined : value })
  }

  function remove(key: keyof CustomerListParams) {
    onChange({ ...filters, [key]: undefined })
  }

  const buttons = (
    <div className="flex flex-wrap gap-2">
      <Button
        variant={filters.onlyVip ? 'default' : 'outline'}
        size="sm"
        className="h-8 rounded-full gap-1 text-xs"
        onClick={() => toggle('onlyVip', true)}
      >
        <Crown className="size-3" />
        Só VIPs
      </Button>

      <Button
        variant={filters.birthdayMonth != null ? 'default' : 'outline'}
        size="sm"
        className="h-8 rounded-full gap-1 text-xs"
        onClick={() => toggle('birthdayMonth', CURRENT_MONTH)}
      >
        <Cake className="size-3" />
        Aniversariantes
      </Button>

      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant={filters.noAppointmentDays != null ? 'default' : 'outline'}
            size="sm"
            className="h-8 rounded-full gap-1 text-xs"
          >
            <Clock className="size-3" />
            {filters.noAppointmentDays != null
              ? `Sem visita: ${filters.noAppointmentDays}d`
              : 'Sem visita'}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-52 p-3 max-h-[80vh] overflow-y-auto" align="start">
          <Label className="text-xs font-medium">Sem visita há (dias)</Label>
          <div className="mt-2 flex gap-2">
            <Input
              type="number"
              min="1"
              placeholder="ex: 30"
              value={noVisitInput}
              onChange={(e) => setNoVisitInput(e.target.value)}
              className="h-10 sm:h-8 text-sm"
            />
            <Button
              size="sm"
              className="h-10 sm:h-8 px-3"
              onClick={() => {
                const v = parseInt(noVisitInput)
                if (!isNaN(v) && v > 0)
                  onChange({ ...filters, noAppointmentDays: v })
              }}
            >
              OK
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant={filters.minAvgTicket != null ? 'default' : 'outline'}
            size="sm"
            className="h-8 rounded-full gap-1 text-xs"
          >
            <DollarSign className="size-3" />
            {filters.minAvgTicket != null
              ? `Ticket ≥ R$${filters.minAvgTicket}`
              : 'Ticket mín'}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-52 p-3 max-h-[80vh] overflow-y-auto" align="start">
          <Label className="text-xs font-medium">Ticket médio mínimo (R$)</Label>
          <div className="mt-2 flex gap-2">
            <Input
              type="number"
              min="0"
              placeholder="ex: 100"
              value={ticketInput}
              onChange={(e) => setTicketInput(e.target.value)}
              className="h-10 sm:h-8 text-sm"
            />
            <Button
              size="sm"
              className="h-10 sm:h-8 px-3"
              onClick={() => {
                const v = parseFloat(ticketInput)
                if (!isNaN(v) && v >= 0)
                  onChange({ ...filters, minAvgTicket: v })
              }}
            >
              OK
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      <Button
        variant={filters.hasPendingDebt ? 'default' : 'outline'}
        size="sm"
        className="h-8 rounded-full gap-1 text-xs"
        onClick={() => toggle('hasPendingDebt', true)}
      >
        <AlertCircle className="size-3" />
        Com débito
      </Button>
    </div>
  )

  return (
    <div className="space-y-2">
      {/* Desktop: botões visíveis */}
      <div className="hidden sm:block">{buttons}</div>

      {/* Mobile: colapsar atrás de "Filtros (N)" */}
      <div className="sm:hidden">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 rounded-full gap-1 text-xs">
              <SlidersHorizontal className="size-3" />
              Filtros{activeCount > 0 ? ` (${activeCount})` : ''}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-3" align="start">
            {buttons}
          </PopoverContent>
        </Popover>
      </div>

      {/* Chips dos filtros ativos */}
      {activeCount > 0 && (
        <div className="flex flex-wrap gap-1">
          {filters.onlyVip && (
            <Badge variant="secondary" className="gap-1 rounded-full text-xs">
              VIP
              <button
                onClick={() => remove('onlyVip')}
                className="ml-0.5 rounded-full hover:bg-slate-200"
              >
                <X className="size-3" />
              </button>
            </Badge>
          )}
          {filters.birthdayMonth != null && (
            <Badge variant="secondary" className="gap-1 rounded-full text-xs">
              Aniversariantes este mês
              <button
                onClick={() => remove('birthdayMonth')}
                className="ml-0.5 rounded-full hover:bg-slate-200"
              >
                <X className="size-3" />
              </button>
            </Badge>
          )}
          {filters.noAppointmentDays != null && (
            <Badge variant="secondary" className="gap-1 rounded-full text-xs">
              Sem visita: {filters.noAppointmentDays}d
              <button
                onClick={() => remove('noAppointmentDays')}
                className="ml-0.5 rounded-full hover:bg-slate-200"
              >
                <X className="size-3" />
              </button>
            </Badge>
          )}
          {filters.minAvgTicket != null && (
            <Badge variant="secondary" className="gap-1 rounded-full text-xs">
              Ticket ≥ R${filters.minAvgTicket}
              <button
                onClick={() => remove('minAvgTicket')}
                className="ml-0.5 rounded-full hover:bg-slate-200"
              >
                <X className="size-3" />
              </button>
            </Badge>
          )}
          {filters.hasPendingDebt && (
            <Badge variant="secondary" className="gap-1 rounded-full text-xs">
              Com débito
              <button
                onClick={() => remove('hasPendingDebt')}
                className="ml-0.5 rounded-full hover:bg-slate-200"
              >
                <X className="size-3" />
              </button>
            </Badge>
          )}
        </div>
      )}
    </div>
  )
}
