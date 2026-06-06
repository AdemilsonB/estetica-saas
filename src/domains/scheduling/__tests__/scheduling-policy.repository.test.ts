import { describe, it, expect, beforeEach } from 'vitest'
import type { SchedulingPolicy } from '@prisma/client'
import { prismaMock } from '@/shared/test/prisma-mock'
import { SchedulingPolicyRepository } from '../scheduling-policy.repository'

const repo = new SchedulingPolicyRepository()

function makePolicy(overrides?: Partial<SchedulingPolicy>): SchedulingPolicy {
  return {
    id: 'policy-1',
    tenantId: 'tenant-1',
    paddingMinutes: 0,
    minAdvanceMinutes: 15,
    maxAdvanceDays: 60,
    allowPublicBooking: true,
    updatedAt: new Date(),
    ...overrides,
  }
}

describe('SchedulingPolicyRepository', () => {
  beforeEach(() => {
    prismaMock.schedulingPolicy.findUnique.mockResolvedValue(makePolicy())
    prismaMock.schedulingPolicy.create.mockResolvedValue(makePolicy())
    prismaMock.schedulingPolicy.upsert.mockResolvedValue(makePolicy())
  })

  describe('findByTenant', () => {
    it('retorna política existente para o tenant', async () => {
      const result = await repo.findByTenant('tenant-1')
      expect(prismaMock.schedulingPolicy.findUnique).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-1' },
      })
      expect(result).toMatchObject({ tenantId: 'tenant-1' })
    })
  })

  describe('findOrCreateByTenant', () => {
    it('retorna política existente se já existe', async () => {
      const existing = makePolicy()
      prismaMock.schedulingPolicy.findUnique.mockResolvedValue(existing)

      const result = await repo.findOrCreateByTenant('tenant-1')

      expect(prismaMock.schedulingPolicy.findUnique).toHaveBeenCalledOnce()
      expect(prismaMock.schedulingPolicy.create).not.toHaveBeenCalled()
      expect(result).toEqual(existing)
    })

    it('cria com defaults se política não existe', async () => {
      prismaMock.schedulingPolicy.findUnique.mockResolvedValue(null)
      const created = makePolicy()
      prismaMock.schedulingPolicy.create.mockResolvedValue(created)

      const result = await repo.findOrCreateByTenant('tenant-1')

      expect(prismaMock.schedulingPolicy.create).toHaveBeenCalledWith({
        data: { tenantId: 'tenant-1' },
      })
      expect(result).toEqual(created)
    })
  })

  describe('upsert', () => {
    it('cria nova política com os dados fornecidos', async () => {
      const data = { paddingMinutes: 10, allowPublicBooking: false }
      await repo.upsert('tenant-1', data)

      expect(prismaMock.schedulingPolicy.upsert).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-1' },
        create: { tenantId: 'tenant-1', ...data },
        update: data,
      })
    })

    it('atualiza política existente com novos valores', async () => {
      const updated = makePolicy({ paddingMinutes: 15, minAdvanceMinutes: 30 })
      prismaMock.schedulingPolicy.upsert.mockResolvedValue(updated)

      const data = { paddingMinutes: 15, minAdvanceMinutes: 30 }
      const result = await repo.upsert('tenant-1', data)

      expect(prismaMock.schedulingPolicy.upsert).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-1' },
        create: { tenantId: 'tenant-1', ...data },
        update: data,
      })
      expect(result).toMatchObject({ paddingMinutes: 15, minAdvanceMinutes: 30 })
    })
  })
})
