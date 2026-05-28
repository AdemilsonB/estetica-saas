import { describe, it, expect, beforeEach } from 'vitest'
import { prismaMock } from '../../shared/test/prisma-mock'
import { BrandingRepository } from './branding.repository'

const TENANT_ID = 'tenant-abc'

const defaultBranding = {
  id: 'branding-1',
  tenantId: TENANT_ID,
  logoUrl: null,
  primaryColor: '#191919',
  secondaryColor: '#6366f1',
  accentColor: '#f59e0b',
  backgroundColor: '#f8f8f7',
  fontFamily: 'inter',
  borderRadius: 'medium',
  colorScheme: 'light',
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
}

describe('BrandingRepository', () => {
  let repo: BrandingRepository

  beforeEach(() => {
    repo = new BrandingRepository()
  })

  describe('findByTenant', () => {
    it('retorna BrandingConfig do tenant', async () => {
      prismaMock.brandingConfig.findUnique.mockResolvedValue(defaultBranding)
      const result = await repo.findByTenant(TENANT_ID)
      expect(result).toEqual(defaultBranding)
      expect(prismaMock.brandingConfig.findUnique).toHaveBeenCalledWith({
        where: { tenantId: TENANT_ID },
      })
    })

    it('retorna null se não encontrado', async () => {
      prismaMock.brandingConfig.findUnique.mockResolvedValue(null)
      const result = await repo.findByTenant(TENANT_ID)
      expect(result).toBeNull()
    })
  })

  describe('create', () => {
    it('cria BrandingConfig com tenantId e defaults', async () => {
      prismaMock.brandingConfig.create.mockResolvedValue(defaultBranding)
      await repo.create(TENANT_ID)
      expect(prismaMock.brandingConfig.create).toHaveBeenCalledWith({
        data: { tenantId: TENANT_ID },
      })
    })

    it('cria BrandingConfig com valores customizados', async () => {
      const custom = { ...defaultBranding, primaryColor: '#ff0000' }
      prismaMock.brandingConfig.create.mockResolvedValue(custom)
      await repo.create(TENANT_ID, { primaryColor: '#ff0000' })
      expect(prismaMock.brandingConfig.create).toHaveBeenCalledWith({
        data: { tenantId: TENANT_ID, primaryColor: '#ff0000' },
      })
    })
  })

  describe('update', () => {
    it('atualiza campos parciais do BrandingConfig', async () => {
      const updated = { ...defaultBranding, primaryColor: '#0000ff' }
      prismaMock.brandingConfig.update.mockResolvedValue(updated)
      const result = await repo.update(TENANT_ID, { primaryColor: '#0000ff' })
      expect(result).toEqual(updated)
      expect(prismaMock.brandingConfig.update).toHaveBeenCalledWith({
        where: { tenantId: TENANT_ID },
        data: { primaryColor: '#0000ff' },
      })
    })
  })
})
