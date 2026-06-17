'use client'

import { useState } from 'react'
import Link from 'next/link'
import { MessageCircle, LogOut, CalendarDays } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

type AppointmentRow = {
  id: string
  startsAt: string
  status: string
  price: number
  serviceName: string
  professionalName: string
}

type Customer = {
  id: string
  name: string
  cpf: string
  phone: string | null
  email: string | null
  birthDate: string | null
}

type Props = {
  customer: Customer
  upcoming: AppointmentRow[]
  history: AppointmentRow[]
  slug: string
  whatsappUrl: string | null
  primaryColor: string
}

const STATUS_LABELS: Record<
  string,
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
> = {
  SCHEDULED: { label: 'Agendado', variant: 'default' },
  CONFIRMED: { label: 'Confirmado', variant: 'default' },
  COMPLETED: { label: 'Concluído', variant: 'secondary' },
  CANCELLED: { label: 'Cancelado', variant: 'destructive' },
  NO_SHOW: { label: 'Não compareceu', variant: 'outline' },
}

const PAGE_SIZE = 10

export function CustomerHistoryClient({
  customer,
  upcoming,
  history,
  slug,
  whatsappUrl,
  primaryColor,
}: Props) {
  const router = useRouter()
  const [phone, setPhone] = useState(customer.phone ?? '')
  const [email, setEmail] = useState(customer.email ?? '')
  const [saving, setSaving] = useState(false)
  const [page, setPage] = useState(0)

  const visibleHistory = history.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  const totalPages = Math.ceil(history.length / PAGE_SIZE)

  async function handleLogout() {
    await fetch(`/api/public/${slug}/auth/logout`, { method: 'POST' }).catch(() => {})
    router.replace(`/${slug}/entrar`)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetch(`/api/public/${slug}/me`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: phone || undefined,
          email: email || undefined,
        }),
      })
      if (!res.ok) throw new Error()
      toast.success('Dados atualizados')
    } catch {
      toast.error('Falha ao atualizar dados')
    } finally {
      setSaving(false)
    }
  }

  const firstUpcoming = upcoming[0]

  return (
    <div className="mx-auto max-w-lg px-4 pb-24 pt-6 space-y-6">
      {/* Saudação */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Olá, {customer.name} 👋</h1>
        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <LogOut className="size-4" />
          Sair
        </button>
      </div>

      <Link
        href={`/agendar/${slug}`}
        className="flex h-12 w-full items-center justify-center rounded-2xl text-sm font-semibold text-white"
        style={{ backgroundColor: primaryColor }}
      >
        Novo agendamento
      </Link>

      {/* Próximo agendamento */}
      {firstUpcoming && (
        <div className="rounded-2xl border bg-card p-4 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Próximo agendamento
          </p>
          <p className="font-medium">{firstUpcoming.serviceName}</p>
          <p className="text-sm text-muted-foreground">
            {new Date(firstUpcoming.startsAt).toLocaleString('pt-BR', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
          <p className="text-sm text-muted-foreground">{firstUpcoming.professionalName}</p>
          {whatsappUrl && (
            <a
              href={`${whatsappUrl}?text=Olá! Gostaria de falar sobre meu agendamento.`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-green-600 hover:underline"
            >
              <MessageCircle className="size-4" />
              Falar pelo WhatsApp
            </a>
          )}
        </div>
      )}

      {/* Histórico */}
      {history.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Histórico
          </p>
          {visibleHistory.map((a) => {
            const s = STATUS_LABELS[a.status] ?? { label: a.status, variant: 'outline' as const }
            return (
              <div key={a.id} className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3">
                <CalendarDays className="size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{a.serviceName}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(a.startsAt).toLocaleDateString('pt-BR')} · {a.professionalName}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <Badge variant={s.variant} className="text-xs">
                    {s.label}
                  </Badge>
                  <span className="text-xs text-muted-foreground">R$ {a.price.toFixed(2)}</span>
                </div>
              </div>
            )
          })}
          {totalPages > 1 && (
            <div className="flex justify-center gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
              >
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => p + 1)}
              >
                Próxima
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Meus dados */}
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Meus dados
        </p>
        <div className="rounded-xl border bg-card px-4 py-3 space-y-1">
          <p className="text-sm">
            <span className="text-muted-foreground">Nome:</span> {customer.name}
          </p>
          <p className="text-sm">
            <span className="text-muted-foreground">CPF:</span> {customer.cpf}
          </p>
          {customer.birthDate && (
            <p className="text-sm">
              <span className="text-muted-foreground">Nascimento:</span>{' '}
              {new Date(customer.birthDate).toLocaleDateString('pt-BR')}
            </p>
          )}
        </div>
        <form onSubmit={handleSave} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="edit-phone">Telefone</Label>
            <Input
              id="edit-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-email">E-mail</Label>
            <Input
              id="edit-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <Button type="submit" variant="outline" size="sm" disabled={saving}>
            {saving ? 'Salvando...' : 'Atualizar dados'}
          </Button>
        </form>
      </div>
    </div>
  )
}
