import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient, UserRole } from '@prisma/client'
import { buildDefaultRolePermissions } from '../src/shared/permissions/nav-registry'
import { buildDefaultExtraPermissions } from '../src/shared/permissions/extra-permission-registry'
import { expandPermissionsWithDependencies } from '../src/shared/permissions/permission-dependencies'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter } as any)

const ROLE_LABEL_MAP: Record<string, string> = {
  [UserRole.MANAGER]: 'Gerente',
  [UserRole.PROFESSIONAL]: 'Profissional',
  [UserRole.RECEPTIONIST]: 'Recepcionista',
}

function isLegacyPreset(role: string): role is 'MANAGER' | 'PROFESSIONAL' | 'RECEPTIONIST' {
  return role === 'MANAGER' || role === 'PROFESSIONAL' || role === 'RECEPTIONIST'
}

// Passo 1: todo usuário sem roleId (fora do OWNER) recebe um cargo real —
// nunca mais deve depender do fallback hardcoded de session.ts em produção.
async function backfillMissingRoleIds() {
  const usersWithoutRole = await prisma.user.findMany({
    where: { roleId: null, role: { not: UserRole.OWNER } },
    select: { id: true, tenantId: true, role: true },
  })

  const roleIdCache = new Map<string, string>()
  let assigned = 0

  for (const user of usersWithoutRole) {
    if (!isLegacyPreset(user.role)) continue

    const cacheKey = `${user.tenantId}:${user.role}`
    let roleId = roleIdCache.get(cacheKey)

    if (!roleId) {
      const name = ROLE_LABEL_MAP[user.role]
      const existing = await prisma.role.findFirst({
        where: { tenantId: user.tenantId, name },
        select: { id: true },
      })

      if (existing) {
        roleId = existing.id
      } else {
        const created = await prisma.role.create({
          data: {
            tenantId: user.tenantId,
            name,
            isDefault: true,
            permissions: {
              ...buildDefaultRolePermissions(user.role),
              ...buildDefaultExtraPermissions(user.role),
            },
          },
        })
        roleId = created.id
      }
      roleIdCache.set(cacheKey, roleId)
    }

    await prisma.user.update({ where: { id: user.id }, data: { roleId } })
    assigned++
  }

  console.log(`roleId atribuído a ${assigned} usuário(s) sem cargo.`)
}

// Passo 2: cura cargos já salvos que ficaram incoerentes (ex.: agenda:create
// sem clientes:view) antes da regra de dependências existir.
async function healExistingRolePermissions() {
  const roles = await prisma.role.findMany({
    select: { id: true, name: true, tenantId: true, permissions: true },
  })

  let healed = 0
  for (const role of roles) {
    const current = role.permissions as Record<string, string[]>
    const { permissions: expanded, added } = expandPermissionsWithDependencies(current)
    if (added.length === 0) continue

    await prisma.role.update({ where: { id: role.id }, data: { permissions: expanded } })
    healed++
    console.log(
      `  cargo "${role.name}" (tenant ${role.tenantId}): +${added
        .map((a) => `${a.section}:${a.action}`)
        .join(', ')}`,
    )
  }

  console.log(`${healed} cargo(s) corrigido(s) com permissões de dependência ausentes.`)
}

async function main() {
  await backfillMissingRoleIds()
  await healExistingRolePermissions()
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
