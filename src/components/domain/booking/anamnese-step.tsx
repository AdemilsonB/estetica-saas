'use client'

import { useState, useEffect } from 'react'
import { CapilarForm } from './anamnese-blocks/capilar-form'
import { AnamneseReuseScreen } from './anamnese-reuse-screen'
import { Button } from '@/components/ui/button'
import type { CapilarBlock } from '@/domains/crm/anamnese-blocks.types'

type SubState =
  | { kind: 'loading' }
  | { kind: 'reuse'; anamneseId: string; customerId: string; isValid: boolean; ageDays: number; summary: Record<string, unknown> | null }
  | { kind: 'form' }
  | { kind: 'submitting' }
  | { kind: 'error'; message: string }

type Props = {
  tenantSlug: string
  serviceId?: string
  anamneseMode: 'OPTIONAL' | 'REQUIRED'
  customerPhone: string
  primaryColor: string
  onComplete: (anamneseId: string) => void
  onSkip: () => void
  onBack: () => void
}

export function AnamneseStep({
  tenantSlug,
  serviceId,
  anamneseMode,
  customerPhone,
  primaryColor,
  onComplete,
  onSkip,
  onBack,
}: Props) {
  const [state, setState] = useState<SubState>({ kind: 'loading' })

  useEffect(() => {
    async function check() {
      try {
        const params = new URLSearchParams({ phone: customerPhone })
        if (serviceId) params.set('serviceId', serviceId)
        const res = await fetch(`/api/public/${tenantSlug}/anamnese/check?${params}`)
        const data = await res.json() as {
          anamneseId: string | null
          customerId: string | null
          isValid: boolean
          ageDays: number
          summary: Record<string, unknown> | null
        }

        if (data.anamneseId) {
          setState({ kind: 'reuse', anamneseId: data.anamneseId, customerId: data.customerId!, isValid: data.isValid, ageDays: data.ageDays, summary: data.summary })
        } else {
          setState({ kind: 'form' })
        }
      } catch {
        setState({ kind: 'form' })
      }
    }
    void check()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleFormComplete(capilarData: CapilarBlock) {
    setState({ kind: 'submitting' })
    try {
      const res = await fetch(`/api/public/${tenantSlug}/anamnese`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: customerPhone, blockType: 'capilar', data: capilarData }),
      })
      const result = await res.json() as { anamneseId?: string; error?: unknown }
      if (!res.ok || !result.anamneseId) {
        setState({ kind: 'error', message: 'Não foi possível salvar a ficha. Tente novamente.' })
        return
      }
      onComplete(result.anamneseId)
    } catch {
      setState({ kind: 'error', message: 'Erro de conexão. Tente novamente.' })
    }
  }

  if (state.kind === 'loading') {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="size-6 rounded-full border-2 border-slate-300 border-t-slate-700 animate-spin" />
      </div>
    )
  }

  if (state.kind === 'reuse') {
    return (
      <AnamneseReuseScreen
        ageDays={state.ageDays}
        isValid={state.isValid}
        summary={state.summary as never}
        primaryColor={primaryColor}
        onReuse={() => onComplete(state.anamneseId)}
        onUpdate={() => setState({ kind: 'form' })}
      />
    )
  }

  if (state.kind === 'form') {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Ficha capilar</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Essas informações ajudam o profissional a preparar seu atendimento.
          </p>
        </div>
        <CapilarForm
          tenantSlug={tenantSlug}
          primaryColor={primaryColor}
          onComplete={handleFormComplete}
          onBack={onBack}
          onSkip={anamneseMode === 'OPTIONAL' ? onSkip : undefined}
        />
      </div>
    )
  }

  if (state.kind === 'submitting') {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="size-6 rounded-full border-2 border-slate-300 border-t-slate-700 animate-spin" />
      </div>
    )
  }

  // error state
  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
        {(state as { kind: 'error'; message: string }).message}
      </div>
      <Button onClick={() => setState({ kind: 'form' })} variant="outline" className="w-full">
        Tentar novamente
      </Button>
    </div>
  )
}
