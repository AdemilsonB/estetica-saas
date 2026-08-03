# Motor de mensagens ao cliente — Consolidação + Fases 3 e 5

**Data:** 2026-08-02
**Status:** aprovado pelo usuário, pronto para virar plano de implementação
**Precede:** `2026-07-26-motor-mensagens-cliente-design.md` (spec original das 5 fases)
**ADRs relacionadas:** ADR-017 (Fase 1), ADR-018 (Fase 2), ADR-019 (Fase 4 um-a-um)

---

## 1. O que este documento é

As Fases 1, 2 e 4 estão entregues e em produção. Este documento fecha o motor: entrega as
Fases 3 e 5 num único pacote e, antes delas, corrige o que a auditoria do que já existe
revelou de quebrado.

Ele **substitui** as §7 e §9 da spec original naquilo que divergir. O restante da spec
original continua valendo.

Duas coisas mudaram de escopo em relação ao desenho original, por decisão do usuário:

- A **reconquista (winback)** sai da Fase 5. Ficam a confirmação por resposta e o retorno
  programado.
- O **construtor livre de segmento** (9 dimensões combinadas por E) é substituído por
  segmentos prontos com refino opcional.

---

## 2. Achados da auditoria

Levantados por varredura do código em 2026-08-02. Os cinco primeiros são pré-requisito das
fases novas, não limpeza opcional.

### 2.1 O webhook do Evolution está atrás de um gate que mata as duas fases

[`src/app/api/webhooks/evolution/messages/route.ts:93`](../../../src/app/api/webhooks/evolution/messages/route.ts)

```ts
if (!tenant || !tenant.autoReplyEnabled) return new Response(null, { status: 200 })
```

Tenant com auto-resposta desligada nunca chega ao resto do handler. O opt-out ("PARE",
requisito da Fase 3) e a confirmação por resposta ("1"/"2", requisito da Fase 5) entram
exatamente aí e **não funcionariam** para esse tenant.

Agravante: o throttle de `autoReplyIntervalHours` (linha 108) roda **antes** da
classificação de intenção. Um cliente que respondeu qualquer coisa há 2 h e depois manda
"PARE" tem o descadastro engolido em silêncio. Isso é falha de LGPD, não inconveniência de
UX.

### 2.2 Sobrou hardcode que as Fases 1 e 2 não pegaram

As Fases 1 e 2 limparam os *providers*. O webhook ficou de fora e mantém quatro textos fixos
no código (linhas 121-159): resposta de agendar, de cancelar, lista de preços e horário de
funcionamento. O requisito original de "remover qualquer mensagem hardcoded" não está
cumprido enquanto eles existirem.

### 2.3 Um campo órfão ainda vence o template

[`src/shared/queue/jobs/birthday-reminder.ts:40`](../../../src/shared/queue/jobs/birthday-reminder.ts)
passa `message: customer.birthdayMessage ?? undefined` ao dispatcher, e `message` tem
precedência sobre o template do catálogo.

O `CLAUDE.md` registra que o campo foi retirado da UI *porque nunca tinha efeito*. Ele tem:
quem salvou um texto lá antes da limpeza continua com esse texto vencendo o catálogo, agora
sem nenhuma tela onde enxergar ou editar. Mensagem fantasma.

### 2.4 Consentimento não é centralizado

O `customerMessageDispatcher` se declara "único caminho de envio ao cliente" mas não checa
consentimento. Quem checa é cada chamador, cada um do seu jeito:

| Onde | Como |
|---|---|
| `birthday-reminder.ts:20` | `AND c."consentGiven" = true` no SQL |
| `bulk-reminder/route.ts:32` | filtro em JS sobre o resultado |
| dispatcher | não checa |

As fases novas acrescentam disparos promocionais. Multiplicar os lugares onde dá para
esquecer o consentimento é como isso vira multa.

### 2.5 Faltam índices para as duas consultas novas

`NotificationLog` tem índices por `tenantId`, por `(tenantId, channel, status)`, por
`appointmentId` e por `customerId`. A anti-fadiga precisa consultar por
`(tenantId, customerId, createdAt)` e o casamento da confirmação por resposta precisa de
`(tenantId, recipient, createdAt)`. Nenhum dos dois existe — sem eles, as duas consultas
varrem a tabela que mais cresce no sistema.

### 2.6 `/api/cron/tick` não declara `maxDuration`

O tick já roda doze jobs do pg-boss mais a varredura de mensagens agendadas. Acrescentar
lotes de campanha sem teto explícito é risco de timeout que derruba os jobs seguintes.

---

## 3. Consentimento — estado real e decisão

### 3.1 Como está hoje

**Não existe tela de consentimento em lugar nenhum do sistema.** O campo `consentGiven` é
preenchido por inferência:

| Origem do cliente | `consentGiven` | O que de fato aconteceu |
|---|---|---|
| Cadastro na vitrine pública | `true` — fixo no código ([`route.ts:71`](../../../src/app/api/public/[slug]/customers/route.ts)) | Nada foi perguntado a ele |
| Cadastrado pelo profissional no painel | `false` | Nada foi perguntado a ele |
| Importado do WhatsApp / `.vcf` | `false` | Nada foi perguntado a ele |

O primeiro caso grava `consentGiven: true`, `consentDate: agora` e
`consentOrigin: 'public_booking'` — um registro de consentimento que nunca ocorreu.

### 3.2 Decisões do usuário

Registradas como decisão de produto, com as ressalvas que foram apresentadas antes da
escolha:

1. **O motor usa `consentGiven` como está.** Sem reclassificação de origem, sem apoio em
   legítimo interesse para cobrir a base existente.
2. **O histórico não é tocado.** Os registros com `consentOrigin: 'public_booking'`
   permanecem e continuam contando como opt-in.
3. **A vitrine passa a exibir um checkbox pré-marcado**, que o cliente pode desmarcar, e
   grava o que ele escolheu.

**Ressalvas registradas, não resolvidas:**

- Caixa pré-marcada é o exemplo clássico do que a LGPD não aceita como manifestação
  afirmativa (art. 5º, XII — "manifestação livre, informada e inequívoca"). O desenho é um
  avanço sobre o estado atual, em que o cliente sequer vê a opção, mas não é opt-in válido.
- Os registros históricos afirmam consentimento que não houve. Enquanto contarem como
  opt-in, a trilha de auditoria é prova contra, não a favor.

Ambas ficam abertas para decisão futura. Nenhuma bloqueia esta entrega.

### 3.3 Consequência operacional, e o que ela obriga a construir

Com `consentGiven` como porta e cruzando com "só clientes atendidos" (§6.2), o público
elegível é a interseção de dois filtros estreitos. Todo cliente cadastrado pelo painel está
em `false`; todo contato importado está em `false`. Sobra quem se cadastrou sozinho na
vitrine **e** já foi atendido.

Num salão que cadastra a clientela na recepção — o caso comum — isso pode ser uma fração
pequena da base. O tenant abre a campanha, vê "312 clientes" na lista e "23 elegíveis" na
prévia, e conclui que o sistema está quebrado.

Isso não muda a decisão, mas obriga três construções que sem ela seriam opcionais:

1. **Chave de consentimento no formulário de cliente do painel** — a profissional marca no
   cadastro ou depois. É o caminho realista: a pessoa está ali.
2. **Chave no Portal do cliente › Meus Dados** — o próprio cliente liga ou desliga.
3. **A prévia da campanha mostra o motivo de cada exclusão, com número.** Transforma o
   buraco em algo visível e acionável em vez de um mistério.

---

## 4. Etapa 1 — Fundação

Pré-requisito das duas fases. Nada da Fase 3 ou 5 começa antes de esta etapa fechar.

### 4.1 O dispatcher vira o guardião único

`customerMessageDispatcher.dispatch()` passa a decidir por **natureza do evento**, lida do
catálogo (`nature: 'transactional' | 'promotional'`):

- **Transacional** → envia sempre. Não depende de consentimento; `marketingOptOut` não
  bloqueia. Confirmação de horário não é marketing, e bloquear isso seria quebrar o serviço
  que o cliente contratou.
- **Promocional** → exige `consentGiven === true`, ausência de `marketingOptOut`, e
  aprovação da anti-fadiga (§6.4).

O modo `kind: "direct"` (mensagem agendada um-a-um, ADR-019) **não** passa por esta guarda:
quem escreveu o texto e marcou a hora já decidiu enviar, e é uma mensagem individual, não
disparo em massa. Mantém o comportamento entregue na Fase 4.

Com isso, o filtro de `consentGiven` **sai** do SQL do `birthday-reminder` e do JS do
`bulk-reminder`. Passa a existir num lugar só, derivado de um dado que o catálogo já declara
— o que torna impossível esquecê-lo ao acrescentar um evento novo.

**Fronteira explícita:** a regra "≥1 atendimento concluído" **não** entra no dispatcher. Ela
é regra de *segmento de campanha* (§6.2). Se entrasse aqui, mudaria em silêncio o
comportamento do aniversário, que hoje alcança qualquer cliente com consentimento —
mudança silenciosa em recurso vivo é como se cria bug que ninguém acha.

### 4.2 Opt-out com trilha própria

Campos novos em `Customer`:

| Campo | Tipo | Para quê |
|---|---|---|
| `marketingOptOut` | `Boolean @default(false)` | O cliente pediu para não receber promoção |
| `marketingOptOutAt` | `DateTime?` | Quando pediu |
| `marketingOptOutOrigin` | `String?` | Por onde (`whatsapp_reply`, `portal`, `panel`) |

Independente de `consentGiven`, que é consentimento de cadastro. "Aceitei me cadastrar" e
"não quero mais promoção" são coisas diferentes.

A trilha do opt-out é registrada corretamente desde o início, ao contrário da do opt-in:
quando o cliente pede para sair, a data e o canal do pedido são a defesa do tenant.

### 4.3 Webhook reordenado

Nova ordem de processamento, com a checagem de gate movida:

```
1. opt-out            ← fora do gate autoReplyEnabled, antes do throttle
2. confirmação 1/2    ← fora do gate autoReplyEnabled, antes do throttle
3. auto-resposta/chatbot  ← comportamento atual, preservado, ainda sob o gate
```

Descadastro e cancelamento de horário não podem ser engolidos por uma janela anti-flood
desenhada para outra finalidade. O `WhatsAppAutoReplyLog` continua governando apenas o
passo 3.

O opt-out responde confirmando o descadastro. Essa confirmação **não** conta para o throttle
do passo 3.

### 4.4 Os textos fixos do webhook saem do código

Os quatro textos (agendar, cancelar, preços, horários) migram para configuração do tenant na
**mesma arquitetura de duas camadas** das Fases 1 e 2: catálogo em código é o padrão do
sistema, o banco guarda só a personalização, e ausência de registro significa "usa o padrão",
nunca "sem mensagem".

Isso reusa a máquina existente em vez de criar uma terceira. A resposta de preços e a de
horários são geradas a partir de dados (lista de serviços, `businessHours`), então o
template define a **moldura** e os dados entram como variável.

### 4.5 `birthdayMessage` perde a precedência

O `birthday-reminder` deixa de passar `message: customer.birthdayMessage`. O catálogo passa
a ser a única fonte do texto de aniversário. O campo permanece na tabela (remoção de coluna
é migration destrutiva, fora do escopo) mas deixa de ter efeito.

### 4.6 Coleta de consentimento

Três pontos novos, conforme §3.3: chave no formulário de cliente do painel, chave no Portal
do cliente › Meus Dados, e checkbox pré-marcado no cadastro da vitrine substituindo o
`consentGiven: true` fixo.

O Portal e a vitrine também expõem o `marketingOptOut` — é o mesmo controle, do ponto de
vista do cliente: "quero receber promoções e novidades".

### 4.7 Índices

```prisma
@@index([tenantId, customerId, createdAt])   // anti-fadiga
@@index([tenantId, recipient, createdAt])    // casamento da confirmação por resposta
```

### 4.8 `maxDuration` no tick

`/api/cron/tick` declara `maxDuration` explícito, compatível com o lote de campanha
dimensionado em §6.3.

---

## 5. Etapa 2 — Fase 5

### 5.1 Confirmação por resposta (1/2)

Gated por `Tenant.replyConfirmEnabled` (novo, default `false`).

**O convite é anexado ao lembrete já renderizado**, não embutido no corpo do template. O
texto do convite é campo próprio e editável (`Tenant.replyConfirmInvite`, com padrão do
sistema).

A razão do desenho: desligar a automação nunca deixa um pedido órfão dentro de um texto que
o tenant editou, e ligar não exige que ele edite nada.

**Regras de casamento, no webhook:**

- Só interpreta `1`/`2` — e os sinônimos `sim`/`confirmar`, `nao`/`não`/`cancelar`,
  normalizados sem acento e em caixa baixa — se houve **lembrete enviado àquele telefone nas
  últimas 48 h**, consultado no `NotificationLog`. Sem model novo. Isso evita interpretar um
  "1" solto de conversa.
- Cliente localizado pelo telefone **dentro do tenant**, nunca cross-tenant, considerando as
  variantes com e sem DDI 55 (mesmo tratamento já usado no import de contatos).
- Agendamentos candidatos: status `SCHEDULED`, `startsAt` nas próximas 48 h.
- **Exatamente 1 candidato** → age.
- **Mais de 1** → age no mais próximo **e responde dizendo qual foi**. Nunca agir em
  silêncio sobre horário ambíguo.
- **0 candidatos** → cai no fluxo de auto-resposta/chatbot existente, sem alteração.
- `1` → `CONFIRMED`. `2` → `CANCELLED`, liberando o horário. Ambos respondem confirmando a
  ação e publicam os eventos de domínio normais — o que faz a equipe ser notificada pelo
  motor já existente.

Gate de plano: `whatsapp_basic` (todos que já têm WhatsApp). Reduzir no-show é retenção, não
receita adicional.

### 5.2 Retorno programado

Campo novo `Service.returnIntervalDays` (`Int?`; sem valor, o serviço não participa).

Job diário: atendimento `COMPLETED` cujo serviço tem intervalo configurado, cuja data +
intervalo cai **hoje no fuso do tenant**, e cujo cliente **não tem agendamento futuro** →
dispara o evento `return_due`.

Promocional, portanto passa integralmente pela guarda da §4.1: consentimento, opt-out e
anti-fadiga.

Segue o padrão pg-boss + `/api/cron/tick` já estabelecido no projeto. Todo cálculo de "hoje"
no fuso do tenant, nunca no fuso do processo.

### 5.3 A reconquista fica visivelmente indisponível

O evento `winback` continua no catálogo (remover exigiria mexer no enum e na matriz), mas
ganha tratamento de **"em breve"** na UI de Mensagens ao cliente: sem toggle ativo, com
rótulo explicando que ainda não dispara — o mesmo tratamento que o `capability-registry` já
dá a `status: 'soon'`.

Um toggle que o profissional liga e nada acontece é pior que a ausência do recurso.

---

## 6. Etapa 3 — Fase 3, campanhas segmentadas

### 6.1 Modelo de dados

**`Campaign`** — uma campanha por tenant, com corpo, segmento resolvido, status, marcação de
teste enviado, agendamento opcional e contadores.

**`CampaignRecipient`** — um registro por destinatário, com status
(`PENDING`/`SENT`/`FAILED`/`SKIPPED`), motivo da exclusão quando `SKIPPED`, e referência ao
`NotificationLog`. É o que dá idempotência: reprocessar um lote nunca envia duas vezes para
a mesma pessoa.

Ambos com `tenantId` e `@@index([tenantId])`, conforme a regra de multi-tenancy do projeto.

### 6.2 Segmento

**Segmentos prontos** como porta de entrada, cada um com contagem ao vivo:

| Preset | Regra |
|---|---|
| Aniversariantes do mês | `birthDate` no mês corrente |
| Clientes VIP | `isVip` |
| Sumidos há mais de N dias | última visita concluída há mais de N (padrão 90) |
| Melhores clientes | ≥ N atendimentos concluídos (padrão 5) |
| Vieram só uma vez | exatamente 1 atendimento concluído |
| Todos os clientes atendidos | ≥ 1 atendimento concluído |

**"Refinar"** abre um punhado de ajustes sobre o preset escolhido — somente VIP, etiquetas,
serviço já realizado — e não uma folha em branco com dez campos.

O preset "Sumidos há mais de N dias" **não** contradiz a remoção da reconquista (§5.3): a
reconquista é um job automático que dispara sozinho, e ela sai de escopo. Uma campanha manual
para clientes inativos é o tenant decidindo enviar, com o texto que ele escreveu, na hora que
ele escolheu. São coisas diferentes.

**Todos os presets carregam implicitamente `≥ 1 atendimento concluído`.** Contato importado
sem histórico fica fora até ser atendido. Essa regra tem duas finalidades ao mesmo tempo: é
a proteção isolada mais eficaz contra banimento (§7) e é a fronteira que separa
relacionamento com cliente de disparo para lista fria.

**A prévia** devolve a contagem elegível **e a contagem de excluídos por motivo**: sem
telefone, sem consentimento, opt-out, anti-fadiga, sem atendimento concluído. O tenant vê
para quantos está falando, e por que os outros ficaram de fora, antes de confirmar.

### 6.3 Motor de envio

**Reusa a máquina da Fase 4** — claim atômico + varredura no `/api/cron/tick` —, não cria
uma segunda. O que a campanha acrescenta é o que ela tem de próprio: segmento, lote,
throttle, janela de horário e teste obrigatório.

1. Ao disparar, cria-se um `CampaignRecipient` por destinatário (`PENDING`), já marcando como
   `SKIPPED` quem é inelegível, com o motivo.
2. Cada tick processa um lote limitado, com jitter entre os envios, cabendo com folga no
   tempo da função.
3. O tick seguinte continua de onde parou.

O volume real dos tenants é desconhecido (o usuário não soube estimar). Portanto: **taxa
conservadora por padrão, constantes configuráveis, e a UI declara a previsão de término
antes de confirmar o disparo** em vez de esconder a lentidão. Acelerar depois é aumentar a
frequência do workflow do GitHub Actions (mínimo de 5 minutos) e/ou o tamanho do lote — sem
mudar o desenho.

**Constantes de partida** — heurística, não verdade medida. Devem viver num módulo próprio,
nomeadas, para serem ajustadas sem caçar número mágico no meio do motor:

| Constante | Valor inicial | Razão |
|---|---|---|
| Lote por tick | 20 destinatários | Cabe com folga na duração da função |
| Jitter entre envios | 2 000–5 000 ms | Ritmo humano; 20 envios ≈ 70 s de lote |
| Taxa efetiva resultante | ~120 msg/h | Com o cron de 10 min |
| `maxDuration` do tick | 300 s | Lote de campanha + os doze jobs existentes, com margem |

Uma campanha de 300 pessoas leva ~2 h 30 nesse ritmo. A tela de confirmação diz isso em
horas, não em unidades técnicas.

### 6.4 Proteção da conta do tenant

Tratada em detalhe na §7. Todas as proteções são **limites duros**, sem opção de burlar pelo
tenant — decisão explícita do usuário.

### 6.5 Opt-out

O webhook processa `PARE`, `PARAR`, `SAIR`, `DESCADASTRAR`, `CANCELAR INSCRICAO`
(normalizados: sem acento, caixa baixa, `trim`), marca `marketingOptOut` com data e origem, e
responde confirmando.

Roda **antes** de tudo (§4.3). Transacional continua chegando — opt-out é de marketing, não
do serviço.

**Rodapé de descadastro** anexado automaticamente na primeira mensagem promocional que cada
cliente recebe, ensinando o caminho.

---

## 7. Proteção da conta de WhatsApp do tenant

Seção própria porque é o maior risco do pacote.

### 7.1 A posição honesta

**Não existe garantia de não-banimento.** O Evolution API é uma ponte não-oficial (Baileys /
WhatsApp Web multidispositivo), e disparo em massa por esse canal é exatamente o
comportamento que a Meta pune. Nenhuma técnica elimina o risco — só reduz.

Isso pesa mais aqui do que num SaaS qualquer: **o número banido é o negócio do cliente.** A
dona do salão perde agenda, histórico de conversa e canal de venda de uma vez, e vai atribuir
isso ao produto.

Os números de teto e ritmo definidos abaixo são **heurística de mercado, não limite
documentado pela Meta** — ela não publica thresholds. Devem ser tratados como constantes
ajustáveis, não como verdade.

### 7.2 O que de fato move o ponteiro

O gatilho principal de banimento não é volume: é **taxa de bloqueio e denúncia**. A Meta
reage a pessoas marcando "bloquear" e "denunciar spam". Volume é agravante, não causa raiz.

Daí a ordem de importância das defesas: **quem entra na lista** protege mais que **a que
velocidade se envia**.

### 7.3 As camadas

| # | Camada | Mecanismo |
|---|---|---|
| 1 | **Quem entra** | Só clientes com ≥1 atendimento concluído (§6.2). Nunca a base bruta de contatos importados |
| 2 | **Ritmo** | Lote pequeno por tick, jitter entre envios, **teto diário por instância com curva de aquecimento** (§7.3.1) |
| 3 | **Conteúdo** | Variação da saudação, não só do `{{primeiro_nome}}`. Texto byte-a-byte idêntico para N pessoas é assinatura de robô |
| 4 | **Saída fácil** | Rodapé "responda PARE" e opt-out funcionando de primeira. Contraintuitivo, mas **reduz** banimento: quem consegue sair sem atrito sai em vez de denunciar |
| 5 | **Disjuntor** | Instância caiu no meio da campanha → tudo para na hora, sem retentativa. Reconectar e continuar despejando é como suspensão temporária vira permanente |
| 6 | **Janela** | Horário do tenant, no fuso dele. Fora da janela o lote não roda; retoma no dia seguinte |
| 7 | **Teste obrigatório** | Disparo só habilita após envio de teste para o número do próprio tenant. Editar o corpo invalida o teste |
| 8 | **Serialização** | Uma campanha em execução por tenant (`CampaignAlreadyRunningError`) |
| 9 | **Ciência do risco** | Tela de aceite explícito na primeira campanha do tenant, com o aceite registrado |

Nenhuma dessas camadas protege contra o conteúdo em si: se o tenant escrever algo que as
pessoas denunciam, nenhuma engenharia salva.

#### 7.3.1 Curva de aquecimento — valores de partida

Teto de mensagens **promocionais** por dia, por instância, medido pela idade da conexão
(`Tenant.evolutionConnectedAt`, campo novo — hoje só existe o booleano `evolutionConnected`):

| Idade da conexão | Teto diário |
|---|---|
| Menos de 7 dias | 50 |
| 7 a 30 dias | 150 |
| Mais de 30 dias | 300 |

Número novo disparando centenas no primeiro dia é o perfil clássico de conta queimada. O teto
conta apenas promocional: transacional não entra na cota, porque é resposta a uma ação que o
próprio cliente tomou.

Atingido o teto, a campanha **pausa e retoma no dia seguinte** — nunca falha nem descarta
destinatário. A UI mostra o motivo da pausa.

#### 7.3.2 Anti-fadiga

Máximo de **1 mensagem promocional por cliente por semana** (constante, ajustável). A
contagem é **derivada do `NotificationLog`** — entradas dos últimos 7 dias para aquele
`customerId` cujo evento é promocional segundo o catálogo. Sem contador denormalizado no
`Customer`, que sairia de sincronia.

É o que justifica o índice `(tenantId, customerId, createdAt)` da §4.7.

### 7.4 Abstração de provedor

O ponto de envio da campanha fala com uma interface, não com o `evolutionProvider` direto,
para que a **WhatsApp Business Platform (Cloud API) oficial** entre depois sem reescrever o
motor.

A Cloud API é o que o mercado usa para marketing em escala: templates aprovados pela Meta,
cobrança por conversa, risco de banimento praticamente zero porque o envio é sancionado. O
custo é dinheiro por mensagem e fricção de onboarding (Meta Business verificado e número
dedicado por tenant).

Não está no escopo desta entrega. A abstração custa pouco agora e evita um beco sem saída.

---

## 8. Navegação, permissões e planos

### 8.1 Navegação

Entrada nova **"Mensagens"**, com três abas:

| Aba | Conteúdo |
|---|---|
| Campanhas | Lista, criação, acompanhamento de execução |
| Agendadas | As `ScheduledMessage` da Fase 4, em lista gerenciável |
| Histórico | Leitura do `NotificationLog` filtrado por cliente e evento |

As mensagens agendadas **mantêm** o ponto de entrada na ficha da cliente — ele funciona e é
contextual — e passam a aparecer *também* na aba. Dois caminhos para o mesmo dado, cada um
servindo a um momento de uso diferente.

Os templates permanecem em Configurações › Notificações. Mensagens é operação, não
configuração.

### 8.2 Permissão

Permissão nova **`mensagens`** (`view`/`edit`), seguindo o precedente de `comissoes` e
`descontos`. Sem ela, isto cairia na `configuracoes` genérica, o que daria à recepcionista
poder de disparar para a base inteira.

Registrada em `permission-dependencies.ts` com a dependência **`mensagens:edit` →
`clientes:view`** (não há como segmentar sem enxergar a base).

Conforme o precedente do ADR-016, o `GET` que alimenta a prévia dentro dos modais de
agendamento **não** exige `mensagens:view` — é leitura de apoio consumida por qualquer
colaborador que agenda.

### 8.3 Planos

| Recurso | Gate |
|---|---|
| Motor de templates, toggles por evento, mensagem agendada um-a-um | Todos os planos |
| Confirmação por resposta | `whatsapp_basic` |
| Retorno programado | `whatsapp_basic` |
| Campanhas | `campaigns` — promovida de `soon` para **`ga`**, ligada em PRO/ENTERPRISE |

Promover `campaigns` a `ga` exige atualizar o `capability-registry` e ligar a capability nos
planos PRO/ENTERPRISE em produção via **UPDATE cirúrgico** em `PlanFeatureConfig` — nunca
rodando o seed inteiro (precedente do brief da Onda 0).

---

## 9. Experiência de uso — mobile e desktop

Requisito de primeira classe, não acabamento. Toda tela nova entrega **as duas versões**, e o
checklist do `agent-mobile` é gate obrigatório antes da entrega.

**Princípios herdados da Fase 1, que seguem valendo:**

1. Nunca partir da folha em branco. Todo texto já vem preenchido do catálogo; o tenant edita.
2. "Restaurar padrão" sempre visível onde há personalização.
3. Prévia com dados de exemplo, sem `{{variavel}}` crua na tela.

**Novos, específicos deste pacote:**

4. **A campanha é um fluxo de 3 passos**, não um formulário longo: para quem → o quê →
   confirmar. Cada passo cabe numa tela de celular.
5. **O número aparece antes do compromisso.** Contagem de elegíveis e previsão de término
   ficam visíveis na tela de confirmação, não escondidas atrás do disparo.
6. **A exclusão é explicada.** "127 sem consentimento" com caminho para resolver, nunca um
   total menor sem justificativa.

**Restrições de UI já conhecidas do projeto, que valem para toda tela nova:**

- Todo `DialogContent` precisa de `max-h-[85dvh]` + `overflow-y-auto`.
- `AlertDialog` do Radix não aceita `modal={false}`; para diálogo aninhado, usar `Dialog`
  com `role="alertdialog"`.
- Não usar `touch-pan-x` em faixa rolável horizontal.
- Alvo de toque mínimo de 44 px.

---

## 10. Testes

Conforme o checklist do projeto: service 80 %, repository 60 %, API route 70 %.

**Testes que este pacote exige por serem regressão de bug real:**

- O webhook processa `PARE` **com `autoReplyEnabled` desligado** (§2.1).
- O webhook processa `PARE` **dentro da janela de `autoReplyIntervalHours`** (§2.1).
- Evento transacional é enviado a cliente com `marketingOptOut` ativo (§4.1).
- Evento promocional **não** é enviado a cliente sem `consentGiven` (§4.1).
- `kind: "direct"` não é bloqueado pela guarda promocional (§4.1).
- Aniversário usa o texto do catálogo mesmo com `birthdayMessage` preenchido (§2.3, §4.5).
- Confirmação por resposta com mais de um candidato age no mais próximo **e diz qual** (§5.1).
- Reprocessar um lote de campanha não envia duas vezes para o mesmo destinatário (§6.3).
- Campanha fora da janela de horário do tenant não processa lote (§7.3).

---

## 11. Sequência de entrega e runbook

### 11.1 Sequência

**Fundação → Fase 5 → Fase 3**, em PRs encadeadas para `main`.

A reforma do webhook é pré-requisito das duas fases: o opt-out da 3 e a confirmação 1/2 da 5
entram no mesmo handler, na mesma ordem de prioridade. Fazendo a Fase 5 antes, o webhook
reformado é exercitado por código real e testado antes de as campanhas dependerem dele. E a
Fase 3 — a maior e mais arriscada — fica por último, quando a guarda de consentimento, o
`marketingOptOut` e o opt-out funcionando já existem e estão em uso.

### 11.2 Migration

**Uma única migration** no início do pacote, cobrindo:

| Alvo | O que entra |
|---|---|
| `Customer` | `marketingOptOut`, `marketingOptOutAt`, `marketingOptOutOrigin` (§4.2) |
| `Tenant` | `replyConfirmEnabled`, `replyConfirmInvite` (§5.1), `evolutionConnectedAt` (§7.3.1) |
| `Service` | `returnIntervalDays` (§5.2) |
| Models novos | `Campaign`, `CampaignRecipient` + enums de status (§6.1) |
| `NotificationLog` | os dois índices da §4.7 |

`evolutionConnectedAt` nasce `null` para os tenants existentes. Conexão sem data conhecida é
tratada como **madura** (teto mais alto): o tenant já opera há tempo, e rebaixá-lo ao teto de
instância nova seria degradar um serviço que já funciona. Conexões novas passam a gravar a
data.

Colunas aditivas não usadas não custam nada, e isso troca três janelas manuais de produção
por uma. Este projeto já teve logout global duas vezes por migration atrasada; reduzir o
número de janelas é a mitigação mais barata que existe.

**Nenhum campo novo entra na query de sessão (`/me`)** — regra do projeto, causa conhecida
dos dois incidentes.

### 11.3 Runbook de produção

1. Merge da PR da fundação.
2. `npx prisma migrate deploy` — manual, porta **5432** do Supabase (a 6543 trava em DDL).
3. `npx prisma migrate status` — confirmar limpo.
4. **Sem backfill.** Ausência de registro já significa "usa o padrão" em todas as camadas
   novas, e `marketingOptOut` nasce `false` para todo mundo, que é o comportamento correto.
5. Após o merge da Fase 3: **UPDATE cirúrgico** em `PlanFeatureConfig` ligando `campaigns`
   em PRO/ENTERPRISE. Nunca o seed inteiro.

---

## 12. Riscos

| Risco | Mitigação |
|---|---|
| Banimento da conta de WhatsApp do tenant | §7 inteira. Risco **reduzido, não eliminado** — declarado ao usuário e aceito |
| Campanha nasce com poucos elegíveis por causa do `consentGiven` | §3.3 — três pontos de coleta e prévia que explica a exclusão |
| Registros de consentimento inválidos na base | Ressalva registrada em §3.2, decisão adiada pelo usuário |
| Caixa pré-marcada não é opt-in válido pela LGPD | Ressalva registrada em §3.2, decisão do usuário |
| Timeout do tick com lote de campanha | `maxDuration` explícito (§4.8) e lote dimensionado conservadoramente |
| Volume real dos tenants desconhecido | Constantes configuráveis e previsão de término na UI (§6.3) |

---

## 13. Fora de escopo

- **Reconquista (winback)** — decisão do usuário. O evento fica visivelmente indisponível na
  UI (§5.3).
- **Campanha agendada** (`Campaign` com `scheduledAt`) — a máquina de agendamento é reusada
  pelo motor de campanha, mas a UI de agendar campanha não entra nesta entrega.
- **WhatsApp Business Platform (Cloud API)** — só a abstração de provedor (§7.4).
- **Avaliação pós-atendimento por WhatsApp** — o funil da Onda 1 existe, falta o gatilho.
- **Vaga liberada / lista de espera.**
- **Remoção do Twilio** — código morto, candidato a PR curta própria.
- **Remoção da coluna `Tenant.birthdayMessage`** — migration destrutiva; o campo perde efeito
  (§4.5) mas permanece na tabela.
