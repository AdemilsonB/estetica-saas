# Design: Configurações do Negócio + Notificações WhatsApp

## Objetivo

Implementar a página `/configuracoes` com três abas (Negócio, Serviços, WhatsApp) e integrar notificações via Z-API para confirmação de agendamentos.

## Contexto

- Sidebar já aponta para `/configuracoes` mas a rota não existe (404)
- Backend de serviços tem `list` e `create` mas não `update`/`deactivate`
- `whatsapp.provider.ts` é um stub — subscriptions já existem em `subscriptions.ts`
- Tenant não tem campos `phone`, `address`, `zApiInstanceId`, `zApiToken`, `whatsappEnabled`

## Acesso

OWNER e MANAGER podem ver e editar todas as abas. Outros perfis não veem "Config." na sidebar.

## Schema — mudanças no Tenant

```prisma
model Tenant {
  // campos existentes...
  phone             String?
  address           String?
  zApiInstanceId    String?
  zApiToken         String?
  whatsappEnabled   Boolean @default(false)
}
```

Migration aditiva — sem risco de dados.

## Permissões novas

Adicionar ao mapa de permissões existente:
- `settings:view` — OWNER, MANAGER
- `settings:manage` — OWNER, MANAGER

## Backend — novos endpoints

### Tenant

| Método | Rota | Permissão | Descrição |
|--------|------|-----------|-----------|
| GET | `/api/iam/tenant` | `settings:view` | Retorna dados do tenant autenticado |
| PATCH | `/api/iam/tenant` | `settings:manage` | Atualiza name, phone, address |

### Serviços

| Método | Rota | Permissão | Descrição |
|--------|------|-----------|-----------|
| PATCH | `/api/scheduling/services/[id]` | `services:manage` | Atualiza name, duration, price |
| DELETE | `/api/scheduling/services/[id]` | `services:manage` | Soft delete (active = false) |

### Notificações

| Método | Rota | Permissão | Descrição |
|--------|------|-----------|-----------|
| GET | `/api/notifications/settings` | `settings:view` | Retorna config Z-API do tenant |
| PATCH | `/api/notifications/settings` | `settings:manage` | Salva zApiInstanceId, zApiToken, whatsappEnabled |

## Backend — mudanças em domínios existentes

**`iam.repository.ts`:** adicionar `findTenant(tenantId)` e `updateTenant(tenantId, data)`

**`iam.service.ts`:** adicionar `getTenant` e `updateTenant`

**`service.repository.ts`:** adicionar `update(tenantId, serviceId, data)` e `deactivate(tenantId, serviceId)`

**`scheduling.service.ts`:** adicionar `updateService` e `deactivateService`

**`whatsapp.provider.ts`:** implementar envio real via Z-API:
```
POST https://api.z-api.io/instances/{instanceId}/token/{token}/send-messages
Header: Client-Token: {clientToken}  (variável de ambiente ZAPI_CLIENT_TOKEN)
Body: { phone, message }
```

O tenant precisa ter `whatsappEnabled = true` e `zApiInstanceId` e `zApiToken` preenchidos para o provider enviar. Caso contrário, retorna `PENDING` silenciosamente (sem erro).

## Frontend — estrutura de arquivos

```
src/
  app/(app)/configuracoes/
    page.tsx                         # Tabs: Negócio | Serviços | WhatsApp
  hooks/
    settings/
      use-tenant-settings.ts         # useMyTenant, useUpdateTenant
      use-notification-settings.ts   # useNotificationSettings, useUpdateNotificationSettings
    scheduling/
      use-services.ts                # EXTENDER com useCreateService, useUpdateService, useDeactivateService
  components/domain/settings/
    business-info-form.tsx           # Formulário nome, telefone, endereço
    service-catalog.tsx              # Lista + ações de serviços
    service-form-modal.tsx           # Modal criar/editar serviço
    whatsapp-settings-form.tsx       # Formulário Z-API + toggle
```

## Fluxo da notificação de confirmação

1. Agendamento criado → `scheduling.appointment.created` publicado no eventBus
2. `subscriptions.ts` já escuta esse evento e chama `notificationService.logAndDispatch`
3. `notificationService` chama `whatsAppProvider.send(draft)`
4. Provider busca credenciais do tenant → envia via Z-API → retorna status
5. Log salvo em `NotificationLog`

O provider recebe o `tenantId` no draft e faz `prisma.tenant.findFirst` para obter as credenciais. Se `whatsappEnabled = false` ou credenciais ausentes, retorna `PENDING` sem tentar enviar.

## Mensagem de confirmação (template `appointment-created`)

```
Olá, {customerName}! 👋
Seu agendamento foi confirmado:
📅 {data} às {hora}
✂️ {serviceName}
Até lá!
```

## Validação

- `name`: 2–100 chars, obrigatório
- `phone`: formato livre (Brasil), opcional
- `address`: 0–200 chars, opcional
- `zApiInstanceId`: string, opcional
- `zApiToken`: string, opcional  
- Serviço `name`: 2–100 chars
- Serviço `duration`: 5–480 minutos
- Serviço `price`: positivo

## Sem escopo neste ciclo

- Histórico de notificações enviadas (log list na UI)
- Lembretes automáticos (agendados via pg-boss)
- Horários de funcionamento
- Upload de logo do negócio
