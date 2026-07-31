# Notifications — Notificações

## Responsabilidade

Envio de mensagens ao **cliente final** (WhatsApp e e-mail) e avisos à **equipe**
(in-app e e-mail). São dois motores irmãos, deliberadamente separados.

## Os dois motores

| | Ao cliente | À equipe |
|---|---|---|
| Pasta | `customer-messages/` | `user-notifications/` |
| Canais | `WHATSAPP`, `EMAIL` | `IN_APP`, `EMAIL` |
| Catálogo | `customer-message-catalog.ts` | `team-notification-catalog.ts` |
| Templates | `CustomerMessageTemplate` | `NotificationTemplate` |

Não foram fundidos porque os canais, as variáveis, as permissões e o ciclo de vida
diferem. O que **é** compartilhado: `interpolateTemplate()`, a função pura que
substitui `{{variavel}}`. Ver ADR-017.

## Motor de mensagens ao cliente — duas camadas

```
evento / job / campanha
   ↓
whatsAppGateway.send(draft)  ou  notificationService.logAndDispatch(draft)
   ↓ traduz o template legado ("appointment-created") para o evento (LEGACY_TEMPLATE_TO_EVENT)
customerMessageService.render(tenantId, evento, canal, contexto)
   ↓ 1. busca CustomerMessageTemplate do tenant
   ↓ 2. se não houver, usa o padrão do catálogo
   ↓ 3. interpola {{variaveis}} (escapa HTML só no canal EMAIL)
   ↓
{ subject, text, mediaUrl }  →  provider (Evolution / Twilio / Resend)
```

**A regra que sustenta o desenho:** ausência de registro no banco significa
"usa o padrão do sistema", **nunca** "sem mensagem". Tenant novo não recebe cópia dos
defaults — é isso que permite melhorarmos os textos padrão depois sem migration,
beneficiando automaticamente quem nunca personalizou. "Restaurar padrão" apaga o registro.

**Providers são burros.** Nenhum texto de mensagem pode existir em `providers/` —
eles recebem texto já renderizado e só transportam.

## Mensagem agendada (um-a-um)

`scheduled-messages/` — o profissional marca uma mensagem para uma cliente numa data e hora.

```
formulário (date + time locais)
   ↓ conversão para UTC com o fuso do TENANT, no service
ScheduledMessage (PENDING)
   ↓ /api/cron/tick, a cada ~10 min
claim atômico PENDING → SENDING   ← a idempotência mora aqui
   ↓ interpola {{variaveis}} com buildCustomerMessageVariables
customerMessageDispatcher.dispatch({ kind: "direct" })
   ↓
SENT (+ notificationLogId) ou FAILED (+ motivo do NotificationLog)
```

Uma tentativa, sem retry. Linha presa em `SENDING` por mais de 15 min vira `FAILED`.
Não é `Campaign` — ver ADR-019. Quando as campanhas chegarem, devem reusar esta máquina.

## Transacional × promocional

Campo `nature` no catálogo. Atravessa todo o desenho das fases seguintes:

| | Transacional | Promocional |
|---|---|---|
| Exemplos | criado, confirmado, remarcado, cancelado, no-show, lembrete | aniversário, retorno, reconquista |
| Respeita opt-out de marketing | **Não** | **Sim** |
| Exige `consentGiven` | Não | **Sim** |

Comunicação sobre um horário que a pessoa marcou é execução de serviço contratado.
Descadastrar-se de marketing nunca pode desligar o lembrete do próprio horário.

## Providers

- **WhatsApp**: Evolution API — **único provedor em uso real**, por tenant.
- **WhatsApp (fallback)**: Twilio — legado, não exercido nesta versão. Envia texto livre
  como `body`, o que só vale dentro da janela de 24 h do WhatsApp Business.
- **E-mail**: Resend, com layout único parametrizado (`customerEmailHtml`).

## Eventos escutados

`scheduling.appointment.created` · `.confirmed` · `.rescheduled` · `.cancelled` · `.no_show`

Jobs pg-boss: lembrete de agendamento, aniversário, resumo diário da equipe.

## Regras

- Nunca acessa banco para buscar dado de negócio — recebe tudo pelo payload do evento.
  A exceção é a leitura do próprio tenant (nome, slug, fuso, telefone, endereço) para
  montar as variáveis.
- Falha de envio nunca derruba o domínio principal: erros voltam como resultado, nunca
  são lançados.
- Toda formatação de data e hora usa o fuso do tenant, nunca o do processo.
- A cota de WhatsApp é incrementada antes do envio; **todo** caminho de erro depois disso
  precisa devolvê-la com `whatsAppQuotaService.decrement`.

## Status

🟢 Fase 1 do motor ao cliente concluída (catálogo, personalização, remoção do hardcode).
Fases 2-5 (toggles por evento, campanhas segmentadas, agendadas, automações) planejadas
em `docs/superpowers/specs/2026-07-26-motor-mensagens-cliente-design.md`.
