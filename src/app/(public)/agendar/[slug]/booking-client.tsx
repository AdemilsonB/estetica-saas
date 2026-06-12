'use client'

import { useState } from 'react'
import type {
  BookingState,
  BookingStep,
  PublicPackage,
  PublicProfessional,
  PublicService,
  TenantPublicData,
} from './types'
import { ServiceStep, type PromotionServiceSelection } from '@/components/domain/booking/service-step'
import { ProfessionalStep } from '@/components/domain/booking/professional-step'
import { DateTimeStep } from '@/components/domain/booking/datetime-step'
import { PersonalStep } from '@/components/domain/booking/personal-step'
import { ConfirmationStep } from '@/components/domain/booking/confirmation-step'
import { BookingSuccess } from '@/components/domain/booking/booking-success'

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
  const [appointmentId, setAppointmentId] = useState<string | null>(null)
  const [professionalsForService, setProfessionalsForService] = useState<PublicProfessional[]>(
    tenantData.professionals,
  )
  const [showServiceWarning, setShowServiceWarning] = useState(false)

  const singleProfessional = tenantData.professionals.length === 1
  const primaryColor = tenantData.branding?.primaryColor ?? '#191919'
  const maxAdvanceDays = 60

  function handlePackageSelect(pkg: PublicPackage) {
    setBooking((b) => ({
      ...b,
      packageId: pkg.id,
      serviceId: undefined,
      promotionId: undefined,
      serviceDuration: pkg.duration,
      servicePrice: `R$ ${Number(pkg.price).toFixed(2).replace('.', ',')}`,
      serviceName: pkg.name,
    }))
    // Para pacotes, mostra todos os profissionais disponíveis
    setProfessionalsForService(tenantData.professionals)
    setShowServiceWarning(false)
    if (tenantData.professionals.length === 1) {
      const p = tenantData.professionals[0]!
      setBooking((b) => ({ ...b, professionalId: p.id, professionalName: p.name }))
      setStep('datetime')
    } else {
      setStep('professional')
    }
  }

  function handlePromotionServiceSelect(promotionId: string, service: PromotionServiceSelection) {
    const priceLabel = `R$ ${Number(service.discountedPrice).toFixed(2).replace('.', ',')}`

    setBooking((b) => ({
      ...b,
      promotionId,
      serviceId: service.id,
      packageId: undefined,
      serviceName: service.name,
      serviceDuration: service.duration,
      servicePrice: priceLabel,
    }))

    const linked = tenantData.professionals.filter((p) =>
      p.serviceIds.includes(service.id),
    )
    const filtered = linked.length > 0 ? linked : tenantData.professionals
    setProfessionalsForService(filtered)
    setShowServiceWarning(linked.length === 0)

    if (filtered.length === 1) {
      const p = filtered[0]!
      setBooking((b) => ({ ...b, professionalId: p.id, professionalName: p.name }))
      setStep('datetime')
    } else {
      setStep('professional')
    }
  }

  function handleServiceSelect(service: PublicService) {
    const priceLabel =
      service.priceType === 'ON_CONSULTATION'
        ? 'Sob consulta'
        : service.priceType === 'RANGE' &&
            service.priceMin != null &&
            service.priceMax != null
          ? `R$ ${Number(service.priceMin).toFixed(2)} – R$ ${Number(service.priceMax).toFixed(2)}`
          : service.priceType === 'STARTING_FROM'
            ? `A partir de R$ ${Number(service.price).toFixed(2)}`
            : `R$ ${Number(service.price).toFixed(2)}`

    setBooking((b) => ({
      ...b,
      serviceId: service.id,
      serviceName: service.name,
      serviceDuration: service.duration,
      servicePrice: priceLabel,
    }))

    // Filtra profissionais pelo serviço selecionado
    const linked = tenantData.professionals.filter((p) =>
      p.serviceIds.includes(service.id),
    )
    const filtered = linked.length > 0 ? linked : tenantData.professionals
    setProfessionalsForService(filtered)
    setShowServiceWarning(linked.length === 0)

    if (filtered.length === 1) {
      const p = filtered[0]!
      setBooking((b) => ({ ...b, professionalId: p.id, professionalName: p.name }))
      setStep('datetime')
    } else {
      setStep('professional')
    }
  }

  function handleProfessionalSelect(professional: PublicProfessional | null) {
    setBooking((b) => ({
      ...b,
      professionalId: professional?.id,
      professionalName: professional?.name,
    }))
    setStep('datetime')
  }

  function handleDateTimeSelect(startsAt: Date) {
    setBooking((b) => ({ ...b, startsAt }))
    setStep('personal')
  }

  function handlePersonalData(data: {
    customerName: string
    customerPhone: string
    notes?: string
  }) {
    setBooking((b) => ({
      ...b,
      customerName: data.customerName,
      customerPhone: data.customerPhone,
      notes: data.notes,
    }))
    setStep('confirmation')
  }

  function handleConfirm(confirmedAppointmentId: string, startsAt: Date) {
    setBooking((b) => ({ ...b, startsAt }))
    setAppointmentId(confirmedAppointmentId)
    setStep('success')
  }

  return (
    <div>
      <StepIndicator currentStep={step} />

      {step === 'service' && (
        <ServiceStep
          services={tenantData.services}
          onSelect={handleServiceSelect}
          primaryColor={primaryColor}
          packages={tenantData.packages}
          promotions={tenantData.promotions}
          onPackageSelect={handlePackageSelect}
          onPromotionServiceSelect={handlePromotionServiceSelect}
        />
      )}

      {step === 'professional' && showServiceWarning && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Nenhum profissional configurado para este serviço.
        </div>
      )}
      {step === 'professional' && (
        <ProfessionalStep
          professionals={professionalsForService}
          onSelect={handleProfessionalSelect}
          onBack={() => setStep('service')}
          primaryColor={primaryColor}
        />
      )}

      {step === 'datetime' && booking.serviceId && (
        <DateTimeStep
          tenantSlug={tenantData.slug}
          serviceId={booking.serviceId}
          professionalId={booking.professionalId}
          maxAdvanceDays={maxAdvanceDays}
          onSelect={handleDateTimeSelect}
          onBack={() =>
            singleProfessional ? setStep('service') : setStep('professional')
          }
          primaryColor={primaryColor}
        />
      )}

      {step === 'personal' && (
        <PersonalStep
          onSubmit={handlePersonalData}
          onBack={() => setStep('datetime')}
        />
      )}

      {step === 'confirmation' && (
        <ConfirmationStep
          booking={booking}
          tenantSlug={tenantData.slug}
          onConfirm={handleConfirm}
          onBack={() => setStep('personal')}
          primaryColor={primaryColor}
        />
      )}

      {step === 'success' && (
        <BookingSuccess
          booking={booking}
          tenantName={tenantData.name}
          primaryColor={primaryColor}
        />
      )}
    </div>
  )
}
