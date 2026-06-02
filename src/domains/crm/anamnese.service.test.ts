import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AnamneseService } from './anamnese.service'
import type { AnamneseTemplateRepository } from './anamnese-template.repository'
import type { CustomerAnamneseRepository } from './customer-anamnese.repository'
import type { CustomerRepository } from './customer.repository'

const TENANT_ID = 'tenant-1'
const CUSTOMER_ID = 'cust-1'
const PUBLIC_TOKEN = 'tok-abc'
const APP_URL = 'https://app.example.com'

function makeMocks() {
  const templateRepo = {
    findOrCreate: vi.fn(),
    update: vi.fn(),
  } as unknown as AnamneseTemplateRepository

  const anamneseRepo = {
    findByCustomer: vi.fn(),
    findByPublicToken: vi.fn(),
    save: vi.fn(),
  } as unknown as CustomerAnamneseRepository

  const customerRepo = {
    findById: vi.fn(),
  } as unknown as CustomerRepository

  const notifyFn = vi.fn()

  return { templateRepo, anamneseRepo, customerRepo, notifyFn }
}

describe('AnamneseService', () => {
  beforeEach(() => vi.clearAllMocks())

  it('getTemplate: chama findOrCreate com tenantId', async () => {
    const { templateRepo, anamneseRepo, customerRepo, notifyFn } = makeMocks()
    const tmpl = { id: 't1', tenantId: TENANT_ID, fields: [], linkMessage: null, updatedAt: new Date() }
    vi.mocked(templateRepo.findOrCreate).mockResolvedValue(tmpl as never)

    const svc = new AnamneseService(templateRepo, anamneseRepo, customerRepo, notifyFn, APP_URL)
    const result = await svc.getTemplate(TENANT_ID)

    expect(templateRepo.findOrCreate).toHaveBeenCalledWith(TENANT_ID)
    expect(result).toEqual(tmpl)
  })

  it('saveAnamnese: delega ao repo com filledBy = professional', async () => {
    const { templateRepo, anamneseRepo, customerRepo, notifyFn } = makeMocks()
    vi.mocked(anamneseRepo.save).mockResolvedValue({ id: 'a1' } as never)

    const svc = new AnamneseService(templateRepo, anamneseRepo, customerRepo, notifyFn, APP_URL)
    await svc.saveAnamnese(TENANT_ID, CUSTOMER_ID, { age: '30' })

    expect(anamneseRepo.save).toHaveBeenCalledWith(TENANT_ID, CUSTOMER_ID, { age: '30' }, 'professional')
  })

  it('sendLink: substitui {nome} e {link} e chama notifyFn com payload.message', async () => {
    const { templateRepo, anamneseRepo, customerRepo, notifyFn } = makeMocks()

    vi.mocked(customerRepo.findById).mockResolvedValue({
      id: CUSTOMER_ID, name: 'Ana', phone: '+5511999999999',
    } as never)
    vi.mocked(anamneseRepo.findByCustomer).mockResolvedValue({
      publicToken: PUBLIC_TOKEN,
    } as never)

    const svc = new AnamneseService(templateRepo, anamneseRepo, customerRepo, notifyFn, APP_URL)
    await svc.sendLink(TENANT_ID, CUSTOMER_ID, 'Olá, {nome}! Preencha: {link}')

    expect(notifyFn).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          message: expect.stringContaining('Ana'),
        }),
      }),
    )
    expect(notifyFn).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          message: expect.stringContaining(PUBLIC_TOKEN),
        }),
      }),
    )
  })

  it('sendLink: lança CustomerNotFoundError quando cliente não existe', async () => {
    const { templateRepo, anamneseRepo, customerRepo, notifyFn } = makeMocks()
    vi.mocked(customerRepo.findById).mockResolvedValue(null)

    const svc = new AnamneseService(templateRepo, anamneseRepo, customerRepo, notifyFn, APP_URL)
    await expect(svc.sendLink(TENANT_ID, CUSTOMER_ID, 'msg msg msg msg')).rejects.toThrow('Cliente nao encontrado.')
  })

  it('submitPublic: encontra pelo token e salva com filledBy = client', async () => {
    const { templateRepo, anamneseRepo, customerRepo, notifyFn } = makeMocks()
    vi.mocked(anamneseRepo.findByPublicToken).mockResolvedValue({
      tenantId: TENANT_ID,
      customerId: CUSTOMER_ID,
      publicToken: PUBLIC_TOKEN,
      customer: { name: 'Ana', tenantId: TENANT_ID },
    } as never)
    vi.mocked(anamneseRepo.save).mockResolvedValue({ id: 'a1' } as never)

    const svc = new AnamneseService(templateRepo, anamneseRepo, customerRepo, notifyFn, APP_URL)
    await svc.submitPublic(PUBLIC_TOKEN, { age: '25' })

    expect(anamneseRepo.save).toHaveBeenCalledWith(TENANT_ID, CUSTOMER_ID, { age: '25' }, 'client')
  })
})
