import { describe, it, expect, vi, beforeEach } from 'vitest'
import { prisma } from '@/shared/database/prisma'
import { PUT } from './route'

vi.mock('@/shared/database/prisma', () => ({
  prisma: { planFeatureConfig: { upsert: vi.fn(), findMany: vi.fn().mockResolvedValue([]) } },
}))
vi.mock('@/shared/auth/admin-context', () => ({ getAdminContext: vi.fn().mockResolvedValue({ userId: 'admin' }) }))
vi.mock('@/shared/audit/admin-audit', () => ({ logAdminAction: vi.fn() }))
vi.mock('@/app/api/_lib/runtime', () => ({ initializeDomainRuntime: vi.fn() }))
vi.mock('@/shared/http/validate-input', () => ({
  validateInput: vi.fn(async (req: Request) => req.json()),
}))

describe('features route — essential enforcement', () => {
  beforeEach(() => vi.clearAllMocks())

  it('força enabled=true para capability essential mesmo recebendo false', async () => {
    const body = { features: [{ sectionKey: 'agenda', enabled: false }] }
    const req = new Request('http://x/api/admin/plans/STARTER/features', {
      method: 'PUT',
      body: JSON.stringify(body),
    })
    await PUT(req, { params: Promise.resolve({ planName: 'STARTER' }) })

    const call = vi.mocked(prisma.planFeatureConfig.upsert).mock.calls.find(
      ([arg]) => (arg as { create: { sectionKey: string } }).create.sectionKey === 'agenda',
    )
    expect(call).toBeTruthy()
    const arg = call![0] as { create: { enabled: boolean }; update: { enabled: boolean } }
    expect(arg.create.enabled).toBe(true)
    expect(arg.update.enabled).toBe(true)
  })
})
