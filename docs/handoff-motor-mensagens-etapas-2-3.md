# Motor de mensagens — handoff das Etapas 2 e 3

**Última atualização:** 2026-08-03
**Etapa 1 (Fundação):** ✅ entregue — PR #325, branch `feat/motor-mensagens-consolidacao-fases-3-5`
**Próxima:** Etapa 2 (Fase 5 — confirmação por resposta + retorno programado)

---

## Leia antes de qualquer coisa

| Documento | Para quê |
|---|---|
| `docs/superpowers/specs/2026-08-02-motor-mensagens-consolidacao-fases-3-5-design.md` | **A spec.** Aprovada, não precisa ser rediscutida |
| `docs/decisions.md` → ADR-020 | Por que o desenho é assim |
| `docs/superpowers/plans/2026-08-02-motor-mensagens-etapa-1-fundacao.md` | Modelo de plano que funcionou |

---

## O que a Etapa 1 entregou, e que você vai consumir

**A migration já tem os campos das Etapas 2 e 3.** Nada de banco novo é necessário:

| Já existe, sem uso | Para quê |
|---|---|
| `Tenant.replyConfirmEnabled` / `replyConfirmInvite` | Confirmação por resposta (Etapa 2) |
| `Service.returnIntervalDays` | Retorno programado (Etapa 2) |
| `Campaign` / `CampaignRecipient` + enums | Campanhas (Etapa 3) |
| Índices de `NotificationLog` | Anti-fadiga e casamento por telefone |

**Arquivos que você vai consumir:**

```
src/domains/notifications/customer-messages/
├── customer-message-consent.ts             # avaliarConsentimento() — decisão pura
├── customer-message-consent.repository.ts  # carregarSnapshot()
├── customer-message-dispatcher.service.ts  # guardião único — comece aqui
src/domains/notifications/opt-out/opt-out-keywords.ts
src/domains/notifications/auto-reply/       # textos do webhook em duas camadas
src/domains/crm/opt-out.service.ts          # marcarPorTelefone()
```

**O webhook já está reordenado** (`src/app/api/webhooks/evolution/messages/route.ts`).
Há um comentário-marcador exatamente onde a confirmação por resposta entra:

```
// ── 2. Confirmação por resposta (1/2) ────────────────────────────────────
// Entra aqui na Etapa 2, entre o opt-out e o chatbot.
```

Ela precisa rodar **fora** do gate de `autoReplyEnabled` e **antes** do throttle, pelo mesmo
motivo do opt-out: cancelar um horário não pode depender de o tenant ter chatbot ligado.

---

## Armadilhas que já custaram tempo neste pacote

**O `.refine` de schema Zod com `??` engole booleanos `false`.** `d.phone ?? d.email` faz um
`aceitaPromocoes: false` — o pedido legítimo de *desligar* — cair em 422. Use checagem
explícita de `undefined`. É a mesma família do bug do `notificationMessage: ''` da Fase 2.

**Telefone brasileiro tem 4 comprimentos, não 2.** Fixo sem DDI = 10, celular sem DDI = 11,
fixo **com DDI = 12**, celular com DDI = 13. Um limiar `> 12` erra o fixo com DDI e o
descadastro não encontra a pessoa, falhando em silêncio. Existem **duas** implementações de
variante de telefone no projeto, com heurísticas diferentes (`opt-out.service.ts` e
`buildPreviewPhoneVariants` em `shared/utils/vcard.ts`) — consolidar é dívida registrada.

**Campo aceito pelo schema não é campo persistido.** `birthDate` era validado, enviado pelos
formulários e nunca chegava ao repositório, em `create` e em `update`. Ao acrescentar campo,
siga o caminho inteiro: schema → service → repository, e escreva o teste que prova a chegada.

**Migration antes ou depois do merge, depende do que o código lê.** O padrão do projeto é
migration depois; mas se o código novo **lê** uma coluna nova numa rota de leitura quente
(como o `/me` do portal), inverta: aditiva com código antigo é segura, o contrário dá P2022.

**Não ajuste teste vermelho para passar sem investigar.** Três testes falham na `main` hoje,
e todos documentam problemas reais (ver a seção nova no `CLAUDE.md`). Silenciá-los apagaria
a única informação que resta sobre funcionalidade perdida.

---

## O que falta

### Etapa 2 — Fase 5 (próxima)
§5 da spec. Confirmação por resposta 1/2 (webhook, casamento por lembrete enviado nas últimas
48 h, ação no candidato mais próximo **dizendo qual foi**) e retorno programado
(`Service.returnIntervalDays`, job diário no fuso do tenant).
**A reconquista está fora de escopo** por decisão do usuário — o evento `winback` continua no
catálogo e precisa ganhar tratamento visual de "em breve" na matriz, senão fica um toggle que
o profissional liga e nada acontece.

### Etapa 3 — Fase 3, campanhas
§6 e §7 da spec. Segmentos prontos com refino (não construtor livre), motor que **reusa a
máquina da Fase 4** (claim atômico + varredura no tick), e a §7 inteira de proteção da conta
de WhatsApp — que é o maior risco do pacote e onde não existe garantia, só redução de risco.

---

## Pendências que ficaram da Etapa 1

- Sobrou **uma** mensagem fixa no webhook: `OPT_OUT_CONFIRMACAO`. Candidata a mover para
  `auto-reply-catalog.ts`.
- `customer-history-client.tsx` usa `#A855F7` no gradiente do cabeçalho — roxo da identidade
  antiga, que a PR #324 substituiu na landing e no `/login`. O Portal ficou de fora.
- O bloco "Informações" do Portal aparece quando há endereço mas nunca renderiza o endereço,
  e o card de localização com Google que o `CLAUDE.md` documenta não existe no componente.
- **Tasks 9 a 13 não tiveram revisão por subagente independente** (limite de gastos). Foram
  verificadas manualmente, mas neste pacote o revisor independente pegou 4 defeitos que
  nasceram no plano — vale uma passada nelas antes do merge.
