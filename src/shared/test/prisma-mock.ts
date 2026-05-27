import { mockDeep, mockReset, type DeepMockProxy } from 'vitest-mock-extended'
import { PrismaClient } from '@prisma/client'
import { beforeEach, vi } from 'vitest'

export const prismaMock = mockDeep<PrismaClient>()

vi.mock('@/shared/database/prisma', () => ({
  prisma: prismaMock,
}))

beforeEach(() => {
  mockReset(prismaMock)
})

export type PrismaMock = DeepMockProxy<PrismaClient>
