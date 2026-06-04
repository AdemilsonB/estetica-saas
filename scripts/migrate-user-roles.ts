import { PrismaClient, UserRole } from '@prisma/client'

const prisma = new PrismaClient()

const ROLE_NAME_MAP: Record<string, string> = {
  [UserRole.MANAGER]:      'Gerente',
  [UserRole.PROFESSIONAL]: 'Profissional',
  [UserRole.RECEPTIONIST]: 'Recepcionista',
}

async function main() {
  const tenants = await prisma.tenant.findMany({ select: { id: true } })

  for (const tenant of tenants) {
    const roles = await prisma.role.findMany({
      where: { tenantId: tenant.id },
      select: { id: true, name: true },
    })

    const roleByName = Object.fromEntries(roles.map((r) => [r.name, r.id]))

    const users = await prisma.user.findMany({
      where: { tenantId: tenant.id, role: { not: UserRole.OWNER } },
      select: { id: true, role: true },
    })

    for (const user of users) {
      const roleName = ROLE_NAME_MAP[user.role]
      const roleId = roleName ? roleByName[roleName] : undefined
      if (roleId) {
        await prisma.user.update({ where: { id: user.id }, data: { roleId } })
      }
    }
  }

  console.log('Migração de roleId concluída.')
}

main().finally(() => prisma.$disconnect())
