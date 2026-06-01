import { describe, it, expect, vi, beforeEach } from 'vitest'
import { prismaMock } from '@/shared/test/prisma-mock'
import { handleVipSweep, percentile80Threshold } from './vip-sweep'

beforeEach(() => vi.clearAllMocks())

describe('percentile80Threshold', () => {
  it('retorna Infinity quando há menos de 5 clientes', () => {
    const rows = [
      { customerId: 'a', total: 100 },
      { customerId: 'b', total: 200 },
    ]
    expect(percentile80Threshold(rows)).toBe(Infinity)
  })

  it('calcula o percentil 80 corretamente com 10 clientes', () => {
    const rows = Array.from({ length: 10 }, (_, i) => ({
      customerId: `c${i}`,
      total: (i + 1) * 100, // 100, 200, ..., 1000
    }))
    // sorted[8] = 900 (índice Math.floor(10 * 0.8) = 8)
    expect(percentile80Threshold(rows)).toBe(900)
  })
})

describe('handleVipSweep', () => {
  it('não chama updateMany quando não há tenants', async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([]) // tenants
    await handleVipSweep([])
    expect(prismaMock.customer.updateMany).not.toHaveBeenCalled()
  })

  it('marca VIPs e reseta não-VIPs num tenant com dados suficientes', async () => {
    const tenantId = 'tenant-1'
    prismaMock.$queryRaw
      .mockResolvedValueOnce([{ tenantId }]) // tenants
      .mockResolvedValueOnce([
        // spend rows — 10 clientes
        ...Array.from({ length: 10 }, (_, i) => ({
          customerId: `c${i}`,
          total: (i + 1) * 100,
        })),
      ])
    prismaMock.customer.updateMany.mockResolvedValue({ count: 0 })

    await handleVipSweep([])

    // Deve chamar updateMany duas vezes: uma para VIPs (true), outra para não-VIPs (false)
    expect(prismaMock.customer.updateMany).toHaveBeenCalledTimes(2)

    const [vipCall, nonVipCall] = prismaMock.customer.updateMany.mock.calls
    expect(vipCall[0].data).toEqual(expect.objectContaining({ isVip: true }))
    expect(nonVipCall[0].data).toEqual(expect.objectContaining({ isVip: false }))
  })

  it('reseta todos para não-VIP quando há menos de 5 clientes com gasto', async () => {
    const tenantId = 'tenant-1'
    prismaMock.$queryRaw
      .mockResolvedValueOnce([{ tenantId }])
      .mockResolvedValueOnce([
        { customerId: 'c1', total: 100 },
        { customerId: 'c2', total: 200 },
      ])
    prismaMock.customer.updateMany.mockResolvedValue({ count: 0 })

    await handleVipSweep([])

    // Apenas 1 chamada: reset geral (sem VIPs)
    expect(prismaMock.customer.updateMany).toHaveBeenCalledTimes(1)
    expect(prismaMock.customer.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ isVip: false }) }),
    )
  })
})
