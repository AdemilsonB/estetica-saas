'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Check, ChevronRight, Rocket, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useEffectiveActivationStatus } from '@/hooks/activation/use-effective-activation-status'
import {
  buildActivationSteps,
  activationProgressPercent,
  shouldShowActivationCard,
} from './activation-progress'

const DISMISSED_KEY = 'agende:activation-card-dismissed'

export function ActivationProgressCard() {
  const { data: status } = useEffectiveActivationStatus()
  // Lê o dismissal persistido apenas na montagem (não muda durante a sessão).
  const [dismissed] = useState(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem(DISMISSED_KEY) === '1'
  })
  // Esconde imediatamente ao clicar no X, sem depender da regra de reexibição.
  const [hidden, setHidden] = useState(false)

  if (!status) return null
  if (hidden) return null
  if (!shouldShowActivationCard({ status, dismissed })) return null

  const steps = buildActivationSteps(status)
  const percent = activationProgressPercent(status)

  function dismiss() {
    localStorage.setItem(DISMISSED_KEY, '1')
    setHidden(true)
  }

  return (
    <div className="rounded-2xl border border-violet-100 bg-gradient-to-br from-violet-50 to-pink-50 p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-white">
          <Rocket className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-slate-800">Configure seu negócio</p>
            <button
              type="button"
              aria-label="Dispensar"
              onClick={dismiss}
              className="text-slate-400 transition hover:text-slate-600"
            >
              <X className="size-4" />
            </button>
          </div>
          <p className="mt-0.5 text-xs text-slate-500">
            Complete os passos para começar a receber agendamentos.
          </p>

          {/* Barra de progresso */}
          <div className="mt-3 flex items-center gap-2">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/70">
              <div
                className="h-full rounded-full bg-gradient-to-r from-violet-600 to-pink-600 transition-all"
                style={{ width: `${percent}%` }}
              />
            </div>
            <span className="shrink-0 text-xs font-semibold text-violet-700">{percent}%</span>
          </div>

          {/* Checklist */}
          <ul className="mt-3 space-y-1.5">
            {steps.map((step) => (
              <li key={step.key}>
                <Link
                  href={step.href}
                  className={cn(
                    'flex items-center gap-2 rounded-xl px-2 py-2 text-sm transition',
                    step.done ? 'text-slate-400' : 'text-slate-700 hover:bg-white/60',
                  )}
                >
                  <span
                    className={cn(
                      'inline-flex size-5 shrink-0 items-center justify-center rounded-full border',
                      step.done ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-300 bg-white',
                    )}
                  >
                    {step.done && <Check className="size-3" />}
                  </span>
                  <span className={cn('flex-1', step.done && 'line-through')}>{step.label}</span>
                  {!step.done && <ChevronRight className="size-4 shrink-0 text-slate-300" />}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
