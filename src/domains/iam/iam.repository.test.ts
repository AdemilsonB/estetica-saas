import { describe, it, expect, beforeEach } from 'vitest'
import { prismaMock } from '@/shared/test/prisma-mock'
import { IamRepository } from './iam.repository'

const TENANT_ID = 'tenant-abc'
const INVITE_ID = 'invite-xyz'

describe('IamRepository.deleteInvite', () => {
  let repo: IamRepository

  beforeEach(() => {
    repo = new IamRepository()
  })

  it('deleta convite PENDING filtrando tenantId e id', async () => {
    prismaMock.tenantInvite.deleteMany.mockResolvedValue({ count: 1 })

    const result = await repo.deleteInvite(TENANT_ID, INVITE_ID)

    expect(prismaMock.tenantInvite.deleteMany).toHaveBeenCalledWith({
      where: { id: INVITE_ID, tenantId: TENANT_ID, status: 'PENDING' },
    })
    expect(result.count).toBe(1)
  })

  it('retorna count 0 quando convite não existe ou já foi aceito', async () => {
    prismaMock.tenantInvite.deleteMany.mockResolvedValue({ count: 0 })

    const result = await repo.deleteInvite(TENANT_ID, 'inexistente')

    expect(result.count).toBe(0)
  })
})
