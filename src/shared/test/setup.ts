import { vi } from 'vitest'

vi.mock('@/shared/database/prisma', () => ({
  prisma: {},
}))

vi.mock('@/shared/events/event-bus', () => ({
  eventBus: {
    publish: vi.fn(),
    subscribe: vi.fn(),
  },
}))

vi.mock('@/shared/config/env', () => ({
  env: {
    DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
    SUPABASE_URL: 'https://test.supabase.co',
    SUPABASE_ANON_KEY: 'test-anon-key',
    SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
    NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
  },
}))
