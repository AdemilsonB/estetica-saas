'use client'

import { useEffect, useState } from 'react'
import { Phone, Loader2, CheckCircle2, XCircle, Clock, Calendar } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'

type HistoryEntry = {
  id: string
  date: string
  serviceName: string
  professionalName: string | null
  status: string
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  slug: string
  primaryColor: string
}

const STATUS_META: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  COMPLETED:  { label: 'Concluído',        icon: <CheckCircle2 className="size-3.5" />, color: 'text-green-600' },
  CONFIRMED:  { label: 'Confirmado',       icon: <Clock className="size-3.5" />,        color: 'text-blue-600' },
  PENDING:    { label: 'Aguardando',       icon: <Clock className="size-3.5" />,        color: 'text-yellow-600' },
  CANCELLED:  { label: 'Cancelado',        icon: <XCircle className="size-3.5" />,      color: 'text-red-500' },
  NO_SHOW:    { label: 'Não compareceu',   icon: <XCircle className="size-3.5" />,      color: 'text-orange-500' },
}

function formatPhone(raw: string): string {
  const d = raw.replace(/\D/g, '')
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return raw
}

function groupByYear(entries: HistoryEntry[]): [string, HistoryEntry[]][] {
  const map: Record<string, HistoryEntry[]> = {}
  for (const e of entries) {
    const year = new Date(e.date).getFullYear().toString()
    if (!map[year]) map[year] = []
    map[year].push(e)
  }
  return Object.entries(map).sort(([a], [b]) => Number(b) - Number(a))
}

function Timeline({ history, primaryColor }: { history: HistoryEntry[]; primaryColor: string }) {
  if (history.length === 0) {
    return (
      <div className="py-10 text-center">
        <Calendar className="mx-auto mb-2 size-8 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">Nenhum agendamento encontrado.</p>
      </div>
    )
  }

  const grouped = groupByYear(history)

  return (
    <div className="space-y-6 max-h-[52vh] overflow-y-auto overscroll-y-contain pr-1">
      {grouped.map(([year, entries]) => (
        <div key={year}>
          <p className="mb-3 text-xs font-bold text-muted-foreground">{year}</p>
          <div className="relative pl-5">
            <div className="absolute left-[7px] top-0 bottom-0 w-px bg-border" />
            <div className="space-y-4">
              {entries.map((entry) => {
                const meta = STATUS_META[entry.status]
                const dateStr = new Date(entry.date).toLocaleDateString('pt-BR', {
                  day: '2-digit', month: 'short',
                })
                return (
                  <div key={entry.id} className="relative flex gap-3">
                    <div
                      className="absolute -left-5 top-1 size-[15px] rounded-full border-2 border-background"
                      style={{ backgroundColor: primaryColor }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold leading-snug">{entry.serviceName}</p>
                      {entry.professionalName && (
                        <p className="text-xs text-muted-foreground">{entry.professionalName}</p>
                      )}
                      <div className="mt-1 flex items-center justify-between gap-2">
                        <span className="text-xs text-muted-foreground">{dateStr}</span>
                        {meta && (
                          <span className={`inline-flex items-center gap-1 text-xs font-medium ${meta.color}`}>
                            {meta.icon}
                            {meta.label}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

export function ClientHistoryModal({ open, onOpenChange, slug, primaryColor }: Props) {
  const [loading, setLoading] = useState(false)
  const [history, setHistory] = useState<HistoryEntry[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null)

  /* Quando o modal abre, tenta buscar sessão /me */
  useEffect(() => {
    if (!open) return
    setLoading(true)
    setError(null)
    setHistory(null)
    setIsLoggedIn(null)

    fetch(`/api/public/${encodeURIComponent(slug)}/me`, { credentials: 'include' })
      .then(async (res) => {
        if (res.ok) {
          type MeData = {
            appointments: {
              id: string
              startsAt: string
              status: string
              serviceName: string | null
              professionalName: string
            }[]
          }
          const data = (await res.json()) as MeData
          setIsLoggedIn(true)
          setHistory(
            data.appointments.map((a) => ({
              id: a.id,
              date: a.startsAt,
              serviceName: a.serviceName ?? 'Serviço',
              professionalName: a.professionalName ?? null,
              status: a.status,
            })),
          )
        } else {
          setIsLoggedIn(false)
        }
      })
      .catch(() => setIsLoggedIn(false))
      .finally(() => setLoading(false))
  }, [open, slug])

  /* Busca por telefone (fallback quando não está logado) */
  const [phone, setPhone] = useState('')
  const [phoneLoading, setPhoneLoading] = useState(false)

  async function handlePhoneSubmit(e: React.FormEvent) {
    e.preventDefault()
    const digits = phone.replace(/\D/g, '')
    if (digits.length < 10) return
    setPhoneLoading(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/public/${encodeURIComponent(slug)}/history?phone=${encodeURIComponent(digits)}`,
      )
      if (!res.ok) {
        const d = (await res.json()) as { error?: string }
        setError(d.error ?? 'Erro ao buscar histórico.')
        return
      }
      setHistory((await res.json()) as HistoryEntry[])
    } catch {
      setError('Erro de conexão. Tente novamente.')
    } finally {
      setPhoneLoading(false)
    }
  }

  function handleClose(v: boolean) {
    onOpenChange(v)
    if (!v) { setHistory(null); setPhone(''); setError(null); setIsLoggedIn(null) }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Calendar className="size-4" style={{ color: primaryColor }} />
            Meu Histórico
          </DialogTitle>
        </DialogHeader>

        {/* Carregando sessão */}
        {loading && (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* Carregando Timeline após login */}
        {!loading && isLoggedIn === true && history === null && (
          <div className="p-6 space-y-3">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-40 w-full rounded-lg" />
          </div>
        )}

        {/* Logado — mostra histórico direto */}
        {!loading && isLoggedIn === true && history !== null && (
          <Timeline history={history} primaryColor={primaryColor} />
        )}

        {/* Não logado — pede telefone */}
        {!loading && isLoggedIn === false && history === null && (
          <form onSubmit={handlePhoneSubmit} className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Digite seu telefone para ver seus agendamentos anteriores.
            </p>
            <div className="flex gap-2">
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(formatPhone(e.target.value.replace(/\D/g, '').slice(0, 11)))}
                placeholder="(11) 99999-9999"
                className="flex h-10 flex-1 rounded-xl border bg-background px-3 text-sm focus:outline-none focus:ring-2"
                style={{ '--tw-ring-color': primaryColor } as React.CSSProperties}
              />
              <button
                type="submit"
                disabled={phoneLoading || phone.replace(/\D/g, '').length < 10}
                className="flex h-10 items-center justify-center rounded-xl px-4 text-sm font-semibold text-white disabled:opacity-50"
                style={{ backgroundColor: primaryColor }}
              >
                {phoneLoading ? <Loader2 className="size-4 animate-spin" /> : 'Buscar'}
              </button>
            </div>
            {error && (
              <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
            )}
          </form>
        )}

        {/* Resultado da busca por telefone */}
        {!loading && isLoggedIn === false && history !== null && (
          <>
            <button
              onClick={() => { setHistory(null); setPhone('') }}
              className="text-xs text-muted-foreground hover:underline text-left"
            >
              ← Buscar outro telefone
            </button>
            <Timeline history={history} primaryColor={primaryColor} />
          </>
        )}

        {/* Ícone de telefone para histórico logado (informativo) */}
        {!loading && isLoggedIn === true && (
          <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
            <Phone className="size-3" />
            Histórico da sua conta
          </p>
        )}
      </DialogContent>
    </Dialog>
  )
}
