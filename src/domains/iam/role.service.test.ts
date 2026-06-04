import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PlanName } from '@prisma/client'
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

import { prisma } from '@/shared/database/prisma'

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
      vi.mocked(prisma.tenant.findFirst).mockResolvedValue({ plan: PlanName.FREE } as any)
      vi.mocked(prisma.planFeatureConfig.findMany).mockResolvedValue([
        { sectionKey: 'agenda', enabled: true } as any,
        { sectionKey: 'clientes', enabled: true } as any,
      ])
    })

    it('lança ForbiddenError quando FREE já tem 3 cargos', async () => {
      vi.mocked(repo.countByTenant).mockResolvedValue(3)
      await expect(
        service.createRole(TENANT_ID, { name: 'Novo', permissions: {} })
      ).rejects.toThrow(ForbiddenError)
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

    it('lança ValidationError quando seção não está habilitada no plano', async () => {
      vi.mocked(repo.countByTenant).mockResolvedValue(1)
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
