import { prisma } from '@/shared/database/prisma'
import { ForbiddenError, ValidationError, NotFoundError } from '@/shared/errors'
import { NAV_REGISTRY, buildDefaultRolePermissions } from '@/shared/permissions/nav-registry'
import { planLimitsService } from '@/domains/billing/plan-limits.service'
import type { RoleRepository } from './role.repository'

type RoleInput = {
  name: string
  permissions: Record<string, string[]>
}

export class RoleService {
  constructor(private readonly repo: RoleRepository) {}

  async listRoles(tenantId: string) {
    const existing = await this.repo.findAll(tenantId)
    if (existing.length > 0) return existing

    // Tenant sem cargos: semeia os 3 padrão automaticamente
    await prisma.role.createMany({
      data: (
        [
          { preset: 'MANAGER' as const,      name: 'Gerente' },
          { preset: 'PROFESSIONAL' as const, name: 'Profissional' },
          { preset: 'RECEPTIONIST' as const, name: 'Recepcionista' },
        ] as const
      ).map(({ preset, name }) => ({
        tenantId,
        name,
        isDefault: true,
        permissions: buildDefaultRolePermissions(preset),
      })),
      skipDuplicates: true,
    })
    return this.repo.findAll(tenantId)
  }

  async createRole(tenantId: string, input: RoleInput) {
    const count = await this.repo.countByTenant(tenantId)
    await planLimitsService.assertWithinLimit(tenantId, 'max_roles', count)

    await this.validatePermissions(tenantId, input.permissions)

    return this.repo.create(tenantId, input)
  }

  async updateRole(tenantId: string, roleId: string, input: Partial<RoleInput>) {
    const role = await this.repo.findById(tenantId, roleId)
    if (!role) throw new NotFoundError('Cargo')

    if (input.permissions) {
      await this.validatePermissions(tenantId, input.permissions)
    }

    return this.repo.update(tenantId, roleId, input)
  }

  async deleteRole(tenantId: string, roleId: string) {
    const userCount = await this.repo.countUsers(tenantId, roleId)
    if (userCount > 0) {
      throw new ForbiddenError(
        `Cargo possui ${userCount} usuário(s) vinculado(s). Reatribua-os antes de excluir.`
      )
    }
    return this.repo.delete(tenantId, roleId)
  }

  private async validatePermissions(
    tenantId: string,
    permissions: Record<string, string[]>
  ) {
    const tenant = await prisma.tenant.findFirst({
      where: { id: tenantId },
      select: { plan: true },
    })

    const disabledSections = await prisma.planFeatureConfig.findMany({
      where: { plan: tenant?.plan, enabled: false },
      select: { sectionKey: true },
    })
    const disabledKeys = new Set(disabledSections.map((s) => s.sectionKey))

    const registryMap = new Map(NAV_REGISTRY.map((s) => [s.key, s.actions]))

    for (const [sectionKey, actions] of Object.entries(permissions)) {
      if (actions.length === 0) continue

      if (!registryMap.has(sectionKey)) {
        throw new ValidationError(`Seção "${sectionKey}" não existe no sistema.`)
      }

      // Opt-out: seções sem entrada em PlanFeatureConfig são habilitadas por padrão.
      if (disabledKeys.has(sectionKey)) {
        throw new ValidationError(
          `Seção "${sectionKey}" não está disponível no plano atual.`
        )
      }

      const allowedActions = registryMap.get(sectionKey)!
      for (const action of actions) {
        if (!allowedActions.includes(action as any)) {
          throw new ValidationError(
            `Ação "${action}" não é válida para a seção "${sectionKey}".`
          )
        }
      }
    }
  }
}

import { roleRepository } from './role.repository'
export const roleService = new RoleService(roleRepository)
