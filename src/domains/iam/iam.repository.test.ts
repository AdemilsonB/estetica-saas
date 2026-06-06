import { describe, it, expect, beforeEach, vi } from 'vitest'
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

const USER_ID = 'user-123'
const SERVICE_ID = 'service-456'

describe('IamRepository.updateUser', () => {
  let repo: IamRepository
  beforeEach(() => { repo = new IamRepository() })

  it('chama updateMany com tenantId e userId e retorna usuário atualizado', async () => {
    prismaMock.user.updateMany.mockResolvedValue({ count: 1 })
    prismaMock.user.findFirst.mockResolvedValue({
      id: USER_ID, name: 'Novo Nome', email: 'novo@email.com',
      role: 'PROFESSIONAL', avatarUrl: null, roleId: null,
      customRole: null, createdAt: new Date(),
    } as any)

    const result = await repo.updateUser(TENANT_ID, USER_ID, { name: 'Novo Nome' })

    expect(prismaMock.user.updateMany).toHaveBeenCalledWith({
      where: { id: USER_ID, tenantId: TENANT_ID },
      data: { name: 'Novo Nome' },
    })
    expect(result?.name).toBe('Novo Nome')
  })
})

describe('IamRepository.findUserServices', () => {
  let repo: IamRepository
  beforeEach(() => { repo = new IamRepository() })

  it('retorna lista de serviços vinculados ao profissional', async () => {
    prismaMock.professionalService.findMany.mockResolvedValue([
      { id: 'ps-1', tenantId: TENANT_ID, userId: USER_ID, serviceId: SERVICE_ID,
        createdAt: new Date(), service: { id: SERVICE_ID, name: 'Corte' } },
    ] as any)

    const result = await repo.findUserServices(TENANT_ID, USER_ID)

    expect(prismaMock.professionalService.findMany).toHaveBeenCalledWith({
      where: { tenantId: TENANT_ID, userId: USER_ID },
      include: { service: { select: { id: true, name: true } } },
    })
    expect(result).toHaveLength(1)
  })
})

describe('IamRepository.setUserServices', () => {
  let repo: IamRepository
  beforeEach(() => { repo = new IamRepository() })

  it('deleta todos os vínculos atuais e cria os novos dentro de uma transaction', async () => {
    const mockTx = {
      professionalService: {
        deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
        createMany: vi.fn().mockResolvedValue({ count: 2 }),
        findMany: vi.fn().mockResolvedValue([
          { id: 'ps-1', service: { id: 'svc-1', name: 'Corte' } },
          { id: 'ps-2', service: { id: 'svc-2', name: 'Barba' } },
        ]),
      },
    }
    prismaMock.$transaction.mockImplementation((fn: any) => fn(mockTx))

    const result = await repo.setUserServices(TENANT_ID, USER_ID, ['svc-1', 'svc-2'])

    expect(mockTx.professionalService.deleteMany).toHaveBeenCalledWith({
      where: { tenantId: TENANT_ID, userId: USER_ID },
    })
    expect(mockTx.professionalService.createMany).toHaveBeenCalledWith({
      data: [
        { tenantId: TENANT_ID, userId: USER_ID, serviceId: 'svc-1' },
        { tenantId: TENANT_ID, userId: USER_ID, serviceId: 'svc-2' },
      ],
      skipDuplicates: true,
    })
    expect(result).toHaveLength(2)
  })

  it('quando serviceIds é vazio, apenas deleta os vínculos', async () => {
    const mockTx = {
      professionalService: {
        deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
        createMany: vi.fn(),
        findMany: vi.fn().mockResolvedValue([]),
      },
    }
    prismaMock.$transaction.mockImplementation((fn: any) => fn(mockTx))

    const result = await repo.setUserServices(TENANT_ID, USER_ID, [])

    expect(mockTx.professionalService.createMany).not.toHaveBeenCalled()
    expect(result).toHaveLength(0)
  })
})

describe('IamRepository.findProfessionalsByService', () => {
  let repo: IamRepository
  beforeEach(() => { repo = new IamRepository() })

  it('retorna profissionais vinculados ao serviço', async () => {
    prismaMock.user.findMany.mockResolvedValue([
      { id: USER_ID, name: 'João', email: 'joao@test.com', role: 'PROFESSIONAL',
        avatarUrl: null, roleId: null, customRole: null, createdAt: new Date() },
    ] as any)

    const result = await repo.findProfessionalsByService(TENANT_ID, SERVICE_ID)

    expect(prismaMock.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: TENANT_ID,
          professionalServices: { some: { tenantId: TENANT_ID, serviceId: SERVICE_ID } },
        }),
      })
    )
    expect(result).toHaveLength(1)
  })

  it('retorna array vazio quando nenhum profissional está vinculado', async () => {
    prismaMock.user.findMany.mockResolvedValue([])
    const result = await repo.findProfessionalsByService(TENANT_ID, SERVICE_ID)
    expect(result).toHaveLength(0)
  })
})
