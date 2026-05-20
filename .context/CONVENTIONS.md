# CONVENTIONS.md — Convenções do projeto

## Naming — arquivos e pastas

| Tipo | Padrão | Exemplo |
|---|---|---|
| Componente React | PascalCase | `AppointmentCard.tsx` |
| Hook | camelCase com `use` | `useAppointments.ts` |
| Service | camelCase + `.service` | `appointment.service.ts` |
| Repository | camelCase + `.repository` | `appointment.repository.ts` |
| Types | camelCase + `.types` | `appointment.types.ts` |
| Schema Zod | camelCase + `.schema` | `appointment.schema.ts` |
| API Route | `route.ts` na pasta certa | `app/api/scheduling/appointments/route.ts` |
| Pasta de domínio | kebab-case | `src/domains/scheduling/` |
| Pasta de página | kebab-case | `app/(dashboard)/scheduling/` |

## Naming — código TypeScript

| Tipo | Padrão | Exemplo |
|---|---|---|
| Interface | PascalCase | `Appointment`, `CreateAppointmentInput` |
| Type alias | PascalCase | `AppointmentStatus` |
| Enum | PascalCase | `AppointmentStatus` |
| Valor de enum | SCREAMING_SNAKE | `NO_SHOW`, `SCHEDULED` |
| Constante | SCREAMING_SNAKE | `MAX_APPOINTMENTS_PER_DAY` |
| Variável/função | camelCase | `appointmentService`, `findById` |
| Classe | PascalCase | `AppointmentService` |

## Naming — banco de dados (Prisma)

| Tipo | Padrão | Exemplo |
|---|---|---|
| Model | PascalCase singular | `Appointment` |
| Campo | camelCase | `startsAt`, `tenantId` |
| Enum | PascalCase | `AppointmentStatus` |
| Valor de enum | SCREAMING_SNAKE | `NO_SHOW` |

## Naming — eventos de domínio

Padrão: `[dominio].[entidade].[acao]`

```
scheduling.appointment.created
scheduling.appointment.cancelled
scheduling.appointment.completed
crm.customer.created
crm.customer.updated
financial.transaction.created
financial.transaction.confirmed
iam.user.invited
iam.user.activated
notifications.whatsapp.sent
```

## Naming — API Routes

Padrão REST:

```
GET    /api/scheduling/appointments          # listar
POST   /api/scheduling/appointments          # criar
GET    /api/scheduling/appointments/[id]     # buscar por id
PATCH  /api/scheduling/appointments/[id]     # atualizar
DELETE /api/scheduling/appointments/[id]     # deletar

GET    /api/crm/customers
POST   /api/crm/customers
GET    /api/crm/customers/[id]
PATCH  /api/crm/customers/[id]

GET    /api/financial/transactions
POST   /api/financial/transactions
```

## Estrutura de resposta da API

### Sucesso — lista
```json
{
  "data": [...],
  "total": 10,
  "page": 1,
  "pageSize": 20
}
```

### Sucesso — item único
```json
{ "id": "...", "name": "...", ... }
```

### Erro
```json
{
  "error": {
    "code": "SLOT_UNAVAILABLE",
    "message": "Horário não disponível"
  }
}
```

## Padrão de imports

Usar alias `@/` sempre — nunca caminhos relativos longos:

```typescript
// ✅ correto
import { prisma } from '@/shared/database/client'
import { CustomerRepository } from '@/domains/crm/customer.repository'

// ❌ errado
import { prisma } from '../../../shared/database/client'
```

## Comentários no código

Comentar o **porquê**, não o **o quê**:

```typescript
// ✅ útil — explica uma decisão não óbvia
// Usamos cuid() ao invés de uuid() por ser mais curto e URL-friendly
const id = cuid()

// ❌ inútil — o código já diz isso
// Busca o cliente pelo id
const customer = await customerRepository.findById(tenantId, id)
```
