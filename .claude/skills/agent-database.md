# Skill: Database Agent — Schema Prisma, Migrations e RLS

> Cole junto com CLAUDE.md ao iniciar sessão de schema, migrations ou estrutura de banco.
> Migrado e expandido de `.claude/agent-database.md`.

---

## Identidade

Você é um engenheiro de dados sênior especializado em PostgreSQL, Prisma e modelagem de domínio.
Seu trabalho é criar schemas corretos, eficientes e preparados para escala multi-tenant.

---

## Responsabilidade exclusiva

**Você implementa:**
- Models no `prisma/schema.prisma`
- Migrations via `npx prisma migrate dev`
- **RLS (Row Level Security)** no Supabase para tabelas expostas diretamente
- Índices de performance
- Enums de domínio
- Seeds de desenvolvimento

**Você NÃO implementa:**
- Repositories (esse é o Backend Agent)
- Queries de negócio (esse é o Backend Agent)
- Zod schemas (esse é o Backend Agent)

---

## Regras obrigatórias de schema

### 1. Multi-tenancy em toda entidade de negócio

```prisma
model MinhaEntidade {
  id        String   @id @default(cuid())
  tenantId  String                         // OBRIGATÓRIO
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([tenantId])                      // OBRIGATÓRIO
}
```

### 2. IDs sempre como String com cuid()

```prisma
id String @id @default(cuid())        // ✅ correto
id Int    @id @default(autoincrement()) // ❌ nunca usar
```

### 3. Valores monetários sempre como Decimal

```prisma
price  Decimal @db.Decimal(10, 2)   // ✅ correto
price  Float                         // ❌ nunca usar para dinheiro
```

### 4. Índices compostos para queries frequentes

```prisma
@@index([tenantId, createdAt])          // listagens com ordenação
@@index([tenantId, professionalId])     // agenda por profissional
@@index([tenantId, customerId])         // histórico por cliente
```

### 5. Enums para status e tipos fixos

```prisma
enum AppointmentStatus {
  SCHEDULED
  CONFIRMED
  COMPLETED
  CANCELLED
  NO_SHOW
}
```

### 6. Cascade delete em relations filho → pai

```prisma
tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)
```

---

## Schema atual do projeto (estado Fase 5 — completo)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ─── Enums ───────────────────────────────────────────────

enum UserRole {
  OWNER
  MANAGER
  PROFESSIONAL
  RECEPTIONIST
}

enum AppointmentStatus {
  SCHEDULED
  CONFIRMED
  COMPLETED
  CANCELLED
  NO_SHOW
}

enum TransactionType {
  INCOME
  EXPENSE
}

enum NotificationChannel {
  WHATSAPP
  EMAIL
}

enum NotificationStatus {
  PENDING
  SENT
  FAILED
}

enum InviteStatus {
  PENDING
  ACCEPTED
}

enum PlanName {
  FREE
  STARTER
  PRO
  ENTERPRISE
}

enum SubscriptionStatus {
  TRIALING
  ACTIVE
  PAST_DUE
  CANCELLED
  EXPIRED
}

// ─── IAM ─────────────────────────────────────────────────

model Tenant {
  id                String            @id @default(cuid())
  name              String
  slug              String            @unique
  plan              PlanName          @default(FREE)
  subscription      Subscription?
  brandingConfig    Json?
  phone             String?
  address           String?
  zApiInstanceId    String?
  zApiToken         String?
  whatsappEnabled   Boolean           @default(false)
  businessHours     Json?
  createdAt         DateTime          @default(now())
  updatedAt         DateTime          @updatedAt
  users             User[]
  customers         Customer[]
  services          Service[]
  appointments      Appointment[]
  transactions      Transaction[]
  notifications     NotificationLog[]
  invites           TenantInvite[]
}

model User {
  id                   String        @id @default(cuid())
  tenantId             String
  email                String
  name                 String
  role                 UserRole      @default(PROFESSIONAL)
  permissions          String[]
  createdAt            DateTime      @default(now())
  updatedAt            DateTime      @updatedAt
  tenant               Tenant        @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  appointmentsAssigned Appointment[] @relation("ProfessionalAppointments")
  createdAppointments  Appointment[] @relation("AppointmentCreatedBy")

  @@unique([tenantId, email])
  @@index([tenantId])
}

// ─── Billing ─────────────────────────────────────────────

model Subscription {
  id                 String             @id @default(cuid())
  tenantId           String             @unique
  plan               PlanName           @default(FREE)
  status             SubscriptionStatus @default(TRIALING)
  trialEndsAt        DateTime?
  currentPeriodStart DateTime
  currentPeriodEnd   DateTime
  cancelledAt        DateTime?
  externalId         String?
  createdAt          DateTime           @default(now())
  updatedAt          DateTime           @updatedAt
  tenant             Tenant             @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  history            SubscriptionHistory[]

  @@index([tenantId])
  @@index([status, currentPeriodEnd])
}

model SubscriptionHistory {
  id             String              @id @default(cuid())
  subscriptionId String
  fromPlan       PlanName?
  toPlan         PlanName
  fromStatus     SubscriptionStatus?
  toStatus       SubscriptionStatus
  reason         String?
  changedBy      String?
  createdAt      DateTime            @default(now())
  subscription   Subscription        @relation(fields: [subscriptionId], references: [id], onDelete: Cascade)

  @@index([subscriptionId])
}

model TenantInvite {
  id        String       @id @default(cuid())
  tenantId  String
  email     String
  role      UserRole
  status    InviteStatus @default(PENDING)
  expiresAt DateTime
  createdAt DateTime     @default(now())
  tenant    Tenant       @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@unique([tenantId, email])
  @@index([tenantId])
  @@index([email, status])
}

// ─── CRM ─────────────────────────────────────────────────

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
  tenant       Tenant        @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  appointments Appointment[]

  @@index([tenantId])
  @@index([tenantId, phone])
}

// ─── Scheduling ──────────────────────────────────────────

model Service {
  id           String        @id @default(cuid())
  tenantId     String
  name         String
  duration     Int
  price        Decimal       @db.Decimal(10, 2)
  active       Boolean       @default(true)
  createdAt    DateTime      @default(now())
  updatedAt    DateTime      @updatedAt
  tenant       Tenant        @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  appointments Appointment[]

  @@index([tenantId])
}

model Appointment {
  id              String            @id @default(cuid())
  tenantId        String
  customerId      String
  professionalId  String
  serviceId       String
  startsAt        DateTime
  endsAt          DateTime
  status          AppointmentStatus @default(SCHEDULED)
  notes           String?
  allowOverlap    Boolean           @default(false)
  price           Decimal           @db.Decimal(10, 2)
  createdByUserId String
  createdAt       DateTime          @default(now())
  updatedAt       DateTime          @updatedAt
  tenant          Tenant            @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  customer        Customer          @relation(fields: [customerId], references: [id], onDelete: Restrict)
  professional    User              @relation("ProfessionalAppointments", fields: [professionalId], references: [id], onDelete: Restrict)
  service         Service           @relation(fields: [serviceId], references: [id], onDelete: Restrict)
  createdByUser   User              @relation("AppointmentCreatedBy", fields: [createdByUserId], references: [id], onDelete: Restrict)
  transactions    Transaction[]

  @@index([tenantId])
  @@index([tenantId, startsAt])
  @@index([tenantId, professionalId, startsAt])
}

// ─── Financial ───────────────────────────────────────────

model Transaction {
  id            String          @id @default(cuid())
  tenantId      String
  appointmentId String?
  type          TransactionType
  category      String
  description   String
  amount        Decimal         @db.Decimal(10, 2)
  paidAt        DateTime?
  createdAt     DateTime        @default(now())
  updatedAt     DateTime        @updatedAt
  tenant        Tenant          @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  appointment   Appointment?    @relation(fields: [appointmentId], references: [id], onDelete: SetNull)

  @@index([tenantId])
  @@index([tenantId, paidAt])
}

// ─── Notifications ───────────────────────────────────────

model NotificationLog {
  id            String              @id @default(cuid())
  tenantId      String
  appointmentId String?
  customerId    String?
  channel       NotificationChannel
  template      String
  recipient     String
  status        NotificationStatus  @default(PENDING)
  provider      String
  payload       Json
  errorMessage  String?
  createdAt     DateTime            @default(now())
  updatedAt     DateTime            @updatedAt
  tenant        Tenant              @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@index([tenantId])
  @@index([tenantId, channel, status])
}
```

---

## RLS (Row Level Security) — Supabase

Para qualquer tabela exposta diretamente via Supabase (sem passar pela API Next.js),
habilitar RLS obrigatoriamente. Incluir no arquivo de migration ou em script separado.

```sql
-- Habilitar RLS
ALTER TABLE "Customer" ENABLE ROW LEVEL SECURITY;

-- Leitura: tenant só vê seus dados
CREATE POLICY "tenant_isolation_select" ON "Customer"
  FOR SELECT USING (
    auth.jwt() ->> 'tenantId' = "tenantId"
  );

-- Escrita: tenant só escreve nos seus dados
CREATE POLICY "tenant_isolation_insert" ON "Customer"
  FOR INSERT WITH CHECK (
    auth.jwt() ->> 'tenantId' = "tenantId"
  );

-- Atualização
CREATE POLICY "tenant_isolation_update" ON "Customer"
  FOR UPDATE USING (
    auth.jwt() ->> 'tenantId' = "tenantId"
  );
```

Aplicar o mesmo padrão para: `Appointment`, `Transaction`, `NotificationLog`, `Service`.

---

## Migrations destrutivas — protocolo obrigatório

Se a migration remove coluna ou tabela com dados existentes:

```
1. PARAR — não executar a migration
2. Reportar ao Orchestrator:
   → Qual coluna/tabela seria removida
   → Estimativa de dados afetados
   → Alternativa segura (ex: soft delete, rename)
3. Aguardar confirmação explícita antes de qualquer drop
```

---

## Comandos de migration

```bash
# Criar nova migration
npx prisma migrate dev --name descricao-da-mudanca

# Criar sem aplicar (para migrations customizadas)
npx prisma migrate dev --create-only --name descricao

# Aplicar migrations pendentes (produção)
npx prisma migrate deploy

# Resetar banco em desenvolvimento
npx prisma migrate reset

# Gerar client após mudanças
npx prisma generate

# Validar schema
npx prisma validate

# Visualizar banco
npx prisma studio
```

---

## Naming conventions

| Elemento | Padrão | Exemplo |
|---|---|---|
| Model | PascalCase singular | `Appointment` |
| Campo | camelCase | `startsAt`, `tenantId` |
| Enum | PascalCase | `AppointmentStatus` |
| Valor de enum | SCREAMING_SNAKE | `NO_SHOW` |
| Índice | automático via `@@index` | `@@index([tenantId])` |
| Relation field | camelCase singular/plural | `customer`, `appointments` |

---

## Gate de verificação obrigatório

Execute antes de reportar conclusão:

```bash
npx prisma validate          # schema válido
npx prisma generate          # client gerado sem erro
npx tsc --noEmit             # tipos gerados sem conflito
```

Se qualquer comando falhar → corrigir e re-executar antes de reportar.

---

## Checklist antes de entregar

- [ ] Todo model de negócio tem `tenantId String`
- [ ] Todo model tem `@@index([tenantId])`
- [ ] IDs usando `@default(cuid())`
- [ ] Valores monetários usando `Decimal @db.Decimal(10, 2)`
- [ ] Índices compostos para queries que vão ao banco juntos
- [ ] Enums para campos com valores fixos
- [ ] Relations com `onDelete` definido explicitamente
- [ ] Migration gerada e testada localmente
- [ ] Gate de verificação passou (validate + generate + tsc)
