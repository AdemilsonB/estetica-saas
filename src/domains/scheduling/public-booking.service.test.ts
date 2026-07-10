import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/cache', () => ({
  unstable_cache: (fn: (...args: unknown[]) => unknown) => fn,
}))

vi.mock('./public-booking.repository', () => ({
  publicBookingRepository: {
    findTenantBySlug: vi.fn(),
    findPublicServices: vi.fn(),
    findPublicProfessionals: vi.fn(),
    findPublicPackages: vi.fn(),
    findPublicPromotions: vi.fn(),
    findPublicTeam: vi.fn(),
    findPublicProducts: vi.fn(),
  },
}))

import { publicBookingRepository } from './public-booking.repository'
import { getPublicVitrine } from './public-booking.service'

describe('getPublicVitrine', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('retorna dados mínimos e não busca serviços/equipe quando publicPageEnabled=false', async () => {
    vi.mocked(publicBookingRepository.findTenantBySlug).mockResolvedValue({
      id: 'tenant-1',
      name: 'Studio Bella',
      slug: 'studio-bella',
      publicPageEnabled: false,
      brandingConfig: { logoUrl: 'https://x/logo.png', primaryColor: '#000' },
    } as never)

    const data = await getPublicVitrine('studio-bella')

    expect(data).toEqual({
      disabled: true,
      tenant: {
        name: 'Studio Bella',
        slug: 'studio-bella',
        branding: { logoUrl: 'https://x/logo.png', primaryColor: '#000' },
      },
    })
    expect(publicBookingRepository.findPublicServices).not.toHaveBeenCalled()
    expect(publicBookingRepository.findPublicTeam).not.toHaveBeenCalled()
  })

  it('carrega os dados completos quando publicPageEnabled=true', async () => {
    vi.mocked(publicBookingRepository.findTenantBySlug).mockResolvedValue({
      id: 'tenant-1',
      name: 'Studio Bella',
      slug: 'studio-bella',
      publicPageEnabled: true,
      phone: null,
      address: null,
      timezone: 'America/Sao_Paulo',
      businessHours: null,
      brandingConfig: null,
      bio: null,
      instagramUrl: null,
      coverImageUrl: null,
      whatsappEnabled: false,
      whatsappContactEnabled: true,
      googleBusinessUrl: null,
      googlePlaceId: null,
      segments: [],
      createdAt: new Date('2026-01-01'),
      schedulingPolicy: { allowPublicBooking: true, maxAdvanceDays: 60 },
    } as never)
    vi.mocked(publicBookingRepository.findPublicServices).mockResolvedValue([])
    vi.mocked(publicBookingRepository.findPublicProfessionals).mockResolvedValue([])
    vi.mocked(publicBookingRepository.findPublicPackages).mockResolvedValue([])
    vi.mocked(publicBookingRepository.findPublicPromotions).mockResolvedValue([])
    vi.mocked(publicBookingRepository.findPublicTeam).mockResolvedValue([])
    vi.mocked(publicBookingRepository.findPublicProducts).mockResolvedValue([])

    const data = await getPublicVitrine('studio-bella')

    expect(data).not.toHaveProperty('disabled')
    expect(publicBookingRepository.findPublicServices).toHaveBeenCalledWith('tenant-1')
  })
})
