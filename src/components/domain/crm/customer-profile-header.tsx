// src/components/domain/crm/customer-profile-header.tsx
'use client'

import { Phone, Mail, Tag, Calendar } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { CustomerProfile } from '@/hooks/crm/use-customer'

type Props = {
  customer: CustomerProfile
}

export function CustomerProfileHeader({ customer }: Props) {
  const lastAppointment = customer.appointments[0]

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6">
      <div className="flex items-start gap-4">
        <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xl font-bold text-slate-700">
          {customer.name.slice(0, 2).toUpperCase()}
        </div>

        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-semibold text-slate-950">{customer.name}</h2>

          <div className="mt-2 space-y-1">
            {customer.phone && (
              <div className="flex items-center gap-1.5 text-sm text-slate-600">
                <Phone className="size-4 shrink-0 text-slate-400" />
                {customer.phone}
              </div>
            )}
            {customer.email && (
              <div className="flex items-center gap-1.5 text-sm text-slate-600">
                <Mail className="size-4 shrink-0 text-slate-400" />
                {customer.email}
              </div>
            )}
            {lastAppointment && (
              <div className="flex items-center gap-1.5 text-sm text-slate-500">
                <Calendar className="size-4 shrink-0 text-slate-400" />
                Último atendimento:{' '}
                {new Date(lastAppointment.startsAt).toLocaleDateString('pt-BR')}
              </div>
            )}
          </div>

          {customer.tags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1">
              {customer.tags.map((tag) => (
                <Badge
                  key={tag}
                  className="flex items-center gap-0.5 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600"
                >
                  <Tag className="size-3" />
                  {tag}
                </Badge>
              ))}
            </div>
          )}

          {customer.notes && (
            <p className="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
              {customer.notes}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
