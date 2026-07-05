// src/app/(public)/page.tsx
import { prisma } from '@/shared/database/prisma'
import { getPublicPlans } from '@/domains/billing/plan-catalog.service'
import { LandingNav } from '@/components/domain/landing/landing-nav'
import { LandingHero } from '@/components/domain/landing/landing-hero'
import { LandingProofBar } from '@/components/domain/landing/landing-proof-bar'
import { LandingFeatures } from '@/components/domain/landing/landing-features'
import { LandingHowItWorks } from '@/components/domain/landing/landing-how-it-works'
import { LandingBranding } from '@/components/domain/landing/landing-branding'
import { LandingTestimonials } from '@/components/domain/landing/landing-testimonials'
import { LandingPlans } from '@/components/domain/landing/landing-plans'
import { LandingPricingCTA } from '@/components/domain/landing/landing-pricing-cta'
import { LandingFooter } from '@/components/domain/landing/landing-footer'
import { WhatsAppFloatButton } from '@/components/domain/landing/whatsapp-float-button'

export const revalidate = 3600

export const metadata = {
  title: 'Agendê — Seu salão no piloto automático',
  description:
    'Agenda online, WhatsApp automático e controle financeiro para salões de beleza. Comece com trial grátis, sem cartão de crédito.',
}

export async function getLandingData() {
  const [plans, metrics, testimonials] = await Promise.all([
    getPublicPlans(),
    prisma.landingMetric.findMany({ where: { isActive: true }, orderBy: { order: 'asc' } }),
    prisma.landingTestimonial.findMany({ where: { isActive: true }, orderBy: { order: 'asc' } }),
  ])

  const starterPlan = plans.find((p) => p.name === 'STARTER') ?? null

  return { plans, starterPlan, metrics, testimonials }
}

export default async function LandingPage() {
  const { plans, starterPlan, metrics, testimonials } = await getLandingData()

  const whatsappNumber = process.env.NEXT_PUBLIC_WHATSAPP_SUPPORT_NUMBER ?? ''
  const trialDays = starterPlan?.trialDays ?? null
  const starterPrice = starterPlan?.price ?? null

  const plansForCards = plans.map((p) => ({
    name: p.name,
    displayName: p.displayName,
    price: p.price,
    features: p.benefits,
    highlights: p.highlights,
    trialDays: p.trialDays,
    isPopular: p.isPopular,
  }))

  return (
    <>
      <LandingNav />
      <main>
        <LandingHero trialDays={trialDays} />
        <LandingProofBar metrics={metrics} />
        <LandingFeatures />
        <LandingBranding />
        <LandingHowItWorks />
        <LandingTestimonials testimonials={testimonials} />
        <LandingPlans plans={plansForCards} trialDays={trialDays} />
        <LandingPricingCTA starterPrice={starterPrice} trialDays={trialDays} />
      </main>
      <LandingFooter whatsappNumber={whatsappNumber} />
      {whatsappNumber && <WhatsAppFloatButton phoneNumber={whatsappNumber} />}
    </>
  )
}
