import { describe, it, expect, vi } from 'vitest'
import { prismaMock } from '@/shared/test/prisma-mock'

vi.mock('@/shared/database/prisma', () => ({ prisma: prismaMock }))

const { adminRepository } = await import('./admin.repository')

describe('adminRepository.findTenantDetail', () => {
  it('retorna null quando tenant não existe', async () => {
    prismaMock.tenant.findUnique.mockResolvedValue(null)
    const result = await adminRepository.findTenantDetail('inexistente')
    expect(result).toBeNull()
  })

  it('inclui subscription na query', async () => {
    prismaMock.tenant.findUnique.mockResolvedValue({ id: 'tenant-1', name: 'Salão Teste' } as never)
    await adminRepository.findTenantDetail('tenant-1')
    expect(prismaMock.tenant.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'tenant-1' },
        select: expect.objectContaining({ subscription: expect.any(Object) }),
      }),
    )
  })
})

describe('adminRepository.blockTenant / unblockTenant', () => {
  it('blockTenant seta isBlocked=true com motivo', async () => {
    prismaMock.tenant.update.mockResolvedValue({ isBlocked: true } as never)
    await adminRepository.blockTenant('tenant-1', 'inadimplência')
    expect(prismaMock.tenant.update).toHaveBeenCalledWith({
      where: { id: 'tenant-1' },
      data: { isBlocked: true, blockedReason: 'inadimplência' },
    })
  })

  it('unblockTenant seta isBlocked=false e limpa motivo', async () => {
    prismaMock.tenant.update.mockResolvedValue({ isBlocked: false } as never)
    await adminRepository.unblockTenant('tenant-1')
    expect(prismaMock.tenant.update).toHaveBeenCalledWith({
      where: { id: 'tenant-1' },
      data: { isBlocked: false, blockedReason: null },
    })
  })
})
