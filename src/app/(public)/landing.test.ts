// src/app/(public)/landing.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock do Prisma (padrão do projeto)
const mockPrisma = {
  plan: { findFirst: vi.fn() },
  landingMetric: { findMany: vi.fn() },
  landingTestimonial: { findMany: vi.fn() },
}

vi.mock('@/shared/database/prisma', () => ({ prisma: mockPrisma }))

const { getLandingData } = await import('./page')

describe('getLandingData', () => {
  beforeEach(() => vi.clearAllMocks())

  it('retorna dados quando banco tem plano, métricas e depoimentos', async () => {
    mockPrisma.plan.findFirst.mockResolvedValue({ price: '49.90' })
    mockPrisma.landingMetric.findMany.mockResolvedValue([
      { id: '1', value: '+1.200', label: 'salões ativos' },
    ])
    mockPrisma.landingTestimonial.findMany.mockResolvedValue([
      { id: '1', authorName: 'Ana', authorRole: 'Salão · SP', quote: 'Ótimo!', rating: 5, avatarUrl: null },
    ])

    const result = await getLandingData()

    expect(result.starterPlan?.price).toBe('49.90')
    expect(result.metrics).toHaveLength(1)
    expect(result.testimonials).toHaveLength(1)
  })

  it('retorna nulls e arrays vazios quando banco não tem dados', async () => {
    mockPrisma.plan.findFirst.mockResolvedValue(null)
    mockPrisma.landingMetric.findMany.mockResolvedValue([])
    mockPrisma.landingTestimonial.findMany.mockResolvedValue([])

    const result = await getLandingData()

    expect(result.starterPlan).toBeNull()
    expect(result.metrics).toHaveLength(0)
    expect(result.testimonials).toHaveLength(0)
  })

  it('consulta apenas planos STARTER ativos', async () => {
    mockPrisma.plan.findFirst.mockResolvedValue(null)
    mockPrisma.landingMetric.findMany.mockResolvedValue([])
    mockPrisma.landingTestimonial.findMany.mockResolvedValue([])

    await getLandingData()

    expect(mockPrisma.plan.findFirst).toHaveBeenCalledWith({
      where: { name: 'STARTER', isActive: true },
      select: { price: true },
    })
  })

  it('consulta apenas métricas ativas ordenadas', async () => {
    mockPrisma.plan.findFirst.mockResolvedValue(null)
    mockPrisma.landingMetric.findMany.mockResolvedValue([])
    mockPrisma.landingTestimonial.findMany.mockResolvedValue([])

    await getLandingData()

    expect(mockPrisma.landingMetric.findMany).toHaveBeenCalledWith({
      where: { isActive: true },
      orderBy: { order: 'asc' },
    })
  })
})
