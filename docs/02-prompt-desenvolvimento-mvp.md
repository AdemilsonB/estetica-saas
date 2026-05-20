# Prompt de Desenvolvimento MVP — SaaS Operacional para Estética

> Este é o prompt operacional que guia o Vibe Coding com Claude.
> Define stack, estrutura de código, padrões e decisões concretas para o MVP.
> O objetivo é: zero custo inicial, deploy em minutos, arquitetura que escala depois sem reescrever.

---

## Contexto do produto

Estamos construindo um SaaS operacional para negócios de estética (barbearias, salões, clínicas, estúdios). O produto é um **Operational Workspace** — não um ERP, não uma agenda simples. É uma plataforma que centraliza operação, automatiza processos e entrega inteligência para o dono do negócio crescer.

O MVP foca nas funcionalidades essenciais para os primeiros clientes pagantes. A arquitetura deve ser simples de operar, barata para hospedar e estruturada para escalar sem reescrita.

---

## Stack MVP

### Frontend + Backend

**Next.js 14+ com App Router** — frontend e backend no mesmo projeto.

- React + TypeScript
- TailwindCSS + Shadcn UI
- TanStack Query para data fetching
- Zustand para estado global de UI
- API Routes do Next.js para o backend (não criar servidor separado no MVP)

### Banco de dados

**Supabase** como plataforma principal:

- PostgreSQL gerenciado (plano free aguenta o MVP)
- Row Level Security (RLS) nativo para multi-tenancy
- Auth gerenciado (email/senha, magic link)
- Realtime via WebSockets (para agenda e notificações)
- Storage para arquivos e imagens

### Filas e jobs assíncronos

**pg-boss** rodando sobre o PostgreSQL do Supabase — zero serviço extra.

Usar para: envio de notificações, automações, campanhas, processamento de webhooks.

### Deploy

**Vercel** para o Next.js (plano hobby é gratuito, plano pro custa ~R$100/mês quando necessário).
**Supabase** gerencia o banco (plano free: 500MB, 2 projetos, tempo de pausa após 1 semana inativo — usar plano Pro R$125/mês quando tiver clientes).

Custo total no início: **R$0 a R$250/mês**.

### ORM

**Prisma** com PostgreSQL — type-safe, excelente geração de código pelo Claude, migrations automáticas.

---

## Estrutura de pastas

Organizada por domínio, não por tipo de arquivo. Cada domínio é autocontido.

```
src/
├── app/                        # Next.js App Router (páginas e layouts)
│   ├── (auth)/                 # Rotas de autenticação
│   ├── (dashboard)/            # Rotas do dashboard principal
│   └── api/                    # API Routes (backend)
│       ├── scheduling/
│       ├── crm/
│       ├── financial/
│       └── ...
│
├── domains/                    # Lógica de negócio por domínio
│   ├── iam/                    # Identidade e permissões
│   │   ├── auth.service.ts
│   │   ├── permissions.ts
│   │   └── types.ts
│   ├── crm/                    # Clientes e relacionamento
│   │   ├── customer.service.ts
│   │   ├── customer.repository.ts
│   │   └── types.ts
│   ├── scheduling/             # Agenda e agendamentos
│   │   ├── appointment.service.ts
│   │   ├── appointment.repository.ts
│   │   ├── availability.service.ts
│   │   └── types.ts
│   ├── financial/              # Financeiro
│   │   ├── transaction.service.ts
│   │   ├── transaction.repository.ts
│   │   └── types.ts
│   ├── notifications/          # Notificações desacopladas
│   │   ├── notification.service.ts
│   │   ├── whatsapp.provider.ts
│   │   └── types.ts
│   └── automation/             # Motor de automações
│       ├── automation.service.ts
│       ├── trigger.handler.ts
│       └── types.ts
│
├── shared/                     # Código verdadeiramente compartilhado
│   ├── database/               # Prisma client e helpers
│   ├── events/                 # Event bus interno simples
│   ├── errors/                 # Erros de domínio tipados
│   └── types/                  # Tipos globais (Tenant, User, etc.)
│
├── components/                 # Componentes React reutilizáveis
│   ├── ui/                     # Shadcn UI (gerado automaticamente)
│   └── domain/                 # Componentes específicos de domínio
│
└── lib/                        # Utilitários e configurações
    ├── supabase/               # Cliente Supabase
    └── utils/
```

---

## Multi-tenancy

Usar `tenant_id` em todas as tabelas de negócio desde o primeiro dia. O Supabase RLS garante isolamento no banco.

### Schema base obrigatório

Todo model do Prisma que pertence a um tenant deve ter:

```prisma
model Appointment {
  id        String   @id @default(cuid())
  tenantId  String   // OBRIGATÓRIO em toda entidade de negócio
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // ... campos do domínio

  @@index([tenantId])
}
```

### Middleware de tenant

Toda API Route deve extrair e validar o `tenantId` do token antes de qualquer operação:

```typescript
// shared/middleware/tenant.ts
export async function withTenant(req: Request) {
  const session = await getSession(req)
  if (!session?.tenantId) throw new UnauthorizedError()
  return session.tenantId
}
```

Nunca passar `tenantId` como parâmetro de URL ou body — sempre extrair do token autenticado.

---

## Event bus interno

Comunicação entre domínios via eventos — sem acoplamento direto.

Implementação simples com EventEmitter no MVP (sem RabbitMQ ainda):

```typescript
// shared/events/event-bus.ts
import { EventEmitter } from 'events'

type DomainEvent =
  | { type: 'appointment.created'; payload: AppointmentCreatedPayload }
  | { type: 'payment.confirmed'; payload: PaymentConfirmedPayload }
  | { type: 'customer.inactive'; payload: CustomerInactivePayload }

class DomainEventBus extends EventEmitter {
  publish(event: DomainEvent) {
    this.emit(event.type, event.payload)
  }

  subscribe<T extends DomainEvent['type']>(
    eventType: T,
    handler: (payload: Extract<DomainEvent, { type: T }>['payload']) => void
  ) {
    this.on(eventType, handler)
  }
}

export const eventBus = new DomainEventBus()
```

Os domínios publicam eventos. O domínio de Notifications e Automation escutam — sem dependência cruzada.

---

## Padrões de código por camada

### Repository — acesso a dados

```typescript
// domains/crm/customer.repository.ts
export class CustomerRepository {
  async findById(tenantId: string, customerId: string): Promise<Customer | null> {
    return prisma.customer.findFirst({
      where: { id: customerId, tenantId } // tenantId SEMPRE no where
    })
  }

  async findAll(tenantId: string, filters?: CustomerFilters): Promise<Customer[]> {
    return prisma.customer.findMany({
      where: { tenantId, ...buildFilters(filters) }
    })
  }
}
```

### Service — regras de negócio

```typescript
// domains/scheduling/appointment.service.ts
export class AppointmentService {
  constructor(
    private readonly appointmentRepo: AppointmentRepository,
    private readonly availabilityService: AvailabilityService,
    private readonly events: DomainEventBus
  ) {}

  async create(tenantId: string, input: CreateAppointmentInput): Promise<Appointment> {
    const isAvailable = await this.availabilityService.check(tenantId, input)
    if (!isAvailable) throw new SlotUnavailableError()

    const appointment = await this.appointmentRepo.create(tenantId, input)

    this.events.publish({
      type: 'appointment.created',
      payload: { tenantId, appointment }
    })

    return appointment
  }
}
```

### API Route — controller fino

```typescript
// app/api/scheduling/appointments/route.ts
export async function POST(req: Request) {
  try {
    const tenantId = await withTenant(req)
    const input = await validateInput(req, CreateAppointmentSchema)
    const appointment = await appointmentService.create(tenantId, input)
    return Response.json(appointment, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
```

---

## Erros de domínio

Usar erros tipados, nunca strings genéricas:

```typescript
// shared/errors/index.ts
export class DomainError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message)
  }
}

export class SlotUnavailableError extends DomainError {
  constructor() { super('Horário não disponível', 'SLOT_UNAVAILABLE') }
}

export class CustomerNotFoundError extends DomainError {
  constructor() { super('Cliente não encontrado', 'CUSTOMER_NOT_FOUND') }
}

export class UnauthorizedError extends DomainError {
  constructor() { super('Não autorizado', 'UNAUTHORIZED') }
}
```

---

## Permissões (RBAC simples para MVP)

```typescript
// domains/iam/permissions.ts
export const PERMISSIONS = {
  APPOINTMENTS: {
    VIEW: 'appointments:view',
    CREATE: 'appointments:create',
    EDIT: 'appointments:edit',
    DELETE: 'appointments:delete',
  },
  CUSTOMERS: {
    VIEW: 'customers:view',
    CREATE: 'customers:create',
    EDIT: 'customers:edit',
  },
  FINANCIAL: {
    VIEW: 'financial:view',
    MANAGE: 'financial:manage',
  },
} as const

export const ROLES = {
  OWNER: Object.values(PERMISSIONS).flatMap(Object.values), // todas
  MANAGER: [/* subset */],
  PROFESSIONAL: [PERMISSIONS.APPOINTMENTS.VIEW, PERMISSIONS.APPOINTMENTS.CREATE],
  RECEPTIONIST: [/* subset */],
} satisfies Record<string, string[]>
```

---

## Schema Prisma — entidades do MVP Fase 1

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Tenant {
  id        String   @id @default(cuid())
  name      String
  slug      String   @unique
  plan      String   @default("free")
  createdAt DateTime @default(now())
  users     User[]
}

model User {
  id           String        @id @default(cuid())
  tenantId     String
  email        String
  name         String
  role         String        @default("PROFESSIONAL")
  permissions  String[]
  createdAt    DateTime      @default(now())
  tenant       Tenant        @relation(fields: [tenantId], references: [id])
  appointments Appointment[]

  @@unique([tenantId, email])
  @@index([tenantId])
}

model Customer {
  id           String        @id @default(cuid())
  tenantId     String
  name         String
  phone        String?
  email        String?
  notes        String?
  tags         String[]
  createdAt    DateTime      @default(now())
  updatedAt    DateTime      @updatedAt
  appointments Appointment[]

  @@index([tenantId])
  @@index([tenantId, phone])
}

model Service {
  id           String        @id @default(cuid())
  tenantId     String
  name         String
  duration     Int           // minutos
  price        Decimal       @db.Decimal(10, 2)
  active       Boolean       @default(true)
  appointments Appointment[]

  @@index([tenantId])
}

model Appointment {
  id          String    @id @default(cuid())
  tenantId    String
  customerId  String
  professionalId String
  serviceId   String
  startsAt    DateTime
  endsAt      DateTime
  status      String    @default("SCHEDULED") // SCHEDULED | CONFIRMED | COMPLETED | CANCELLED | NO_SHOW
  notes       String?
  price       Decimal   @db.Decimal(10, 2)
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  customer    Customer  @relation(fields: [customerId], references: [id])
  professional User     @relation(fields: [professionalId], references: [id])
  service     Service   @relation(fields: [serviceId], references: [id])

  @@index([tenantId])
  @@index([tenantId, startsAt])
  @@index([tenantId, professionalId, startsAt])
}

model Transaction {
  id            String   @id @default(cuid())
  tenantId      String
  appointmentId String?
  type          String   // INCOME | EXPENSE
  category      String
  description   String
  amount        Decimal  @db.Decimal(10, 2)
  paidAt        DateTime?
  createdAt     DateTime @default(now())

  @@index([tenantId])
  @@index([tenantId, paidAt])
}
```

---

## Módulos do MVP Fase 1

### Obrigatório para os primeiros clientes

1. **IAM** — cadastro de tenant, login, roles, permissões
2. **CRM** — cadastro de clientes, histórico de atendimentos
3. **Scheduling** — agenda semanal, criar/editar/cancelar agendamentos, verificar disponibilidade
4. **Services** — cadastro de serviços com duração e preço
5. **Financial básico** — registro de transações, fechamento de caixa simples
6. **Notifications** — WhatsApp via Evolution API (confirmação de agendamento, lembrete)

### Deixar para Fase 2

Estoque, comissões, automações avançadas, analytics, campanhas, IA.

---

## Diretrizes de UX para o frontend

- Poucos cliques para ações frequentes (criar agendamento: máximo 3 cliques)
- Agenda como tela principal — não um dashboard com métricas
- Mobile-first para profissionais, desktop para gestores
- Feedback imediato em todas as ações (loading states, toasts)
- Shadcn UI como base — não reinventar componentes
- Identidade visual: tons rosados suaves, tipografia clean, espaçamento generoso

---

## Regras para o agente de IA (Claude) durante o desenvolvimento

**Sempre:**
- Colocar `tenantId` em todo acesso ao banco
- Validar input nas API Routes com Zod antes de passar para o service
- Usar erros de domínio tipados, nunca `throw new Error('string')`
- Manter repositories finos — só acesso a dados, sem lógica de negócio
- Publicar eventos após operações importantes (criação, atualização de status, pagamento)
- TypeScript strict — sem `any`, sem `as unknown as`

**Nunca:**
- Lógica de negócio em componentes React
- Queries diretas ao banco em componentes ou API Routes (sempre via repository)
- Acoplamento direto entre domínios (usar eventos ou shared types)
- Hardcode de IDs, roles ou strings mágicas sem constante nomeada
- `console.log` em produção — usar logger estruturado

---

## Variáveis de ambiente necessárias

```env
# Supabase
DATABASE_URL=postgresql://...
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...

# Auth
NEXTAUTH_SECRET=...
NEXTAUTH_URL=http://localhost:3000

# WhatsApp (Evolution API)
EVOLUTION_API_URL=https://...
EVOLUTION_API_KEY=...

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## Comandos de desenvolvimento

```bash
# Instalar dependências
npm install

# Rodar em desenvolvimento
npm run dev

# Migrations do banco
npx prisma migrate dev --name nome-da-migration

# Gerar client do Prisma
npx prisma generate

# Abrir Prisma Studio (visualizar banco)
npx prisma studio
```

---

## Checklist antes de cada feature

- [ ] Schema Prisma atualizado com `tenantId` e índices corretos
- [ ] Repository criado com filtro de tenant em todas as queries
- [ ] Service com regras de negócio e publicação de eventos
- [ ] API Route com validação de tenant e input com Zod
- [ ] Erros de domínio tipados para casos de falha
- [ ] Componente React consumindo via TanStack Query
- [ ] Loading state e error state no componente
