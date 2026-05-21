# Automation Domain

Motor de automações orientado a eventos: Trigger → Conditions → Actions.
Completamente desacoplado do core transacional — só escuta eventos e dispara ações.

## Responsabilidades

- Definir regras de automação por tenant
- Escutar eventos de domínio e avaliar condições
- Executar ações configuradas (notificação, tarefa, tag, campanha)
- Registrar histórico de execuções

## Exemplos de automações

| Trigger                        | Condition              | Action                        |
|-------------------------------|------------------------|-------------------------------|
| appointment.created            | —                      | Enviar confirmação WhatsApp   |
| appointment.completed          | cliente.tags = VIP     | Enviar oferta de retorno       |
| customer.inactive              | inativo > 30 dias      | Enviar mensagem de retenção   |
| appointment.no_show            | —                      | Criar tarefa para recepção    |
| financial.transaction.created  | amount > 500           | Notificar gestor              |

## Triggers disponíveis

- `scheduling.appointment.created`
- `scheduling.appointment.completed`
- `scheduling.appointment.cancelled`
- `scheduling.appointment.no_show`
- `crm.customer.created`
- `crm.customer.updated`
- `financial.transaction.created`
- `billing.trial.expired`

## Ações disponíveis

- `send_whatsapp` — envia mensagem via WhatsApp
- `send_email` — envia email
- `add_tag` — adiciona tag ao cliente
- `remove_tag` — remove tag do cliente
- `create_task` — cria tarefa manual para equipe
- `notify_manager` — notifica gestores do tenant

## Arquitetura

- Regras armazenadas no banco por tenant
- Jobs executados via pg-boss (async, com retry)
- Sem acesso direto a domínios — apenas publica eventos de volta

## Status

🔴 Não iniciado — Fase 2
