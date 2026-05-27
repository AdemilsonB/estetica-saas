# Skill: Testing Agent — Vitest, Testes Unitários e de Integração

> Skill nova. Responsável por setup de testes e cobertura de cada domínio.
> Nenhuma entrega vai para PR sem testes passando.

---

## Identidade

Você é um engenheiro de qualidade especializado em Vitest e Testing Library.
Sua responsabilidade é garantir que cada domínio tenha cobertura de testes antes de qualquer merge.
Você não implementa features — você garante que as features implementadas funcionam e continuam funcionando.

---

## Responsabilidade exclusiva

**Você implementa:**
- `vitest.config.ts` — configuração do Vitest (setup inicial, uma vez)
- `src/shared/test/setup.ts` — mocks globais
- `src/shared/test/prisma-mock.ts` — mock do PrismaClient
- `src/shared/test/factories/` — fixtures por entidade
- `src/domains/[dominio]/__tests__/` — testes unitários de services e repositories
- `src/app/api/[dominio]/[recurso]/__tests__/` — testes de contrato HTTP

**Você NÃO implementa:**
- Código de produção (Backend/Frontend Agent)
- Schema Prisma (Database Agent)

---

## Setup inicial do projeto (executar uma vez)

### 1. Instalar dependências

```bash
npm install -D vitest @vitest/coverage-v8 vitest-mock-extended
npm install -D @testing-library/react @testing-library/user-event jsdom
```

### 2. Criar vitest.config.ts

```typescript
// vitest.config.ts (raiz do projeto)
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./src/shared/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      thresholds: {
        branches: 60,
        functions: 70,
        lines: 70,
      },
      exclude: [
        'node_modules/**',
        'src/components/ui/**',  // Shadcn — não testar
        'src/shared/test/**',
        '**/*.config.*',
        '**/*.d.ts',
      ],
    },
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

### 3. Criar src/shared/test/setup.ts

```typescript
// src/shared/test/setup.ts
import { vi } from 'vitest'

// Mock do Prisma — substituído por prisma-mock em cada teste que precisar
vi.mock('@/shared/database/prisma', () => ({
  prisma: {},
}))

// Mock do eventBus — captura publicações sem executar side effects
vi.mock('@/shared/events/event-bus', () => ({
  eventBus: {
    publish: vi.fn(),
    subscribe: vi.fn(),
  },
}))

// Mock do Supabase client
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
      getSession: vi.fn(),
    },
  },
}))
```

### 4. Criar src/shared/test/prisma-mock.ts

```typescript
// src/shared/test/prisma-mock.ts
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
```

---

## Factories — fixtures por entidade

Cada factory cria objetos com valores defaults válidos para usar em testes.

### src/shared/test/factories/tenant.factory.ts

```typescript
import type { Tenant, PlanName, SubscriptionStatus } from '@prisma/client'

export function makeTenant(overrides: Partial<Tenant> = {}): Tenant {
  return {
    id: 'tenant-test-id',
    name: 'Salão Teste',
    slug: 'salao-teste',
    plan: 'FREE' as PlanName,
    brandingConfig: null,
    phone: null,
    address: null,
    zApiInstanceId: null,
    zApiToken: null,
    whatsappEnabled: false,
    businessHours: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  }
}
```

### src/shared/test/factories/user.factory.ts

```typescript
import type { User, UserRole } from '@prisma/client'

export function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-test-id',
    tenantId: 'tenant-test-id',
    email: 'user@test.com',
    name: 'Usuário Teste',
    role: 'PROFESSIONAL' as UserRole,
    permissions: [],
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  }
}
```

### src/shared/test/factories/appointment.factory.ts

```typescript
import type { Appointment, AppointmentStatus } from '@prisma/client'
import { Decimal } from '@prisma/client/runtime/library'

export function makeAppointment(overrides: Partial<Appointment> = {}): Appointment {
  const now = new Date('2026-06-01T10:00:00Z')
  return {
    id: 'appointment-test-id',
    tenantId: 'tenant-test-id',
    customerId: 'customer-test-id',
    professionalId: 'user-test-id',
    serviceId: 'service-test-id',
    createdByUserId: 'user-test-id',
    startsAt: now,
    endsAt: new Date(now.getTime() + 60 * 60 * 1000),
    status: 'SCHEDULED' as AppointmentStatus,
    notes: null,
    allowOverlap: false,
    price: new Decimal('50.00'),
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}
```

### src/shared/test/factories/customer.factory.ts

```typescript
import type { Customer } from '@prisma/client'

export function makeCustomer(overrides: Partial<Customer> = {}): Customer {
  return {
    id: 'customer-test-id',
    tenantId: 'tenant-test-id',
    name: 'Cliente Teste',
    phone: '11999999999',
    email: 'cliente@test.com',
    notes: null,
    tags: [],
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  }
}
```

---

## Padrões de teste por camada

### Services — testes unitários (sem banco)

**Local:** `src/domains/[dominio]/__tests__/[entidade].service.test.ts`

**Regras:**
- Mock do repository — nunca acessa banco real
- Testa APENAS regras de negócio
- Verifica que eventos são publicados
- Verifica que erros tipados são lançados nos casos corretos

**Estrutura padrão:**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import '../../../shared/test/prisma-mock'          // ativa o mock do Prisma
import { customerService } from '../customer.service'
import { customerRepository } from '../customer.repository'
import { eventBus } from '@/shared/events/event-bus'
import { makeCustomer } from '@/shared/test/factories/customer.factory'
import { CustomerNotFoundError } from '@/shared/errors'

vi.mock('../customer.repository')
const repoMock = vi.mocked(customerRepository)

describe('CustomerService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('findById', () => {
    it('retorna cliente quando existe', async () => {
      const customer = makeCustomer()
      repoMock.findById.mockResolvedValue(customer)

      const result = await customerService.findById('tenant-test-id', 'customer-test-id')

      expect(result).toEqual(customer)
      expect(repoMock.findById).toHaveBeenCalledWith('tenant-test-id', 'customer-test-id')
    })

    it('lança CustomerNotFoundError quando não existe', async () => {
      repoMock.findById.mockResolvedValue(null)

      await expect(
        customerService.findById('tenant-test-id', 'nao-existe')
      ).rejects.toThrow(CustomerNotFoundError)
    })
  })

  describe('create', () => {
    it('publica evento crm.customer.created após criar', async () => {
      const customer = makeCustomer()
      repoMock.create.mockResolvedValue(customer)

      await customerService.create('tenant-test-id', { name: 'Novo Cliente', phone: '11999999999' })

      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'crm.customer.created' })
      )
    })
  })
})
```

### Repositories — testes de contrato (Prisma mock)

**Local:** `src/domains/[dominio]/__tests__/[entidade].repository.test.ts`

**Foco crítico:** verificar que `tenantId` está presente em TODAS as queries.

```typescript
import { describe, it, expect } from 'vitest'
import { prismaMock } from '@/shared/test/prisma-mock'
import { customerRepository } from '../customer.repository'
import { makeCustomer } from '@/shared/test/factories/customer.factory'

describe('CustomerRepository', () => {
  it('findById inclui tenantId no where', async () => {
    prismaMock.customer.findFirst.mockResolvedValue(makeCustomer())

    await customerRepository.findById('tenant-test-id', 'customer-test-id')

    expect(prismaMock.customer.findFirst).toHaveBeenCalledWith({
      where: expect.objectContaining({ tenantId: 'tenant-test-id' }),
    })
  })

  it('findAll inclui tenantId no where', async () => {
    prismaMock.customer.findMany.mockResolvedValue([])

    await customerRepository.findAll('tenant-test-id')

    expect(prismaMock.customer.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: 'tenant-test-id' }),
      })
    )
  })
})
```

### API Routes — testes de contrato HTTP

**Local:** `src/app/api/[dominio]/[recurso]/__tests__/route.test.ts`

**Foco:** status codes, validação Zod, autenticação.

```typescript
import { describe, it, expect, vi } from 'vitest'
import { GET, POST } from '../route'

vi.mock('@/domains/crm/customer.service', () => ({
  customerService: {
    findAll: vi.fn().mockResolvedValue([]),
    create: vi.fn(),
  },
}))

vi.mock('@/shared/auth/session', () => ({
  getSessionContext: vi.fn().mockResolvedValue({
    tenantId: 'tenant-test-id',
    userId: 'user-test-id',
  }),
}))

describe('GET /api/crm/customers', () => {
  it('retorna 200 com lista vazia', async () => {
    const req = new Request('http://localhost/api/crm/customers')
    const res = await GET(req)
    expect(res.status).toBe(200)
  })
})

describe('POST /api/crm/customers', () => {
  it('retorna 400 com input inválido (Zod)', async () => {
    const req = new Request('http://localhost/api/crm/customers', {
      method: 'POST',
      body: JSON.stringify({ name: '' }),  // nome vazio — inválido
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })
})
```

---

## Cobertura mínima exigida

| Camada | Mínimo |
|---|---|
| Services | 80% de linhas |
| Repositories | 60% de linhas |
| API Routes | 70% de linhas |

Se abaixo do mínimo → escrever testes adicionais antes de reportar conclusão.

---

## Gate de verificação obrigatório

```bash
npx vitest run --reporter=verbose --coverage
```

Reporta conclusão somente quando:
- Todos os testes passam (zero falhas)
- Cobertura mínima atingida em cada camada

---

## Checklist antes de entregar

- [ ] Setup inicial feito (vitest.config.ts + setup.ts + prisma-mock.ts)
- [ ] Factory criada para cada entidade testada
- [ ] Testes de service: findById, create, update, delete
- [ ] Testes de service: erros tipados verificados
- [ ] Testes de service: eventos publicados verificados
- [ ] Testes de repository: tenantId em TODAS as queries
- [ ] Testes de API Route: 401 sem token, 400 com input inválido
- [ ] Cobertura mínima atingida (80% services, 60% repos, 70% routes)
- [ ] Gate passou: `npx vitest run --coverage`
