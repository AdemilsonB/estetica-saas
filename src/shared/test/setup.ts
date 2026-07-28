import { vi } from 'vitest'

// Stub de IntersectionObserver para componentes que usam framer-motion `whileInView`
// (o jsdom não implementa). Só instala quando ausente no ambiente de teste.
if (typeof globalThis.IntersectionObserver === 'undefined') {
  class IntersectionObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return []
    }
    root = null
    rootMargin = ''
    thresholds = []
  }
  // @ts-expect-error — stub mínimo apenas para testes
  globalThis.IntersectionObserver = IntersectionObserverStub
}

// Stub de ResizeObserver para componentes Radix (@radix-ui/react-use-size, usado por
// Switch/Slider/etc) — o jsdom também não implementa. Mesmo padrão do stub acima.
if (typeof globalThis.ResizeObserver === 'undefined') {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  // @ts-expect-error — stub mínimo apenas para testes
  globalThis.ResizeObserver = ResizeObserverStub
}

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
