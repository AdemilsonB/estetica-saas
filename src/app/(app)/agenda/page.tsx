import { AgendaDayView } from '@/components/domain/scheduling/agenda-day-view'

export const metadata = { title: 'Agenda · Estética SaaS' }

export default function AgendaPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
          Agenda
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Gerencie seus atendimentos do dia
        </p>
      </div>
      <AgendaDayView />
    </div>
  )
}
