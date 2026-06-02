import { describe, it, expect, vi, beforeEach } from 'vitest'
import { prismaMock } from '@/shared/test/prisma-mock'
import { AnamneseTemplateRepository } from './anamnese-template.repository'
import { DEFAULT_ANAMNESE_FIELDS, DEFAULT_LINK_MESSAGE } from './types'

const TENANT_ID = 'tenant-1'

beforeEach(() => vi.clearAllMocks())

describe('AnamneseTemplateRepository', () => {
  it('findOrCreate: retorna template existente sem chamar create', async () => {
    const existing = {
      id: 'tmpl-1',
      tenantId: TENANT_ID,
      fields: DEFAULT_ANAMNESE_FIELDS,
      linkMessage: DEFAULT_LINK_MESSAGE,
      updatedAt: new Date(),
    }
    prismaMock.anamneseTemplate.findUnique.mockResolvedValue(existing as never)

    const repo = new AnamneseTemplateRepository()
    const result = await repo.findOrCreate(TENANT_ID)

    expect(result).toEqual(existing)
    expect(prismaMock.anamneseTemplate.create).not.toHaveBeenCalled()
  })

  it('findOrCreate: cria template com campos padrão quando não existe', async () => {
    prismaMock.anamneseTemplate.findUnique.mockResolvedValue(null)
    const created = {
      id: 'tmpl-2',
      tenantId: TENANT_ID,
      fields: DEFAULT_ANAMNESE_FIELDS,
      linkMessage: DEFAULT_LINK_MESSAGE,
      updatedAt: new Date(),
    }
    prismaMock.anamneseTemplate.create.mockResolvedValue(created as never)

    const repo = new AnamneseTemplateRepository()
    const result = await repo.findOrCreate(TENANT_ID)

    expect(prismaMock.anamneseTemplate.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: TENANT_ID,
        linkMessage: DEFAULT_LINK_MESSAGE,
      }),
    })
    expect(result.tenantId).toBe(TENANT_ID)
  })

  it('update: chama upsert com tenantId correto', async () => {
    const updated = {
      id: 'tmpl-1',
      tenantId: TENANT_ID,
      fields: [],
      linkMessage: null,
      updatedAt: new Date(),
    }
    prismaMock.anamneseTemplate.upsert.mockResolvedValue(updated as never)

    const repo = new AnamneseTemplateRepository()
    await repo.update(TENANT_ID, { fields: [], linkMessage: 'msg' })

    expect(prismaMock.anamneseTemplate.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: TENANT_ID },
      }),
    )
  })
})
