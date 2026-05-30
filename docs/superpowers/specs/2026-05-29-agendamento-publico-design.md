# Spec — Página de Agendamento Público

> **Data:** 2026-05-29  
> **Status:** Aprovado — pronto para plano de implementação  
> **Referência competitiva:** [Análise competitiva](../research/2026-05-29-analise-competitiva-saloes.md)  
> **URL pública:** `/agendar/[slug]`  
> **Escopo:** página de booking público + fluxo de orçamento + painel interno de orçamentos

---

## 1. Visão Geral

A página `/agendar/[slug]` é o **ponto de contato público** entre o salão e seus clientes finais. É acessada via:

- Link na bio do Instagram do salão
- Link no WhatsApp de confirmação/lembrete (já referenciado nos templates Twilio)
- QR code no balcão do salão
- Pesquisa direta no navegador

O sistema já referencia essa URL nos templates Twilio (`APP_URL/agendar/${tenant.slug}`). A página não existe — é a próxima entrega crítica.

### Dois caminhos a partir do mesmo ponto de entrada

```
Cliente acessa /agendar/[slug]
        │
        ▼
  Escolhe o serviço
        │
   ┌────┴──────────────────┐
   │                       │
Preço fixo / range    "Solicitar orçamento"
   │                       │
   ▼                       ▼
Agendamento direto    Formulário de orçamento
(steps 3–6)               │
                           ▼
                   Profissional notificada
                   (WhatsApp + painel)
                           │
                           ▼
                   Cliente recebe orçamento
                   via WhatsApp
                           │
                           ▼
                   Aceita → retorna para
                   agendamento direto
                   com dados pré-preenchidos
```

---

## 2. Caminho 1 — Agendamento Direto

### Step 1 — Vitrine do salão *(sempre visível, não colapsável)*

Cabeçalho fixo no topo da página — branding do tenant aplicado automaticamente via SSR (zero flash).

| Elemento | Fonte de dados |
|---|---|
| Logo | `Tenant.logoUrl` |
| Nome | `Tenant.name` |
| Cores, fonte, border-radius | `Tenant.brandingConfig` |
| Horário de hoje | `Tenant.businessHours` (dia da semana atual) |
| Endereço | `Tenant.address` (se preenchido) |

Exibe badge "Aberto agora" / "Abre às Xh" conforme horário do dia. Timezone do tenant respeitado.

### Step 2 — Escolha do serviço

Grid de cards agrupados por categoria.

**Card de serviço:**
- Nome do serviço
- Duração estimada (`Service.durationMinutes`)
- Preço conforme `Service.priceType`:
  - `FIXED` → "R$ 80"
  - `RANGE` → "A partir de R$ 80"
  - `ON_CONSULTATION` → "Sob consulta"
- Botão primário: "Agendar" (todos os tipos)
- Botão secundário: "Solicitar orçamento" (sempre disponível como alternativa — leva ao Caminho 2)

Serviços com `priceType: ON_CONSULTATION` têm o botão "Agendar" substituído por "Solicitar orçamento" como ação principal.

### Step 3 — Escolha da profissional

- Card especial "Qualquer disponível" sempre em primeiro — exibe próximo horário livre entre todas as profissionais
- Cards das profissionais: foto, nome, especialidade
- **Pulado automaticamente** se o salão tiver apenas 1 profissional ativa

### Step 4 — Data e horário

- Calendário compacto dos próximos 30 dias
- Dias sem nenhuma vaga disponível: desabilitados em tempo real
- Dias com vaga: clicável
- Ao selecionar o dia: exibe grade de slots no horário de trabalho da profissional
- Slots já ocupados, bloqueados ou fora do horário: ocultos (não desabilitados — menos confuso)
- Validação via `SchedulingService.getAvailableSlots()` já existente

### Step 5 — Identificação do cliente

- Nome completo
- Telefone com máscara BR `(00) 00000-0000`
- Ao preencher telefone: lookup assíncrono em `Customer` por `phone`
  - Se encontrado: "Bem-vinda de volta, [Nome]! Confirmar com esse número?" → pré-preenche nome
  - Se não encontrado: fluxo normal
- **Zero cadastro. Zero senha. Zero fricção.**
- Observações opcionais (campo textarea)

### Step 6 — Confirmação e sucesso

- Resumo: serviço, profissional, data, hora, salão
- Botão: "Confirmar agendamento"
- Após confirmar:
  - Cria `Appointment` via `POST /api/public/[slug]/appointments`
  - Cria ou atualiza `Customer` por telefone
  - Dispara WhatsApp de confirmação (template `appointment-created` já existente)
  - Exibe tela de sucesso com resumo
  - Links opcionais: "Adicionar ao Google Calendar" / "Adicionar ao Apple Calendar"

---

## 3. Caminho 2 — Solicitação de Orçamento

### Formulário de orçamento

Substitui os steps 3–6 quando o cliente escolhe "Solicitar orçamento".

**Campos base (todos os serviços):**
- Nome completo
- Telefone WhatsApp (com máscara)
- Resultado desejado (textarea livre)
- Data preferida — range: "Entre [data início] e [data fim]"
- Foto atual do cabelo/área (upload, **opcional**)
- Observações adicionais (textarea, **opcional**)

**Campos adaptativos por categoria de serviço:**

| Campo | Coloração | Corte | Tratamento | Unhas |
|---|---|---|---|---|
| Comprimento do cabelo | ✅ | ✅ | ✅ | ❌ |
| Cor atual | ✅ | ❌ | ❌ | ❌ |
| Porcentagem de fios brancos | ✅ | ❌ | ❌ | ❌ |
| Histórico de química | ✅ | ❌ | ✅ | ❌ |
| Extensão (unhas) | ❌ | ❌ | ❌ | ✅ |

As categorias dos serviços vêm do campo `Service.category` já existente no schema.

**Após envio:**
- Cria `Quote` com status `PENDING`
- Faz upload das fotos para Supabase Storage (se enviadas)
- Exibe tela: "Orçamento enviado! Responderemos em breve via WhatsApp para [telefone mascarado]"
- Dispara WhatsApp de notificação para a profissional/salão

### Notificação WhatsApp → profissional

Template Twilio (`TWILIO_TPL_QUOTE_REQUEST` — novo template a criar):

```
🆕 Nova solicitação de orçamento

Cliente: {1}
Serviço: {2}
Detalhes: {3}
Data preferida: {4}

📎 Ver e responder:
{5}
```

O link `{5}` leva a `/orcamentos/[id]/responder?token=[jwt-assinado]` — abre formulário de resposta sem necessidade de login completo (token de curta duração, 72h).

### Formulário de resposta da profissional (via link)

Página simples e mobile-first — a profissional acessa pelo celular:

- Resumo da solicitação (dados do cliente, serviço, fotos se enviadas)
- Campos de resposta:
  - Valor estimado: único (R$ ___) ou faixa (R$ ___ a R$ ___)
  - Duração estimada
  - Observações para o cliente
  - Validade do orçamento (padrão 48h, ajustável)
- Botão: "Enviar orçamento" / "Não posso atender"

### Notificação WhatsApp → cliente

Template Twilio (`TWILIO_TPL_QUOTE_SENT` — novo template a criar):

```
Olá, {1}! ✨

Seu orçamento para {2}:

💰 {3}
⏱️ Duração estimada: {4}
📝 {5}

Válido por {6}. Para agendar:
👉 {7}
```

O link `{7}` = `/agendar/[slug]?quote=[id]` — pré-preenche serviço, profissional e dados do cliente. O cliente só escolhe a data e confirma.

### Expiração de orçamentos

Job pg-boss `quote:expire-sweep` (diário, similar ao `billing:expire-sweep`):
- Busca quotes com `status: SENT` e `validUntil < now()`
- Atualiza para `status: EXPIRED`
- Envia WhatsApp ao cliente: "Seu orçamento expirou. Quer solicitar um novo?"

---

## 4. Painel Interno — Gestão de Orçamentos

Nova seção no painel do salão acessível em `/configuracoes/orcamentos` ou como item no menu principal.

### Lista de orçamentos

- Filtros: Pendente / Enviado / Aceito / Expirado / Todos
- Ordenação: mais recentes primeiro
- Card por orçamento:
  - Avatar com inicial do cliente
  - Nome, serviço solicitado, data da solicitação
  - Status em badge colorido
  - Tempo decorrido ("há 2h", "há 1 dia")
  - Botão de ação rápida: "Responder" / "Ver detalhes"
- Badge de urgência: orçamentos `PENDING` com mais de 2h sem resposta em destaque (borda laranja)

### Detalhe do orçamento

- Dados completos da solicitação
- Galeria de fotos enviadas pelo cliente (se houver)
- Formulário inline de resposta (sem abrir nova página)
- Histórico de status (timeline)
- Botão: "Converter para agendamento" quando `status: ACCEPTED`

---

## 5. Modelo de Dados

### Tabela `Quote` (nova)

```prisma
model Quote {
  id            String      @id @default(cuid())
  tenantId      String
  serviceId     String
  professionalId String?

  // Cliente
  customerName   String
  customerPhone  String
  customerId     String?

  // Detalhes da solicitação
  desiredResult      String
  hairLength         String?
  currentColor       String?
  whiteHairPercent   String?
  chemistryHistory   String?
  nailExtension      String?
  photoUrls          String[]
  preferredDateStart DateTime?
  preferredDateEnd   DateTime?
  notes              String?

  // Resposta da profissional
  status            QuoteStatus @default(PENDING)
  estimatedPriceMin Decimal?    @db.Decimal(10, 2)
  estimatedPriceMax Decimal?    @db.Decimal(10, 2)
  professionalNotes String?
  validUntil        DateTime?

  // Conversão
  appointmentId String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  tenant       Tenant       @relation(fields: [tenantId], references: [id])
  service      Service      @relation(fields: [serviceId], references: [id])
  customer     Customer?    @relation(fields: [customerId], references: [id])
  appointment  Appointment? @relation(fields: [appointmentId], references: [id])

  @@index([tenantId])
  @@index([tenantId, status])
}

enum QuoteStatus {
  PENDING    // Aguardando resposta da profissional
  SENT       // Orçamento enviado ao cliente
  ACCEPTED   // Cliente aceitou
  DECLINED   // Profissional não pode atender
  EXPIRED    // Prazo de validade vencido
  CONVERTED  // Convertido em agendamento
}
```

### Campo novo em `Service`

```prisma
priceType   PriceType @default(FIXED)
priceMin    Decimal?  @db.Decimal(10, 2)
priceMax    Decimal?  @db.Decimal(10, 2)

enum PriceType {
  FIXED           // Preço fixo (usa price existente)
  RANGE           // Faixa: priceMin–priceMax
  ON_CONSULTATION // Sob consulta
}
```

---

## 6. Rotas de API

### Públicas (sem auth, com rate limiting)

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/api/public/[slug]` | Dados do salão: nome, logo, cores, serviços, profissionais, horários |
| `GET` | `/api/public/[slug]/availability` | Slots disponíveis por data + serviceId + professionalId? |
| `POST` | `/api/public/[slug]/appointments` | Criar agendamento (sem auth) |
| `POST` | `/api/public/[slug]/quotes` | Criar solicitação de orçamento (sem auth) |
| `GET` | `/api/public/quotes/[id]/respond` | Renderizar formulário de resposta (token JWT) |
| `POST` | `/api/public/quotes/[id]/respond` | Salvar resposta + disparar WhatsApp ao cliente |
| `POST` | `/api/public/quotes/[id]/accept` | Cliente aceita → cria agendamento |

### Privadas (auth obrigatória)

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/api/quotes` | Listar orçamentos do tenant (com filtros) |
| `GET` | `/api/quotes/[id]` | Detalhe do orçamento |
| `PATCH` | `/api/quotes/[id]` | Atualizar status (DECLINED) |

### Novos templates Twilio (a criar)

| Variável de ambiente | Uso |
|---|---|
| `TWILIO_TPL_QUOTE_REQUEST` | Notificação para profissional — nova solicitação |
| `TWILIO_TPL_QUOTE_SENT` | Orçamento enviado ao cliente |
| `TWILIO_TPL_QUOTE_EXPIRED` | Aviso de expiração ao cliente |

---

## 7. Segurança e Abuso

- Rate limiting por IP: 5 agendamentos/hora, 3 orçamentos/hora
- Rate limiting por telefone: 3 agendamentos/dia, 2 orçamentos/dia
- Token JWT de resposta de orçamento: assinado com `QUOTE_RESPONSE_SECRET`, TTL 72h
- Upload de foto: máximo 5MB, tipos permitidos: `image/jpeg`, `image/png`, `image/webp`
- Dados do cliente em rotas públicas: nunca retornar email, CPF ou dados sensíveis — apenas nome e telefone mascarado
- Slug de tenant: não expõe `tenantId` — lookup seguro por slug único

---

## 8. Performance e UX

- SSR no servidor para branding zero-flash (logo, cores, fontes do tenant)
- Disponibilidade de slots: SWR com revalidação a cada 30s (evita agendamento duplo)
- Otimistic UI no step de confirmação — feedback imediato, rollback em erro
- Mobile-first: todos os steps testados em viewport 375px
- Imagens das profissionais com `loading="lazy"` e placeholder de avatar
- Calendário: carrega apenas o mês atual, próximo mês sob demanda

---

## 9. Fora do Escopo (próximas fases)

- Pagamento Pix pré-agendamento (Fase 2)
- Chatbot WhatsApp conversacional para booking (Fase 3 — Twilio Studio)
- Avaliações/reviews na página pública (Fase 4)
- Landing page do produto / página de marketing do SaaS (spec separado)

---

## 10. Critérios de Aceite

- [ ] `/agendar/[slug]` exibe logo, cores e fontes do tenant sem flash (SSR)
- [ ] Agendamento completo em menos de 60 segundos no celular
- [ ] Slots atualizados em tempo real — sem conflito de horário
- [ ] Cliente retornante reconhecido por telefone
- [ ] Orçamento enviado ao cliente via WhatsApp em menos de 5 minutos após resposta da profissional
- [ ] Painel de orçamentos filtra por status e exibe urgência
- [ ] Rate limiting bloqueia abuso sem afetar uso legítimo
- [ ] Zero erros TypeScript (`npx tsc --noEmit`)
- [ ] Testes: service 80%, rotas públicas 70%

---

*Próximo passo: invocar `writing-plans` para criar o plano de implementação faseado*
