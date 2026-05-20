# Notifications — Notificações

## Responsabilidade

Envio de notificações via WhatsApp e email. Totalmente desacoplado — só escuta eventos.

## Providers

- **WhatsApp**: Evolution API (principal)
- **Email**: Resend (futuro)

## Eventos escutados

- `scheduling.appointment.created` → envia confirmação via WhatsApp
- `scheduling.appointment.cancelled` → notifica cancelamento
- `scheduling.appointment.reminder` → lembrete 24h antes (via pg-boss job)

## Regras

- Nunca acessa banco diretamente para buscar dados de negócio
- Recebe tudo pelo payload do evento
- Falhas de envio não afetam o domínio principal
- Retry automático via pg-boss

## Status

🔴 Não iniciado
