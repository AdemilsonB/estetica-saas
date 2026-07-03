import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter } as any)

const NEW_PROFESSIONAL_PERMISSIONS = {
  agenda:        ['view', 'create', 'edit', 'delete', 'view_all'],
  servicos:      ['view', 'create', 'edit', 'delete'],
  produtos:      ['view', 'create', 'edit', 'delete'],
  clientes:      ['view', 'create', 'edit'],
  financeiro:    ['view', 'create', 'edit'],
  relatorios:    ['view'],
  equipe:        ['view'],
  configuracoes: ['view', 'edit'],
}

async function main() {
  const result = await prisma.role.updateMany({
    where: {
      name: 'Profissional',
      isDefault: true,
    },
    data: {
      permissions: NEW_PROFESSIONAL_PERMISSIONS,
    },
  })

  console.log(`${result.count} role(s) atualizados`)
}

main()
  .catch((err) => { console.error(err); process.exit(1) })
  .finally(() => prisma.$disconnect())
