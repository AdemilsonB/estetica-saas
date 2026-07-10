import { describe, it, expect, beforeEach } from 'vitest'
import { prismaMock } from '@/shared/test/prisma-mock'
import { Prisma } from '@prisma/client'
import { CommissionRepository } from './commission.repository'

const TENANT_ID = 'tenant-abc'
const ROLE_ID = 'role-barbeiro'

describe('CommissionRepository.applyRateToRole', () => {
  let repo: CommissionRepository

  beforeEach(() => {
    repo = new CommissionRepository()
    prismaMock.$transaction.mockImplementation((ops: unknown) =>
      Promise.all(ops as Promise<unknown>[]),
    )
  })

  it('aplica a taxa a cada serviço vinculado de cada profissional do cargo', async () => {
    prismaMock.user.findMany.mockResolvedValue([
      { id: 'user-1', professionalServices: [{ serviceId: 'svc-1' }, { serviceId: 'svc-2' }] },
      { id: 'user-2', professionalServices: [{ serviceId: 'svc-1' }] },
    ] as any)
    prismaMock.serviceCommission.upsert.mockResolvedValue({} as any)

    const result = await repo.applyRateToRole(TENANT_ID, ROLE_ID, 40)

    expect(prismaMock.user.findMany).toHaveBeenCalledWith({
      where: { tenantId: TENANT_ID, roleId: ROLE_ID },
      select: { id: true, professionalServices: { select: { serviceId: true } } },
    })
    expect(prismaMock.serviceCommission.upsert).toHaveBeenCalledTimes(3)
    expect(prismaMock.serviceCommission.upsert).toHaveBeenCalledWith({
      where: { tenantId_serviceId_professionalId: { tenantId: TENANT_ID, serviceId: 'svc-1', professionalId: 'user-1' } },
      update: { rate: new Prisma.Decimal(40) },
      create: { tenantId: TENANT_ID, serviceId: 'svc-1', professionalId: 'user-1', rate: new Prisma.Decimal(40) },
    })
    expect(result).toEqual({ applied: 3 })
  })

  it('não chama upsert nem $transaction quando ninguém do cargo tem serviço vinculado', async () => {
    prismaMock.user.findMany.mockResolvedValue([
      { id: 'user-1', professionalServices: [] },
    ] as any)

    const result = await repo.applyRateToRole(TENANT_ID, ROLE_ID, 40)

    expect(prismaMock.serviceCommission.upsert).not.toHaveBeenCalled()
    expect(result).toEqual({ applied: 0 })
  })
})
