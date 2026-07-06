import { describe, it, expect, vi, beforeEach } from 'vitest'
import { prismaMock } from '@/shared/test/prisma-mock'
import { logCapabilityInterest } from './capability-interest.service'

describe('logCapabilityInterest', () => {
  beforeEach(() => vi.clearAllMocks())

  it('grava o interesse para uma capability válida', async () => {
    await logCapabilityInterest('tenant-1', 'reports_advanced')
    expect(prismaMock.capabilityInterestLog.create).toHaveBeenCalledWith({
      data: { tenantId: 'tenant-1', capabilityKey: 'reports_advanced' },
    })
  })

  it('ignora chave inexistente no registry (não grava)', async () => {
    await logCapabilityInterest('tenant-1', 'chave_invalida')
    expect(prismaMock.capabilityInterestLog.create).not.toHaveBeenCalled()
  })
})
