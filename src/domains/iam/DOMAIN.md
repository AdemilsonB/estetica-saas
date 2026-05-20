# IAM — Identity & Access Management

## Responsabilidade

Autenticação, autorização, gestão de tenants e controle de acesso.

## Entidades

- **Tenant** — empresa/negócio cliente do SaaS
- **User** — usuário dentro de um tenant com role e permissões

## Roles disponíveis

| Role | Descrição |
|---|---|
| OWNER | Dono do negócio — acesso total |
| MANAGER | Gerente — acesso operacional completo |
| PROFESSIONAL | Profissional — acesso à própria agenda |
| RECEPTIONIST | Recepcionista — agenda e clientes |

## Permissões

```typescript
appointments:view | appointments:create | appointments:edit | appointments:delete
customers:view | customers:create | customers:edit
financial:view | financial:manage
users:view | users:invite | users:manage
services:view | services:manage
```

## Fluxo de autenticação

```
Login (email/senha ou magic link)
    ↓ Supabase Auth
JWT com tenantId no metadata
    ↓ withTenant() middleware
Toda API Route valida o token
```

## Status

🔴 Não iniciado
