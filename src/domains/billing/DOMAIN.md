# Billing Domain

Responsável por planos SaaS, assinaturas de tenants, limites de uso e ciclo de vida comercial.

## Responsabilidades

- Definir e gerenciar planos (Free, Starter, Pro, Enterprise)
- Rastrear assinatura ativa por tenant
- Impor limites de uso (usuários, agendamentos/mês, notificações)
- Controlar trial e expiração
- Integrar com gateway de pagamento (Stripe / Asaas / Mercado Pago)

## Limites por plano (referência)

| Recurso             | Free | Starter | Pro    | Enterprise |
|---------------------|------|---------|--------|------------|
| Usuários            | 2    | 5       | 20     | Ilimitado  |
| Agendamentos/mês    | 50   | 300     | 2.000  | Ilimitado  |
| Notificações/mês    | 0    | 200     | 2.000  | Ilimitado  |
| Unidades            | 1    | 1       | 3      | Ilimitado  |

## Eventos publicados

- `billing.subscription.activated`
- `billing.subscription.cancelled`
- `billing.subscription.upgraded`
- `billing.trial.expired`
- `billing.limit.exceeded`

## Integrações previstas

- Stripe (internacional)
- Asaas (Brasil — boleto, PIX, cartão)
- Mercado Pago (Brasil / América Latina)

## Status

🔴 Não iniciado — Fase 2
