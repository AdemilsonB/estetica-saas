'use client'

import { useState } from 'react'
import type {
  BookingState,
  BookingStep,
  PublicProfessional,
  PublicService,
  TenantPublicData,
} from './types'
import { ServiceStep } from '@/components/domain/booking/service-step'

const STEP_LABELS: Record<Exclude<BookingStep, 'success'>, string> = {
  service: 'Serviço',
  professional: 'Profissional',
  datetime: 'Data e hora',
  personal: 'Seus dados',
  confirmation: 'Confirmar',
}

const STEPS: Exclude<BookingStep, 'success'>[] = [
  'service',
  'professional',
  'datetime',
  'personal',
  'confirmation',
]

function StepIndicator({ currentStep }: { currentStep: BookingStep }) {
  if (currentStep === 'success') return null
  const currentIndex = STEPS.indexOf(currentStep as Exclude<BookingStep, 'success'>)
  return (
    <div className="mb-6">
      <div className="flex gap-1">
        {STEPS.map((step, index) => (
          <div
            key={step}
            className={`h-1 flex-1 rounded-full transition-colors ${
              index <= currentIndex ? 'bg-[--booking-primary,#191919]' : 'bg-slate-200'
            }`}
          />
        ))}
      </div>
      <p className="mt-2 text-xs text-slate-500">
        Passo {currentIndex + 1} de {STEPS.length} —{' '}
        {STEP_LABELS[currentStep as Exclude<BookingStep, 'success'>]}
      </p>
    </div>
  )
}

export function BookingClient({ tenantData }: { tenantData: TenantPublicData }) {
  const [step, setStep] = useState<BookingStep>('service')
  const [booking, setBooking] = useState<BookingState>({})

  const singleProfessional = tenantData.professionals.length === 1

  function handleServiceSelect(service: PublicService) {
    const priceLabel =
      service.priceType === 'ON_CONSULTATION'
        ? 'Sob consulta'
        : service.priceType === 'RANGE' &&
            service.priceMin != null &&
            service.priceMax != null
          ? `R$ ${Number(service.priceMin).toFixed(2)} – R$ ${Number(service.priceMax).toFixed(2)}`
          : `R$ ${Number(service.price).toFixed(2)}`

    setBooking((b) => ({
      ...b,
      serviceId: service.id,
      serviceName: service.name,
      serviceDuration: service.duration,
      servicePrice: priceLabel,
    }))

    if (singleProfessional) {
      const p = tenantData.professionals[0]!
      setBooking((b) => ({ ...b, professionalId: p.id, professionalName: p.name }))
      setStep('datetime')
    } else {
      setStep('professional')
    }
  }

  // Placeholders para steps futuros (Tasks 8 e 9)
  function handleProfessionalSelect(professional: PublicProfessional | null) {
    setBooking((b) => ({
      ...b,
      professionalId: professional?.id,
      professionalName: professional?.name,
    }))
    setStep('datetime')
  }

  // Suprime aviso de variável não utilizada em desenvolvimento
  void booking
  void handleProfessionalSelect

  return (
    <div>
      <StepIndicator currentStep={step} />

      {step === 'service' && (
        <ServiceStep
          services={tenantData.services}
          onSelect={handleServiceSelect}
          primaryColor={tenantData.branding?.primaryColor ?? '#191919'}
        />
      )}

      {/* Steps futuros — serão implementados nas Tasks 8 e 9 */}
      {step === 'professional' && (
        <div className="text-center text-slate-400 py-12">
          Step de profissional — Task 8
        </div>
      )}
      {step === 'datetime' && (
        <div className="text-center text-slate-400 py-12">
          Step de data/hora — Task 8
        </div>
      )}
      {step === 'personal' && (
        <div className="text-center text-slate-400 py-12">
          Step de dados — Task 8
        </div>
      )}
      {step === 'confirmation' && (
        <div className="text-center text-slate-400 py-12">
          Step de confirmação — Task 9
        </div>
      )}
    </div>
  )
}
