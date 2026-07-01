'use client'

import { useState } from 'react'
import { AgendaDayView } from '@/components/domain/scheduling/agenda-day-view'
import { AgendaWeekStrip } from '@/components/domain/scheduling/agenda-week-strip'
import { InstallAppBanner } from '@/components/domain/pwa/install-app-banner'

export default function AgendaPage() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())

  const formatted = selectedDate.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <InstallAppBanner />
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
          Agenda
        </h1>
        <p className="mt-1 text-sm text-slate-500 capitalize">{formatted}</p>
      </div>

      <AgendaWeekStrip
        selectedDate={selectedDate}
        onSelectDate={setSelectedDate}
      />

      <AgendaDayView date={selectedDate} />
    </div>
  )
}
