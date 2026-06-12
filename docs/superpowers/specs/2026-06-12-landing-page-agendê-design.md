# Spec — Landing Page Agendê

**Data:** 2026-06-12
**Status:** Aprovado
**Rota:** `/` (raiz pública)

---

## Contexto e objetivo

O produto não tem landing page. A raiz (`/`) não existe. O objetivo desta página é converter visitantes em clientes pagantes, levando-os até a página de planos (`/planos`).

**Produto:** Agendê — plataforma operacional para salões de beleza
**Público-alvo primário:** Donas de salão de beleza (não tech-savvy, decidem pela emoção e pelo resultado concreto)
**CTA principal:** "Ver Planos e Preços" → redireciona para `/planos`
**CTA secundário:** "Criar conta grátis" na navbar → redireciona para `/register`
**Contato direto:** Botão WhatsApp flutuante → abre conversa no número de suporte

---

## Stack e localização

- **Arquivo principal:** `src/app/(public)/page.tsx` (Server Component, sem auth)
- **Layout público:** `src/app/(public)/layout.tsx` (já existe — wrapper simples)
- **Componentes novos:** `src/components/domain/landing/` (pasta dedicada)
- **Stack visual:** Shadcn UI + TailwindCSS + gradiente roxo-rosa (`#7c3aed` → `#db2777`)
- **Fontes:** Inter (já carregada no layout raiz)
- **Sem estado global** — página 100% estática, zero client state

---

## Direção visual

| Atributo | Valor |
|---|---|
| Fundo hero | Gradiente suave `#faf5ff → #fdf2f8` |
| Cor primária | `#7c3aed` (roxo) |
| Cor secundária | `#db2777` (rosa) |
| Gradiente principal | `linear-gradient(135deg, #7c3aed, #db2777)` |
| Fundo seções alternas | `#fff` / `#faf5ff` |
| Tipografia heading | Inter 800 |
| Tipografia body | Inter 400/500 |
| Border radius padrão | `10–14px` nos cards |

---

## Estrutura de seções

### 1. Navbar (sticky)

- **Logo:** "Agendê" com gradiente roxo-rosa
- **Links de navegação:** Funcionalidades · Depoimentos · Planos (scroll suave para âncoras)
- **Ações direita:**
  - `Entrar` — ghost button com borda, link para `/login`
  - `Criar conta grátis →` — botão gradiente primário, link para `/register`
- **Comportamento:** sticky no topo, `z-index` alto, fundo branco com `box-shadow` sutil

---

### 2. Hero

- **Badge:** pill com "✨ Plataforma #1 para salões de beleza"
- **Headline (H1):** "Seu salão no **piloto automático.** Você foca nas clientes."
  - Parte em destaque usa gradiente via `background-clip: text`
- **Subtítulo:** "Agenda online, WhatsApp automático e controle financeiro — tudo em um só lugar. Sem planilha. Sem telefone tocando."
- **CTAs:**
  - Principal: `Ver Planos e Preços →` (gradiente, grande)
  - Secundário: `▶ Ver como funciona` (texto roxo, ancora na seção Como Funciona)
- **Screenshot:** mockup do dashboard com barra de browser fake, sidebar escura e cards de agendamento — dados de demonstração (não real-time)
- **Nota técnica:** o screenshot é um componente HTML/CSS estático com dados hardcoded de demonstração, não uma imagem. Substituível por screenshot real no futuro.

---

### 3. Barra de Prova Social

Faixa branca com até 4 métricas em grid. **Todos os valores vêm do banco** — sem hardcode.

**Estratégia de dados:**
- Métricas configuráveis pelo admin via tabela `LandingMetric` (ver modelo abaixo)
- Se não houver métricas cadastradas, a seção inteira é omitida (sem placeholder)
- O admin define `value` (ex.: "+1.200"), `label` (ex.: "salões ativos") e `order`

```prisma
model LandingMetric {
  id        String   @id @default(cuid())
  value     String   // "+1.200", "-40%", "4.9★"
  label     String   // "salões ativos", "de faltas com lembretes"
  order     Int      @default(0)
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

Query na page:
```typescript
const metrics = await prisma.landingMetric.findMany({
  where: { isActive: true },
  orderBy: { order: 'asc' },
})
// se metrics.length === 0 → não renderiza a seção
```

---

### 4. Cinco Ganhos com Screenshots

Âncora: `#funcionalidades`

Título da seção: "Tudo que seu salão precisa, num só lugar"

Cinco blocos em layout alternado (texto esquerda/screenshot direita, depois invertido):

| # | Ícone | Título | Métrica destaque |
|---|---|---|---|
| 1 | 📅 | Agenda online 24 horas | +30% de agendamentos no primeiro mês |
| 2 | 💬 | WhatsApp automático | -40% de faltas e no-shows |
| 3 | 💰 | Controle financeiro em tempo real | Decisões baseadas em dados, não em chute |
| 4 | ❤️ | Fidelização automática | Clientes retornam 2x mais rápido |
| 5 | 🚫 | Zero faltas com lembretes inteligentes | Até 40% menos faltas garantidas |

Cada bloco tem:
- Ícone grande (emoji ou Lucide icon)
- Título H3
- Parágrafo descritivo (2–3 linhas)
- Pill de métrica com gradiente sutil
- Placeholder de screenshot (retângulo estilizado) — substituir por screenshot real quando a UI estiver polida

**Nota técnica:** os placeholders de screenshot são `div` estilizadas com gradiente. A estrutura aceita `<Image>` do Next.js para substituição futura sem refatoração.

---

### 5. Como Funciona

Âncora: `#como-funciona`

Fundo gradiente suave. Três passos em grid 3 colunas:

1. **Cria sua conta** — Cadastro em 2 minutos. Adiciona seus profissionais e serviços.
2. **Compartilha o link** — Coloca no Instagram, no WhatsApp e na bio. Suas clientes já podem agendar.
3. **O Agendê trabalha por você** — Lembretes, confirmações e relatórios automáticos. Você foca no atendimento.

Cada passo tem número em círculo com gradiente, título bold e descrição curta.

---

### 6. Depoimentos

Âncora: `#depoimentos`

**Todos os depoimentos vêm do banco** — zero conteúdo fictício ou hardcoded.

```prisma
model LandingTestimonial {
  id        String   @id @default(cuid())
  authorName  String          // "Fernanda Lemos"
  authorRole  String          // "Salão Bella Donna · SP"
  quote       String          // texto do depoimento
  rating      Int     @default(5)  // 1–5 estrelas
  avatarUrl   String?          // URL de foto real (opcional)
  order       Int     @default(0)
  isActive    Boolean @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

Query na page:
```typescript
const testimonials = await prisma.landingTestimonial.findMany({
  where: { isActive: true },
  orderBy: { order: 'asc' },
})
// se testimonials.length === 0 → seção inteira é omitida
```

Cada card exibe:
- Estrelas conforme `rating`
- Citação em itálico (`quote`)
- Avatar: `<Image src={avatarUrl}>` se fornecido, caso contrário círculo com gradiente e inicial do nome
- Nome + cargo/salão/cidade

**Regra:** a seção só renderiza se houver pelo menos 1 depoimento ativo. O admin cadastra via painel de administração (`/admin`).

---

### 7. CTA Final para Planos

Banner com fundo gradiente roxo-rosa full-width:
- Headline: "Pronto para deixar o Agendê trabalhar por você?"
- Subtítulo: "Planos a partir de R$X/mês · 14 dias grátis · Sem cartão de crédito"
- Botão branco: "Escolher meu plano →" → `/planos`

O preço "R$X/mês" deve ser puxado dinamicamente do plano mais barato ativo no banco (`Plan.price` onde `Plan.name = 'STARTER'`), igual ao que `/planos` já faz.

---

### 8. Footer

Fundo `#1e1b4b` (azul-escuro):
- Logo "Agendê" em branco
- Links: Termos de Uso · Política de Privacidade
- Copyright

---

### 9. Botão WhatsApp Flutuante (global)

- **Posição:** `fixed`, `bottom: 28px`, `right: 28px`, `z-index: 999`
- **Aparência:** círculo verde `#25d366`, ícone WhatsApp, animação `pulse` sutil
- **Tooltip:** "Fale conosco pelo WhatsApp" (aparece ao hover ou sempre visível)
- **Badge:** número "1" em vermelho — decorativo e estático, simula mensagem pendente para chamar atenção visual
- **Comportamento:** abre `https://wa.me/[NUMERO]` em nova aba
- **Número:** variável de ambiente `NEXT_PUBLIC_WHATSAPP_SUPPORT_NUMBER`
- **Visibilidade:** presente em toda a landing page, some na navbar de `/app` e `/admin`

---

## Componentes a criar

Todos em `src/components/domain/landing/`:

| Componente | Responsabilidade |
|---|---|
| `LandingNav` | Navbar sticky com logo, links e botões de auth |
| `LandingHero` | Hero com headline, CTAs e screenshot mockup |
| `LandingProofBar` | Faixa de 4 métricas de prova social |
| `LandingFeatures` | 5 blocos alternados de ganhos |
| `LandingHowItWorks` | 3 passos |
| `LandingTestimonials` | Grid de depoimentos |
| `LandingPricingCTA` | Banner CTA para planos (aceita `starterPrice` como prop) |
| `LandingFooter` | Footer com links |
| `WhatsAppFloatButton` | Botão flutuante global (vive em `src/components/domain/landing/`) |

---

## Dados dinâmicos

**Toda informação exibida vem do banco — sem hardcode de conteúdo.** A page faz 3 queries paralelas:

```typescript
// src/app/(public)/page.tsx
const [starterPlan, metrics, testimonials] = await Promise.all([
  prisma.plan.findFirst({
    where: { name: 'STARTER', isActive: true },
    select: { price: true },
  }),
  prisma.landingMetric.findMany({
    where: { isActive: true },
    orderBy: { order: 'asc' },
  }),
  prisma.landingTestimonial.findMany({
    where: { isActive: true },
    orderBy: { order: 'asc' },
  }),
])
```

| Dado | Usado em | Comportamento se vazio |
|---|---|---|
| `starterPlan.price` | `LandingPricingCTA` | Oculta linha de preço, exibe só "14 dias grátis" |
| `metrics[]` | `LandingProofBar` | Seção inteira omitida |
| `testimonials[]` | `LandingTestimonials` | Seção inteira omitida |

## Novos models Prisma necessários

```prisma
model LandingMetric {
  id        String   @id @default(cuid())
  value     String   // ex: "+1.200", "-40%"
  label     String   // ex: "salões ativos"
  order     Int      @default(0)
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model LandingTestimonial {
  id          String   @id @default(cuid())
  authorName  String
  authorRole  String   // "Salão Bella Donna · SP"
  quote       String
  rating      Int      @default(5)
  avatarUrl   String?
  order       Int      @default(0)
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

**Nota:** estes models não têm `tenantId` — são dados globais da plataforma, gerenciados pelo superadmin em `/admin`.

---

## Variáveis de ambiente necessárias

```env
NEXT_PUBLIC_WHATSAPP_SUPPORT_NUMBER=5511999999999
```

---

## Scroll suave

Links de navegação (#funcionalidades, #como-funciona, #depoimentos) usam scroll suave via CSS:

```css
html { scroll-behavior: smooth; }
```

---

## Responsividade

| Breakpoint | Ajuste |
|---|---|
| Mobile (`< 768px`) | Navbar vira menu hambúrguer; features em coluna única; steps em coluna única |
| Tablet (`768–1024px`) | Features em 2 colunas; steps mantém 3 |
| Desktop (`> 1024px`) | Layout completo conforme wireframe |

---

## O que NÃO está no escopo desta spec

- Analytics / pixel de rastreamento (fase futura)
- A/B testing de headlines
- Chat ao vivo (só WhatsApp por enquanto)
- Blog ou conteúdo SEO
- Internacionalização
- Screenshots reais do produto (usar placeholders estilizados por enquanto — estrutura pronta para `<Image>`)
- Painel de admin para cadastrar métricas e depoimentos (as tabelas existem, o CRUD no admin é escopo separado)
