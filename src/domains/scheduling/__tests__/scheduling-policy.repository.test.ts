import { describe, it, expect, beforeEach } from 'vitest'
import { prismaMock } from '@/shared/test/prisma-mock'
import { SchedulingPolicyRepository } from '../scheduling-policy.repository'

const repo = new SchedulingPolicyRepository()

const makePolicy = (overrides: Record<string, unknown> = {}) => ({
  id: 'policy-1',
  tenantId: 'tenant-1',
  paddingMinutes: 0,
  minAdvanceMinutes: 15,
  maxAdvanceDays: 60,
  allowPublicBooking: true,
  updatedAt: new Date(),
  ...overrides,
})

describe('SchedulingPolicyRepository', () => {
  beforeEach(() => {
    prismaMock.schedulingPolicy.findUnique.mockResolvedValue(makePolicy() as never)
    prismaMock.schedulingPolicy.create.mockResolvedValue(makePolicy() as never)
    prismaMock.schedulingPolicy.upsert.mockResolvedValue(makePolicy() as never)
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
      prismaMock.schedulingPolicy.findUnique.mockResolvedValue(existing as never)

      const result = await repo.findOrCreateByTenant('tenant-1')

      expect(prismaMock.schedulingPolicy.findUnique).toHaveBeenCalledOnce()
      expect(prismaMock.schedulingPolicy.create).not.toHaveBeenCalled()
      expect(result).toEqual(existing)
    })

    it('cria com defaults se política não existe', async () => {
      prismaMock.schedulingPolicy.findUnique.mockResolvedValue(null as never)
      const created = makePolicy()
      prismaMock.schedulingPolicy.create.mockResolvedValue(created as never)

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
      prismaMock.schedulingPolicy.upsert.mockResolvedValue(updated as never)

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
