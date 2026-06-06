'use client'

import { CheckCircle2 } from 'lucide-react'
import type { BookingState } from '@/app/(public)/agendar/[slug]/types'

function generateICS(booking: BookingState, tenantName: string): string {
  if (!booking.startsAt) return ''
  const start = booking.startsAt
  const end = new Date(start.getTime() + (booking.serviceDuration ?? 60) * 60_000)
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//EstéticaSaaS//Agendamento//PT',
    'BEGIN:VEVENT',
    `DTSTART:${fmt(start)}`,
    `DTEND:${fmt(end)}`,
    `SUMMARY:${booking.serviceName ?? 'Agendamento'} - ${tenantName}`,
    `DESCRIPTION:Agendamento confirmado em ${tenantName}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n')
}

function downloadICS(content: string) {
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'agendamento.ics'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function BookingSuccess({
  booking,
  tenantName,
  primaryColor,
}: {
  booking: BookingState
  tenantName: string
  primaryColor: string
}) {
  function formatDate(d?: Date): string {
    if (!d) return ''
    return new Intl.DateTimeFormat('pt-BR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d)
  }

  const icsContent = generateICS(booking, tenantName)

  return (
    <div className="text-center space-y-6 py-8">
      <div className="flex justify-center">
        {/* animate-in zoom-in-50 fade-in duration-300: animação de entrada via tw-animate-css */}
        <CheckCircle2
          className="size-16 animate-in zoom-in-50 fade-in duration-300"
          style={{ color: primaryColor }}
        />
      </div>

      <div>
        <h2 className="text-xl font-bold text-slate-900">Agendamento confirmado!</h2>
        <p className="text-slate-500 mt-2 text-sm">
          Você receberá uma confirmação via WhatsApp em breve.
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 text-left space-y-1">
        <p className="font-semibold text-slate-900">{booking.serviceName}</p>
        {booking.professionalName && (
          <p className="text-sm text-slate-500">com {booking.professionalName}</p>
        )}
        <p className="text-sm font-medium text-slate-700 capitalize mt-1">
          {formatDate(booking.startsAt)}
        </p>
      </div>

      {icsContent && (
        <button
          onClick={() => downloadICS(icsContent)}
          className="text-sm font-medium hover:underline"
          style={{ color: primaryColor }}
        >
          + Adicionar ao calendário
        </button>
      )}
    </div>
  )
}
