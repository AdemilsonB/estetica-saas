import type { User } from '@prisma/client'
import { UserRole } from '@prisma/client'

export function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-test-id',
    tenantId: 'tenant-test-id',
    email: 'user@test.com',
    name: 'Usuário Teste',
    role: UserRole.PROFESSIONAL,
    permissions: [],
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  }
}
