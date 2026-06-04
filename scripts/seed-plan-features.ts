import { PrismaClient, PlanName } from '@prisma/client'
import { NAV_REGISTRY } from '../src/shared/permissions/nav-registry'

const prisma = new PrismaClient()

async function main() {
  const plans = [PlanName.FREE, PlanName.STARTER, PlanName.PRO, PlanName.ENTERPRISE]

  for (const plan of plans) {
    for (const section of NAV_REGISTRY) {
      await prisma.planFeatureConfig.upsert({
        where: { plan_sectionKey: { plan, sectionKey: section.key } },
        update: {},
        create: { plan, sectionKey: section.key, enabled: true },
      })
    }
  }

  console.log('PlanFeatureConfig populado com sucesso.')
}

main().finally(() => prisma.$disconnect())
