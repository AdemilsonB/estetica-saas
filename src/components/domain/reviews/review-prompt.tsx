'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { Star } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type Pending = {
  appointmentId: string
  serviceName: string | null
  professionalName: string
  startsAt: string
}

type SubmitResult = {
  rating: number
  routedToGoogle: boolean
  googleReviewUrl: string | null
}

function Card({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border bg-white p-5 shadow-sm">{children}</div>
}

/**
 * Bloco de avaliação no portal do cliente. Aparece só quando há um atendimento
 * concluído sem avaliação. Nota alta encaminha ao Google; nota baixa vira
 * feedback privado (nunca vai ao Google).
 */
export function ReviewPrompt({ slug, primaryColor }: { slug: string; primaryColor: string }) {
  const [pending, setPending] = useState<Pending | null>(null)
  const [rating, setRating] = useState(0)
  const [hover, setHover] = useState(0)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<SubmitResult | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    let active = true
    fetch(`/api/public/${slug}/reviews`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (active && d?.pending) setPending(d.pending as Pending)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [slug])

  if (dismissed || !pending) return null

  async function submit() {
    if (rating < 1 || !pending) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/public/${slug}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appointmentId: pending.appointmentId,
          rating,
          comment: comment.trim() || undefined,
        }),
      })
      if (!res.ok) throw new Error()
      setResult((await res.json()) as SubmitResult)
    } catch {
      toast.error('Não foi possível enviar sua avaliação. Tente novamente.')
    } finally {
      setSubmitting(false)
    }
  }

  if (result) {
    if (result.routedToGoogle && result.googleReviewUrl) {
      return (
        <Card>
          <p className="text-lg font-semibold">💛 Que bom que gostou!</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Avalie a gente no Google em 10 segundos:
          </p>
          <Button
            asChild
            className="mt-3 min-h-11 w-full text-white"
            style={{ backgroundColor: primaryColor }}
          >
            <a href={result.googleReviewUrl} target="_blank" rel="noopener noreferrer">
              ⭐ Avaliar no Google
            </a>
          </Button>
          <button
            type="button"
            className="mt-2 min-h-11 w-full text-sm text-muted-foreground"
            onClick={() => setDismissed(true)}
          >
            pular
          </button>
        </Card>
      )
    }
    return (
      <Card>
        <p className="text-lg font-semibold">Obrigado pelo retorno.</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Sua avaliação foi enviada direto para o salão. Vamos melhorar.
        </p>
        <Button
          variant="outline"
          className="mt-3 min-h-11 w-full"
          onClick={() => setDismissed(true)}
        >
          Fechar
        </Button>
      </Card>
    )
  }

  const dateLabel = new Date(pending.startsAt).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
  })
  const title = [pending.serviceName, pending.professionalName ? `com ${pending.professionalName}` : null]
    .filter(Boolean)
    .join(' ')

  return (
    <Card>
      <p className="text-lg font-semibold">Como foi seu atendimento?</p>
      <p className="text-sm text-muted-foreground">
        {title ? `${title} · ` : ''}
        {dateLabel}
      </p>
      <div className="mt-3 flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            aria-label={`${n} estrela${n > 1 ? 's' : ''}`}
            className="flex min-h-11 min-w-11 items-center justify-center p-1"
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            onClick={() => setRating(n)}
          >
            <Star
              className={cn('h-7 w-7', (hover || rating) >= n ? 'fill-current' : 'text-muted-foreground')}
              style={(hover || rating) >= n ? { color: primaryColor } : undefined}
            />
          </button>
        ))}
      </div>
      {rating === 0 && <p className="text-xs text-muted-foreground">toque para avaliar</p>}
      <textarea
        className="mt-3 min-h-[64px] w-full rounded-md border border-input bg-background p-2 text-sm"
        placeholder="Conte pra gente… (opcional)"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        maxLength={1000}
      />
      <Button
        className="mt-3 min-h-11 w-full text-white"
        disabled={rating < 1 || submitting}
        onClick={submit}
        style={{ backgroundColor: primaryColor }}
      >
        {submitting ? 'Enviando…' : 'Enviar'}
      </Button>
    </Card>
  )
}
