'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
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
import { TransactionList } from '@/components/domain/financial/transaction-list'
import { usePermissions } from '@/hooks/use-permissions'
import { useTeamMembers } from '@/hooks/iam/use-team'
import { FINANCIAL_CATEGORIES } from '@/domains/financial/categories'
import type { TransactionType } from '@/hooks/financial/use-transactions'

const CATEGORIES = [
  FINANCIAL_CATEGORIES.SERVICE,
  FINANCIAL_CATEGORIES.PRODUCT_SALE,
  FINANCIAL_CATEGORIES.STOCK_PURCHASE,
  FINANCIAL_CATEGORIES.SUPPLY_USE,
  FINANCIAL_CATEGORIES.SUPPLY_REVERSAL,
  FINANCIAL_CATEGORIES.COURTESY,
  FINANCIAL_CATEGORIES.FIXED_EXPENSE,
  FINANCIAL_CATEGORIES.VARIABLE,
]

export default function TransacoesPage() {
  const { can } = usePermissions()
  const { data: team = [] } = useTeamMembers()
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [type, setType] = useState<'all' | TransactionType>('all')
  const [category, setCategory] = useState('all')
  const [professionalId, setProfessionalId] = useState('all')
  const [page, setPage] = useState(1)

  if (!can('financeiro', 'view')) {
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

  function handleFilterChange(fn: () => void) {
    fn()
    setPage(1)
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild className="-ml-2">
          <Link href="/financeiro">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
          Histórico de transações
        </h1>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="flex-1 space-y-1">
            <Label className="text-xs">De</Label>
            <Input
              type="date"
              value={from}
              onChange={(e) => handleFilterChange(() => setFrom(e.target.value))}
            />
          </div>
          <div className="flex-1 space-y-1">
            <Label className="text-xs">Até</Label>
            <Input
              type="date"
              value={to}
              onChange={(e) => handleFilterChange(() => setTo(e.target.value))}
            />
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Select
            value={type}
            onValueChange={(v) => handleFilterChange(() => setType(v as typeof type))}
          >
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="Tipo: Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              <SelectItem value="INCOME">Receita</SelectItem>
              <SelectItem value="EXPENSE">Despesa / Estorno</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={category}
            onValueChange={(v) => handleFilterChange(() => setCategory(v))}
          >
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="Categoria: Todas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as categorias</SelectItem>
              {CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {team.length > 0 && (
          <Select
            value={professionalId}
            onValueChange={(v) => handleFilterChange(() => setProfessionalId(v))}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Profissional: Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os profissionais</SelectItem>
              {team.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <TransactionList
        from={from ? new Date(from + 'T00:00:00').toISOString() : undefined}
        to={to ? new Date(to + 'T23:59:59').toISOString() : undefined}
        type={type === 'all' ? undefined : type}
        category={category === 'all' ? undefined : category}
        professionalId={professionalId === 'all' ? undefined : professionalId}
        page={page}
        pageSize={20}
        onPageChange={setPage}
      />
    </div>
  )
}
