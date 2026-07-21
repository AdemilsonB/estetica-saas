'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { Star } from 'lucide-react'

type Feedback = {
  id: string
  rating: number
  comment: string | null
  routedToGoogle: boolean
  createdAt: string
  customerName: string
  serviceName: string | null
}

type Summary = {
  total: number
  average: number
  distribution: Record<string, number>
  routedToGoogle: number
  feedback: Feedback[]
}

function Card({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border bg-card p-5 shadow-sm">{children}</div>
}

/** Painel do dono: média, distribuição, % ao Google e feedbacks recentes. */
export function ReviewsSummaryCard() {
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    let active = true
    fetch('/api/reviews/summary')
      .then((r) => {
        if (!r.ok) throw new Error()
        return r.json()
      })
      .then((d) => {
        if (active) {
          setSummary(d as Summary)
          setLoading(false)
        }
      })
      .catch(() => {
        if (active) {
          setError(true)
          setLoading(false)
        }
      })
    return () => {
      active = false
    }
  }, [])

  if (loading) {
    return (
      <Card>
        <p className="text-sm text-muted-foreground">Carregando avaliações…</p>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <p className="text-sm text-muted-foreground">Não foi possível carregar as avaliações.</p>
      </Card>
    )
  }

  if (!summary || summary.total === 0) {
    return (
      <Card>
        <h3 className="font-semibold">Avaliações</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Ainda sem avaliações. Elas aparecem aqui quando seus clientes avaliam os atendimentos
          concluídos.
        </p>
      </Card>
    )
  }

  const bars = [5, 4, 3, 2, 1] as const
  const max = Math.max(...bars.map((s) => summary.distribution[String(s)] ?? 0), 1)

  return (
    <Card>
      <h3 className="font-semibold">Avaliações</h3>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-3xl font-bold">{summary.average.toFixed(1).replace('.', ',')}</span>
        <Star className="h-5 w-5 fill-amber-400 text-amber-400" />
        <span className="text-sm text-muted-foreground">· {summary.total} avaliações</span>
      </div>
      <p className="text-xs text-muted-foreground">
        {summary.routedToGoogle} encaminhadas ao Google
      </p>

      <div className="mt-3 space-y-1">
        {bars.map((s) => {
          const n = summary.distribution[String(s)] ?? 0
          return (
            <div key={s} className="flex items-center gap-2 text-xs">
              <span className="w-6 text-muted-foreground">{s}★</span>
              <div className="h-2 flex-1 rounded bg-muted">
                <div className="h-2 rounded bg-amber-400" style={{ width: `${(n / max) * 100}%` }} />
              </div>
              <span className="w-6 text-right text-muted-foreground">{n}</span>
            </div>
          )
        })}
      </div>

      {summary.feedback.length > 0 && (
        <div className="mt-4">
          <p className="text-sm font-medium">Feedbacks recentes</p>
          <ul className="mt-2 space-y-2">
            {summary.feedback.slice(0, 5).map((f) => (
              <li key={f.id} className="border-t pt-2 text-sm">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="text-amber-500">{'★'.repeat(f.rating)}</span>
                  <span>
                    {f.customerName}
                    {f.serviceName ? ` · ${f.serviceName}` : ''}
                  </span>
                </div>
                {f.comment && <p className="mt-0.5 text-foreground">{f.comment}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  )
}
