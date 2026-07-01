// src/app/(public)/page.tsx
import { prisma } from '@/shared/database/prisma'
import { LandingNav } from '@/components/domain/landing/landing-nav'
import { LandingHero } from '@/components/domain/landing/landing-hero'
import { LandingProofBar } from '@/components/domain/landing/landing-proof-bar'
import { LandingFeatures } from '@/components/domain/landing/landing-features'
import { LandingHowItWorks } from '@/components/domain/landing/landing-how-it-works'
import { LandingBranding } from '@/components/domain/landing/landing-branding'
import { LandingTestimonials } from '@/components/domain/landing/landing-testimonials'
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
  const [starterPlan, metrics, testimonials] = await Promise.all([
    prisma.plan.findFirst({
      where: { name: 'STARTER', isActive: true },
      select: { price: true, trialDays: true },
    }),
    prisma.landingMetric.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' },
    }),
    prisma.landingTestimonial.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' },
    }),
  ])

  return { starterPlan, metrics, testimonials }
}

export default async function LandingPage() {
  const { starterPlan, metrics, testimonials } = await getLandingData()

  const whatsappNumber = process.env.NEXT_PUBLIC_WHATSAPP_SUPPORT_NUMBER ?? ''
  const trialDays = starterPlan?.trialDays ?? null
  const starterPrice = starterPlan?.price ? Number(starterPlan.price) : null

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
        <LandingPricingCTA starterPrice={starterPrice} trialDays={trialDays} />
      </main>
      <LandingFooter whatsappNumber={whatsappNumber} />
      {whatsappNumber && <WhatsAppFloatButton phoneNumber={whatsappNumber} />}
    </>
  )
}
