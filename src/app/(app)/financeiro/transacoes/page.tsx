// src/app/(app)/financeiro/transacoes/page.tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { TransactionList } from '@/components/domain/financial/transaction-list'
import { usePermissions } from '@/hooks/use-permissions'

export default function TransacoesPage() {
  const { can } = usePermissions()
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(1)

  if (!can('financial:view')) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
          <p className="text-sm font-medium text-red-700">
            Você não tem permissão para acessar o financeiro.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild className="-ml-2">
          <Link href="/financeiro">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
            Histórico de transações
          </h1>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row">
        <div className="flex-1 space-y-1">
          <Label className="text-xs">De</Label>
          <Input
            type="date"
            value={from}
            onChange={(e) => { setFrom(e.target.value); setPage(1) }}
          />
        </div>
        <div className="flex-1 space-y-1">
          <Label className="text-xs">Até</Label>
          <Input
            type="date"
            value={to}
            onChange={(e) => { setTo(e.target.value); setPage(1) }}
          />
        </div>
      </div>

      <TransactionList
        from={from ? new Date(from + 'T00:00:00').toISOString() : undefined}
        to={to ? new Date(to + 'T23:59:59').toISOString() : undefined}
        page={page}
        pageSize={20}
        onPageChange={setPage}
      />
    </div>
  )
}
