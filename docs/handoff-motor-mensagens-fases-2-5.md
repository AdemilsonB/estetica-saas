# Motor de mensagens ao cliente — handoff das Fases 2 a 5

**Última atualização:** 2026-07-27
**Fase 1:** ✅ entregue, mergeada e aplicada em produção
**Fase 2:** ✅ entregue (branch `feat/motor-mensagens-cliente-fase-2`) — migration `20260727120000_add_customer_message_setting` **pendente de aplicação manual** em produção
**Próxima:** Fase 3

---

## Leia antes de qualquer coisa

| Documento | Para quê |
|---|---|
| `docs/superpowers/specs/2026-07-26-motor-mensagens-cliente-design.md` | **A spec das 5 fases.** Aprovada pelo usuário, não precisa ser rediscutida |
| `docs/decisions.md` → ADR-017 | Por que o desenho é assim, e o que foi rejeitado |
| `docs/superpowers/plans/2026-07-26-motor-mensagens-cliente-fase-1.md` | Modelo de plano que funcionou — use como referência de formato |
| `src/domains/notifications/DOMAIN.md` | Arquitetura do domínio |

---

## O que a Fase 1 entregou

PRs #300, #301, #302, #303. Migration e backfill já aplicados em produção.

**A ideia central: duas camadas.** Um catálogo em código é a fonte única das mensagens
**padrão do sistema**; o banco guarda **apenas** as personalizações do tenant. Ausência de
registro significa "usa o padrão", **nunca** "sem mensagem" — e tenant novo não recebe cópia
dos defaults, o que permite melhorar os textos depois sem migration.

**Arquivos que você vai consumir nas próximas fases:**

```
src/domains/notifications/customer-messages/
├── customer-message-catalog.ts       # 10 eventos × 2 canais: texto padrão, variáveis,
│                                     # natureza (transactional/promotional), LEGACY_TEMPLATE_TO_EVENT
├── customer-message-variables.ts     # buildCustomerMessageVariables() — formata no fuso do tenant
├── customer-message.service.ts       # resolveTemplate() e render()
├── customer-message-template.repository.ts
├── legacy-template-backfill.ts       # conversor do formato antigo (histórico)
├── schemas.ts                        # Zod da API
└── types.ts                          # CustomerMessageEventKey, RenderedCustomerMessage…
```

**API pronta:** `GET|PUT /api/notifications/customer-templates` e
`DELETE /api/notifications/customer-templates/[event]/[channel]` (restaurar padrão).

**UI pronta:** Configurações › Notificações › aba "Mensagens ao cliente"
(`customer-message-list.tsx` e `customer-message-editor.tsx`), mobile e desktop.

**Providers ficaram burros:** nenhum texto de mensagem pode existir em
`domains/notifications/providers/` — eles recebem texto renderizado e só transportam.

---

## O que a Fase 2 entregou

Branch `feat/motor-mensagens-cliente-fase-2`, ADR-018. Migration
`20260727120000_add_customer_message_setting` — **manual em produção**, sem backfill (ver
runbook abaixo).

**A ideia central:** texto (Fase 1) e disparo (Fase 2) são duas decisões independentes, cada
uma com sua própria camada de "ausência de registro = padrão". `CustomerMessageSetting`
guarda só o que o tenant mudou (`enabled`/`channels`); sem registro, o catálogo decide — 7
eventos transacionais ligados, os 3 promocionais (`birthday`/`return_due`/`winback`)
desligados por padrão (LGPD), canal sempre `WHATSAPP`.

**Arquivos que você vai consumir nas próximas fases:**

```
src/domains/notifications/customer-messages/
├── customer-message-setting.repository.ts   # CRUD de CustomerMessageSetting, tenantId sempre
├── customer-message-setting.service.ts      # resolve()/resolveAll()/shouldNotify()/save()
├── customer-message-dispatcher.service.ts   # ÚNICO caminho de envio ao cliente — comece aqui
src/hooks/notifications/use-customer-message-preview.ts
src/components/domain/notifications/customer-message-toggle.tsx   # <CustomerMessageToggle>
src/app/api/notifications/customer-messages/preview/route.ts      # prévia + blockedReason
```

**`customerMessageDispatcherService.dispatch()` é o ponto de entrada para qualquer fase
futura que precise mandar mensagem ao cliente** — campanhas (Fase 3), agendadas (Fase 4) e
automações (Fase 5) devem chamá-lo, não `notificationService.logAndDispatch` direto. Ele já
resolve `shouldNotify` (override ?? padrão do tenant) e os canais ligados.

**Contrato `notify?: boolean`** viaja cru nos payloads de evento de `scheduling` (nunca
interpretado lá — regra de fronteira entre domínios) e só é resolvido em
`customerMessageSettingService.shouldNotify`, chamado pelo dispatcher.

**`Appointment.origin`** (`PANEL`/`PUBLIC`, persistida, default `PANEL`) discrimina
`appointment_requested` (pedido nascido na vitrine) de `appointment_created` (painel); a
confirmação só notifica pedido nascido online por padrão — resolve a mensagem duplicada da
§6.4.

**`<CustomerMessageToggle>`** está plugado nos 5 pontos de ação (criar/cancelar/confirmar/
remarcar/no-show) — reaproveite-o em qualquer tela nova que precise de controle de envio.

**2 bugs corrigidos:** o switch "Enviar confirmação via WhatsApp" nunca funcionou (mandava
`notificationMessage: ''`, falsy, gateway caía no template e enviava mesmo desligado); e o
agendamento online mandava 2 mensagens quase idênticas ao cliente.

**Regressão consciente:** a mensagem de confirmação parou de injetar o valor cobrado
automaticamente — quem quiser de volta usa `{{valor}}` no template.

### Runbook de produção (Fase 2)

1. Merge do PR.
2. `npx prisma migrate deploy` — manual, porta **5432** do Supabase (a 6543 trava em DDL).
3. **Não há backfill** — ausência de registro já significa "padrão do catálogo".
4. `npx prisma migrate status` — confirmar limpo.
5. Verificação funcional: matriz de Mensagens ao cliente carrega os 10 eventos (7 ligados, 3
   desligados); desligar um evento e recarregar confirma que persistiu; agendar pela vitrine
   → "recebemos seu pedido" (não "confirmado"); confirmar esse pedido no painel → "está
   confirmado"; agendar pelo painel e confirmar → nenhuma segunda mensagem; registrar um
   no-show → o diálogo mostra o texto e permite desligar.

---

## O que falta — Fases 3 a 5

### Fase 3 — Campanhas segmentadas (próxima)
Seção 7. Models `Campaign` e `CampaignRecipient`, `Customer.marketingOptOut`, construtor de
segmento, editor com imagem, fila throttled (~150 msg/h com o cron de 10 min), janela de
horário, teste obrigatório antes de disparar, opt-out por "PARE" no webhook, permissão nova
`mensagens`, capability `campaigns` de `soon` → `ga`.

### Fase 4 — Mensagens agendadas
Seção 8. É `Campaign` com `scheduledAt`, interpretado **no fuso do tenant**.

### Fase 5 — Automações
Seção 9. Confirmação por resposta (1/2) via webhook, retorno programado
(`Service.returnIntervalDays`) e reconquista (`Tenant.winbackDays`).

**Fora de escopo por decisão do usuário:** avaliação pós-atendimento por WhatsApp (o funil
da Onda 1 já existe, falta só o gatilho) e vaga liberada / lista de espera.

---

## Armadilhas que já custaram tempo aqui

**Migrations não rodam no build da Vercel.** Toda migration é manual:
`npx prisma migrate deploy`. O `prisma.config.ts` usa `DIRECT_URL ?? DATABASE_URL` — no
Supabase, a porta **5432** (pooler em modo *session*) funciona; a **6543** (modo
*transaction*) trava, porque não suporta DDL nem advisory lock. E `vercel` só existe via
`npx vercel` nesta máquina.

**Nunca acople campo novo à query de sessão (`/me`).** Já causou logout global duas vezes
quando a migration atrasou.

**A cota de WhatsApp é incrementada antes do envio.** Todo caminho de erro depois disso
precisa devolvê-la com `whatsAppQuotaService.decrement`. Um `try/catch` esquecido faz o
tenant perder cota por mensagem que não saiu.

**`logAndDispatch` roda em handler assíncrono do event bus, que engole rejeições.** Erro
que escapa vira silêncio total, sem rastro nem no `NotificationLog`. Converta em `delivery`
FAILED com a causa preservada.

**`AlertDialog` do Radix não aceita `modal={false}`** — a tipagem faz
`Omit<DialogProps, 'modal'>`. Para diálogo aninhado use `Dialog` comum com
`role="alertdialog"`, como em `picker-detail-modal.tsx`. E todo `DialogContent` precisa de
`max-h-[85vh]` + `overflow-y-auto`.

**Não use `touch-pan-x`** em faixa rolável horizontal — trava o scroll vertical no mobile.

**Twilio é código morto** (só Evolution é usada). Não invista nele. Candidato a remoção
completa numa PR curta.

**Switch de UI que "desliga" mandando string vazia é suspeito.** `''` é *falsy* e vira
fallback silencioso em vez de um "não" explícito — foi exatamente o bug do switch de
confirmação na Fase 2 (`notificationMessage: ''`, o gateway caía no template e enviava mesmo
assim). Prefira um campo `boolean` explícito (`notify?: boolean`) para "enviar ou não", nunca
inferir isso do texto estar vazio.

**A spec pode estar desatualizada em detalhes de UI que já mudaram no código.** A §6.3 da
spec original dizia que o no-show "dispara com um toque, sem diálogo" — mas o
`AlertDialog` de confirmação já existia no código quando a Fase 2 foi implementada; faltava
só o toggle dentro dele. Leia o componente real antes de assumir o que a spec descreve.

---

## O que funcionou no processo, e vale repetir

O fluxo foi `brainstorming` → `writing-plans` → `subagent-driven-development`, com revisão
independente por tarefa.

**A revisão por tarefa pagou.** Foram 3 achados Important — e os três nasceram no *plano*,
não no trabalho dos implementadores: uma asserção de tipo que compilava sempre (inclusive
quando os valores divergiam), um `try/catch` ausente que fazia perder cota, e um
`tenantName` sem escape indo para dentro do `<title>` de e-mail. Quem escreve o plano é
justamente quem não enxerga os próprios furos.

**Um scan do plano antes de executar pegou 3 defeitos** sem gastar nenhum subagente: rotas
inexistentes nos links, um teste que quebraria na tarefa seguinte, e um script `.mjs`
importando TypeScript.

**Exija prova empírica, não alegação.** Quando um implementador disse que a asserção de tipo
funcionava, o revisor foi testar com o compilador e descobriu que não. Peça o teste
negativo: quebre de propósito e mostre o erro.
