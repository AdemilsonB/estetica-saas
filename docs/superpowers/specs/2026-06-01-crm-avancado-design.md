# CRM Avançado — Design Spec

**Data:** 2026-06-01  
**Domínio:** CRM  
**Escopo:** Filtros avançados na lista de clientes, badge VIP automático por ticket médio, ficha de anamnese com template editável e preenchimento por profissional ou cliente via link  
**Referência de UI:** `prompt-ui-crm-estetica.md` (design system Shadcn Nova, mobile-first, Combobox para selects buscáveis)

---

## 1. Funcionalidades

### 1.1 Filtros avançados na lista de clientes

A rota `GET /api/crm/customers` ganha cinco novos query params além dos existentes (`search`, `page`, `pageSize`):

| Parâmetro | Tipo | Comportamento |
|-----------|------|---------------|
| `onlyVip` | `boolean` | filtra `isVip = true` |
| `birthdayMonth` | `1–12` | filtra clientes cujo `birthDate` cai no mês especificado |
| `noAppointmentDays` | `number` | filtra clientes sem agendamento COMPLETED nos últimos N dias |
| `minAvgTicket` | `number` | filtra clientes com ticket médio ≥ R$ N (últimos 12 meses) |
| `hasPendingDebt` | `boolean` | filtra clientes com ≥1 agendamento em `paymentStatus` PENDING ou DEBT |

Filtros `noAppointmentDays`, `minAvgTicket` e `hasPendingDebt` exigem subqueries em Appointments/Transactions — implementados via `prisma.$queryRaw` com `tenantId` obrigatório em todos os predicados.

**UI — FilterBar** (colapsável em mobile):

```
[🔍 Buscar...]  [Só VIPs] [Aniversariantes] [Sem visita: 30d ▾] [Ticket mín ▾] [Com débito]
Filtros ativos: ✕ VIP  ✕ Aniversariantes este mês
```

- Cada filtro ativo renderiza um chip `Badge variant="secondary"` com botão `×` para remover
- "Sem visita" e "Ticket mín" abrem `Popover` com input numérico
- Em mobile: barra colapsa atrás de `Button "Filtros (N)"` onde N = número de filtros ativos
- Hook `useCustomers` recebe todos os novos parâmetros e os passa como query string

### 1.2 Badge VIP automático

**Critério:** top 20% dos clientes do tenant por soma de transactions `INCOME` nos últimos 365 dias.

**Schema — campo novo em `Customer`:**
```prisma
isVip        Boolean   @default(false)
vipUpdatedAt DateTime?
```

**Job pg-boss:**
- Nome: `"vip-sweep"`
- Cron: `"0 2 * * *"` (diário às 2h UTC)
- Lógica por tenant:
  1. Agregar `SUM(amount)` das transactions INCOME por `customerId` nos últimos 365 dias
  2. Calcular percentil 80 (valor mínimo do top 20%)
  3. `UPDATE Customer SET isVip = (totalGasto >= p80), vipUpdatedAt = now()`
- Tenants sem transactions suficientes (< 5 clientes com gasto): nenhum cliente marcado como VIP

**UI — Badge na tabela:**
```tsx
{customer.isVip && (
  <Badge className="gap-1 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
    <Crown className="h-3 w-3" />
    VIP
  </Badge>
)}
```

Coluna "Último atendimento" exibe data relativa (`"há 3 dias"`) com `text-destructive` quando > 60 dias.

---

### 1.3 Ficha de Anamnese

#### 1.3.1 Modelos de dados

**`AnamneseTemplate`** — um por tenant, template global editável:
```prisma
model AnamneseTemplate {
  id          String   @id @default(cuid())
  tenantId    String   @unique
  fields      Json     // FieldDef[]
  linkMessage String?  // template da mensagem WhatsApp ao enviar link
  updatedAt   DateTime @updatedAt
  tenant      Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
}
```

**`FieldDef`** (tipo TypeScript, não model Prisma):
```ts
type FieldDef = {
  id:       string   // slug único, ex: "skin_type"
  label:    string   // ex: "Tipo de pele"
  type:     "text" | "textarea" | "boolean" | "select" | "checkbox"
  options?: string[] // para select e checkbox
  required: boolean
  section:  "basico" | "saude" | "estetico" | "objetivos"
}
```

Campos `select` e `checkbox` com `options.length > 5` renderizam Combobox com busca (estado inicial vazio, lista completa ao focar, filtra ao digitar). Campos com ≤5 opções renderizam lista de checkboxes simples.

**`CustomerAnamnese`** — uma por cliente, com histórico:
```prisma
model CustomerAnamnese {
  id          String    @id @default(cuid())
  tenantId    String
  customerId  String    @unique
  data        Json      // { [fieldId]: value }
  publicToken String    @unique @default(cuid())
  filledAt    DateTime?
  filledBy    String?   // "professional" | "client"
  history     Json      @default("[]") // snapshot[] — máx 10 versões
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  customer    Customer  @relation(fields: [customerId], references: [id], onDelete: Cascade)
  tenant      Tenant    @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@index([tenantId])
  @@index([publicToken])
}
```

`history` é append-only: antes de cada save, o estado atual é empurrado para o array. Máximo 10 snapshots; ao exceder, o mais antigo é descartado.

#### 1.3.2 API routes

| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| `GET` | `/api/crm/anamnese/template` | tenant | busca template do tenant; cria com defaults se não existir |
| `PUT` | `/api/crm/anamnese/template` | tenant | salva template editado + `linkMessage` |
| `GET` | `/api/crm/customers/[id]/anamnese` | tenant | busca anamnese do cliente |
| `PUT` | `/api/crm/customers/[id]/anamnese` | tenant | salva/atualiza anamnese (profissional) |
| `POST` | `/api/crm/customers/[id]/anamnese/send-link` | tenant | envia mensagem WhatsApp com link + `publicToken` |
| `GET` | `/api/anamnese/[publicToken]` | público | carrega template + dados parciais do cliente |
| `POST` | `/api/anamnese/[publicToken]` | público | salva resposta do cliente; marca `filledBy = "client"`; last-write-wins por campo (não merge parcial — substitui `data` completo) |

#### 1.3.3 UI — Perfil do cliente

Nova aba **"Anamnese"** em `/clientes/[id]` ao lado de "Histórico" e "Observações". Ao clicar abre `Sheet side="right"` (600px):

```
┌────────────────────────────────────────────┐
│ Anamnese — Maria Silva      [Enviar link ↗] │
│ Última atualização: profissional · 02/06/26 │
├────────────────────────────────────────────┤
│ ▼ Informações básicas                       │
│   Tipo de pele  [Combobox ▾]               │
│   Fototipo      [Combobox ▾]               │
│   Idade         [___]                       │
│                                             │
│ ▶ Histórico de saúde                        │
│ ▶ Histórico estético                        │
│ ▶ Objetivos e expectativas                  │
│ ▶ Termo de consentimento                    │
├────────────────────────────────────────────┤
│ Salvando... / Salvo ✓          [Fechar]     │
└────────────────────────────────────────────┘
```

- Seções em `Accordion` — uma aberta por vez
- Auto-save com debounce de 2s; indicador de estado ("Salvando..." / "Salvo ✓") no footer
- Botão "Enviar link" abre `Dialog` com `Textarea` pré-preenchido com `linkMessage` do template (editável antes de enviar):

```
┌────────────────────────────────────────────┐
│ Enviar ficha de anamnese                    │
├────────────────────────────────────────────┤
│ Mensagem para Maria Silva:                  │
│ ┌──────────────────────────────────────┐   │
│ │ Olá, Maria! Para oferecer o melhor   │   │
│ │ atendimento, pedimos que preencha    │   │
│ │ sua ficha:                           │   │
│ │ https://app.../anamnese/abc123       │   │
│ └──────────────────────────────────────┘   │
│ [Cancelar]          [Enviar via WhatsApp]   │
└────────────────────────────────────────────┘
```

O link `publicToken` é imutável por cliente — reenviar sempre usa o mesmo token.

#### 1.3.4 UI — Editor de template (Settings → CRM)

Nova aba **"CRM"** na página `/configuracoes` — a `TabsList` passa de `grid-cols-6` para `grid-cols-7` (existem atualmente: Negócio, Horários, Serviços, WhatsApp, Layout, Financeiro):

```
Configurações de anamnese
─────────────────────────
Campos do formulário                          [+ Adicionar campo]

┌─ Informações básicas ─────────────────────────────────┐
│ ⠿ Tipo de pele        select    obrigatório  [✏]  [×] │
│ ⠿ Fototipo            select    obrigatório  [✏]  [×] │
│ ⠿ Idade               text      opcional     [✏]  [×] │
└───────────────────────────────────────────────────────┘
...

Mensagem padrão do link WhatsApp:
┌──────────────────────────────────────────────────────┐
│ Olá, {nome}! Para oferecer o melhor atendimento...   │
│ {link}                                               │
└──────────────────────────────────────────────────────┘

[Restaurar campos padrão]              [Salvar configurações]
```

- `⠿` = drag handle para reordenar dentro da seção (via `@dnd-kit/sortable`)
- Editar campo abre `Dialog`: label, tipo, opções (textarea separado por vírgula quando `select`/`checkbox`), obrigatório, seção
- "Restaurar campos padrão" abre `Dialog` de confirmação destrutiva
- Variáveis disponíveis na mensagem: `{nome}`, `{link}` (documentadas abaixo do textarea)

#### 1.3.5 UI — Página pública `/anamnese/[publicToken]`

Layout sem sidebar, sem autenticação:

```
┌──────────────────────────────────┐
│ [Logo do tenant]                 │
│ Ficha de anamnese                │
│ Estúdio Beleza & Cia             │
├──────────────────────────────────┤
│ Olá! Preencha seus dados abaixo. │
│                                  │
│ ▼ Informações básicas            │
│   [campos do template]           │
│ ▶ Histórico de saúde             │
│ ▶ ...                            │
│                                  │
│ ☑ Li e concordo com os termos   │
│                                  │
│       [Enviar ficha]             │
└──────────────────────────────────┘
```

- Após envio: tela "Ficha recebida! Até logo 🎉"
- Token inválido: página de erro amigável ("Este link não é mais válido.")
- Token não expira — profissional pode reenviar o mesmo link a qualquer momento
- Se a anamnese já foi preenchida pelo cliente: exibe os dados preenchidos em modo somente leitura com opção "Atualizar ficha"

---

## 2. Template padrão de anamnese

O tenant começa com este template ao ter `AnamneseTemplate` criado:

```json
[
  { "id": "skin_type",      "label": "Tipo de pele",           "type": "select",   "options": ["Normal","Seca","Oleosa","Mista","Sensível"], "required": true,  "section": "basico" },
  { "id": "phototype",      "label": "Fototipo (Fitzpatrick)",  "type": "select",   "options": ["I","II","III","IV","V","VI"],               "required": false, "section": "basico" },
  { "id": "age",            "label": "Idade",                   "type": "text",     "options": [],                                           "required": false, "section": "basico" },
  { "id": "allergies",      "label": "Alergias conhecidas",     "type": "checkbox", "options": ["Látex","Níquel","Corantes","Parabenos","Fragrâncias","Nenhuma"], "required": false, "section": "saude" },
  { "id": "medications",    "label": "Uso de medicamentos",     "type": "textarea", "options": [],                                           "required": false, "section": "saude" },
  { "id": "conditions",     "label": "Condições de saúde",      "type": "checkbox", "options": ["Diabetes","Hipertensão","Gestante","Cardiopatia","Nenhuma"],    "required": false, "section": "saude" },
  { "id": "prev_procedures","label": "Procedimentos anteriores","type": "textarea", "options": [],                                           "required": false, "section": "estetico" },
  { "id": "reactions",      "label": "Reações adversas anteriores","type": "textarea","options": [],                                        "required": false, "section": "estetico" },
  { "id": "goals",          "label": "Objetivos",               "type": "checkbox", "options": ["Hidratação","Anti-aging","Clareamento","Firmeza","Relaxamento","Outro"], "required": false, "section": "objetivos" },
  { "id": "consent",        "label": "Termo de consentimento",  "type": "boolean",  "options": [],                                           "required": true,  "section": "objetivos" }
]
```

Mensagem padrão do link:
```
Olá, {nome}! 😊 Para oferecer o melhor atendimento, pedimos que preencha sua ficha de anamnese antes da consulta:

{link}

Qualquer dúvida, estamos à disposição!
```

---

## 3. Hooks e estado frontend

| Hook | Descrição |
|------|-----------|
| `useCustomers(filters)` | atualizado com novos params |
| `useAnamneseTemplate()` | GET + PUT do template do tenant |
| `useCustomerAnamnese(customerId)` | GET + PUT da anamnese do cliente |
| `useSendAnamneseLink(customerId)` | POST send-link |
| `usePublicAnamnese(token)` | GET público — sem autenticação |
| `useSubmitPublicAnamnese(token)` | POST público — sem autenticação |

---

## 4. Fora do escopo

- Campos com upload de foto (antes/depois) — fase futura
- Assinatura digital do termo — fase futura
- Anamnese por tipo de serviço — descartado em favor de template único editável (decisão de design)
- Expiração automática do link público — token imutável por cliente

---

## 5. Checklist de qualidade (conforme design guide)

- [ ] Testado em 375px, 768px e 1280px
- [ ] Todos os ícones com Tooltip ou label visível
- [ ] Skeleton em todos os estados de loading
- [ ] Empty state na lista sem resultados e na anamnese não preenchida
- [ ] Ações destrutivas (restaurar template padrão) com Dialog de confirmação
- [ ] Toasts via Sonner para saves, envio de link e erros
- [ ] Combobox para selects com options.length > 5
- [ ] FilterBar chips removíveis com contador em mobile
- [ ] Auto-save da anamnese com debounce 2s e indicador visual
