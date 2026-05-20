# CRM — Customer Relationship Management

## Responsabilidade

Gestão de clientes, histórico de atendimentos e relacionamento.

## Entidades

- **Customer** — cliente do negócio com histórico e perfil

## Regras de negócio

- Cliente é único por telefone dentro do tenant
- Tags para segmentação (VIP, Recorrente, Inativo, etc.)
- Histórico de atendimentos derivado dos agendamentos

## Eventos publicados

- `crm.customer.created`
- `crm.customer.updated`

## Status

🔴 Não iniciado
