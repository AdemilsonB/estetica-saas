# Anamnese Digital no Agendamento — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrar anamnese capilar estruturada no fluxo de agendamento público — o cliente preenche durante o booking, o profissional revisa com sugestão de ajuste de preço ao confirmar o atendimento.

**Architecture:** Reescrever `CustomerAnamnese` (1 ficha por cliente, blocos tipados em JSON extensíveis por tipo de procedimento). Bloco capilar é o único no MVP, estrutura preparada para facial/corporal/unhas. `Service` recebe config de anamnese. `Appointment` recebe `anamneseId` opcional. Profissional vê resumo + sugestão de preço na tela de confirmação — fluxo de notificação WhatsApp existente segue após confirmar.

**Tech Stack:** Prisma, Next.js 15 App Router, Zod, Shadcn UI, Supabase Storage, Vitest + vitest-mock-extended

---

## Decisões arquiteturais (resultado do onboarding)

| Decisão | Escolha |
|---|---|
| Model de anamnese | Reescrever `CustomerAnamnese` (1 por cliente, blocos JSON tipados) |
| AnamneseTemplate | **Removido** — substituído por config por serviço |
| Blocos MVP | Capilar (5 sub-seções) — estrutura extensível para futuros tipos |
| Estimativa para o cliente | **Não exibida** — mensagem: "O profissional confirmará o valor" |
| Estimativa para o profissional | Sugestão automática com multiplicadores **fixos no código** |
| Multiplicadores configuráveis | **Fora do escopo** — v2 |
| Dados existentes | Migration destrutiva — `CustomerAnamnese.data` genérico é descartado |

---

## Mapa de arquivos

### Criar
| Arquivo | Responsabilidade |
|---|---|
| `src/domains/crm/anamnese-blocks.types.ts` | Tipos TypeScript dos blocos (capilar + extensão futura) |
| `src/domains/crm/anamnese-blocks.types.test.ts` | Testes dos schemas Zod |
| `src/domains/crm/price-suggestion.ts` | Motor de sugestão de preço (multiplicadores fixos) |
| `src/domains/crm/price-suggestion.test.ts` | Testes do motor de sugestão |
| `src/app/api/public/[slug]/anamnese/check/route.ts` | GET — verifica ficha existente por telefone |
| `src/app/api/public/[slug]/anamnese/route.ts` | POST — submete/atualiza ficha no booking |
| `src/app/api/public/[slug]/anamnese/upload/route.ts` | POST — upload de foto (Supabase Storage) |
| `src/app/api/scheduling/appointments/[id]/anamnese/route.ts` | GET — profissional lê ficha ao confirmar |
| `src/components/domain/booking/anamnese-step.tsx` | Orquestrador: check → reaproveitamento → blocos → confirmação |
| `src/components/domain/booking/anamnese-blocks/capilar-form.tsx` | Formulário capilar (5 sub-seções, 1 por tela) |
| `src/components/domain/booking/anamnese-reuse-screen.tsx` | Tela de reaproveitamento de ficha existente |
| `src/components/domain/services/service-anamnese-config.tsx` | Config de anamnese por serviço (modo + tipo de bloco) |
| `src/components/domain/scheduling/appointment-anamnese-panel.tsx` | Painel no profissional: resumo + sugestão de preço |

### Modificar
| Arquivo | O que muda |
|---|---|
| `prisma/schema.prisma` | Reescrever `CustomerAnamnese`; remover `AnamneseTemplate`; adicionar campos em `Service`; adicionar `anamneseId` em `Appointment` |
| `src/domains/crm/customer-anamnese.repository.ts` | Reescrever para blocos tipados |
| `src/domains/crm/anamnese.service.ts` | Reescrever — novos métodos, sem referência a Template |
| `src/domains/crm/types.ts` | Remover tipos do template genérico; adicionar tipos de bloco |
| `src/domains/scheduling/types.ts` | Adicionar `anamneseMode`, `anamneseBlocks`, `anamneseValidityDays` ao `updateServiceSchema` |
| `src/domains/scheduling/public-booking.repository.ts` | Incluir campos de anamnese em `findPublicServices` |
| `src/hooks/scheduling/use-services.ts` | Expandir tipo `Service` e `UpdateServiceInput` |
| `src/app/(public)/agendar/[slug]/types.ts` | Expandir `PublicService`, `BookingState`, adicionar step `anamnese` |
| `src/app/(public)/agendar/[slug]/booking-client.tsx` | Injetar step `anamnese` no wizard |
| `src/components/domain/services/service-form-modal.tsx` | Adicionar seção de config de anamnese |
| `src/app/api/public/[slug]/appointments/route.ts` | Aceitar `anamneseId` + linkar ao appointment + ao customer |

---

## Task 1: Schema Prisma — Reescrever CustomerAnamnese

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Remover model AnamneseTemplate**

Em `prisma/schema.prisma`, deletar completamente o bloco:

```prisma
model AnamneseTemplate {
  id          String   @id @default(cuid())
  tenantId    String   @unique
  fields      Json
  linkMessage String?
  updatedAt   DateTime @updatedAt
  tenant      Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
}
```

E na relação do `Tenant`, remover a linha:
```prisma
  anamneseTemplate    AnamneseTemplate?
```

- [ ] **Step 2: Adicionar enum AnamneseMode antes do enum PriceType**

```prisma
enum AnamneseMode {
  NONE
  OPTIONAL
  REQUIRED
}
```

- [ ] **Step 3: Adicionar campos ao model Service**

No model `Service`, após `description String?`:

```prisma
  anamneseMode         AnamneseMode @default(NONE)
  anamneseBlocks       String[]     @default([])
  anamneseValidityDays Int          @default(90)
```

> `anamneseBlocks` é um array de tipo de bloco habilitado (ex: `["capilar"]`). Vazio = todos os tipos habilitados quando mode != NONE (na v1 sempre será `["capilar"]`).

- [ ] **Step 4: Reescrever model CustomerAnamnese**

Substituir o bloco inteiro do model atual por:

```prisma
model CustomerAnamnese {
  id          String    @id @default(cuid())
  tenantId    String
  customerId  String    @unique
  blocks      Json      @default("{}")
  blockTypes  String[]  @default([])
  version     Int       @default(1)
  history     Json      @default("[]")
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  customer     Customer      @relation(fields: [customerId], references: [id], onDelete: Cascade)
  tenant       Tenant        @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  appointments Appointment[] @relation("AppointmentAnamnese")

  @@index([tenantId])
}
```

> `blocks`: `{ "capilar": { comprimento, tipoFio, historico, cuidados, photoUrls, objetivo } }` — só chaves preenchidas existem no JSON.
> `blockTypes`: `["capilar"]` — quais tipos têm dados preenchidos.
> `history`: array de snapshots `{ version, blocks, savedAt }`, limitado a 10 entradas.

- [ ] **Step 5: Adicionar anamneseId em Appointment**

No model `Appointment`, após `stockMovements StockMovement[]`:

```prisma
  anamneseId  String?
  anamnese    CustomerAnamnese? @relation("AppointmentAnamnese", fields: [anamneseId], references: [id], onDelete: SetNull)
```

- [ ] **Step 6: Remover relações obsoletas do Tenant e Customer**

No model `Tenant`, remover (se existir):
```prisma
  anamneseTemplate    AnamneseTemplate?
```

No model `Customer`, a relação `anamnese CustomerAnamnese?` já existe e permanece. Verificar se `@unique` está no `customerId` do novo model (está no Step 4).

- [ ] **Step 7: Gerar migration**

```bash
npx prisma migrate dev --name rewrite_customer_anamnese_typed_blocks
```

Esperado: migration criada. **Atenção**: a migration vai dropar colunas antigas do `CustomerAnamnese` (`data`, `publicToken`, `filledAt`, `filledBy`) e a tabela `AnamneseTemplate`. Dados existentes serão perdidos — isso é intencional conforme decisão do onboarding.

- [ ] **Step 8: Verificar TypeScript**

```bash
npx tsc --noEmit
```

Esperado: erros nos arquivos que referenciam o modelo antigo (anamnese.service.ts, repositories, rotas). Esses erros serão corrigidos nas tasks seguintes.

- [ ] **Step 9: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(db): reescrever CustomerAnamnese com blocos tipados e remover AnamneseTemplate"
```

---

## Task 2: Tipos e Schemas Zod dos Blocos

**Files:**
- Create: `src/domains/crm/anamnese-blocks.types.ts`
- Create: `src/domains/crm/anamnese-blocks.types.test.ts`

- [ ] **Step 1: Escrever o teste dos schemas**

```typescript
// src/domains/crm/anamnese-blocks.types.test.ts
import { describe, it, expect } from 'vitest'
import { capilarBlockSchema, anamneseBlocksSchema } from './anamnese-blocks.types'

describe('capilarBlockSchema', () => {
  it('aceita bloco capilar válido', () => {
    const result = capilarBlockSchema.safeParse({
      comprimento: 'ombro',
      tipoFio: 'cacheado',
      coloracao: { feito: true, quando: 'menos_30_dias' },
      objetivos: ['hidratar'],
    })
    expect(result.success).toBe(true)
  })

  it('aceita bloco capilar vazio', () => {
    const result = capilarBlockSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('rejeita valor inválido de comprimento', () => {
    const result = capilarBlockSchema.safeParse({ comprimento: 'joelho' })
    expect(result.success).toBe(false)
  })
})

describe('anamneseBlocksSchema', () => {
  it('aceita objeto com bloco capilar', () => {
    const result = anamneseBlocksSchema.safeParse({
      capilar: { comprimento: 'cintura', tipoFio: 'liso' },
    })
    expect(result.success).toBe(true)
  })

  it('aceita objeto vazio (nenhum bloco preenchido)', () => {
    const result = anamneseBlocksSchema.safeParse({})
    expect(result.success).toBe(true)
  })
})
```

- [ ] **Step 2: Executar o teste (deve falhar)**

```bash
npx vitest run src/domains/crm/anamnese-blocks.types.test.ts
```

Esperado: FAIL — "Cannot find module './anamnese-blocks.types'"

- [ ] **Step 3: Criar o arquivo de tipos**

```typescript
// src/domains/crm/anamnese-blocks.types.ts
import { z } from 'zod'

const quandoSchema = z.enum(['menos_30_dias', '30_90_dias', '3_6_meses', 'mais_6_meses'])
const quimicaItemSchema = z.object({
  feito: z.boolean(),
  quando: quandoSchema.optional(),
})

export const capilarBlockSchema = z.object({
  // Sub-seção A: Comprimento e estrutura
  comprimento: z.enum(['nuca', 'ombro', 'meio_costas', 'cintura', 'mais_cintura']).optional(),
  tipoFio: z.enum(['liso', 'ondulado', 'cacheado', 'crespo']).optional(),
  espessura: z.enum(['fino', 'medio', 'grosso']).optional(),
  // Sub-seção B: Histórico químico
  coloracao: quimicaItemSchema.optional(),
  descoloracao: quimicaItemSchema.optional(),
  progressiva: quimicaItemSchema.optional(),
  botox: quimicaItemSchema.optional(),
  outroQuimico: z.string().max(100).optional(),
  // Sub-seção C: Cuidados atuais
  produtos: z.array(z.string().max(100)).max(10).default([]),
  frequenciaLavagem: z.enum(['diario', '2_3_semana', '1_semana', 'menos_semana']).optional(),
  usoTermico: z.enum(['nunca', 'raramente', '2_3_semana', 'diario']).optional(),
  // Sub-seção D: Fotos
  photoUrls: z.array(z.string().url()).max(3).default([]),
  // Sub-seção E: Objetivo
  objetivos: z.array(z.enum(['mudar_cor', 'hidratar', 'alisar', 'manutencao', 'corte', 'outro'])).default([]),
  descricaoLivre: z.string().max(500).optional(),
})
export type CapilarBlock = z.infer<typeof capilarBlockSchema>

// Estrutura extensível: adicionar novos tipos de bloco aqui no futuro
export const anamneseBlocksSchema = z.object({
  capilar: capilarBlockSchema.optional(),
  // facial: facialBlockSchema.optional(),  ← exemplo de extensão futura
})
export type AnamneseBlocks = z.infer<typeof anamneseBlocksSchema>

export type AnamneseBlockType = keyof AnamneseBlocks

export type AnamneseHistoryEntry = {
  version: number
  blocks: AnamneseBlocks
  savedAt: string
}

// Schema para submissão pública (booking)
export const submitAnamneseSchema = z.object({
  phone: z.string().min(8).max(30),
  blockType: z.literal('capilar'),
  data: capilarBlockSchema,
})
export type SubmitAnamneseInput = z.infer<typeof submitAnamneseSchema>

// Schema para atualização pelo profissional
export const saveAnamneseProfessionalSchema = z.object({
  blockType: z.enum(['capilar']),
  data: capilarBlockSchema,
})
export type SaveAnamneseProfessionalInput = z.infer<typeof saveAnamneseProfessionalSchema>
```

- [ ] **Step 4: Executar o teste (deve passar)**

```bash
npx vitest run src/domains/crm/anamnese-blocks.types.test.ts
```

Esperado: PASS 5/5

- [ ] **Step 5: Commit**

```bash
git add src/domains/crm/anamnese-blocks.types.ts src/domains/crm/anamnese-blocks.types.test.ts
git commit -m "feat(crm): tipos e schemas Zod para blocos de anamnese (capilar MVP, extensível)"
```

---

## Task 3: Motor de Sugestão de Preço

**Files:**
- Create: `src/domains/crm/price-suggestion.ts`
- Create: `src/domains/crm/price-suggestion.test.ts`

- [ ] **Step 1: Escrever os testes**

```typescript
// src/domains/crm/price-suggestion.test.ts
import { describe, it, expect } from 'vitest'
import { calcularSugestaoPreco, type SugestaoPreco } from './price-suggestion'
import type { CapilarBlock } from './anamnese-blocks.types'

describe('calcularSugestaoPreco', () => {
  it('retorna null quando não há bloco capilar', () => {
    const result = calcularSugestaoPreco(100, {})
    expect(result).toBeNull()
  })

  it('retorna null quando comprimento não informado', () => {
    const result = calcularSugestaoPreco(100, { capilar: { produtos: [], photoUrls: [], objetivos: [] } })
    expect(result).toBeNull()
  })

  it('sugere acréscimo para cabelo longo (cintura)', () => {
    const capilar: CapilarBlock = {
      comprimento: 'cintura',
      produtos: [], photoUrls: [], objetivos: [],
    }
    const result = calcularSugestaoPreco(100, { capilar }) as SugestaoPreco
    expect(result).not.toBeNull()
    expect(result.valorSugerido).toBeGreaterThan(100)
    expect(result.ajustes).toHaveLength(1)
    expect(result.ajustes[0]!.motivo).toContain('Comprimento')
  })

  it('sugere acréscimo adicional para química recente', () => {
    const capilar: CapilarBlock = {
      comprimento: 'ombro',
      coloracao: { feito: true, quando: 'menos_30_dias' },
      produtos: [], photoUrls: [], objetivos: [],
    }
    const result = calcularSugestaoPreco(100, { capilar }) as SugestaoPreco
    expect(result.ajustes.length).toBeGreaterThanOrEqual(2)
    expect(result.ajustes.some(a => a.motivo.includes('química'))).toBe(true)
  })

  it('não sugere acréscimo para nuca (comprimento curto)', () => {
    const capilar: CapilarBlock = {
      comprimento: 'nuca',
      produtos: [], photoUrls: [], objetivos: [],
    }
    const result = calcularSugestaoPreco(100, { capilar })
    // nuca = sem acréscimo, retorna sugestão com valor igual ao base
    expect(result?.valorSugerido).toBe(100)
    expect(result?.ajustes).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Executar o teste (deve falhar)**

```bash
npx vitest run src/domains/crm/price-suggestion.test.ts
```

Esperado: FAIL — "Cannot find module './price-suggestion'"

- [ ] **Step 3: Implementar o motor**

```typescript
// src/domains/crm/price-suggestion.ts
import type { AnamneseBlocks, CapilarBlock } from './anamnese-blocks.types'

export type AjustePreco = {
  motivo: string
  valorAdicional: number
}

export type SugestaoPreco = {
  valorBase: number
  valorSugerido: number
  ajustes: AjustePreco[]
}

const COMPRIMENTO_ACRESCIMO: Record<string, number> = {
  nuca:         0,
  ombro:        0,
  meio_costas:  0.15,
  cintura:      0.30,
  mais_cintura: 0.50,
}

const COMPRIMENTO_LABEL: Record<string, string> = {
  meio_costas:  'Comprimento médio (meio das costas)',
  cintura:      'Comprimento longo (cintura)',
  mais_cintura: 'Comprimento muito longo (além da cintura)',
}

function temQuimicaRecente(capilar: CapilarBlock): boolean {
  const campos = [capilar.coloracao, capilar.descoloracao, capilar.progressiva, capilar.botox]
  return campos.some((c) => c?.feito && c.quando === 'menos_30_dias')
}

export function calcularSugestaoPreco(
  valorBase: number,
  blocks: AnamneseBlocks,
): SugestaoPreco | null {
  const capilar = blocks.capilar
  if (!capilar?.comprimento) return null

  const ajustes: AjustePreco[] = []
  let valorSugerido = valorBase

  const pctComprimento = COMPRIMENTO_ACRESCIMO[capilar.comprimento] ?? 0
  if (pctComprimento > 0) {
    const valor = Math.round(valorBase * pctComprimento)
    ajustes.push({ motivo: COMPRIMENTO_LABEL[capilar.comprimento]!, valorAdicional: valor })
    valorSugerido += valor
  }

  if (temQuimicaRecente(capilar)) {
    const valor = Math.round(valorBase * 0.15)
    ajustes.push({ motivo: 'Química recente (< 30 dias) — risco de ressecamento', valorAdicional: valor })
    valorSugerido += valor
  }

  return { valorBase, valorSugerido, ajustes }
}
```

- [ ] **Step 4: Executar o teste (deve passar)**

```bash
npx vitest run src/domains/crm/price-suggestion.test.ts
```

Esperado: PASS 5/5

- [ ] **Step 5: Commit**

```bash
git add src/domains/crm/price-suggestion.ts src/domains/crm/price-suggestion.test.ts
git commit -m "feat(crm): motor de sugestão de preço baseado em anamnese capilar"
```

---

## Task 4: Reescrever Repository e Service de Anamnese

**Files:**
- Modify: `src/domains/crm/customer-anamnese.repository.ts`
- Modify: `src/domains/crm/anamnese.service.ts`

- [ ] **Step 1: Reescrever o repository**

```typescript
// src/domains/crm/customer-anamnese.repository.ts
import { prisma } from '@/shared/database/prisma'
import type { AnamneseBlocks, AnamneseHistoryEntry } from './anamnese-blocks.types'

const MAX_HISTORY = 10

export class CustomerAnamneseRepository {
  async findByCustomer(tenantId: string, customerId: string) {
    return prisma.customerAnamnese.findFirst({
      where: { tenantId, customerId },
    })
  }

  async findByTenantAndId(tenantId: string, id: string) {
    return prisma.customerAnamnese.findFirst({
      where: { tenantId, id },
    })
  }

  async upsert(
    tenantId: string,
    customerId: string,
    blockType: string,
    newBlockData: unknown,
  ) {
    const existing = await this.findByCustomer(tenantId, customerId)

    const now = new Date().toISOString()

    if (!existing) {
      const blocks = { [blockType]: newBlockData } as AnamneseBlocks
      return prisma.customerAnamnese.create({
        data: {
          tenantId,
          customerId,
          blocks,
          blockTypes: [blockType],
          version: 1,
          history: [{ version: 1, blocks, savedAt: now }] as AnamneseHistoryEntry[],
        },
      })
    }

    const currentBlocks = (existing.blocks as AnamneseBlocks) ?? {}
    const updatedBlocks = { ...currentBlocks, [blockType]: newBlockData }
    const newVersion = existing.version + 1

    const currentHistory = (existing.history as AnamneseHistoryEntry[]) ?? []
    const snapshot: AnamneseHistoryEntry = {
      version: newVersion,
      blocks: updatedBlocks,
      savedAt: now,
    }
    const updatedHistory = [...currentHistory, snapshot].slice(-MAX_HISTORY)

    const blockTypes = Array.from(new Set([...existing.blockTypes, blockType]))

    return prisma.customerAnamnese.update({
      where: { id: existing.id },
      data: {
        blocks: updatedBlocks,
        blockTypes,
        version: newVersion,
        history: updatedHistory,
      },
    })
  }
}

export const customerAnamneseRepository = new CustomerAnamneseRepository()
```

- [ ] **Step 2: Reescrever o service**

```typescript
// src/domains/crm/anamnese.service.ts
import { customerAnamneseRepository } from './customer-anamnese.repository'
import { customerRepository } from './customer.repository'
import { anamneseBlocksSchema, submitAnamneseSchema } from './anamnese-blocks.types'
import type { AnamneseBlocks, SubmitAnamneseInput } from './anamnese-blocks.types'
import { ValidationError, NotFoundError } from '@/shared/errors/domain-error'

const VALIDITY_DAYS_DEFAULT = 90

export class AnamneseService {
  async checkExisting(tenantId: string, phone: string, validityDays = VALIDITY_DAYS_DEFAULT) {
    const customer = await customerRepository.findByPhone(tenantId, phone)
    if (!customer) return null

    const anamnese = await customerAnamneseRepository.findByCustomer(tenantId, customer.id)
    if (!anamnese) return null

    const ageDays = Math.floor(
      (Date.now() - anamnese.updatedAt.getTime()) / (1000 * 60 * 60 * 24),
    )
    const blocks = anamnese.blocks as AnamneseBlocks
    const capilar = blocks.capilar

    return {
      anamneseId: anamnese.id,
      customerId: customer.id,
      isValid: ageDays <= validityDays,
      ageDays,
      summary: {
        comprimento: capilar?.comprimento,
        tipoFio: capilar?.tipoFio,
        objetivos: capilar?.objetivos,
        temQuimicaRecente:
          [capilar?.coloracao, capilar?.descoloracao, capilar?.progressiva, capilar?.botox]
            .some((c) => c?.feito && c.quando === 'menos_30_dias') ?? false,
      },
    }
  }

  async submitFromBooking(tenantId: string, customerId: string, input: SubmitAnamneseInput) {
    const parsed = submitAnamneseSchema.safeParse(input)
    if (!parsed.success) {
      throw new ValidationError('Dados da anamnese inválidos.', parsed.error.flatten().fieldErrors)
    }
    return customerAnamneseRepository.upsert(tenantId, customerId, parsed.data.blockType, parsed.data.data)
  }

  async saveByProfessional(tenantId: string, customerId: string, blockType: string, data: unknown) {
    const customer = await customerRepository.findById(tenantId, customerId)
    if (!customer) throw new NotFoundError('Cliente')

    const parsed = anamneseBlocksSchema.safeParse({ [blockType]: data })
    if (!parsed.success) {
      throw new ValidationError('Dados da anamnese inválidos.', parsed.error.flatten().fieldErrors)
    }

    return customerAnamneseRepository.upsert(tenantId, customerId, blockType, data)
  }

  async getByCustomer(tenantId: string, customerId: string) {
    return customerAnamneseRepository.findByCustomer(tenantId, customerId)
  }

  async getByAppointment(tenantId: string, appointmentId: string) {
    const { prisma } = await import('@/shared/database/prisma')
    const apt = await prisma.appointment.findFirst({
      where: { id: appointmentId, tenantId },
      select: { anamneseId: true, price: true },
    })
    if (!apt?.anamneseId) return null

    const anamnese = await customerAnamneseRepository.findByTenantAndId(tenantId, apt.anamneseId)
    return anamnese ? { anamnese, appointmentPrice: Number(apt.price) } : null
  }
}

export const anamneseService = new AnamneseService()
```

- [ ] **Step 3: Atualizar `src/domains/crm/types.ts`**

Remover as exportações do modelo genérico que não existem mais:
- `FieldType`, `FieldSection`, `FieldDef`, `AnamneseData`, `AnamneseHistorySnapshot`
- `DEFAULT_ANAMNESE_FIELDS`, `DEFAULT_LINK_MESSAGE`
- `fieldDefSchema`, `updateAnamneseTemplateSchema`, `saveAnamneseSchema`, `sendAnamnaseLinkSchema`, `submitPublicAnamneseSchema`
- Seus types exportados

Manter: `listCustomersSchema`, `createCustomerSchema`, `updateCustomerSchema` e seus types.

- [ ] **Step 4: Verificar TypeScript**

```bash
npx tsc --noEmit
```

Erros esperados neste ponto: nos arquivos de API que referenciam o modelo antigo (serão corrigidos nas tasks seguintes). Verificar que os erros são apenas nesses arquivos, não nos novos.

- [ ] **Step 5: Commit**

```bash
git add src/domains/crm/
git commit -m "feat(crm): reescrever repository e service de anamnese para blocos tipados"
```

---

## Task 5: Corrigir APIs Existentes de Anamnese

**Files:**
- Modify: `src/app/api/crm/anamnese/template/route.ts` → **deletar**
- Modify: `src/app/api/crm/customers/[customerId]/anamnese/route.ts` → reescrever
- Modify: `src/app/api/crm/customers/[customerId]/anamnese/send-link/route.ts` → **deletar**
- Modify: `src/app/api/anamnese/[publicToken]/route.ts` → **deletar**

- [ ] **Step 1: Deletar rotas do modelo antigo**

```bash
rm src/app/api/crm/anamnese/template/route.ts
rm src/app/api/crm/customers/[customerId]/anamnese/send-link/route.ts
rm src/app/api/anamnese/[publicToken]/route.ts
```

Se os diretórios ficarem vazios, remover também:
```bash
rmdir src/app/api/crm/anamnese 2>/dev/null || true
rmdir src/app/api/anamnese 2>/dev/null || true
```

- [ ] **Step 2: Reescrever GET/PUT da anamnese do cliente (profissional)**

```typescript
// src/app/api/crm/customers/[customerId]/anamnese/route.ts
import { getSessionContext } from '@/shared/auth/session'
import { ensurePermission, PERMISSIONS } from '@/shared/auth/permissions'
import { handleApiError } from '@/shared/http/handle-api-error'
import { validateInput } from '@/shared/http/validate-input'
import { anamneseService } from '@/domains/crm/anamnese.service'
import { saveAnamneseProfessionalSchema } from '@/domains/crm/anamnese-blocks.types'
import { initializeDomainRuntime } from '@/app/api/_lib/runtime'

type RouteContext = { params: Promise<{ customerId: string }> }

export async function GET(req: Request, { params }: RouteContext) {
  initializeDomainRuntime()
  try {
    const session = await getSessionContext(req)
    ensurePermission(session, PERMISSIONS.customers.view)
    const { customerId } = await params
    const anamnese = await anamneseService.getByCustomer(session.tenantId, customerId)
    return Response.json(anamnese)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PUT(req: Request, { params }: RouteContext) {
  initializeDomainRuntime()
  try {
    const session = await getSessionContext(req)
    ensurePermission(session, PERMISSIONS.customers.edit)
    const { customerId } = await params
    const input = await validateInput(req, saveAnamneseProfessionalSchema)
    const anamnese = await anamneseService.saveByProfessional(
      session.tenantId,
      customerId,
      input.blockType,
      input.data,
    )
    return Response.json(anamnese)
  } catch (error) {
    return handleApiError(error)
  }
}
```

- [ ] **Step 3: Verificar TypeScript**

```bash
npx tsc --noEmit
```

Esperado: redução significativa de erros. Erros restantes serão nos hooks de UI que usam o modelo antigo.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/crm/
git commit -m "feat(crm): remover APIs do modelo antigo de anamnese e reescrever endpoint de profissional"
```

---

## Task 6: APIs Públicas de Anamnese no Booking

**Files:**
- Create: `src/app/api/public/[slug]/anamnese/check/route.ts`
- Create: `src/app/api/public/[slug]/anamnese/route.ts`
- Create: `src/app/api/public/[slug]/anamnese/upload/route.ts`
- Create: `src/app/api/scheduling/appointments/[id]/anamnese/route.ts`

- [ ] **Step 1: Criar endpoint GET check por telefone**

```typescript
// src/app/api/public/[slug]/anamnese/check/route.ts
import { publicBookingRepository } from '@/domains/scheduling/public-booking.repository'
import { anamneseService } from '@/domains/crm/anamnese.service'
import { handleApiError } from '@/shared/http/handle-api-error'
import { prisma } from '@/shared/database/prisma'

export async function GET(
  req: Request,
  context: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await context.params
    const url = new URL(req.url)
    const phone = url.searchParams.get('phone')
    const serviceId = url.searchParams.get('serviceId')

    if (!phone) {
      return Response.json({ error: 'phone é obrigatório' }, { status: 400 })
    }

    const tenant = await publicBookingRepository.findTenantBySlug(slug)

    let validityDays = 90
    if (serviceId) {
      const svc = await prisma.service.findFirst({
        where: { id: serviceId, tenantId: tenant.id, active: true },
        select: { anamneseValidityDays: true },
      })
      if (svc) validityDays = svc.anamneseValidityDays
    }

    const result = await anamneseService.checkExisting(tenant.id, phone, validityDays)

    return Response.json(
      result ?? { anamneseId: null, customerId: null, isValid: false, ageDays: 0, summary: null },
    )
  } catch (error) {
    return handleApiError(error)
  }
}
```

- [ ] **Step 2: Criar endpoint POST de submissão**

```typescript
// src/app/api/public/[slug]/anamnese/route.ts
import { publicBookingRepository } from '@/domains/scheduling/public-booking.repository'
import { anamneseService } from '@/domains/crm/anamnese.service'
import { submitAnamneseSchema } from '@/domains/crm/anamnese-blocks.types'
import { customerRepository } from '@/domains/crm/customer.repository'
import { handleApiError } from '@/shared/http/handle-api-error'

export async function POST(
  req: Request,
  context: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await context.params
    const tenant = await publicBookingRepository.findTenantBySlug(slug)

    const body = await req.json()
    const parsed = submitAnamneseSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json(
        { error: { code: 'VALIDATION_ERROR', details: parsed.error.flatten().fieldErrors } },
        { status: 422 },
      )
    }

    // Encontrar ou criar o customer pelo telefone para associar a anamnese
    const customer = await customerRepository.findOrCreateByPhone(
      tenant.id,
      parsed.data.phone,
      'Cliente', // nome temporário — será atualizado ao confirmar o agendamento
    )

    const anamnese = await anamneseService.submitFromBooking(tenant.id, customer.id, parsed.data)

    return Response.json({ anamneseId: anamnese.id, customerId: customer.id }, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
```

- [ ] **Step 3: Criar endpoint de upload de foto**

Bucket `anamnese-photos` deve ser criado manualmente no Supabase (público, JPEG/PNG/WebP, máx 5 MB).

```typescript
// src/app/api/public/[slug]/anamnese/upload/route.ts
import { publicBookingRepository } from '@/domains/scheduling/public-booking.repository'
import { supabaseAdmin } from '@/integrations/supabase/admin'
import { handleApiError } from '@/shared/http/handle-api-error'

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const MAX_SIZE = 5 * 1024 * 1024

export async function POST(
  req: Request,
  context: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await context.params
    const tenant = await publicBookingRepository.findTenantBySlug(slug)

    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) return Response.json({ error: 'Arquivo não informado' }, { status: 400 })
    if (!ALLOWED_TYPES.has(file.type)) {
      return Response.json({ error: 'Use JPEG, PNG ou WebP.' }, { status: 400 })
    }
    if (file.size > MAX_SIZE) {
      return Response.json({ error: 'Arquivo excede 5 MB.' }, { status: 400 })
    }

    const ext = file.name.split('.').pop() ?? 'jpg'
    const path = `${tenant.id}/${Date.now()}.${ext}`
    const bytes = await file.arrayBuffer()

    const { error } = await supabaseAdmin.storage
      .from('anamnese-photos')
      .upload(path, bytes, { contentType: file.type, upsert: false })

    if (error) {
      return Response.json({ error: 'Falha no upload.' }, { status: 500 })
    }

    const { data: { publicUrl } } = supabaseAdmin.storage
      .from('anamnese-photos')
      .getPublicUrl(path)

    return Response.json({ url: publicUrl })
  } catch (error) {
    return handleApiError(error)
  }
}
```

- [ ] **Step 4: Criar endpoint GET para o profissional (confirmação de agendamento)**

```typescript
// src/app/api/scheduling/appointments/[id]/anamnese/route.ts
import { getSessionContext } from '@/shared/auth/session'
import { ensurePermission, PERMISSIONS } from '@/shared/auth/permissions'
import { handleApiError } from '@/shared/http/handle-api-error'
import { anamneseService } from '@/domains/crm/anamnese.service'
import { calcularSugestaoPreco } from '@/domains/crm/price-suggestion'
import { initializeDomainRuntime } from '@/app/api/_lib/runtime'
import type { AnamneseBlocks } from '@/domains/crm/anamnese-blocks.types'

export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  initializeDomainRuntime()
  try {
    const session = await getSessionContext(req)
    ensurePermission(session, PERMISSIONS.appointments.view)
    const { id } = await context.params

    const result = await anamneseService.getByAppointment(session.tenantId, id)
    if (!result) return Response.json(null)

    const blocks = result.anamnese.blocks as AnamneseBlocks
    const sugestao = calcularSugestaoPreco(result.appointmentPrice, blocks)

    return Response.json({ anamnese: result.anamnese, sugestaoPreco: sugestao })
  } catch (error) {
    return handleApiError(error)
  }
}
```

- [ ] **Step 5: Verificar TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add src/app/api/public/ src/app/api/scheduling/appointments/
git commit -m "feat(api): endpoints públicos e protegidos para anamnese no booking"
```

---

## Task 7: Atualizar Service Management e Public Booking

**Files:**
- Modify: `src/domains/scheduling/types.ts`
- Modify: `src/domains/scheduling/public-booking.repository.ts`
- Modify: `src/hooks/scheduling/use-services.ts`

- [ ] **Step 1: Adicionar campos ao updateServiceSchema**

Em `src/domains/scheduling/types.ts`, adicionar ao `updateServiceSchema`:

```typescript
  anamneseMode: z.enum(['NONE', 'OPTIONAL', 'REQUIRED']).optional(),
  anamneseBlocks: z.array(z.string().min(1)).optional(),
  anamneseValidityDays: z.number().int().min(7).max(365).optional(),
```

- [ ] **Step 2: Incluir campos de anamnese em findPublicServices**

Em `src/domains/scheduling/public-booking.repository.ts`, no `select` de `findPublicServices`:

```typescript
  anamneseMode: true,
  anamneseBlocks: true,
  anamneseValidityDays: true,
```

E no retorno do map, garantir que `anamneseBlocks` é tipado como `string[]`:

```typescript
return services.map(({ category, ...rest }) => ({
  ...rest,
  anamneseBlocks: rest.anamneseBlocks as string[],
  categoryName: category?.name ?? null,
}))
```

- [ ] **Step 3: Expandir tipos no hook de serviços**

Em `src/hooks/scheduling/use-services.ts`, adicionar ao tipo `Service`:

```typescript
  anamneseMode: 'NONE' | 'OPTIONAL' | 'REQUIRED'
  anamneseBlocks: string[]
  anamneseValidityDays: number
```

E ao tipo `UpdateServiceInput`:

```typescript
  anamneseMode?: 'NONE' | 'OPTIONAL' | 'REQUIRED'
  anamneseBlocks?: string[]
  anamneseValidityDays?: number
```

- [ ] **Step 4: Expandir types do booking público**

Em `src/app/(public)/agendar/[slug]/types.ts`:

```typescript
// Adicionar ao PublicService:
  anamneseMode: 'NONE' | 'OPTIONAL' | 'REQUIRED'
  anamneseBlocks: string[]
  anamneseValidityDays: number

// Adicionar ao BookingState:
  serviceAnamneseMode?: 'NONE' | 'OPTIONAL' | 'REQUIRED'
  serviceAnamneseBlocks?: string[]
  serviceAnamneseValidityDays?: number
  servicePriceNumber?: number
  anamneseId?: string

// Adicionar 'anamnese' ao BookingStep:
export type BookingStep =
  | 'service'
  | 'professional'
  | 'datetime'
  | 'personal'
  | 'anamnese'
  | 'confirmation'
  | 'success'
```

- [ ] **Step 5: Verificar TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add src/domains/scheduling/ src/hooks/scheduling/ src/app/\(public\)/
git commit -m "feat(scheduling): incluir config de anamnese nos serviços públicos e tipos"
```

---

## Task 8: Configuração de Anamnese no Formulário de Serviço

**Files:**
- Create: `src/components/domain/services/service-anamnese-config.tsx`
- Modify: `src/components/domain/services/service-form-modal.tsx`

- [ ] **Step 1: Criar componente ServiceAnamneseConfig**

```tsx
// src/components/domain/services/service-anamnese-config.tsx
'use client'

import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Input } from '@/components/ui/input'

type AnamneseMode = 'NONE' | 'OPTIONAL' | 'REQUIRED'

type Props = {
  mode: AnamneseMode
  validityDays: number
  onModeChange: (mode: AnamneseMode) => void
  onValidityDaysChange: (days: number) => void
}

const MODOS = [
  { value: 'NONE',     label: 'Não solicitar' },
  { value: 'OPTIONAL', label: 'Opcional — cliente pode pular' },
  { value: 'REQUIRED', label: 'Obrigatória — exigida para avançar' },
] as const

export function ServiceAnamneseConfig({ mode, validityDays, onModeChange, onValidityDaysChange }: Props) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label className="text-sm font-medium">Anamnese no agendamento</Label>
        <RadioGroup value={mode} onValueChange={(v) => onModeChange(v as AnamneseMode)}>
          {MODOS.map(({ value, label }) => (
            <div key={value} className="flex items-center space-x-2">
              <RadioGroupItem value={value} id={`anamnese-${value}`} />
              <Label htmlFor={`anamnese-${value}`} className="font-normal cursor-pointer text-sm">
                {label}
              </Label>
            </div>
          ))}
        </RadioGroup>
        <p className="text-xs text-muted-foreground">
          Quando ativada, será solicitada ficha capilar do cliente durante o agendamento.
        </p>
      </div>

      {mode !== 'NONE' && (
        <div className="space-y-1.5">
          <Label htmlFor="validity-days" className="text-sm font-medium">
            Validade da ficha (dias)
          </Label>
          <Input
            id="validity-days"
            type="number"
            min={7}
            max={365}
            value={validityDays}
            onChange={(e) => onValidityDaysChange(Math.max(7, Math.min(365, Number(e.target.value))))}
            className="w-28 text-sm"
          />
          <p className="text-xs text-muted-foreground">
            Após esse prazo o cliente será solicitado a atualizar a ficha.
          </p>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Integrar no ServiceFormModal**

Em `src/components/domain/services/service-form-modal.tsx`:

**a) Importar:**
```typescript
import { ServiceAnamneseConfig } from './service-anamnese-config'
```

**b) Adicionar estados (após os estados existentes):**
```typescript
const [anamneseMode, setAnamneseMode] = useState<'NONE' | 'OPTIONAL' | 'REQUIRED'>('NONE')
const [anamneseValidityDays, setAnamneseValidityDays] = useState(90)
```

**c) No useEffect de carregamento (open && service), adicionar:**
```typescript
setAnamneseMode((service as Service & { anamneseMode?: 'NONE'|'OPTIONAL'|'REQUIRED' }).anamneseMode ?? 'NONE')
setAnamneseValidityDays((service as Service & { anamneseValidityDays?: number }).anamneseValidityDays ?? 90)
```

**d) No useEffect de reset (!open), adicionar:**
```typescript
setAnamneseMode('NONE')
setAnamneseValidityDays(90)
```

**e) No payload de create/update, adicionar:**
```typescript
anamneseMode,
anamneseBlocks: anamneseMode !== 'NONE' ? ['capilar'] : [],
anamneseValidityDays,
```

**f) No JSX, antes do botão de submit, adicionar após o último Separator:**
```tsx
<Separator />
<ServiceAnamneseConfig
  mode={anamneseMode}
  validityDays={anamneseValidityDays}
  onModeChange={setAnamneseMode}
  onValidityDaysChange={setAnamneseValidityDays}
/>
```

- [ ] **Step 3: Verificar TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/components/domain/services/
git commit -m "feat(services): configuração de anamnese por serviço (modo + validade)"
```

---

## Task 9: Formulário Capilar (5 Sub-seções)

**Files:**
- Create: `src/components/domain/booking/anamnese-blocks/capilar-form.tsx`

- [ ] **Step 1: Criar o formulário capilar com navegação por sub-seções**

```tsx
// src/components/domain/booking/anamnese-blocks/capilar-form.tsx
'use client'

import { useState } from 'react'
import { ChevronLeft, Plus, X, Camera, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import type { CapilarBlock } from '@/domains/crm/anamnese-blocks.types'

type SubStep = 'comprimento' | 'historico' | 'cuidados' | 'fotos' | 'objetivo'
const SUB_STEPS: SubStep[] = ['comprimento', 'historico', 'cuidados', 'fotos', 'objetivo']

type QuandoVal = 'menos_30_dias' | '30_90_dias' | '3_6_meses' | 'mais_6_meses'
type QuimicaItem = { feito: boolean; quando?: QuandoVal }

const QUANDOS: { value: QuandoVal; label: string }[] = [
  { value: 'menos_30_dias', label: '< 30 dias' },
  { value: '30_90_dias',    label: '30–90 dias' },
  { value: '3_6_meses',     label: '3–6 meses' },
  { value: 'mais_6_meses',  label: '+ 6 meses' },
]

type Props = {
  tenantSlug: string
  initial?: CapilarBlock
  primaryColor: string
  onComplete: (data: CapilarBlock) => void
  onBack: () => void
}

export function CapilarForm({ tenantSlug, initial, primaryColor, onComplete, onBack }: Props) {
  const [subStep, setSubStep] = useState<SubStep>('comprimento')
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  // Estado consolidado do bloco capilar
  const [data, setData] = useState<CapilarBlock>({
    produtos: [],
    photoUrls: [],
    objetivos: [],
    ...initial,
  })

  const subIdx = SUB_STEPS.indexOf(subStep)
  const isFirst = subIdx === 0
  const isLast = subIdx === SUB_STEPS.length - 1

  function goNext() {
    if (isLast) {
      onComplete(data)
    } else {
      setSubStep(SUB_STEPS[subIdx + 1]!)
    }
  }

  function goPrev() {
    if (isFirst) {
      onBack()
    } else {
      setSubStep(SUB_STEPS[subIdx - 1]!)
    }
  }

  function setQuimica(key: keyof Pick<CapilarBlock, 'coloracao'|'descoloracao'|'progressiva'|'botox'>, item: QuimicaItem) {
    setData((d) => ({ ...d, [key]: item }))
  }

  function toggleObjetivo(obj: NonNullable<CapilarBlock['objetivos']>[number]) {
    setData((d) => {
      const list = d.objetivos ?? []
      return {
        ...d,
        objetivos: list.includes(obj) ? list.filter((o) => o !== obj) : [...list, obj],
      }
    })
  }

  async function uploadFoto(file: File) {
    setUploading(true)
    setUploadError(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch(`/api/public/${tenantSlug}/anamnese/upload`, { method: 'POST', body: formData })
      const json = await res.json() as { url?: string; error?: string }
      if (!res.ok || !json.url) { setUploadError(json.error ?? 'Erro no upload'); return }
      setData((d) => ({ ...d, photoUrls: [...(d.photoUrls ?? []), json.url!] }))
    } catch { setUploadError('Erro de conexão.') }
    finally { setUploading(false) }
  }

  function removePhoto(url: string) {
    setData((d) => ({ ...d, photoUrls: (d.photoUrls ?? []).filter((u) => u !== url) }))
  }

  // Estilos reutilizados
  const btnSelected = { borderColor: primaryColor, backgroundColor: `${primaryColor}18`, color: primaryColor }
  const chipBase = 'p-2.5 rounded-lg border text-sm text-left transition-colors'
  const chipIdle = 'border-slate-200 text-slate-600 hover:border-slate-300 bg-white'

  const stepTitle: Record<SubStep, string> = {
    comprimento: 'Comprimento e tipo de fio',
    historico:   'Histórico de químicas',
    cuidados:    'Cuidados em casa',
    fotos:       'Fotos do cabelo',
    objetivo:    'O que você quer?',
  }

  return (
    <div className="space-y-5">
      {/* Indicador de progresso */}
      <div className="space-y-2">
        <div className="flex gap-1">
          {SUB_STEPS.map((s, i) => (
            <div key={s} className={`h-1 flex-1 rounded-full transition-colors ${i <= subIdx ? '' : 'bg-slate-200'}`}
              style={i <= subIdx ? { backgroundColor: primaryColor } : {}} />
          ))}
        </div>
        <p className="text-xs text-slate-500">Passo {subIdx + 1} de {SUB_STEPS.length} — {stepTitle[subStep]}</p>
      </div>

      <button onClick={goPrev} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 -ml-1 py-1">
        <ChevronLeft className="size-4" />
        {isFirst ? 'Voltar' : 'Anterior'}
      </button>

      {/* Sub-seção A: Comprimento */}
      {subStep === 'comprimento' && (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Comprimento atual</h2>
            <p className="text-sm text-slate-500 mt-0.5">Como está seu cabelo hoje?</p>
          </div>
          <div className="space-y-2">
            {[
              { value: 'nuca', label: 'Nuca' },
              { value: 'ombro', label: 'Ombro' },
              { value: 'meio_costas', label: 'Meio das costas' },
              { value: 'cintura', label: 'Cintura' },
              { value: 'mais_cintura', label: 'Além da cintura' },
            ].map((opt) => (
              <button key={opt.value} onClick={() => setData((d) => ({ ...d, comprimento: opt.value as CapilarBlock['comprimento'] }))}
                className={`w-full flex items-center p-3 rounded-xl border text-left text-sm font-medium transition-colors ${data.comprimento === opt.value ? 'border-2' : 'border-slate-200 text-slate-700 hover:border-slate-300 bg-white'}`}
                style={data.comprimento === opt.value ? btnSelected : {}}>
                {opt.label}
              </button>
            ))}
          </div>
          <div>
            <p className="text-sm font-medium text-slate-700 mb-2">Tipo de fio</p>
            <div className="grid grid-cols-2 gap-2">
              {(['liso','ondulado','cacheado','crespo'] as const).map((v) => (
                <button key={v} onClick={() => setData((d) => ({ ...d, tipoFio: v }))}
                  className={`${chipBase} ${data.tipoFio === v ? 'border-2 font-medium' : chipIdle} capitalize`}
                  style={data.tipoFio === v ? { borderColor: primaryColor, color: primaryColor } : {}}>
                  {v}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Sub-seção B: Histórico */}
      {subStep === 'historico' && (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Histórico de químicas</h2>
            <p className="text-sm text-slate-500 mt-0.5">Marque o que você já fez e quando.</p>
          </div>
          {([
            { key: 'coloracao' as const, label: 'Coloração' },
            { key: 'descoloracao' as const, label: 'Descoloração / luzes' },
            { key: 'progressiva' as const, label: 'Progressiva / alisamento' },
            { key: 'botox' as const, label: 'Botox / selagem' },
          ]).map(({ key, label }) => {
            const item: QuimicaItem = (data[key] as QuimicaItem | undefined) ?? { feito: false }
            return (
              <div key={key} className="space-y-2">
                <button onClick={() => setQuimica(key, { feito: !item.feito, quando: undefined })}
                  className={`w-full flex items-center justify-between p-3 rounded-xl border text-sm font-medium transition-colors ${item.feito ? 'border-2' : 'border-slate-200 bg-white'}`}
                  style={item.feito ? { borderColor: primaryColor } : {}}>
                  <span className="text-slate-800">{label}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${item.feito ? 'text-white' : 'bg-slate-100 text-slate-500'}`}
                    style={item.feito ? { backgroundColor: primaryColor } : {}}>
                    {item.feito ? 'Sim' : 'Não'}
                  </span>
                </button>
                {item.feito && (
                  <div className="grid grid-cols-2 gap-1.5 pl-2">
                    {QUANDOS.map((q) => (
                      <button key={q.value} onClick={() => setQuimica(key, { ...item, quando: q.value })}
                        className={`${chipBase} ${item.quando === q.value ? 'border-2 font-medium' : chipIdle}`}
                        style={item.quando === q.value ? { borderColor: primaryColor, color: primaryColor } : {}}>
                        {q.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Sub-seção C: Cuidados */}
      {subStep === 'cuidados' && (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Cuidados em casa</h2>
            <p className="text-sm text-slate-500 mt-0.5">Sua rotina capilar atual.</p>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-700">Produtos que você usa</p>
            <div className="flex gap-2">
              <Input id="produto-input" placeholder="Ex: Kerastase, Pantene..." className="text-sm"
                onKeyDown={(e) => {
                  if (e.key !== 'Enter') return
                  const val = (e.currentTarget.value ?? '').trim()
                  if (val && (data.produtos ?? []).length < 10) {
                    setData((d) => ({ ...d, produtos: [...(d.produtos ?? []), val] }))
                    e.currentTarget.value = ''
                  }
                }} />
              <Button variant="outline" size="icon" type="button"
                onClick={() => {
                  const el = document.getElementById('produto-input') as HTMLInputElement | null
                  const val = (el?.value ?? '').trim()
                  if (val && (data.produtos ?? []).length < 10) {
                    setData((d) => ({ ...d, produtos: [...(d.produtos ?? []), val] }))
                    if (el) el.value = ''
                  }
                }}>
                <Plus className="size-4" />
              </Button>
            </div>
            {(data.produtos ?? []).length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {(data.produtos ?? []).map((p) => (
                  <span key={p} className="flex items-center gap-1 text-xs bg-slate-100 text-slate-700 px-2 py-1 rounded-full">
                    {p}
                    <button onClick={() => setData((d) => ({ ...d, produtos: (d.produtos ?? []).filter((x) => x !== p) }))}>
                      <X className="size-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-700">Frequência de lavagem</p>
            <div className="space-y-1.5">
              {[
                { value: 'diario', label: 'Todo dia' },
                { value: '2_3_semana', label: '2–3x por semana' },
                { value: '1_semana', label: '1x por semana' },
                { value: 'menos_semana', label: 'Menos de 1x por semana' },
              ].map((opt) => (
                <button key={opt.value} onClick={() => setData((d) => ({ ...d, frequenciaLavagem: opt.value as CapilarBlock['frequenciaLavagem'] }))}
                  className={`${chipBase} w-full ${data.frequenciaLavagem === opt.value ? 'border-2 font-medium' : chipIdle}`}
                  style={data.frequenciaLavagem === opt.value ? { borderColor: primaryColor, color: primaryColor } : {}}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-700">Chapinha / babyliss</p>
            <div className="grid grid-cols-2 gap-1.5">
              {[
                { value: 'nunca', label: 'Nunca' },
                { value: 'raramente', label: 'Raramente' },
                { value: '2_3_semana', label: '2–3x / semana' },
                { value: 'diario', label: 'Todo dia' },
              ].map((opt) => (
                <button key={opt.value} onClick={() => setData((d) => ({ ...d, usoTermico: opt.value as CapilarBlock['usoTermico'] }))}
                  className={`${chipBase} ${data.usoTermico === opt.value ? 'border-2 font-medium' : chipIdle}`}
                  style={data.usoTermico === opt.value ? { borderColor: primaryColor, color: primaryColor } : {}}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Sub-seção D: Fotos */}
      {subStep === 'fotos' && (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Fotos do cabelo</h2>
            <p className="text-sm text-slate-500 mt-0.5">Ajuda o profissional a entender melhor seu cabelo. Opcional.</p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {(data.photoUrls ?? []).map((url) => (
              <div key={url} className="relative aspect-square rounded-lg overflow-hidden border border-slate-200">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="Foto do cabelo" className="w-full h-full object-cover" />
                <button onClick={() => removePhoto(url)}
                  className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5">
                  <X className="size-3" />
                </button>
              </div>
            ))}
            {(data.photoUrls ?? []).length < 3 && (
              <label className="aspect-square rounded-lg border-2 border-dashed border-slate-300 flex flex-col items-center justify-center gap-1 text-slate-400 hover:border-slate-400 cursor-pointer transition-colors">
                {uploading ? <Loader2 className="size-5 animate-spin" /> : <Camera className="size-5" />}
                <span className="text-xs">{uploading ? 'Enviando...' : 'Adicionar'}</span>
                <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadFoto(f) }} />
              </label>
            )}
          </div>
          {uploadError && <p className="text-sm text-red-600">{uploadError}</p>}
          <p className="text-xs text-slate-400">Máx. 3 fotos · JPEG, PNG ou WebP · até 5 MB cada</p>
        </div>
      )}

      {/* Sub-seção E: Objetivo */}
      {subStep === 'objetivo' && (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">O que você quer?</h2>
            <p className="text-sm text-slate-500 mt-0.5">Selecione tudo que se aplica.</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[
              { value: 'mudar_cor', label: 'Mudar a cor', emoji: '🎨' },
              { value: 'hidratar', label: 'Hidratar', emoji: '💧' },
              { value: 'alisar', label: 'Alisar', emoji: '✨' },
              { value: 'manutencao', label: 'Manutenção', emoji: '🔄' },
              { value: 'corte', label: 'Corte', emoji: '✂️' },
              { value: 'outro', label: 'Outro', emoji: '🎯' },
            ].map((opt) => {
              const sel = (data.objetivos ?? []).includes(opt.value as never)
              return (
                <button key={opt.value} onClick={() => toggleObjetivo(opt.value as never)}
                  className={`flex items-center gap-2 p-3 rounded-xl border text-left transition-colors text-sm ${sel ? 'border-2' : 'border-slate-200 bg-white hover:border-slate-300'}`}
                  style={sel ? { borderColor: primaryColor, backgroundColor: `${primaryColor}15` } : {}}>
                  <span>{opt.emoji}</span>
                  <span className="font-medium" style={sel ? { color: primaryColor } : { color: '#374151' }}>
                    {opt.label}
                  </span>
                </button>
              )
            })}
          </div>
          <div className="space-y-1.5">
            <p className="text-sm font-medium text-slate-700">Descreva mais (opcional)</p>
            <Textarea value={data.descricaoLivre ?? ''} onChange={(e) => setData((d) => ({ ...d, descricaoLivre: e.target.value }))}
              placeholder="Ex: quero manter o comprimento mas mudar a cor..." maxLength={500} rows={3} className="text-sm resize-none" />
          </div>
        </div>
      )}

      {/* Botão de ação */}
      <Button onClick={goNext} className="w-full" style={{ backgroundColor: primaryColor }}
        disabled={subStep === 'objetivo' && (data.objetivos ?? []).length === 0}>
        {isLast ? 'Concluir ficha' : 'Próximo'}
      </Button>
    </div>
  )
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/components/domain/booking/anamnese-blocks/
git commit -m "feat(booking): formulário capilar com 5 sub-seções e upload de fotos"
```

---

## Task 10: Tela de Reaproveitamento e Orquestrador do Step

**Files:**
- Create: `src/components/domain/booking/anamnese-reuse-screen.tsx`
- Create: `src/components/domain/booking/anamnese-step.tsx`

- [ ] **Step 1: Criar tela de reaproveitamento**

```tsx
// src/components/domain/booking/anamnese-reuse-screen.tsx
'use client'

import { Check, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

const COMPRIMENTO_PT: Record<string, string> = {
  nuca: 'Nuca', ombro: 'Ombro', meio_costas: 'Meio das costas',
  cintura: 'Cintura', mais_cintura: 'Além da cintura',
}

type Summary = {
  comprimento?: string
  tipoFio?: string
  objetivos?: string[]
  temQuimicaRecente?: boolean
}

type Props = {
  ageDays: number
  isValid: boolean
  summary: Summary | null
  primaryColor: string
  onReuse: () => void
  onUpdate: () => void
}

export function AnamneseReuseScreen({ ageDays, isValid, summary, primaryColor, onReuse, onUpdate }: Props) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Ficha existente encontrada</h2>
        <p className="text-sm text-slate-500 mt-0.5">
          Encontramos suas informações de {ageDays} dia(s) atrás.
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-100">
        {summary?.comprimento && (
          <div className="p-3">
            <p className="text-xs text-slate-400">Comprimento</p>
            <p className="text-sm font-medium text-slate-800">{COMPRIMENTO_PT[summary.comprimento] ?? summary.comprimento}</p>
          </div>
        )}
        {(summary?.objetivos?.length ?? 0) > 0 && (
          <div className="p-3">
            <p className="text-xs text-slate-400 mb-1">Objetivos</p>
            <div className="flex flex-wrap gap-1">
              {summary!.objetivos!.map((o) => (
                <span key={o} className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full">
                  {o.replace('_', ' ')}
                </span>
              ))}
            </div>
          </div>
        )}
        {summary?.temQuimicaRecente && (
          <div className="p-3">
            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
              ⚠️ Química recente registrada
            </span>
          </div>
        )}
      </div>

      {!isValid && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700">
          Seus dados têm {ageDays} dias. Recomendamos atualizar para uma estimativa mais precisa.
        </div>
      )}

      <div className="space-y-2">
        <Button onClick={onReuse} className="w-full gap-2" style={{ backgroundColor: primaryColor }}>
          <Check className="size-4" />
          Usar essas informações
        </Button>
        <Button variant="outline" onClick={onUpdate} className="w-full gap-2">
          <RefreshCw className="size-4" />
          Atualizar minha ficha
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Criar orquestrador AnamneseStep**

```tsx
// src/components/domain/booking/anamnese-step.tsx
'use client'

import { useState, useEffect } from 'react'
import { CapilarForm } from './anamnese-blocks/capilar-form'
import { AnamneseReuseScreen } from './anamnese-reuse-screen'
import { Button } from '@/components/ui/button'
import type { CapilarBlock } from '@/domains/crm/anamnese-blocks.types'

type SubState =
  | { kind: 'loading' }
  | { kind: 'reuse'; anamneseId: string; customerId: string; isValid: boolean; ageDays: number; summary: Record<string, unknown> | null }
  | { kind: 'form' }
  | { kind: 'submitting' }
  | { kind: 'error'; message: string }

type Props = {
  tenantSlug: string
  serviceId?: string
  anamneseMode: 'OPTIONAL' | 'REQUIRED'
  customerPhone: string
  primaryColor: string
  onComplete: (anamneseId: string) => void
  onSkip: () => void
  onBack: () => void
}

export function AnamneseStep({
  tenantSlug,
  serviceId,
  anamneseMode,
  customerPhone,
  primaryColor,
  onComplete,
  onSkip,
  onBack,
}: Props) {
  const [state, setState] = useState<SubState>({ kind: 'loading' })

  useEffect(() => {
    async function check() {
      try {
        const params = new URLSearchParams({ phone: customerPhone })
        if (serviceId) params.set('serviceId', serviceId)
        const res = await fetch(`/api/public/${tenantSlug}/anamnese/check?${params}`)
        const data = await res.json() as {
          anamneseId: string | null
          customerId: string | null
          isValid: boolean
          ageDays: number
          summary: Record<string, unknown> | null
        }

        if (data.anamneseId) {
          setState({ kind: 'reuse', anamneseId: data.anamneseId, customerId: data.customerId!, isValid: data.isValid, ageDays: data.ageDays, summary: data.summary })
        } else {
          setState({ kind: 'form' })
        }
      } catch {
        setState({ kind: 'form' })
      }
    }
    void check()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleFormComplete(capilarData: CapilarBlock) {
    setState({ kind: 'submitting' })
    try {
      const res = await fetch(`/api/public/${tenantSlug}/anamnese`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: customerPhone, blockType: 'capilar', data: capilarData }),
      })
      const result = await res.json() as { anamneseId?: string; error?: unknown }
      if (!res.ok || !result.anamneseId) {
        setState({ kind: 'error', message: 'Não foi possível salvar a ficha. Tente novamente.' })
        return
      }
      onComplete(result.anamneseId)
    } catch {
      setState({ kind: 'error', message: 'Erro de conexão. Tente novamente.' })
    }
  }

  if (state.kind === 'loading') {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="size-6 rounded-full border-2 border-slate-300 border-t-slate-700 animate-spin" />
      </div>
    )
  }

  if (state.kind === 'reuse') {
    return (
      <AnamneseReuseScreen
        ageDays={state.ageDays}
        isValid={state.isValid}
        summary={state.summary as never}
        primaryColor={primaryColor}
        onReuse={() => onComplete(state.anamneseId)}
        onUpdate={() => setState({ kind: 'form' })}
      />
    )
  }

  if (state.kind === 'form') {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Ficha capilar</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Essas informações ajudam o profissional a preparar seu atendimento.
          </p>
        </div>
        <CapilarForm
          tenantSlug={tenantSlug}
          primaryColor={primaryColor}
          onComplete={handleFormComplete}
          onBack={onBack}
        />
        {anamneseMode === 'OPTIONAL' && (
          <button onClick={onSkip} className="w-full text-center text-sm text-slate-400 hover:text-slate-600 py-2">
            Pular preenchimento da ficha
          </button>
        )}
      </div>
    )
  }

  if (state.kind === 'submitting') {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="size-6 rounded-full border-2 border-slate-300 border-t-slate-700 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
        {state.message}
      </div>
      <Button onClick={() => setState({ kind: 'form' })} variant="outline" className="w-full">
        Tentar novamente
      </Button>
    </div>
  )
}
```

- [ ] **Step 3: Verificar TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/components/domain/booking/
git commit -m "feat(booking): tela de reaproveitamento e orquestrador do step de anamnese"
```

---

## Task 11: Integrar Anamnese no Wizard de Agendamento

**Files:**
- Modify: `src/app/(public)/agendar/[slug]/booking-client.tsx`

- [ ] **Step 1: Importar AnamneseStep e atualizar STEPS**

No topo do arquivo:
```typescript
import { AnamneseStep } from '@/components/domain/booking/anamnese-step'
```

Atualizar as constantes:
```typescript
const STEP_LABELS: Record<Exclude<BookingStep, 'success'>, string> = {
  service:      'Serviço',
  professional: 'Profissional',
  datetime:     'Data e hora',
  personal:     'Seus dados',
  anamnese:     'Ficha',
  confirmation: 'Confirmar',
}

const STEPS: Exclude<BookingStep, 'success'>[] = [
  'service', 'professional', 'datetime', 'personal', 'anamnese', 'confirmation',
]
```

- [ ] **Step 2: Propagar info de anamnese ao selecionar serviço**

Em `handleServiceSelect`, adicionar ao `setBooking`:
```typescript
servicePriceNumber: service.priceType === 'FIXED' ? service.price : (service.priceMin ?? service.price),
serviceAnamneseMode: service.anamneseMode,
serviceAnamneseBlocks: service.anamneseBlocks,
serviceAnamneseValidityDays: service.anamneseValidityDays,
```

- [ ] **Step 3: Desviar para anamnese após step personal**

Substituir `handlePersonalData`:
```typescript
function handlePersonalData(data: { customerName: string; customerPhone: string; notes?: string }) {
  const updated = { ...booking, ...data }
  setBooking(updated)
  const mode = updated.serviceAnamneseMode
  if (mode && mode !== 'NONE') {
    setStep('anamnese')
  } else {
    setStep('confirmation')
  }
}
```

- [ ] **Step 4: Adicionar handler de conclusão da anamnese**

```typescript
function handleAnamneseComplete(anamneseId: string) {
  setBooking((b) => ({ ...b, anamneseId }))
  setStep('confirmation')
}
```

- [ ] **Step 5: Renderizar o step no JSX**

Após o bloco `{step === 'personal' && ...}`:
```tsx
{step === 'anamnese' && booking.customerPhone && booking.serviceAnamneseMode && booking.serviceAnamneseMode !== 'NONE' && (
  <AnamneseStep
    tenantSlug={tenantData.slug}
    serviceId={booking.serviceId}
    anamneseMode={booking.serviceAnamneseMode}
    customerPhone={booking.customerPhone}
    primaryColor={primaryColor}
    onComplete={handleAnamneseComplete}
    onSkip={() => setStep('confirmation')}
    onBack={() => setStep('personal')}
  />
)}
```

- [ ] **Step 6: Verificar TypeScript**

```bash
npx tsc --noEmit
```

Esperado: zero erros.

- [ ] **Step 7: Commit**

```bash
git add src/app/\(public\)/agendar/\[slug\]/booking-client.tsx
git commit -m "feat(booking): integrar step de anamnese no wizard de agendamento público"
```

---

## Task 12: Linkar Anamnese ao Appointment

**Files:**
- Modify: `src/app/api/public/[slug]/appointments/route.ts`
- Modify: `src/components/domain/booking/confirmation-step.tsx`

- [ ] **Step 1: Enviar anamneseId na confirmação**

Em `src/components/domain/booking/confirmation-step.tsx`, adicionar `anamneseId` ao body:

```typescript
body: JSON.stringify({
  serviceId:    booking.serviceId,
  packageId:    booking.packageId,
  professionalId: booking.professionalId,
  startsAt:     booking.startsAt?.toISOString(),
  customerName: booking.customerName,
  customerPhone: booking.customerPhone,
  notes:        booking.notes,
  anamneseId:   booking.anamneseId,   // novo
}),
```

- [ ] **Step 2: Aceitar anamneseId na rota de criação de agendamento**

Em `src/app/api/public/[slug]/appointments/route.ts`, adicionar ao schema:
```typescript
anamneseId: z.string().min(1).optional(),
```

E após a criação do appointment (tanto no bloco `packageId` quanto no `serviceId`), adicionar:
```typescript
if (input.anamneseId) {
  await prisma.appointment.update({
    where: { id: appointment.id },
    data: { anamneseId: input.anamneseId },
  })
}
```

- [ ] **Step 3: Verificar TypeScript**

```bash
npx tsc --noEmit
```

Esperado: zero erros.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/public/\[slug\]/appointments/ src/components/domain/booking/confirmation-step.tsx
git commit -m "feat(booking): linkar anamnese ao agendamento na confirmação"
```

---

## Task 13: Painel do Profissional — Confirmação com Anamnese

**Files:**
- Create: `src/components/domain/scheduling/appointment-anamnese-panel.tsx`
- Modify: componente de detalhe/confirmação de agendamento existente (localizar na Task)

- [ ] **Step 1: Localizar o componente de confirmação de agendamento**

```bash
grep -r "CONFIRMED\|confirmar\|status.*SCHEDULED" src/components/domain/scheduling/ --include="*.tsx" -l | head -5
```

Identificar qual componente abre o modal/drawer de detalhe de agendamento no painel do profissional.

- [ ] **Step 2: Criar o painel de anamnese**

```tsx
// src/components/domain/scheduling/appointment-anamnese-panel.tsx
'use client'

import { useQuery } from '@tanstack/react-query'
import { Scissors, AlertTriangle, Camera } from 'lucide-react'
import type { CapilarBlock } from '@/domains/crm/anamnese-blocks.types'
import type { SugestaoPreco } from '@/domains/crm/price-suggestion'

type AnamneseData = {
  anamnese: {
    id: string
    blocks: { capilar?: CapilarBlock }
    blockTypes: string[]
    updatedAt: string
  }
  sugestaoPreco: SugestaoPreco | null
}

const COMPRIMENTO_PT: Record<string, string> = {
  nuca: 'Nuca', ombro: 'Ombro', meio_costas: 'Meio das costas',
  cintura: 'Cintura', mais_cintura: 'Além da cintura',
}

function formatCurrency(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
}

type Props = {
  appointmentId: string
  onPriceAdjust?: (price: number) => void
}

export function AppointmentAnamnesePanel({ appointmentId, onPriceAdjust }: Props) {
  const { data, isLoading } = useQuery<AnamneseData | null>({
    queryKey: ['appointment-anamnese', appointmentId],
    queryFn: async () => {
      const res = await fetch(`/api/scheduling/appointments/${appointmentId}/anamnese`)
      if (!res.ok) return null
      return res.json()
    },
    staleTime: 2 * 60 * 1000,
  })

  if (isLoading) return (
    <div className="flex items-center justify-center p-6">
      <div className="size-5 rounded-full border-2 border-slate-300 border-t-slate-700 animate-spin" />
    </div>
  )

  if (!data?.anamnese) return null

  const capilar = data.anamnese.blocks.capilar
  const sugestao = data.sugestaoPreco

  const temQuimicaRecente = capilar && [capilar.coloracao, capilar.descoloracao, capilar.progressiva, capilar.botox]
    .some((c) => c?.feito && c.quando === 'menos_30_dias')

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Ficha do cliente</p>

      {/* Badges de resumo */}
      <div className="flex flex-wrap gap-2">
        {capilar?.comprimento && (
          <span className="flex items-center gap-1.5 text-xs bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full">
            <Scissors className="size-3" />
            {COMPRIMENTO_PT[capilar.comprimento] ?? capilar.comprimento}
            {capilar.tipoFio && ` · ${capilar.tipoFio}`}
          </span>
        )}
        {(capilar?.photoUrls?.length ?? 0) > 0 && (
          <span className="flex items-center gap-1.5 text-xs bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full">
            <Camera className="size-3" />
            {capilar!.photoUrls!.length} foto(s)
          </span>
        )}
        {temQuimicaRecente && (
          <span className="flex items-center gap-1.5 text-xs bg-amber-100 text-amber-700 px-2.5 py-1 rounded-full">
            <AlertTriangle className="size-3" />
            Química recente
          </span>
        )}
      </div>

      {/* Fotos em miniatura */}
      {(capilar?.photoUrls?.length ?? 0) > 0 && (
        <div className="flex gap-2">
          {capilar!.photoUrls!.map((url) => (
            <a key={url} href={url} target="_blank" rel="noopener noreferrer"
              className="size-16 rounded-lg overflow-hidden border border-slate-200 block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="Foto do cliente" className="w-full h-full object-cover" />
            </a>
          ))}
        </div>
      )}

      {/* Objetivo */}
      {(capilar?.objetivos?.length ?? 0) > 0 && (
        <div>
          <p className="text-xs text-slate-400 mb-1">Objetivo</p>
          <div className="flex flex-wrap gap-1">
            {capilar!.objetivos!.map((o) => (
              <span key={o} className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full">
                {o.replace('_', ' ')}
              </span>
            ))}
          </div>
          {capilar?.descricaoLivre && (
            <p className="text-xs text-slate-600 mt-1 italic">"{capilar.descricaoLivre}"</p>
          )}
        </div>
      )}

      {/* Sugestão de preço */}
      {sugestao && sugestao.ajustes.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 space-y-2">
          <p className="text-xs font-semibold text-amber-800">Sugestão de ajuste de preço</p>
          <div className="space-y-1">
            {sugestao.ajustes.map((a, i) => (
              <div key={i} className="flex items-center justify-between text-xs text-amber-700">
                <span>{a.motivo}</span>
                <span className="font-medium">+{formatCurrency(a.valorAdicional)}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between text-sm font-semibold text-amber-900 pt-1 border-t border-amber-200">
            <span>Valor sugerido</span>
            <span>{formatCurrency(sugestao.valorSugerido)}</span>
          </div>
          {onPriceAdjust && (
            <button onClick={() => onPriceAdjust(sugestao.valorSugerido)}
              className="w-full mt-1 text-xs text-amber-700 underline hover:text-amber-900">
              Aplicar valor sugerido
            </button>
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Integrar no componente de detalhe de agendamento**

Após localizar o componente de detalhe (Step 1), importar e renderizar o painel:

```tsx
import { AppointmentAnamnesePanel } from '@/components/domain/scheduling/appointment-anamnese-panel'

// No JSX, dentro do drawer/modal do agendamento, após as informações do serviço:
{appointment.id && (
  <AppointmentAnamnesePanel
    appointmentId={appointment.id}
    onPriceAdjust={(price) => setPrice(price)} // ajuste ao estado local de preço se houver
  />
)}
```

- [ ] **Step 4: Verificar TypeScript**

```bash
npx tsc --noEmit
```

Esperado: zero erros.

- [ ] **Step 5: Rodar todos os testes**

```bash
npx vitest run
```

Esperado: todos os testes passando.

- [ ] **Step 6: Commit**

```bash
git add src/components/domain/scheduling/
git commit -m "feat(scheduling): painel de anamnese com sugestão de preço na confirmação do profissional"
```

---

## Task 14: Corrigir Hooks de UI do Modelo Antigo

**Files:**
- Modify: `src/hooks/crm/use-public-anamnese.ts` → deletar
- Modify: `src/hooks/crm/use-customer-anamnese.ts` → reescrever
- Modify: `src/hooks/crm/use-anamnese-template.ts` → deletar
- Modify: `src/hooks/crm/use-send-anamnese-link.ts` → deletar
- Modify: componentes que usam esses hooks (localizar e atualizar)

- [ ] **Step 1: Deletar hooks do modelo antigo**

```bash
rm src/hooks/crm/use-public-anamnese.ts
rm src/hooks/crm/use-anamnese-template.ts
rm src/hooks/crm/use-send-anamnese-link.ts
```

- [ ] **Step 2: Reescrever use-customer-anamnese**

```typescript
// src/hooks/crm/use-customer-anamnese.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { AnamneseBlocks } from '@/domains/crm/anamnese-blocks.types'

type CustomerAnamneseData = {
  id: string
  blocks: AnamneseBlocks
  blockTypes: string[]
  version: number
  updatedAt: string
} | null

export function useCustomerAnamnese(customerId: string) {
  return useQuery<CustomerAnamneseData>({
    queryKey: ['customer-anamnese', customerId],
    queryFn: async () => {
      const res = await fetch(`/api/crm/customers/${customerId}/anamnese`)
      if (!res.ok) return null
      return res.json()
    },
    staleTime: 2 * 60 * 1000,
  })
}

export function useSaveCustomerAnamnese(customerId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { blockType: string; data: unknown }) => {
      const res = await fetch(`/api/crm/customers/${customerId}/anamnese`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
      if (!res.ok) throw new Error('Falha ao salvar anamnese')
      return res.json()
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['customer-anamnese', customerId] }),
  })
}
```

- [ ] **Step 3: Localizar e atualizar componentes que usam os hooks deletados**

```bash
grep -r "use-public-anamnese\|use-anamnese-template\|use-send-anamnese-link\|AnamneseSheet\|AnamneseFormField\|settings-anamnese-tab\|anamnese-send-link" src/components/ --include="*.tsx" -l
```

Para cada arquivo encontrado, atualizar para usar os novos hooks ou remover a funcionalidade obsoleta. O componente `AnamneseSheet` existente na ficha do cliente (`clientes/[id]/page.tsx`) deve ser substituído pela nova visualização baseada em blocos.

- [ ] **Step 4: Remover ou atualizar a aba CRM nas configurações**

Em `src/app/(app)/configuracoes/page.tsx`, remover a aba `crm` (que configura o `AnamneseTemplate` antigo). O template foi substituído pela config por serviço.

- [ ] **Step 5: Verificar TypeScript**

```bash
npx tsc --noEmit
```

Esperado: zero erros.

- [ ] **Step 6: Rodar todos os testes**

```bash
npx vitest run
```

Esperado: todos os testes passando. Testes antigos de anamnese (service, repository, hooks) devem ser deletados junto com os arquivos obsoletos — ou já passam se foram reescritos.

- [ ] **Step 7: Commit final**

```bash
git add src/
git commit -m "feat(crm): limpar hooks e componentes do modelo antigo de anamnese"
```

---

## Checklist de Entrega

- [ ] `npx tsc --noEmit` — zero erros
- [ ] `npx vitest run` — todos os testes passando
- [ ] Bucket `anamnese-photos` criado no Supabase (manual)
- [ ] Fluxo do cliente testado manualmente: serviço com anamnese REQUIRED → preenche ficha → confirma agendamento
- [ ] Fluxo do cliente testado: ficha existente → reaproveitamento
- [ ] Fluxo do profissional testado: painel de confirmação exibe anamnese + sugestão de preço
- [ ] Config por serviço testada: NONE → sem step; OPTIONAL → com botão pular; REQUIRED → sem botão pular
- [ ] PR aberta para `main`

---

## Notas de implementação

**Migration destrutiva:** A Task 1 dropa colunas antigas do `CustomerAnamnese` e a tabela `AnamneseTemplate`. Clientes com anamnese preenchida perdem os dados. Conforme decisão do onboarding — modelo genérico substituído.

**Bucket Supabase (passo manual antes do deploy):**
- Nome: `anamnese-photos`
- Público: `true`
- MIME types: `image/jpeg, image/png, image/webp`
- Tamanho máximo: `5242880` (5 MB)

**Multiplicadores fixos (v1):**
- Meio das costas: +15%
- Cintura: +30%
- Além da cintura: +50%
- Química recente (< 30 dias): +15%
- Configuráveis por serviço: fora do escopo (v2)

**Extensibilidade de blocos:** Para adicionar um novo tipo (ex: `facial`), basta:
1. Adicionar `facialBlockSchema` em `anamnese-blocks.types.ts`
2. Adicionar `facial?: FacialBlock` ao `anamneseBlocksSchema`
3. Criar `src/components/domain/booking/anamnese-blocks/facial-form.tsx`
4. Adicionar o tipo ao switch no `AnamneseStep`
