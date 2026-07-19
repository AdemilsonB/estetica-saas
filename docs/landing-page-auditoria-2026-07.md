# Landing page do Agendê — diagnóstico e referência (2026-07-15)

> Documento de apoio para o redesign da landing pública (`/`) e da rota `/planos`.
> Cobre: estado atual (copy, estrutura, cores, planos), problemas identificados e
> um resumo de boas práticas de mercado para inspirar o novo layout.
> **Não é um plano de implementação** — é a base factual para a sessão de
> `agent-onboarding` que vai estruturar o brief do redesign.

---

## 1. Estrutura atual da landing (`/`)

Arquivo: [src/app/(public)/page.tsx](../src/app/(public)/page.tsx)
Componentes: [src/components/domain/landing/](../src/components/domain/landing/)

Ordem de seções: `LandingNav` → `LandingHero` → `LandingProofBar` → `LandingFeatures`
→ `LandingBranding` → `LandingHowItWorks` → `LandingTestimonials` → `LandingPlans`
→ `LandingPricingCTA` → `LandingFooter` → botão flutuante de WhatsApp.

### Nav
Sticky, com blur/shadow ao rolar. Logo → `/`. Links `#funcionalidades`,
`#como-funciona`, `/planos` (só desktop). CTAs sempre visíveis: `/login`
("Entrar") e `/login?tab=signup` ("Começar grátis").

### Hero — [landing-hero.tsx](../src/components/domain/landing/landing-hero.tsx)
- Badge: "✨ Feito para salões, barbearias e clínicas"
- **H1: "Pare de perder cliente no telefone tocando. Sua agenda no piloto automático."**
- Subheadline: "Agenda online, WhatsApp automático e financeiro em tempo real —
  tudo num lugar só. Sem planilha, sem telefone tocando."
- CTAs: "Começar trial grátis →" / "Ver planos e preços"
- Microtrust: "✓ sem cartão de crédito · {trialDays} dias grátis"
- Mockup de dashboard **recriado em JSX/CSS** (não é screenshot real): sidebar
  fake, 3 métricas fictícias (47 agendamentos, R$2.840, 3 faltas evitadas), 3
  cards de agendamento fictícios.

### Proof bar
Vem do banco (`LandingMetric`). Seed atual: `+1.200 salões ativos`,
`98% satisfação`, `-40% menos faltas`, `24h suporte humano`. Some se vazio.

### Features (`#funcionalidades`)
H2: "Tudo que seu salão precisa, num só lugar". 5 blocos alternados
(texto + mockup fiel em JSX) — Agenda 24h, WhatsApp automático, Financeiro,
Fidelização, Anti-falta — cada um com uma métrica de impacto ("+30%
agendamentos", "-40% faltas" etc.). Bloco final "E tem muito mais incluído"
com 5 mini-cards: Anamnese digital, Portal do cliente, Catálogo & estoque,
Marca personalizável, App no celular (PWA).

### Branding
Único bloco com **framer-motion** de verdade: seletor de 5 cores que recolore
ao vivo um mockup de vitrine fictícia ("Studio Bella"). H2: "Sua marca, do
seu jeito".

### Como funciona (`#como-funciona`)
3 passos: criar conta → compartilhar link → "o Agendê trabalha por você".

### Depoimentos
Vem do banco (`LandingTestimonial`). 3 depoimentos seedados, sem foto real
(iniciais/avatar genérico), com nome, salão, cidade, nota 5★.

### Planos
Cards de `PricingToggle`/`SharedPlanCard`, cada um leva para `/login?plan=X`.
FAQ inline (5 perguntas). Link "Ver comparação completa dos planos →" → `/planos`.

### CTA final + Footer
Faixa gradiente violeta→rosa: "Pronto para deixar o Agendê trabalhar por
você?". Footer com links `/planos`, **`/termos`, `/privacidade` (rotas
inexistentes — links mortos, ver §5)**.

---

## 2. Rota `/planos`

Arquivo: [src/app/(public)/planos/page.tsx](../src/app/(public)/planos/page.tsx)

Header próprio, sem herdar o `LandingNav`:

```tsx
<header className="border-b border-slate-200 bg-white px-4 py-4">
  <span className="font-semibold text-slate-900">Estética SaaS</span>
  <a href="/login">Entrar</a>
</header>
```

Problemas already confirmados no código:
- **Sem link/botão de volta para `/`** — nem no header, nem em nenhum outro
  ponto da página. Depende 100% do botão "voltar" do navegador.
- Texto do header é **"Estética SaaS"**, não "Agendê" — nome genérico
  dessincronizado do resto do produto.
- FAQ quase duplicada da FAQ que já existe em `LandingPlans` na home.

Comparar com `/login`, que já resolve isso bem: 4 ocorrências de
`<Link href="/" aria-label="Voltar ao site">`.

---

## 3. Cores do sistema

Não há `tailwind.config.js` — Tailwind v4 CSS-first, tokens em
[src/app/globals.css](../src/app/globals.css) via `@theme inline` + `:root`/`.dark`.

### Tokens globais do produto (`:root`, light)

| token | valor |
|---|---|
| `--background` | `#FAFAFA` |
| `--foreground` | `#111827` |
| `--primary` | `#7C3AED` (violeta) |
| `--secondary` / `--muted` / `--accent` | `#F5F3FF` |
| `--secondary-foreground` / `--accent-foreground` | `#7C3AED` |
| `--muted-foreground` | `#6B7280` |
| `--border` / `--input` | `#EDE9FE` |
| `--ring` | `#7C3AED` |
| `--chart-1..5` | `#7C3AED`, `#DB2777`, `#A855F7`, `#EC4899`, `#6D28D9` |
| `--radius` | `0.625rem` |

`.dark` usa `oklch()` (ex.: `--primary: oklch(0.75 0.2 293)`).

A landing usa ainda cores inline fora desses tokens: gradiente hero
`#FAF8FF → #F0EBFF → #FCE8F3`, CTAs em `violet-600 → pink-600`.

**Diagnóstico:** violeta + rosa em gradiente é a paleta *default* de dezenas
de SaaS (Linear, Notion-likes, todo template de landing "AI SaaS" no
Tailwind UI/shadcn). Não é errada, mas não é **distintiva** — não ajuda a
"não parecer um SaaS comum brasileiro" (ver §6).

### Os "6 tokens warm" (branding do tenant — não confundir com os tokens acima)

Definidos em
[branding-form.tsx:56-63](../src/components/domain/settings/branding-form.tsx)
e [build-css-variables.test.ts:61-72](../src/lib/branding/build-css-variables.test.ts):

| token | valor default |
|---|---|
| `primaryColor` | `#c8916a` |
| `accentColor` | `#fdf0e8` |
| `backgroundColor` | `#faf7f4` |
| `borderColor` | `#e8ddd3` |
| `foregroundColor` | `#3d2b1f` |
| `mutedColor` | `#8a7060` |

Essa é a paleta que cada **tenant** pode personalizar (não é a cor da
landing/marketing do Agendê em si) — convertida para `oklch()` via
`src/lib/branding/build-css-variables.ts`, com opções de fonte (Inter,
Manrope, Geist, DM Sans, Plus Jakarta Sans, Lato) e `borderRadius`
(none/medium/full).

---

## 4. Planos e preços

Fonte de verdade: banco (models `Plan`, `PlanFeatureConfig`,
`PlanLimitConfig`), não hardcode na landing. Seed em
`scripts/seed-admin-data.ts`.

| Plano | Preço/mês | Vendido? | Destaque |
|---|---|---|---|
| Free | R$ 0 | ❌ não vendido (`isActive: false`) | — |
| Starter | R$ 49,90 | ✅ | 5 profissionais, 300 agend./mês, WhatsApp automático, página pública, relatórios + CSV, estoque |
| **Pro** | R$ 89,90 | ✅ | **badge "popular"**, 20 profissionais, 2.000 agend./mês, WhatsApp premium (chatbot, aniversário), relatórios avançados, até 3 unidades |
| Enterprise | R$ 159,90 | ✅ | ilimitado em tudo, WhatsApp ilimitado, suporte prioritário |

`trialDays` = 14 (do plano Starter, usado como referência em toda a landing).

Feature gates reais (travam de verdade — ver memória `planos-gating-fase2`):
`whatsapp_basic`, `reports_advanced` e o item de navegação "Relatórios".
`whatsapp_premium`, `campaigns` e `multi_unit` são **placeholders** (ainda
não há funcionalidade por trás) — cuidado para não prometer na landing algo
que ainda não existe de fato.

---

## 5. Problemas identificados (diagnóstico técnico)

1. **Headline principal fraca** ("Pare de perder cliente no telefone
   tocando...") — descreve uma dor genérica de agenda/telefone, comum a
   qualquer software de agendamento (Trinks, Booksy, SimplesAgenda etc.).
   Não comunica o diferencial de posicionamento que o próprio `CLAUDE.md`
   define para o produto: **"Vertical AI-Augmented Business Operating
   System... não é uma agenda"**. Hoje a landing vende exatamente "uma
   agenda com WhatsApp", o oposto do posicionamento pretendido.
2. **`/planos` é um beco sem saída** — sem link de volta para `/`, nome
   "Estética SaaS" no header (dessincronizado do nome "Agendê" usado em
   todo o resto). Confirmado em código, não é impressão.
3. **Links mortos no footer**: `/termos` e `/privacidade` não existem como
   rotas — caem na rota dinâmica de vitrine `[slug]` e provavelmente
   resolvem como "negócio não encontrado" em vez de 404 ou conteúdo real.
4. **Pouca prova social real**: depoimentos são só texto + nome + cidade,
   sem foto, sem link/verificação, sem logo do negócio. Números da proof
   bar (`+1.200 salões ativos`) não têm fonte/comprovação visível.
5. **"Mockups" são ilustrações JSX, não o produto real** — dá para ver isso
   ao inspecionar (fontes, proporções, dados fictícios óbvios como "Ana
   Silva"). Reduz confiança porque parece maquete, não prova de que o
   software funciona.
6. **Nenhuma demonstração do app mobile** — apesar de o próprio CLAUDE.md
   apontar que >70% do tráfego dos usuários finais é mobile, a landing não
   mostra em nenhum momento como é usar o Agendê no celular (nem cliente
   agendando pela vitrine, nem o PWA instalado). É citado só como texto
   ("App no celular") num mini-card.
7. **Quase nenhuma animação/dinâmica real** — só `LandingBranding` usa
   framer-motion de fato. O resto é hover/transition estático e um único
   `@keyframes pulse-slow` no botão de WhatsApp. Não há scroll-reveal,
   parallax sutil, contadores animados na proof bar, nem transição entre
   seções — a página "não respira".
8. **Paleta genérica de SaaS** (violeta/rosa gradiente) — visualmente
   indistinguível de templates prontos de landing "AI SaaS", o que reforça
   a sensação de "mais um SaaS brasileiro genérico" em vez de um produto
   com identidade própria de nicho (beleza/estética).

---

## 6. Boas práticas de mercado — para inspirar, não copiar

Referência para a fase de brainstorming/onboarding do redesign. Ideia central:
o que faz um SaaS **não parecer** "SaaS brasileiro genérico" não é
tecnologia nova, é a combinação de especificidade + prova real + atrito
zero perceptível.

### Posicionamento e copy
- **Headline vende resultado específico do nicho, não a categoria de
  software.** "Agenda online" é categoria; "salões que usam o Agendê faturam
  X% a mais" ou "sua cliente agenda em 30 segundos sem trocar mensagem" é
  resultado. Empresas como Linear, Superhuman, Cal.com vendem a
  transformação ("inbox zero de verdade", "linear é rápido"), não a feature.
- **Falar a língua de quem realmente usa** (dona de salão, barbeiro), não a
  de quem vende SaaS B2B genérico. Trocar "agenda no piloto automático"
  (jargão de growth) por algo que soe como o que a própria cliente diria.
- **Um inimigo claro e específico**, não "sem planilha, sem telefone
  tocando" (clichê do setor inteiro). Ex.: nomear a dor mais visceral —
  cliente que desmarca em cima da hora, agenda furada de sexta à noite.
- **Evitar emoji-badge no topo do hero** ("✨ Feito para...") — é o
  tell-tale sign mais reconhecível de landing gerada por template/IA em
  2025-26. Selo de confiança funciona melhor como texto sóbrio + ícone real
  (CNPJ verificado, nota de satisfação real, número de negócios ativos com
  link auditável).

### Prova social
- Depoimento forte tem **foto real, nome completo, negócio com link
  clicável para a vitrine pública dele** (o Agendê já tem vitrine pública —
  dá pra linkar o depoimento à prova viva do produto rodando, algo que
  concorrentes não conseguem fazer facilmente).
- Números soltos (+1.200 salões) sem fonte parecem inflados. Melhor: métrica
  amarrada a um período ("nos últimos 90 dias") ou a algo verificável.
- Case detalhado (1 cliente, com antes/depois de agenda real, mesmo que
  anonimizado) converte mais que 3 depoimentos genéricos de uma linha.

### Demonstração do produto (o maior gap hoje)
- **Trocar mockup JSX fake por captura real do produto** — screen recording
  curto (3-6s, loop, sem áudio) do fluxo real de agendamento pela vitrine
  pública, ou screenshot real com blur nos dados sensíveis. Produtos que
  "não parecem SaaS genérico" (Cal.com, Linear, Notion) mostram o produto
  de verdade, com imperfeições reais, não uma maquete perfeita demais.
- Como o público final é majoritariamente mobile, vale um bloco específico
  "veja como sua cliente agenda pelo celular" com frame de smartphone real
  mostrando a vitrine pública de um tenant de exemplo.
- Demo interativa ou vídeo de 30-60s vale mais que 5 seções de texto
  descrevendo feature por feature.

### Dinâmica e microinterações (sem exagerar)
- Scroll-reveal sutil (fade+slide de 8-16px, `duration` curto,
  `IntersectionObserver`, respeitando `prefers-reduced-motion` — já há
  precedente de fazer isso certo em `LandingBranding`) em vez de tudo
  aparecer estático de uma vez.
- Contador animado na proof bar (números "sobem" ao entrar em viewport) —
  efeito barato de implementar, alto impacto percebido.
- Microinteração em CTA principal (leve scale/glow no hover, nunca
  bounce/exagero) reforça "produto vivo" sem parecer brinquedo.
- Uma seção com transição de estado real (ex.: mensagem de WhatsApp
  "chegando" na tela, com animação de digitação) comunica automação melhor
  que texto descritivo.

### Navegação e confiança básica (higiene, não é "boa prática de mercado",
  é o mínimo esperado)
- Toda rota de marketing secundária (`/planos`, futura `/termos` etc.)
  precisa de volta óbvia para `/` — sem depender do botão do navegador.
- Nome do produto consistente em 100% dos headers/footers (`Agendê`, nunca
  "Estética SaaS").
- Termos de Uso e Política de Privacidade reais e publicados — ausência
  disso é sinal de alerta de confiança para qualquer visitante mais atento,
  e é exigência prática para checkout (Stripe) e LGPD.

### Precificação
- Card "popular" já existe (Pro) — reforçar com prova de que é a escolha
  mais comum ("70% dos novos negócios começam aqui"), não só um badge
  visual.
- Toggle mensal/anual com desconto visível costuma converter mais que preço
  único fixo — verificar se `PricingToggle` já suporta isso ou é só
  estético hoje.

---

## 7. Onde este documento se conecta ao workflow do projeto

Este `.md` é insumo factual. O próximo passo (por protocolo do
`CLAUDE.md`) é rodar `agent-onboarding` para transformar os pontos do §5 e
§6 em um brief estruturado de redesign — decidindo, com o usuário, quais
mudanças entram no escopo (copy, animação, navegação, prova social, demo
mobile) antes de qualquer implementação.
