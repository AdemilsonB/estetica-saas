import { describe, it, expect, vi, beforeEach } from 'vitest'
import { RoleService } from './role.service'
import type { RoleRepository } from './role.repository'
import { ForbiddenError, ValidationError } from '@/shared/errors'

vi.mock('@/shared/database/prisma', () => ({
  prisma: {
    tenant: {
      findFirst: vi.fn(),
    },
    planFeatureConfig: {
      findMany: vi.fn(),
    },
  },
}))

vi.mock('@/domains/billing/plan-limits.service', () => ({
  planLimitsService: { assertWithinLimit: vi.fn() },
}))

import { prisma } from '@/shared/database/prisma'
import { planLimitsService } from '@/domains/billing/plan-limits.service'

const TENANT_ID = 'tenant-abc'
const ROLE_ID   = 'role-xyz'

const fakeRole = {
  id: ROLE_ID,
  tenantId: TENANT_ID,
  name: 'Esteticista',
  isDefault: false,
  permissions: { agenda: ['view'] },
  createdAt: new Date(),
  updatedAt: new Date(),
  _count: { users: 0 },
}

function makeRepoMock(): RoleRepository {
  return {
    findAll:       vi.fn(),
    findById:      vi.fn(),
    countByTenant: vi.fn(),
    countUsers:    vi.fn(),
    create:        vi.fn(),
    update:        vi.fn(),
    delete:        vi.fn(),
  } as unknown as RoleRepository
}

describe('RoleService', () => {
  let repo: RoleRepository
  let service: RoleService

  beforeEach(() => {
    repo = makeRepoMock()
    service = new RoleService(repo)
    vi.clearAllMocks()
  })

  describe('createRole', () => {
    beforeEach(() => {
      vi.mocked(planLimitsService.assertWithinLimit).mockResolvedValue(undefined)
      vi.mocked(prisma.tenant.findFirst).mockResolvedValue({ subscription: { plan: 'PRO' } } as any)
      // Opt-out: por padrão nenhuma seção está desabilitada
      vi.mocked(prisma.planFeatureConfig.findMany).mockResolvedValue([])
    })

    it('lança erro quando planLimitsService rejeita por limite', async () => {
      vi.mocked(repo.countByTenant).mockResolvedValue(3)
      vi.mocked(planLimitsService.assertWithinLimit).mockRejectedValue(new Error('Limite atingido'))
      await expect(
        service.createRole(TENANT_ID, { name: 'Novo', permissions: {} })
      ).rejects.toThrow()
    })

    it('lança ValidationError quando sectionKey não existe no NAV_REGISTRY', async () => {
      vi.mocked(repo.countByTenant).mockResolvedValue(1)
      await expect(
        service.createRole(TENANT_ID, {
          name: 'Novo',
          permissions: { secao_inexistente: ['view'] },
        })
      ).rejects.toThrow(ValidationError)
    })

    it('lança ValidationError quando action não é válida para a seção', async () => {
      vi.mocked(repo.countByTenant).mockResolvedValue(1)
      await expect(
        service.createRole(TENANT_ID, {
          name: 'Novo',
          permissions: { agenda: ['voar' as any] },
        })
      ).rejects.toThrow(ValidationError)
    })

    it('lança ValidationError quando seção está explicitamente desabilitada no plano', async () => {
      vi.mocked(repo.countByTenant).mockResolvedValue(1)
      vi.mocked(prisma.planFeatureConfig.findMany).mockResolvedValue([
        { sectionKey: 'financeiro', enabled: false } as any,
      ])
      await expect(
        service.createRole(TENANT_ID, {
          name: 'Novo',
          permissions: { financeiro: ['view'] },
        })
      ).rejects.toThrow(ValidationError)
    })

    it('cria cargo quando dados são válidos', async () => {
      vi.mocked(repo.countByTenant).mockResolvedValue(1)
      vi.mocked(repo.create).mockResolvedValue(fakeRole as any)
      const result = await service.createRole(TENANT_ID, {
        name: 'Novo',
        permissions: { agenda: ['view'] },
      })
      expect(repo.create).toHaveBeenCalledWith(TENANT_ID, {
        name: 'Novo',
        permissions: { agenda: ['view'] },
      })
      expect(result).toEqual(fakeRole)
    })

    it('expande permissões com dependências implícitas ausentes (agenda:create → clientes:view + servicos:view)', async () => {
      vi.mocked(repo.countByTenant).mockResolvedValue(1)
      vi.mocked(repo.create).mockResolvedValue(fakeRole as any)
      await service.createRole(TENANT_ID, {
        name: 'Novo',
        permissions: { agenda: ['view', 'create'] },
      })
      expect(repo.create).toHaveBeenCalledWith(TENANT_ID, {
        name: 'Novo',
        permissions: {
          agenda: ['view', 'create'],
          clientes: ['view'],
          servicos: ['view'],
        },
      })
    })

    it('expande permissões com dependências implícitas ausentes (financeiro:edit → descontos:view)', async () => {
      vi.mocked(repo.countByTenant).mockResolvedValue(1)
      vi.mocked(repo.create).mockResolvedValue(fakeRole as any)
      await service.createRole(TENANT_ID, {
        name: 'Novo',
        permissions: { financeiro: ['view', 'edit'] },
      })
      expect(repo.create).toHaveBeenCalledWith(TENANT_ID, {
        name: 'Novo',
        permissions: {
          financeiro: ['view', 'edit'],
          descontos: ['view'],
        },
      })
    })

    it('aceita seção extra "comissoes" (fora do NAV_REGISTRY)', async () => {
      vi.mocked(repo.countByTenant).mockResolvedValue(1)
      vi.mocked(repo.create).mockResolvedValue(fakeRole as any)
      await expect(
        service.createRole(TENANT_ID, {
          name: 'Novo',
          permissions: { comissoes: ['view', 'edit'] },
        })
      ).resolves.toBeDefined()
    })

    it('lança ValidationError quando a ação não existe para a seção extra "comissoes"', async () => {
      vi.mocked(repo.countByTenant).mockResolvedValue(1)
      await expect(
        service.createRole(TENANT_ID, {
          name: 'Novo',
          permissions: { comissoes: ['delete' as any] },
        })
      ).rejects.toThrow(ValidationError)
    })
  })

  describe('updateRole', () => {
    beforeEach(() => {
      vi.mocked(prisma.tenant.findFirst).mockResolvedValue({ subscription: { plan: 'PRO' } } as any)
      vi.mocked(prisma.planFeatureConfig.findMany).mockResolvedValue([])
      vi.mocked(repo.findById).mockResolvedValue(fakeRole as any)
    })

    it('expande permissões com dependências implícitas ausentes ao editar', async () => {
      vi.mocked(repo.update).mockResolvedValue(fakeRole as any)
      await service.updateRole(TENANT_ID, ROLE_ID, {
        permissions: { agenda: ['view', 'edit'] },
      })
      expect(repo.update).toHaveBeenCalledWith(TENANT_ID, ROLE_ID, {
        permissions: {
          agenda: ['view', 'edit'],
          clientes: ['view'],
          servicos: ['view'],
        },
      })
    })

    it('não mexe em permissions quando não enviado', async () => {
      vi.mocked(repo.update).mockResolvedValue(fakeRole as any)
      await service.updateRole(TENANT_ID, ROLE_ID, { name: 'Renomeado' })
      expect(repo.update).toHaveBeenCalledWith(TENANT_ID, ROLE_ID, {
        name: 'Renomeado',
        permissions: undefined,
      })
    })
  })

  describe('deleteRole', () => {
    it('lança ForbiddenError quando cargo tem usuários vinculados', async () => {
      vi.mocked(repo.countUsers).mockResolvedValue(2)
      await expect(
        service.deleteRole(TENANT_ID, ROLE_ID)
      ).rejects.toThrow(ForbiddenError)
    })

    it('exclui cargo quando não há usuários vinculados', async () => {
      vi.mocked(repo.countUsers).mockResolvedValue(0)
      vi.mocked(repo.delete).mockResolvedValue({ count: 1 } as any)
      await service.deleteRole(TENANT_ID, ROLE_ID)
      expect(repo.delete).toHaveBeenCalledWith(TENANT_ID, ROLE_ID)
    })
  })
})
