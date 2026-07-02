'use client'

import { useEffect, useRef, useState } from 'react'
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
import { ConfirmationStep } from '@/components/domain/booking/confirmation-step'
import { BookingSuccess } from '@/components/domain/booking/booking-success'
import { AnamneseStep } from '@/components/domain/booking/anamnese-step'

const STEP_LABELS: Record<Exclude<BookingStep, 'success'>, string> = {
  service: 'Serviço',
  professional: 'Profissional',
  datetime: 'Data e hora',
  anamnese: 'Ficha',
  confirmation: 'Confirmar',
}

const ALL_STEPS: Exclude<BookingStep, 'success'>[] = [
  'service',
  'professional',
  'datetime',
  'anamnese',
  'confirmation',
]

function StepIndicator({
  currentStep,
  visibleSteps,
}: {
  currentStep: BookingStep
  visibleSteps: Exclude<BookingStep, 'success'>[]
}) {
  if (currentStep === 'success') return null
  const currentIndex = visibleSteps.indexOf(currentStep as Exclude<BookingStep, 'success'>)
  if (currentIndex < 0) return null
  return (
    <div className="mb-6">
      <div className="flex gap-1">
        {visibleSteps.map((step, index) => (
          <div
            key={step}
            className={`h-1 flex-1 rounded-full transition-colors ${
              index <= currentIndex ? 'bg-[--booking-primary,#7C3AED]' : 'bg-slate-200'
            }`}
          />
        ))}
      </div>
      <p className="mt-2 text-xs text-slate-500">
        Passo {currentIndex + 1} de {visibleSteps.length} —{' '}
        {STEP_LABELS[currentStep as Exclude<BookingStep, 'success'>]}
      </p>
    </div>
  )
}

export function BookingClient({
  tenantData,
  customerId,
  customerName,
  customerPhone,
  preSelectServiceId,
  preSelectPackageId,
}: {
  tenantData: TenantPublicData
  customerId: string
  customerName: string
  customerPhone: string
  preSelectServiceId?: string
  preSelectPackageId?: string
}) {
  const [step, setStep] = useState<BookingStep>('service')
  const [booking, setBooking] = useState<BookingState>({ customerId, customerName, customerPhone })
  const [appointmentId, setAppointmentId] = useState<string | null>(null)
  const [professionalsForService, setProfessionalsForService] = useState<PublicProfessional[]>(
    tenantData.professionals,
  )
  const [showServiceWarning, setShowServiceWarning] = useState(false)
  const initializedRef = useRef(false)

  const primaryColor = tenantData.branding?.primaryColor ?? '#7C3AED'
  const maxAdvanceDays = tenantData.maxAdvanceDays

  // Pré-seleção via query params — cliente já chega autenticado (gate fica em /entrar)
  useEffect(() => {
    if (initializedRef.current) return
    initializedRef.current = true

    if (preSelectServiceId) {
      const service = tenantData.services.find((s) => s.id === preSelectServiceId)
      if (service) {
        handleServiceSelect(service)
        return
      }
    }
    if (preSelectPackageId) {
      const pkg = tenantData.packages.find((p) => p.id === preSelectPackageId)
      if (pkg) {
        handlePackageSelect(pkg)
        return
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const singleProfessional = tenantData.professionals.length === 1
  const hasAnamnese =
    !!booking.serviceAnamneseMode && booking.serviceAnamneseMode !== 'NONE'
  const visibleSteps = ALL_STEPS.filter((s) => {
    if (s === 'professional' && singleProfessional) return false
    // A ficha só entra no progresso quando o serviço escolhido a exige
    if (s === 'anamnese' && !hasAnamnese) return false
    return true
  })

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
      servicePriceNumber:
        service.priceType === 'FIXED'
          ? service.price
          : (service.priceMin ?? service.price),
      serviceAnamneseMode: service.anamneseMode,
      serviceAnamneseBlocks: service.anamneseBlocks,
      serviceAnamneseValidityDays: service.anamneseValidityDays,
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
    const mode = booking.serviceAnamneseMode
    if (mode && mode !== 'NONE') {
      setStep('anamnese')
    } else {
      setStep('confirmation')
    }
  }

  function handleAnamneseComplete(anamneseId: string) {
    setBooking((b) => ({ ...b, anamneseId }))
    setStep('confirmation')
  }

  function handleConfirm(confirmedAppointmentId: string, startsAt: Date) {
    setBooking((b) => ({ ...b, startsAt }))
    setAppointmentId(confirmedAppointmentId)
    setStep('success')
  }

  return (
    <div>
      <StepIndicator currentStep={step} visibleSteps={visibleSteps} />

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

      {step === 'datetime' && (booking.serviceId || booking.packageId) && (
        <DateTimeStep
          tenantSlug={tenantData.slug}
          serviceId={booking.serviceId}
          packageId={booking.packageId}
          professionalId={booking.professionalId}
          maxAdvanceDays={maxAdvanceDays}
          onSelect={handleDateTimeSelect}
          onBack={() =>
            singleProfessional ? setStep('service') : setStep('professional')
          }
          primaryColor={primaryColor}
        />
      )}

      {step === 'anamnese' &&
        booking.customerPhone &&
        booking.serviceAnamneseMode &&
        booking.serviceAnamneseMode !== 'NONE' && (
          <AnamneseStep
            tenantSlug={tenantData.slug}
            serviceId={booking.serviceId}
            anamneseMode={booking.serviceAnamneseMode}
            customerPhone={booking.customerPhone}
            primaryColor={primaryColor}
            onComplete={handleAnamneseComplete}
            onSkip={() => setStep('confirmation')}
            onBack={() => setStep('datetime')}
          />
        )}

      {step === 'confirmation' && (
        <ConfirmationStep
          booking={booking}
          tenantSlug={tenantData.slug}
          onConfirm={handleConfirm}
          onBack={() => setStep('datetime')}
          primaryColor={primaryColor}
          whatsappEnabled={tenantData.whatsappEnabled ?? false}
        />
      )}

      {step === 'success' && (
        <BookingSuccess
          booking={booking}
          tenantName={tenantData.name}
          tenantSlug={tenantData.slug}
          primaryColor={primaryColor}
          whatsappEnabled={tenantData.whatsappEnabled ?? false}
        />
      )}
    </div>
  )
}
