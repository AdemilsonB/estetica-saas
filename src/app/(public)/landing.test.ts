// src/app/(public)/landing.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock do Prisma (padrão do projeto)
const mockPrisma = {
  plan: { findMany: vi.fn() },
  landingMetric: { findMany: vi.fn() },
  landingTestimonial: { findMany: vi.fn() },
}

vi.mock('@/shared/database/prisma', () => ({ prisma: mockPrisma }))

const { getLandingData } = await import('./page')

describe('getLandingData', () => {
  beforeEach(() => vi.clearAllMocks())

  it('retorna dados quando banco tem planos, métricas e depoimentos', async () => {
    mockPrisma.plan.findMany.mockResolvedValue([
      { name: 'STARTER', displayName: 'Starter', price: '49.90', description: 'Agenda\nCRM', trialDays: 14 },
      { name: 'PRO', displayName: 'Pro', price: '99.90', description: 'Tudo do Starter', trialDays: 7 },
    ])
    mockPrisma.landingMetric.findMany.mockResolvedValue([
      { id: '1', value: '+1.200', label: 'salões ativos' },
    ])
    mockPrisma.landingTestimonial.findMany.mockResolvedValue([
      { id: '1', authorName: 'Ana', authorRole: 'Salão · SP', quote: 'Ótimo!', rating: 5, avatarUrl: null },
    ])

    const result = await getLandingData()

    expect(result.plans).toHaveLength(2)
    expect(result.starterPlan?.price).toBe('49.90')
    expect(result.metrics).toHaveLength(1)
    expect(result.testimonials).toHaveLength(1)
  })

  it('retorna starterPlan nulo e arrays vazios quando banco não tem dados', async () => {
    mockPrisma.plan.findMany.mockResolvedValue([])
    mockPrisma.landingMetric.findMany.mockResolvedValue([])
    mockPrisma.landingTestimonial.findMany.mockResolvedValue([])

    const result = await getLandingData()

    expect(result.plans).toHaveLength(0)
    expect(result.starterPlan).toBeNull()
    expect(result.metrics).toHaveLength(0)
    expect(result.testimonials).toHaveLength(0)
  })

  it('busca trialDays dos planos ativos ordenados (fonte do trial parametrizado)', async () => {
    mockPrisma.plan.findMany.mockResolvedValue([])
    mockPrisma.landingMetric.findMany.mockResolvedValue([])
    mockPrisma.landingTestimonial.findMany.mockResolvedValue([])

    await getLandingData()

    expect(mockPrisma.plan.findMany).toHaveBeenCalledWith({
      where: { isActive: true },
      orderBy: { displayOrder: 'asc' },
      select: { name: true, displayName: true, price: true, description: true, trialDays: true },
    })
  })

  it('deriva starterPlan a partir da lista de planos', async () => {
    mockPrisma.plan.findMany.mockResolvedValue([
      { name: 'PRO', displayName: 'Pro', price: '99.90', description: null, trialDays: 7 },
      { name: 'STARTER', displayName: 'Starter', price: '49.90', description: null, trialDays: 14 },
    ])
    mockPrisma.landingMetric.findMany.mockResolvedValue([])
    mockPrisma.landingTestimonial.findMany.mockResolvedValue([])

    const result = await getLandingData()

    expect(result.starterPlan?.trialDays).toBe(14)
  })

  it('consulta apenas métricas ativas ordenadas', async () => {
    mockPrisma.plan.findMany.mockResolvedValue([])
    mockPrisma.landingMetric.findMany.mockResolvedValue([])
    mockPrisma.landingTestimonial.findMany.mockResolvedValue([])

    await getLandingData()

    expect(mockPrisma.landingMetric.findMany).toHaveBeenCalledWith({
      where: { isActive: true },
      orderBy: { order: 'asc' },
    })
  })
})
