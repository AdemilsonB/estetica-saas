'use client'

import { useState } from 'react'
import { ChevronLeft, Scissors, User, Calendar } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { BookingState } from '@/app/(public)/agendar/[slug]/types'

function formatDateTime(date?: Date): string {
  if (!date) return ''
  return new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export function ConfirmationStep({
  booking,
  tenantSlug,
  onConfirm,
  onBack,
  primaryColor,
}: {
  booking: BookingState
  tenantSlug: string
  onConfirm: (appointmentId: string, startsAt: Date) => void
  onBack: () => void
  primaryColor: string
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleConfirm() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/public/${tenantSlug}/appointments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceId: booking.serviceId,
          packageId: booking.packageId,
          professionalId: booking.professionalId,
          startsAt: booking.startsAt?.toISOString(),
          customerName: booking.customerName,
          customerPhone: booking.customerPhone,
          notes: booking.notes,
          anamneseId: booking.anamneseId,
        }),
      })

      const data = (await res.json()) as {
        appointmentId?: string
        startsAt?: string
        error?: string | { code?: string; message?: string }
      }

      if (!res.ok) {
        // handleApiError retorna { error: { code, message, details } } — extrair string
        const rawError = data.error
        const errorMessage =
          typeof rawError === 'string'
            ? rawError
            : typeof rawError?.message === 'string'
            ? rawError.message
            : 'Não foi possível confirmar o agendamento. Tente novamente.'
        setError(errorMessage)
        return
      }

      onConfirm(data.appointmentId!, new Date(data.startsAt!))
    } catch {
      setError('Erro de conexão. Verifique sua internet e tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 -ml-1 py-1 px-1 rounded"
        disabled={loading}
      >
        <ChevronLeft className="size-4" />
        Voltar
      </button>

      <div>
        <h2 className="text-xl font-semibold text-slate-900">Confirmar agendamento</h2>
        <p className="text-sm text-slate-500 mt-1">Revise os detalhes antes de confirmar</p>
      </div>

      {/* Resumo */}
      <div className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-100">
        <div className="flex items-center gap-3 p-4">
          <Scissors className="size-4 text-slate-400 shrink-0" />
          <div className="min-w-0">
            <p className="text-xs text-slate-400">Serviço</p>
            <p className="font-medium text-slate-900 text-sm">{booking.serviceName}</p>
            <p className="text-xs text-slate-500 mt-0.5">
              {booking.serviceDuration} min
              {booking.servicePrice ? ` · ${booking.servicePrice}` : ''}
            </p>
          </div>
        </div>

        {booking.professionalName && (
          <div className="flex items-center gap-3 p-4">
            <User className="size-4 text-slate-400 shrink-0" />
            <div>
              <p className="text-xs text-slate-400">Profissional</p>
              <p className="font-medium text-slate-900 text-sm">{booking.professionalName}</p>
            </div>
          </div>
        )}

        <div className="flex items-center gap-3 p-4">
          <Calendar className="size-4 text-slate-400 shrink-0" />
          <div>
            <p className="text-xs text-slate-400">Data e horário</p>
            <p className="font-medium text-slate-900 text-sm capitalize">
              {formatDateTime(booking.startsAt)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 p-4">
          <User className="size-4 text-slate-400 shrink-0" />
          <div>
            <p className="text-xs text-slate-400">Cliente</p>
            <p className="font-medium text-slate-900 text-sm">{booking.customerName}</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <Button
        onClick={handleConfirm}
        disabled={loading}
        className="w-full"
        size="lg"
        style={{ backgroundColor: primaryColor, borderColor: primaryColor }}
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <span className="size-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
            Confirmando...
          </span>
        ) : (
          'Confirmar agendamento'
        )}
      </Button>

      <p className="text-xs text-center text-slate-400">
        Você receberá uma confirmação via WhatsApp.
      </p>
    </div>
  )
}
