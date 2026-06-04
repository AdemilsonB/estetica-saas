import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NotFoundError } from '@/shared/errors'

vi.mock('./iam.repository', () => ({
  iamRepository: {
    deleteInvite: vi.fn(),
  },
}))

vi.mock('@/integrations/supabase/admin', () => ({
  supabaseAdmin: { auth: { admin: {} } },
}))

vi.mock('@/domains/billing/billing.service', () => ({
  billingService: {},
}))

vi.mock('@/domains/billing/feature-guard', () => ({
  featureGuard: {},
}))

vi.mock('@/shared/database/prisma', () => ({
  prisma: {},
}))

import { iamRepository } from './iam.repository'
import { IamService } from './iam.service'

const TENANT_ID = 'tenant-abc'
const INVITE_ID = 'invite-xyz'

describe('IamService.cancelInvite', () => {
  let service: IamService

  beforeEach(() => {
    service = new IamService()
    vi.clearAllMocks()
  })

  it('cancela convite quando encontrado', async () => {
    vi.mocked(iamRepository.deleteInvite).mockResolvedValue({ count: 1 })

    await expect(service.cancelInvite(TENANT_ID, INVITE_ID)).resolves.toBeUndefined()
    expect(iamRepository.deleteInvite).toHaveBeenCalledWith(TENANT_ID, INVITE_ID)
  })

  it('lança NotFoundError quando convite não existe ou já foi aceito', async () => {
    vi.mocked(iamRepository.deleteInvite).mockResolvedValue({ count: 0 })

    await expect(service.cancelInvite(TENANT_ID, INVITE_ID)).rejects.toThrow(NotFoundError)
  })
})
