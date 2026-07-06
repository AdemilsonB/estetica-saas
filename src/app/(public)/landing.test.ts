// src/app/(public)/landing.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock do Prisma (padrão do projeto) — agora só metrics/testimonials passam por aqui,
// planos vêm de getPublicPlans (mockado abaixo).
const mockPrisma = {
  landingMetric: { findMany: vi.fn() },
  landingTestimonial: { findMany: vi.fn() },
}

vi.mock('@/shared/database/prisma', () => ({ prisma: mockPrisma }))

const mockGetPublicPlans = vi.fn()
vi.mock('@/domains/billing/plan-catalog.service', () => ({
  getPublicPlans: mockGetPublicPlans,
}))

const { getLandingData } = await import('./page')

describe('getLandingData', () => {
  beforeEach(() => vi.clearAllMocks())

  it('retorna dados quando o catálogo tem planos e o banco tem métricas e depoimentos', async () => {
    mockGetPublicPlans.mockResolvedValue([
      {
        name: 'STARTER',
        displayName: 'Starter',
        price: 49,
        trialDays: 14,
        isPopular: false,
        highlights: ['Ideal para começar'],
        benefits: ['Agenda completa'],
      },
      {
        name: 'PRO',
        displayName: 'Pro',
        price: 89,
        trialDays: 14,
        isPopular: true,
        highlights: [],
        benefits: ['Agenda completa', 'Relatórios avançados'],
      },
    ])
    mockPrisma.landingMetric.findMany.mockResolvedValue([
      { id: '1', value: '+1.200', label: 'salões ativos' },
    ])
    mockPrisma.landingTestimonial.findMany.mockResolvedValue([
      { id: '1', authorName: 'Ana', authorRole: 'Salão · SP', quote: 'Ótimo!', rating: 5, avatarUrl: null },
    ])

    const result = await getLandingData()

    expect(result.plans).toHaveLength(2)
    expect(result.starterPlan?.price).toBe(49)
    expect(result.metrics).toHaveLength(1)
    expect(result.testimonials).toHaveLength(1)
  })

  it('retorna starterPlan nulo e arrays vazios quando o catálogo e o banco não têm dados', async () => {
    mockGetPublicPlans.mockResolvedValue([])
    mockPrisma.landingMetric.findMany.mockResolvedValue([])
    mockPrisma.landingTestimonial.findMany.mockResolvedValue([])

    const result = await getLandingData()

    expect(result.plans).toHaveLength(0)
    expect(result.starterPlan).toBeNull()
    expect(result.metrics).toHaveLength(0)
    expect(result.testimonials).toHaveLength(0)
  })

  it('chama getPublicPlans para montar o catálogo (fonte única de benefícios/trial)', async () => {
    mockGetPublicPlans.mockResolvedValue([])
    mockPrisma.landingMetric.findMany.mockResolvedValue([])
    mockPrisma.landingTestimonial.findMany.mockResolvedValue([])

    await getLandingData()

    expect(mockGetPublicPlans).toHaveBeenCalledTimes(1)
    expect(mockGetPublicPlans).toHaveBeenCalledWith()
  })

  it('deriva starterPlan a partir da lista de planos do catálogo', async () => {
    mockGetPublicPlans.mockResolvedValue([
      {
        name: 'PRO',
        displayName: 'Pro',
        price: 89,
        trialDays: 7,
        isPopular: true,
        highlights: [],
        benefits: [],
      },
      {
        name: 'STARTER',
        displayName: 'Starter',
        price: 49,
        trialDays: 14,
        isPopular: false,
        highlights: [],
        benefits: [],
      },
    ])
    mockPrisma.landingMetric.findMany.mockResolvedValue([])
    mockPrisma.landingTestimonial.findMany.mockResolvedValue([])

    const result = await getLandingData()

    expect(result.starterPlan?.trialDays).toBe(14)
  })

  it('preserva isPopular e benefits/highlights de cada plano vindos do catálogo', async () => {
    mockGetPublicPlans.mockResolvedValue([
      {
        name: 'STARTER',
        displayName: 'Starter',
        price: 49,
        trialDays: 14,
        isPopular: false,
        highlights: ['Ideal para começar'],
        benefits: ['Agenda completa'],
      },
      {
        name: 'PRO',
        displayName: 'Pro',
        price: 89,
        trialDays: 14,
        isPopular: true,
        highlights: [],
        benefits: ['Agenda completa', 'Relatórios avançados'],
      },
    ])
    mockPrisma.landingMetric.findMany.mockResolvedValue([])
    mockPrisma.landingTestimonial.findMany.mockResolvedValue([])

    const result = await getLandingData()

    expect(result.plans[0].isPopular).toBe(false)
    expect(result.plans[0].benefits).toEqual(['Agenda completa'])
    expect(result.plans[0].highlights).toEqual(['Ideal para começar'])
    expect(result.plans[1].isPopular).toBe(true)
    expect(result.plans[1].benefits).toEqual(['Agenda completa', 'Relatórios avançados'])
    expect(result.plans[1].highlights).toEqual([])
  })

  it('consulta apenas métricas ativas ordenadas', async () => {
    mockGetPublicPlans.mockResolvedValue([])
    mockPrisma.landingMetric.findMany.mockResolvedValue([])
    mockPrisma.landingTestimonial.findMany.mockResolvedValue([])

    await getLandingData()

    expect(mockPrisma.landingMetric.findMany).toHaveBeenCalledWith({
      where: { isActive: true },
      orderBy: { order: 'asc' },
    })
  })
})
