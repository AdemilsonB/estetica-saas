import { describe, it, expect, beforeEach } from 'vitest'
import { prismaMock } from '@/shared/test/prisma-mock'
import { DiscountTypeRepository } from './discount-type.repository'
import { DiscountTypeInUseError, NotFoundError } from '@/shared/errors/domain-error'

const TENANT_ID = 'tenant-abc'
const DISCOUNT_ID = 'discount-1'

describe('DiscountTypeRepository', () => {
  let repo: DiscountTypeRepository

  beforeEach(() => {
    repo = new DiscountTypeRepository()
  })

  describe('list', () => {
    it('marca inUse=true quando o tipo já foi usado em algum agendamento', async () => {
      prismaMock.discountType.findMany.mockResolvedValue([
        { id: DISCOUNT_ID, tenantId: TENANT_ID, name: 'VIP', active: true, _count: { appointments: 3 } },
        { id: 'discount-2', tenantId: TENANT_ID, name: 'Novo cliente', active: true, _count: { appointments: 0 } },
      ] as never)

      const result = await repo.list(TENANT_ID)

      expect(result).toEqual([
        expect.objectContaining({ id: DISCOUNT_ID, inUse: true }),
        expect.objectContaining({ id: 'discount-2', inUse: false }),
      ])
      expect(result[0]).not.toHaveProperty('_count')
    })
  })

  describe('delete', () => {
    it('lança NotFoundError quando o tipo não pertence ao tenant', async () => {
      prismaMock.discountType.findFirst.mockResolvedValue(null)

      await expect(repo.delete(TENANT_ID, DISCOUNT_ID)).rejects.toThrow(NotFoundError)
      expect(prismaMock.appointment.count).not.toHaveBeenCalled()
      expect(prismaMock.discountType.delete).not.toHaveBeenCalled()
    })

    it('exclui fisicamente quando o tipo nunca foi usado em agendamentos', async () => {
      prismaMock.discountType.findFirst.mockResolvedValue({ id: DISCOUNT_ID, tenantId: TENANT_ID } as never)
      prismaMock.appointment.count.mockResolvedValue(0)
      prismaMock.discountType.delete.mockResolvedValue({} as never)

      await repo.delete(TENANT_ID, DISCOUNT_ID)

      expect(prismaMock.appointment.count).toHaveBeenCalledWith({ where: { discountTypeId: DISCOUNT_ID } })
      expect(prismaMock.discountType.delete).toHaveBeenCalledWith({ where: { id: DISCOUNT_ID } })
    })

    it('bloqueia a exclusão com DiscountTypeInUseError quando já usado em agendamentos', async () => {
      prismaMock.discountType.findFirst.mockResolvedValue({ id: DISCOUNT_ID, tenantId: TENANT_ID } as never)
      prismaMock.appointment.count.mockResolvedValue(2)

      await expect(repo.delete(TENANT_ID, DISCOUNT_ID)).rejects.toThrow(DiscountTypeInUseError)
      expect(prismaMock.discountType.delete).not.toHaveBeenCalled()
    })
  })

})
