'use client'

import { AgendaDayView } from '@/components/domain/scheduling/agenda-day-view'
import { InstallAppBanner } from '@/components/domain/pwa/install-app-banner'

export default function AgendaPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <InstallAppBanner />
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
          Agenda
        </h1>
      </div>
      <AgendaDayView />
    </div>
  )
}
