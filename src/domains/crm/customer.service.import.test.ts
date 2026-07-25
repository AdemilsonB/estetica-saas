import { describe, it, expect, vi, beforeEach } from 'vitest'
import { prismaMock } from '@/shared/test/prisma-mock'
import { makeCustomer } from '@/shared/test/factories/customer.factory'
import { eventBus } from '@/shared/events/event-bus'
import { CustomerService } from './customer.service'

vi.mock('@/domains/billing/feature-guard', () => ({
  featureGuard: { assertWithinLimit: vi.fn() },
}))

import { featureGuard } from '@/domains/billing/feature-guard'

const TENANT_ID = 'tenant-1'
const ORIGIN = 'whatsapp_import'

describe('CustomerService.importCustomers', () => {
  let service: CustomerService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new CustomerService()
    prismaMock.customer.findMany.mockResolvedValue([])
    prismaMock.customer.count.mockResolvedValue(0)
    vi.mocked(featureGuard.assertWithinLimit).mockResolvedValue(undefined)
    prismaMock.customer.create.mockImplementation(
      (({ data }: { data: { name: string; phone: string } }) =>
        Promise.resolve(
          makeCustomer({ tenantId: TENANT_ID, name: data.name, phone: data.phone }),
        )) as never,
    )
  })

  it('cria cliente completo com consentimento não assumido e origem marcada', async () => {
    const result = await service.importCustomers(
      TENANT_ID,
      [
        {
          name: 'Maria Silva',
          phone: '+55 11 98765-4321',
          email: 'maria@exemplo.com',
          birthDate: '1990-03-15',
          notes: 'Prefere manhã',
          tags: ['whatsapp', 'vip-em-potencial'],
          isVip: true,
        },
      ],
      ORIGIN,
    )

    expect(result).toEqual({ created: 1, skipped: 0, errors: [] })
    expect(prismaMock.customer.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: TENANT_ID,
        name: 'Maria Silva',
        phone: '11987654321',
        email: 'maria@exemplo.com',
        birthDate: new Date('1990-03-15'),
        notes: 'Prefere manhã',
        tags: ['whatsapp', 'vip-em-potencial'],
        isVip: true,
        consentGiven: false,
        consentOrigin: ORIGIN,
      }),
    })
  })

  it('publica crm.customer.created para cada cliente criado', async () => {
    await service.importCustomers(
      TENANT_ID,
      [
        { name: 'A', phone: '11911111111', tags: [] },
        { name: 'B', phone: '11922222222', tags: [] },
      ],
      ORIGIN,
    )

    expect(eventBus.publish).toHaveBeenCalledTimes(2)
    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'crm.customer.created' }),
    )
  })

  it('pula cliente já existente gravado COM DDI 55 (variantes no dedup)', async () => {
    prismaMock.customer.findMany.mockResolvedValue([
      makeCustomer({ tenantId: TENANT_ID, phone: '5511987654321' }),
    ])

    const result = await service.importCustomers(
      TENANT_ID,
      [{ name: 'Maria', phone: '11987654321', tags: [] }],
      ORIGIN,
    )

    expect(result).toEqual({ created: 0, skipped: 1, errors: [] })
    expect(prismaMock.customer.create).not.toHaveBeenCalled()
    // a busca no banco deve incluir a variante com DDI
    expect(prismaMock.customer.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: TENANT_ID,
          phone: { in: expect.arrayContaining(['11987654321', '5511987654321']) },
        }),
      }),
    )
  })

  it('deduplica telefones repetidos dentro do próprio lote', async () => {
    const result = await service.importCustomers(
      TENANT_ID,
      [
        { name: 'Maria', phone: '11987654321', tags: [] },
        { name: 'Maria (dup)', phone: '+55 (11) 98765-4321', tags: [] },
      ],
      ORIGIN,
    )

    expect(result).toEqual({ created: 1, skipped: 1, errors: [] })
    expect(prismaMock.customer.create).toHaveBeenCalledTimes(1)
  })

  it('assevera o limite do plano considerando o lote inteiro e não cria nada se estourar', async () => {
    prismaMock.customer.count.mockResolvedValue(48)
    vi.mocked(featureGuard.assertWithinLimit).mockRejectedValue(new Error('Limite atingido'))

    await expect(
      service.importCustomers(
        TENANT_ID,
        [
          { name: 'A', phone: '11911111111', tags: [] },
          { name: 'B', phone: '11922222222', tags: [] },
          { name: 'C', phone: '11933333333', tags: [] },
        ],
        ORIGIN,
      ),
    ).rejects.toThrow('Limite atingido')

    // 48 existentes + 3 novos → última criação seria a de índice 48+3-1 = 50
    expect(featureGuard.assertWithinLimit).toHaveBeenCalledWith(TENANT_ID, 'customers', 50)
    expect(prismaMock.customer.create).not.toHaveBeenCalled()
  })

  it('erro pontual não derruba o lote — entra em errors e o resto é criado', async () => {
    prismaMock.customer.create
      .mockImplementationOnce(() => Promise.reject(new Error('boom')) as never)
      .mockImplementation(
        (({ data }: { data: { name: string } }) =>
          Promise.resolve(makeCustomer({ tenantId: TENANT_ID, name: data.name }))) as never,
      )

    const result = await service.importCustomers(
      TENANT_ID,
      [
        { name: 'Falha', phone: '11911111111', tags: [] },
        { name: 'Sucesso', phone: '11922222222', tags: [] },
      ],
      ORIGIN,
    )

    expect(result.created).toBe(1)
    expect(result.errors).toEqual(['11911111111'])
    expect(eventBus.publish).toHaveBeenCalledTimes(1)
  })

  it('campos opcionais ausentes não viram undefined explícito perigoso no create', async () => {
    await service.importCustomers(
      TENANT_ID,
      [{ name: 'Só Nome', phone: '11911111111', tags: [] }],
      ORIGIN,
    )

    const call = prismaMock.customer.create.mock.calls[0]?.[0] as {
      data: Record<string, unknown>
    }
    expect(call.data.birthDate).toBeUndefined()
    expect(call.data.isVip).toBe(false)
  })
})
