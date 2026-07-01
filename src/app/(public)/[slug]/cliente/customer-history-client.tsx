'use client'

import { useState } from 'react'
import Link from 'next/link'
import { MessageCircle, LogOut, CalendarDays, Clock, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { weekdayLabel, formatHourRange, WEEK_DISPLAY_ORDER, type BusinessHoursMap } from '@/lib/business-hours'
import { VitrineLocationBlock } from '@/components/domain/vitrine/vitrine-location-block'

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

type BusinessInfo = {
  address: string | null
  businessHours: unknown
  todayWeekdayIndex: number | null
  isOpenNow: boolean
}

type Props = {
  customer: Customer
  upcoming: AppointmentRow[]
  history: AppointmentRow[]
  slug: string
  whatsappUrl: string | null
  primaryColor: string
  googleBusinessUrl: string | null
  googleRating: { rating: number; userRatingCount: number } | null
  business: BusinessInfo
}

const STATUS_LABELS: Record<string, { label: string; tone: 'primary' | 'red' }> = {
  SCHEDULED: { label: 'Agendado', tone: 'primary' },
  CONFIRMED: { label: 'Confirmado', tone: 'primary' },
  COMPLETED: { label: 'Concluído', tone: 'primary' },
  CANCELLED: { label: 'Cancelado', tone: 'red' },
  NO_SHOW: { label: 'Não compareceu', tone: 'red' },
}

const PAGE_SIZE = 10

export function CustomerHistoryClient({
  customer,
  upcoming,
  history,
  slug,
  whatsappUrl,
  primaryColor,
  googleBusinessUrl,
  googleRating,
  business,
}: Props) {
  const router = useRouter()
  const [phone, setPhone] = useState(customer.phone ?? '')
  const [email, setEmail] = useState(customer.email ?? '')
  const [saving, setSaving] = useState(false)
  const [page, setPage] = useState(0)

  const businessHours =
    business.businessHours && typeof business.businessHours === 'object'
      ? (business.businessHours as BusinessHoursMap)
      : null
  const hasBusinessHours = !!businessHours && Object.keys(businessHours).length > 0

  const visibleHistory = history.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  const totalPages = Math.ceil(history.length / PAGE_SIZE)

  async function handleLogout() {
    await fetch(`/api/public/${slug}/auth/logout`, { method: 'POST' }).catch(() => {})
    router.replace(`/${slug}`)
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
    <div className="pb-24">
      {/* Header com identidade do negócio */}
      <div
        className="px-4 pt-6 pb-8 text-white"
        style={{ backgroundImage: `linear-gradient(135deg, ${primaryColor}, #A855F7)` }}
      >
        <div className="mx-auto flex max-w-lg items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href={`/${slug}`}
              aria-label="Voltar à vitrine"
              className="-m-3 flex shrink-0 items-center justify-center rounded-full p-3 hover:bg-white/10"
            >
              <ArrowLeft className="size-5" />
            </Link>
            <div className="flex size-11 shrink-0 items-center justify-center rounded-full border border-white/40 bg-white/20 text-base font-bold">
              {customer.name[0]?.toUpperCase()}
            </div>
            <h1 className="text-base font-bold leading-tight">Olá, {customer.name} 👋</h1>
          </div>
          <button
            onClick={handleLogout}
            className="-m-2 flex items-center gap-1.5 p-2 text-xs font-medium text-white/80 hover:text-white"
          >
            <LogOut className="size-4" />
            Sair
          </button>
        </div>
      </div>

      <div className="-mt-5 mx-auto max-w-lg space-y-6 px-4">
        <Link
          href={`/agendar/${slug}`}
          className="flex h-12 w-full items-center justify-center rounded-full text-sm font-semibold text-white shadow-lg"
          style={{ backgroundColor: primaryColor }}
        >
          Novo agendamento
        </Link>

        {/* Próximo agendamento */}
        {firstUpcoming && (
          <div className="rounded-2xl bg-card p-4 shadow-sm space-y-2">
            <div className="flex items-center gap-2">
              <div
                className="flex size-7 items-center justify-center rounded-full"
                style={{ backgroundColor: `${primaryColor}1A` }}
              >
                <CalendarDays className="size-3.5" style={{ color: primaryColor }} />
              </div>
              <p className="text-xs font-bold uppercase tracking-wide" style={{ color: primaryColor }}>
                Próximo agendamento
              </p>
            </div>
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

        {/* Informações do negócio */}
        {(business.address || hasBusinessHours) && (
          <div className="space-y-2">
            <p className="px-1 text-xs font-bold uppercase tracking-wide" style={{ color: primaryColor }}>
              Informações
            </p>
            <div className="rounded-2xl bg-card p-4 shadow-sm space-y-4">
              {business.address && (
                <VitrineLocationBlock
                  address={business.address}
                  primaryColor={primaryColor}
                  googleBusinessUrl={googleBusinessUrl}
                  googleRating={googleRating}
                />
              )}

              {hasBusinessHours && (
                <div className={cn('space-y-1.5', business.address && 'border-t pt-3')}>
                  <div className="mb-1 flex items-center gap-2">
                    <Clock className="size-4" style={{ color: primaryColor }} />
                    <span className="text-sm font-medium">Horário de funcionamento</span>
                    {business.todayWeekdayIndex !== null && (
                      <span
                        className={cn(
                          'ml-auto rounded-full px-2 py-0.5 text-[11px] font-semibold',
                          !business.isOpenNow && 'bg-muted text-muted-foreground',
                        )}
                        style={business.isOpenNow ? { backgroundColor: `${primaryColor}1A`, color: primaryColor } : undefined}
                      >
                        {business.isOpenNow ? 'Aberto agora' : 'Fechado agora'}
                      </span>
                    )}
                  </div>
                  {WEEK_DISPLAY_ORDER.map((day) => {
                    const isToday = day === business.todayWeekdayIndex
                    return (
                      <div
                        key={day}
                        className={cn(
                          'flex items-center justify-between text-xs',
                          isToday ? 'font-semibold' : 'text-muted-foreground',
                        )}
                        style={isToday ? { color: primaryColor } : undefined}
                      >
                        <span>{weekdayLabel(day)}</span>
                        <span>{formatHourRange(businessHours?.[String(day)])}</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Histórico */}
        {history.length > 0 && (
          <div className="space-y-2">
            <p className="px-1 text-xs font-bold uppercase tracking-wide" style={{ color: primaryColor }}>
              Histórico
            </p>
            {visibleHistory.map((a) => {
              const s = STATUS_LABELS[a.status] ?? { label: a.status, tone: 'primary' as const }
              const isRed = s.tone === 'red'
              return (
                <div key={a.id} className="flex items-center gap-3 rounded-xl bg-card px-4 py-3 shadow-sm">
                  <div
                    className={cn(
                      'flex size-8 shrink-0 items-center justify-center rounded-full',
                      isRed && 'bg-red-50',
                    )}
                    style={isRed ? undefined : { backgroundColor: `${primaryColor}1A` }}
                  >
                    <CalendarDays
                      className={cn('size-4', isRed && 'text-red-500')}
                      style={isRed ? undefined : { color: primaryColor }}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{a.serviceName}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(a.startsAt).toLocaleDateString('pt-BR')} · {a.professionalName}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-[11px] font-semibold',
                        isRed && 'bg-red-50 text-red-500',
                      )}
                      style={isRed ? undefined : { backgroundColor: `${primaryColor}1A`, color: primaryColor }}
                    >
                      {s.label}
                    </span>
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
          <p className="px-1 text-xs font-bold uppercase tracking-wide" style={{ color: primaryColor }}>
            Meus dados
          </p>
          <div className="rounded-2xl bg-card px-4 py-3 shadow-sm space-y-1">
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
    </div>
  )
}
