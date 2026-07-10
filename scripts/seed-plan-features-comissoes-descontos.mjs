// scripts/seed-plan-features-comissoes-descontos.mjs
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

const KEYS = ['comissoes', 'descontos']
const PLANS = ['FREE', 'STARTER', 'PRO', 'ENTERPRISE']

async function main() {
  for (const plan of PLANS) {
    for (const sectionKey of KEYS) {
      await prisma.planFeatureConfig.upsert({
        where: { plan_sectionKey: { plan, sectionKey } },
        update: { enabled: true },
        create: { plan, sectionKey, enabled: true },
      })
      console.log(`OK: ${plan} / ${sectionKey} = enabled`)
    }
  }
}

main()
  .catch((err) => { console.error(err); process.exit(1) })
  .finally(() => prisma.$disconnect())
