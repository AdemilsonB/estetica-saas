'use client'

import Link from 'next/link'
import { Phone, Mail, Tag, Crown } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { Customer } from '@/hooks/crm/use-customers'

type Props = {
  customer: Customer
}

export function CustomerCard({ customer }: Props) {
  return (
    <Link
      href={`/clientes/${customer.id}`}
      className="block rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-slate-300 hover:shadow-sm"
    >
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-700">
          {customer.name.slice(0, 2).toUpperCase()}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-semibold text-slate-950">
              {customer.name}
            </p>
            {customer.isVip && (
              <Badge className="shrink-0 gap-1 rounded-full bg-amber-100 px-1.5 py-0 text-[10px] text-amber-700 border border-amber-200">
                <Crown className="size-2.5" />
                VIP
              </Badge>
            )}
          </div>

          <div className="mt-1 flex flex-col gap-0.5">
            {customer.phone && (
              <span className="flex items-center gap-1 text-xs text-slate-500">
                <Phone className="size-3" />
                {customer.phone}
              </span>
            )}
            {customer.email && (
              <span className="flex items-center gap-1 text-xs text-slate-500">
                <Mail className="size-3" />
                {customer.email}
              </span>
            )}
          </div>

          {customer.tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {customer.tags.map((tag) => (
                <Badge
                  key={tag}
                  className="flex items-center gap-0.5 rounded-full bg-slate-100 px-2 py-0 text-[10px] text-slate-600"
                >
                  <Tag className="size-2.5" />
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>
    </Link>
  )
}
