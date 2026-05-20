# Scheduling — Agenda e Agendamentos

## Responsabilidade

Gestão completa da agenda operacional: criação, edição, cancelamento e verificação de disponibilidade de agendamentos.

## Entidades

- **Appointment** — agendamento entre cliente, profissional e serviço
- **Service** — serviço oferecido com duração e preço

## Regras de negócio

- Não pode haver dois agendamentos do mesmo profissional no mesmo horário
- Status segue fluxo: SCHEDULED → CONFIRMED → COMPLETED (ou CANCELLED / NO_SHOW)
- Cancelamento só permitido com antecedência mínima configurável
- `endsAt` é calculado automaticamente: `startsAt + service.duration`

## Eventos publicados

- `scheduling.appointment.created`
- `scheduling.appointment.confirmed`
- `scheduling.appointment.completed`
- `scheduling.appointment.cancelled`
- `scheduling.appointment.no_show`

## Dependências

- Escuta eventos de: nenhum (domínio produtor)
- Notificações escuta seus eventos para enviar WhatsApp

## Status

🔴 Não iniciado
