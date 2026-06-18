'use client'

import { useEffect, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
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
import { IdentificationStep } from '@/components/domain/booking/identification-step'
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
  preSelectServiceId,
  preSelectPackageId,
}: {
  tenantData: TenantPublicData
  preSelectServiceId?: string
  preSelectPackageId?: string
}) {
  const [authStatus, setAuthStatus] = useState<'checking' | 'unauthenticated' | 'authenticated'>('checking')
  const [step, setStep] = useState<BookingStep>('service')
  const [booking, setBooking] = useState<BookingState>({})
  const [appointmentId, setAppointmentId] = useState<string | null>(null)
  const [professionalsForService, setProfessionalsForService] = useState<PublicProfessional[]>(
    tenantData.professionals,
  )
  const [showServiceWarning, setShowServiceWarning] = useState(false)
  const initializedRef = useRef(false)

  const primaryColor = tenantData.branding?.primaryColor ?? '#7C3AED'
  const maxAdvanceDays = 60

  // Verificação de autenticação — primeira coisa a rodar
  useEffect(() => {
    fetch(`/api/public/${tenantData.slug}/me`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { name?: string; phone?: string } | null) => {
        if (data?.name) {
          setBooking((b) => ({
            ...b,
            customerName: data.name,
            customerPhone: data.phone ?? '',
          }))
          setAuthStatus('authenticated')
        } else {
          setAuthStatus('unauthenticated')
        }
      })
      .catch(() => setAuthStatus('unauthenticated'))
  }, [tenantData.slug])

  // Pré-seleção via query params (roda após autenticação confirmada)
  useEffect(() => {
    if (authStatus !== 'authenticated') return
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
  }, [authStatus])

  const singleProfessional = tenantData.professionals.length === 1
  const visibleSteps = ALL_STEPS.filter((s) => {
    if (s === 'professional' && singleProfessional) return false
    if (s === 'anamnese') return false
    return true
  })

  // Loading
  if (authStatus === 'checking') {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="size-6 animate-spin text-slate-400" />
      </div>
    )
  }

  // Gate: cliente não autenticado — identificação antes do fluxo de agendamento
  if (authStatus === 'unauthenticated') {
    return (
      <IdentificationStep
        tenantSlug={tenantData.slug}
        onIdentified={(id, name, isNew) => {
          // Busca dados completos (incluindo telefone) para preencher o booking
          fetch(`/api/public/${tenantData.slug}/me`)
            .then((r) => (r.ok ? (r.json() as Promise<{ name?: string; phone?: string }>) : null))
            .then((me) => {
              const customerName = me?.name ?? name
              setBooking((b) => ({
                ...b,
                customerName,
                customerPhone: me?.phone ?? '',
                customerId: id,
              }))
              setAuthStatus('authenticated')
              if (isNew) {
                toast.success(`Bem-vindo, ${customerName}! 🎉`, {
                  description: 'Cadastro realizado. Agora escolha o serviço.',
                })
              } else {
                toast.success(`Bem-vindo de volta, ${customerName}! 👋`, {
                  description: 'Agora escolha o serviço que deseja agendar.',
                })
              }
            })
            .catch(() => {
              setBooking((b) => ({ ...b, customerName: name, customerId: id }))
              setAuthStatus('authenticated')
            })
        }}
        onBack={() => {}}
        primaryColor={primaryColor}
        gateMode
      />
    )
  }

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
