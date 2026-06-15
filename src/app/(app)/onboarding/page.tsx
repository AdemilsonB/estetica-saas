'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { WizardStepper } from '@/components/domain/catalog/WizardStepper'
import { SegmentSelector } from '@/components/domain/catalog/SegmentSelector'
import { CatalogGrid } from '@/components/domain/catalog/CatalogGrid'

// ---------------------------------------------------------------------------
// Configuração dos steps
// ---------------------------------------------------------------------------

const STEPS = [
  { label: 'Segmento' },
  { label: 'Serviços' },
  { label: 'Produtos' },
  { label: 'Pronto' },
]

interface StepContent {
  title: string
  description: string
}

const STEP_CONTENT: Record<number, StepContent> = {
  1: {
    title: 'Qual é o seu tipo de negócio?',
    description: 'Selecione todos que se aplicam. Você pode alterar depois.',
  },
  2: {
    title: 'Ative seus serviços',
    description: 'Selecione os serviços que você oferece. Você pode personalizar depois.',
  },
  3: {
    title: 'Ative seus produtos',
    description: 'Controle seu estoque de insumos. Você pode adicionar mais depois.',
  },
  4: {
    title: 'Tudo pronto!',
    description: 'Seu catálogo está configurado. Você pode adicionar mais itens a qualquer momento.',
  },
}

// ---------------------------------------------------------------------------
// Step de confirmação
// ---------------------------------------------------------------------------

function ConfirmationStep({
  onComplete,
  isSaving,
}: {
  onComplete: () => void
  isSaving: boolean
}) {
  return (
    <div className="flex flex-col items-center gap-6 py-8 text-center">
      <div className="rounded-full bg-green-100 p-4">
        <CheckCircle2 className="size-12 text-green-600" />
      </div>
      <div className="space-y-2">
        <p className="text-lg font-medium">Catálogo configurado com sucesso!</p>
        <p className="text-sm text-muted-foreground">
          Você pode adicionar e personalizar serviços e produtos a qualquer momento.
        </p>
      </div>
      <div className="flex flex-col gap-3 w-full max-w-xs">
        <Button onClick={onComplete} disabled={isSaving} className="w-full">
          {isSaving ? 'Redirecionando...' : 'Ir para a Agenda'}
        </Button>
        <Button variant="outline" asChild className="w-full">
          <Link href="/configuracoes/catalogo">Configurar mais itens</Link>
        </Button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Página principal
// ---------------------------------------------------------------------------

export default function OnboardingPage() {
  const router = useRouter()

  const [step, setStep] = useState(1)
  const [segments, setSegments] = useState<string[]>([])
  const [segmentError, setSegmentError] = useState<string | undefined>()
  const [isSaving, setIsSaving] = useState(false)

  async function handleNext() {
    if (step === 1) {
      if (segments.length === 0) {
        setSegmentError('Selecione ao menos um segmento.')
        return
      }
      setSegmentError(undefined)
      setIsSaving(true)
      try {
        const res = await fetch('/api/onboarding/segments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ segments }),
        })
        if (!res.ok) throw new Error('Erro ao salvar segmentos')
        setStep(2)
      } catch {
        setSegmentError('Erro ao salvar. Tente novamente.')
      } finally {
        setIsSaving(false)
      }
      return
    }
    setStep(s => Math.min(s + 1, 4))
  }

  async function handleComplete() {
    setIsSaving(true)
    try {
      const res = await fetch('/api/onboarding/complete', { method: 'POST' })
      if (!res.ok) throw new Error('Erro ao completar onboarding')
      router.push('/agenda')
    } catch {
      // mantém isSaving=false via finally para o botão ficar habilitado novamente
    } finally {
      setIsSaving(false)
    }
  }

  const content = STEP_CONTENT[step]

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 space-y-8">
      <WizardStepper currentStep={step} steps={STEPS} />

      <div className="space-y-2">
        <h1 className="text-2xl font-bold">{content.title}</h1>
        <p className="text-muted-foreground">{content.description}</p>
      </div>

      {/* Conteúdo do step atual */}
      {step === 1 && (
        <SegmentSelector
          selected={segments}
          onChange={setSegments}
          error={segmentError}
        />
      )}

      {step === 2 && (
        <CatalogGrid
          type="services"
          segments={segments}
          serviceEditBasePath="/configuracoes/servicos"
        />
      )}

      {step === 3 && (
        <CatalogGrid
          type="products"
          segments={segments}
          productEditBasePath="/configuracoes/produtos"
        />
      )}

      {step === 4 && (
        <ConfirmationStep onComplete={handleComplete} isSaving={isSaving} />
      )}

      {/* Navegação entre steps */}
      {step < 4 && (
        <div className="flex justify-between">
          {step > 1 ? (
            <Button variant="ghost" onClick={() => setStep(s => s - 1)}>
              Voltar
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2 ml-auto">
            {step > 1 && (
              <Button variant="outline" onClick={() => setStep(s => s + 1)}>
                Pular
              </Button>
            )}
            <Button onClick={handleNext} disabled={isSaving}>
              {isSaving ? 'Salvando...' : 'Próximo'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
