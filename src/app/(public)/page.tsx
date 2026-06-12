// src/app/(public)/page.tsx
import { prisma } from '@/shared/database/prisma'
import { LandingNav } from '@/components/domain/landing/landing-nav'
import { LandingHero } from '@/components/domain/landing/landing-hero'
import { LandingProofBar } from '@/components/domain/landing/landing-proof-bar'
import { LandingFeatures } from '@/components/domain/landing/landing-features'
import { LandingHowItWorks } from '@/components/domain/landing/landing-how-it-works'
import { LandingTestimonials } from '@/components/domain/landing/landing-testimonials'
import { LandingPricingCTA } from '@/components/domain/landing/landing-pricing-cta'
import { LandingFooter } from '@/components/domain/landing/landing-footer'
import { WhatsAppFloatButton } from '@/components/domain/landing/whatsapp-float-button'

export const revalidate = 3600

export const metadata = {
  title: 'Agendê — Seu salão no piloto automático',
  description:
    'Agenda online, WhatsApp automático e controle financeiro para salões de beleza. Comece grátis por 14 dias.',
}

export async function getLandingData() {
  const [starterPlan, metrics, testimonials] = await Promise.all([
    prisma.plan.findFirst({
      where: { name: 'STARTER', isActive: true },
      select: { price: true },
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

  return (
    <>
      <LandingNav />
      <main>
        <LandingHero />
        <LandingProofBar metrics={metrics} />
        <LandingFeatures />
        <LandingHowItWorks />
        <LandingTestimonials testimonials={testimonials} />
        <LandingPricingCTA starterPrice={starterPlan?.price ? Number(starterPlan.price) : null} />
      </main>
      <LandingFooter />
      {whatsappNumber && <WhatsAppFloatButton phoneNumber={whatsappNumber} />}
    </>
  )
}
