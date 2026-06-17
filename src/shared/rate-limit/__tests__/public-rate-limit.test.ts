import { describe, it, expect, vi, beforeEach } from 'vitest'
import { prismaMock } from '@/shared/test/prisma-mock'
import { checkRateLimit } from '../public-rate-limit'

beforeEach(() => vi.clearAllMocks())

describe('checkRateLimit', () => {
  const baseParams = {
    ip: '127.0.0.1',
    action: 'appointment' as const,
    maxPerWindow: 3,
  }

  it('primeira chamada: cria registro e retorna allowed: true', async () => {
    prismaMock.publicRateLimit.findFirst.mockResolvedValueOnce(null)
    prismaMock.publicRateLimit.create.mockResolvedValueOnce({
      id: 'rl-1',
      ip: '127.0.0.1',
      phone: null,
      action: 'appointment',
      count: 1,
      windowStart: new Date(),
    })

    const result = await checkRateLimit(baseParams)

    expect(prismaMock.publicRateLimit.create).toHaveBeenCalledOnce()
    expect(result).toEqual({ allowed: true, remaining: 2 })
  })

  it('chamada dentro do limite: incrementa e retorna allowed: true', async () => {
    prismaMock.publicRateLimit.findFirst.mockResolvedValueOnce({
      id: 'rl-1',
      ip: '127.0.0.1',
      phone: null,
      action: 'appointment',
      count: 1,
      windowStart: new Date(),
    })
    prismaMock.publicRateLimit.update.mockResolvedValueOnce({
      id: 'rl-1',
      ip: '127.0.0.1',
      phone: null,
      action: 'appointment',
      count: 2,
      windowStart: new Date(),
    })

    const result = await checkRateLimit(baseParams)

    expect(prismaMock.publicRateLimit.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'rl-1' },
        data: { count: { increment: 1 } },
      }),
    )
    // remaining = maxPerWindow - record.count - 1 = 3 - 1 - 1 = 1
    expect(result).toEqual({ allowed: true, remaining: 1 })
  })

  it('chamada acima do limite: retorna allowed: false, remaining: 0', async () => {
    prismaMock.publicRateLimit.findFirst.mockResolvedValueOnce({
      id: 'rl-1',
      ip: '127.0.0.1',
      phone: null,
      action: 'appointment',
      count: 3,
      windowStart: new Date(),
    })

    const result = await checkRateLimit(baseParams)

    expect(prismaMock.publicRateLimit.update).not.toHaveBeenCalled()
    expect(result).toEqual({ allowed: false, remaining: 0 })
  })

  it('funciona com identificação por telefone (sem IP)', async () => {
    prismaMock.publicRateLimit.findFirst.mockResolvedValueOnce(null)
    prismaMock.publicRateLimit.create.mockResolvedValueOnce({
      id: 'rl-2',
      ip: null,
      phone: '+5511999999999',
      action: 'appointment',
      count: 1,
      windowStart: new Date(),
    })

    const result = await checkRateLimit({
      phone: '+5511999999999',
      action: 'appointment',
      maxPerWindow: 5,
    })

    expect(prismaMock.publicRateLimit.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ phone: '+5511999999999', ip: undefined }),
      }),
    )
    expect(result).toEqual({ allowed: true, remaining: 4 })
  })

  it('respeita janela de 15 minutos quando windowMs=900000', async () => {
    prismaMock.publicRateLimit.findFirst.mockResolvedValue(null)
    prismaMock.publicRateLimit.create.mockResolvedValue({
      id: 'r1', ip: '1.1.1.1', phone: null, action: 'appointment', count: 1, windowStart: new Date(),
    })

    const result = await checkRateLimit({
      ip: '1.1.1.1',
      action: 'appointment',
      maxPerWindow: 5,
      windowMs: 15 * 60 * 1000,
    })

    expect(result.allowed).toBe(true)
    const createCall = prismaMock.publicRateLimit.create.mock.calls[0]![0]
    expect(createCall.data.action).toBe('appointment')
  })
})
