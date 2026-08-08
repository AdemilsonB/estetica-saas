# Motor de mensagens — handoff da Etapa 3 (Fase 3: campanhas)

**Última atualização:** 2026-08-08
**Etapa 1 (Fundação):** ✅ mergeada (PR #325), migration aplicada em produção
**Etapa 2 (Fase 5):** ✅ PR #326 aberta — confirmação por resposta + retorno programado
**Próxima:** Etapa 3 — campanhas segmentadas

---

## Leia antes de qualquer coisa

| Documento | Para quê |
|---|---|
| `docs/superpowers/specs/2026-08-02-motor-mensagens-consolidacao-fases-3-5-design.md` | **A spec.** §6 e §7 são a Etapa 3 |
| `docs/decisions.md` → ADR-020 e ADR-021 | Por que o desenho é assim |
| `docs/superpowers/plans/2026-08-03-motor-mensagens-etapa-2-fase-5.md` | Modelo de plano que funcionou |

---

## O que já está pronto e você vai consumir

**Nenhuma migration é necessária.** Tudo entrou na migration única da Etapa 1, já aplicada:

| Já existe, sem uso | Para quê |
|---|---|
| `Campaign` / `CampaignRecipient` + enums | Os models da Etapa 3 |
| Índices de `NotificationLog` | Anti-fadiga e casamento por telefone |
| `Customer.marketingOptOut` + trilha | Opt-out, já honrado pelo webhook |

**A guarda de consentimento já existe e funciona.** `customerMessageDispatcher` aplica
consentimento, opt-out e anti-fadiga para todo evento promocional, decidindo pela natureza
lida do catálogo. **Não repita esse filtro no SQL da campanha** — a Etapa 1 existiu
justamente para tirar essa checagem dos três lugares onde estava espalhada.

**A máquina de agendamento já existe.** `ScheduledMessage` (ADR-019) usa claim atômico
`PENDING → SENDING` + varredura no `/api/cron/tick`. A §6.3 da spec manda **reusá-la**, não
criar uma segunda.

---

## Armadilhas que já custaram tempo neste pacote

**Cast de payload trunca campos em silêncio.** `whatsapp.gateway.ts` e `notification.service.ts`
fazem `draft.payload as { ...lista fixa... }` — **qualquer chave fora da lista é descartada
sem erro**. Isso fez a mensagem de retorno programado sair com dois buracos em 100% dos
envios, com testes verdes. Se a campanha mandar variável nova no payload, **acrescente ao
cast** e escreva teste que siga a cadeia até o texto renderizado. Teste de payload não
prova nada aqui.

**`NOW() AT TIME ZONE 'UTC' AT TIME ZONE tz` está errado.** `NOW()` já é `timestamptz`; a
cadeia dupla desloca 2× o offset. Ela vale **só** para coluna `timestamp` naive (como
`startsAt`). Para `NOW()`, uma conversão só. O erro fica mascarado em UTC-3 com cron às
12:00 porque não cruza a meia-noite.

**Campo aceito pelo schema não é campo persistido.** Já aconteceu duas vezes (`birthDate`,
e quase com `returnIntervalDays`). Siga schema → service → repository → **e escreva teste
que mocke o repositório e afirme o repasse**, incluindo o caso de `null` limpando o campo.

**`.refine` de Zod com `??` engole booleanos `false`.** Use checagem explícita de `undefined`.

**Telefone brasileiro tem 4 comprimentos.** Fixo 10, celular 11, fixo com DDI 12, celular
com DDI 13. Reuse `variantesDeTelefone` de `@/domains/crm/opt-out.service` — não escreva
uma terceira implementação (já existem duas, com heurísticas diferentes).

**Registrar job no `/api/cron/tick` exige tocar TRÊS `Promise.all`:** `createQueue`,
`schedule` e a execução. Esquecer o `createQueue` faz o pg-boss v12 lançar erro de foreign
key em produção — falha que nenhum teste local pega.

**Não ajuste teste vermelho para passar.** Três falham na `main` e todas documentam
problemas reais (ver a seção no `CLAUDE.md`).

---

## O que falta — Etapa 3

§6 e §7 da spec. Os pontos que mais exigem cuidado:

- **Segmentos prontos com refino**, nunca construtor livre — decisão do usuário.
- **Todos os presets carregam `≥1 atendimento concluído`.** É a proteção isolada mais
  eficaz contra banimento, e é o que separa relacionamento de disparo para lista fria.
- **A §7 inteira de proteção da conta de WhatsApp.** Não existe garantia de não-banimento
  no Evolution — só redução de risco em camadas, e a que mais protege é *quem entra na
  lista*, não a velocidade de envio.
- **Prévia mostrando o motivo de cada exclusão com número.** Sem isso o tenant vê "312
  clientes" na base e "23 elegíveis" na campanha e acha que o sistema está quebrado.
- **`maxDuration = 300`** já está declarado no tick.
- Promover `campaigns` de `soon` para `ga` exige **UPDATE cirúrgico** em `PlanFeatureConfig`
  na produção, nunca o seed inteiro.

---

## Dívidas registradas das Etapas 1 e 2

- Sobrou uma mensagem fixa no webhook: `OPT_OUT_CONFIRMACAO`.
- `notification.service.ts` tem cast de payload com a mesma limitação do gateway, para o
  canal EMAIL. Inofensivo hoje (`return_due` é só WhatsApp), revisitar se ganhar e-mail.
- Duas implementações de variante de telefone com heurísticas diferentes.
- O `.max(300)` do convite de confirmação não tem contador nem `maxLength` na UI: texto
  longo falha no PATCH e a profissional só vê toast genérico, com o texto ainda na tela.
- Portal ainda usa `#A855F7` (roxo da identidade antiga).
- O bloco "Informações" do Portal aparece com endereço mas nunca renderiza o endereço.
