# Motor de mensagens ao cliente — templates, controle de disparo, campanhas e automações

- **Data:** 2026-07-26
- **Status:** Aprovado para planejamento
- **Escopo:** WhatsApp e e-mail direcionados ao **cliente final** (não à equipe)
- **Fora de escopo:** motor de notificações da equipe (PR #277/#278) — permanece intacto

---

## 1. Problema

O sistema já envia mensagens ao cliente, mas o texto é montado no código e o tenant
quase não controla nada. Três consequências concretas:

1. **O tenant não consegue escrever a própria mensagem.** O esqueleto é fixo em
   [`buildEvolutionMessage`](../../../src/domains/notifications/providers/evolution.provider.ts#L52-L105):
   `Olá, {nome}! {principal} 📅 {data} às {hora} | {serviço} | {negócio}. {final} 🔗 {link}`.
   Só dois fragmentos são editáveis (`mensagemPrincipal` ≤120 caracteres,
   `mensagemFinal` ≤80), guardados num JSON solto em `Tenant.whatsappTemplateConfig`.
   Reagendamento não tem nem isso — o texto é 100% hardcoded.

2. **Não existe liga/desliga por evento.** `Tenant.whatsappEnabled` é tudo-ou-nada.
   O negócio que quer avisar cancelamento mas não quer avisar no-show não tem saída.

3. **Não existe controle no momento da ação.** O botão de no-show em
   [`appointment-drawer.tsx:567`](../../../src/components/domain/scheduling/appointment-drawer.tsx#L567)
   dispara "Notamos que você não compareceu" com um toque, sem diálogo e sem desfazer.

Além disso, o produto não tem nenhuma forma de falar com um **grupo** de clientes
(reconquista, aniversariantes, VIPs) nem de agendar uma mensagem para uma data futura —
que é justamente onde está o valor competitivo desta parte do sistema.

Débitos técnicos relacionados que esta entrega resolve:

- Defaults de template duplicados em três arquivos:
  [`evolution.provider.ts:19`](../../../src/domains/notifications/providers/evolution.provider.ts#L19),
  [`api/whatsapp/templates/route.ts:11`](../../../src/app/api/whatsapp/templates/route.ts#L11),
  [`whatsapp.provider.ts:38`](../../../src/domains/notifications/providers/whatsapp.provider.ts#L38).
- E-mail ao cliente com 3 HTMLs e 3 assuntos hardcoded
  ([`email-templates.ts`](../../../src/domains/notifications/providers/email-templates.ts),
  [`notification.service.ts:14`](../../../src/domains/notifications/notification.service.ts#L14)).
- Agendamento online gera **duas** mensagens redundantes ao cliente
  (`appointment-created` e `appointment-confirmed`, textos quase idênticos).

---

## 2. Objetivos e não-objetivos

### Objetivos

1. Tenant escreve livremente o texto de cada mensagem, com variáveis `{{}}` e formatação
   de WhatsApp, opcionalmente com uma imagem de topo.
2. Zero texto de mensagem ao cliente hardcoded no código de envio — tudo resolvido a
   partir de um catálogo único com fallback, e sobrescrito por template do banco.
3. Liga/desliga por evento, com padrão do negócio, e override pontual no momento da ação.
4. Disparo em massa segmentado, com proteções contra banimento do número e contra
   violação de LGPD.
5. Mensagens agendadas para data/hora futura.
6. Duas automações de mercado: confirmação por resposta (1/2) e retorno programado +
   reconquista de inativos.
7. **Mobile e desktop completos** em todas as telas novas, e configuração que um dono de
   salão consiga fazer sozinho, sem suporte.

### Não-objetivos

- Motor de notificações da **equipe** — não é tocado.
- Avaliação pós-atendimento por WhatsApp (o funil da Onda 1 já existe; falta só o gatilho).
  Fica pronto para plugar, mas não entra nesta entrega.
- Lista de espera / vaga liberada. Exige model novo e regra de concorrência própria.
- Editor de e-mail HTML rico com blocos visuais. O e-mail usa um layout único
  parametrizado pelo branding do tenant, com o corpo vindo do template.
- Migração para a API oficial do WhatsApp (Cloud API). Continua Evolution primário,
  Twilio fallback.

---

## 3. Decisões de arquitetura

### 3.1 Motor irmão, não motor compartilhado

O motor da equipe (`NotificationTemplate`, `TenantNotificationSetting`,
`UserNotificationPreference`) **não é reaproveitado como model**. Os canais são
diferentes (`WHATSAPP`/`EMAIL` externo × `IN_APP`/`EMAIL` interno), as variáveis são
diferentes, a permissão é diferente e o ciclo de vida é diferente. Fundir exigiria um
campo `audience` e dois enums de canal convivendo no mesmo model — mais difícil de
entender e de evoluir do que dois motores irmãos.

**O que é compartilhado:** a função pura
[`interpolateTemplate()`](../../../src/domains/notifications/user-notifications/notification-template-engine.ts)
e o padrão de catálogo de eventos. Se necessário, `interpolateTemplate` é promovida para
`src/shared/` sem mudança de comportamento.

### 3.2 Catálogo único como fonte de verdade

Novo arquivo `src/domains/notifications/customer-messages/customer-message-catalog.ts`.
Para cada evento define: rótulo, descrição, variáveis disponíveis, corpo padrão por canal,
assunto padrão (e-mail), **natureza** (`transactional` | `promotional`) e se nasce ligado.

Isto substitui os três `TEMPLATE_DEFAULTS` duplicados e os `EMAIL_SUBJECTS`.

**Regra:** nenhum arquivo de provider pode conter texto de mensagem. Providers recebem
texto já renderizado.

**As mensagens genéricas do sistema continuam existindo.** "Remover o hardcode" significa
tirar o texto de dentro do *código de envio*, não deixar o produto sem mensagem pronta. O
catálogo **é** o conjunto de mensagens padrão do Agendê: versionadas em código, revisadas
por nós, boas o suficiente para um tenant que nunca abrir a tela de configuração. A relação
é de duas camadas:

| Camada | Origem | Quando vale |
|---|---|---|
| Padrão do sistema | catálogo (código) | sempre que o tenant não tiver template próprio |
| Personalização | `CustomerMessageTemplate` | sobrescreve o padrão, por evento e por canal |

Consequências que a implementação precisa respeitar:

- Tenant novo **não recebe cópia** dos textos padrão no banco. Ausência de registro
  significa "usa o padrão", e não "sem mensagem". Isso permite melhorar os textos do sistema
  depois e todo mundo que nunca personalizou se beneficiar automaticamente.
- Personalizar é sempre **por evento e por canal**, nunca tudo-ou-nada: o tenant pode reescrever
  só o cancelamento e continuar no padrão do sistema para o resto.
- "Restaurar padrão" **apaga** o registro do template, devolvendo o evento à camada do sistema.
- O editor abre pré-preenchido com o texto padrão do evento, para que personalizar seja
  editar um texto bom, nunca escrever do zero.

### 3.3 Transacional × promocional

Distinção que atravessa todo o desenho:

| | Transacional | Promocional |
|---|---|---|
| Exemplos | criado, confirmado, remarcado, cancelado, no-show, lembrete | aniversário, retorno, reconquista, campanha |
| Respeita `marketingOptOut` | **Não** | **Sim** |
| Exige `consentGiven` | Não | **Sim** |
| Conta no anti-fadiga | Não | Sim |
| Conta no teto promocional do plano | Não | Sim |

Justificativa: comunicação sobre um horário que a pessoa marcou é execução de serviço
contratado. Descadastrar-se de marketing nunca pode desligar o lembrete do próprio horário.

---

## 4. Modelo de dados

### 4.1 Enum novo

```prisma
enum CustomerMessageEvent {
  appointment_requested    // pedido online aguardando confirmação  (NOVO)
  appointment_created      // agendado pelo painel, já vale como confirmado
  appointment_confirmed    // profissional confirmou um pedido online
  appointment_rescheduled
  appointment_cancelled
  appointment_no_show
  appointment_reminder
  birthday
  return_due               // retorno programado
  winback                  // reconquista de inativo
}

enum CampaignStatus {
  DRAFT
  SCHEDULED
  RUNNING
  PAUSED
  COMPLETED
  CANCELLED
}

enum CampaignRecipientStatus {
  PENDING
  SENT
  FAILED
  SKIPPED   // sem telefone, sem consentimento, opt-out, anti-fadiga
}
```

### 4.2 Models novos

```prisma
model CustomerMessageTemplate {
  id        String               @id @default(cuid())
  tenantId  String
  event     CustomerMessageEvent
  channel   NotificationChannel  // WHATSAPP | EMAIL
  subject   String?              // só EMAIL
  body      String               @db.Text
  mediaUrl  String?              // imagem de topo (WHATSAPP)
  createdAt DateTime             @default(now())
  updatedAt DateTime             @updatedAt

  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@unique([tenantId, event, channel])
  @@index([tenantId])
}

model CustomerMessageSetting {
  id        String                @id @default(cuid())
  tenantId  String
  event     CustomerMessageEvent
  enabled   Boolean               @default(true)
  channels  NotificationChannel[] @default([WHATSAPP])
  createdAt DateTime              @default(now())
  updatedAt DateTime              @updatedAt

  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@unique([tenantId, event])
  @@index([tenantId])
}

model Campaign {
  id           String         @id @default(cuid())
  tenantId     String
  name         String
  status       CampaignStatus @default(DRAFT)
  body         String         @db.Text
  mediaUrl     String?
  segment      Json           // validado por Zod (ver 6.2)
  scheduledAt  DateTime?      // interpretado no fuso do tenant
  testSentAt   DateTime?      // envio de teste obrigatório antes de disparar
  startedAt    DateTime?
  completedAt  DateTime?
  totalCount   Int            @default(0)
  sentCount    Int            @default(0)
  failedCount  Int            @default(0)
  skippedCount Int            @default(0)
  createdById  String
  createdAt    DateTime       @default(now())
  updatedAt    DateTime       @updatedAt

  tenant     Tenant              @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  recipients CampaignRecipient[]

  @@index([tenantId])
  @@index([tenantId, status])
  @@index([status, scheduledAt])
}

model CampaignRecipient {
  id         String                  @id @default(cuid())
  tenantId   String
  campaignId String
  customerId String
  status     CampaignRecipientStatus @default(PENDING)
  sentAt     DateTime?
  error      String?
  skipReason String?
  createdAt  DateTime                @default(now())

  tenant   Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  campaign Campaign @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  customer Customer @relation(fields: [customerId], references: [id], onDelete: Cascade)

  @@unique([campaignId, customerId])   // idempotência
  @@index([tenantId])
  @@index([campaignId, status])
}
```

### 4.3 Campos adicionados a models existentes

```prisma
model Customer {
  marketingOptOut     Boolean   @default(false)
  marketingOptOutAt   DateTime?
  lastWinbackAt       DateTime?   // reconquista no máximo 1× / 180 dias
}

model Service {
  returnIntervalDays  Int?        // cadência de retorno; null = não participa
}

model Tenant {
  winbackEnabled       Boolean @default(false)
  winbackDays          Int     @default(90)
  promotionalMaxPerWeek Int    @default(1)   // anti-fadiga por cliente
  replyConfirmEnabled  Boolean @default(false) // confirmação por resposta 1/2
}
```

> `Tenant.whatsappTemplateConfig` **não é removido nesta entrega** — permanece no schema,
> sem leitura, até a fase 1 estar validada em produção. Remoção fica para limpeza posterior.

### 4.4 Migration e backfill — requisito crítico

Migration aditiva. O backfill é obrigatório e não pode perder customização de tenant:

Para cada tenant com `whatsappTemplateConfig` preenchido, cria-se
`CustomerMessageTemplate` (canal `WHATSAPP`) com o corpo montado **injetando os fragmentos
salvos no esqueleto que hoje é hardcoded**. O texto resultante deve ser byte-a-byte
idêntico ao que aquele tenant já envia hoje. Um teste automatizado compara a saída de
`buildEvolutionMessage` (antes) com a renderização do template migrado (depois) para
todos os eventos e para as combinações de payload com e sem `startsAt`.

Tenants sem customização não recebem registro — caem no catálogo por fallback.

Conforme o precedente registrado em `feedback-migrations-vercel-session-coupling`:
a Vercel não roda migrations no build. `prisma migrate deploy` é manual e vai no runbook.
**Nenhum dos campos novos entra na query de sessão (`/me`)** — se a migration atrasar,
ninguém é deslogado.

---

## 5. Fase 1 — Motor de templates e remoção do hardcode

### 5.1 Resolução de mensagem

```
evento / job / campanha
   ↓
customerMessageService.resolve(tenantId, event, channel)
   ↓ busca CustomerMessageTemplate; se não houver, usa o catálogo
   ↓ monta as variáveis a partir do payload
   ↓ interpolateTemplate(body, vars, escape = channel === EMAIL)
   ↓
{ subject?, text, mediaUrl? }  →  provider (Evolution / Twilio / Resend)
```

`buildEvolutionMessage` deixa de montar texto e passa a apenas repassar o texto já
renderizado. O mesmo vale para o caminho Twilio em
[`whatsapp.provider.ts:122`](../../../src/domains/notifications/providers/whatsapp.provider.ts#L122).
`EMAIL_SUBJECTS` e `buildEmailHtml` saem de
[`notification.service.ts`](../../../src/domains/notifications/notification.service.ts);
o e-mail passa a ser um layout único parametrizado pelo branding do tenant, recebendo
`subject` e `body` do template.

`notificationMessage` (mensagem pontual escrita na hora) continua funcionando e continua
tendo precedência sobre o template — comportamento já existente, agora com prévia na UI.

### 5.2 Variáveis

| Variável | Exemplo | Variável | Exemplo |
|---|---|---|---|
| `{{cliente}}` | Maria Silva | `{{negocio}}` | Salão da Lu |
| `{{primeiro_nome}}` | Maria | `{{endereco}}` | Rua X, 123 |
| `{{servico}}` | Escova | `{{telefone_negocio}}` | (11) 99999-0000 |
| `{{profissional}}` | Ana | `{{link_agendamento}}` | agende.app/salao-lu |
| `{{data}}` | 02/08/2026 | `{{link_portal}}` | agende.app/salao-lu/portal |
| `{{hora}}` | 14:00 | `{{valor}}` | R$ 80,00 |
| `{{dia_semana}}` | sábado | `{{duracao}}` | 45 min |
| `{{dias_sem_vir}}` | 92 | `{{ultimo_servico}}` | Escova |

Cada evento expõe apenas o subconjunto que faz sentido. Variável desconhecida vira string
vazia e nunca quebra o envio (comportamento já implementado). Toda formatação de data/hora
é feita **no fuso do tenant**, nunca no fuso do processo.

### 5.3 Formatação e mídia

O corpo aceita a formatação nativa do WhatsApp (`*negrito*`, `_itálico_`, `~riscado~`),
emoji e quebras de linha. Opcionalmente uma imagem de topo (`mediaUrl`), enviada via
`sendMedia` com o texto como legenda. Limites: imagem ≤ 5 MB, JPEG/PNG/WebP.

No canal e-mail a mídia vira imagem no topo do layout e a formatação de WhatsApp é
convertida para HTML equivalente.

---

## 6. Fase 2 — Controle de disparo

### 6.1 Padrão do negócio

Nova sub-aba em Configurações › Notificações: **"Mensagens ao cliente"**, ao lado de
"Avisos do negócio" e "Minhas preferências". Matriz evento × canal com switch e acesso ao
editor de cada template.

Tenant novo é semeado com **todos os eventos ligados**, canal WhatsApp. O seed roda na
criação do tenant; ao conectar o WhatsApp pela primeira vez, garante-se que os registros
existem (idempotente).

### 6.2 Override no momento da ação

Componente único `<CustomerMessageToggle event={...} customerId={...} />`, reutilizado em
todos os pontos de disparo. Ele:

- lê o padrão do tenant para aquele evento e pré-aplica o estado;
- rotula explicitamente qual é o padrão ("Padrão do seu negócio: ligado" / "desligado"),
  para que o override seja consciente;
- permite expandir e **ver o texto já interpolado com os dados reais** daquele agendamento;
- permite substituir por um texto pontual (o `notificationMessage` existente);
- aparece **desabilitado com o motivo** quando não há como enviar — cliente sem telefone,
  sem consentimento, ou WhatsApp desconectado. Nunca um switch ligado que não envia.

O override vale **apenas para aquela ação**. Não altera o padrão do tenant.

**Contrato de backend:** cada rota afetada passa a aceitar `notify?: boolean` opcional.
Ausente significa "usa o padrão do tenant", resolvido **no service**. A decisão nunca fica
apenas no cliente; o service é a autoridade.

### 6.3 Pontos de disparo cobertos

| Ponto | Arquivo | Evento | Mudança |
|---|---|---|---|
| Criar agendamento (painel) | `create-appointment-modal.tsx` | `appointment_created` | + toggle |
| Cancelar | `cancel-appointment-modal.tsx` | `appointment_cancelled` | + toggle |
| Confirmar (modal) | `confirm-appointment-modal.tsx` | `appointment_confirmed` | + toggle |
| Reagendar | `appointment-drawer.tsx:171` | `appointment_rescheduled` | + toggle |
| No-show | `appointment-drawer.tsx:567` | `appointment_no_show` | **+ modal de confirmação** + toggle |
| Confirmar (drawer) | `appointment-drawer.tsx:201` | `appointment_confirmed` | + toggle |
| Vitrine pública | `api/public/[slug]/appointments` | `appointment_requested` | novo evento |
| Lembrete automático | `jobs/appointment-reminder.ts` | `appointment_reminder` | usa template |
| Aniversário | `jobs/birthday-reminder.ts` | `birthday` | usa template |
| Lembrete em massa "hoje" | `api/notifications/bulk-reminder` | `appointment_reminder` | usa template |

### 6.4 Fluxo de agendamento online

Hoje o cliente que agenda pela vitrine recebe duas mensagens quase idênticas. Passa a ser:

```
CLIENTE agenda na vitrine  → appointment_requested
                             "Recebemos seu pedido! Assim que confirmarmos, te aviso."
   ↓ profissional confirma → appointment_confirmed
                             "Tudo certo! Seu horário está confirmado."

PAINEL agenda              → appointment_created
                             "Agendamento confirmado!"
   ↓ profissional confirma → sem segunda mensagem
```

A origem do agendamento é o discriminador. `appointment_confirmed` só dispara ao cliente
quando o agendamento nasceu como pedido online. Não há mudança no domínio de scheduling:
o status inicial continua `SCHEDULED` e nenhuma política nova é criada.

---

## 7. Fase 3 — Campanhas segmentadas

### 7.1 Navegação

Nova entrada de navegação **"Mensagens"**, com três abas: *Campanhas*, *Agendadas*,
*Histórico*. Os templates permanecem em Configurações › Notificações — a página Mensagens
é operação, não configuração.

### 7.2 Segmento

Estrutura validada por Zod, gravada em `Campaign.segment`. Regras combinadas por **E**:

```ts
{
  isVip?: boolean
  tags?: string[]                  // possui qualquer uma
  birthdayMonth?: 'current' | number
  inactiveDaysMin?: number         // última visita há mais de N dias
  completedMin?: number            // top clientes por atendimentos concluídos
  serviceIds?: string[]            // já fez qualquer um destes
  avgTicketMin?: number
  onlyOneVisit?: boolean           // veio uma vez e nunca voltou
  customerSince?: { from?: string; to?: string }
}
```

Endpoint de prévia devolve a contagem elegível **e a contagem de excluídos por motivo**
(sem telefone, sem consentimento, opt-out, anti-fadiga). O tenant vê para quantas pessoas
está falando antes de confirmar.

A mesma estrutura serve para campanha imediata, agendada e para as automações da fase 5.

### 7.3 Motor de envio

O throttle não pode ser um `sleep` longo dentro da rota — funções serverless têm teto de
duração. Desenho:

1. Ao disparar, cria-se um `CampaignRecipient` por destinatário (status `PENDING`),
   já marcando como `SKIPPED` quem é inelegível, com o motivo.
2. Cada tick do cron pega um lote limitado (~25 pendentes) e envia com jitter de 1,5–2,5 s,
   cabendo folgado no tempo da função.
3. O tick seguinte continua de onde parou. `CampaignRecipient` garante idempotência —
   reprocessar um lote nunca envia duas vezes para a mesma pessoa.

Com o cron a cada 10 minutos ([`.github/workflows/cron-tick.yml`](../../../.github/workflows/cron-tick.yml)),
a taxa efetiva é de **~150 mensagens/hora**. Uma campanha de 500 pessoas leva ~3h30, e a UI
mostra a previsão de término **antes** de confirmar. Acelerar depois é aumentar a frequência
do workflow (mínimo de 5 minutos no GitHub Actions).

> A rota `/api/cron/tick` precisa de `maxDuration` explícito compatível com o lote.

### 7.4 Proteções obrigatórias

- **Janela de horário** do tenant (`reminderWindowStart`/`reminderWindowEnd`), avaliada no
  fuso do tenant. Fora da janela, o lote não é processado — a campanha retoma no dia seguinte.
- **Teste obrigatório**: o botão de disparar só habilita depois de um envio de teste para o
  número do próprio tenant (`testSentAt` preenchido). Editar o corpo invalida o teste.
- **Teto mensal** de mensagens promocionais por plano, verificado pelo `featureGuard`.
- **Anti-fadiga**: no máximo `promotionalMaxPerWeek` mensagens promocionais por cliente por
  semana (padrão 1). A contagem é **derivada do `NotificationLog`** — entradas dos últimos
  7 dias para aquele `customerId` cujo evento é `promotional` segundo o catálogo. Não há
  contador denormalizado no `Customer`, que ficaria fora de sincronia. Requer índice
  `@@index([tenantId, customerId, createdAt])` em `NotificationLog`.
- **Exclusão automática** de quem não consentiu, descadastrou ou não tem telefone.
- **Rodapé de descadastro** anexado automaticamente na primeira mensagem promocional que
  cada cliente recebe ("Para não receber mais, responda PARE").
- **Uma campanha em execução por tenant** por vez (`CampaignAlreadyRunningError`).

### 7.5 Opt-out

O webhook [`evolution/messages`](../../../src/app/api/webhooks/evolution/messages/route.ts)
passa a processar, **nesta ordem**: opt-out → confirmação por resposta → chatbot/auto-resposta
existente. Palavras de opt-out: `PARE`, `PARAR`, `SAIR`, `DESCADASTRAR`, `CANCELAR INSCRICAO`
(normalizadas: sem acento, caixa baixa, trim). Marca `marketingOptOut` e responde confirmando.

---

## 8. Fase 4 — Mensagens agendadas

Não requer model próprio: é uma `Campaign` com `scheduledAt` e status `SCHEDULED`. O tick
do cron promove para `RUNNING` quando a hora chega.

`scheduledAt` é sempre interpretado **no fuso do tenant** — a mesma armadilha que a PR #278
já corrigiu no resumo diário da equipe. O formulário coleta data e hora locais; a conversão
para UTC acontece no service, nunca no componente.

A mensagem pode usar um template salvo como ponto de partida ou texto livre.

---

## 9. Fase 5 — Automações

### 9.1 Confirmação por resposta (1/2)

Gated por `Tenant.replyConfirmEnabled`. Quando ligado, o motor **anexa automaticamente** o
convite ao final do lembrete renderizado ("Responda *1* para confirmar ou *2* para cancelar").
O convite não fica embutido no corpo do template: assim, desligar a automação nunca deixa um
pedido órfão num texto que o tenant editou, e ligar não exige que ele edite nada. O texto do
convite é editável como um campo próprio da configuração.

Regras de casamento, no webhook:

- Só interpreta `1`/`2` (e sinônimos `sim`/`confirmar`, `nao`/`cancelar`) se houve
  **lembrete enviado àquele telefone nas últimas 48 h**, consultado no `NotificationLog`.
  Sem model novo. Isso evita interpretar um "1" solto de conversa.
- Localiza o cliente pelo telefone **dentro do tenant** (nunca cross-tenant), considerando
  as variantes de telefone com e sem DDI 55 — mesmo tratamento já usado no import de contatos.
- Agendamentos candidatos: status `SCHEDULED`, `startsAt` nas próximas 48 h.
- Exatamente 1 candidato → age. Mais de 1 → age no **mais próximo** e **responde dizendo
  qual foi**. Nunca age em silêncio sobre um horário ambíguo.
- 0 candidatos → cai no fluxo de chatbot/auto-resposta existente, sem alteração.
- `1` → status `CONFIRMED`; `2` → `CANCELLED`, liberando o horário. Ambos respondem
  confirmando a ação e publicam os eventos de domínio normais.

### 9.2 Retorno programado

Campo novo `Service.returnIntervalDays` (opcional; sem valor, o serviço não participa).
Job diário: atendimento `COMPLETED` cujo serviço tem intervalo configurado e cuja data +
intervalo cai hoje, com o cliente **sem agendamento futuro** → dispara `return_due`.
Promocional: respeita consentimento, opt-out e anti-fadiga.

### 9.3 Reconquista

Gated por `Tenant.winbackEnabled`, com `winbackDays` (padrão 90). Job diário: clientes cuja
última visita concluída foi há exatamente N dias, sem agendamento futuro → dispara `winback`.
Máximo uma vez por cliente a cada 180 dias (`Customer.lastWinbackAt`).

Ambos os jobs seguem o padrão pg-boss + `/api/cron/tick` já estabelecido, e todo cálculo de
"hoje" é feito no fuso do tenant.

---

## 10. Permissões, planos e LGPD

### Permissão

Permissão nova **`mensagens`** (`view`/`edit`), seguindo o precedente de `comissoes` e
`descontos`. Hoje isto cairia dentro da `configuracoes` genérica, o que daria à recepcionista
poder de disparar para a base inteira.

Registrada em `permission-dependencies.ts` com a dependência
**`mensagens:edit` → `clientes:view`** (não há como segmentar sem enxergar a base).
Editar templates exige `mensagens:edit`; ver histórico exige `mensagens:view`.

Conforme o precedente do ADR-016, o `GET` de configuração de mensagens que alimenta a prévia
dentro dos modais de agendamento **não exige** `mensagens:view` — é leitura de apoio
consumida por qualquer colaborador que agenda. A permissão vale para a página Mensagens e
para a escrita.

### Planos

| Recurso | Gate |
|---|---|
| Motor de templates, toggles por evento, modal de no-show | **Todos os planos** |
| Confirmação por resposta | `whatsapp_basic` (todos que já têm WhatsApp) |
| Campanhas, agendadas, retorno, reconquista | `campaigns` — promovida de `soon` para **`ga`**, ligada em PRO/ENTERPRISE |
| Teto mensal de mensagens promocionais | Por plano, via `featureGuard` |

O motor de templates é higiene, não upsell: cobrar por "não mandar a mensagem errada" é ruim
de vender e pior de defender. A confirmação por resposta fica aberta porque reduzir no-show é
retenção, não receita adicional.

Promover `campaigns` a `ga` exige atualizar o `capability-registry` e ligar a capability nos
planos PRO/ENTERPRISE em produção via **UPDATE cirúrgico** em `PlanFeatureConfig` — nunca
rodando o seed inteiro (precedente do brief da Onda 0).

### LGPD

- `consentGiven` é obrigatório para qualquer mensagem promocional.
- `marketingOptOut` é campo próprio e independente de `consentGiven`.
- Opt-out honrado automaticamente pelo webhook, com confirmação ao cliente.
- Rodapé de descadastro na primeira promocional recebida por cada cliente.
- Transacional nunca é bloqueado por opt-out.
- Toda mensagem enviada continua registrada em `NotificationLog`, servindo de trilha.

---

## 11. Experiência de uso — mobile e desktop

Requisito de primeira classe, não acabamento. Toda tela nova entrega **as duas versões**, e
o checklist do `agent-mobile` é gate obrigatório antes da entrega. Mais de 70% do tráfego é
mobile, e o profissional que remarca um horário está com o celular na mão.

### Princípio de configuração

O tenant precisa conseguir configurar sozinho. Três decisões de design que servem a isso:

1. **Nunca partir da folha em branco.** Todo template já vem preenchido com um texto bom do
   catálogo. O tenant edita, não escreve do zero. Botão "Restaurar padrão" sempre visível.
2. **Prévia ao vivo, sempre.** O editor mostra ao lado (desktop) ou abaixo (mobile) a
   renderização em formato de balão de WhatsApp, com dados de exemplo reais. Ninguém salva
   sem ver o que o cliente vai ler.
3. **Variáveis por toque, não por digitação.** Chips clicáveis inserem `{{variavel}}` no
   cursor — mesmo padrão já validado no editor da equipe. Ninguém precisa decorar sintaxe.

### Telas

**Editor de template** — desktop: duas colunas (editor | prévia). Mobile: coluna única com a
prévia fixada abaixo do editor, chips de variáveis em faixa rolável horizontal, barra de
formatação e ações num rodapé fixo (`sticky bottom-0`) para não exigir rolagem até o fim.

**Matriz evento × canal** — desktop: tabela. Mobile: lista de cartões, um por evento, com o
switch à direita e o link para editar embaixo. Nunca uma tabela espremida com rolagem
horizontal.

**Construtor de segmento** — desktop: painel de regras à esquerda, contagem e amostra à
direita. Mobile: regras empilhadas com a contagem elegível fixada no topo (`sticky`), sempre
visível enquanto a pessoa mexe nos filtros — é a informação que orienta a decisão.

**Toggle no modal de ação** — o bloco cabe em duas linhas e não empurra os botões de ação
para fora da tela no mobile. A prévia fica recolhida por padrão e expande sob demanda.

**Disparo de campanha** — resumo pré-envio (destinatários, excluídos com motivo, ritmo,
previsão de término) apresentado como passo obrigatório, em tela cheia no mobile.

### Restrições de UI já conhecidas do projeto

- Todo `DialogContent` novo precisa de `max-h` + `overflow-y-auto` — erro recorrente
  já reportado.
- Dialog dentro de Dialog exige `modal={false}` no interno, sob pena de travar a tela.
- Alvos de toque de no mínimo 44×44.
- Carrosséis horizontais não usam `touch-pan-x` (trava o scroll vertical no mobile).
- Loading, erro e vazio explícitos em toda tela nova.

---

## 12. Erros tipados

Novos em `src/shared/errors/`:

| Erro | Quando | HTTP |
|---|---|---|
| `CustomerMessageTemplateNotFoundError` | template e catálogo ausentes para o evento | 404 |
| `CampaignTestRequiredError` | disparo sem envio de teste prévio | 409 |
| `CampaignAlreadyRunningError` | segunda campanha simultânea no tenant | 409 |
| `CampaignNotEditableError` | edição de campanha em execução ou concluída | 409 |
| `InvalidSegmentError` | segmento sem nenhuma regra ou com regra inválida | 400 |
| `MarketingOptOutError` | envio promocional a cliente descadastrado | 422 |
| `PromotionalQuotaExceededError` | teto do plano estourado | 402 (upsell) |
| `MediaTooLargeError` | imagem acima do limite | 413 |

Atenção ao débito já documentado em
[`notification.service.ts:42`](../../../src/domains/notifications/notification.service.ts#L42):
`PlanLimitError` propagado de dentro de um job pg-boss **faz o job falhar** em vez de virar
upsell. No caminho de campanha, o teto deve ser tratado dentro do job — marcar
`CampaignRecipient` como `SKIPPED` com motivo e registrar log, nunca propagar.

---

## 13. Testes

Seguindo as metas do projeto (service 80%, repository 60%, rota 70%):

**Fase 1 — o mais crítico:** teste de equivalência do backfill. Para cada evento e cada
combinação de payload, a saída do `buildEvolutionMessage` atual deve ser idêntica à
renderização do template migrado. É o que garante que nenhum tenant perde customização.

Demais coberturas:

- Interpolação: variável ausente, variável desconhecida, escape de HTML no canal e-mail.
- Resolução de canal: template do tenant × fallback do catálogo.
- Toggle: `notify` ausente usa o padrão do tenant; `notify: false` não envia mesmo com
  padrão ligado; `notify: true` envia mesmo com padrão desligado.
- Fluxo online: `appointment_requested` na vitrine, `appointment_created` no painel,
  `appointment_confirmed` só para pedido de origem online.
- Segmento: cada regra isolada e combinações; contagem de excluídos por motivo.
- Fila: idempotência (reprocessar lote não duplica), retomada, respeito à janela de horário,
  bloqueio sem teste prévio.
- Opt-out: normalização das palavras-chave; promocional bloqueado, transacional passa.
- Confirmação por resposta: 1 candidato, múltiplos candidatos, zero candidatos (cai no
  chatbot), fora da janela de 48 h, telefone com e sem DDI 55.
- Fuso horário: agendamento às 08:00 do tenant em fuso diferente do processo.
- Anti-fadiga e teto de plano.

---

## 14. Fases de entrega

Cada fase é uma PR mergeável e útil sozinha.

| # | Entrega | Depende de |
|---|---|---|
| 1 | Catálogo, models, migration + backfill, remoção de todo o hardcode, aba de templates | — |
| 2 | Toggles por evento, flag nos 10 pontos de disparo, modal de no-show, fluxo `appointment_requested` | 1 |
| 3 | Campanhas: segmentos, editor com mídia, fila throttled, opt-out, teste obrigatório, relatório, permissão `mensagens`, gate `campaigns` | 1, 2 |
| 4 | Mensagens agendadas | 3 |
| 5 | Confirmação por resposta, retorno programado, reconquista | 2, 3 |

---

## 15. Runbook de produção

1. `npx prisma migrate deploy` (manual — a Vercel não roda migrations no build).
2. Script de backfill de templates, **na mesma janela**, logo após a migration.
3. Seed idempotente de `CustomerMessageSetting` para tenants existentes (tudo ligado).
4. Na fase 3: UPDATE cirúrgico em `PlanFeatureConfig` ligando `campaigns` em PRO/ENTERPRISE
   e no `capability-registry` (`soon` → `ga`). Nunca rodar o seed inteiro.
5. Verificar `maxDuration` da rota `/api/cron/tick` após a fase 3.

---

## 16. Riscos

| Risco | Mitigação |
|---|---|
| Backfill perde customização de tenant | Teste de equivalência byte-a-byte antes do merge da fase 1 |
| Número do tenant banido por disparo em massa | Throttle, janela de horário, teto por plano, opt-out, teste obrigatório |
| Cron do GitHub Actions atrasa ou é desativado após 60 dias sem commit | Campanha retoma de onde parou; previsão de término é estimativa, não promessa. Monitorar |
| `1`/`2` interpretado fora de contexto | Só age com lembrete enviado nas últimas 48 h e agendamento candidato |
| Timeout da função serverless no lote | Lote dimensionado com folga; `maxDuration` explícito |
| `PlanLimitError` derrubando job de campanha | Teto tratado dentro do job como `SKIPPED`, nunca propagado |
| Escopo grande (4 subsistemas num documento) | Fases independentes e mergeáveis; a 1 já entrega valor sozinha |

---

## 17. Itens deixados prontos para plugar

- **Avaliação pós-atendimento por WhatsApp** — o funil da Onda 1 já existe; falta um template
  e um gatilho no evento de conclusão. A menor das automações restantes.
- **Vaga liberada / lista de espera** — exige model de lista de espera e regra de
  concorrência (quem responder primeiro leva).
- **Remoção de `Tenant.whatsappTemplateConfig`** — após a fase 1 estar validada em produção.
- **Remoção dos 3 booleans legados de notificação no `User`** — pendência herdada da PR #278.
