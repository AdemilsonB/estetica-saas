import { describe, it, expect, vi, beforeEach } from 'vitest'
import { prisma } from '@/shared/database/prisma'
import { IamRepository } from '@/domains/iam/iam.repository'
import { AvailabilityService } from './availability.service'

vi.mock('@/shared/database/prisma', () => ({
  prisma: { appointment: { findMany: vi.fn() } },
}))

vi.mock('@/domains/iam/iam.repository', () => ({
  IamRepository: vi.fn().mockImplementation(() => ({
    getBusinessHours: vi.fn(),
    getTenantTimezone: vi.fn(),
  })),
}))

const mockBusinessHours = {
  '1': { active: true, open: '09:00', close: '18:00' }, // Segunda
}

beforeEach(() => {
  vi.clearAllMocks()
  const iamInstance = new (IamRepository as any)()
  iamInstance.getBusinessHours.mockResolvedValue(mockBusinessHours)
  iamInstance.getTenantTimezone.mockResolvedValue('America/Sao_Paulo')
  ;(IamRepository as any).mockImplementation(() => iamInstance)
})

describe('AvailabilityService.getAvailableSlots', () => {
  const service = new AvailabilityService()
  const tenantId = 'tenant-1'
  const professionalId = 'prof-1'
  // 2026-06-08 é uma segunda-feira (dayOfWeek = 1)
  const date = '2026-06-08'

  it('gera slots com intervalo fixo, não com a duração do serviço', async () => {
    ;(prisma.appointment.findMany as any).mockResolvedValue([])

    // Serviço de 60 min com intervalo de 30 min
    const slots = await service.getAvailableSlots(tenantId, professionalId, date, 60, 30)
    const times = slots.map((s) => s.time)

    // Deve gerar 09:00, 09:30, 10:00, ... até 17:00 (último que cabe: 17:00 + 60min = 18:00)
    expect(times).toContain('09:00')
    expect(times).toContain('09:30')
    expect(times).toContain('10:00')
    expect(times).toContain('17:00')
    // 17:30 não cabe (17:30 + 60min = 18:30 > 18:00)
    expect(times).not.toContain('17:30')
  })

  it('todos os slots disponíveis quando não há agendamentos', async () => {
    ;(prisma.appointment.findMany as any).mockResolvedValue([])

    const slots = await service.getAvailableSlots(tenantId, professionalId, date, 60, 30)

    expect(slots.every((s) => s.available)).toBe(true)
    expect(slots.every((s) => !s.bookedBy)).toBe(true)
  })

  it('marca slot como ocupado quando há conflito com agendamento existente', async () => {
    // Agendamento das 09:00 às 10:00 (UTC: 12:00–13:00)
    ;(prisma.appointment.findMany as any).mockResolvedValue([
      {
        startsAt: new Date('2026-06-08T12:00:00.000Z'),
        endsAt: new Date('2026-06-08T13:00:00.000Z'),
        customer: { name: 'Ana Silva' },
      },
    ])

    const slots = await service.getAvailableSlots(tenantId, professionalId, date, 60, 30)

    const slot0900 = slots.find((s) => s.time === '09:00')
    expect(slot0900?.available).toBe(false)
    expect(slot0900?.bookedBy).toBe('Ana')

    // Slot das 09:30 conflita: 09:30+60min=10:30 > 09:00 e 09:30 < 10:00
    const slot0930 = slots.find((s) => s.time === '09:30')
    expect(slot0930?.available).toBe(false)

    // Slot das 10:00 NÃO conflita: começa exatamente quando termina o agendamento
    const slot1000 = slots.find((s) => s.time === '10:00')
    expect(slot1000?.available).toBe(true)
  })

  it('retorna array vazio quando dia está fechado', async () => {
    // Usa uma quinta com dayOfWeek=4, não configurada no businessHours mock
    const slots = await service.getAvailableSlots(tenantId, professionalId, '2026-06-11', 60, 30)
    expect(slots).toHaveLength(0)
  })

  it('usa intervalo padrão de 30 min quando não informado', async () => {
    ;(prisma.appointment.findMany as any).mockResolvedValue([])

    const slots = await service.getAvailableSlots(tenantId, professionalId, date, 60)
    const times = slots.map((s) => s.time)

    // Com intervalo 30: 09:00, 09:30, 10:00...
    expect(times).toContain('09:30')
  })
})
