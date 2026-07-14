# Central de Notificações da Equipe — UI (Configurações) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar a aba `Configurações › Notificações` (sub-abas "Avisos do negócio" e "Minhas preferências") sobre o motor de notificações da equipe já mergeado (PR #277), permitindo ao dono configurar quais eventos disparam e por quais canais, editar as mensagens (templates com `{{variaveis}}`), e a cada colaborador ajustar modo de entrega/quiet hours/e-mail por evento — substituindo o painel de 3 switches atual.

**Architecture:** Camada fina de API Routes sobre os repositories já existentes (`TenantNotificationSettingRepository`, `NotificationTemplateRepository`, `UserNotificationPreferenceRepository`, mais os métodos novos de preferência de entrega em `UserNotificationRepository`/`UserNotificationService`), com 2 services novos que combinam catálogo estático + repository (`TeamNotificationSettingsService`, `NotificationTemplateService`). Frontend em TanStack Query (mesmo padrão de `use-scheduling-policy.ts`/`use-automations.ts`), 2 sub-abas com `Tabs` do Shadcn, editor de template em `Dialog`.

**Tech Stack:** Next.js 15 (API Routes + App Router), Prisma/PostgreSQL, Zod, TanStack Query, Shadcn UI (`Tabs`, `Dialog`, `Switch`, `Textarea`, `Checkbox`), Vitest.

## Global Constraints

- Todo código, comentário, nome de branch, mensagem de commit e teste em Português do Brasil (CLAUDE.md).
- `tenantId` sempre extraído da sessão (`getSessionContext`) — nunca do body/URL. Toda query nova filtra por `tenantId`.
- Erros tipados de `src/shared/errors/` — nunca `throw new Error('string genérica')`.
- Camadas: API Route (fino, valida com Zod) → Service → Repository → Prisma. Nunca `prisma` direto na Route.
- Permissões: "Avisos do negócio" (rotas de configuração de negócio e templates) exige `PERMISSIONS.settings.manage` (API) / `can('configuracoes', 'edit')` (client) — mesma chave já usada em `configuracoes/page.tsx`. "Minhas preferências" é sempre do próprio usuário autenticado, sem checagem de cargo.
- Mobile-first (`.claude/skills/agent-mobile.md`): touch targets ≥ 44×44px, sem overflow horizontal em 375px, `DialogContent` do editor com `max-h` + `overflow-y-auto`, as 2 sub-abas usam seletor que funciona em telas pequenas (Shadcn `Tabs` já é responsivo por padrão — usar `w-full` no `TabsList`).
- Catálogo de eventos exibido na UI é limitado aos 7 eventos que o dispatcher já emite de verdade (`appointment_created/cancelled/rescheduled/no_show`, `customer_created`, `daily_digest`, `birthday_digest`) — `appointment_pending_confirmation`/`payment_pending` (worklist lazy) e `customer_inactive`/`agenda_idle`/`monthly_goal` (Fase 1-b/2) **não aparecem nesta tela** porque não há efeito real ainda em configurá-los.
- `npx tsc --noEmit` limpo e `npx vitest run` passando antes de qualquer commit final.

### Decisão de escopo explícita (leia antes de implementar)

O spec (seção 3.5) menciona "Defaults por cargo ao semear o tenant" (dono recebe mais eventos ligados por padrão que um profissional comum). **Este item fica fora deste plano** — exigiria alterar o fluxo de convite/criação de membro em `src/domains/iam/` (fora do domínio `notifications`, não explorado nesta sessão). Sem essa seed, um colaborador novo simplesmente herda os defaults do negócio (`TenantNotificationSetting`) até ajustar "Minhas preferências" manualmente — UX completa e funcional, só não pré-curada por cargo. Registrar como follow-up se o usuário pedir.

O horário "[08:00]" do "Resumo do dia" no mockup do spec **não é editável nesta entrega** (não há campo de hora configurável no modelo `TenantNotificationSetting`) — é fixo, mas corrigido nesta entrega para rodar no horário local do fuso do tenant (Task 6), não mais às 08:00 UTC para todos.

## Visão geral de arquivos

```
src/domains/notifications/user-notifications/
  team-notification-catalog.ts                 [criar]
  team-notification-settings.service.ts         [criar] + .test.ts
  notification-template.service.ts              [criar] + .test.ts
  tenant-notification-setting.repository.ts     [modificar] + .test.ts (adicionar casos)
  notification-template.repository.ts           [modificar] + .test.ts (adicionar casos)
  user-notification-preference.repository.ts    [modificar] + .test.ts (adicionar casos)
  user-notification.repository.ts               [modificar] + .test.ts (adicionar casos)
  user-notification.service.ts                  [modificar] + .test.ts (adicionar casos)
  types.ts                                       [modificar]

src/shared/queue/jobs/team-daily-digest.ts       [modificar] + .test.ts (adicionar caso)
src/app/api/cron/tick/route.ts                   [modificar]

src/app/api/notifications/team-settings/route.ts               [criar] + .test.ts
src/app/api/notifications/team-settings/templates/route.ts     [criar] + .test.ts
src/app/api/notifications/me/team-preferences/route.ts         [criar] + .test.ts

src/hooks/settings/use-team-notification-settings.ts       [criar]
src/hooks/settings/use-team-notification-preferences.ts    [criar]

src/components/domain/settings/team-notification-business-settings.tsx  [criar]
src/components/domain/settings/team-notification-template-editor.tsx    [criar]
src/components/domain/settings/team-notification-my-preferences.tsx     [criar]

src/app/(app)/configuracoes/notificacoes/page.tsx   [criar]
src/app/(app)/configuracoes/page.tsx                [modificar]
src/components/domain/notifications/notification-panel.tsx         [modificar]
src/components/domain/notifications/notification-preferences.tsx   [deletar]

docs/decisions.md   [modificar]
```

---

### Task 1: Catálogo de eventos da equipe

**Files:**
- Create: `src/domains/notifications/user-notifications/team-notification-catalog.ts`

**Interfaces:**
- Produces: `EventCatalogEntry` type; `TEAM_NOTIFICATION_CATALOG: EventCatalogEntry[]` (7 entradas, na ordem exibida na UI); `TEAM_NOTIFICATION_CATALOG_MAP: Record<string, EventCatalogEntry>`.

- [ ] **Step 1: Criar o arquivo**

```typescript
// src/domains/notifications/user-notifications/team-notification-catalog.ts
import type { NotificationEventType } from "@prisma/client";

export type EventCatalogEntry = {
  eventType: NotificationEventType;
  label: string;
  description: string;
  supportsEmail: boolean; // se faz sentido mostrar o toggle de e-mail pra este evento
  variables: string[]; // variáveis disponíveis no editor de template deste evento
};

// Só os eventos que o dispatcher já emite de verdade (ver Global Constraints do
// plano) — appointment_pending_confirmation/payment_pending (worklist lazy) e
// customer_inactive/agenda_idle/monthly_goal (Fase 1-b/2) ficam de fora.
export const TEAM_NOTIFICATION_CATALOG: EventCatalogEntry[] = [
  {
    eventType: "appointment_created",
    label: "Novo agendamento",
    description: "Quando um agendamento é criado (painel ou vitrine pública).",
    supportsEmail: true,
    variables: ["cliente", "servico", "profissional", "data", "hora", "negocio", "link_acao"],
  },
  {
    eventType: "appointment_cancelled",
    label: "Cancelamento",
    description: "Quando um agendamento é cancelado.",
    supportsEmail: true,
    variables: ["cliente", "servico", "profissional", "data", "hora", "negocio", "link_acao"],
  },
  {
    eventType: "appointment_rescheduled",
    label: "Reagendamento",
    description: "Quando a data ou hora de um agendamento muda.",
    supportsEmail: true,
    variables: ["cliente", "servico", "profissional", "data", "hora", "negocio", "link_acao"],
  },
  {
    eventType: "appointment_no_show",
    label: "Falta (no-show)",
    description: "Quando um cliente não comparece ao atendimento.",
    supportsEmail: true,
    variables: ["cliente", "servico", "profissional", "data", "hora", "negocio", "link_acao"],
  },
  {
    eventType: "customer_created",
    label: "Novo cliente",
    description: "Quando um cliente novo se cadastra.",
    supportsEmail: true,
    variables: ["cliente", "negocio", "link_acao"],
  },
  {
    eventType: "daily_digest",
    label: "Resumo do dia",
    description: "Resumo por e-mail dos agendamentos de hoje, enviado às 08:00 no horário do seu negócio.",
    supportsEmail: true,
    variables: ["negocio", "valor"],
  },
  {
    eventType: "birthday_digest",
    label: "Aniversariantes da semana",
    description: "Lista semanal de clientes aniversariantes, toda segunda-feira.",
    supportsEmail: false,
    variables: ["negocio"],
  },
];

export const TEAM_NOTIFICATION_CATALOG_MAP: Record<string, EventCatalogEntry> = Object.fromEntries(
  TEAM_NOTIFICATION_CATALOG.map((e) => [e.eventType, e]),
);
```

- [ ] **Step 2: Verificar tipos e commit**

Run: `npx tsc --noEmit`

```bash
git add src/domains/notifications/user-notifications/team-notification-catalog.ts
git commit -m "feat(notifications): catalogo de eventos da equipe exibidos na UI"
```

---

### Task 2: `TenantNotificationSettingRepository` — listar todos + upsert

**Files:**
- Modify: `src/domains/notifications/user-notifications/tenant-notification-setting.repository.ts`
- Modify: `src/domains/notifications/user-notifications/tenant-notification-setting.repository.test.ts` (adicionar casos ao describe existente)

**Interfaces:**
- Produces: `TenantNotificationSettingRepository.findAllByTenant(tenantId): Promise<TenantNotificationSetting[]>`; `.upsert(tenantId, eventType, data: {enabled, defaultChannels}): Promise<TenantNotificationSetting>`.

- [ ] **Step 1: Adicionar os testes** (dentro do describe existente, sem remover os 2 já presentes):

```typescript
  it("findAllByTenant retorna todas as configurações do tenant", async () => {
    prismaMock.tenantNotificationSetting.findMany.mockResolvedValue([
      { id: "s1", tenantId: "t1", eventType: "appointment_created", enabled: true, defaultChannels: ["IN_APP", "EMAIL"], templateId: null },
    ] as never);
    const result = await repo.findAllByTenant("t1");
    expect(result).toHaveLength(1);
    expect(prismaMock.tenantNotificationSetting.findMany).toHaveBeenCalledWith({ where: { tenantId: "t1" } });
  });

  it("upsert cria/atualiza a configuração pela chave composta tenantId+eventType", async () => {
    prismaMock.tenantNotificationSetting.upsert.mockResolvedValue({} as never);
    await repo.upsert("t1", "appointment_created", { enabled: false, defaultChannels: ["IN_APP"] });
    expect(prismaMock.tenantNotificationSetting.upsert).toHaveBeenCalledWith({
      where: { tenantId_eventType: { tenantId: "t1", eventType: "appointment_created" } },
      update: { enabled: false, defaultChannels: ["IN_APP"] },
      create: { tenantId: "t1", eventType: "appointment_created", enabled: false, defaultChannels: ["IN_APP"] },
    });
  });
```

- [ ] **Step 2: Rodar e confirmar falha**

Run: `npx vitest run src/domains/notifications/user-notifications/tenant-notification-setting.repository.test.ts`

Expected: FAIL — os 2 métodos novos não existem.

- [ ] **Step 3: Implementar** (adicionar à classe existente, sem remover `findByTenant`):

```typescript
  async findAllByTenant(tenantId: string): Promise<TenantNotificationSetting[]> {
    return prisma.tenantNotificationSetting.findMany({ where: { tenantId } });
  }

  async upsert(
    tenantId: string,
    eventType: NotificationEventType,
    data: { enabled: boolean; defaultChannels: TeamNotificationChannel[] },
  ): Promise<TenantNotificationSetting> {
    return prisma.tenantNotificationSetting.upsert({
      where: { tenantId_eventType: { tenantId, eventType } },
      update: data,
      create: { tenantId, eventType, ...data },
    });
  }
```

Atualizar o import do topo do arquivo para incluir `TeamNotificationChannel`:

```typescript
import type { NotificationEventType, TeamNotificationChannel, TenantNotificationSetting } from "@prisma/client";
```

- [ ] **Step 4: Rodar e confirmar sucesso**

Run: `npx vitest run src/domains/notifications/user-notifications/tenant-notification-setting.repository.test.ts`

Expected: PASS (4 testes — 2 antigos + 2 novos).

- [ ] **Step 5: Verificar tipos e commit**

Run: `npx tsc --noEmit`

```bash
git add src/domains/notifications/user-notifications/tenant-notification-setting.repository.ts src/domains/notifications/user-notifications/tenant-notification-setting.repository.test.ts
git commit -m "feat(notifications): lista e upsert de configuracao de evento por tenant"
```

---

### Task 3: `NotificationTemplateRepository` — upsert

**Files:**
- Modify: `src/domains/notifications/user-notifications/notification-template.repository.ts`
- Modify: `src/domains/notifications/user-notifications/notification-template.repository.test.ts`

**Interfaces:**
- Produces: `NotificationTemplateRepository.upsert(tenantId, eventType, channel, data: {subject, body}): Promise<NotificationTemplate>`.

- [ ] **Step 1: Adicionar o teste**

```typescript
  it("upsert cria/atualiza o template pela chave composta tenantId+eventType+channel", async () => {
    prismaMock.notificationTemplate.upsert.mockResolvedValue({} as never);
    await repo.upsert("t1", "appointment_created", "EMAIL", { subject: "Assunto", body: "Corpo {{cliente}}" });
    expect(prismaMock.notificationTemplate.upsert).toHaveBeenCalledWith({
      where: { tenantId_eventType_channel: { tenantId: "t1", eventType: "appointment_created", channel: "EMAIL" } },
      update: { subject: "Assunto", body: "Corpo {{cliente}}" },
      create: { tenantId: "t1", eventType: "appointment_created", channel: "EMAIL", subject: "Assunto", body: "Corpo {{cliente}}" },
    });
  });
```

- [ ] **Step 2: Rodar e confirmar falha**

Run: `npx vitest run src/domains/notifications/user-notifications/notification-template.repository.test.ts`

Expected: FAIL — método não existe.

- [ ] **Step 3: Implementar**

```typescript
  async upsert(
    tenantId: string,
    eventType: NotificationEventType,
    channel: TeamNotificationChannel,
    data: { subject: string | null; body: string },
  ): Promise<NotificationTemplate> {
    return prisma.notificationTemplate.upsert({
      where: { tenantId_eventType_channel: { tenantId, eventType, channel } },
      update: data,
      create: { tenantId, eventType, channel, ...data },
    });
  }
```

- [ ] **Step 4: Rodar e confirmar sucesso**

Run: `npx vitest run src/domains/notifications/user-notifications/notification-template.repository.test.ts`

Expected: PASS (3 testes).

- [ ] **Step 5: Verificar tipos e commit**

Run: `npx tsc --noEmit`

```bash
git add src/domains/notifications/user-notifications/notification-template.repository.ts src/domains/notifications/user-notifications/notification-template.repository.test.ts
git commit -m "feat(notifications): upsert de template de notificacao por tenant"
```

---

### Task 4: `UserNotificationPreferenceRepository` — listar overrides de um usuário

**Files:**
- Modify: `src/domains/notifications/user-notifications/user-notification-preference.repository.ts`
- Modify: `src/domains/notifications/user-notifications/user-notification-preference.repository.test.ts`

**Interfaces:**
- Produces: `UserNotificationPreferenceRepository.findAllForUser(tenantId, userId): Promise<{eventType, channel, enabled}[]>`.

- [ ] **Step 1: Adicionar o teste**

```typescript
  it("findAllForUser retorna todos os overrides do usuário no tenant", async () => {
    prismaMock.userNotificationPreference.findMany.mockResolvedValue([
      { eventType: "appointment_created", channel: "EMAIL", enabled: false },
    ] as never);
    const result = await repo.findAllForUser("t1", "u1");
    expect(result).toEqual([{ eventType: "appointment_created", channel: "EMAIL", enabled: false }]);
    expect(prismaMock.userNotificationPreference.findMany).toHaveBeenCalledWith({
      where: { tenantId: "t1", userId: "u1" },
      select: { eventType: true, channel: true, enabled: true },
    });
  });
```

- [ ] **Step 2: Rodar e confirmar falha**

Run: `npx vitest run src/domains/notifications/user-notifications/user-notification-preference.repository.test.ts`

Expected: FAIL — método não existe.

- [ ] **Step 3: Implementar**

```typescript
  async findAllForUser(
    tenantId: string,
    userId: string,
  ): Promise<{ eventType: NotificationEventType; channel: TeamNotificationChannel; enabled: boolean }[]> {
    return prisma.userNotificationPreference.findMany({
      where: { tenantId, userId },
      select: { eventType: true, channel: true, enabled: true },
    });
  }
```

Atualizar o import do topo para incluir `TeamNotificationChannel`:

```typescript
import type { NotificationEventType, TeamNotificationChannel } from "@prisma/client";
```

- [ ] **Step 4: Rodar e confirmar sucesso**

Run: `npx vitest run src/domains/notifications/user-notifications/user-notification-preference.repository.test.ts`

Expected: PASS (4 testes).

- [ ] **Step 5: Verificar tipos e commit**

Run: `npx tsc --noEmit`

```bash
git add src/domains/notifications/user-notifications/user-notification-preference.repository.ts src/domains/notifications/user-notifications/user-notification-preference.repository.test.ts
git commit -m "feat(notifications): lista overrides de um colaborador no repository"
```

---

### Task 5: Preferências de entrega do colaborador (`notificationDeliveryMode`/`quietHoursStart`/`quietHoursEnd`) — repository + service

**Files:**
- Modify: `src/domains/notifications/user-notifications/user-notification.repository.ts`
- Modify: `src/domains/notifications/user-notifications/user-notification.repository.test.ts`
- Modify: `src/domains/notifications/user-notifications/user-notification.service.ts`
- Modify: `src/domains/notifications/user-notifications/user-notification.service.test.ts`
- Modify: `src/domains/notifications/user-notifications/types.ts`

**Interfaces:**
- Produces: `UserNotificationRepository.findDeliveryPrefs(tenantId, userId)`; `.updateDeliveryPrefs(tenantId, userId, data)`; `UserNotificationService.getMyNotificationSettings(tenantId, userId): Promise<MyNotificationSettings>`; `.updateMyNotificationSettings(tenantId, userId, input: UpdateMyNotificationSettingsInput): Promise<void>`; types `MyNotificationSettings`, `UpdateMyNotificationSettingsInput`.

- [ ] **Step 1: Adicionar os tipos** em `types.ts` (ao final do arquivo):

```typescript
export type MyNotificationSettings = {
  notificationDeliveryMode: string;
  quietHoursStart: number | null;
  quietHoursEnd: number | null;
  emailOverrides: { eventType: NotificationEventType; enabled: boolean }[];
};

export type UpdateMyNotificationSettingsInput = {
  notificationDeliveryMode?: string;
  quietHoursStart?: number | null;
  quietHoursEnd?: number | null;
  emailOverrides?: { eventType: NotificationEventType; enabled: boolean }[];
};
```

Adicionar o import de `NotificationEventType` no topo do arquivo (se ainda não vier de `@prisma/client` no import existente — confirme antes de duplicar):

```typescript
import type { NotificationEventType, Prisma, UserRole } from "@prisma/client";
```

- [ ] **Step 2: Adicionar os testes do repository** (dentro do describe existente):

```typescript
  it("findDeliveryPrefs busca por id e tenant", async () => {
    prismaMock.user.findFirst.mockResolvedValue({
      notificationDeliveryMode: "digest", quietHoursStart: 22, quietHoursEnd: 7,
    } as never);
    const result = await repo.findDeliveryPrefs("t1", "u1");
    expect(result).toEqual({ notificationDeliveryMode: "digest", quietHoursStart: 22, quietHoursEnd: 7 });
    expect(prismaMock.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "u1", tenantId: "t1" } }),
    );
  });

  it("updateDeliveryPrefs atualiza e retorna os campos", async () => {
    prismaMock.user.update.mockResolvedValue({
      notificationDeliveryMode: "digest", quietHoursStart: 22, quietHoursEnd: 7,
    } as never);
    const result = await repo.updateDeliveryPrefs("t1", "u1", { notificationDeliveryMode: "digest" });
    expect(result.notificationDeliveryMode).toBe("digest");
    expect(prismaMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "u1", tenantId: "t1" }, data: { notificationDeliveryMode: "digest" } }),
    );
  });
```

- [ ] **Step 3: Rodar e confirmar falha**

Run: `npx vitest run src/domains/notifications/user-notifications/user-notification.repository.test.ts`

Expected: FAIL — os 2 métodos novos não existem.

- [ ] **Step 4: Implementar no repository** (adicionar à classe, sem remover nada existente):

```typescript
  async findDeliveryPrefs(
    tenantId: string,
    userId: string,
  ): Promise<{ notificationDeliveryMode: string; quietHoursStart: number | null; quietHoursEnd: number | null } | null> {
    return prisma.user.findFirst({
      where: { id: userId, tenantId },
      select: { notificationDeliveryMode: true, quietHoursStart: true, quietHoursEnd: true },
    });
  }

  async updateDeliveryPrefs(
    tenantId: string,
    userId: string,
    data: Partial<{ notificationDeliveryMode: string; quietHoursStart: number | null; quietHoursEnd: number | null }>,
  ): Promise<{ notificationDeliveryMode: string; quietHoursStart: number | null; quietHoursEnd: number | null }> {
    return prisma.user.update({
      where: { id: userId, tenantId },
      data,
      select: { notificationDeliveryMode: true, quietHoursStart: true, quietHoursEnd: true },
    });
  }
```

- [ ] **Step 5: Rodar e confirmar sucesso do repository**

Run: `npx vitest run src/domains/notifications/user-notifications/user-notification.repository.test.ts`

Expected: PASS (22 testes — 20 antigos + 2 novos).

- [ ] **Step 6: Adicionar os testes do service** (dentro do describe existente, seguindo o padrão de mocks já usado no arquivo — `repo`/`prefRepo` como objetos `vi.fn()`):

```typescript
describe("UserNotificationService.getMyNotificationSettings", () => {
  let service: UserNotificationService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new UserNotificationService(repo as never, prefRepo as never);
  });

  it("combina prefs de entrega + overrides de e-mail do usuário", async () => {
    repo.findDeliveryPrefs.mockResolvedValue({ notificationDeliveryMode: "digest", quietHoursStart: 22, quietHoursEnd: 7 });
    prefRepo.findAllForUser.mockResolvedValue([
      { eventType: "appointment_created", channel: "EMAIL", enabled: false },
      { eventType: "customer_created", channel: "IN_APP", enabled: true },
    ]);

    const result = await service.getMyNotificationSettings("t1", "u1");

    expect(result.notificationDeliveryMode).toBe("digest");
    expect(result.quietHoursStart).toBe(22);
    expect(result.emailOverrides).toEqual([{ eventType: "appointment_created", enabled: false }]);
  });

  it("usa defaults quando o usuário não tem prefs de entrega salvas", async () => {
    repo.findDeliveryPrefs.mockResolvedValue(null);
    prefRepo.findAllForUser.mockResolvedValue([]);

    const result = await service.getMyNotificationSettings("t1", "u1");

    expect(result).toEqual({
      notificationDeliveryMode: "realtime", quietHoursStart: null, quietHoursEnd: null, emailOverrides: [],
    });
  });
});

describe("UserNotificationService.updateMyNotificationSettings", () => {
  let service: UserNotificationService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new UserNotificationService(repo as never, prefRepo as never);
    repo.updateDeliveryPrefs.mockResolvedValue({});
    prefRepo.upsertEmailOverride.mockResolvedValue(undefined);
  });

  it("atualiza prefs de entrega e overrides de e-mail juntos", async () => {
    await service.updateMyNotificationSettings("t1", "u1", {
      notificationDeliveryMode: "digest",
      emailOverrides: [{ eventType: "appointment_created", enabled: false }],
    });

    expect(repo.updateDeliveryPrefs).toHaveBeenCalledWith("t1", "u1", {
      notificationDeliveryMode: "digest", quietHoursStart: undefined, quietHoursEnd: undefined,
    });
    expect(prefRepo.upsertEmailOverride).toHaveBeenCalledWith("t1", "u1", "appointment_created", false);
  });

  it("não toca prefs de entrega quando só overrides são enviados", async () => {
    await service.updateMyNotificationSettings("t1", "u1", {
      emailOverrides: [{ eventType: "customer_created", enabled: true }],
    });
    expect(repo.updateDeliveryPrefs).not.toHaveBeenCalled();
    expect(prefRepo.upsertEmailOverride).toHaveBeenCalledWith("t1", "u1", "customer_created", true);
  });
});
```

- [ ] **Step 7: Rodar e confirmar falha do service**

Run: `npx vitest run src/domains/notifications/user-notifications/user-notification.service.test.ts`

Expected: FAIL — os 2 métodos novos não existem no service.

- [ ] **Step 8: Implementar no service** (adicionar à classe, sem remover nada existente):

```typescript
  async getMyNotificationSettings(tenantId: string, userId: string): Promise<MyNotificationSettings> {
    const [deliveryPrefs, overrides] = await Promise.all([
      this.repo.findDeliveryPrefs(tenantId, userId),
      this.prefRepo.findAllForUser(tenantId, userId),
    ]);
    return {
      notificationDeliveryMode: deliveryPrefs?.notificationDeliveryMode ?? "realtime",
      quietHoursStart: deliveryPrefs?.quietHoursStart ?? null,
      quietHoursEnd: deliveryPrefs?.quietHoursEnd ?? null,
      emailOverrides: overrides
        .filter((o) => o.channel === "EMAIL")
        .map((o) => ({ eventType: o.eventType, enabled: o.enabled })),
    };
  }

  async updateMyNotificationSettings(
    tenantId: string,
    userId: string,
    input: UpdateMyNotificationSettingsInput,
  ): Promise<void> {
    const { notificationDeliveryMode, quietHoursStart, quietHoursEnd, emailOverrides } = input;
    const tasks: Promise<unknown>[] = [];

    if (notificationDeliveryMode !== undefined || quietHoursStart !== undefined || quietHoursEnd !== undefined) {
      tasks.push(
        this.repo.updateDeliveryPrefs(tenantId, userId, { notificationDeliveryMode, quietHoursStart, quietHoursEnd }),
      );
    }
    if (emailOverrides) {
      for (const o of emailOverrides) {
        tasks.push(this.prefRepo.upsertEmailOverride(tenantId, userId, o.eventType, o.enabled));
      }
    }

    await Promise.all(tasks);
  }
```

E atualizar o import de tipos no topo do arquivo:

```typescript
import type { MyNotificationSettings, NotificationPrefs, UpdateMyNotificationSettingsInput } from "./types";
```

- [ ] **Step 9: Rodar e confirmar sucesso**

Run: `npx vitest run src/domains/notifications/user-notifications/user-notification.service.test.ts`

Expected: PASS (10 testes — 6 antigos + 4 novos).

- [ ] **Step 10: Verificar tipos e commit**

Run: `npx tsc --noEmit`

```bash
git add src/domains/notifications/user-notifications/user-notification.repository.ts src/domains/notifications/user-notifications/user-notification.repository.test.ts src/domains/notifications/user-notifications/user-notification.service.ts src/domains/notifications/user-notifications/user-notification.service.test.ts src/domains/notifications/user-notifications/types.ts
git commit -m "feat(notifications): preferencias de entrega do colaborador (modo, quiet hours, overrides)"
```

---

### Task 6: Corrigir o resumo diário para rodar no horário local do tenant (não UTC)

**Files:**
- Modify: `src/shared/queue/jobs/team-daily-digest.ts`
- Modify: `src/shared/queue/jobs/team-daily-digest.test.ts`
- Modify: `src/app/api/cron/tick/route.ts`

**Interfaces:** nenhuma nova — só corrige o comportamento de `handleTeamDailyDigest` e a frequência do cron que a dispara.

- [ ] **Step 1: Escrever o teste do novo comportamento** (adicionar ao arquivo de teste existente, sem remover os 5 testes já lá — os testes antigos continuam válidos, pois neles o `Intl.DateTimeFormat` mockado/real deve bater com a hora "atual" do ambiente de teste; adicione este novo caso especificamente para a lógica de corte por hora):

```typescript
  it("só processa o tenant quando é 08h no horário local dele (não processa em outro horário)", async () => {
    // Mocka Date para uma hora fixa e usa um timezone cujo offset garante
    // que 08h local NÃO corresponde à hora do sistema (America/Los_Angeles,
    // bem distante de qualquer timezone real do servidor de CI/dev).
    vi.setSystemTime(new Date("2026-07-13T08:00:00Z")); // 08h UTC
    tenantFindMany.mockResolvedValue([{ id: "t1", name: "Estúdio X", timezone: "America/Los_Angeles" }]); // UTC-7/8, não é 08h lá
    findAllForDigest.mockResolvedValue([{ id: "u1", email: "u1@x.com", notificationDeliveryMode: "realtime" }]);

    await handleTeamDailyDigest();

    expect(emailSend).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
```

Adicionar `vi.useFakeTimers()` no `beforeEach` do describe (ou de um describe aninhado só para este caso) se o arquivo ainda não usa fake timers — confira o `beforeEach` atual antes de duplicar configuração.

- [ ] **Step 2: Rodar e confirmar falha**

Run: `npx vitest run src/shared/queue/jobs/team-daily-digest.test.ts`

Expected: FAIL — hoje o job processa todo tenant incondicionalmente, sem checar a hora local.

- [ ] **Step 3: Implementar o corte por hora local**

Em `src/shared/queue/jobs/team-daily-digest.ts`, adicionar a checagem logo no início do loop `for (const tenant of tenants)`, antes de qualquer outra query (mesma técnica de `src/shared/queue/jobs/daily-status.ts:29-37`, com uma diferença: aqui a hora é sempre 08, não configurável por tenant nesta entrega — ver "Decisão de escopo explícita" do plano):

```typescript
  for (const tenant of tenants) {
    const localHour = parseInt(
      new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: tenant.timezone }).format(new Date()),
      10,
    );
    if (localHour !== 8) continue;

    const users = await userNotificationRepository.findAllForDigest(tenant.id);
    if (users.length === 0) continue;
    // ... resto do loop inalterado
```

- [ ] **Step 4: Rodar e confirmar sucesso**

Run: `npx vitest run src/shared/queue/jobs/team-daily-digest.test.ts`

Expected: PASS (6 testes — 5 antigos + 1 novo). Se algum teste antigo quebrar por causa do novo corte de hora, ajuste o `now`/`vi.setSystemTime` desse teste para cair dentro das 08h no timezone usado nele (a maioria já usa `"America/Sao_Paulo"` sem mockar hora do sistema — adicione `vi.setSystemTime` fixando um horário que caia às 08h em `America/Sao_Paulo`, ex.: `"2026-07-13T11:00:00Z"`).

- [ ] **Step 5: Trocar o cron de diário para horário, no `/api/cron/tick`**

Em `src/app/api/cron/tick/route.ts`, trocar a linha do schedule do `TEAM_DAILY_DIGEST_JOB` (dentro do `Promise.all` de `boss.schedule(...)`):

```typescript
      boss.schedule(TEAM_DAILY_DIGEST_JOB, "0 * * * *", {}),
```

(Antes era `"0 8 * * *"` — roda a cada hora agora, e o próprio job decide se é a hora certa por tenant, igual ao `DAILY_STATUS_JOB` já faz.)

- [ ] **Step 6: Verificar tipos e commit**

Run: `npx tsc --noEmit`

```bash
git add src/shared/queue/jobs/team-daily-digest.ts src/shared/queue/jobs/team-daily-digest.test.ts src/app/api/cron/tick/route.ts
git commit -m "fix(notifications): resumo diario roda no horario local do tenant, nao mais fixo em UTC"
```

---

### Task 7: Service + rota de API — Avisos do negócio

**Files:**
- Create: `src/domains/notifications/user-notifications/team-notification-settings.service.ts`
- Test: `src/domains/notifications/user-notifications/team-notification-settings.service.test.ts`
- Create: `src/app/api/notifications/team-settings/route.ts`
- Test: `src/app/api/notifications/team-settings/route.test.ts`

**Interfaces:**
- Consumes: `TEAM_NOTIFICATION_CATALOG` (Task 1), `tenantNotificationSettingRepository` (Task 2), `SYSTEM_DEFAULT_TENANT_SETTINGS` (já existe em `notification-channel-resolver.ts`).
- Produces: `BusinessEventSettingDTO` type; `TeamNotificationSettingsService.listForTenant(tenantId): Promise<BusinessEventSettingDTO[]>`; `.updateEvent(tenantId, eventType, data): Promise<TenantNotificationSetting>`; rotas `GET`/`PATCH /api/notifications/team-settings`.

- [ ] **Step 1: Escrever o teste do service**

```typescript
// src/domains/notifications/user-notifications/team-notification-settings.service.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { TeamNotificationSettingsService } from "./team-notification-settings.service";

const repo = { findAllByTenant: vi.fn(), upsert: vi.fn() };

describe("TeamNotificationSettingsService.listForTenant", () => {
  let service: TeamNotificationSettingsService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new TeamNotificationSettingsService(repo as never);
  });

  it("combina o catálogo com as configurações salvas do tenant", async () => {
    repo.findAllByTenant.mockResolvedValue([
      { eventType: "appointment_created", enabled: false, defaultChannels: ["IN_APP"] },
    ]);

    const result = await service.listForTenant("t1");

    expect(result).toHaveLength(7); // todo o catálogo, mesmo sem linha salva
    const created = result.find((r) => r.eventType === "appointment_created");
    expect(created?.enabled).toBe(false);
    expect(created?.defaultChannels).toEqual(["IN_APP"]);
    expect(created?.label).toBe("Novo agendamento");
  });

  it("usa o default do sistema para evento sem configuração salva", async () => {
    repo.findAllByTenant.mockResolvedValue([]);
    const result = await service.listForTenant("t1");
    const customerCreated = result.find((r) => r.eventType === "customer_created");
    expect(customerCreated?.enabled).toBe(true);
    expect(customerCreated?.defaultChannels).toEqual(["IN_APP"]);
  });
});

describe("TeamNotificationSettingsService.updateEvent", () => {
  it("delega ao repository", async () => {
    repo.upsert.mockResolvedValue({ eventType: "appointment_created" });
    const service = new TeamNotificationSettingsService(repo as never);
    await service.updateEvent("t1", "appointment_created", { enabled: true, defaultChannels: ["IN_APP", "EMAIL"] });
    expect(repo.upsert).toHaveBeenCalledWith("t1", "appointment_created", { enabled: true, defaultChannels: ["IN_APP", "EMAIL"] });
  });
});
```

- [ ] **Step 2: Rodar e confirmar falha**

Run: `npx vitest run src/domains/notifications/user-notifications/team-notification-settings.service.test.ts`

Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar o service**

```typescript
// src/domains/notifications/user-notifications/team-notification-settings.service.ts
import type { NotificationEventType, TeamNotificationChannel, TenantNotificationSetting } from "@prisma/client";

import { TEAM_NOTIFICATION_CATALOG } from "./team-notification-catalog";
import {
  tenantNotificationSettingRepository,
  TenantNotificationSettingRepository,
} from "./tenant-notification-setting.repository";
import { SYSTEM_DEFAULT_TENANT_SETTINGS } from "./notification-channel-resolver";

export type BusinessEventSettingDTO = {
  eventType: NotificationEventType;
  label: string;
  description: string;
  supportsEmail: boolean;
  enabled: boolean;
  defaultChannels: TeamNotificationChannel[];
};

export class TeamNotificationSettingsService {
  constructor(
    private readonly repo: TenantNotificationSettingRepository = tenantNotificationSettingRepository,
  ) {}

  async listForTenant(tenantId: string): Promise<BusinessEventSettingDTO[]> {
    const rows = await this.repo.findAllByTenant(tenantId);
    const byEvent = new Map(rows.map((r) => [r.eventType, r]));

    return TEAM_NOTIFICATION_CATALOG.map((entry) => {
      const row = byEvent.get(entry.eventType);
      const fallback = SYSTEM_DEFAULT_TENANT_SETTINGS[entry.eventType];
      return {
        eventType: entry.eventType,
        label: entry.label,
        description: entry.description,
        supportsEmail: entry.supportsEmail,
        enabled: row?.enabled ?? fallback.enabled,
        defaultChannels: row?.defaultChannels ?? fallback.defaultChannels,
      };
    });
  }

  updateEvent(
    tenantId: string,
    eventType: NotificationEventType,
    data: { enabled: boolean; defaultChannels: TeamNotificationChannel[] },
  ): Promise<TenantNotificationSetting> {
    return this.repo.upsert(tenantId, eventType, data);
  }
}

export const teamNotificationSettingsService = new TeamNotificationSettingsService();
```

- [ ] **Step 4: Rodar e confirmar sucesso do service**

Run: `npx vitest run src/domains/notifications/user-notifications/team-notification-settings.service.test.ts`

Expected: PASS (3 testes).

- [ ] **Step 5: Escrever o teste da rota de API**

```typescript
// src/app/api/notifications/team-settings/route.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, PATCH } from "./route";

const getSessionContext = vi.fn();
vi.mock("@/shared/auth/session", () => ({ getSessionContext: (...args: unknown[]) => getSessionContext(...args) }));

const listForTenant = vi.fn();
const updateEvent = vi.fn();
vi.mock("@/domains/notifications/user-notifications/team-notification-settings.service", () => ({
  teamNotificationSettingsService: {
    listForTenant: (...args: unknown[]) => listForTenant(...args),
    updateEvent: (...args: unknown[]) => updateEvent(...args),
  },
}));

function makeSession(overrides: Partial<{ isOwner: boolean; permissions: Record<string, string[]> }> = {}) {
  return {
    tenantId: "t1", userId: "u1",
    isOwner: overrides.isOwner ?? false,
    permissions: overrides.permissions ?? { configuracoes: ["view", "edit"] },
  };
}

describe("GET /api/notifications/team-settings", () => {
  beforeEach(() => vi.clearAllMocks());

  it("retorna a lista de configurações do tenant", async () => {
    getSessionContext.mockResolvedValue(makeSession());
    listForTenant.mockResolvedValue([{ eventType: "appointment_created", enabled: true }]);

    const res = await GET(new Request("http://x/api/notifications/team-settings"));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.settings).toHaveLength(1);
    expect(listForTenant).toHaveBeenCalledWith("t1");
  });

  it("403 quando falta permissão", async () => {
    getSessionContext.mockResolvedValue(makeSession({ permissions: {} }));
    const res = await GET(new Request("http://x/api/notifications/team-settings"));
    expect(res.status).toBe(403);
  });
});

describe("PATCH /api/notifications/team-settings", () => {
  beforeEach(() => vi.clearAllMocks());

  it("atualiza um evento com permissão de edição", async () => {
    getSessionContext.mockResolvedValue(makeSession());
    updateEvent.mockResolvedValue({ eventType: "appointment_created", enabled: false });

    const res = await PATCH(
      new Request("http://x/api/notifications/team-settings", {
        method: "PATCH",
        body: JSON.stringify({ eventType: "appointment_created", enabled: false, defaultChannels: ["IN_APP"] }),
      }),
    );

    expect(res.status).toBe(200);
    expect(updateEvent).toHaveBeenCalledWith("t1", "appointment_created", { enabled: false, defaultChannels: ["IN_APP"] });
  });

  it("422 com payload inválido", async () => {
    getSessionContext.mockResolvedValue(makeSession());
    const res = await PATCH(
      new Request("http://x/api/notifications/team-settings", {
        method: "PATCH",
        body: JSON.stringify({ eventType: "evento_invalido", enabled: "nao-e-boolean" }),
      }),
    );
    expect(res.status).toBe(422);
  });
});
```

- [ ] **Step 6: Rodar e confirmar falha**

Run: `npx vitest run src/app/api/notifications/team-settings/route.test.ts`

Expected: FAIL — rota não existe.

- [ ] **Step 7: Implementar a rota**

```typescript
// src/app/api/notifications/team-settings/route.ts
import { z } from "zod";

import { initializeDomainRuntime } from "@/app/api/_lib/runtime";
import { ensurePermission, PERMISSIONS } from "@/shared/auth/permissions";
import { getSessionContext } from "@/shared/auth/session";
import { handleApiError } from "@/shared/http/handle-api-error";
import { validateInput } from "@/shared/http/validate-input";
import { teamNotificationSettingsService } from "@/domains/notifications/user-notifications/team-notification-settings.service";

const updateSchema = z.object({
  eventType: z.enum([
    "appointment_created",
    "appointment_cancelled",
    "appointment_rescheduled",
    "appointment_no_show",
    "customer_created",
    "daily_digest",
    "birthday_digest",
  ]),
  enabled: z.boolean(),
  defaultChannels: z.array(z.enum(["IN_APP", "EMAIL"])),
});

export async function GET(request: Request) {
  initializeDomainRuntime();
  try {
    const session = await getSessionContext(request);
    ensurePermission(session, PERMISSIONS.settings.view);
    const settings = await teamNotificationSettingsService.listForTenant(session.tenantId);
    return Response.json({ settings });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: Request) {
  initializeDomainRuntime();
  try {
    const session = await getSessionContext(request);
    ensurePermission(session, PERMISSIONS.settings.manage);
    const input = await validateInput(request, updateSchema);
    const updated = await teamNotificationSettingsService.updateEvent(session.tenantId, input.eventType, {
      enabled: input.enabled,
      defaultChannels: input.defaultChannels,
    });
    return Response.json(updated);
  } catch (error) {
    return handleApiError(error);
  }
}
```

- [ ] **Step 8: Rodar e confirmar sucesso**

Run: `npx vitest run src/app/api/notifications/team-settings/route.test.ts`

Expected: PASS (4 testes).

- [ ] **Step 9: Verificar tipos e commit**

Run: `npx tsc --noEmit`

```bash
git add src/domains/notifications/user-notifications/team-notification-settings.service.ts src/domains/notifications/user-notifications/team-notification-settings.service.test.ts src/app/api/notifications/team-settings/route.ts src/app/api/notifications/team-settings/route.test.ts
git commit -m "feat(notifications): service e rota de API dos avisos do negocio"
```

---

### Task 8: Service + rota de API — templates de mensagem

**Files:**
- Create: `src/domains/notifications/user-notifications/notification-template.service.ts`
- Test: `src/domains/notifications/user-notifications/notification-template.service.test.ts`
- Create: `src/app/api/notifications/team-settings/templates/route.ts`
- Test: `src/app/api/notifications/team-settings/templates/route.test.ts`

**Interfaces:**
- Consumes: `notificationTemplateRepository` (Task 3), `getSystemTemplate` (já existe em `system-default-templates.ts`).
- Produces: `NotificationTemplateService.getForTenant(tenantId, eventType, channel): Promise<{subject, body, isSystemDefault} | null>`; `.upsert(tenantId, eventType, channel, data): Promise<NotificationTemplate>`; rotas `GET`/`PUT /api/notifications/team-settings/templates`.

- [ ] **Step 1: Escrever o teste do service**

```typescript
// src/domains/notifications/user-notifications/notification-template.service.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NotificationTemplateService } from "./notification-template.service";

const repo = { findByTenant: vi.fn(), upsert: vi.fn() };

describe("NotificationTemplateService.getForTenant", () => {
  let service: NotificationTemplateService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new NotificationTemplateService(repo as never);
  });

  it("retorna o template do tenant quando existe", async () => {
    repo.findByTenant.mockResolvedValue({ subject: "Assunto custom", body: "Corpo custom" });
    const result = await service.getForTenant("t1", "appointment_created", "EMAIL");
    expect(result).toEqual({ subject: "Assunto custom", body: "Corpo custom", isSystemDefault: false });
  });

  it("cai pro template padrão do sistema quando o tenant não tem um próprio", async () => {
    repo.findByTenant.mockResolvedValue(null);
    const result = await service.getForTenant("t1", "appointment_created", "EMAIL");
    expect(result?.isSystemDefault).toBe(true);
    expect(result?.subject).toBe("Novo agendamento");
  });

  it("retorna null quando nem o tenant nem o sistema têm template pro canal (ex.: birthday_digest/EMAIL)", async () => {
    repo.findByTenant.mockResolvedValue(null);
    const result = await service.getForTenant("t1", "birthday_digest", "EMAIL");
    expect(result).toBeNull();
  });
});

describe("NotificationTemplateService.upsert", () => {
  it("delega ao repository", async () => {
    repo.upsert.mockResolvedValue({ id: "tpl1" });
    const service = new NotificationTemplateService(repo as never);
    await service.upsert("t1", "appointment_created", "EMAIL", { subject: "S", body: "B" });
    expect(repo.upsert).toHaveBeenCalledWith("t1", "appointment_created", "EMAIL", { subject: "S", body: "B" });
  });
});
```

- [ ] **Step 2: Rodar e confirmar falha**

Run: `npx vitest run src/domains/notifications/user-notifications/notification-template.service.test.ts`

Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar o service**

```typescript
// src/domains/notifications/user-notifications/notification-template.service.ts
import type { NotificationEventType, NotificationTemplate, TeamNotificationChannel } from "@prisma/client";

import {
  notificationTemplateRepository,
  NotificationTemplateRepository,
} from "./notification-template.repository";
import { getSystemTemplate } from "./system-default-templates";

export type TemplateDTO = { subject: string | null; body: string; isSystemDefault: boolean };

export class NotificationTemplateService {
  constructor(
    private readonly repo: NotificationTemplateRepository = notificationTemplateRepository,
  ) {}

  async getForTenant(
    tenantId: string,
    eventType: NotificationEventType,
    channel: TeamNotificationChannel,
  ): Promise<TemplateDTO | null> {
    const row = await this.repo.findByTenant(tenantId, eventType, channel);
    if (row) return { subject: row.subject, body: row.body, isSystemDefault: false };

    const fallback = getSystemTemplate(eventType, channel);
    return fallback ? { ...fallback, isSystemDefault: true } : null;
  }

  upsert(
    tenantId: string,
    eventType: NotificationEventType,
    channel: TeamNotificationChannel,
    data: { subject: string | null; body: string },
  ): Promise<NotificationTemplate> {
    return this.repo.upsert(tenantId, eventType, channel, data);
  }
}

export const notificationTemplateService = new NotificationTemplateService();
```

- [ ] **Step 4: Rodar e confirmar sucesso do service**

Run: `npx vitest run src/domains/notifications/user-notifications/notification-template.service.test.ts`

Expected: PASS (4 testes).

- [ ] **Step 5: Escrever o teste da rota**

```typescript
// src/app/api/notifications/team-settings/templates/route.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, PUT } from "./route";

const getSessionContext = vi.fn();
vi.mock("@/shared/auth/session", () => ({ getSessionContext: (...args: unknown[]) => getSessionContext(...args) }));

const getForTenant = vi.fn();
const upsertTemplate = vi.fn();
vi.mock("@/domains/notifications/user-notifications/notification-template.service", () => ({
  notificationTemplateService: {
    getForTenant: (...args: unknown[]) => getForTenant(...args),
    upsert: (...args: unknown[]) => upsertTemplate(...args),
  },
}));

function makeSession() {
  return { tenantId: "t1", userId: "u1", isOwner: false, permissions: { configuracoes: ["view", "edit"] } };
}

describe("GET /api/notifications/team-settings/templates", () => {
  beforeEach(() => vi.clearAllMocks());

  it("retorna o template pro evento+canal pedidos via query string", async () => {
    getSessionContext.mockResolvedValue(makeSession());
    getForTenant.mockResolvedValue({ subject: "S", body: "B", isSystemDefault: true });

    const res = await GET(
      new Request("http://x/api/notifications/team-settings/templates?eventType=appointment_created&channel=EMAIL"),
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.subject).toBe("S");
    expect(getForTenant).toHaveBeenCalledWith("t1", "appointment_created", "EMAIL");
  });

  it("422 quando eventType/channel da query são inválidos ou ausentes", async () => {
    getSessionContext.mockResolvedValue(makeSession());
    const res = await GET(new Request("http://x/api/notifications/team-settings/templates"));
    expect(res.status).toBe(422);
  });
});

describe("PUT /api/notifications/team-settings/templates", () => {
  beforeEach(() => vi.clearAllMocks());

  it("salva o template custom do tenant", async () => {
    getSessionContext.mockResolvedValue(makeSession());
    upsertTemplate.mockResolvedValue({ subject: "S", body: "B" });

    const res = await PUT(
      new Request("http://x/api/notifications/team-settings/templates", {
        method: "PUT",
        body: JSON.stringify({ eventType: "appointment_created", channel: "EMAIL", subject: "S", body: "B" }),
      }),
    );

    expect(res.status).toBe(200);
    expect(upsertTemplate).toHaveBeenCalledWith("t1", "appointment_created", "EMAIL", { subject: "S", body: "B" });
  });
});
```

- [ ] **Step 6: Rodar e confirmar falha**

Run: `npx vitest run src/app/api/notifications/team-settings/templates/route.test.ts`

Expected: FAIL — rota não existe.

- [ ] **Step 7: Implementar a rota**

```typescript
// src/app/api/notifications/team-settings/templates/route.ts
import { z } from "zod";

import { initializeDomainRuntime } from "@/app/api/_lib/runtime";
import { ensurePermission, PERMISSIONS } from "@/shared/auth/permissions";
import { getSessionContext } from "@/shared/auth/session";
import { handleApiError } from "@/shared/http/handle-api-error";
import { validateInput } from "@/shared/http/validate-input";
import { ValidationError } from "@/shared/errors";
import { notificationTemplateService } from "@/domains/notifications/user-notifications/notification-template.service";

const eventTypeSchema = z.enum([
  "appointment_created",
  "appointment_cancelled",
  "appointment_rescheduled",
  "appointment_no_show",
  "customer_created",
  "daily_digest",
  "birthday_digest",
]);
const channelSchema = z.enum(["IN_APP", "EMAIL"]);

const putSchema = z.object({
  eventType: eventTypeSchema,
  channel: channelSchema,
  subject: z.string().nullable(),
  body: z.string().min(1),
});

export async function GET(request: Request) {
  initializeDomainRuntime();
  try {
    const session = await getSessionContext(request);
    ensurePermission(session, PERMISSIONS.settings.view);

    const url = new URL(request.url);
    const eventTypeResult = eventTypeSchema.safeParse(url.searchParams.get("eventType"));
    const channelResult = channelSchema.safeParse(url.searchParams.get("channel"));
    if (!eventTypeResult.success || !channelResult.success) {
      throw new ValidationError("eventType/channel inválidos ou ausentes na query string.");
    }

    const template = await notificationTemplateService.getForTenant(
      session.tenantId, eventTypeResult.data, channelResult.data,
    );
    return Response.json(template);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request: Request) {
  initializeDomainRuntime();
  try {
    const session = await getSessionContext(request);
    ensurePermission(session, PERMISSIONS.settings.manage);
    const input = await validateInput(request, putSchema);
    const updated = await notificationTemplateService.upsert(session.tenantId, input.eventType, input.channel, {
      subject: input.subject, body: input.body,
    });
    return Response.json(updated);
  } catch (error) {
    return handleApiError(error);
  }
}
```

- [ ] **Step 8: Rodar e confirmar sucesso**

Run: `npx vitest run src/app/api/notifications/team-settings/templates/route.test.ts`

Expected: PASS (3 testes).

- [ ] **Step 9: Verificar tipos e commit**

Run: `npx tsc --noEmit`

```bash
git add src/domains/notifications/user-notifications/notification-template.service.ts src/domains/notifications/user-notifications/notification-template.service.test.ts src/app/api/notifications/team-settings/templates/route.ts src/app/api/notifications/team-settings/templates/route.test.ts
git commit -m "feat(notifications): service e rota de API do editor de templates"
```

---

### Task 9: Rota de API — Minhas preferências

**Files:**
- Create: `src/app/api/notifications/me/team-preferences/route.ts`
- Test: `src/app/api/notifications/me/team-preferences/route.test.ts`

**Interfaces:**
- Consumes: `userNotificationService.getMyNotificationSettings`/`.updateMyNotificationSettings` (Task 5).
- Produces: `GET`/`PATCH /api/notifications/me/team-preferences`.

- [ ] **Step 1: Escrever o teste**

```typescript
// src/app/api/notifications/me/team-preferences/route.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, PATCH } from "./route";

const getSessionContext = vi.fn();
vi.mock("@/shared/auth/session", () => ({ getSessionContext: (...args: unknown[]) => getSessionContext(...args) }));

const getMyNotificationSettings = vi.fn();
const updateMyNotificationSettings = vi.fn();
vi.mock("@/domains/notifications/user-notifications/user-notification.service", () => ({
  userNotificationService: {
    getMyNotificationSettings: (...args: unknown[]) => getMyNotificationSettings(...args),
    updateMyNotificationSettings: (...args: unknown[]) => updateMyNotificationSettings(...args),
  },
}));

function makeSession() {
  return { tenantId: "t1", userId: "u1", isOwner: false, permissions: {} };
}

describe("GET /api/notifications/me/team-preferences", () => {
  beforeEach(() => vi.clearAllMocks());

  it("retorna as preferências do próprio usuário, sem checagem de permissão de cargo", async () => {
    getSessionContext.mockResolvedValue(makeSession());
    getMyNotificationSettings.mockResolvedValue({
      notificationDeliveryMode: "realtime", quietHoursStart: null, quietHoursEnd: null, emailOverrides: [],
    });

    const res = await GET(new Request("http://x/api/notifications/me/team-preferences"));

    expect(res.status).toBe(200);
    expect(getMyNotificationSettings).toHaveBeenCalledWith("t1", "u1");
  });
});

describe("PATCH /api/notifications/me/team-preferences", () => {
  beforeEach(() => vi.clearAllMocks());

  it("atualiza as próprias preferências", async () => {
    getSessionContext.mockResolvedValue(makeSession());
    updateMyNotificationSettings.mockResolvedValue(undefined);

    const res = await PATCH(
      new Request("http://x/api/notifications/me/team-preferences", {
        method: "PATCH",
        body: JSON.stringify({ notificationDeliveryMode: "digest", quietHoursStart: 22, quietHoursEnd: 7 }),
      }),
    );

    expect(res.status).toBe(200);
    expect(updateMyNotificationSettings).toHaveBeenCalledWith("t1", "u1", {
      notificationDeliveryMode: "digest", quietHoursStart: 22, quietHoursEnd: 7,
    });
  });

  it("422 com quietHoursStart fora de 0-23", async () => {
    getSessionContext.mockResolvedValue(makeSession());
    const res = await PATCH(
      new Request("http://x/api/notifications/me/team-preferences", {
        method: "PATCH",
        body: JSON.stringify({ quietHoursStart: 25 }),
      }),
    );
    expect(res.status).toBe(422);
  });
});
```

- [ ] **Step 2: Rodar e confirmar falha**

Run: `npx vitest run src/app/api/notifications/me/team-preferences/route.test.ts`

Expected: FAIL — rota não existe.

- [ ] **Step 3: Implementar a rota**

```typescript
// src/app/api/notifications/me/team-preferences/route.ts
import { z } from "zod";

import { initializeDomainRuntime } from "@/app/api/_lib/runtime";
import { getSessionContext } from "@/shared/auth/session";
import { handleApiError } from "@/shared/http/handle-api-error";
import { validateInput } from "@/shared/http/validate-input";
import { userNotificationService } from "@/domains/notifications/user-notifications/user-notification.service";

const patchSchema = z.object({
  notificationDeliveryMode: z.enum(["realtime", "digest"]).optional(),
  quietHoursStart: z.number().int().min(0).max(23).nullable().optional(),
  quietHoursEnd: z.number().int().min(0).max(23).nullable().optional(),
  emailOverrides: z
    .array(
      z.object({
        eventType: z.enum([
          "appointment_created", "appointment_cancelled", "appointment_rescheduled",
          "appointment_no_show", "customer_created", "daily_digest",
        ]),
        enabled: z.boolean(),
      }),
    )
    .optional(),
});

export async function GET(request: Request) {
  initializeDomainRuntime();
  try {
    const session = await getSessionContext(request);
    const settings = await userNotificationService.getMyNotificationSettings(session.tenantId, session.userId);
    return Response.json(settings);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: Request) {
  initializeDomainRuntime();
  try {
    const session = await getSessionContext(request);
    const input = await validateInput(request, patchSchema);
    await userNotificationService.updateMyNotificationSettings(session.tenantId, session.userId, input);
    return Response.json(input);
  } catch (error) {
    return handleApiError(error);
  }
}
```

Nota: `birthday_digest` fica de fora do enum de `emailOverrides` porque `supportsEmail: false` no catálogo (Task 1) — não tem sentido salvar override de e-mail pra um evento que nunca sai por e-mail.

- [ ] **Step 4: Rodar e confirmar sucesso**

Run: `npx vitest run src/app/api/notifications/me/team-preferences/route.test.ts`

Expected: PASS (3 testes).

- [ ] **Step 5: Verificar tipos e commit**

Run: `npx tsc --noEmit`

```bash
git add src/app/api/notifications/me/team-preferences/route.ts src/app/api/notifications/me/team-preferences/route.test.ts
git commit -m "feat(notifications): rota de API das minhas preferencias de notificacao"
```

---

### Task 10: Hook TanStack Query — Avisos do negócio

**Files:**
- Create: `src/hooks/settings/use-team-notification-settings.ts`

**Interfaces:**
- Consumes: `GET`/`PATCH /api/notifications/team-settings` (Task 7), `GET`/`PUT /api/notifications/team-settings/templates` (Task 8).
- Produces: `useTeamNotificationSettings()`, `useUpdateTeamNotificationSetting()`, `useNotificationTemplate(eventType, channel)`, `useUpdateNotificationTemplate()`.

- [ ] **Step 1: Criar o arquivo** (sem teste dedicado — hooks TanStack Query puros seguem o mesmo padrão não-testado de `use-scheduling-policy.ts`/`use-automations.ts`, exercitados indiretamente pelos componentes que os usam):

```typescript
// src/hooks/settings/use-team-notification-settings.ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { NotificationEventType, TeamNotificationChannel } from "@prisma/client";

export type BusinessEventSetting = {
  eventType: NotificationEventType;
  label: string;
  description: string;
  supportsEmail: boolean;
  enabled: boolean;
  defaultChannels: TeamNotificationChannel[];
};

export type UpdateBusinessEventInput = {
  eventType: NotificationEventType;
  enabled: boolean;
  defaultChannels: TeamNotificationChannel[];
};

export type NotificationTemplateDTO = { subject: string | null; body: string; isSystemDefault: boolean } | null;

export type UpdateNotificationTemplateInput = {
  eventType: NotificationEventType;
  channel: TeamNotificationChannel;
  subject: string | null;
  body: string;
};

async function fetchTeamNotificationSettings(): Promise<BusinessEventSetting[]> {
  const res = await fetch("/api/notifications/team-settings");
  if (!res.ok) throw new Error("Falha ao carregar avisos do negócio");
  const json = await res.json();
  return json.settings;
}

async function updateTeamNotificationSetting(input: UpdateBusinessEventInput): Promise<BusinessEventSetting> {
  const res = await fetch("/api/notifications/team-settings", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error("Falha ao salvar aviso do negócio");
  return res.json();
}

async function fetchNotificationTemplate(
  eventType: NotificationEventType,
  channel: TeamNotificationChannel,
): Promise<NotificationTemplateDTO> {
  const res = await fetch(`/api/notifications/team-settings/templates?eventType=${eventType}&channel=${channel}`);
  if (!res.ok) throw new Error("Falha ao carregar template");
  return res.json();
}

async function updateNotificationTemplate(input: UpdateNotificationTemplateInput): Promise<NotificationTemplateDTO> {
  const res = await fetch("/api/notifications/team-settings/templates", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error("Falha ao salvar template");
  return res.json();
}

export function useTeamNotificationSettings() {
  return useQuery({ queryKey: ["team-notification-settings"], queryFn: fetchTeamNotificationSettings, staleTime: 60_000 });
}

export function useUpdateTeamNotificationSetting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: updateTeamNotificationSetting,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["team-notification-settings"] }),
  });
}

export function useNotificationTemplate(eventType: NotificationEventType, channel: TeamNotificationChannel, enabled: boolean) {
  return useQuery({
    queryKey: ["notification-template", eventType, channel],
    queryFn: () => fetchNotificationTemplate(eventType, channel),
    enabled,
  });
}

export function useUpdateNotificationTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: updateNotificationTemplate,
    onSuccess: (_data, variables) =>
      qc.invalidateQueries({ queryKey: ["notification-template", variables.eventType, variables.channel] }),
  });
}
```

- [ ] **Step 2: Verificar tipos e commit**

Run: `npx tsc --noEmit`

```bash
git add src/hooks/settings/use-team-notification-settings.ts
git commit -m "feat(notifications): hooks TanStack Query dos avisos do negocio e templates"
```

---

### Task 11: Hook TanStack Query — Minhas preferências

**Files:**
- Create: `src/hooks/settings/use-team-notification-preferences.ts`

**Interfaces:**
- Consumes: `GET`/`PATCH /api/notifications/me/team-preferences` (Task 9).
- Produces: `useMyTeamNotificationPreferences()`, `useUpdateMyTeamNotificationPreferences()`.

- [ ] **Step 1: Criar o arquivo**

```typescript
// src/hooks/settings/use-team-notification-preferences.ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { NotificationEventType } from "@prisma/client";

export type MyTeamNotificationPreferences = {
  notificationDeliveryMode: string;
  quietHoursStart: number | null;
  quietHoursEnd: number | null;
  emailOverrides: { eventType: NotificationEventType; enabled: boolean }[];
};

export type UpdateMyTeamNotificationPreferencesInput = Partial<{
  notificationDeliveryMode: string;
  quietHoursStart: number | null;
  quietHoursEnd: number | null;
  emailOverrides: { eventType: NotificationEventType; enabled: boolean }[];
}>;

async function fetchMyTeamNotificationPreferences(): Promise<MyTeamNotificationPreferences> {
  const res = await fetch("/api/notifications/me/team-preferences");
  if (!res.ok) throw new Error("Falha ao carregar minhas preferências");
  return res.json();
}

async function updateMyTeamNotificationPreferences(
  input: UpdateMyTeamNotificationPreferencesInput,
): Promise<void> {
  const res = await fetch("/api/notifications/me/team-preferences", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error("Falha ao salvar minhas preferências");
}

export function useMyTeamNotificationPreferences() {
  return useQuery({
    queryKey: ["my-team-notification-preferences"],
    queryFn: fetchMyTeamNotificationPreferences,
    staleTime: 60_000,
  });
}

export function useUpdateMyTeamNotificationPreferences() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: updateMyTeamNotificationPreferences,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-team-notification-preferences"] }),
  });
}
```

- [ ] **Step 2: Verificar tipos e commit**

Run: `npx tsc --noEmit`

```bash
git add src/hooks/settings/use-team-notification-preferences.ts
git commit -m "feat(notifications): hook TanStack Query das minhas preferencias"
```

---

### Task 12: Componente — Avisos do negócio (sub-aba)

**Files:**
- Create: `src/components/domain/settings/team-notification-business-settings.tsx`

**Interfaces:**
- Consumes: `useTeamNotificationSettings`/`useUpdateTeamNotificationSetting` (Task 10), `BusinessEventSetting` type.
- Produces: `<TeamNotificationBusinessSettings onEditTemplate={(eventType, channel) => void} />`.

- [ ] **Step 1: Criar o componente**

```tsx
// src/components/domain/settings/team-notification-business-settings.tsx
"use client";

import { toast } from "sonner";
import type { NotificationEventType, TeamNotificationChannel } from "@prisma/client";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  useTeamNotificationSettings,
  useUpdateTeamNotificationSetting,
  type BusinessEventSetting,
} from "@/hooks/settings/use-team-notification-settings";

export function TeamNotificationBusinessSettings({
  onEditTemplate,
}: {
  onEditTemplate: (eventType: NotificationEventType, channel: TeamNotificationChannel) => void;
}) {
  const { data: settings, isLoading } = useTeamNotificationSettings();
  const update = useUpdateTeamNotificationSetting();

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-20 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
    );
  }

  if (!settings || settings.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhum aviso configurável no momento.</p>;
  }

  function toggleEnabled(item: BusinessEventSetting, enabled: boolean) {
    update.mutate(
      { eventType: item.eventType, enabled, defaultChannels: item.defaultChannels },
      { onSuccess: () => toast.success("Aviso atualizado"), onError: () => toast.error("Erro ao salvar") },
    );
  }

  function toggleChannel(item: BusinessEventSetting, channel: TeamNotificationChannel, checked: boolean) {
    const next = checked
      ? [...item.defaultChannels, channel]
      : item.defaultChannels.filter((c) => c !== channel);
    update.mutate(
      { eventType: item.eventType, enabled: item.enabled, defaultChannels: next },
      { onSuccess: () => toast.success("Canais atualizados"), onError: () => toast.error("Erro ao salvar") },
    );
  }

  return (
    <div className="space-y-3">
      {settings.map((item) => (
        <div
          key={item.eventType}
          className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">{item.label}</p>
              <p className="text-xs text-muted-foreground">{item.description}</p>
            </div>
            <Switch
              className="shrink-0"
              checked={item.enabled}
              onCheckedChange={(v) => toggleEnabled(item, v)}
              aria-label={`Ativar ${item.label}`}
            />
          </div>

          {item.enabled && (
            <div className="flex flex-wrap items-center gap-4 border-t border-border pt-3">
              <span className="flex min-h-11 items-center gap-2 text-sm text-muted-foreground">
                🔔 In-app <span className="text-xs">(sempre)</span>
              </span>
              {item.supportsEmail && (
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <Checkbox
                    checked={item.defaultChannels.includes("EMAIL")}
                    onCheckedChange={(v) => toggleChannel(item, "EMAIL", v === true)}
                  />
                  ✉️ E-mail
                </label>
              )}
              <Button
                variant="outline"
                size="sm"
                className="ml-auto min-h-11"
                onClick={() => onEditTemplate(item.eventType, item.defaultChannels.includes("EMAIL") ? "EMAIL" : "IN_APP")}
              >
                Editar mensagem
              </Button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add src/components/domain/settings/team-notification-business-settings.tsx
git commit -m "feat(notifications): componente de avisos do negocio (matriz de canais)"
```

---

### Task 13: Componente — Editor de template (Dialog)

**Files:**
- Create: `src/components/domain/settings/team-notification-template-editor.tsx`

**Interfaces:**
- Consumes: `useNotificationTemplate`/`useUpdateNotificationTemplate` (Task 10), `TEAM_NOTIFICATION_CATALOG_MAP` (Task 1, importado só para ler `variables` — client component pode importar esse arquivo porque é dado estático puro, sem nenhum import de `@/shared/database/prisma` ou código server-only), `interpolateTemplate` (já existe em `notification-template-engine.ts`, também puro/sem I/O — seguro pro cliente).
- Produces: `<TeamNotificationTemplateEditor open eventType channel onOpenChange />`.

- [ ] **Step 1: Criar o componente**

```tsx
// src/components/domain/settings/team-notification-template-editor.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { NotificationEventType, TeamNotificationChannel } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  useNotificationTemplate,
  useUpdateNotificationTemplate,
} from "@/hooks/settings/use-team-notification-settings";
import { TEAM_NOTIFICATION_CATALOG_MAP } from "@/domains/notifications/user-notifications/team-notification-catalog";
import { interpolateTemplate } from "@/domains/notifications/user-notifications/notification-template-engine";

const PREVIEW_DATA: Record<string, string> = {
  cliente: "Maria Silva",
  servico: "Corte",
  profissional: "Ana",
  data: "20/07",
  hora: "14:00",
  negocio: "Seu Salão",
  valor: "3",
  link_acao: "https://app.agend.me/agenda",
};

export function TeamNotificationTemplateEditor({
  open,
  eventType,
  channel,
  onOpenChange,
}: {
  open: boolean;
  eventType: NotificationEventType | null;
  channel: TeamNotificationChannel;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: template, isLoading } = useNotificationTemplate(eventType ?? "appointment_created", channel, open && eventType !== null);
  const update = useUpdateNotificationTemplate();

  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (template) {
      setSubject(template.subject ?? "");
      setBody(template.body);
    }
  }, [template]);

  if (!eventType) return null;
  const catalogEntry = TEAM_NOTIFICATION_CATALOG_MAP[eventType];

  function insertVariable(name: string) {
    const textarea = bodyRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const next = `${body.slice(0, start)}{{${name}}}${body.slice(end)}`;
    setBody(next);
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(start + name.length + 4, start + name.length + 4);
    });
  }

  function handleSave() {
    update.mutate(
      { eventType, channel, subject: channel === "EMAIL" ? subject : null, body },
      { onSuccess: () => { toast.success("Mensagem salva"); onOpenChange(false); }, onError: () => toast.error("Erro ao salvar") },
    );
  }

  const preview = interpolateTemplate(body, PREVIEW_DATA, false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar mensagem — {catalogEntry?.label}</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="h-40 animate-pulse rounded-xl bg-muted" />
        ) : (
          <div className="space-y-4">
            {channel === "EMAIL" && (
              <div className="space-y-1.5">
                <Label htmlFor="tpl-subject">Assunto do e-mail</Label>
                <Input id="tpl-subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="tpl-body">Mensagem</Label>
              <Textarea
                id="tpl-body"
                ref={bodyRef}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={5}
                className="resize-none"
              />
            </div>

            <div className="flex flex-wrap gap-1.5">
              {catalogEntry?.variables.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => insertVariable(v)}
                  className="min-h-8 rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground hover:bg-muted/70"
                >
                  {`{{${v}}}`}
                </button>
              ))}
            </div>

            <div className="rounded-xl bg-muted/50 p-3">
              <p className="mb-1 text-xs font-medium text-muted-foreground">Prévia</p>
              <p className="text-sm text-foreground">{preview}</p>
            </div>

            <Button onClick={handleSave} disabled={update.isPending || body.length === 0} className="w-full">
              {update.isPending ? "Salvando..." : "Salvar mensagem"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add src/components/domain/settings/team-notification-template-editor.tsx
git commit -m "feat(notifications): editor de template com chips de variavel e previa"
```

---

### Task 14: Componente — Minhas preferências (sub-aba)

**Files:**
- Create: `src/components/domain/settings/team-notification-my-preferences.tsx`

**Interfaces:**
- Consumes: `useMyTeamNotificationPreferences`/`useUpdateMyTeamNotificationPreferences` (Task 11), `useTeamNotificationSettings` (Task 10, para saber quais eventos o negócio já ativou).
- Produces: `<TeamNotificationMyPreferences />`.

- [ ] **Step 1: Criar o componente**

```tsx
// src/components/domain/settings/team-notification-my-preferences.tsx
"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { NotificationEventType } from "@prisma/client";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  useMyTeamNotificationPreferences,
  useUpdateMyTeamNotificationPreferences,
} from "@/hooks/settings/use-team-notification-preferences";
import { useTeamNotificationSettings } from "@/hooks/settings/use-team-notification-settings";

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));

export function TeamNotificationMyPreferences() {
  const { data: prefs, isLoading: prefsLoading } = useMyTeamNotificationPreferences();
  const { data: businessSettings, isLoading: settingsLoading } = useTeamNotificationSettings();
  const update = useUpdateMyTeamNotificationPreferences();

  const [deliveryMode, setDeliveryMode] = useState("realtime");
  const [quietStart, setQuietStart] = useState<string>("");
  const [quietEnd, setQuietEnd] = useState<string>("");

  useEffect(() => {
    if (prefs) {
      setDeliveryMode(prefs.notificationDeliveryMode);
      setQuietStart(prefs.quietHoursStart !== null ? String(prefs.quietHoursStart).padStart(2, "0") : "");
      setQuietEnd(prefs.quietHoursEnd !== null ? String(prefs.quietHoursEnd).padStart(2, "0") : "");
    }
  }, [prefs]);

  if (prefsLoading || settingsLoading) {
    return (
      <div className="space-y-3">
        {[0, 1].map((i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-muted" />)}
      </div>
    );
  }

  const enabledEvents = (businessSettings ?? []).filter((s) => s.enabled && s.supportsEmail);
  const overrideMap = new Map((prefs?.emailOverrides ?? []).map((o) => [o.eventType, o.enabled]));

  function saveDeliveryMode(mode: string) {
    setDeliveryMode(mode);
    update.mutate(
      { notificationDeliveryMode: mode },
      { onSuccess: () => toast.success("Modo atualizado"), onError: () => toast.error("Erro ao salvar") },
    );
  }

  function saveQuietHours(startStr: string, endStr: string) {
    const start = startStr === "" ? null : parseInt(startStr, 10);
    const end = endStr === "" ? null : parseInt(endStr, 10);
    update.mutate(
      { quietHoursStart: start, quietHoursEnd: end },
      { onSuccess: () => toast.success("Silêncio atualizado"), onError: () => toast.error("Erro ao salvar") },
    );
  }

  function toggleEventEmail(eventType: NotificationEventType, enabled: boolean) {
    update.mutate(
      { emailOverrides: [{ eventType, enabled }] },
      { onSuccess: () => toast.success("Preferência atualizada"), onError: () => toast.error("Erro ao salvar") },
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-border bg-card p-4">
        <p className="mb-3 text-sm font-medium text-foreground">Modo de entrega por e-mail</p>
        <div className="flex gap-2">
          {(["realtime", "digest"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => saveDeliveryMode(mode)}
              className={cn(
                "min-h-11 flex-1 rounded-lg border px-3 text-sm font-medium transition-colors",
                deliveryMode === mode
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground",
              )}
            >
              {mode === "realtime" ? "Tempo real" : "Resumo diário"}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <p className="mb-3 text-sm font-medium text-foreground">Silêncio (sem e-mail neste horário)</p>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Label htmlFor="quiet-start" className="text-xs text-muted-foreground">De</Label>
            <select
              id="quiet-start"
              value={quietStart}
              onChange={(e) => saveQuietHours(e.target.value, quietEnd)}
              className="min-h-11 rounded-md border border-border bg-background px-2 text-sm"
            >
              <option value="">—</option>
              {HOURS.map((h) => <option key={h} value={h}>{h}:00</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="quiet-end" className="text-xs text-muted-foreground">até</Label>
            <select
              id="quiet-end"
              value={quietEnd}
              onChange={(e) => saveQuietHours(quietStart, e.target.value)}
              className="min-h-11 rounded-md border border-border bg-background px-2 text-sm"
            >
              <option value="">—</option>
              {HOURS.map((h) => <option key={h} value={h}>{h}:00</option>)}
            </select>
          </div>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          O sino continua funcionando normalmente — o silêncio afeta só o e-mail.
        </p>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium text-foreground">Meus avisos</p>
        {enabledEvents.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum aviso com e-mail habilitado pelo negócio no momento.</p>
        ) : (
          enabledEvents.map((event) => (
            <div key={event.eventType} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-4">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">{event.label}</p>
                <p className="text-xs text-muted-foreground">🔔 in-app sempre ativo · ✉️ e-mail abaixo</p>
              </div>
              <Switch
                checked={overrideMap.get(event.eventType) ?? true}
                onCheckedChange={(v) => toggleEventEmail(event.eventType, v)}
                aria-label={`E-mail de ${event.label}`}
              />
            </div>
          ))
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add src/components/domain/settings/team-notification-my-preferences.tsx
git commit -m "feat(notifications): componente de minhas preferencias (modo, silencio, por evento)"
```

---

### Task 15: Página `Configurações › Notificações`

**Files:**
- Create: `src/app/(app)/configuracoes/notificacoes/page.tsx`

**Interfaces:**
- Consumes: `usePermissions` (já existe), `TeamNotificationBusinessSettings` (Task 12), `TeamNotificationTemplateEditor` (Task 13), `TeamNotificationMyPreferences` (Task 14).

- [ ] **Step 1: Criar a página**

```tsx
// src/app/(app)/configuracoes/notificacoes/page.tsx
"use client";

import { useState } from "react";
import type { NotificationEventType, TeamNotificationChannel } from "@prisma/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePermissions } from "@/hooks/use-permissions";
import { TeamNotificationBusinessSettings } from "@/components/domain/settings/team-notification-business-settings";
import { TeamNotificationTemplateEditor } from "@/components/domain/settings/team-notification-template-editor";
import { TeamNotificationMyPreferences } from "@/components/domain/settings/team-notification-my-preferences";

export default function NotificacoesConfigPage() {
  const { can, isLoading } = usePermissions();
  const [editing, setEditing] = useState<{ eventType: NotificationEventType; channel: TeamNotificationChannel } | null>(null);

  const canManageBusiness = can("configuracoes", "edit");

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-rose-200 border-t-rose-600" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Notificações</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure os avisos da sua equipe e ajuste como você quer ser avisado.
        </p>
      </div>

      <Tabs defaultValue={canManageBusiness ? "negocio" : "pessoal"}>
        <TabsList className="grid w-full grid-cols-2">
          {canManageBusiness && (
            <TabsTrigger value="negocio" className="min-h-11">Avisos do negócio</TabsTrigger>
          )}
          <TabsTrigger value="pessoal" className={canManageBusiness ? "min-h-11" : "min-h-11 col-span-2"}>
            Minhas preferências
          </TabsTrigger>
        </TabsList>

        {canManageBusiness && (
          <TabsContent value="negocio" className="mt-4">
            <TeamNotificationBusinessSettings
              onEditTemplate={(eventType, channel) => setEditing({ eventType, channel })}
            />
          </TabsContent>
        )}

        <TabsContent value="pessoal" className="mt-4">
          <TeamNotificationMyPreferences />
        </TabsContent>
      </Tabs>

      <TeamNotificationTemplateEditor
        open={editing !== null}
        eventType={editing?.eventType ?? null}
        channel={editing?.channel ?? "IN_APP"}
        onOpenChange={(open) => { if (!open) setEditing(null); }}
      />
    </div>
  );
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`

- [ ] **Step 3: Checklist mobile-first manual** (não é passo de código — confirme visualmente ou por inspeção do JSX antes de prosseguir):
  - Touch targets: `Switch`/`Checkbox`/botões usam `min-h-11` (44px) — confirmado nos componentes das Tasks 12-14.
  - `TabsList` com `grid-cols-2 w-full` — sem overflow horizontal em 375px.
  - `DialogContent` do editor tem `max-h-[85vh] overflow-y-auto` (Task 13) — não deixa o teclado virtual cobrir o botão de salvar em telas pequenas.
  - Nenhum hover-only: todas as interações (switches, checkboxes, chips) são por clique/toque.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(app)/configuracoes/notificacoes/page.tsx"
git commit -m "feat(notifications): pagina Configuracoes > Notificacoes"
```

---

### Task 16: Ligar o link da nova página (Configurações + sino) e remover o painel antigo de 3 switches

**Files:**
- Modify: `src/app/(app)/configuracoes/page.tsx`
- Modify: `src/components/domain/notifications/notification-panel.tsx`
- Delete: `src/components/domain/notifications/notification-preferences.tsx`

**Interfaces:** nenhuma nova — só rewiring de navegação.

- [ ] **Step 1: Adicionar o card de link em `configuracoes/page.tsx`**

Seguir exatamente o padrão já usado no card "Ficha de anamnese" (mesmo arquivo, grupo "Financeiro e acesso") — adicionar um novo `SettingsCard` no grupo "Divulgue e automatize" (junto aos demais cards de comunicação), com o import de `Bell` do `lucide-react` adicionado à lista de ícones já importados no topo do arquivo:

```tsx
        <SettingsCard
          icon={Bell}
          title="Notificações da equipe"
          subtitle="Configure os avisos internos e ajuste suas próprias preferências"
        >
          <p className="mb-4 text-sm text-muted-foreground">
            Novo agendamento, cancelamento, resumo do dia e mais — escolha o que avisa e por quais canais.
          </p>
          <Button asChild variant="outline" size="sm">
            <Link href="/configuracoes/notificacoes" className="flex items-center gap-1.5">
              <ExternalLink className="size-3.5" />
              Configurar Notificações
            </Link>
          </Button>
        </SettingsCard>
```

(`ExternalLink`, `Link`, `Button` já são importados no arquivo, conforme visto no card "Ficha de anamnese" — só falta adicionar `Bell` ao import de ícones.)

- [ ] **Step 2: Rewiring do sino** (`notification-panel.tsx`)

Substituir o botão de engrenagem (linhas 74-84 do arquivo atual) por um link, e remover o estado/lógica de `showPrefs` que não é mais necessária:

```tsx
import Link from "next/link";
// ... (demais imports existentes, remover o de NotificationPreferences)

export function NotificationPanel({
  open,
  onOpenChange,
  feed,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  feed: ReturnType<typeof useUserNotifications>;
}) {
  const [filter, setFilter] = useState<TypeFilter>("todas");
  // showPrefs removido — a engrenagem agora linka para /configuracoes/notificacoes

  const filtered = filterByType(feed.items, filter);
  const groups = groupByDate(filtered, new Date());

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        showCloseButton={false}
        className="flex w-full flex-col gap-0 p-0 sm:max-w-md"
      >
        <SheetHeader className="flex-row items-center justify-between space-y-0 border-b px-4 py-3">
          <SheetTitle>Notificações</SheetTitle>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="size-10" asChild aria-label="Preferências de notificação">
              <Link href="/configuracoes/notificacoes" onClick={() => onOpenChange(false)}>
                <Settings className="size-4" />
              </Link>
            </Button>
            <SheetClose asChild>
              <Button variant="ghost" size="icon" className="size-10" aria-label="Fechar">
                <X className="size-4" />
              </Button>
            </SheetClose>
          </div>
        </SheetHeader>

        <div className="flex flex-wrap gap-1.5 border-b px-4 py-2">
          {CHIPS.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => setFilter(c.key)}
              className={cn(
                "min-h-8 rounded-full px-3 py-1 text-xs font-medium transition-colors",
                filter === c.key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
              )}
            >
              {c.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2">
          <select
            value={feed.period}
            onChange={(e) => feed.setPeriod(e.target.value as "7" | "30" | "all")}
            className="rounded-md border bg-background px-2 py-1.5 text-xs"
            aria-label="Período"
          >
            <option value="7">7 dias</option>
            <option value="30">30 dias</option>
            <option value="all">Tudo</option>
          </select>
          <button
            type="button"
            onClick={feed.markAllRead}
            className="flex min-h-8 items-center gap-1 text-xs font-medium text-primary"
          >
            <Check className="size-3" /> Marcar todas como lidas
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overflow-x-hidden px-2 py-2">
          {feed.isLoading ? (
            <div className="space-y-2 px-3 py-2" aria-label="Carregando notificações">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-14 w-full animate-pulse rounded-lg bg-muted/60" />
              ))}
            </div>
          ) : feed.isError ? (
            <div className="flex flex-col items-center gap-2 px-3 py-8 text-center">
              <p className="text-sm text-destructive">Não foi possível carregar suas notificações.</p>
              <Button variant="outline" size="sm" onClick={() => feed.refetch()}>
                Tentar novamente
              </Button>
            </div>
          ) : groups.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">
              Nenhuma notificação por aqui ainda.
            </p>
          ) : (
            groups.map((g) => (
              <div key={g.label} className="mb-3">
                <p className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {g.label}
                </p>
                {g.items.map((n) => (
                  <NotificationItem key={n.id} notification={n} onRead={feed.markRead} />
                ))}
              </div>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
```

Note que o botão de voltar (`ArrowLeft`) e o título condicional que existiam para alternar entre feed/prefs também saem, já que não há mais uma 2ª "tela" dentro do sheet.

- [ ] **Step 3: Deletar o componente antigo**

```bash
git rm src/components/domain/notifications/notification-preferences.tsx
```

Se existir um arquivo de teste dedicado a ele (`notification-preferences.test.tsx`), removê-lo junto. Confirme com `find src/components/domain/notifications -iname "notification-preferences*"` antes de rodar o `git rm`.

- [ ] **Step 4: Rodar a suíte e verificar tipos**

Run: `npx tsc --noEmit && npx vitest run`

Expected: sem erros novos. Se algum teste existente de `notification-panel` referenciar `showPrefs`/`NotificationPreferences`, atualize esse teste para refletir o novo comportamento (link em vez de tela interna) — confira `find src/components/domain/notifications -iname "notification-panel*.test*"` antes de assumir que não existe.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(app)/configuracoes/page.tsx" src/components/domain/notifications/notification-panel.tsx
git commit -m "feat(notifications): liga sino e Configuracoes a nova pagina, remove painel de 3 switches"
```

---

### Task 17: Verificação final e ADR

**Files:**
- Modify: `docs/decisions.md`

- [ ] **Step 1: Suíte completa**

Run: `npx tsc --noEmit && npx vitest run`

Expected: 0 erros de tipo; todos os testes passando (novos desta plan + os já existentes, sem regressão).

- [ ] **Step 2: Registrar a conclusão no ADR-015**

Localizar a entrada do ADR-015 em `docs/decisions.md` e adicionar ao final:

```markdown
> **Atualização 2026-07-XX:** aba `Configurações › Notificações` entregue —
> sub-abas "Avisos do negócio" (matriz de eventos × canais + editor de
> mensagem com chips `{{variavel}}` e prévia) e "Minhas preferências" (modo
> tempo-real/digest, quiet hours, e-mail por evento). Painel de 3 switches
> (`notification-preferences.tsx`) removido — sino e Configurações linkam
> pra cá. Resumo do dia corrigido para rodar às 08:00 no fuso do tenant (era
> fixo em UTC). Seed de defaults por cargo ao convidar membro **não** foi
> incluído nesta entrega (fora de escopo, ver plano
> `docs/superpowers/plans/2026-07-13-central-notificacoes-equipe-ui.md`).
```

(Substituir `2026-07-XX` pela data real de conclusão.)

- [ ] **Step 3: Commit**

```bash
git add docs/decisions.md
git commit -m "docs: atualiza ADR-015 com a entrega da aba Configuracoes > Notificacoes"
```

---

## Fora de escopo deste plano

- **Seed de defaults por cargo** ao convidar/criar membro (dono recebe mais eventos ligados que profissional) — exigiria alterar o fluxo de convite em `src/domains/iam/`, não explorado nesta sessão. Colaborador novo herda os defaults do negócio até ajustar manualmente.
- **Hora configurável do resumo diário** — fixo em 08:00 local do tenant nesta entrega (Task 6 corrige o fuso, não adiciona campo de hora customizável).
- **Digest de pendências por e-mail**, **`customer_inactive`** — Fase 1-b do spec original.
- **`agenda_idle`, `monthly_goal`, snooze/"resolver"** — Fase 2 do spec original.
- **Worklist de pendências na UI** (`findPendingWorklist`, já existe e testado no repository desde o plano anterior) — ainda sem rota/UI; nenhum dos 2 eventos (`appointment_pending_confirmation`/`payment_pending`) aparece no catálogo desta tela.
- **Remoção definitiva dos 3 booleans legados** do `User` — continuam existindo (dual-write), removê-los é item de fase futura.
