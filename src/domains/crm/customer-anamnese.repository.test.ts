import { describe, it, expect, vi, beforeEach } from 'vitest'
import { prismaMock } from '@/shared/test/prisma-mock'
import { CustomerAnamneseRepository } from './customer-anamnese.repository'

const TENANT_ID = 'tenant-1'
const CUSTOMER_ID = 'cust-1'
const PUBLIC_TOKEN = 'token-abc'

beforeEach(() => vi.clearAllMocks())

const makeAnamnese = (overrides = {}) => ({
  id: 'ana-1',
  tenantId: TENANT_ID,
  customerId: CUSTOMER_ID,
  data: {},
  publicToken: PUBLIC_TOKEN,
  filledAt: null,
  filledBy: null,
  history: [],
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
})

describe('CustomerAnamneseRepository', () => {
  it('findByCustomer: busca por customerId e tenantId', async () => {
    prismaMock.customerAnamnese.findFirst.mockResolvedValue(makeAnamnese() as never)
    const repo = new CustomerAnamneseRepository()
    await repo.findByCustomer(TENANT_ID, CUSTOMER_ID)
    expect(prismaMock.customerAnamnese.findFirst).toHaveBeenCalledWith({
      where: { customerId: CUSTOMER_ID, tenantId: TENANT_ID },
    })
  })

  it('findByPublicToken: busca pelo token com include do customer', async () => {
    prismaMock.customerAnamnese.findFirst.mockResolvedValue(makeAnamnese() as never)
    const repo = new CustomerAnamneseRepository()
    await repo.findByPublicToken(PUBLIC_TOKEN)
    expect(prismaMock.customerAnamnese.findFirst).toHaveBeenCalledWith({
      where: { publicToken: PUBLIC_TOKEN },
      include: { customer: { select: { name: true, tenantId: true } } },
    })
  })

  it('save: armazena snapshot no histórico antes de salvar', async () => {
    const existing = makeAnamnese({ data: { age: '30' }, history: [] })
    prismaMock.customerAnamnese.findFirst.mockResolvedValue(existing as never)
    prismaMock.customerAnamnese.upsert.mockResolvedValue(makeAnamnese() as never)

    const repo = new CustomerAnamneseRepository()
    await repo.save(TENANT_ID, CUSTOMER_ID, { age: '31' }, 'professional')

    const upsertCall = prismaMock.customerAnamnese.upsert.mock.calls[0][0]
    const history = upsertCall.update.history as { savedBy: string }[]
    expect(history.length).toBe(1)
    expect(history[0].savedBy).toBe('professional')
  })

  it('save: descarta snapshots mais antigos quando history tem 10 itens', async () => {
    const history = Array.from({ length: 10 }, (_, i) => ({
      data: { age: String(i) },
      savedAt: new Date().toISOString(),
      savedBy: 'professional',
    }))
    const existing = makeAnamnese({ data: { age: '10' }, history })
    prismaMock.customerAnamnese.findFirst.mockResolvedValue(existing as never)
    prismaMock.customerAnamnese.upsert.mockResolvedValue(makeAnamnese() as never)

    const repo = new CustomerAnamneseRepository()
    await repo.save(TENANT_ID, CUSTOMER_ID, { age: '11' }, 'professional')

    const upsertCall = prismaMock.customerAnamnese.upsert.mock.calls[0][0]
    expect((upsertCall.update.history as unknown[]).length).toBe(10)
  })
})
