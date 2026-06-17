'use client'

import { useState } from 'react'
import { Phone, Loader2, CheckCircle2, XCircle, Clock } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

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

const STATUS_LABELS: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  COMPLETED: { label: 'Concluído', icon: <CheckCircle2 className="size-3.5" />, color: 'text-green-600' },
  CONFIRMED: { label: 'Confirmado', icon: <Clock className="size-3.5" />, color: 'text-blue-600' },
  CANCELLED: { label: 'Cancelado', icon: <XCircle className="size-3.5" />, color: 'text-red-500' },
  NO_SHOW: { label: 'Não compareceu', icon: <XCircle className="size-3.5" />, color: 'text-orange-500' },
}

function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 11)
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
  if (digits.length === 10)
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
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

export function ClientHistoryModal({ open, onOpenChange, slug, primaryColor }: Props) {
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [history, setHistory] = useState<HistoryEntry[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (phone.replace(/\D/g, '').length < 10) return
    setLoading(true)
    setError(null)
    setHistory(null)
    try {
      const digits = phone.replace(/\D/g, '')
      const res = await fetch(
        `/api/public/${encodeURIComponent(slug)}/history?phone=${encodeURIComponent(digits)}`,
      )
      if (!res.ok) {
        const data = (await res.json()) as { error?: string }
        setError(data.error ?? 'Erro ao buscar histórico.')
        return
      }
      const data = (await res.json()) as HistoryEntry[]
      setHistory(data)
    } catch {
      setError('Erro de conexão. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  function handlePhoneChange(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 11)
    setPhone(formatPhone(digits))
  }

  const grouped = history ? groupByYear(history) : []

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) { setHistory(null); setPhone('') } }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Phone className="size-4" style={{ color: primaryColor }} />
            Meu Histórico
          </DialogTitle>
        </DialogHeader>

        {/* Formulário de busca */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Digite seu telefone para ver seus agendamentos anteriores.
          </p>
          <div className="flex gap-2">
            <input
              type="tel"
              value={phone}
              onChange={handlePhoneChange}
              placeholder="(11) 99999-9999"
              className="flex h-10 flex-1 rounded-xl border bg-background px-3 text-sm focus:outline-none focus:ring-2"
              style={{ '--tw-ring-color': primaryColor } as React.CSSProperties}
            />
            <button
              type="submit"
              disabled={loading || phone.replace(/\D/g, '').length < 10}
              className="flex h-10 items-center justify-center rounded-xl px-4 text-sm font-semibold text-white disabled:opacity-50"
              style={{ backgroundColor: primaryColor }}
            >
              {loading ? <Loader2 className="size-4 animate-spin" /> : 'Buscar'}
            </button>
          </div>
        </form>

        {/* Erro */}
        {error && (
          <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
        )}

        {/* Linha do tempo */}
        {history !== null && (
          <div className="mt-2 max-h-[50vh] overflow-y-auto">
            {history.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-sm text-muted-foreground">
                  Nenhum agendamento encontrado para este telefone.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {grouped.map(([year, entries]) => (
                  <div key={year}>
                    <p className="mb-3 text-xs font-bold text-muted-foreground">{year}</p>
                    <div className="relative pl-5">
                      {/* Linha vertical */}
                      <div className="absolute left-[7px] top-0 bottom-0 w-px bg-border" />
                      <div className="space-y-4">
                        {entries.map((entry) => {
                          const meta = STATUS_LABELS[entry.status]
                          const dateStr = new Date(entry.date).toLocaleDateString('pt-BR', {
                            day: '2-digit',
                            month: 'short',
                          })
                          return (
                            <div key={entry.id} className="relative flex gap-3">
                              {/* Ponto da timeline */}
                              <div
                                className="absolute -left-5 top-1 size-[15px] rounded-full border-2 border-background"
                                style={{ backgroundColor: primaryColor }}
                              />
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold leading-snug">
                                  {entry.serviceName}
                                </p>
                                {entry.professionalName && (
                                  <p className="text-xs text-muted-foreground">
                                    {entry.professionalName}
                                  </p>
                                )}
                                <div className="mt-1 flex items-center justify-between gap-2">
                                  <span className="text-xs text-muted-foreground">{dateStr}</span>
                                  {meta && (
                                    <span
                                      className={`inline-flex items-center gap-1 text-xs font-medium ${meta.color}`}
                                    >
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
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
