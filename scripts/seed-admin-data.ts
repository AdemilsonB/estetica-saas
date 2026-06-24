import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient, PlanName } from '@prisma/client'
import { LIMIT_REGISTRY } from '../src/shared/permissions/limit-registry'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter } as any)

// description: um benefício por linha — é o que /planos, onboarding e
// /api/public/plans exibem como bullets. Fonte única de verdade configurada
// pelo admin (nunca duplicar essa lista hardcoded no frontend).
const PLANS = [
  // FREE não é mais vendido (ver PR de billing/ADR-010) — isActive: false,
  // nunca exibido em landing/planos/onboarding.
  {
    name: PlanName.FREE, displayName: 'Free', price: 0, isActive: false, displayOrder: 0,
    description: ['Até 2 profissionais', 'Até 50 agendamentos/mês', 'Agenda e CRM básico', 'Relatórios básicos'].join('\n'),
  },
  {
    name: PlanName.STARTER, displayName: 'Starter', price: 49.90, isActive: true, displayOrder: 1,
    description: ['Até 5 profissionais', 'Até 300 agendamentos/mês', 'WhatsApp automático', 'Página de agendamento pública', 'Relatórios completos + CSV', 'Estoque de produtos'].join('\n'),
  },
  {
    name: PlanName.PRO, displayName: 'Pro', price: 149.90, isActive: true, displayOrder: 2,
    description: ['Até 20 profissionais', 'Até 2.000 agendamentos/mês', 'WhatsApp premium (chatbot, aniversário)', 'Tudo do Starter', 'Relatórios avançados', 'Até 3 unidades'].join('\n'),
  },
  {
    name: PlanName.ENTERPRISE, displayName: 'Enterprise', price: 0, isActive: true, displayOrder: 3,
    description: ['Profissionais ilimitados', 'Agendamentos ilimitados', 'WhatsApp ilimitado', 'Unidades ilimitadas', 'Suporte prioritário', 'Tudo do Pro'].join('\n'),
  },
]

const BILLING_FEATURES: Array<{ sectionKey: string; plans: Partial<Record<PlanName, boolean>> }> = [
  { sectionKey: 'reports_basic',     plans: { FREE: true,  STARTER: true,  PRO: true,  ENTERPRISE: true  } },
  { sectionKey: 'whatsapp_basic',    plans: { FREE: false, STARTER: true,  PRO: true,  ENTERPRISE: true  } },
  { sectionKey: 'campaigns',         plans: { FREE: false, STARTER: true,  PRO: true,  ENTERPRISE: true  } },
  { sectionKey: 'reports_advanced',  plans: { FREE: false, STARTER: false, PRO: true,  ENTERPRISE: true  } },
  { sectionKey: 'whatsapp_premium',  plans: { FREE: false, STARTER: false, PRO: true,  ENTERPRISE: true  } },
  { sectionKey: 'multi_unit',        plans: { FREE: false, STARTER: false, PRO: true,  ENTERPRISE: true  } },
]

async function main() {
  const planNames = [PlanName.FREE, PlanName.STARTER, PlanName.PRO, PlanName.ENTERPRISE]

  // 1. Seed tabela Plan
  for (const plan of PLANS) {
    await prisma.plan.upsert({
      where: { name: plan.name },
      update: { displayName: plan.displayName, price: plan.price, description: plan.description, displayOrder: plan.displayOrder, isActive: plan.isActive },
      create: plan,
    })
  }
  console.log('Plan: 4 planos inseridos/atualizados')

  // 2. Seed PlanLimitConfig
  const limitKeys = Object.keys(LIMIT_REGISTRY) as Array<keyof typeof LIMIT_REGISTRY>
  for (const planName of planNames) {
    for (const limitKey of limitKeys) {
      const value = LIMIT_REGISTRY[limitKey].defaults[planName]
      await prisma.planLimitConfig.upsert({
        where: { plan_limitKey: { plan: planName, limitKey } },
        update: {},
        create: { plan: planName, limitKey, value },
      })
    }
  }
  console.log('PlanLimitConfig: 24 registros inseridos/atualizados')

  // 3. Seed billing features em PlanFeatureConfig
  for (const { sectionKey, plans } of BILLING_FEATURES) {
    for (const planName of planNames) {
      const enabled = plans[planName] ?? false
      await prisma.planFeatureConfig.upsert({
        where: { plan_sectionKey: { plan: planName, sectionKey } },
        update: { enabled },
        create: { plan: planName, sectionKey, enabled },
      })
    }
  }
  console.log('PlanFeatureConfig billing features: 24 registros inseridos/atualizados')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
