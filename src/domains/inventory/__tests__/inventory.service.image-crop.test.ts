import { describe, it, expect, vi, beforeEach } from 'vitest'
import { InventoryService } from '../inventory.service'
import { ProductNotFoundError } from '@/shared/errors'
import { makeProduct } from '@/shared/test/factories/product.factory'

vi.mock('../product.repository', () => ({
  productRepository: {
    findById: vi.fn(),
    update: vi.fn(),
  },
}))

vi.mock('@/shared/events/event-bus', () => ({
  eventBus: { publish: vi.fn(), subscribe: vi.fn() },
}))

import { productRepository } from '../product.repository'

const service = new InventoryService()

beforeEach(() => vi.clearAllMocks())

describe('InventoryService.updateProduct — enquadramento de imagem (crop)', () => {
  beforeEach(() => {
    vi.mocked(productRepository.findById).mockResolvedValue(makeProduct())
  })

  it('lança ProductNotFoundError quando o produto não existe', async () => {
    vi.mocked(productRepository.findById).mockResolvedValue(null)
    await expect(
      service.updateProduct('tenant-1', 'prod-999', { imageCropX: 0.5, imageCropY: 0.5, imageCropZoom: 1 }),
    ).rejects.toThrow(ProductNotFoundError)
  })

  it('salva crop válido quando enviado sem nova imagem', async () => {
    await service.updateProduct('tenant-1', 'prod-1', { imageCropX: 0.2, imageCropY: 0.8, imageCropZoom: 1.5 })

    expect(productRepository.update).toHaveBeenCalledWith(
      'tenant-1',
      'prod-1',
      expect.objectContaining({ imageCropX: 0.2, imageCropY: 0.8, imageCropZoom: 1.5 }),
    )
  })

  it('reseta o crop para null quando uma nova imagem é enviada sem crop junto', async () => {
    await service.updateProduct('tenant-1', 'prod-1', { imageUrl: 'https://cdn.test/novo.jpg' })

    expect(productRepository.update).toHaveBeenCalledWith(
      'tenant-1',
      'prod-1',
      expect.objectContaining({
        imageUrl: 'https://cdn.test/novo.jpg',
        imageCropX: null,
        imageCropY: null,
        imageCropZoom: null,
      }),
    )
  })

  it('preserva o crop quando enviado junto com a nova imagem na mesma chamada', async () => {
    await service.updateProduct('tenant-1', 'prod-1', {
      imageUrl: 'https://cdn.test/novo.jpg',
      imageCropX: 0.4,
      imageCropY: 0.6,
      imageCropZoom: 2.5,
    })

    expect(productRepository.update).toHaveBeenCalledWith(
      'tenant-1',
      'prod-1',
      expect.objectContaining({ imageCropX: 0.4, imageCropY: 0.6, imageCropZoom: 2.5 }),
    )
  })
})
