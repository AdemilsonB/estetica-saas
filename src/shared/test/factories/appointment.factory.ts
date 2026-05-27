import type { Appointment } from '@prisma/client'
import { AppointmentStatus, Prisma } from '@prisma/client'

export function makeAppointment(overrides: Partial<Appointment> = {}): Appointment {
  const startsAt = new Date('2026-06-01T10:00:00Z')
  const endsAt = new Date('2026-06-01T11:00:00Z')
  return {
    id: 'appointment-test-id',
    tenantId: 'tenant-test-id',
    customerId: 'customer-test-id',
    professionalId: 'user-test-id',
    serviceId: 'service-test-id',
    createdByUserId: 'user-test-id',
    startsAt,
    endsAt,
    status: AppointmentStatus.SCHEDULED,
    notes: null,
    allowOverlap: false,
    price: new Prisma.Decimal('50.00'),
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  }
}
