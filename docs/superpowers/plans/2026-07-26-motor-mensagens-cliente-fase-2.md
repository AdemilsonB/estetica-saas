# Motor de mensagens ao cliente — Fase 2 (controle de disparo) — Plano de implementação

> **Para agentes executores:** SUB-SKILL OBRIGATÓRIA: use `superpowers:subagent-driven-development` (recomendado) ou `superpowers:executing-plans` para implementar tarefa a tarefa. Os passos usam checkbox (`- [ ]`) para acompanhamento.

**Spec:** [`docs/superpowers/specs/2026-07-26-motor-mensagens-cliente-design.md`](../specs/2026-07-26-motor-mensagens-cliente-design.md) — **seção 6** (e seções 3.2, 11 e 12 como contexto).
**Fase anterior:** [`2026-07-26-motor-mensagens-cliente-fase-1.md`](./2026-07-26-motor-mensagens-cliente-fase-1.md) — entregue, mergeada e aplicada em produção (PRs #300–#304).
**Handoff:** [`docs/handoff-motor-mensagens-fases-2-5.md`](../../handoff-motor-mensagens-fases-2-5.md).

**Goal:** Dar ao tenant o controle de **quando** cada mensagem ao cliente é enviada — um padrão por evento configurável em Configurações, um override consciente no momento de cada ação, e o fluxo de agendamento online deixando de mandar duas mensagens quase idênticas.

**Architecture:** O catálogo da Fase 1 ganha `defaultChannels`; um model novo (`CustomerMessageSetting`) guarda **apenas** o que o tenant mudou — ausência de registro significa "usa o padrão do catálogo", exatamente como os templates. Um **dispatcher** único no domínio de notificações vira o único caminho de envio ao cliente: ele resolve `override ?? padrão do tenant`, escolhe os canais e só então chama `notificationService.logAndDispatch`. As rotas passam a aceitar `notify?: boolean`, que trafega **cru** no evento de domínio e é resolvido no service de notificações — a decisão nunca fica no cliente.

**Tech Stack:** Next.js 15 App Router, TypeScript strict, Prisma + Supabase, Zod, TanStack Query, Shadcn UI, Vitest.

---

## Global Constraints

- **Idioma:** todo output em Português do Brasil — código, comentários, nomes de variável, mensagens de commit, logs e UI.
- **Multi-tenancy:** todo repository filtra por `tenantId` em TODAS as queries; `tenantId` vem sempre do token via `getSessionContext()`, **nunca** do body ou da URL.
- **Camadas:** API Route (controller fino, valida com Zod) → Service (regra de negócio) → Repository (dados) → Prisma.
- **Domínios não se importam diretamente.** `scheduling` **não pode** importar nada de `notifications`. A comunicação é pelo event bus. É por isso que `notify` viaja cru no payload do evento e é resolvido do lado de notificações (ver Task 8).
- **TypeScript:** strict, sem `any`, sem `as unknown as`.
- **Erros:** sempre erros de domínio tipados de `src/shared/errors/`. Nunca `throw new Error('string')`.
- **Nenhum campo novo entra na query de sessão (`/me`).** Precedente: coluna nova acoplada ao `/me` já causou logout global (P2022) duas vezes quando a migration atrasou.
- **A Vercel não roda migrations no build.** `prisma migrate deploy` é manual e vai no runbook (Task 14).
- **Fuso horário:** toda formatação de data/hora usa `tenant.timezone` via `Intl.DateTimeFormat`, nunca o fuso do processo. Já resolvido por `buildCustomerMessageVariables` — apenas não contorne.
- **Cota de WhatsApp é incrementada ANTES do envio.** Todo caminho de erro depois disso precisa devolvê-la com `whatsAppQuotaService.decrement`. Se você adicionar um `return`/`throw` dentro de `whatsapp.gateway.ts` depois do `checkAndIncrement`, ele precisa de `decrement`.
- **`logAndDispatch` roda em handler assíncrono do event bus, que engole rejeições.** Nada pode escapar: converta em `delivery` FAILED com a causa preservada, como o código da Fase 1 já faz.
- **`AlertDialog` do Radix não aceita `modal={false}`** (a tipagem faz `Omit<DialogProps, 'modal'>`). Nunca aninhe `Dialog` dentro de `AlertDialog` — coloque o conteúdo inline.
- **Todo `DialogContent`/`AlertDialogContent` novo ou alterado precisa de `max-h-[85vh]` + `overflow-y-auto`.** Erro recorrente já reportado várias vezes neste projeto.
- **Alvo de toque mínimo 44×44** (`min-h-11` nos botões/switches).
- **Mobile E desktop completos** em toda tela nova ou alterada — requisito de primeira classe, não acabamento. Mais de 70% do tráfego é mobile.
- **Gate de entrega:** `npx tsc --noEmit` com zero erros e `npx vitest run` sem **nenhuma falha nova** antes de cada commit de tarefa.
- **Branch:** todo o trabalho desta fase acontece em `feat/motor-mensagens-cliente-fase-2`. Nunca commitar em `main`.

### Baseline de testes medido em 2026-07-26 (antes de qualquer alteração)

```
Test Files  3 failed | 163 passed (166)
     Tests  4 failed | 896 passed (900)
```

As 4 falhas são **pré-existentes** e não têm relação com esta fase (as mesmas registradas no ADR-017):
`scheduling.service.update.test.ts`, `appointment-reminder.test.ts` e `customer-history-client.test.tsx` (×2).

> **Regra:** "verde" nesta fase significa **exatamente essas 4 falhas e nenhuma a mais**. Se o seu run mostrar 5, você quebrou algo. Não "conserte" essas 4 — está fora de escopo e vai poluir o diff.
>
> `npx tsc --noEmit` está **zerado** no baseline. Qualquer erro é seu.

### Prova empírica, não alegação

Toda afirmação de "isso funciona" precisa vir com a saída do comando que prova. Em particular:

- Ao afirmar que uma verificação de tipo pega um erro, **quebre de propósito** e cole a saída do `tsc` reclamando. Uma asserção de tipo que compila sempre — inclusive quando os valores divergem — já passou por este projeto sem ser notada.
- Ao afirmar que um teste falha antes da implementação, cole a mensagem de falha. "Rodei e falhou" não é prova.

### Decisão de implementação registrada: sem seed de `CustomerMessageSetting`

A seção 6.1 da spec diz "tenant novo é semeado com todos os eventos ligados; o seed roda na criação do tenant". **Este plano entrega o mesmo comportamento observável por outro caminho:** quando não existe registro, a resolução cai no `defaultEnabled`/`defaultChannels` do catálogo.

> **Exceção decidida durante a execução (2026-07-27), com o dono do produto.** "Todos ligados" vale para os **7 eventos transacionais**. Os 3 promocionais (`birthday`, `return_due`, `winback`) nascem **desligados**, como a Fase 1 já os tinha no catálogo: a §3.3 da spec trata promocional como opt-in (exige `consentGiven`, respeita `marketingOptOut`), e ligar disparo promocional por padrão contradiz isso. O canal padrão continua `["WHATSAPP"]` para os 10 — canal é *por onde* enviar, não *se* envia. Registrar no ADR-018.
>
> Regra derivada, e é assim que os testes devem afirmá-la: `defaultEnabled === (nature === "transactional")`. Nunca asserir o literal `true` para os 10.

Motivo: é exatamente a arquitetura de duas camadas que o ADR-017 estabeleceu para os templates ("ausência de registro significa usa o padrão, nunca sem mensagem"). Ter os settings com semântica diferente dos templates seria confuso e, pior, exigiria um **backfill de produção** e um hook na criação do tenant — dois pontos de falha para obter um resultado idêntico. Sem seed:

- tenant novo já nasce no padrão certo (transacionais ligados, promocionais desligados), sem nenhuma linha no banco;
- tenants existentes idem, no primeiro deploy, sem script nenhum;
- mudar o padrão do sistema no futuro é editar o catálogo, sem migration.

O registro é criado **apenas quando o tenant muda alguma coisa** (Task 4, `save`).

---

## Estrutura de arquivos

### Arquivos criados

| Arquivo | Responsabilidade |
|---|---|
| `src/domains/notifications/customer-messages/customer-message-setting.repository.ts` | Acesso a `CustomerMessageSetting`, sempre filtrando `tenantId` |
| `src/domains/notifications/customer-messages/customer-message-setting.service.ts` | Resolve padrão do tenant (banco → catálogo), `shouldNotify(override)`, `save` |
| `src/domains/notifications/customer-messages/customer-message-dispatcher.service.ts` | **Único caminho de envio ao cliente**: resolve o padrão, escolhe canais, chama `logAndDispatch` |
| `src/app/api/notifications/customer-messages/settings/route.ts` | `GET` (matriz) e `PUT` (salva um evento) |
| `src/app/api/notifications/customer-messages/preview/route.ts` | `POST` — padrão do evento + texto interpolado + motivo de bloqueio, para o toggle |
| `src/hooks/settings/use-customer-message-settings.ts` | TanStack Query da matriz |
| `src/hooks/notifications/use-customer-message-preview.ts` | TanStack Query da prévia usada pelo toggle |
| `src/components/domain/settings/customer-message-settings-matrix.tsx` | Matriz evento × canal (cartões no mobile, tabela no desktop) |
| `src/components/domain/notifications/customer-message-toggle.tsx` | `<CustomerMessageToggle>` reutilizado nos pontos de disparo |
| `prisma/migrations/20260727120000_add_customer_message_setting/migration.sql` | Migration aditiva |

### Arquivos modificados

| Arquivo | Mudança |
|---|---|
| `prisma/schema.prisma` | Model `CustomerMessageSetting`, enum `AppointmentOrigin`, `Appointment.origin`, relação no `Tenant` |
| `customer-messages/types.ts` | `defaultChannels` no `CustomerMessageCatalogEntry` |
| `customer-messages/customer-message-catalog.ts` | `defaultChannels` nas 10 entradas, `CUSTOMER_MESSAGE_TEMPLATE_KEY`, 3 chaves faltantes em `LEGACY_TEMPLATE_TO_EVENT` |
| `customer-messages/schemas.ts` | `updateCustomerMessageSettingSchema`, `customerMessagePreviewSchema` |
| `src/shared/events/domain-events.ts` | `notify?: boolean` e `origin` nos payloads de agendamento; `customerEmail` no de remarcação |
| `src/domains/scheduling/types.ts` | `notify: z.boolean().optional()` nos 3 schemas |
| `src/domains/scheduling/scheduling.service.ts` | Persiste `origin`, repassa `notify` cru ao evento |
| `src/domains/scheduling/appointment.repository.ts` | `origin` no `create` |
| `src/domains/notifications/subscriptions.ts` | Passa a chamar o dispatcher; roteia `created` → `appointment_requested` quando a origem é pública |
| `src/shared/queue/jobs/appointment-reminder.ts` | Envia pelo dispatcher |
| `src/shared/queue/jobs/birthday-reminder.ts` | Envia pelo dispatcher |
| `src/app/api/notifications/bulk-reminder/route.ts` | Envia pelo dispatcher |
| `src/components/domain/settings/customer-message-list.tsx` | Recebe a matriz de switches |
| `src/hooks/scheduling/use-appointments.ts` | `notify` nos inputs das mutations |
| `src/components/domain/scheduling/create-appointment-modal.tsx` | `<CustomerMessageToggle>`; remove o textarea solto |
| `src/components/domain/scheduling/cancel-appointment-modal.tsx` | `<CustomerMessageToggle>`; remove `CANCEL_TEMPLATE` |
| `src/components/domain/scheduling/confirm-appointment-modal.tsx` | `<CustomerMessageToggle>`; remove `buildDefaultMessage` |
| `src/components/domain/scheduling/appointment-drawer.tsx` | Toggle na remarcação, na confirmação e no diálogo de no-show; remove `RESCHEDULE_TEMPLATE` |
| `CLAUDE.md`, `docs/decisions.md`, `docs/handoff-motor-mensagens-fases-2-5.md` | Documentação (Task 14) |

---

## Mapa de dependências entre tarefas

```
T1 (schema)
 └─ T2 (catálogo) ─ T3 (repository) ─ T4 (setting service) ─┬─ T5 (dispatcher) ─┬─ T8 (contrato notify)
                                                            │                   └─ T9 (jobs)
                                                            ├─ T6 (API settings) ─ T7 (UI matriz)
                                                            └─ T10 (API prévia) ─ T11 (toggle) ─┬─ T12 (5 pontos de UI)
                                                                                                └─ T13 (no-show)
                                                                                                     ↓
                                                                                                 T14 (docs)
```

T8 depende de T5. T12 e T13 dependem de T8 **e** de T11.

---

## Task 1: Schema — `CustomerMessageSetting` e a origem do agendamento

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260727120000_add_customer_message_setting/migration.sql`

**Interfaces:**
- Consumes: enums `CustomerMessageEvent` e `NotificationChannel`, já existentes no schema.
- Produces:
  - `model CustomerMessageSetting { id, tenantId, event, enabled, channels, createdAt, updatedAt }`
  - `enum AppointmentOrigin { PANEL PUBLIC }`
  - `Appointment.origin: AppointmentOrigin @default(PANEL)`
  - `Tenant.customerMessageSettings: CustomerMessageSetting[]`

### Por que `Appointment.origin` existe

A seção 6.4 da spec exige que `appointment_confirmed` só chegue ao cliente quando o agendamento **nasceu como pedido online**. A confirmação acontece em `updateAppointmentStatus`, muito depois da criação, e nada no agendamento registra de onde ele veio — `origin` hoje é só um argumento em memória de `createAppointment`. Sem persistir, a regra é indecidível.

Alternativas descartadas: inferir por `createdByUserId === owner` (falso positivo sempre que o dono agenda pelo painel) e consultar o `NotificationLog` atrás de um `appointment-requested` (acopla a regra ao log e falha se a mensagem estava desligada).

A coluna é **aditiva, com default**, e não entra em nenhuma query de sessão.

- [ ] **Step 1: Adicionar o enum e a coluna de origem ao schema**

Em `prisma/schema.prisma`, logo depois do bloco `enum CustomerMessageEvent` (linha ~67):

```prisma
enum AppointmentOrigin {
  PANEL
  PUBLIC
}
```

No `model Appointment`, adicione a coluna logo abaixo de `status`:

```prisma
  origin              AppointmentOrigin        @default(PANEL)
```

- [ ] **Step 2: Adicionar o model `CustomerMessageSetting`**

Em `prisma/schema.prisma`, imediatamente depois do `model CustomerMessageTemplate`:

```prisma
/// Padrão do negócio para cada mensagem ao cliente. Guarda APENAS o que o tenant
/// mudou: ausência de registro significa "usa o padrão do catálogo" (transacional ligado,
/// promocional desligado, canal WhatsApp),
/// nunca "desligado". Mesma arquitetura de duas camadas do CustomerMessageTemplate.
model CustomerMessageSetting {
  id        String                @id @default(cuid())
  tenantId  String
  event     CustomerMessageEvent
  enabled   Boolean               @default(true)
  channels  NotificationChannel[] @default([WHATSAPP])
  createdAt DateTime              @default(now())
  updatedAt DateTime              @updatedAt

  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@unique([tenantId, event])
  @@index([tenantId])
}
```

No `model Tenant`, ao lado de `customerMessageTemplates` (linha ~223):

```prisma
  customerMessageSettings     CustomerMessageSetting[]
```

- [ ] **Step 3: Escrever a migration**

Crie `prisma/migrations/20260727120000_add_customer_message_setting/migration.sql`:

```sql
-- CreateEnum
CREATE TYPE "AppointmentOrigin" AS ENUM ('PANEL', 'PUBLIC');

-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "origin" "AppointmentOrigin" NOT NULL DEFAULT 'PANEL';

-- CreateTable
CREATE TABLE "CustomerMessageSetting" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "event" "CustomerMessageEvent" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "channels" "NotificationChannel"[] DEFAULT ARRAY['WHATSAPP']::"NotificationChannel"[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerMessageSetting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CustomerMessageSetting_tenantId_idx" ON "CustomerMessageSetting"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerMessageSetting_tenantId_event_key" ON "CustomerMessageSetting"("tenantId", "event");

-- AddForeignKey
ALTER TABLE "CustomerMessageSetting" ADD CONSTRAINT "CustomerMessageSetting_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

> Se o Postgres local estiver disponível, **gere o arquivo com o Prisma em vez de confiar no SQL acima** e compare os dois:
> `npx prisma migrate dev --name add_customer_message_setting --create-only`.
> Se estiver indisponível (foi o caso na Fase 1), mantenha o SQL manual e registre no ADR que a migration **nunca rodou contra um Postgres real** — validar antes do merge. Nunca use a porta 6543 do Supabase para DDL; use a 5432.

- [ ] **Step 4: Regenerar o Prisma Client e verificar**

```bash
npx prisma generate
npx prisma validate
npx tsc --noEmit
```

Esperado: `prisma validate` diz "The schema at prisma/schema.prisma is valid".

Esperado do `tsc`: **erro** em `src/domains/scheduling/scheduling.service.ts`, no `toAppointmentEventPayload` — o objeto literal montado ali é tipado como o `Appointment` do Prisma e agora falta `origin`. Isso é esperado e será corrigido na Task 8. Anote a mensagem e siga.

> Se o `tsc` **não** acusar nada, pare: significa que o Prisma Client não foi regenerado (rode `npx prisma generate` de novo) ou que o objeto não está tipado como você supõe. Não prossiga sem entender o motivo.

- [ ] **Step 5: Commit**

```bash
git checkout -b feat/motor-mensagens-cliente-fase-2
git add prisma/schema.prisma prisma/migrations/20260727120000_add_customer_message_setting
git commit -m "feat(notifications): model CustomerMessageSetting e origem persistida do agendamento"
```

> O `tsc` está quebrado de propósito ao fim desta tarefa (um erro, em `scheduling.service.ts`). Esta é a **única** tarefa que pode fechar com o build vermelho, e só porque a correção pertence a outra camada. Se preferir, faça o ajuste de uma linha da Task 8 Step 2 aqui.

---

## Task 2: Catálogo — canais padrão e a chave de log por evento

**Files:**
- Modify: `src/domains/notifications/customer-messages/types.ts`
- Modify: `src/domains/notifications/customer-messages/customer-message-catalog.ts`
- Test: `src/domains/notifications/customer-messages/customer-message-catalog.test.ts`

**Interfaces:**
- Consumes: `CustomerMessageEventKey`, `CustomerMessageChannel`, `CustomerMessageCatalogEntry` (Fase 1).
- Produces:
  - `CustomerMessageCatalogEntry.defaultChannels: CustomerMessageChannel[]`
  - `const CUSTOMER_MESSAGE_TEMPLATE_KEY: Record<CustomerMessageEventKey, string>` — evento → string usada em `NotificationLog.template`
  - `LEGACY_TEMPLATE_TO_EVENT` completo (10 chaves, inverso exato de `CUSTOMER_MESSAGE_TEMPLATE_KEY`)

### Por que a chave de log precisa existir

`notificationService.logAndDispatch` e `whatsapp.gateway.ts` continuam recebendo `draft.template` como string e resolvendo o evento por `LEGACY_TEMPLATE_TO_EVENT`. O dispatcher da Task 5 parte do **evento** e precisa do caminho inverso. Hoje o mapa tem 7 chaves — faltam `appointment_requested`, `return_due` e `winback`, e sem elas o gateway devolveria "Template desconhecido" para o evento novo desta fase.

- [ ] **Step 1: Escrever os testes (falhando)**

Adicione ao fim de `src/domains/notifications/customer-messages/customer-message-catalog.test.ts`, dentro do `describe` existente:

```ts
  it("todo evento do catálogo nasce ligado e no canal WhatsApp", () => {
    for (const entrada of CUSTOMER_MESSAGE_CATALOG) {
      expect(entrada.defaultEnabled).toBe(true);
      expect(entrada.defaultChannels).toEqual(["WHATSAPP"]);
    }
  });

  it("CUSTOMER_MESSAGE_TEMPLATE_KEY cobre os 10 eventos", () => {
    for (const entrada of CUSTOMER_MESSAGE_CATALOG) {
      expect(CUSTOMER_MESSAGE_TEMPLATE_KEY[entrada.event]).toBeTruthy();
    }
    expect(Object.keys(CUSTOMER_MESSAGE_TEMPLATE_KEY)).toHaveLength(10);
  });

  it("CUSTOMER_MESSAGE_TEMPLATE_KEY e LEGACY_TEMPLATE_TO_EVENT são inversos exatos", () => {
    // Sem isso, o dispatcher escolheria uma chave de log que o gateway não sabe
    // traduzir de volta em evento — e a mensagem morreria como "Template desconhecido".
    for (const [evento, chave] of Object.entries(CUSTOMER_MESSAGE_TEMPLATE_KEY)) {
      expect(LEGACY_TEMPLATE_TO_EVENT[chave]).toBe(evento);
    }
    expect(Object.keys(LEGACY_TEMPLATE_TO_EVENT)).toHaveLength(10);
  });
```

E acrescente `CUSTOMER_MESSAGE_TEMPLATE_KEY` ao import do topo do arquivo (junto de `CUSTOMER_MESSAGE_CATALOG` e `LEGACY_TEMPLATE_TO_EVENT`).

- [ ] **Step 2: Rodar e ver falhar**

```bash
npx vitest run src/domains/notifications/customer-messages/customer-message-catalog.test.ts
```

Esperado: erro de compilação/import — `CUSTOMER_MESSAGE_TEMPLATE_KEY` não é exportado. Cole a saída.

- [ ] **Step 3: Adicionar `defaultChannels` ao tipo**

Em `src/domains/notifications/customer-messages/types.ts`, dentro de `CustomerMessageCatalogEntry`, logo abaixo de `defaultEnabled`:

```ts
  /** Canais ligados por padrão. Tenant sem registro em CustomerMessageSetting usa isto. */
  defaultChannels: CustomerMessageChannel[];
```

- [ ] **Step 4: Preencher `defaultChannels` nas 10 entradas**

Em `customer-message-catalog.ts`, adicione `defaultChannels: ["WHATSAPP"],` imediatamente após cada `defaultEnabled: true,`. São 10 ocorrências — o `tsc` acusa qualquer uma esquecida.

- [ ] **Step 5: Completar o mapa legado e criar o inverso**

Substitua o bloco `LEGACY_TEMPLATE_TO_EVENT` (fim do arquivo) por:

```ts
/**
 * Evento → string gravada em `NotificationLog.template`. É o caminho que o dispatcher
 * usa; `LEGACY_TEMPLATE_TO_EVENT` é o inverso, usado pelo gateway e pelo serviço de
 * e-mail para voltar de string a evento. Os dois têm de ser inversos exatos — há um
 * teste garantindo isso, porque uma chave só de um lado vira "Template desconhecido"
 * e a mensagem some sem sair.
 */
export const CUSTOMER_MESSAGE_TEMPLATE_KEY: Record<CustomerMessageEventKey, string> = {
  appointment_requested: "appointment-requested",
  appointment_created: "appointment-created",
  appointment_confirmed: "appointment-confirmed",
  appointment_rescheduled: "appointment-rescheduled",
  appointment_cancelled: "appointment-cancelled",
  appointment_no_show: "appointment-no-show",
  appointment_reminder: "appointment-reminder",
  birthday: "birthday",
  return_due: "return-due",
  winback: "winback",
};

export const LEGACY_TEMPLATE_TO_EVENT: Record<string, CustomerMessageEventKey> =
  Object.fromEntries(
    Object.entries(CUSTOMER_MESSAGE_TEMPLATE_KEY).map(([evento, chave]) => [chave, evento]),
  ) as Record<string, CustomerMessageEventKey>;
```

- [ ] **Step 6: Consertar o teste de equivalência da Fase 1, que este passo quebra**

`legacy-template-backfill.test.ts` monta os casos a partir de `Object.keys(LEGACY_TEMPLATE_TO_EVENT)`, filtrando só `appointment-rescheduled`. Com as **3 chaves novas** (`appointment-requested`, `return-due`, `winback`) ele passaria a exigir equivalência byte a byte com um texto legado que **nunca existiu** para esses eventos — e falharia.

A origem correta da lista é o catálogo: "tem texto antigo a preservar" é exatamente `entrada.legacy !== null`. Substitua o bloco (linhas ~100-109) por:

```ts
  // A lista sai do catálogo, não das chaves do mapa: só há equivalência a provar onde
  // existe binding legado (`legacy !== null`). `appointment-rescheduled` continua fora
  // pelo motivo do comentário acima — tem `legacy: null` desde a Fase 1, então já cai
  // naturalmente neste filtro, e os eventos novos da Fase 2 também.
  const templatesLegados = CUSTOMER_MESSAGE_CATALOG.filter((e) => e.legacy !== null).map(
    (e) => CUSTOMER_MESSAGE_TEMPLATE_KEY[e.event],
  );
```

Acrescente `CUSTOMER_MESSAGE_TEMPLATE_KEY` ao import do topo do arquivo. Confirme que `templatesLegados` continua com **os mesmos 6 templates** de antes (`appointment-created`, `appointment-confirmed`, `appointment-cancelled`, `appointment-no-show`, `appointment-reminder`, `birthday`) — imprima o array uma vez para conferir e remova o print. Se o conjunto mudou, você alterou o comportamento do teste de equivalência, que é a proteção mais importante herdada da Fase 1.

- [ ] **Step 7: Rodar os testes e o tsc**

```bash
npx vitest run src/domains/notifications/customer-messages/
npx tsc --noEmit
```

Esperado: todos os testes de `customer-messages/` passando, **incluindo os de equivalência do backfill**. O `tsc` continua com o único erro de `scheduling.service.ts` herdado da Task 1.

> **Teste negativo obrigatório:** troque temporariamente `appointment_requested: "appointment-requested"` por `"appointment-req"` e rode o teste de inversão. Ele **deve** falhar. Cole a saída, desfaça a alteração e rode de novo. Se ele passar com a chave errada, o teste não está provando nada.

- [ ] **Step 8: Commit**

```bash
git add src/domains/notifications/customer-messages/
git commit -m "feat(notifications): canais padrao por evento e chave de log no catalogo"
```

---

## Task 3: Repository de `CustomerMessageSetting`

**Files:**
- Create: `src/domains/notifications/customer-messages/customer-message-setting.repository.ts`
- Test: `src/domains/notifications/customer-messages/customer-message-setting.repository.test.ts`

**Interfaces:**
- Consumes: `prisma` de `@/shared/database/prisma`; `CustomerMessageEventKey`, `CustomerMessageChannel`.
- Produces:
  - `type CustomerMessageSettingInput = { event: CustomerMessageEventKey; enabled: boolean; channels: CustomerMessageChannel[] }`
  - `class CustomerMessageSettingRepository` com `findByEvent(tenantId, event)`, `listByTenant(tenantId)`, `upsert(tenantId, input)`
  - `const customerMessageSettingRepository`

- [ ] **Step 1: Escrever o teste (falhando)**

`src/domains/notifications/customer-messages/customer-message-setting.repository.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { prismaMock } from "@/shared/test/prisma-mock";
import { customerMessageSettingRepository } from "./customer-message-setting.repository";

const registro = {
  id: "cfg-1",
  tenantId: "tenant-1",
  event: "appointment_created" as const,
  enabled: false,
  channels: ["WHATSAPP" as const],
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("customerMessageSettingRepository", () => {
  beforeEach(() => {
    prismaMock.customerMessageSetting.findFirst.mockResolvedValue(registro);
    prismaMock.customerMessageSetting.findMany.mockResolvedValue([registro]);
    prismaMock.customerMessageSetting.upsert.mockResolvedValue(registro);
  });

  it("findByEvent filtra por tenantId e evento", async () => {
    await customerMessageSettingRepository.findByEvent("tenant-1", "appointment_created");

    expect(prismaMock.customerMessageSetting.findFirst).toHaveBeenCalledWith({
      where: { tenantId: "tenant-1", event: "appointment_created" },
    });
  });

  it("listByTenant nunca busca sem tenantId", async () => {
    await customerMessageSettingRepository.listByTenant("tenant-1");

    expect(prismaMock.customerMessageSetting.findMany).toHaveBeenCalledWith({
      where: { tenantId: "tenant-1" },
    });
  });

  it("upsert usa a chave composta tenantId+event e não deixa o tenantId vir do input", async () => {
    await customerMessageSettingRepository.upsert("tenant-1", {
      event: "appointment_no_show",
      enabled: false,
      channels: ["WHATSAPP"],
    });

    expect(prismaMock.customerMessageSetting.upsert).toHaveBeenCalledWith({
      where: { tenantId_event: { tenantId: "tenant-1", event: "appointment_no_show" } },
      create: {
        tenantId: "tenant-1",
        event: "appointment_no_show",
        enabled: false,
        channels: ["WHATSAPP"],
      },
      update: { enabled: false, channels: ["WHATSAPP"] },
    });
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
npx vitest run src/domains/notifications/customer-messages/customer-message-setting.repository.test.ts
```

Esperado: `Failed to resolve import "./customer-message-setting.repository"`.

- [ ] **Step 3: Implementar**

`src/domains/notifications/customer-messages/customer-message-setting.repository.ts`:

```ts
import type { CustomerMessageSetting } from "@prisma/client";

import { prisma } from "@/shared/database/prisma";

import type { CustomerMessageChannel, CustomerMessageEventKey } from "./types";

export type CustomerMessageSettingInput = {
  event: CustomerMessageEventKey;
  enabled: boolean;
  channels: CustomerMessageChannel[];
};

export class CustomerMessageSettingRepository {
  async findByEvent(
    tenantId: string,
    event: CustomerMessageEventKey,
  ): Promise<CustomerMessageSetting | null> {
    return prisma.customerMessageSetting.findFirst({ where: { tenantId, event } });
  }

  async listByTenant(tenantId: string): Promise<CustomerMessageSetting[]> {
    return prisma.customerMessageSetting.findMany({ where: { tenantId } });
  }

  /**
   * O registro só passa a existir quando o tenant muda alguma coisa. Enquanto não
   * existir, a resolução cai no padrão do catálogo — mesma regra dos templates.
   * `tenantId` vem sempre do argumento (extraído da sessão), nunca do input.
   */
  async upsert(
    tenantId: string,
    input: CustomerMessageSettingInput,
  ): Promise<CustomerMessageSetting> {
    return prisma.customerMessageSetting.upsert({
      where: { tenantId_event: { tenantId, event: input.event } },
      create: {
        tenantId,
        event: input.event,
        enabled: input.enabled,
        channels: input.channels,
      },
      update: { enabled: input.enabled, channels: input.channels },
    });
  }
}

export const customerMessageSettingRepository = new CustomerMessageSettingRepository();
```

- [ ] **Step 4: Rodar e ver passar**

```bash
npx vitest run src/domains/notifications/customer-messages/customer-message-setting.repository.test.ts
npx tsc --noEmit
```

Esperado: 3 testes passando.

- [ ] **Step 5: Commit**

```bash
git add src/domains/notifications/customer-messages/customer-message-setting.repository.ts src/domains/notifications/customer-messages/customer-message-setting.repository.test.ts
git commit -m "feat(notifications): repository de CustomerMessageSetting"
```

---

## Task 4: Service de padrão do negócio

**Files:**
- Create: `src/domains/notifications/customer-messages/customer-message-setting.service.ts`
- Test: `src/domains/notifications/customer-messages/customer-message-setting.service.test.ts`
- Modify: `src/domains/notifications/customer-messages/schemas.ts`

**Interfaces:**
- Consumes: `customerMessageSettingRepository` (Task 3), `CUSTOMER_MESSAGE_CATALOG`/`getCatalogEntry` (Task 2).
- Produces:
  - `type ResolvedCustomerMessageSetting = { event: CustomerMessageEventKey; label: string; description: string; nature: CustomerMessageNature; enabled: boolean; channels: CustomerMessageChannel[]; isCustom: boolean }`
  - `class CustomerMessageSettingService` com:
    - `resolve(tenantId, event): Promise<ResolvedCustomerMessageSetting>`
    - `resolveAll(tenantId): Promise<ResolvedCustomerMessageSetting[]>`
    - `shouldNotify(tenantId, event, override?: boolean): Promise<boolean>`
    - `save(tenantId, input: UpdateCustomerMessageSettingInput): Promise<ResolvedCustomerMessageSetting>`
  - `const customerMessageSettingService`
  - `const updateCustomerMessageSettingSchema` (Zod, em `schemas.ts`)

- [ ] **Step 1: Escrever o teste (falhando)**

`src/domains/notifications/customer-messages/customer-message-setting.service.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { customerMessageSettingService } from "./customer-message-setting.service";
import { customerMessageSettingRepository } from "./customer-message-setting.repository";

vi.mock("./customer-message-setting.repository", () => ({
  customerMessageSettingRepository: {
    findByEvent: vi.fn(),
    listByTenant: vi.fn(),
    upsert: vi.fn(),
  },
}));

const repo = vi.mocked(customerMessageSettingRepository);

describe("customerMessageSettingService", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sem registro no banco, o evento vem ligado no WhatsApp (padrão do catálogo)", async () => {
    repo.findByEvent.mockResolvedValue(null);

    const resolvido = await customerMessageSettingService.resolve("t1", "appointment_created");

    expect(resolvido.enabled).toBe(true);
    expect(resolvido.channels).toEqual(["WHATSAPP"]);
    expect(resolvido.isCustom).toBe(false);
    expect(resolvido.label).toBe("Agendamento criado");
  });

  it("o registro do tenant sobrescreve o padrão", async () => {
    repo.findByEvent.mockResolvedValue({
      id: "c1",
      tenantId: "t1",
      event: "appointment_no_show",
      enabled: false,
      channels: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const resolvido = await customerMessageSettingService.resolve("t1", "appointment_no_show");

    expect(resolvido.enabled).toBe(false);
    expect(resolvido.channels).toEqual([]);
    expect(resolvido.isCustom).toBe(true);
  });

  it("resolveAll devolve os 10 eventos mesmo com o banco vazio, no padrão do catálogo", async () => {
    repo.listByTenant.mockResolvedValue([]);

    const todos = await customerMessageSettingService.resolveAll("t1");

    expect(todos).toHaveLength(10);
    // Transacional nasce ligado; promocional nasce desligado (opt-in por LGPD,
    // decisão registrada nas Global Constraints). Nunca asserir `true` para os 10.
    for (const item of todos) {
      expect(item.enabled).toBe(item.nature === "transactional");
    }
    expect(todos.filter((e) => e.enabled)).toHaveLength(7);
  });

  it("shouldNotify sem override usa o padrão do tenant", async () => {
    repo.findByEvent.mockResolvedValue(null);
    await expect(
      customerMessageSettingService.shouldNotify("t1", "appointment_created"),
    ).resolves.toBe(true);
  });

  it("shouldNotify com override false não envia, mesmo com o padrão ligado", async () => {
    repo.findByEvent.mockResolvedValue(null);
    await expect(
      customerMessageSettingService.shouldNotify("t1", "appointment_created", false),
    ).resolves.toBe(false);
  });

  it("shouldNotify com override true envia, mesmo com o padrão desligado", async () => {
    repo.findByEvent.mockResolvedValue({
      id: "c1",
      tenantId: "t1",
      event: "appointment_created",
      enabled: false,
      channels: ["WHATSAPP"],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await expect(
      customerMessageSettingService.shouldNotify("t1", "appointment_created", true),
    ).resolves.toBe(true);

    // E o override true não deve consultar o banco à toa.
    expect(repo.findByEvent).not.toHaveBeenCalled();
  });

  it("save persiste com o tenantId recebido e devolve o estado resolvido", async () => {
    repo.upsert.mockResolvedValue({
      id: "c1",
      tenantId: "t1",
      event: "birthday",
      enabled: false,
      channels: ["WHATSAPP"],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const salvo = await customerMessageSettingService.save("t1", {
      event: "birthday",
      enabled: false,
      channels: ["WHATSAPP"],
    });

    expect(repo.upsert).toHaveBeenCalledWith("t1", {
      event: "birthday",
      enabled: false,
      channels: ["WHATSAPP"],
    });
    expect(salvo.enabled).toBe(false);
    expect(salvo.isCustom).toBe(true);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
npx vitest run src/domains/notifications/customer-messages/customer-message-setting.service.test.ts
```

Esperado: `Failed to resolve import "./customer-message-setting.service"`.

- [ ] **Step 3: Adicionar o schema Zod**

Ao fim de `src/domains/notifications/customer-messages/schemas.ts`:

```ts
export const updateCustomerMessageSettingSchema = z.object({
  event: customerMessageEventSchema,
  enabled: z.boolean(),
  channels: z.array(customerMessageChannelSchema),
});

export type UpdateCustomerMessageSettingInput = z.infer<
  typeof updateCustomerMessageSettingSchema
>;
```

- [ ] **Step 4: Implementar o service**

`src/domains/notifications/customer-messages/customer-message-setting.service.ts`:

```ts
import type { CustomerMessageSetting } from "@prisma/client";

import { CUSTOMER_MESSAGE_CATALOG, getCatalogEntry } from "./customer-message-catalog";
import { customerMessageSettingRepository } from "./customer-message-setting.repository";
import type { UpdateCustomerMessageSettingInput } from "./schemas";
import type {
  CustomerMessageCatalogEntry,
  CustomerMessageChannel,
  CustomerMessageEventKey,
  CustomerMessageNature,
} from "./types";

export type ResolvedCustomerMessageSetting = {
  event: CustomerMessageEventKey;
  label: string;
  description: string;
  nature: CustomerMessageNature;
  enabled: boolean;
  channels: CustomerMessageChannel[];
  /** true = o tenant mudou este evento; false = está no padrão do sistema. */
  isCustom: boolean;
};

function combinar(
  entrada: CustomerMessageCatalogEntry,
  registro: CustomerMessageSetting | null | undefined,
): ResolvedCustomerMessageSetting {
  return {
    event: entrada.event,
    label: entrada.label,
    description: entrada.description,
    nature: entrada.nature,
    enabled: registro ? registro.enabled : entrada.defaultEnabled,
    channels: registro
      ? (registro.channels as CustomerMessageChannel[])
      : entrada.defaultChannels,
    isCustom: Boolean(registro),
  };
}

export class CustomerMessageSettingService {
  async resolve(
    tenantId: string,
    event: CustomerMessageEventKey,
  ): Promise<ResolvedCustomerMessageSetting> {
    const registro = await customerMessageSettingRepository.findByEvent(tenantId, event);
    return combinar(getCatalogEntry(event), registro);
  }

  /** Uma query só: o banco costuma ter zero ou poucas linhas por tenant. */
  async resolveAll(tenantId: string): Promise<ResolvedCustomerMessageSetting[]> {
    const registros = await customerMessageSettingRepository.listByTenant(tenantId);
    const porEvento = new Map(registros.map((r) => [r.event as CustomerMessageEventKey, r]));
    return CUSTOMER_MESSAGE_CATALOG.map((entrada) =>
      combinar(entrada, porEvento.get(entrada.event)),
    );
  }

  /**
   * A autoridade sobre "envia ou não". O override vem da ação (`notify` na rota) e vale
   * SÓ para aquela ação — nunca altera o padrão do tenant. `undefined` significa
   * "não opinei", e aí manda o padrão do negócio.
   */
  async shouldNotify(
    tenantId: string,
    event: CustomerMessageEventKey,
    override?: boolean,
  ): Promise<boolean> {
    if (override !== undefined) return override;
    return (await this.resolve(tenantId, event)).enabled;
  }

  async save(
    tenantId: string,
    input: UpdateCustomerMessageSettingInput,
  ): Promise<ResolvedCustomerMessageSetting> {
    const registro = await customerMessageSettingRepository.upsert(tenantId, {
      event: input.event,
      enabled: input.enabled,
      channels: input.channels,
    });
    return combinar(getCatalogEntry(input.event), registro);
  }
}

export const customerMessageSettingService = new CustomerMessageSettingService();
```

- [ ] **Step 5: Rodar e ver passar**

```bash
npx vitest run src/domains/notifications/customer-messages/customer-message-setting.service.test.ts
npx tsc --noEmit
```

Esperado: 7 testes passando.

- [ ] **Step 6: Commit**

```bash
git add src/domains/notifications/customer-messages/
git commit -m "feat(notifications): service que resolve o padrao de disparo por evento"
```

---

## Task 5: Dispatcher — o único caminho de envio ao cliente

**Files:**
- Create: `src/domains/notifications/customer-messages/customer-message-dispatcher.service.ts`
- Test: `src/domains/notifications/customer-messages/customer-message-dispatcher.service.test.ts`

**Interfaces:**
- Consumes: `customerMessageSettingService` (Task 4), `CUSTOMER_MESSAGE_TEMPLATE_KEY` (Task 2), `notificationService.logAndDispatch`.
- Produces:
  - `type CustomerMessageDispatchInput = { tenantId: string; event: CustomerMessageEventKey; appointmentId?: string; customerId?: string; recipient: { phone?: string | null; email?: string | null }; notifyOverride?: boolean; message?: string; payload: Record<string, unknown> }`
  - `type CustomerMessageDispatchResult = { dispatched: CustomerMessageChannel[]; skipReason: "desligado" | "sem-destinatario" | null }`
  - `class CustomerMessageDispatcherService` com `dispatch(input): Promise<CustomerMessageDispatchResult>`
  - `const customerMessageDispatcher`

### Por que existe

Sem ele, a verificação de "está ligado?" ficaria repetida em 5 handlers de evento, 2 jobs e 1 rota — oito lugares para esquecer um. Com ele, existe **um** ponto onde a decisão acontece, e as fases 3 a 5 já encontram o caminho pronto.

O `import` do `notificationService` é **dinâmico** dentro do método, seguindo o que os jobs já fazem: `notification.service.ts` importa o gateway, que importa `featureGuard` e o Prisma; um import estático aqui criaria um ciclo com `subscriptions.ts` e tornaria o teste unitário pesado.

- [ ] **Step 1: Escrever o teste (falhando)**

`src/domains/notifications/customer-messages/customer-message-dispatcher.service.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { customerMessageDispatcher } from "./customer-message-dispatcher.service";
import { customerMessageSettingService } from "./customer-message-setting.service";

const logAndDispatch = vi.fn();

vi.mock("../notification.service", () => ({
  notificationService: { logAndDispatch: (...args: unknown[]) => logAndDispatch(...args) },
}));

vi.mock("./customer-message-setting.service", () => ({
  customerMessageSettingService: { resolve: vi.fn(), shouldNotify: vi.fn() },
}));

const settings = vi.mocked(customerMessageSettingService);

function ligado(channels: ("WHATSAPP" | "EMAIL")[] = ["WHATSAPP"]) {
  settings.shouldNotify.mockResolvedValue(true);
  settings.resolve.mockResolvedValue({
    event: "appointment_created",
    label: "Agendamento criado",
    description: "",
    nature: "transactional",
    enabled: true,
    channels,
    isCustom: false,
  });
}

describe("customerMessageDispatcher", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    logAndDispatch.mockResolvedValue({ id: "log-1" });
  });

  it("envia por WhatsApp com a chave de log correta do evento", async () => {
    ligado();

    const resultado = await customerMessageDispatcher.dispatch({
      tenantId: "t1",
      event: "appointment_created",
      appointmentId: "a1",
      customerId: "c1",
      recipient: { phone: "11999990000" },
      payload: { customerName: "Maria" },
    });

    expect(resultado.dispatched).toEqual(["WHATSAPP"]);
    expect(logAndDispatch).toHaveBeenCalledTimes(1);
    expect(logAndDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "t1",
        channel: "WHATSAPP",
        template: "appointment-created",
        recipient: "11999990000",
      }),
    );
  });

  it("não envia nada quando o padrão do tenant está desligado", async () => {
    settings.shouldNotify.mockResolvedValue(false);

    const resultado = await customerMessageDispatcher.dispatch({
      tenantId: "t1",
      event: "appointment_created",
      recipient: { phone: "11999990000" },
      payload: {},
    });

    expect(resultado).toEqual({ dispatched: [], skipReason: "desligado" });
    expect(logAndDispatch).not.toHaveBeenCalled();
    // Nem chega a resolver canais quando já sabe que não envia.
    expect(settings.resolve).not.toHaveBeenCalled();
  });

  it("repassa o override ao service — a decisão é do service, não do chamador", async () => {
    settings.shouldNotify.mockResolvedValue(false);

    await customerMessageDispatcher.dispatch({
      tenantId: "t1",
      event: "appointment_created",
      notifyOverride: false,
      recipient: { phone: "11999990000" },
      payload: {},
    });

    expect(settings.shouldNotify).toHaveBeenCalledWith("t1", "appointment_created", false);
  });

  it("pula o canal sem destinatário e reporta quando nenhum canal tem para onde enviar", async () => {
    ligado(["WHATSAPP", "EMAIL"]);

    const resultado = await customerMessageDispatcher.dispatch({
      tenantId: "t1",
      event: "appointment_created",
      recipient: { phone: null, email: null },
      payload: {},
    });

    expect(resultado).toEqual({ dispatched: [], skipReason: "sem-destinatario" });
    expect(logAndDispatch).not.toHaveBeenCalled();
  });

  it("envia nos dois canais quando os dois estão ligados e há destinatário", async () => {
    ligado(["WHATSAPP", "EMAIL"]);

    const resultado = await customerMessageDispatcher.dispatch({
      tenantId: "t1",
      event: "appointment_created",
      recipient: { phone: "11999990000", email: "maria@exemplo.com" },
      payload: {},
    });

    expect(resultado.dispatched).toEqual(["WHATSAPP", "EMAIL"]);
    expect(logAndDispatch).toHaveBeenCalledTimes(2);
  });

  it("a mensagem pontual entra no payload como `message`, que tem precedência sobre o template", async () => {
    ligado();

    await customerMessageDispatcher.dispatch({
      tenantId: "t1",
      event: "appointment_cancelled",
      recipient: { phone: "11999990000" },
      message: "Oi Maria, precisei cancelar hoje.",
      payload: { customerName: "Maria" },
    });

    expect(logAndDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({ message: "Oi Maria, precisei cancelar hoje." }),
      }),
    );
  });

  it("uma falha num canal não impede o outro, e nada escapa do dispatch", async () => {
    ligado(["WHATSAPP", "EMAIL"]);
    logAndDispatch.mockRejectedValueOnce(new Error("provedor fora do ar"));

    const resultado = await customerMessageDispatcher.dispatch({
      tenantId: "t1",
      event: "appointment_created",
      recipient: { phone: "11999990000", email: "maria@exemplo.com" },
      payload: {},
    });

    expect(resultado.dispatched).toEqual(["EMAIL"]);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
npx vitest run src/domains/notifications/customer-messages/customer-message-dispatcher.service.test.ts
```

Esperado: `Failed to resolve import "./customer-message-dispatcher.service"`.

- [ ] **Step 3: Implementar**

`src/domains/notifications/customer-messages/customer-message-dispatcher.service.ts`:

```ts
import { NotificationChannel } from "@prisma/client";

import { CUSTOMER_MESSAGE_TEMPLATE_KEY } from "./customer-message-catalog";
import { customerMessageSettingService } from "./customer-message-setting.service";
import type { CustomerMessageChannel, CustomerMessageEventKey } from "./types";

export type CustomerMessageDispatchInput = {
  tenantId: string;
  event: CustomerMessageEventKey;
  appointmentId?: string;
  customerId?: string;
  recipient: { phone?: string | null; email?: string | null };
  /** Override pontual da ação. `undefined` = usa o padrão do tenant. */
  notifyOverride?: boolean;
  /** Mensagem escrita na hora pelo profissional; tem precedência sobre o template. */
  message?: string;
  /** Dados do template — vira `NotificationLog.payload`. */
  payload: Record<string, unknown>;
};

export type CustomerMessageDispatchResult = {
  dispatched: CustomerMessageChannel[];
  skipReason: "desligado" | "sem-destinatario" | null;
};

/**
 * Único caminho de envio de mensagem AO CLIENTE. Resolve o padrão do negócio (com
 * override pontual), escolhe os canais e delega o transporte ao notificationService.
 *
 * Toda falha é contida: este método é chamado de handlers assíncronos do event bus,
 * que engolem rejeições — deixar escapar significaria mensagem sumindo sem rastro.
 */
export class CustomerMessageDispatcherService {
  async dispatch(input: CustomerMessageDispatchInput): Promise<CustomerMessageDispatchResult> {
    const enviar = await customerMessageSettingService.shouldNotify(
      input.tenantId,
      input.event,
      input.notifyOverride,
    );
    if (!enviar) {
      return { dispatched: [], skipReason: "desligado" };
    }

    const { channels } = await customerMessageSettingService.resolve(
      input.tenantId,
      input.event,
    );

    const { notificationService } = await import("../notification.service");

    const template = CUSTOMER_MESSAGE_TEMPLATE_KEY[input.event];
    const payload = {
      ...input.payload,
      ...(input.message ? { message: input.message } : {}),
    };

    const dispatched: CustomerMessageChannel[] = [];

    for (const channel of channels) {
      const destinatario =
        channel === "WHATSAPP" ? input.recipient.phone : input.recipient.email;
      if (!destinatario) continue;

      try {
        await notificationService.logAndDispatch({
          tenantId: input.tenantId,
          appointmentId: input.appointmentId,
          customerId: input.customerId,
          channel:
            channel === "WHATSAPP" ? NotificationChannel.WHATSAPP : NotificationChannel.EMAIL,
          template,
          recipient: destinatario,
          payload,
        });
        dispatched.push(channel);
      } catch (err) {
        // logAndDispatch já converte falha de envio em log FAILED; um throw aqui é
        // falha da própria gravação do log. Registrar e seguir para o outro canal.
        console.error(
          "[customer-messages] Falha ao despachar",
          input.event,
          channel,
          err instanceof Error ? err.message : err,
        );
      }
    }

    return {
      dispatched,
      skipReason: dispatched.length === 0 ? "sem-destinatario" : null,
    };
  }
}

export const customerMessageDispatcher = new CustomerMessageDispatcherService();
```

- [ ] **Step 4: Rodar e ver passar**

```bash
npx vitest run src/domains/notifications/customer-messages/customer-message-dispatcher.service.test.ts
npx tsc --noEmit
```

Esperado: 7 testes passando.

> **Teste negativo obrigatório:** troque `input.notifyOverride` por `undefined` na chamada de `shouldNotify` e rode. O teste "repassa o override ao service" **deve** falhar. Cole a saída e desfaça.

- [ ] **Step 5: Commit**

```bash
git add src/domains/notifications/customer-messages/
git commit -m "feat(notifications): dispatcher unico de mensagem ao cliente"
```

---

## Task 6: API da matriz de padrões

**Files:**
- Create: `src/app/api/notifications/customer-messages/settings/route.ts`
- Test: `src/app/api/notifications/customer-messages/settings/route.test.ts`

**Interfaces:**
- Consumes: `customerMessageSettingService` (Task 4), `updateCustomerMessageSettingSchema` (Task 4).
- Produces: `GET` → `{ items: ResolvedCustomerMessageSetting[] }`; `PUT` → `ResolvedCustomerMessageSetting`.

### Permissões

- `GET`: `PERMISSIONS.settings.view`. **Não** é o endpoint consumido pelos modais de agendamento — esse é o da Task 10, que não exige permissão de configuração (precedente do ADR-016).
- `PUT`: `PERMISSIONS.settings.manage`.

- [ ] **Step 1: Escrever o teste (falhando)**

`src/app/api/notifications/customer-messages/settings/route.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/app/api/_lib/runtime", () => ({ initializeDomainRuntime: vi.fn() }));
vi.mock("@/shared/auth/session", () => ({ getSessionContext: vi.fn() }));
vi.mock("@/domains/notifications/customer-messages/customer-message-setting.service", () => ({
  customerMessageSettingService: { resolveAll: vi.fn(), save: vi.fn() },
}));

import { getSessionContext } from "@/shared/auth/session";
import { customerMessageSettingService } from "@/domains/notifications/customer-messages/customer-message-setting.service";
import { GET, PUT } from "./route";

const session = vi.mocked(getSessionContext);
const service = vi.mocked(customerMessageSettingService);

const resolvido = {
  event: "birthday" as const,
  label: "Aniversário",
  description: "",
  nature: "promotional" as const,
  enabled: false,
  channels: ["WHATSAPP" as const],
  isCustom: true,
};

function sessaoDono() {
  session.mockResolvedValue({
    tenantId: "tenant-1",
    userId: "user-1",
    isOwner: true,
    permissions: {},
  } as unknown as Awaited<ReturnType<typeof getSessionContext>>);
}

describe("/api/notifications/customer-messages/settings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessaoDono();
  });

  it("GET devolve a matriz do tenant da sessão", async () => {
    service.resolveAll.mockResolvedValue([resolvido]);

    const res = await GET(new Request("http://localhost/api/notifications/customer-messages/settings"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(service.resolveAll).toHaveBeenCalledWith("tenant-1");
    expect(body.items).toHaveLength(1);
  });

  it("PUT salva usando o tenantId da sessão, ignorando qualquer tenantId do body", async () => {
    service.save.mockResolvedValue(resolvido);

    const res = await PUT(
      new Request("http://localhost/api/notifications/customer-messages/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId: "tenant-INVASOR",
          event: "birthday",
          enabled: false,
          channels: ["WHATSAPP"],
        }),
      }),
    );

    expect(res.status).toBe(200);
    expect(service.save).toHaveBeenCalledWith("tenant-1", {
      event: "birthday",
      enabled: false,
      channels: ["WHATSAPP"],
    });
  });

  it("PUT rejeita evento fora do enum", async () => {
    const res = await PUT(
      new Request("http://localhost/api/notifications/customer-messages/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event: "evento_inventado", enabled: true, channels: [] }),
      }),
    );

    expect(res.status).toBe(422);
    expect(service.save).not.toHaveBeenCalled();
  });
});
```

> `validateInput` usa `schema.parse`, que **remove** chaves não declaradas. O teste do `tenantId: "tenant-INVASOR"` prova que a chave extra não chega ao service.
> `ValidationError` responde 422 — confirme em `src/shared/errors/` e em `handle-api-error.ts` antes de fechar a tarefa; se for 400, ajuste o teste ao comportamento real do projeto em vez de mudar o handler.

- [ ] **Step 2: Rodar e ver falhar**

```bash
npx vitest run src/app/api/notifications/customer-messages/settings/route.test.ts
```

Esperado: `Failed to resolve import "./route"`.

- [ ] **Step 3: Implementar**

`src/app/api/notifications/customer-messages/settings/route.ts`:

```ts
import { initializeDomainRuntime } from "@/app/api/_lib/runtime";
import { customerMessageSettingService } from "@/domains/notifications/customer-messages/customer-message-setting.service";
import { updateCustomerMessageSettingSchema } from "@/domains/notifications/customer-messages/schemas";
import { ensurePermission, PERMISSIONS } from "@/shared/auth/permissions";
import { getSessionContext } from "@/shared/auth/session";
import { handleApiError } from "@/shared/http/handle-api-error";
import { validateInput } from "@/shared/http/validate-input";

export async function GET(request: Request) {
  initializeDomainRuntime();
  try {
    const session = await getSessionContext(request);
    ensurePermission(session, PERMISSIONS.settings.view);

    const items = await customerMessageSettingService.resolveAll(session.tenantId);
    return Response.json({ items });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request: Request) {
  initializeDomainRuntime();
  try {
    const session = await getSessionContext(request);
    ensurePermission(session, PERMISSIONS.settings.manage);

    const input = await validateInput(request, updateCustomerMessageSettingSchema);

    // tenantId vem SEMPRE da sessão — nunca do body.
    const salvo = await customerMessageSettingService.save(session.tenantId, input);
    return Response.json(salvo);
  } catch (error) {
    return handleApiError(error);
  }
}
```

- [ ] **Step 4: Rodar e ver passar**

```bash
npx vitest run src/app/api/notifications/customer-messages/settings/route.test.ts
npx tsc --noEmit
```

Esperado: 3 testes passando.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/notifications/customer-messages/settings/
git commit -m "feat(notifications): API da matriz de padroes de mensagem ao cliente"
```

---

## Task 7: UI — matriz evento × canal na aba "Mensagens ao cliente"

**Files:**
- Create: `src/hooks/settings/use-customer-message-settings.ts`
- Create: `src/components/domain/settings/customer-message-settings-matrix.tsx`
- Test: `src/components/domain/settings/customer-message-settings-matrix.test.tsx`
- Modify: `src/components/domain/settings/customer-message-list.tsx`

**Interfaces:**
- Consumes: `GET|PUT /api/notifications/customer-messages/settings` (Task 6); `useCustomerMessageTemplates` (Fase 1).
- Produces:
  - `type CustomerMessageSettingItem = { event: string; label: string; description: string; nature: "transactional" | "promotional"; enabled: boolean; channels: ("WHATSAPP" | "EMAIL")[]; isCustom: boolean }`
  - `useCustomerMessageSettings()`, `useUpdateCustomerMessageSetting()`
  - `<CustomerMessageSettingsMatrix onEditTemplate={(event, channel) => void} />`

### Desenho — mobile e desktop

**Mobile (base):** um cartão por evento. Título + descrição, `Switch` à direita (alvo ≥44×44). Com o evento ligado, uma linha de canais (checkbox WhatsApp, checkbox E-mail) e, abaixo, os botões "Editar WhatsApp" / "Editar e-mail". Nunca tabela espremida com rolagem horizontal.

**Desktop (`md:`):** tabela de 4 colunas — Evento | Ativo | Canais | Mensagem.

A lista de templates da Fase 1 é **substituída** por esta matriz: os botões de editar template passam a viver dentro dela, evitando duas listas dos mesmos 10 eventos na mesma aba. `customer-message-list.tsx` continua sendo o componente montado pela página, mas passa a renderizar a matriz e a hospedar o `<CustomerMessageEditor>`.

- [ ] **Step 1: Criar o hook**

`src/hooks/settings/use-customer-message-settings.ts`:

```ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export type CustomerMessageSettingItem = {
  event: string;
  label: string;
  description: string;
  nature: "transactional" | "promotional";
  enabled: boolean;
  channels: ("WHATSAPP" | "EMAIL")[];
  isCustom: boolean;
};

const CHAVE = ["customer-message-settings"];

export function useCustomerMessageSettings() {
  return useQuery({
    queryKey: CHAVE,
    queryFn: async (): Promise<CustomerMessageSettingItem[]> => {
      const res = await fetch("/api/notifications/customer-messages/settings");
      if (!res.ok) throw new Error("Falha ao carregar os avisos ao cliente");
      const json = await res.json();
      return json.items;
    },
    staleTime: 60_000,
  });
}

export function useUpdateCustomerMessageSetting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      event: string;
      enabled: boolean;
      channels: ("WHATSAPP" | "EMAIL")[];
    }) => {
      const res = await fetch("/api/notifications/customer-messages/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error("Falha ao salvar o aviso");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CHAVE });
      // A prévia dos modais lê o mesmo padrão — invalidar para não mostrar o estado velho.
      qc.invalidateQueries({ queryKey: ["customer-message-preview"] });
    },
  });
}
```

- [ ] **Step 2: Escrever o teste do componente (falhando)**

`src/components/domain/settings/customer-message-settings-matrix.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { CustomerMessageSettingsMatrix } from './customer-message-settings-matrix'
import type { CustomerMessageSettingItem } from '@/hooks/settings/use-customer-message-settings'

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const mutate = vi.fn()

vi.mock('@/hooks/settings/use-customer-message-settings', async () => {
  const real = await vi.importActual<typeof import('@/hooks/settings/use-customer-message-settings')>(
    '@/hooks/settings/use-customer-message-settings',
  )
  return {
    ...real,
    useCustomerMessageSettings: () => ({ data: itens, isLoading: false, isError: false }),
    useUpdateCustomerMessageSetting: () => ({ mutate, isPending: false }),
  }
})

const itens: CustomerMessageSettingItem[] = [
  {
    event: 'appointment_created',
    label: 'Agendamento criado',
    description: 'Quando você marca um horário pelo painel.',
    nature: 'transactional',
    enabled: true,
    channels: ['WHATSAPP'],
    isCustom: false,
  },
  {
    event: 'birthday',
    label: 'Aniversário',
    description: 'Parabéns no dia do aniversário.',
    nature: 'promotional',
    enabled: false,
    channels: [],
    isCustom: true,
  },
]

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

afterEach(() => {
  cleanup()
  mutate.mockClear()
})

describe('CustomerMessageSettingsMatrix', () => {
  it('mostra um cartão por evento com o switch refletindo o padrão do negócio', () => {
    render(<CustomerMessageSettingsMatrix onEditTemplate={vi.fn()} />, { wrapper })

    const cartaoCriado = screen.getByTestId('mensagem-cliente-appointment_created')
    expect(within(cartaoCriado).getByRole('switch')).toBeChecked()

    const cartaoAniversario = screen.getByTestId('mensagem-cliente-birthday')
    expect(within(cartaoAniversario).getByRole('switch')).not.toBeChecked()
  })

  it('desligar um evento salva enabled=false preservando os canais', async () => {
    render(<CustomerMessageSettingsMatrix onEditTemplate={vi.fn()} />, { wrapper })

    const cartao = screen.getByTestId('mensagem-cliente-appointment_created')
    await userEvent.click(within(cartao).getByRole('switch'))

    expect(mutate).toHaveBeenCalledWith(
      { event: 'appointment_created', enabled: false, channels: ['WHATSAPP'] },
      expect.anything(),
    )
  })

  it('marcar o canal e-mail salva os dois canais', async () => {
    render(<CustomerMessageSettingsMatrix onEditTemplate={vi.fn()} />, { wrapper })

    const cartao = screen.getByTestId('mensagem-cliente-appointment_created')
    await userEvent.click(within(cartao).getByRole('checkbox', { name: /e-mail/i }))

    expect(mutate).toHaveBeenCalledWith(
      { event: 'appointment_created', enabled: true, channels: ['WHATSAPP', 'EMAIL'] },
      expect.anything(),
    )
  })

  it('evento desligado não mostra os canais nem o botão de editar mensagem', () => {
    render(<CustomerMessageSettingsMatrix onEditTemplate={vi.fn()} />, { wrapper })

    const cartao = screen.getByTestId('mensagem-cliente-birthday')
    expect(within(cartao).queryByRole('checkbox', { name: /e-mail/i })).not.toBeInTheDocument()
  })

  it('marca visualmente as mensagens promocionais', () => {
    render(<CustomerMessageSettingsMatrix onEditTemplate={vi.fn()} />, { wrapper })
    expect(screen.getByText('Promocional')).toBeInTheDocument()
  })
})
```

- [ ] **Step 3: Rodar e ver falhar**

```bash
npx vitest run src/components/domain/settings/customer-message-settings-matrix.test.tsx
```

Esperado: `Failed to resolve import "./customer-message-settings-matrix"`.

- [ ] **Step 4: Implementar o componente**

`src/components/domain/settings/customer-message-settings-matrix.tsx`:

```tsx
"use client";

import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import {
  useCustomerMessageSettings,
  useUpdateCustomerMessageSetting,
  type CustomerMessageSettingItem,
} from "@/hooks/settings/use-customer-message-settings";

type Canal = "WHATSAPP" | "EMAIL";

type Props = {
  onEditTemplate: (event: string, channel: Canal) => void;
};

export function CustomerMessageSettingsMatrix({ onEditTemplate }: Props) {
  const { data: itens, isLoading, isError } = useCustomerMessageSettings();
  const update = useUpdateCustomerMessageSetting();

  function salvar(item: CustomerMessageSettingItem, enabled: boolean, channels: Canal[]) {
    update.mutate(
      { event: item.event, enabled, channels },
      {
        onSuccess: () => toast.success("Aviso ao cliente atualizado"),
        onError: () => toast.error("Não foi possível salvar. Tente de novo."),
      },
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <p className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
        Não foi possível carregar os avisos ao cliente.
      </p>
    );
  }

  if (!itens || itens.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhum aviso configurável no momento.</p>;
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Estes são os padrões do seu negócio. Em cada agendamento você ainda pode decidir
        avisar ou não aquele cliente, sem mudar o padrão.
      </p>

      {itens.map((item) => {
        const canais = item.channels;
        const alternarCanal = (canal: Canal, marcado: boolean) => {
          // Preserva a ordem WHATSAPP → EMAIL, para o estado salvo ser estável.
          const proximos = (["WHATSAPP", "EMAIL"] as Canal[]).filter((c) =>
            c === canal ? marcado : canais.includes(c),
          );
          salvar(item, item.enabled, proximos);
        };

        return (
          <div
            key={item.event}
            data-testid={`mensagem-cliente-${item.event}`}
            className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium text-foreground">{item.label}</p>
                  {item.nature === "promotional" && <Badge variant="outline">Promocional</Badge>}
                </div>
                <p className="text-xs text-muted-foreground">{item.description}</p>
              </div>
              <Switch
                className="shrink-0"
                checked={item.enabled}
                disabled={update.isPending}
                onCheckedChange={(v) => salvar(item, v, canais)}
                aria-label={`Avisar o cliente: ${item.label}`}
              />
            </div>

            {item.enabled && (
              <div className="flex flex-col gap-3 border-t border-border pt-3 md:flex-row md:items-center md:gap-4">
                <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
                  <Checkbox
                    checked={canais.includes("WHATSAPP")}
                    disabled={update.isPending}
                    onCheckedChange={(v) => alternarCanal("WHATSAPP", v === true)}
                    aria-label="Canal WhatsApp"
                  />
                  WhatsApp
                </label>
                <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
                  <Checkbox
                    checked={canais.includes("EMAIL")}
                    disabled={update.isPending}
                    onCheckedChange={(v) => alternarCanal("EMAIL", v === true)}
                    aria-label="Canal e-mail"
                  />
                  E-mail
                </label>

                <div className="flex flex-wrap gap-2 md:ml-auto">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="min-h-11"
                    onClick={() => onEditTemplate(item.event, "WHATSAPP")}
                  >
                    Editar WhatsApp
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="min-h-11"
                    onClick={() => onEditTemplate(item.event, "EMAIL")}
                  >
                    Editar e-mail
                  </Button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
```

> A matriz usa **cartões nas duas larguras**, com a linha de canais virando horizontal a partir de `md:`. É a leitura fiel de "nunca uma tabela espremida com rolagem horizontal" (spec §11) sem manter duas árvores de markup em sincronia. O componente da Fase 1 que já tinha `<table className="hidden md:table">` é substituído — ver Step 5.

- [ ] **Step 5: Ligar a matriz na aba**

Substitua **todo** o conteúdo de `src/components/domain/settings/customer-message-list.tsx` por:

```tsx
"use client";

import { useMemo, useState } from "react";
import { CustomerMessageSettingsMatrix } from "@/components/domain/settings/customer-message-settings-matrix";
import { CustomerMessageEditor } from "@/components/domain/settings/customer-message-editor";
import {
  useCustomerMessageTemplates,
  type CustomerMessageTemplateItem,
} from "@/hooks/settings/use-customer-message-templates";

export function CustomerMessageList() {
  const { data: templates } = useCustomerMessageTemplates();
  const [editando, setEditando] = useState<{ event: string; channel: "WHATSAPP" | "EMAIL" } | null>(
    null,
  );

  const item = useMemo<CustomerMessageTemplateItem | null>(() => {
    if (!editando || !templates) return null;
    return (
      templates.find((t) => t.event === editando.event && t.channel === editando.channel) ?? null
    );
  }, [editando, templates]);

  return (
    <div className="space-y-4">
      <CustomerMessageSettingsMatrix
        onEditTemplate={(event, channel) => setEditando({ event, channel })}
      />

      <CustomerMessageEditor
        open={item !== null}
        item={item}
        onOpenChange={(open) => {
          if (!open) setEditando(null);
        }}
      />
    </div>
  );
}
```

- [ ] **Step 6: Ajustar o teste da Fase 1**

`src/components/domain/settings/customer-message-list.test.tsx` testa a lista antiga (tabela/cartões de template), que deixou de existir. Reescreva-o para cobrir apenas a nova responsabilidade do componente: **abrir o editor com o template certo quando a matriz pede**.

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { CustomerMessageList } from './customer-message-list'
import type { CustomerMessageTemplateItem } from '@/hooks/settings/use-customer-message-templates'

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const templates: CustomerMessageTemplateItem[] = [
  {
    event: 'appointment_created',
    channel: 'WHATSAPP',
    label: 'Agendamento criado',
    description: 'Quando você marca um horário pelo painel.',
    nature: 'transactional',
    variables: ['cliente'],
    subject: null,
    body: 'Olá, {{cliente}}!',
    mediaUrl: null,
    isCustom: false,
    defaultBody: 'Olá, {{cliente}}!',
    defaultSubject: null,
  },
]

vi.mock('@/hooks/settings/use-customer-message-templates', async () => {
  const real = await vi.importActual<
    typeof import('@/hooks/settings/use-customer-message-templates')
  >('@/hooks/settings/use-customer-message-templates')
  return {
    ...real,
    useCustomerMessageTemplates: () => ({ data: templates, isLoading: false, isError: false }),
    useUpdateCustomerMessageTemplate: () => ({ mutate: vi.fn(), isPending: false }),
    useResetCustomerMessageTemplate: () => ({ mutate: vi.fn(), isPending: false }),
  }
})

vi.mock('@/hooks/settings/use-customer-message-settings', async () => {
  const real = await vi.importActual<
    typeof import('@/hooks/settings/use-customer-message-settings')
  >('@/hooks/settings/use-customer-message-settings')
  return {
    ...real,
    useCustomerMessageSettings: () => ({
      data: [
        {
          event: 'appointment_created',
          label: 'Agendamento criado',
          description: 'Quando você marca um horário pelo painel.',
          nature: 'transactional' as const,
          enabled: true,
          channels: ['WHATSAPP' as const],
          isCustom: false,
        },
      ],
      isLoading: false,
      isError: false,
    }),
    useUpdateCustomerMessageSetting: () => ({ mutate: vi.fn(), isPending: false }),
  }
})

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

afterEach(cleanup)

describe('CustomerMessageList', () => {
  it('abre o editor com o template do canal escolhido na matriz', async () => {
    render(<CustomerMessageList />, { wrapper })

    await userEvent.click(screen.getByRole('button', { name: 'Editar WhatsApp' }))

    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Olá, {{cliente}}!')).toBeInTheDocument()
  })
})
```

> Se o `<CustomerMessageEditor>` renderizar o corpo com outro elemento (ex.: `textarea` com `defaultValue`), ajuste a asserção ao que ele realmente faz — **leia o componente antes**, não adivinhe.

- [ ] **Step 7: Rodar e ver passar**

```bash
npx vitest run src/components/domain/settings/
npx tsc --noEmit
```

Esperado: matriz e lista passando; nenhum teste novo falhando.

- [ ] **Step 8: Conferir mobile e desktop**

Se o app subir (`npm run dev`), abra **Configurações › Notificações › Mensagens ao cliente** em 375px e 1440px e confirme:
- nenhum scroll horizontal no `body` em 375px;
- switch e checkboxes com alvo ≥44px;
- estados de carregando/erro/vazio visíveis (force cada um desligando a rede no DevTools).

Se o banco local estiver fora do ar (foi o caso na Fase 1, e a UI dela nunca chegou a ser validada visualmente), registre isso explicitamente no relatório da tarefa em vez de afirmar que conferiu.

- [ ] **Step 9: Commit**

```bash
git add src/hooks/settings/use-customer-message-settings.ts src/components/domain/settings/
git commit -m "feat(settings): matriz de avisos ao cliente por evento e canal"
```

---

## Task 8: Contrato `notify`, origem persistida e o evento `appointment_requested`

**Files:**
- Modify: `src/shared/events/domain-events.ts`
- Modify: `src/domains/scheduling/types.ts`
- Modify: `src/domains/scheduling/scheduling.service.ts`
- Modify: `src/domains/notifications/subscriptions.ts`
- Modify: `src/hooks/scheduling/use-appointments.ts`
- Test: `src/domains/notifications/subscriptions.test.ts` (novo)

**Interfaces:**
- Consumes: `customerMessageDispatcher` (Task 5).
- Produces:
  - `AppointmentEventPayload` ganha `notify?: boolean`, e `origin` passa a existir dentro de `appointment`
  - `RescheduledEventPayload` ganha `customerEmail: string | null` e `notify?: boolean`
  - `createAppointmentSchema`, `updateAppointmentStatusSchema` e `updateAppointmentSchema` ganham `notify: z.boolean().optional()`

### A regra de fronteira entre domínios

`scheduling` **não pode** importar `notifications` (CLAUDE.md). Por isso o `notify` que chega na rota atravessa o service de agendamento **sem ser interpretado** e viaja cru no payload do evento. Quem resolve `override ?? padrão do tenant` é o `customerMessageSettingService`, chamado pelo dispatcher, dentro do domínio de notificações. Isso cumpre a exigência da spec ("resolvido no service; a decisão nunca fica apenas no cliente") sem furar a arquitetura.

- [ ] **Step 1: Ajustar os payloads de evento**

Em `src/shared/events/domain-events.ts`, no `AppointmentEventPayload`, substitua o fim do tipo por:

```ts
  notificationMessage?: string;
  origin?: "panel" | "public";
  /**
   * Override pontual vindo da ação (`notify` na rota). `undefined` significa
   * "não opinei" — o padrão do negócio decide, resolvido no domínio de notificações.
   * Nunca interprete este campo dentro de scheduling.
   */
  notify?: boolean;
};
```

E no `RescheduledEventPayload`, acrescente antes do fecho:

```ts
  customerEmail: string | null;
  notify?: boolean;
```

- [ ] **Step 2: Aceitar `notify` nos schemas de agendamento**

Em `src/domains/scheduling/types.ts`:

- em `createAppointmentSchema`, ao lado de `notificationMessage`:
  ```ts
    notify: z.boolean().optional(),
  ```
- em `updateAppointmentStatusSchema`, idem:
  ```ts
    notify: z.boolean().optional(),
  ```
- em `updateAppointmentSchema`, idem (antes do `.refine`):
  ```ts
      notify: z.boolean().optional(),
  ```

- [ ] **Step 3: Persistir a origem e repassar o `notify` no scheduling service**

Em `src/domains/scheduling/scheduling.service.ts`:

1. Acrescente `AppointmentOrigin` ao import de `@prisma/client` que já existe no topo do arquivo.

2. Em `createAppointment`, dentro do objeto passado a `appointmentRepository.create`, acrescente após `createdByUserId: userId,`:
   ```ts
              origin: origin === "public" ? AppointmentOrigin.PUBLIC : AppointmentOrigin.PANEL,
   ```
   (`appointmentRepository.create` aceita `Omit<Prisma.AppointmentUncheckedCreateInput, "tenantId">` — o campo passa direto, sem mudar o repositório.)

3. No `eventBus.publish` de `scheduling.appointment.created` dentro de `createAppointment`:
   ```ts
       payload: {
         ...this.toAppointmentEventPayload(tenantId, appointmentDetails),
         notificationMessage: input.notificationMessage,
         notify: input.notify,
         origin,
       },
   ```

4. Em `toAppointmentEventPayload`, dentro do objeto `appointment`, acrescente ao lado de `status`:
   ```ts
         origin: appointment.origin,
   ```
   Isto resolve o erro de `tsc` deixado pela Task 1.

5. Em `updateAppointmentStatus`, substitua o `eventBus.publish` por:
   ```ts
       eventBus.publish({
         type: eventType,
         payload: {
           ...this.toAppointmentEventPayload(tenantId, appointment),
           // `notify` vale para QUALQUER status — inclusive no-show, que é o disparo
           // mais delicado e por isso precisa de override no momento da ação.
           notify: input.notify,
           // NO_SHOW entrou nesta lista na Fase 2: o <CustomerMessageToggle> do diálogo
           // de não comparecimento oferece "escrever outra mensagem" como em todos os
           // outros pontos, e sem NO_SHOW aqui esse botão salvaria um texto que nunca
           // chegaria ao dispatcher — um controle que não faz nada.
           ...([
             AppointmentStatus.CANCELLED,
             AppointmentStatus.CONFIRMED,
             AppointmentStatus.NO_SHOW,
           ] as AppointmentStatus[]).includes(input.status)
             ? { notificationMessage: input.notificationMessage }
             : {},
         },
       });
   ```

   Acrescente o caso correspondente ao `subscriptions.test.ts` do Step 4:

   ```ts
   it("no-show repassa a mensagem pontual escrita no diálogo", async () => {
     await handlers.get("scheduling.appointment.no_show")!(
       agendamento({ notificationMessage: "Passou o horário, me avisa quando puder vir." }),
     );

     expect(dispatch).toHaveBeenCalledWith(
       expect.objectContaining({
         event: "appointment_no_show",
         message: "Passou o horário, me avisa quando puder vir.",
       }),
     );
   });
   ```

   E, no handler de `no_show` do Step 6, desestruture `notificationMessage` e passe `message: notificationMessage` ao dispatcher (o bloco escrito ali não tem esse campo — corrija).

6. Em `updateAppointment`, no `eventBus.publish` de `scheduling.appointment.rescheduled`, acrescente:
   ```ts
           customerEmail: current.customer.email,
           notify: input.notify,
   ```

> Confirme que `appointmentRepository.findById` traz `customer.email` antes de usar `current.customer.email` — **leia o repositório**, não assuma. Se não trouxer, inclua no `select`/`include`.

- [ ] **Step 4: Escrever o teste das subscriptions (falhando)**

`src/domains/notifications/subscriptions.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from "vitest";

const dispatch = vi.fn();

vi.mock("./customer-messages/customer-message-dispatcher.service", () => ({
  customerMessageDispatcher: { dispatch: (...args: unknown[]) => dispatch(...args) },
}));

type Handler = (payload: never) => Promise<void>;

const handlers = new Map<string, Handler>();

// Duas armadilhas aqui, ambas já custaram tempo:
//
// 1. `subscriptions.ts` tem um guard de módulo (`notificationsRegistered`) que faz a
//    segunda chamada de registerNotificationSubscriptions() virar no-op. Sem
//    `vi.resetModules()`, só o PRIMEIRO caso teria handlers e todos os outros
//    quebrariam com "handlers.get(...) is not a function".
// 2. Depois de `resetModules`, o mock de `@/shared/events/event-bus` é reconstruído.
//    Um `import { eventBus }` estático no topo deste arquivo apontaria para a instância
//    ANTIGA, e a mockImplementation não valeria para o módulo recém-importado. Por isso
//    o eventBus também é importado dentro do beforeEach, depois do reset.
beforeEach(async () => {
  vi.clearAllMocks();
  vi.resetModules();
  handlers.clear();

  const { eventBus } = await import("@/shared/events/event-bus");
  vi.mocked(eventBus.subscribe).mockImplementation(((tipo: string, handler: Handler) => {
    handlers.set(tipo, handler);
  }) as unknown as typeof eventBus.subscribe);

  const { registerNotificationSubscriptions } = await import("./subscriptions");
  registerNotificationSubscriptions();
});

function agendamento(overrides: Record<string, unknown> = {}) {
  return {
    tenantId: "t1",
    appointment: {
      id: "a1",
      status: "SCHEDULED",
      startsAt: new Date("2026-08-02T17:00:00.000Z"),
      origin: "PANEL",
    },
    customer: { id: "c1", name: "Maria Silva", phone: "11999990000", email: "maria@ex.com" },
    service: { id: "s1", name: "Escova", duration: 45 },
    professional: { id: "p1", name: "Ana Souza", email: "ana@ex.com" },
    ...overrides,
  } as never;
}

describe("registerNotificationSubscriptions", () => {
  it("agendamento do painel dispara appointment_created", async () => {
    await handlers.get("scheduling.appointment.created")!(agendamento({ origin: "panel" }));

    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ event: "appointment_created", tenantId: "t1" }),
    );
  });

  it("agendamento da vitrine dispara appointment_requested, não appointment_created", async () => {
    await handlers.get("scheduling.appointment.created")!(agendamento({ origin: "public" }));

    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ event: "appointment_requested" }),
    );
  });

  it("leva o nome do profissional para o template", async () => {
    await handlers.get("scheduling.appointment.created")!(agendamento({ origin: "panel" }));

    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({ professionalName: "Ana Souza" }),
      }),
    );
  });

  it("o notify da ação é repassado como override, não interpretado aqui", async () => {
    await handlers.get("scheduling.appointment.created")!(
      agendamento({ origin: "panel", notify: false }),
    );

    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ notifyOverride: false }));
  });

  it("confirmação de agendamento do painel não manda segunda mensagem", async () => {
    await handlers.get("scheduling.appointment.confirmed")!(agendamento());

    expect(dispatch).not.toHaveBeenCalled();
  });

  it("confirmação de pedido nascido online manda appointment_confirmed", async () => {
    await handlers.get("scheduling.appointment.confirmed")!(
      agendamento({
        appointment: { id: "a1", status: "CONFIRMED", startsAt: new Date(), origin: "PUBLIC" },
      }),
    );

    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ event: "appointment_confirmed" }),
    );
  });

  it("confirmação do painel com notify explícito ainda avisa o cliente", async () => {
    await handlers.get("scheduling.appointment.confirmed")!(agendamento({ notify: true }));

    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ event: "appointment_confirmed", notifyOverride: true }),
    );
  });

  it("cancelamento repassa a mensagem pontual escrita na hora", async () => {
    await handlers.get("scheduling.appointment.cancelled")!(
      agendamento({ notificationMessage: "Precisei cancelar, me desculpe." }),
    );

    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "appointment_cancelled",
        message: "Precisei cancelar, me desculpe.",
      }),
    );
  });

  it("no-show dispara o evento correspondente com o override da ação", async () => {
    await handlers.get("scheduling.appointment.no_show")!(agendamento({ notify: false }));

    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ event: "appointment_no_show", notifyOverride: false }),
    );
  });

  it("remarcação de cliente sem telefone ainda oferece o e-mail ao dispatcher", async () => {
    await handlers.get("scheduling.appointment.rescheduled")!({
      tenantId: "t1",
      appointmentId: "a1",
      customerId: "c1",
      customerName: "Maria Silva",
      customerPhone: null,
      customerEmail: "maria@ex.com",
      serviceName: "Escova",
      professionalName: "Ana Souza",
      oldStartsAt: new Date("2026-08-01T17:00:00.000Z"),
      newStartsAt: new Date("2026-08-03T18:00:00.000Z"),
      newEndsAt: new Date("2026-08-03T18:45:00.000Z"),
      notificationMessage: "",
    } as never);

    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "appointment_rescheduled",
        recipient: { phone: null, email: "maria@ex.com" },
      }),
    );
  });
});
```

> Antes, cada subscription começava com `if (!customer.phone) return;`. Isso **morre** nesta tarefa: quem decide se há para onde enviar é o dispatcher, que conhece os canais ligados. Manter o guard aqui bloquearia o canal de e-mail para sempre — o último teste acima existe justamente para impedir que alguém o reintroduza.

- [ ] **Step 5: Rodar e ver falhar**

```bash
npx vitest run src/domains/notifications/subscriptions.test.ts
```

Esperado: falha em praticamente todos os casos (`dispatch` nunca chamado), porque as subscriptions ainda chamam `notificationService.logAndDispatch` direto.

- [ ] **Step 6: Reescrever as subscriptions**

Substitua **todo** o conteúdo de `src/domains/notifications/subscriptions.ts` por:

```ts
import { eventBus } from "@/shared/events/event-bus";

import { customerMessageDispatcher } from "./customer-messages/customer-message-dispatcher.service";

let notificationsRegistered = false;

export function registerNotificationSubscriptions() {
  if (notificationsRegistered) {
    return;
  }

  notificationsRegistered = true;

  eventBus.subscribe(
    "scheduling.appointment.created",
    async ({
      tenantId,
      appointment,
      customer,
      service,
      professional,
      notificationMessage,
      notify,
      origin,
    }) => {
      // Agendamento nascido na vitrine é PEDIDO, não confirmação: o cliente recebe
      // "recebemos seu pedido" e só depois "está confirmado". Pelo painel, o horário
      // já vale como confirmado e só a primeira mensagem existe (spec §6.4).
      const event = origin === "public" ? "appointment_requested" : "appointment_created";

      await customerMessageDispatcher.dispatch({
        tenantId,
        event,
        appointmentId: appointment.id,
        customerId: customer.id,
        recipient: { phone: customer.phone, email: customer.email },
        notifyOverride: notify,
        message: notificationMessage,
        payload: {
          appointmentId: appointment.id,
          startsAt: appointment.startsAt.toISOString(),
          customerName: customer.name,
          serviceName: service.name,
          professionalName: professional.name,
        },
      });
    },
  );

  eventBus.subscribe(
    "scheduling.appointment.confirmed",
    async ({ tenantId, appointment, customer, service, professional, notificationMessage, notify }) => {
      // Só o pedido nascido online gera "confirmado" para o cliente. Confirmar um
      // agendamento feito no painel não manda segunda mensagem — a menos que o
      // profissional peça explicitamente pelo toggle da ação.
      const nasceuOnline = appointment.origin === "PUBLIC";
      if (!nasceuOnline && notify !== true) return;

      await customerMessageDispatcher.dispatch({
        tenantId,
        event: "appointment_confirmed",
        appointmentId: appointment.id,
        customerId: customer.id,
        recipient: { phone: customer.phone, email: customer.email },
        notifyOverride: notify,
        message: notificationMessage,
        payload: {
          appointmentId: appointment.id,
          startsAt: appointment.startsAt.toISOString(),
          customerName: customer.name,
          serviceName: service.name,
          professionalName: professional.name,
        },
      });
    },
  );

  eventBus.subscribe(
    "scheduling.appointment.cancelled",
    async ({ tenantId, appointment, customer, service, professional, notificationMessage, notify }) => {
      await customerMessageDispatcher.dispatch({
        tenantId,
        event: "appointment_cancelled",
        appointmentId: appointment.id,
        customerId: customer.id,
        recipient: { phone: customer.phone, email: customer.email },
        notifyOverride: notify,
        message: notificationMessage,
        payload: {
          appointmentId: appointment.id,
          status: appointment.status,
          startsAt: appointment.startsAt.toISOString(),
          customerName: customer.name,
          serviceName: service.name,
          professionalName: professional.name,
        },
      });
    },
  );

  eventBus.subscribe(
    "scheduling.appointment.no_show",
    async ({ tenantId, appointment, customer, service, professional, notify }) => {
      await customerMessageDispatcher.dispatch({
        tenantId,
        event: "appointment_no_show",
        appointmentId: appointment.id,
        customerId: customer.id,
        recipient: { phone: customer.phone, email: customer.email },
        notifyOverride: notify,
        payload: {
          appointmentId: appointment.id,
          status: appointment.status,
          startsAt: appointment.startsAt.toISOString(),
          customerName: customer.name,
          serviceName: service.name,
          professionalName: professional.name,
        },
      });
    },
  );

  eventBus.subscribe("scheduling.appointment.rescheduled", async (payload) => {
    await customerMessageDispatcher.dispatch({
      tenantId: payload.tenantId,
      event: "appointment_rescheduled",
      appointmentId: payload.appointmentId,
      customerId: payload.customerId,
      recipient: { phone: payload.customerPhone, email: payload.customerEmail },
      notifyOverride: payload.notify,
      message: payload.notificationMessage || undefined,
      payload: {
        appointmentId: payload.appointmentId,
        customerName: payload.customerName,
        serviceName: payload.serviceName,
        professionalName: payload.professionalName,
        // `newStartsAt` tem precedência sobre `startsAt` no gateway — é a data nova
        // que o cliente precisa ler.
        newStartsAt: payload.newStartsAt.toISOString(),
      },
    });
  });
}
```

- [ ] **Step 7: Rodar e ver passar**

```bash
npx vitest run src/domains/notifications/ src/domains/scheduling/
npx tsc --noEmit
```

Esperado: `tsc` **zerado** — o erro herdado da Task 1 some no Step 3.4. Subscriptions verdes.
`scheduling.service.update.test.ts` continua com a falha pré-existente do baseline; confirme que é **a mesma** falha, com a mesma mensagem, e não uma nova causada por `customerEmail`.

- [ ] **Step 8: Repassar o `notify` no frontend**

Em `src/hooks/scheduling/use-appointments.ts`:

1. Em `CreateAppointmentInput`, acrescente `notify?: boolean`.
2. Em `UpdateAppointmentInput`, acrescente `notify?: boolean`.
3. Em `updateAppointmentStatus`, acrescente o parâmetro e mande no corpo:
   ```ts
   async function updateAppointmentStatus(
     id: string,
     status: AppointmentStatus,
     notificationMessage?: string,
     confirmedPrice?: number,
     notify?: boolean,
   ): Promise<Appointment> {
     const res = await fetch(`/api/scheduling/appointments/${id}/status`, {
       method: 'PATCH',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({ status, notificationMessage, confirmedPrice, notify }),
     })
   ```
4. Em `useUpdateAppointmentStatus`, acrescente `notify?: boolean` ao tipo das variáveis e repasse:
   ```ts
       mutationFn: ({ id, status, notificationMessage, confirmedPrice, notify }: {
         id: string
         status: AppointmentStatus
         notificationMessage?: string
         confirmedPrice?: number
         notify?: boolean
       }) => updateAppointmentStatus(id, status, notificationMessage, confirmedPrice, notify),
   ```

> `JSON.stringify` **omite** chaves com valor `undefined`. É exatamente o que queremos: `notify` ausente no corpo → Zod `.optional()` → `undefined` no service → padrão do tenant decide. **Nunca** troque por `notify ?? false`; isso transformaria "não opinei" em "não envie".

- [ ] **Step 9: Rodar tudo**

```bash
npx tsc --noEmit
npx vitest run
```

Esperado: 4 falhas — as mesmas do baseline. Cole o resumo (`Test Files ... | Tests ...`).

- [ ] **Step 10: Commit**

```bash
git add src/shared/events/domain-events.ts src/domains/scheduling/ src/domains/notifications/ src/hooks/scheduling/use-appointments.ts
git commit -m "feat(notifications): contrato notify, origem persistida e evento appointment_requested"
```

---

## Task 9: Jobs e lembrete em massa passam pelo dispatcher

**Files:**
- Modify: `src/shared/queue/jobs/appointment-reminder.ts`
- Modify: `src/shared/queue/jobs/birthday-reminder.ts`
- Modify: `src/app/api/notifications/bulk-reminder/route.ts`
- Test: `src/shared/queue/jobs/appointment-reminder.test.ts` (já existe — acrescentar caso)

**Interfaces:**
- Consumes: `customerMessageDispatcher` (Task 5).
- Produces: nenhuma API nova. `POST /api/notifications/bulk-reminder` passa a responder `{ sent, skipped }`.

Sem esta tarefa, desligar "Lembrete de horário" na matriz não teria efeito nenhum — o job continuaria mandando. É a diferença entre um switch e um switch que funciona.

- [ ] **Step 1: Acrescentar o caso ao teste do lembrete (falhando)**

Em `src/shared/queue/jobs/appointment-reminder.test.ts`, acrescente o mock do dispatcher junto dos mocks já existentes no topo:

```ts
const dispatch = vi.fn();
vi.mock("@/domains/notifications/customer-messages/customer-message-dispatcher.service", () => ({
  customerMessageDispatcher: { dispatch: (...args: unknown[]) => dispatch(...args) },
}));
```

E o caso, replicando o arranjo do caso feliz que já existe no arquivo (mesmo `prismaMock.appointment.findFirst`):

```ts
  it("o lembrete sai pelo dispatcher, que respeita o padrão do tenant", async () => {
    await handleAppointmentReminder([
      { data: { appointmentId: "a1", tenantId: "t1" } } as never,
    ]);

    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: "t1", event: "appointment_reminder" }),
    );
  });
```

> Este arquivo tem **uma falha pré-existente do baseline**. Leia-o inteiro antes de editar, reaproveite o arranjo que já existe e **não** tente consertar a falha antiga — está fora de escopo. Só garanta que o número de falhas não aumenta.

- [ ] **Step 2: Rodar e ver falhar**

```bash
npx vitest run src/shared/queue/jobs/appointment-reminder.test.ts
```

Esperado: 2 falhas (a pré-existente + a nova, com `dispatch` não chamado).

- [ ] **Step 3: Migrar o job de lembrete**

Em `src/shared/queue/jobs/appointment-reminder.ts`, dentro de `handleAppointmentReminder`, substitua o trecho a partir do `if (!appointment ...)` por:

```ts
    if (!appointment || appointment.status === "CANCELLED") continue;

    const { customerMessageDispatcher } = await import(
      "@/domains/notifications/customer-messages/customer-message-dispatcher.service"
    );

    // Sem override: o lembrete é automático, então quem manda é sempre o padrão do
    // negócio configurado em Configurações › Notificações › Mensagens ao cliente.
    await customerMessageDispatcher.dispatch({
      tenantId,
      event: "appointment_reminder",
      appointmentId,
      customerId: appointment.customerId,
      recipient: { phone: appointment.customer.phone, email: appointment.customer.email },
      payload: {
        appointmentId,
        startsAt: appointment.startsAt.toISOString(),
        customerName: appointment.customer.name,
        serviceName: appointment.service?.name ?? "",
      },
    });
```

Remova o `if (!appointment.customer.phone) continue;`, o import dinâmico de `notification.service` e o import de `NotificationChannel` se ficar sem uso.

- [ ] **Step 4: Migrar o job de aniversário**

Em `src/shared/queue/jobs/birthday-reminder.ts`, substitua o laço final por:

```ts
  const { customerMessageDispatcher } = await import(
    '@/domains/notifications/customer-messages/customer-message-dispatcher.service'
  )

  for (const customer of customers) {
    await customerMessageDispatcher.dispatch({
      tenantId: customer.tenantId,
      event: 'birthday',
      customerId: customer.id,
      recipient: { phone: customer.phone, email: null },
      // `birthdayMessage` do tenant é a mensagem pontual: continua tendo precedência
      // sobre o template, como antes.
      message: customer.birthdayMessage ?? undefined,
      payload: { customerName: customer.name },
    })
  }
```

Remova os imports de `notification.service` e `NotificationChannel` se ficarem sem uso.

> A query bruta deste job filtra `consentGiven = true` e `evolutionConnected = true`. **Mantenha** — aniversário é promocional e o consentimento é exigência de LGPD (spec §10). O dispatcher ainda não conhece consentimento; isso entra na Fase 3.

- [ ] **Step 5: Migrar o lembrete em massa**

Em `src/app/api/notifications/bulk-reminder/route.ts`, troque o import de `notificationService` por:

```ts
import { customerMessageDispatcher } from "@/domains/notifications/customer-messages/customer-message-dispatcher.service";
```

E substitua o `await Promise.all(...)` e o `return` por:

```ts
    const resultados = await Promise.all(
      eligible.map((a) =>
        customerMessageDispatcher.dispatch({
          tenantId: session.tenantId,
          event: "appointment_reminder",
          appointmentId: a.id,
          customerId: a.customerId,
          recipient: { phone: a.customer.phone, email: null },
          payload: {
            appointmentId: a.id,
            startsAt: a.startsAt.toISOString(),
            customerName: a.customer.name,
            serviceName: a.service?.name ?? "",
          },
        }),
      ),
    );

    const sent = resultados.filter((r) => r.dispatched.length > 0).length;
    // `skipped` inclui o caso "o tenant desligou o lembrete na matriz": a rota não
    // pode reportar como enviado o que o padrão do negócio bloqueou.
    return Response.json({ sent, skipped: resultados.length - sent });
```

Remova o import de `NotificationChannel` se ficar sem uso.

> Quem consome `{ sent }` no frontend precisa continuar funcionando — o campo permanece. Confira com `grep -rn "bulk-reminder" src/` antes de fechar a tarefa.

- [ ] **Step 6: Rodar e ver passar**

```bash
npx vitest run
npx tsc --noEmit
```

Esperado: 4 falhas (baseline). Se `appointment-reminder.test.ts` continuar com 2, o job não foi migrado.

- [ ] **Step 7: Commit**

```bash
git add src/shared/queue/jobs/ src/app/api/notifications/bulk-reminder/
git commit -m "feat(notifications): lembretes e aniversario respeitam o padrao do negocio"
```

---

## Task 10: API de prévia para o toggle

**Files:**
- Create: `src/app/api/notifications/customer-messages/preview/route.ts`
- Test: `src/app/api/notifications/customer-messages/preview/route.test.ts`
- Modify: `src/domains/notifications/customer-messages/schemas.ts`

**Interfaces:**
- Consumes: `customerMessageSettingService` (Task 4), `customerMessageService.render` (Fase 1), `featureGuard`.
- Produces:
  - `customerMessagePreviewSchema` (Zod)
  - `POST` → `{ defaultEnabled: boolean; channels: ("WHATSAPP"|"EMAIL")[]; primaryChannel: "WHATSAPP"|"EMAIL"; preview: string; blockedReason: string | null }`

### Permissão

Segue o precedente do ADR-016: é **leitura de apoio** consumida por qualquer colaborador que agenda, então exige apenas sessão válida — nenhum `ensurePermission` de configuração. O isolamento vem de toda busca filtrar `tenantId: session.tenantId`.

É `POST` porque o modal de criação ainda não tem agendamento: os dados vêm no corpo.

- [ ] **Step 1: Adicionar o schema**

Ao fim de `src/domains/notifications/customer-messages/schemas.ts`:

```ts
export const customerMessagePreviewSchema = z
  .object({
    event: customerMessageEventSchema,
    appointmentId: z.string().min(1).optional(),
    customerId: z.string().min(1).optional(),
    serviceId: z.string().min(1).optional(),
    professionalId: z.string().min(1).optional(),
    startsAt: z.string().datetime().optional(),
  })
  .refine((d) => d.appointmentId || d.customerId, {
    message: "Informe appointmentId ou customerId.",
    path: ["customerId"],
  });

export type CustomerMessagePreviewInput = z.infer<typeof customerMessagePreviewSchema>;
```

- [ ] **Step 2: Escrever o teste (falhando)**

`src/app/api/notifications/customer-messages/preview/route.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { prismaMock } from "@/shared/test/prisma-mock";

vi.mock("@/app/api/_lib/runtime", () => ({ initializeDomainRuntime: vi.fn() }));
vi.mock("@/shared/auth/session", () => ({ getSessionContext: vi.fn() }));
vi.mock("@/domains/billing/feature-guard", () => ({
  featureGuard: { assertAccess: vi.fn() },
  FEATURES: { WHATSAPP_BASIC: "whatsapp_basic" },
}));
vi.mock("@/domains/notifications/customer-messages/customer-message-setting.service", () => ({
  customerMessageSettingService: { resolve: vi.fn() },
}));
vi.mock("@/domains/notifications/customer-messages/customer-message.service", () => ({
  customerMessageService: { render: vi.fn() },
}));

import { getSessionContext } from "@/shared/auth/session";
import { featureGuard } from "@/domains/billing/feature-guard";
import { customerMessageSettingService } from "@/domains/notifications/customer-messages/customer-message-setting.service";
import { customerMessageService } from "@/domains/notifications/customer-messages/customer-message.service";
import { POST } from "./route";

const session = vi.mocked(getSessionContext);
const settings = vi.mocked(customerMessageSettingService);
const mensagens = vi.mocked(customerMessageService);
const guard = vi.mocked(featureGuard);

function pedir(body: Record<string, unknown>) {
  return POST(
    new Request("http://localhost/api/notifications/customer-messages/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

const tenantConectado = {
  name: "Salão da Lu",
  slug: "salao-da-lu",
  timezone: "America/Sao_Paulo",
  phone: "1199999",
  address: "Rua X",
  whatsappEnabled: true,
  evolutionConnected: true,
  evolutionStatus: "CONNECTED",
};

describe("POST /api/notifications/customer-messages/preview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    session.mockResolvedValue({ tenantId: "t1", userId: "u1" } as never);
    guard.assertAccess.mockResolvedValue(undefined as never);
    settings.resolve.mockResolvedValue({
      event: "appointment_created",
      label: "Agendamento criado",
      description: "",
      nature: "transactional",
      enabled: true,
      channels: ["WHATSAPP"],
      isCustom: false,
    });
    mensagens.render.mockResolvedValue({
      subject: null,
      text: "Olá, Maria Silva! Seu agendamento foi criado.",
      mediaUrl: null,
    });
    prismaMock.tenant.findFirst.mockResolvedValue(tenantConectado as never);
    prismaMock.customer.findFirst.mockResolvedValue({
      id: "c1",
      name: "Maria Silva",
      phone: "11999990000",
      email: "maria@ex.com",
    } as never);
    prismaMock.appointment.findFirst.mockResolvedValue(null);
    prismaMock.service.findFirst.mockResolvedValue({ name: "Escova", duration: 45 } as never);
    prismaMock.user.findFirst.mockResolvedValue({ name: "Ana" } as never);
  });

  it("devolve o padrão do tenant e o texto já interpolado", async () => {
    const res = await pedir({ event: "appointment_created", customerId: "c1" });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.defaultEnabled).toBe(true);
    expect(body.preview).toContain("Maria Silva");
    expect(body.blockedReason).toBeNull();
  });

  it("busca o cliente sempre dentro do tenant da sessão", async () => {
    await pedir({ event: "appointment_created", customerId: "c1" });

    expect(prismaMock.customer.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: "c1", tenantId: "t1" }) }),
    );
  });

  it("explica que o cliente não tem telefone", async () => {
    prismaMock.customer.findFirst.mockResolvedValue({
      id: "c1",
      name: "Maria",
      phone: null,
      email: null,
    } as never);

    const body = await (await pedir({ event: "appointment_created", customerId: "c1" })).json();

    expect(body.blockedReason).toMatch(/telefone/i);
  });

  it("explica que o WhatsApp do negócio não está conectado", async () => {
    prismaMock.tenant.findFirst.mockResolvedValue({
      ...tenantConectado,
      evolutionConnected: false,
      evolutionStatus: "DISCONNECTED",
    } as never);

    const body = await (await pedir({ event: "appointment_created", customerId: "c1" })).json();

    expect(body.blockedReason).toMatch(/não está conectado/i);
  });

  it("explica que o plano não inclui WhatsApp", async () => {
    guard.assertAccess.mockRejectedValue(new Error("sem plano"));

    const body = await (await pedir({ event: "appointment_created", customerId: "c1" })).json();

    expect(body.blockedReason).toMatch(/plano/i);
  });

  it("confirmação de agendamento nascido no painel vem com o padrão desligado", async () => {
    settings.resolve.mockResolvedValue({
      event: "appointment_confirmed",
      label: "Agendamento confirmado",
      description: "",
      nature: "transactional",
      enabled: true,
      channels: ["WHATSAPP"],
      isCustom: false,
    });
    prismaMock.appointment.findFirst.mockResolvedValue({
      id: "a1",
      customerId: "c1",
      startsAt: new Date("2026-08-02T17:00:00.000Z"),
      origin: "PANEL",
      customer: { id: "c1", name: "Maria Silva", phone: "11999990000", email: "maria@ex.com" },
      service: { name: "Escova", duration: 45 },
      professional: { name: "Ana" },
      package: null,
      promotion: null,
    } as never);

    const body = await (
      await pedir({ event: "appointment_confirmed", appointmentId: "a1" })
    ).json();

    expect(body.defaultEnabled).toBe(false);
  });

  it("rejeita pedido sem cliente e sem agendamento", async () => {
    const res = await pedir({ event: "appointment_created" });
    expect(res.status).toBe(422);
  });
});
```

> `ValidationError` responde 422 neste projeto (`validate-input.ts` + `handle-api-error.ts`). Confirme lendo os dois arquivos; se o código real usar outro status, ajuste o **teste** ao comportamento existente, nunca o handler.

- [ ] **Step 3: Rodar e ver falhar**

```bash
npx vitest run src/app/api/notifications/customer-messages/preview/route.test.ts
```

Esperado: `Failed to resolve import "./route"`.

- [ ] **Step 4: Implementar**

`src/app/api/notifications/customer-messages/preview/route.ts`:

```ts
import { initializeDomainRuntime } from "@/app/api/_lib/runtime";
import { featureGuard, FEATURES } from "@/domains/billing/feature-guard";
import { customerMessageService } from "@/domains/notifications/customer-messages/customer-message.service";
import { customerMessageSettingService } from "@/domains/notifications/customer-messages/customer-message-setting.service";
import { customerMessagePreviewSchema } from "@/domains/notifications/customer-messages/schemas";
import type { CustomerMessageChannel } from "@/domains/notifications/customer-messages/types";
import { getSessionContext } from "@/shared/auth/session";
import { prisma } from "@/shared/database/prisma";
import { handleApiError } from "@/shared/http/handle-api-error";
import { validateInput } from "@/shared/http/validate-input";

/**
 * Prévia do que o cliente vai receber, para o <CustomerMessageToggle>.
 *
 * NÃO exige permissão de configuração (precedente ADR-016): é leitura de apoio de
 * qualquer colaborador que agenda. O isolamento vem de TODA busca filtrar o
 * tenantId da sessão.
 */
export async function POST(request: Request) {
  initializeDomainRuntime();
  try {
    const session = await getSessionContext(request);
    const input = await validateInput(request, customerMessagePreviewSchema);
    const tenantId = session.tenantId;

    const tenant = await prisma.tenant.findFirst({
      where: { id: tenantId },
      select: {
        name: true,
        slug: true,
        timezone: true,
        phone: true,
        address: true,
        whatsappEnabled: true,
        evolutionConnected: true,
        evolutionStatus: true,
      },
    });
    if (!tenant) {
      return Response.json({ error: { code: "NOT_FOUND" } }, { status: 404 });
    }

    const agendamento = input.appointmentId
      ? await prisma.appointment.findFirst({
          where: { id: input.appointmentId, tenantId },
          include: {
            customer: { select: { id: true, name: true, phone: true, email: true } },
            service: { select: { name: true, duration: true } },
            package: { select: { name: true } },
            promotion: { select: { name: true } },
            professional: { select: { name: true } },
          },
        })
      : null;

    const cliente =
      agendamento?.customer ??
      (input.customerId
        ? await prisma.customer.findFirst({
            where: { id: input.customerId, tenantId },
            select: { id: true, name: true, phone: true, email: true },
          })
        : null);

    if (!cliente) {
      return Response.json({ error: { code: "NOT_FOUND" } }, { status: 404 });
    }

    const servico =
      agendamento?.service?.name ??
      agendamento?.package?.name ??
      agendamento?.promotion?.name ??
      (input.serviceId
        ? (
            await prisma.service.findFirst({
              where: { id: input.serviceId, tenantId },
              select: { name: true },
            })
          )?.name
        : undefined);

    const profissional =
      agendamento?.professional?.name ??
      (input.professionalId
        ? (
            await prisma.user.findFirst({
              where: { id: input.professionalId, tenantId },
              select: { name: true },
            })
          )?.name
        : undefined);

    const quando =
      agendamento?.startsAt ?? (input.startsAt ? new Date(input.startsAt) : undefined);

    const padrao = await customerMessageSettingService.resolve(tenantId, input.event);

    // Regra de origem da spec §6.4, espelhada aqui para o toggle mostrar o MESMO
    // padrão que o backend vai aplicar. Se divergir, o profissional vê "ligado" e o
    // cliente não recebe nada — pior do que não ter prévia nenhuma.
    const confirmacaoValida =
      input.event !== "appointment_confirmed" || agendamento?.origin === "PUBLIC";
    const defaultEnabled = padrao.enabled && confirmacaoValida;

    const channels = padrao.channels;
    const primaryChannel: CustomerMessageChannel = channels.includes("WHATSAPP")
      ? "WHATSAPP"
      : (channels[0] ?? "WHATSAPP");

    const renderizado = await customerMessageService.render(
      tenantId,
      input.event,
      primaryChannel,
      {
        customerName: cliente.name,
        serviceName: servico,
        professionalName: profissional,
        startsAt: quando,
        tenant: {
          name: tenant.name,
          slug: tenant.slug,
          timezone: tenant.timezone,
          phone: tenant.phone,
          address: tenant.address,
        },
      },
    );

    const blockedReason = await motivoDeBloqueio({
      tenantId,
      channels,
      cliente,
      tenant,
    });

    return Response.json({
      defaultEnabled,
      channels,
      primaryChannel,
      preview: renderizado.text,
      blockedReason,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

type MotivoArgs = {
  tenantId: string;
  channels: CustomerMessageChannel[];
  cliente: { phone: string | null; email: string | null };
  tenant: {
    whatsappEnabled: boolean;
    evolutionConnected: boolean;
    evolutionStatus: string | null;
  };
};

/**
 * Devolve o motivo legível SÓ quando nenhum canal ligado consegue entregar. Se ao
 * menos um consegue, a mensagem sai e o toggle não pode aparecer desabilitado.
 */
async function motivoDeBloqueio(args: MotivoArgs): Promise<string | null> {
  if (args.channels.length === 0) {
    return "Nenhum canal está ligado para este aviso nas configurações.";
  }

  const emailEntrega = args.channels.includes("EMAIL") && Boolean(args.cliente.email);

  if (!args.channels.includes("WHATSAPP")) {
    return emailEntrega ? null : "Este cliente não tem e-mail cadastrado.";
  }

  let motivoWhatsApp: string | null = null;

  try {
    await featureGuard.assertAccess(args.tenantId, FEATURES.WHATSAPP_BASIC);
  } catch {
    motivoWhatsApp = "Seu plano não inclui o envio de WhatsApp.";
  }

  if (!motivoWhatsApp && !args.cliente.phone) {
    motivoWhatsApp = "Este cliente não tem telefone cadastrado.";
  }
  if (!motivoWhatsApp && !args.tenant.whatsappEnabled) {
    motivoWhatsApp = "O envio automático de WhatsApp está desligado nas configurações.";
  }
  if (
    !motivoWhatsApp &&
    (!args.tenant.evolutionConnected || args.tenant.evolutionStatus !== "CONNECTED")
  ) {
    motivoWhatsApp = "O WhatsApp do seu negócio não está conectado.";
  }

  if (!motivoWhatsApp) return null;
  return emailEntrega ? null : motivoWhatsApp;
}
```

- [ ] **Step 5: Rodar e ver passar**

```bash
npx vitest run src/app/api/notifications/customer-messages/preview/route.test.ts
npx tsc --noEmit
```

Esperado: 7 testes passando.

> **Teste negativo obrigatório:** troque `where: { id: input.customerId, tenantId }` por `where: { id: input.customerId }` e rode. O teste "busca o cliente sempre dentro do tenant da sessão" **deve** falhar. Cole a saída e desfaça. Vazamento entre tenants é a falha mais cara possível neste projeto.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/notifications/customer-messages/preview/ src/domains/notifications/customer-messages/schemas.ts
git commit -m "feat(notifications): API de previa do aviso ao cliente"
```

---

## Task 11: O componente `<CustomerMessageToggle>`

**Files:**
- Create: `src/hooks/notifications/use-customer-message-preview.ts`
- Create: `src/components/domain/notifications/customer-message-toggle.tsx`
- Test: `src/components/domain/notifications/customer-message-toggle.test.tsx`

**Interfaces:**
- Consumes: `POST /api/notifications/customer-messages/preview` (Task 10).
- Produces:
  - `type CustomerMessagePreview = { defaultEnabled: boolean; channels: ("WHATSAPP"|"EMAIL")[]; primaryChannel: "WHATSAPP"|"EMAIL"; preview: string; blockedReason: string | null }`
  - `useCustomerMessagePreview(input, options)` — `input` igual ao corpo da rota
  - ```ts
    <CustomerMessageToggle
      event={string}
      customerId={string | undefined}
      appointmentId={string | undefined}
      serviceId={string | undefined}
      professionalId={string | undefined}
      startsAt={string | undefined}
      enabled={boolean}          // habilita o fetch (form incompleto = não busca)
      value={boolean | undefined}      // undefined = "ainda no padrão do negócio"
      onChange={(v: boolean) => void}
      message={string}
      onMessageChange={(m: string) => void}
    />
    ```

### O contrato de estado — por que `value` pode ser `undefined`

`undefined` significa literalmente **"o profissional não opinou"**. O componente exibe o padrão do negócio, e o pai manda `notify: undefined` — que `JSON.stringify` omite, e o service resolve pelo padrão. Assim que a pessoa toca no switch, `value` vira `true`/`false` e o override é explícito.

Isto **não** é um detalhe estético: se o componente inicializasse `value` com o padrão copiado do servidor, uma mudança de configuração entre o carregamento do modal e o envio seria silenciosamente ignorada.

### Desenho — mobile e desktop

Bloco de **duas linhas** que não empurra os botões de ação para fora da tela no mobile (spec §11):

```
┌──────────────────────────────────────────────┐
│ Avisar o cliente por WhatsApp        [====O] │
│ Padrão do seu negócio: ligado                │
│ › Ver a mensagem                             │   ← recolhido por padrão
└──────────────────────────────────────────────┘
```

Expandido, mostra o texto renderizado num balão de WhatsApp e um botão "Escrever outra mensagem" que troca o balão por um `Textarea`. Bloqueado, o switch fica `disabled` e o motivo aparece no lugar do subtítulo.

- [ ] **Step 1: Criar o hook**

`src/hooks/notifications/use-customer-message-preview.ts`:

```ts
import { useQuery } from "@tanstack/react-query";

export type CustomerMessagePreview = {
  defaultEnabled: boolean;
  channels: ("WHATSAPP" | "EMAIL")[];
  primaryChannel: "WHATSAPP" | "EMAIL";
  preview: string;
  blockedReason: string | null;
};

export type CustomerMessagePreviewInput = {
  event: string;
  appointmentId?: string;
  customerId?: string;
  serviceId?: string;
  professionalId?: string;
  startsAt?: string;
};

export function useCustomerMessagePreview(
  input: CustomerMessagePreviewInput,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: ["customer-message-preview", input],
    queryFn: async (): Promise<CustomerMessagePreview> => {
      const res = await fetch("/api/notifications/customer-messages/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error("Falha ao carregar a prévia da mensagem");
      return res.json();
    },
    // Sem cliente e sem agendamento a rota devolve 422 — não vale bater.
    enabled: (options?.enabled ?? true) && Boolean(input.customerId || input.appointmentId),
    staleTime: 30_000,
    retry: false,
  });
}
```

- [ ] **Step 2: Escrever o teste (falhando)**

`src/components/domain/notifications/customer-message-toggle.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { CustomerMessageToggle } from './customer-message-toggle'

let previa = {
  defaultEnabled: true,
  channels: ['WHATSAPP'] as ('WHATSAPP' | 'EMAIL')[],
  primaryChannel: 'WHATSAPP' as const,
  preview: 'Olá, Maria! Seu agendamento foi criado.',
  blockedReason: null as string | null,
}

vi.mock('@/hooks/notifications/use-customer-message-preview', () => ({
  useCustomerMessagePreview: () => ({ data: previa, isLoading: false, isError: false }),
}))

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

const base = {
  event: 'appointment_created',
  customerId: 'c1',
  message: '',
  onMessageChange: vi.fn(),
}

afterEach(() => {
  cleanup()
  previa = {
    defaultEnabled: true,
    channels: ['WHATSAPP'],
    primaryChannel: 'WHATSAPP',
    preview: 'Olá, Maria! Seu agendamento foi criado.',
    blockedReason: null,
  }
})

describe('CustomerMessageToggle', () => {
  it('com value undefined, exibe o padrão do negócio e o rotula', () => {
    render(<CustomerMessageToggle {...base} value={undefined} onChange={vi.fn()} />, { wrapper })

    expect(screen.getByRole('switch')).toBeChecked()
    expect(screen.getByText(/padrão do seu negócio: ligado/i)).toBeInTheDocument()
  })

  it('com padrão desligado, exibe desligado e rotula como desligado', () => {
    previa.defaultEnabled = false
    render(<CustomerMessageToggle {...base} value={undefined} onChange={vi.fn()} />, { wrapper })

    expect(screen.getByRole('switch')).not.toBeChecked()
    expect(screen.getByText(/padrão do seu negócio: desligado/i)).toBeInTheDocument()
  })

  it('o override do usuário vence o padrão', () => {
    render(<CustomerMessageToggle {...base} value={false} onChange={vi.fn()} />, { wrapper })

    expect(screen.getByRole('switch')).not.toBeChecked()
    expect(screen.getByText(/padrão do seu negócio: ligado/i)).toBeInTheDocument()
  })

  it('tocar no switch avisa o pai com o valor explícito', async () => {
    const onChange = vi.fn()
    render(<CustomerMessageToggle {...base} value={undefined} onChange={onChange} />, { wrapper })

    await userEvent.click(screen.getByRole('switch'))

    expect(onChange).toHaveBeenCalledWith(false)
  })

  it('a prévia fica recolhida e expande sob demanda', async () => {
    render(<CustomerMessageToggle {...base} value={undefined} onChange={vi.fn()} />, { wrapper })

    expect(screen.queryByText(/Seu agendamento foi criado/)).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /ver a mensagem/i }))

    expect(screen.getByText(/Seu agendamento foi criado/)).toBeInTheDocument()
  })

  it('bloqueado: switch desabilitado e motivo visível', () => {
    previa.blockedReason = 'Este cliente não tem telefone cadastrado.'
    render(<CustomerMessageToggle {...base} value={undefined} onChange={vi.fn()} />, { wrapper })

    expect(screen.getByRole('switch')).toBeDisabled()
    expect(screen.getByText(/não tem telefone cadastrado/i)).toBeInTheDocument()
  })

  it('bloqueado: o switch nunca aparece ligado — nunca um switch que não envia', () => {
    previa.blockedReason = 'O WhatsApp do seu negócio não está conectado.'
    render(<CustomerMessageToggle {...base} value={true} onChange={vi.fn()} />, { wrapper })

    expect(screen.getByRole('switch')).not.toBeChecked()
  })

  it('escrever outra mensagem devolve o texto ao pai', async () => {
    const onMessageChange = vi.fn()
    render(
      <CustomerMessageToggle
        {...base}
        onMessageChange={onMessageChange}
        value={undefined}
        onChange={vi.fn()}
      />,
      { wrapper },
    )

    await userEvent.click(screen.getByRole('button', { name: /ver a mensagem/i }))
    await userEvent.click(screen.getByRole('button', { name: /escrever outra mensagem/i }))
    await userEvent.type(screen.getByRole('textbox'), 'Oi')

    expect(onMessageChange).toHaveBeenCalled()
  })

  it('desligado, não oferece a prévia — não há mensagem para ver', () => {
    render(<CustomerMessageToggle {...base} value={false} onChange={vi.fn()} />, { wrapper })

    expect(screen.queryByRole('button', { name: /ver a mensagem/i })).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 3: Rodar e ver falhar**

```bash
npx vitest run src/components/domain/notifications/customer-message-toggle.test.tsx
```

Esperado: `Failed to resolve import "./customer-message-toggle"`.

- [ ] **Step 4: Implementar**

`src/components/domain/notifications/customer-message-toggle.tsx`:

```tsx
"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useCustomerMessagePreview } from "@/hooks/notifications/use-customer-message-preview";

type Props = {
  event: string;
  customerId?: string;
  appointmentId?: string;
  serviceId?: string;
  professionalId?: string;
  startsAt?: string;
  /** Só busca a prévia quando o formulário já tem dados suficientes. */
  enabled?: boolean;
  /** `undefined` = ainda no padrão do negócio; boolean = override explícito da ação. */
  value: boolean | undefined;
  onChange: (valor: boolean) => void;
  /** Mensagem pontual; string vazia = usa o template. */
  message: string;
  onMessageChange: (texto: string) => void;
};

export function CustomerMessageToggle({
  event,
  customerId,
  appointmentId,
  serviceId,
  professionalId,
  startsAt,
  enabled = true,
  value,
  onChange,
  message,
  onMessageChange,
}: Props) {
  const [expandido, setExpandido] = useState(false);
  const [escrevendo, setEscrevendo] = useState(false);

  const { data, isLoading } = useCustomerMessagePreview(
    { event, customerId, appointmentId, serviceId, professionalId, startsAt },
    { enabled },
  );

  const bloqueado = Boolean(data?.blockedReason);
  const padrao = data?.defaultEnabled ?? true;
  // Nunca um switch ligado que não envia (spec §6.2).
  const ligado = bloqueado ? false : (value ?? padrao);

  const canalLabel = data?.primaryChannel === "EMAIL" ? "e-mail" : "WhatsApp";

  if (isLoading) {
    return <div className="h-20 animate-pulse rounded-xl bg-muted" />;
  }

  return (
    <div className="space-y-2 rounded-xl border border-border bg-card px-3 py-2.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Label
            htmlFor={`avisar-cliente-${event}`}
            className="flex cursor-pointer items-center gap-2 text-sm font-medium"
          >
            <MessageSquare className="size-4 shrink-0 text-muted-foreground" />
            Avisar o cliente por {canalLabel}
          </Label>
          {bloqueado ? (
            <p className="mt-0.5 text-xs text-amber-700">{data?.blockedReason}</p>
          ) : (
            <p className="mt-0.5 text-xs text-muted-foreground">
              Padrão do seu negócio: {padrao ? "ligado" : "desligado"}
            </p>
          )}
        </div>
        <Switch
          id={`avisar-cliente-${event}`}
          className="shrink-0"
          checked={ligado}
          disabled={bloqueado}
          onCheckedChange={onChange}
          aria-label={`Avisar o cliente por ${canalLabel}`}
        />
      </div>

      {ligado && (
        <>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="-ml-2 h-auto min-h-11 px-2 text-xs text-muted-foreground"
            onClick={() => setExpandido((v) => !v)}
          >
            {expandido ? (
              <ChevronDown className="size-3.5" />
            ) : (
              <ChevronRight className="size-3.5" />
            )}
            Ver a mensagem
          </Button>

          {expandido && (
            <div className="space-y-2">
              {escrevendo ? (
                <Textarea
                  value={message}
                  onChange={(e) => onMessageChange(e.target.value)}
                  placeholder="Escreva a mensagem que este cliente vai receber..."
                  className="min-h-[90px] resize-none text-sm"
                />
              ) : (
                <div className="whitespace-pre-wrap rounded-xl rounded-tl-sm bg-emerald-50 px-3 py-2 text-sm text-emerald-950">
                  {data?.preview}
                </div>
              )}

              <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-h-11 text-xs"
                onClick={() => {
                  const proximo = !escrevendo;
                  setEscrevendo(proximo);
                  // Voltar ao texto padrão é limpar a mensagem pontual: o gateway
                  // só usa `message` quando ela não está vazia.
                  if (!proximo) onMessageChange("");
                }}
              >
                {escrevendo ? "Usar a mensagem padrão" : "Escrever outra mensagem"}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Rodar e ver passar**

```bash
npx vitest run src/components/domain/notifications/customer-message-toggle.test.tsx
npx tsc --noEmit
```

Esperado: 9 testes passando.

> **Teste negativo obrigatório:** troque `const ligado = bloqueado ? false : (value ?? padrao)` por `const ligado = value ?? padrao`. O teste "bloqueado: o switch nunca aparece ligado" **deve** falhar. Cole a saída e desfaça.

- [ ] **Step 6: Commit**

```bash
git add src/hooks/notifications/ src/components/domain/notifications/
git commit -m "feat(notifications): componente CustomerMessageToggle"
```

---

## Task 12: Ligar o toggle nos modais de agendamento

**Files:**
- Modify: `src/components/domain/scheduling/create-appointment-modal.tsx`
- Modify: `src/components/domain/scheduling/cancel-appointment-modal.tsx`
- Modify: `src/components/domain/scheduling/confirm-appointment-modal.tsx`
- Modify: `src/components/domain/scheduling/appointment-drawer.tsx` (remarcar e confirmar)
- Test: `src/components/domain/scheduling/__tests__/customer-message-toggle-wiring.test.tsx` (novo)

**Interfaces:**
- Consumes: `<CustomerMessageToggle>` (Task 11), `notify` nos hooks (Task 8 Step 8).
- Produces: nenhuma API nova.

### O que sai do código nesta tarefa

Três textos de mensagem ao cliente ainda vivem **no frontend**, montados à mão, ignorando completamente o template que o tenant configurou:

| Constante | Arquivo |
|---|---|
| `CANCEL_TEMPLATE` + `renderCancelTemplate` | `cancel-appointment-modal.tsx` |
| `buildDefaultMessage` | `confirm-appointment-modal.tsx` |
| `RESCHEDULE_TEMPLATE` | `appointment-drawer.tsx` |

Todas as três **desaparecem**. Era o último bolsão de texto hardcoded que a Fase 1 não alcançou, e é o motivo pelo qual o tenant podia editar o template de cancelamento em Configurações e continuar vendo o texto antigo no modal.

> **Perda consciente:** `buildDefaultMessage` injetava o valor cobrado na mensagem de confirmação, e o campo "Valor a cobrar" reescrevia o texto ao ser alterado. Isso acaba. Quem quiser o valor na mensagem adiciona `{{valor}}` ao template. Documente no ADR (Task 14) — é uma regressão visível para quem usava o recurso.

### Um bug ativo que esta tarefa corrige

Em `confirm-appointment-modal.tsx`, desligar o switch "Enviar confirmação via WhatsApp" manda `notificationMessage: ''`. Vazio é *falsy*, então o gateway ignora a mensagem pontual, cai no template e **envia assim mesmo**. O switch nunca funcionou. Com `notify: false` a decisão passa a valer de verdade. Acrescente um caso de teste explícito para isto.

- [ ] **Step 1: Escrever o teste de fiação (falhando)**

`src/components/domain/scheduling/__tests__/customer-message-toggle-wiring.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { CancelAppointmentModal } from '../cancel-appointment-modal'
import { ConfirmAppointmentModal } from '../confirm-appointment-modal'

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

vi.mock('@/hooks/notifications/use-customer-message-preview', () => ({
  useCustomerMessagePreview: () => ({
    data: {
      defaultEnabled: true,
      channels: ['WHATSAPP'],
      primaryChannel: 'WHATSAPP',
      preview: 'Olá, Maria! Seu agendamento foi cancelado.',
      blockedReason: null,
    },
    isLoading: false,
    isError: false,
  }),
}))

const mutate = vi.fn()

vi.mock('@/hooks/scheduling/use-appointments', async () => {
  const real = await vi.importActual<typeof import('@/hooks/scheduling/use-appointments')>(
    '@/hooks/scheduling/use-appointments',
  )
  return { ...real, useUpdateAppointmentStatus: () => ({ mutate, isPending: false }) }
})

vi.mock('@tanstack/react-query', async () => {
  const real = await vi.importActual<typeof import('@tanstack/react-query')>(
    '@tanstack/react-query',
  )
  return { ...real, useQuery: () => ({ data: null, isLoading: false }) }
})

const appointment = {
  id: 'a1',
  customerId: 'c1',
  professionalId: 'p1',
  serviceId: 's1',
  packageId: null,
  promotionId: null,
  startsAt: '2026-08-02T17:00:00.000Z',
  endsAt: '2026-08-02T17:45:00.000Z',
  status: 'SCHEDULED' as const,
  paymentStatus: 'PENDING' as const,
  notes: null,
  price: '80',
  confirmedPrice: null,
  customer: { id: 'c1', name: 'Maria Silva', phone: '11999990000', notes: null },
  professional: { id: 'p1', name: 'Ana' },
  service: { id: 's1', name: 'Escova', duration: 45 },
  package: null,
  promotion: null,
}

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

afterEach(() => {
  cleanup()
  mutate.mockClear()
})

describe('fiação do CustomerMessageToggle nos modais', () => {
  it('cancelar sem tocar no toggle não manda notify — o padrão do tenant decide', async () => {
    render(
      <CancelAppointmentModal appointment={appointment} open onClose={vi.fn()} />,
      { wrapper },
    )

    await userEvent.click(screen.getByRole('button', { name: /confirmar cancelamento/i }))

    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'a1', status: 'CANCELLED', notify: undefined }),
      expect.anything(),
    )
  })

  it('desligar o toggle manda notify false', async () => {
    render(
      <CancelAppointmentModal appointment={appointment} open onClose={vi.fn()} />,
      { wrapper },
    )

    await userEvent.click(screen.getByRole('switch'))
    await userEvent.click(screen.getByRole('button', { name: /confirmar cancelamento/i }))

    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({ notify: false }),
      expect.anything(),
    )
  })

  it('confirmar com o aviso desligado manda notify false — antes o switch não fazia nada', async () => {
    render(<ConfirmAppointmentModal appointment={appointment} open onClose={vi.fn()} />, {
      wrapper,
    })

    await userEvent.click(screen.getByRole('switch'))
    await userEvent.click(screen.getByRole('button', { name: /confirmar/i }))

    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'CONFIRMED', notify: false }),
      expect.anything(),
    )
  })
})
```

> Os modais reais têm dependências que este teste mocka de forma grosseira (`useQuery` global). **Leia cada componente antes** e ajuste os mocks ao que ele de fato usa — se o `ConfirmAppointmentModal` tiver mais de um `role="switch"` depois da sua edição, refine o seletor. Não force o componente a caber no teste.

- [ ] **Step 2: Rodar e ver falhar**

```bash
npx vitest run src/components/domain/scheduling/__tests__/customer-message-toggle-wiring.test.tsx
```

Esperado: falha porque `notify` não é enviado (e porque ainda não há `role="switch"` no modal de cancelamento).

- [ ] **Step 3: Modal de cancelamento**

Em `cancel-appointment-modal.tsx`:

1. Apague `CANCEL_TEMPLATE` e `renderCancelTemplate`.
2. Troque o estado:
   ```tsx
   const [message, setMessage] = useState('')
   const [notify, setNotify] = useState<boolean | undefined>(undefined)
   ```
   e apague o `useEffect` que preenchia a mensagem — ele existia só para renderizar o template no cliente.
3. Reinicie o override ao reabrir:
   ```tsx
   useEffect(() => {
     if (open) {
       setMessage('')
       setNotify(undefined)
     }
   }, [open])
   ```
4. Substitua todo o bloco `<div className="space-y-1.5">` do textarea (incluindo o aviso de "cliente não tem telefone", que agora vem do `blockedReason`) por:
   ```tsx
   <CustomerMessageToggle
     event="appointment_cancelled"
     appointmentId={appointment.id}
     customerId={appointment.customerId}
     value={notify}
     onChange={setNotify}
     message={message}
     onMessageChange={setMessage}
   />
   ```
5. Em `handleConfirm`:
   ```tsx
   updateStatus.mutate(
     {
       id: appointment.id,
       status: 'CANCELLED',
       notificationMessage: message || undefined,
       notify,
     },
     { /* callbacks inalterados */ },
   )
   ```
6. Importe o componente e garanta `max-h-[85vh] overflow-y-auto` no `DialogContent`:
   ```tsx
   <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
   ```

- [ ] **Step 4: Modal de confirmação**

Em `confirm-appointment-modal.tsx`:

1. Apague `buildDefaultMessage` e a função `formatCurrency` se ficar sem uso (**ela também formata a sugestão de preço — confira antes de apagar**).
2. Troque `const [sendWhatsApp, setSendWhatsApp] = useState(true)` por `const [notify, setNotify] = useState<boolean | undefined>(undefined)`.
3. No `useEffect` de abertura, remova `setMensagem(buildDefaultMessage(...))` e `setSendWhatsApp(true)`; deixe `setMensagem('')` e `setNotify(undefined)`.
4. No `onChange` do campo de valor, remova o `setMensagem((prev) => prev.replace(...))` — não há mais mensagem local para reescrever.
5. Substitua o bloco do switch "Enviar confirmação via WhatsApp" **e** o `{sendWhatsApp && (...)}` do textarea por:
   ```tsx
   <CustomerMessageToggle
     event="appointment_confirmed"
     appointmentId={appointment.id}
     customerId={appointment.customerId}
     value={notify}
     onChange={setNotify}
     message={mensagem}
     onMessageChange={setMensagem}
   />
   ```
6. Em `handleSubmit`:
   ```tsx
   updateStatus.mutate(
     {
       id: appointment.id,
       status: 'CONFIRMED',
       notificationMessage: mensagem || undefined,
       confirmedPrice: valorFinal,
       notify,
     },
     { /* callbacks inalterados */ },
   )
   ```
7. `DialogContent` → `className="sm:max-w-md max-h-[85vh] overflow-y-auto"`.

- [ ] **Step 5: Modal de criação**

Em `create-appointment-modal.tsx`:

1. Acrescente `const [notify, setNotify] = useState<boolean | undefined>(undefined)` ao lado de `notificationMessage`.
2. Em `handleClose`, acrescente `setNotify(undefined)`.
3. Substitua o bloco `{/* 6. Mensagem WhatsApp ... */}` inteiro por:
   ```tsx
   {isFormValid && (
     <CustomerMessageToggle
       event="appointment_created"
       customerId={customerId}
       serviceId={serviceId || undefined}
       professionalId={professionalId || undefined}
       startsAt={
         date && selectedTime
           ? new Date(`${date}T${selectedTime}:00`).toISOString()
           : undefined
       }
       value={notify}
       onChange={setNotify}
       message={notificationMessage}
       onMessageChange={setNotificationMessage}
     />
   )}
   ```
4. Em `handleSubmit`, acrescente `notify,` ao objeto da mutation.
5. Se `useEvolutionStatus`/`whatsappOffline` ficarem sem uso neste arquivo, remova-os — o motivo agora vem do `blockedReason`, que é apurado no servidor e cobre também plano e telefone do cliente.

- [ ] **Step 6: Drawer — remarcação e confirmação**

Em `appointment-drawer.tsx`:

1. Apague `RESCHEDULE_TEMPLATE` e o `useEffect` que montava `editMessage` a partir dele (o que depende de `[editTime, editDate, editProfessionalId]`).
2. Acrescente estado:
   ```tsx
   const [notifyReagendamento, setNotifyReagendamento] = useState<boolean | undefined>(undefined)
   ```
   e limpe-o em `startEditing()` junto com `setEditMessage('')`.
3. No formulário de edição, logo antes dos botões de salvar, acrescente:
   ```tsx
   <CustomerMessageToggle
     event="appointment_rescheduled"
     appointmentId={appointment.id}
     customerId={appointment.customerId}
     startsAt={
       editDate && editTime
         ? new Date(`${editDate}T${editTime}:00`).toISOString()
         : undefined
     }
     value={notifyReagendamento}
     onChange={setNotifyReagendamento}
     message={editMessage}
     onMessageChange={setEditMessage}
   />
   ```
4. Em `handleSaveEdit`, acrescente `notify: notifyReagendamento,` ao objeto da mutation e troque `notificationMessage: editMessage` por `notificationMessage: editMessage || undefined`.
5. **Nada a fazer para o ponto "Confirmar (drawer)" da tabela §6.3 da spec — verificado no código.** O botão "Confirmar presença" (`appointment-drawer.tsx:498`) já faz `onClick={() => setConfirmModalOpen(true)}`, ou seja, delega ao `ConfirmAppointmentModal`, que ganhou o toggle no Step 4. A spec listava esse ponto como se disparasse direto; não dispara mais.

   Confirme lendo a linha antes de seguir. Se o `onClick` chamar `handleStatus('CONFIRMED')` direto, o arquivo divergiu desta leitura — aí sim troque para abrir o modal e reporte a divergência.

- [ ] **Step 7: Rodar e ver passar**

```bash
npx vitest run src/components/domain/scheduling/
npx tsc --noEmit
```

Esperado: teste de fiação verde; nada mais quebrado em `scheduling/`.

- [ ] **Step 8: Conferir mobile e desktop**

Em 375px, para cada um dos 4 modais: o bloco do toggle cabe em duas linhas, os botões de ação continuam visíveis sem rolar até o fim, e a prévia expandida rola dentro do `DialogContent` (não estoura a tela).

- [ ] **Step 9: Commit**

```bash
git add src/components/domain/scheduling/
git commit -m "feat(scheduling): toggle de aviso ao cliente nos modais de agendamento"
```

---

## Task 13: Confirmação e override no botão de no-show

**Files:**
- Modify: `src/components/domain/scheduling/appointment-drawer.tsx`
- Test: `src/components/domain/scheduling/__tests__/no-show-confirm.test.tsx` (novo)

**Interfaces:**
- Consumes: `<CustomerMessageToggle>` (Task 11), `useUpdateAppointmentStatus` com `notify` (Task 8).
- Produces: nenhuma API nova.

### Estado real encontrado no código (a spec está desatualizada aqui)

A seção 6.3 da spec diz que o no-show "dispara com um toque, sem diálogo". **Isso mudou desde que a spec foi escrita:** `appointment-drawer.tsx` já tem um `AlertDialog` (`noShowModalOpen`) com "Registrar não comparecimento?" e a ação destrutiva. O que **falta** é o que importa: o diálogo não diz que uma mensagem vai ser enviada ao cliente, e não dá como não enviá-la.

Portanto o escopo desta tarefa é: **deixar explícito no diálogo que o cliente será avisado, mostrar o texto e permitir desligar só desta vez.** Verifique o estado do arquivo antes de começar e reporte se divergir do descrito.

### Por que não usar `Dialog` aninhado

`AlertDialog` do Radix **não aceita** `modal={false}` — a tipagem faz `Omit<DialogProps, 'modal'>`. O toggle vai **inline** dentro do `AlertDialogContent`, sem abrir nenhum diálogo secundário. Se em algum momento você precisar de um diálogo dentro deste, troque o `AlertDialog` inteiro por um `Dialog` comum com `role="alertdialog"`, como faz `picker-detail-modal.tsx`.

- [ ] **Step 1: Escrever o teste (falhando)**

`src/components/domain/scheduling/__tests__/no-show-confirm.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { AppointmentDrawer } from '../appointment-drawer'

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

vi.mock('@/hooks/notifications/use-customer-message-preview', () => ({
  useCustomerMessagePreview: () => ({
    data: {
      defaultEnabled: true,
      channels: ['WHATSAPP'],
      primaryChannel: 'WHATSAPP',
      preview: 'Olá, Maria! Notamos que você não compareceu.',
      blockedReason: null,
    },
    isLoading: false,
    isError: false,
  }),
}))

const mutate = vi.fn()

vi.mock('@/hooks/scheduling/use-appointments', async () => {
  const real = await vi.importActual<typeof import('@/hooks/scheduling/use-appointments')>(
    '@/hooks/scheduling/use-appointments',
  )
  return {
    ...real,
    useUpdateAppointmentStatus: () => ({ mutate, isPending: false }),
    useRescheduleAppointment: () => ({ mutate: vi.fn(), isPending: false }),
    useRefundAppointment: () => ({ mutate: vi.fn(), isPending: false }),
  }
})

vi.mock('@/hooks/iam/use-team', () => ({ useTeamMembers: () => ({ data: [] }) }))
vi.mock('@/hooks/settings/use-evolution-status', () => ({
  useEvolutionStatus: () => ({ data: { connected: true } }),
}))
vi.mock('@/hooks/use-permissions', () => ({ usePermissions: () => ({ can: () => true }) }))
vi.mock('@/hooks/scheduling/use-availability', () => ({
  useAvailableSlots: () => ({ data: [], isLoading: false }),
}))

const appointment = {
  id: 'a1',
  customerId: 'c1',
  professionalId: 'p1',
  serviceId: 's1',
  packageId: null,
  promotionId: null,
  startsAt: '2026-08-02T17:00:00.000Z',
  endsAt: '2026-08-02T17:45:00.000Z',
  status: 'CONFIRMED' as const,
  paymentStatus: 'PENDING' as const,
  notes: null,
  price: '80',
  confirmedPrice: null,
  customer: { id: 'c1', name: 'Maria Silva', phone: '11999990000', notes: null },
  professional: { id: 'p1', name: 'Ana' },
  service: { id: 's1', name: 'Escova', duration: 45 },
  package: null,
  promotion: null,
}

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

afterEach(() => {
  cleanup()
  mutate.mockClear()
})

describe('no-show no drawer', () => {
  it('não registra nada só de clicar em "Não compareceu" — abre a confirmação', async () => {
    render(<AppointmentDrawer appointment={appointment} open onClose={vi.fn()} />, { wrapper })

    await userEvent.click(screen.getByRole('button', { name: /não compareceu/i }))

    expect(mutate).not.toHaveBeenCalled()
    expect(await screen.findByRole('alertdialog')).toBeInTheDocument()
  })

  it('a confirmação avisa que o cliente será notificado e mostra o texto', async () => {
    render(<AppointmentDrawer appointment={appointment} open onClose={vi.fn()} />, { wrapper })

    await userEvent.click(screen.getByRole('button', { name: /não compareceu/i }))
    const dialogo = await screen.findByRole('alertdialog')

    expect(within(dialogo).getByRole('switch')).toBeInTheDocument()
    await userEvent.click(within(dialogo).getByRole('button', { name: /ver a mensagem/i }))
    expect(within(dialogo).getByText(/não compareceu/i)).toBeInTheDocument()
  })

  it('confirmar sem tocar no toggle não manda notify', async () => {
    render(<AppointmentDrawer appointment={appointment} open onClose={vi.fn()} />, { wrapper })

    await userEvent.click(screen.getByRole('button', { name: /não compareceu/i }))
    const dialogo = await screen.findByRole('alertdialog')
    await userEvent.click(within(dialogo).getByRole('button', { name: /^confirmar$/i }))

    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'NO_SHOW', notify: undefined }),
      expect.anything(),
    )
  })

  it('desligar o aviso registra a falta sem mandar mensagem', async () => {
    render(<AppointmentDrawer appointment={appointment} open onClose={vi.fn()} />, { wrapper })

    await userEvent.click(screen.getByRole('button', { name: /não compareceu/i }))
    const dialogo = await screen.findByRole('alertdialog')
    await userEvent.click(within(dialogo).getByRole('switch'))
    await userEvent.click(within(dialogo).getByRole('button', { name: /^confirmar$/i }))

    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'NO_SHOW', notify: false }),
      expect.anything(),
    )
  })
})
```

> O drawer tem muitas dependências. Rode o teste primeiro e **acrescente os mocks que faltarem** conforme os erros aparecerem — não presuma que a lista acima está completa. Se o esforço de montar o drawer inteiro se mostrar desproporcional, extraia o `AlertDialog` de no-show para um componente próprio (`no-show-confirm-dialog.tsx`) e teste-o isolado; é a decomposição melhor e vale o desvio.

- [ ] **Step 2: Rodar e ver falhar**

```bash
npx vitest run src/components/domain/scheduling/__tests__/no-show-confirm.test.tsx
```

Esperado: falha no `role="switch"` dentro do diálogo e no `notify` da mutation.

- [ ] **Step 3: Implementar**

Em `appointment-drawer.tsx`:

1. Acrescente o estado:
   ```tsx
   const [notifyNoShow, setNotifyNoShow] = useState<boolean | undefined>(undefined)
   const [mensagemNoShow, setMensagemNoShow] = useState('')
   ```
2. Reinicie ao abrir o diálogo — no `onClick` do botão "Não compareceu":
   ```tsx
   onClick={() => {
     setNotifyNoShow(undefined)
     setMensagemNoShow('')
     setNoShowModalOpen(true)
   }}
   ```
3. Substitua o `AlertDialogContent` do no-show por:
   ```tsx
   <AlertDialogContent className="max-h-[85vh] overflow-y-auto">
     <AlertDialogHeader>
       <AlertDialogTitle>Registrar não comparecimento?</AlertDialogTitle>
       <AlertDialogDescription>
         O agendamento será marcado como não compareceu e o horário fica registrado
         como falta. Esta ação não pode ser desfeita.
       </AlertDialogDescription>
     </AlertDialogHeader>

     <CustomerMessageToggle
       event="appointment_no_show"
       appointmentId={appointment.id}
       customerId={appointment.customerId}
       value={notifyNoShow}
       onChange={setNotifyNoShow}
       message={mensagemNoShow}
       onMessageChange={setMensagemNoShow}
     />

     <AlertDialogFooter>
       <AlertDialogCancel className="min-h-11">Cancelar</AlertDialogCancel>
       <AlertDialogAction
         onClick={() => handleNoShow()}
         className="min-h-11 bg-orange-600 hover:bg-orange-700"
       >
         Confirmar
       </AlertDialogAction>
     </AlertDialogFooter>
   </AlertDialogContent>
   ```
4. Acrescente o handler dedicado ao lado de `handleStatus`:
   ```tsx
   function handleNoShow() {
     if (!appointment) return
     updateStatus.mutate(
       {
         id: appointment.id,
         status: 'NO_SHOW',
         notificationMessage: mensagemNoShow || undefined,
         notify: notifyNoShow,
       },
       {
         onSuccess: () => {
           toast.success('No-show registrado')
           onClose()
         },
         onError: (err) => {
           toast.error(err instanceof Error ? err.message : 'Erro ao registrar não comparecimento')
         },
       },
     )
   }
   ```

> `NO_SHOW` **já entrou** na lista de status que repassam `notificationMessage`, na Task 8 Step 3.5 — não mexa no `scheduling.service.ts` aqui. Se ao rodar os testes a mensagem pontual do no-show não chegar ao dispatcher, a Task 8 foi implementada incompleta: volte lá em vez de remendar nesta tarefa.

- [ ] **Step 4: Rodar e ver passar**

```bash
npx vitest run src/components/domain/scheduling/ src/domains/notifications/
npx tsc --noEmit
```

Esperado: 4 testes de no-show verdes, subscriptions verdes.

- [ ] **Step 5: Conferir mobile**

Em 375px: o `AlertDialogContent` com o toggle e a prévia expandida **rola por dentro** (`max-h-[85vh] overflow-y-auto`) e os botões Cancelar/Confirmar continuam alcançáveis.

- [ ] **Step 6: Commit**

```bash
git add src/components/domain/scheduling/
git commit -m "feat(scheduling): confirmacao de no-show com controle de aviso ao cliente"
```

---

## Task 14: Documentação e runbook de produção

**Files:**
- Modify: `docs/decisions.md` (ADR-018)
- Modify: `CLAUDE.md` (linha do domínio Notifications e bloco de pendências)
- Modify: `docs/handoff-motor-mensagens-fases-2-5.md`
- Modify: `AGENTS.md` e `.claude/AGENTS.md` se algo do fluxo de skills mudou (normalmente não muda — verifique e diga que verificou)

**Interfaces:** nenhuma. Esta tarefa é o gate antes do PR.

- [ ] **Step 1: Escrever o ADR-018**

Acrescente ao fim de `docs/decisions.md`, seguindo a estrutura do ADR-017 (Contexto / Decisão / Alternativas rejeitadas / Consequências). Precisa conter, no mínimo:

- **Contexto:** não havia liga/desliga por evento (`Tenant.whatsappEnabled` era tudo-ou-nada); o agendamento online mandava duas mensagens quase idênticas; o switch de WhatsApp do modal de confirmação **não funcionava** (mandava `notificationMessage: ''`, falsy, e o gateway caía no template e enviava assim mesmo); três textos de mensagem ao cliente ainda viviam hardcoded no frontend, ignorando o template configurado.
- **Decisão 1 — ausência de registro = padrão do catálogo**, sem seed e sem backfill, pelos motivos da seção "Decisão de implementação registrada" deste plano.
- **Decisão 2 — `notify` cru no evento, resolvido em notifications.** Cumpre "resolvido no service" sem `scheduling` importar `notifications`.
- **Decisão 3 — `Appointment.origin` persistida.** Sem ela a regra de `appointment_confirmed` da §6.4 é indecidível na hora da confirmação. Alternativas descartadas: inferir por `createdByUserId`, consultar o `NotificationLog`.
- **Decisão 4 — dispatcher único.** Oito pontos de envio viraram um.
- **Consequência (regressão consciente):** a mensagem de confirmação deixou de injetar o valor cobrado automaticamente; quem quiser precisa pôr `{{valor}}` no template.
- **Consequência (migration):** `20260727120000_add_customer_message_setting` é **manual**. Se foi gerada offline, diga isso explicitamente, como o ADR-017 fez.
- **Achado reutilizável:** qualquer switch de UI que "desliga" mandando string vazia é suspeito — `''` é falsy e costuma virar fallback silencioso. Foi exatamente o bug do modal de confirmação.

- [ ] **Step 2: Atualizar o `CLAUDE.md`**

Na tabela de status dos domínios, na linha **Notifications**, acrescente um parágrafo sobre a Fase 2 no mesmo estilo denso das entradas existentes: matriz evento × canal, `<CustomerMessageToggle>` nos pontos de disparo, contrato `notify`, `appointment_requested`, no-show com confirmação, o bug do switch corrigido, e a regressão do `{{valor}}`.

No bloco de avisos ao fim da seção, acrescente:

```
> ⚠️ 2026-07-27: motor de mensagens ao cliente — Fase 2 (ADR-018). Migration
> `20260727120000_add_customer_message_setting` **pendente de aplicação manual** em produção:
> `npx prisma migrate deploy`. **Não há backfill** — ausência de registro em
> `CustomerMessageSetting` significa "usa o padrão do catálogo" (7 transacionais ligados,
> 3 promocionais desligados, canal WhatsApp),
> então tenants existentes não mudam de comportamento no deploy. A coluna
> `Appointment.origin` nasce `PANEL` para todo o histórico: agendamentos antigos feitos
> pela vitrine não retroagem para `PUBLIC`, e confirmar um deles não vai avisar o cliente
> a menos que o profissional ligue o toggle na ação. Aceito — a alternativa exigiria
> inferir origem histórica sem dado confiável.
```

- [ ] **Step 3: Atualizar o handoff**

Em `docs/handoff-motor-mensagens-fases-2-5.md`:
- mova a Fase 2 de "o que falta" para "o que foi entregue", com os arquivos que as Fases 3–5 vão consumir (`customer-message-setting.service.ts`, `customer-message-dispatcher.service.ts`, `<CustomerMessageToggle>`, rota de prévia);
- marque a **Fase 3** como próxima;
- acrescente às "armadilhas": o switch que desliga mandando string vazia; e que a spec estava desatualizada quanto ao no-show (o `AlertDialog` já existia).

- [ ] **Step 4: Gate final**

```bash
npx tsc --noEmit
npx vitest run
```

Esperado: `tsc` zerado; vitest com **exatamente as 4 falhas do baseline**. Cole as duas saídas no relatório — sem elas, a tarefa não está pronta.

- [ ] **Step 5: Commit e PR**

```bash
git add docs/ CLAUDE.md AGENTS.md .claude/AGENTS.md
git commit -m "docs: ADR-018 e runbook da fase 2 do motor de mensagens ao cliente"
git push -u origin feat/motor-mensagens-cliente-fase-2
gh pr create --base main --title "feat(notifications): motor de mensagens ao cliente — fase 2 (controle de disparo)" --body "..."
```

O corpo do PR precisa listar: o que muda para o usuário, a **migration manual** e o fato de não haver backfill, a regressão do `{{valor}}`, o bug corrigido do switch de confirmação, e o resultado do gate (`tsc` + vitest com o baseline explicitado).

---

## Runbook de produção (Fase 2)

1. **Merge do PR.**
2. `npx prisma migrate deploy` — **manual**, a Vercel não roda migrations no build. Use a porta **5432** do Supabase (pooler em modo *session*); a **6543** trava, não suporta DDL nem advisory lock.
3. **Não há backfill.** Ausência de registro em `CustomerMessageSetting` já significa "padrão do catálogo": os 7 eventos transacionais ligados, os 3 promocionais (`birthday`, `return_due`, `winback`) desligados, canal WhatsApp.
4. `npx prisma migrate status` — confirmar limpo.
5. Verificação funcional em produção, em ordem:
   - Configurações › Notificações › Mensagens ao cliente carrega os 10 eventos: os 7 transacionais ligados e os 3 promocionais desligados;
   - desligar um evento, recarregar, confirmar que persistiu;
   - agendar pela vitrine → o cliente recebe **"recebemos seu pedido"** (não "confirmado");
   - confirmar esse pedido no painel → o cliente recebe **"está confirmado"**;
   - agendar pelo painel e confirmar → **nenhuma segunda mensagem**;
   - registrar um no-show → o diálogo aparece, mostra o texto e permite desligar.

---

## Self-review do plano

**Cobertura da seção 6 da spec**

| Requisito | Onde |
|---|---|
| 6.1 Model `CustomerMessageSetting`, padrão do negócio | T1, T3, T4 |
| 6.1 Matriz evento × canal na aba existente | T6, T7 |
| 6.1 Tenant novo com os eventos ligados | T4 (fallback do catálogo; dois desvios documentados nas Global Constraints e no ADR: sem seed, e promocional nasce desligado) |
| 6.2 `<CustomerMessageToggle>` único e reutilizado | T11 |
| 6.2 Rotula o padrão explicitamente | T11 |
| 6.2 Mostra o texto interpolado com dados reais | T10 + T11 |
| 6.2 Permite mensagem pontual | T11, T12, T13 |
| 6.2 Desabilitado com o motivo quando não há como enviar | T10 (`blockedReason`) + T11 |
| 6.2 Override vale só para a ação | T4 (`shouldNotify` não escreve nada) |
| 6.2 Contrato `notify?: boolean`, resolvido no service | T8 + T5 |
| 6.3 Criar / Cancelar / Confirmar modal / Reagendar / Confirmar drawer | T12 |
| 6.3 No-show **com modal de confirmação** | T13 |
| 6.3 Vitrine pública → `appointment_requested` | T8 |
| 6.3 Lembrete automático / Aniversário / Lembrete em massa | T9 |
| 6.4 Fluxo online sem mensagem duplicada | T8 (roteamento por origem + regra de `appointment_confirmed`) |
| §11 Mobile e desktop | T7 Step 8, T12 Step 8, T13 Step 5 |
| §11 `max-h` + `overflow-y-auto` em todo Dialog tocado | T12 Steps 3/4, T13 Step 3 |

**Fora do escopo desta fase, por decisão da spec:** permissão `mensagens` (Fase 3, §10), `marketingOptOut`/consentimento no dispatcher (Fase 3), anti-fadiga (Fase 3), campanhas (Fases 3–4), automações (Fase 5).

**Defeitos encontrados no scan do plano, antes de qualquer execução**

Quatro, todos já corrigidos acima. Registrados porque a mesma classe de erro tende a voltar:

1. **Teste que quebraria numa tarefa seguinte.** `legacy-template-backfill.test.ts` monta os casos a partir de `Object.keys(LEGACY_TEMPLATE_TO_EVENT)`. As 3 chaves novas da Task 2 fariam o teste de equivalência da Fase 1 exigir texto legado inexistente e falhar. → Task 2 Step 6 troca a origem da lista para o catálogo (`legacy !== null`).
2. **Teste que passaria só no primeiro caso.** `registerNotificationSubscriptions` tem guard de módulo; sem `vi.resetModules()` o `subscriptions.test.ts` teria handlers apenas no primeiro `it`. E, com o reset, um `import` estático do `eventBus` apontaria para a instância antiga do mock. → Task 8 Step 4 importa os dois dinamicamente dentro do `beforeEach`.
3. **Duas tarefas editando o mesmo bloco com resultados diferentes.** Task 13 mandava incluir `NO_SHOW` na lista de status que repassam `notificationMessage`, num bloco que a Task 8 já escrevia sem ele. → consolidado na Task 8 Step 3.5, com o caso de teste correspondente.
4. **Passo baseado em premissa desatualizada da spec.** A §6.3 trata "Confirmar (drawer)" como disparo direto; o código já delega ao `ConfirmAppointmentModal` (`appointment-drawer.tsx:498`). → Task 12 Step 6.5 virou verificação, não edição. Mesma coisa com o no-show: o `AlertDialog` já existe (Task 13 documenta isso).

**Defeitos encontrados durante a execução** (os que o scan não pegou)

5. **Asserção sobre um valor que eu não tinha lido.** O teste da Task 2 exigia `defaultEnabled === true` nos 10 eventos, e o Step 4 dizia "são 10 ocorrências de `defaultEnabled: true`". Eram **7**: a Fase 1 já tinha `birthday`, `return_due` e `winback` como `false`, por serem promocionais. Escrever o teste com o literal `true` teria invertido silenciosamente uma decisão de LGPD para satisfazer o plano. → decidido com o dono do produto em 2026-07-27 (promocional continua desligado), teste reescrito para afirmar a **regra** (`defaultEnabled === (nature === "transactional")`) e não o valor, e a Task 4 corrigida junto. Lição: um plano que afirma "são N ocorrências" sem ter lido as N está inventando um requisito.
6. **Teste tautológico.** O teste de "inversão exata" entre `CUSTOMER_MESSAGE_TEMPLATE_KEY` e `LEGACY_TEMPLATE_TO_EVENT` não podia falhar: o segundo mapa é **derivado** do primeiro por `Object.fromEntries`, então a inversão é verdadeira por construção. O implementador descobriu isso ao executar o teste negativo que o plano exigia — com um valor errado mas único, o teste continuava passando. → substituído pelo invariante que a derivação de fato pode violar: **duas entradas não podem compartilhar a mesma chave de log** (colisão colapsa entradas e o evento perdido vira "Template desconhecido" no gateway). É o mesmo padrão da asserção de tipo que compilava sempre, na Fase 1: uma verificação só vale o que ela consegue reprovar.

**Riscos conhecidos deste plano**

| Risco | Mitigação |
|---|---|
| Migration gerada offline nunca rodou contra Postgres real | Step 3 da T1 manda gerar pelo Prisma quando houver banco; senão, registrar no ADR e validar antes do merge |
| Agendamentos históricos da vitrine ficam com `origin = PANEL` | Aceito e documentado no `CLAUDE.md`; confirmar um deles não avisa, mas o toggle permite avisar |
| Canal EMAIL ligado passa a mandar e-mail em eventos que hoje só mandam WhatsApp | Padrão continua só WhatsApp; é opt-in explícito na matriz |
| Testes de componente do drawer podem ser frágeis | T13 Step 1 autoriza extrair o diálogo para um componente próprio se o custo de montagem for desproporcional |
| A UI da Fase 1 nunca foi validada visualmente | T7 Step 8 pede a verificação em 375px/1440px e exige reportar honestamente se o banco local não subir |
