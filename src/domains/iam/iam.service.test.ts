import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NotFoundError, ForbiddenError, UserNotFoundError } from '@/shared/errors'

vi.mock('./iam.repository', () => ({
  iamRepository: {
    deleteInvite: vi.fn(),
    findUserById: vi.fn(),
    updateUser: vi.fn(),
    findUserServices: vi.fn(),
    setUserServices: vi.fn(),
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
  prisma: {
    user: {
      findFirst: vi.fn(),
    },
    serviceCommission: {
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
  },
}))

import { iamRepository } from './iam.repository'
import { IamService } from './iam.service'
import { prisma } from '@/shared/database/prisma'

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

describe('IamService.updateMember', () => {
  let service: IamService

  beforeEach(() => {
    service = new IamService()
    vi.clearAllMocks()
  })

  it('OWNER pode editar qualquer membro', async () => {
    vi.mocked(iamRepository.findUserById)
      .mockResolvedValueOnce({ id: 'req-1', role: 'OWNER', tenantId: 'tenant-1' } as any)
      .mockResolvedValueOnce({ id: 'tgt-1', role: 'PROFESSIONAL', email: 'old@test.com', tenantId: 'tenant-1' } as any)
    vi.mocked(iamRepository.updateUser).mockResolvedValue({ id: 'tgt-1', name: 'Novo' } as any)

    await service.updateMember('tenant-1', 'req-1', 'tgt-1', { name: 'Novo' })

    expect(iamRepository.updateUser).toHaveBeenCalledWith('tenant-1', 'tgt-1', { name: 'Novo' })
  })

  it('OWNER pode editar a si mesmo', async () => {
    const requester = { id: 'req-1', role: 'OWNER', tenantId: 'tenant-1' }
    vi.mocked(iamRepository.findUserById)
      .mockResolvedValueOnce(requester as any)
      .mockResolvedValueOnce(requester as any)
    vi.mocked(iamRepository.updateUser).mockResolvedValue(requester as any)

    await expect(service.updateMember('tenant-1', 'req-1', 'req-1', { name: 'Novo' })).resolves.not.toThrow()
  })

  it('MANAGER não pode editar OWNER', async () => {
    vi.mocked(iamRepository.findUserById)
      .mockResolvedValueOnce({ id: 'req-1', role: 'MANAGER', tenantId: 'tenant-1' } as any)
      .mockResolvedValueOnce({ id: 'tgt-1', role: 'OWNER', tenantId: 'tenant-1' } as any)

    await expect(service.updateMember('tenant-1', 'req-1', 'tgt-1', { name: 'Novo' })).rejects.toThrow(ForbiddenError)
  })

  it('MANAGER não pode editar outro MANAGER', async () => {
    vi.mocked(iamRepository.findUserById)
      .mockResolvedValueOnce({ id: 'req-1', role: 'MANAGER', tenantId: 'tenant-1' } as any)
      .mockResolvedValueOnce({ id: 'tgt-1', role: 'MANAGER', tenantId: 'tenant-1' } as any)

    await expect(service.updateMember('tenant-1', 'req-1', 'tgt-1', { name: 'Novo' })).rejects.toThrow(ForbiddenError)
  })

  it('MANAGER pode editar PROFESSIONAL', async () => {
    vi.mocked(iamRepository.findUserById)
      .mockResolvedValueOnce({ id: 'req-1', role: 'MANAGER', tenantId: 'tenant-1' } as any)
      .mockResolvedValueOnce({ id: 'tgt-1', role: 'PROFESSIONAL', email: 'old@test.com', tenantId: 'tenant-1' } as any)
    vi.mocked(iamRepository.updateUser).mockResolvedValue({ id: 'tgt-1' } as any)

    await expect(service.updateMember('tenant-1', 'req-1', 'tgt-1', { name: 'Novo' })).resolves.not.toThrow()
  })

  it('lança UserNotFoundError quando target não existe', async () => {
    vi.mocked(iamRepository.findUserById)
      .mockResolvedValueOnce({ id: 'req-1', role: 'OWNER', tenantId: 'tenant-1' } as any)
      .mockResolvedValueOnce(null)

    await expect(service.updateMember('tenant-1', 'req-1', 'tgt-1', { name: 'Novo' })).rejects.toThrow(UserNotFoundError)
  })

  it('salva crop válido do avatar quando enviado sem nova foto', async () => {
    vi.mocked(iamRepository.findUserById)
      .mockResolvedValueOnce({ id: 'req-1', role: 'OWNER', tenantId: 'tenant-1' } as any)
      .mockResolvedValueOnce({ id: 'tgt-1', role: 'PROFESSIONAL', tenantId: 'tenant-1' } as any)
    vi.mocked(iamRepository.updateUser).mockResolvedValue({ id: 'tgt-1' } as any)

    await service.updateMember('tenant-1', 'req-1', 'tgt-1', {
      avatarCropX: 0.5,
      avatarCropY: 0.5,
      avatarCropZoom: 2,
    })

    expect(iamRepository.updateUser).toHaveBeenCalledWith(
      'tenant-1',
      'tgt-1',
      expect.objectContaining({ avatarCropX: 0.5, avatarCropY: 0.5, avatarCropZoom: 2 }),
    )
  })

  it('reseta o crop do avatar para null quando uma nova foto é enviada sem crop junto', async () => {
    vi.mocked(iamRepository.findUserById)
      .mockResolvedValueOnce({ id: 'req-1', role: 'OWNER', tenantId: 'tenant-1' } as any)
      .mockResolvedValueOnce({ id: 'tgt-1', role: 'PROFESSIONAL', tenantId: 'tenant-1' } as any)
    vi.mocked(iamRepository.updateUser).mockResolvedValue({ id: 'tgt-1' } as any)

    await service.updateMember('tenant-1', 'req-1', 'tgt-1', { avatarUrl: 'https://cdn.test/novo.jpg' })

    expect(iamRepository.updateUser).toHaveBeenCalledWith(
      'tenant-1',
      'tgt-1',
      expect.objectContaining({
        avatarUrl: 'https://cdn.test/novo.jpg',
        avatarCropX: null,
        avatarCropY: null,
        avatarCropZoom: null,
      }),
    )
  })

  it('preserva o crop do avatar quando enviado junto com a nova foto', async () => {
    vi.mocked(iamRepository.findUserById)
      .mockResolvedValueOnce({ id: 'req-1', role: 'OWNER', tenantId: 'tenant-1' } as any)
      .mockResolvedValueOnce({ id: 'tgt-1', role: 'PROFESSIONAL', tenantId: 'tenant-1' } as any)
    vi.mocked(iamRepository.updateUser).mockResolvedValue({ id: 'tgt-1' } as any)

    await service.updateMember('tenant-1', 'req-1', 'tgt-1', {
      avatarUrl: 'https://cdn.test/novo.jpg',
      avatarCropX: 0.3,
      avatarCropY: 0.7,
      avatarCropZoom: 1.4,
    })

    expect(iamRepository.updateUser).toHaveBeenCalledWith(
      'tenant-1',
      'tgt-1',
      expect.objectContaining({ avatarCropX: 0.3, avatarCropY: 0.7, avatarCropZoom: 1.4 }),
    )
  })
})

describe('IamService.setMemberServices', () => {
  let service: IamService

  beforeEach(() => {
    service = new IamService()
    vi.clearAllMocks()
  })

  it('substitui serviços e cria ServiceCommission para novos vínculos', async () => {
    vi.mocked(iamRepository.findUserById).mockResolvedValue({ id: 'owner-1', role: 'OWNER' } as any)
    vi.mocked(iamRepository.findUserServices).mockResolvedValue([
      { serviceId: 'svc-old', service: { id: 'svc-old', name: 'Antigo' } } as any,
    ])
    vi.mocked(iamRepository.setUserServices).mockResolvedValue([
      { service: { id: 'svc-new', name: 'Novo' } } as any,
    ])

    await service.setMemberServices('tenant-1', 'owner-1', 'user-1', ['svc-new'])

    expect(iamRepository.setUserServices).toHaveBeenCalledWith('tenant-1', 'user-1', ['svc-new'])
  })

  it('não cria ServiceCommission para serviços já existentes', async () => {
    vi.mocked(iamRepository.findUserById).mockResolvedValue({ id: 'owner-1', role: 'OWNER' } as any)
    vi.mocked(iamRepository.findUserServices).mockResolvedValue([
      { serviceId: 'svc-1', service: { id: 'svc-1', name: 'Corte' } } as any,
    ])
    vi.mocked(iamRepository.setUserServices).mockResolvedValue([
      { service: { id: 'svc-1', name: 'Corte' } } as any,
    ])

    const result = await service.setMemberServices('tenant-1', 'owner-1', 'user-1', ['svc-1'])

    expect(result).toBeDefined()
  })

  it('impede MANAGER de alterar serviços do OWNER', async () => {
    vi.mocked(iamRepository.findUserById)
      .mockResolvedValueOnce({ id: 'mgr-1', role: 'MANAGER' } as any) // requester
      .mockResolvedValueOnce({ id: 'owner-1', role: 'OWNER' } as any) // target

    await expect(
      service.setMemberServices('tenant-1', 'mgr-1', 'owner-1', ['svc-1']),
    ).rejects.toThrow()

    expect(iamRepository.setUserServices).not.toHaveBeenCalled()
  })
})
