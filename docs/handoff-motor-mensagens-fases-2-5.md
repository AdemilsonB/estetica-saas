# Motor de mensagens ao cliente — handoff das Fases 2 a 5

**Última atualização:** 2026-07-26
**Fase 1:** ✅ entregue, mergeada e aplicada em produção
**Próxima:** Fase 2

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

## O que falta — Fases 2 a 5

Ordem importa: a 2 é pré-requisito das demais.

### Fase 2 — Controle de disparo (próxima)
Seção 6 da spec.
- `CustomerMessageSetting` (tenantId, event, enabled, channels) — o padrão do negócio
- Matriz evento × canal em Configurações, tudo ligado para tenant novo
- Componente `<CustomerMessageToggle>` reutilizado nos **10 pontos de disparo** (tabela na
  seção 6.3 da spec), com o padrão pré-aplicado e override válido só para aquela ação
- **Modal de confirmação no botão de no-show** — hoje ele dispara "você não compareceu"
  com um toque, sem diálogo e sem desfazer. É o disparo mais delicado pelo caminho menos
  protegido
- Novo evento `appointment_requested`: agendamento pela vitrine vira "recebemos seu pedido",
  e `appointment_confirmed` só dispara quando a origem foi online (seção 6.4)
- Contrato: rotas aceitam `notify?: boolean` opcional; **ausente = usa o padrão do tenant,
  resolvido no service** — a decisão nunca fica só no cliente

### Fase 3 — Campanhas segmentadas
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
