# Financial — Financeiro

## Responsabilidade

Registro de transações, fechamento de caixa e visão financeira básica.

## Entidades

- **Transaction** — entrada ou saída financeira, podendo estar vinculada a um agendamento

## Regras de negócio

- Toda transação tem tipo (INCOME / EXPENSE) e categoria
- Agendamentos concluídos geram transação de receita automaticamente
- Fechamento de caixa é soma de transações do período

## Eventos escutados

- `scheduling.appointment.completed` → cria Transaction de INCOME automaticamente

## Eventos publicados

- `financial.transaction.created`

## Status

🔴 Não iniciado
