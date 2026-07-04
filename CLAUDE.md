# CLAUDE.md — Contexto principal do projeto

> Este arquivo é lido automaticamente pelo Claude Code em toda sessão.
> Contém as regras, padrões e contexto essencial do projeto.

---

## Idioma e comunicação

**Todo output deve ser em Português do Brasil** — código, comentários de código, mensagens de commit, logs, nomes de branch, respostas, perguntas e explicações. Sem exceções.

---

## Autonomia de execução

Quando um prompt de desenvolvimento estiver aprovado e a sessão iniciada, **execute até o fim sem pedir confirmação a cada passo**.

Interrompa e aguarde resposta APENAS nas seguintes situações críticas:
- Vai **deletar dados ou arquivos irreversivelmente**
- Vai **alterar schema do banco em produção** de forma destrutiva (drop de coluna/tabela)
- Identificou **ambiguidade que impede a implementação correta** — não uma dúvida de preferência estética, mas um bloqueio real de lógica de negócio
- O escopo do prompt se mostrou **substancialmente maior** do que o planejado (mais de 2x o estimado)

Em todos os outros casos — criação de arquivos, edição de componentes, migrations aditivas, refatorações dentro do escopo — **execute diretamente e informe o que foi feito ao concluir**.

Ao concluir uma sessão, apresente um resumo em PT-BR:
```
✅ Concluído:
- [o que foi feito]

📁 Arquivos criados/modificados:
- [lista com paths]

⚠️ Pendências (se houver):
- [o que ficou de fora do escopo e por quê]
```

---

## Protocolo obrigatório antes de iniciar qualquer desenvolvimento

**Nunca inicie implementação sem antes estruturar a demanda.**

Use a skill `.claude/skills/agent-onboarding.md` como ponto de entrada para qualquer ideia nova.
Ela conduz a exploração da ideia, propõe abordagens e produz um brief estruturado para o Orchestrator.

**Fluxo completo:**
```
Ideia do usuário
      ↓
agent-onboarding   ← explora intenção, propõe abordagens, estrutura brief
      ↓
orchestrator       ← executa o brief com o pipeline correto de skills
      ↓
[database] → [backend] → [frontend] + [agent-mobile] → [testing + security] → [review] → [documentation]
      ↓
PR aberta para main
```

Só acione o Orchestrator diretamente (sem onboarding) se:
- É um bug com arquivo + comportamento + erro exatos descritos → usar `agent-hotfix`
- É uma mudança pontual e cirúrgica com escopo inequívoco

Só inicie o código após o brief ser aprovado explicitamente pelo usuário.

---

## O que é esse projeto

SaaS operacional para negócios de estética (barbearias, salões, clínicas, estúdios).
Posicionamento: **Vertical AI-Augmented Business Operating System**.
Não é um ERP. Não é uma agenda. É uma plataforma operacional inteligente.

---

## Stack

- **Frontend + Backend**: Next.js 15 App Router + TypeScript
- **Banco**: Supabase (PostgreSQL gerenciado + Auth + Realtime)
- **ORM**: Prisma
- **UI**: Shadcn UI (Nova preset) + TailwindCSS
- **Estado**: Zustand (UI) + TanStack Query (server state)
- **Validação**: Zod
- **Filas**: pg-boss (sobre o PostgreSQL)
- **Deploy**: Vercel (frontend) + Supabase (banco)

---

## Estrutura de pastas

```
src/
├── app/              # Next.js App Router — páginas e API Routes
├── domains/          # Lógica de negócio por domínio (DDD)
│   ├── iam/
│   ├── crm/
│   ├── scheduling/
│   ├── financial/
│   └── notifications/
├── shared/           # Código verdadeiramente compartilhado
│   ├── database/     # Prisma client
│   ├── events/       # Event bus interno
│   ├── errors/       # Erros de domínio tipados
│   └── types/        # Tipos globais
├── components/       # Componentes React
│   ├── ui/           # Shadcn UI
│   └── domain/       # Componentes de domínio
└── lib/              # Utilitários e configurações
```

---

## Regras obrigatórias — SEMPRE seguir

### Multi-tenancy
- Todo model Prisma de negócio tem `tenantId: String`
- Todo repository filtra por `tenantId` em TODAS as queries
- `tenantId` é sempre extraído do token — NUNCA do body ou URL
- Índice `@@index([tenantId])` em toda tabela de negócio

### Arquitetura em camadas
```
API Route (controller fino)
    ↓ valida input com Zod
Service (regras de negócio)
    ↓ usa repository
Repository (acesso a dados)
    ↓ sempre filtra tenantId
Prisma Client
```

### Eventos entre domínios
- Domínios NÃO se importam diretamente
- Comunicação via `eventBus.publish()` em `src/shared/events/`
- Notifications e Automation apenas ESCUTAM eventos

### Erros
- Sempre usar erros de domínio tipados de `src/shared/errors/`
- NUNCA `throw new Error('string genérica')`
- NUNCA retornar `{ error: 'string' }` sem código tipado

### TypeScript
- Strict mode ativado — sem `any`, sem `as unknown as`
- Zod para validação de input em toda API Route
- Tipos de domínio definidos em `domains/[dominio]/types.ts`

---

## Regras — NUNCA fazer

- Lógica de negócio em componentes React
- Queries diretas ao banco em API Routes (sempre via repository)
- Acoplamento direto entre domínios
- Hardcode de IDs, roles ou strings mágicas sem constante
- `console.log` em produção (usar logger estruturado)
- `tenantId` vindo do body da requisição
- Iniciar implementação sem completar o protocolo de perguntas acima
- Considerar uma entrega concluída sem PR mergeada na `main`
- Deixar branch de feature sem mergear ao final da sessão

---

## Padrões de código

Ver `.claude/skills/agent-backend.md` para templates completos de API Route, Repository e Service.

### Padrão de imagens (avatar, serviço, pacote, promoção, produto)

Toda foto de entidade (`User.avatarUrl`, `Service/ServicePackage/Promotion/Product.imageUrl`) tem 3 campos
`imageCropX`/`imageCropY`/`imageCropZoom` (ou `avatarCropX/Y/Zoom` no User) — nullable, `null` = sem ajuste.
- **Nunca** renderizar `<img object-cover>` direto para essas entidades — sempre usar
  `<EntityImage>` (`src/components/domain/shared/entity-image.tsx`), que aplica o crop salvo.
- Para permitir o usuário ajustar o enquadramento, usar `<ImageCropEditor>`
  (`src/components/domain/shared/image-crop-editor.tsx`, baseado em `react-easy-crop`).
- Proporção padrão por tipo: avatar = círculo 1:1, serviço/pacote/promoção = retrato 4:5,
  produto = quadrado 1:1.
- Ao subir uma imagem nova, os 3 campos de crop voltam para `null` automaticamente
  (regra centralizada em `src/shared/utils/image-crop.ts`) — a menos que o crop seja enviado
  junto na mesma chamada (ex: catálogo, onde o formulário salva imagem + crop de uma vez).

---

## Contexto Mobile-First

A maioria dos usuários finais do Agendê acessa via dispositivo móvel.

- Usuários finais: mobile (> 70% do tráfego)
- Gestores / Admins: desktop

Todo desenvolvimento de UI deve seguir mobile-first:
- Breakpoints: base (mobile) → md: (tablet) → lg: (desktop)
- Checklist completo: ver `.claude/skills/agent-mobile.md`
- `agent-mobile` é invocado automaticamente antes de toda entrega de frontend

Nunca entregar componente de UI sem passar pelo checklist do `agent-mobile`.

---

## Status dos domínios (2026-06-24)

| Domínio | Backend | Frontend | Observação |
|---------|---------|----------|------------|
| IAM | ✅ | ✅ | Cargos dinâmicos, RBAC, edição completa de membros, foto com enquadramento (zoom/posição) ajustável, vínculo de serviços; cadastro de novo tenant exige CPF/CNPJ único na plataforma (dígito verificador validado; tenants legados sem documento não são afetados — ADR-013) |
| CRM | ✅ | ✅ | Filtros avançados, badge VIP, anamnese digital; CPF do cliente validado por dígito verificador no cadastro público (`cpfSchema` em `domains/crm/schemas.ts`) — login por CPF não exige dígito válido, só formato, para não travar contas antigas |
| Scheduling | ✅ | ✅ | Agenda semanal, slots, filtro profissional, quick actions mobile; disponibilidade pública respeita `minAdvanceMinutes`/`maxAdvanceDays` da policy (painel não — só bloqueia data passada, com switch "lançar atendimento esquecido" — ADR-014) |
| Financial | ✅ | ✅ | Checkout, despesas, comissões, taxas, estornos |
| Notifications | ✅ | ✅ | **Cliente:** Evolution API primário (WhatsApp), email fallback via Resend, 6 templates. **Equipe (central in-app):** submódulo `user-notifications/` com model próprio `UserNotification` (feed por usuário), sino com bolinha de alerta no topo (MobileHeader + sidebar), painel com filtro por tipo/data + preferências (engrenagem); tipos v1 = novo agendamento, cancelamento, novo cliente, aniversariantes da semana (job pg-boss semanal p/ gestores); destinatários = profissional do atendimento + gestores (OWNER/MANAGER), auto-skip só no painel, origem vitrine via flag `origin` no evento, e-mail opt-in via Resend, polling 30s — ver ADR-015 |
| Dashboard | ✅ | ✅ | Métricas + polling 30s |
| Reports | ✅ | ✅ | 4 páginas (Visão Geral, Financeiro, Agendamentos, Clientes); KPIs com % de variação vs. período anterior; gráficos Recharts (line, donut, heatmap de sazonalidade); filtro de categoria; clientes inativos com ação WhatsApp; paginação server-side; feature gate `reports_advanced` com upsell inline |
| Settings | ✅ | ✅ | Cargos, Meu Link (QR Code, WhatsApp, Instagram) |
| Serviços | ✅ | ✅ | 3 abas: Serviços, Pacotes, Promoções; anamnese por serviço; imagens em proporção retrato 4:5 padronizada com editor de enquadramento (zoom/posição) |
| Produtos/Estoque | ✅ | ✅ | Catálogo, movimentação, reflexo financeiro; imagem com editor de enquadramento (zoom/posição) |
| Branding | ✅ | ✅ | 6 tokens warm, logo |
| Billing (Stripe) | ✅ | ✅ | FeatureGuard, startTrial, Checkout/Portal/Webhook, planos dinâmicos do DB; `Subscription.plan` é a única fonte de verdade (Tenant.plan removido); plano FREE não é mais vendido (`isActive: false`) — trial/assinatura expirada bloqueia o painel via `SubscriptionLockedScreen` em vez de rebaixar para FREE (ver ADR-010) |
| Auth/Onboarding | ✅ | ✅ | Fluxo completo com plano pré-selecionado; signup enxuto (nome, e-mail, CPF do titular, senha) — telefone/CEP movidos para o onboarding; onboarding coleta telefone + documento do negócio + CEP com labels que diferenciam CPF do titular × documento do negócio e reuso opcional do CPF (checkbox "Usar o meu CPF"); backend `register` recebe `ownerPhone`/`zipCode` no corpo com fallback para `user_metadata` (contas legadas); `/login` mobile full-bleed com link "voltar ao site"; conta `isSystemAdmin` é isolada (nunca tem tenant) |
| Vitrine pública | ✅ | ✅ | SSR com revalidate 5min; modal de detalhe (serviço/pacote/promoção), perfil do profissional, filtro por categoria/profissional/preço, próximo horário livre, repetir último agendamento, favoritar serviços/pacotes (persistido), selo "Verificado" para negócio novo; cards de serviço/pacote/promoção em proporção retrato 4:5 com enquadramento (zoom/posição) consistente entre card e modal de detalhe; `maxAdvanceDays` do calendário de agendamento vem da `SchedulingPolicy` do tenant (não mais hardcoded); contato WhatsApp desacoplado da automação paga (`whatsappContactEnabled`, ≠ `whatsappEnabled`); ícones de contato com cor de marca (Instagram com gradiente oficial via `useId`, WhatsApp verde `#25D366`); card de localização com mapa Google embutido (iframe keyless), rota e "Ver no Google", mais selo de nota gated por `GOOGLE_PLACES_API_KEY` (helper `src/lib/google-places.ts`, keyless por padrão) |
| Portal do cliente | ✅ | ✅ | Hub central pós-identificação: login/criação de conta (CPF+nascimento) sempre redireciona pra cá — nunca mais direto pro agendamento. Identidade visual do sistema (gradiente, cards), próximo agendamento, histórico, edição de perfil, info do negócio (endereço/rota/horário de funcionamento por dia); card de localização com mapa Google + "Ver no Google" (compartilhado com a vitrine); contato WhatsApp via `whatsappContactEnabled` |
| Admin (backoffice) | ✅ | ✅ | Painel `/admin` isolado do fluxo de tenant; sidebar mobile responsiva; audit log + rate limiting nas rotas `/api/admin/**`; CRUD de categorias do catálogo global com propagação automática ao ativar para o tenant |
| PWA | ✅ | ✅ | Manifest + SW restrito a assets estáticos + ícones; banner de instalação na `/agenda` a partir do 2º acesso (`agende:agenda-visits` em localStorage), dispensável, oculto se já instalado (`display-mode: standalone`) ou em desktop sem caminho de instalação; modal de passos por plataforma (Android via `beforeinstallprompt`, iOS via Compartilhar → Adicionar à Tela de Início) — hook `usePwaInstall` em `src/components/domain/pwa/` |
| Automation | stub | — | Fase 2 |

## Próximo passo crítico

Produção e escala:
1. Configurar `PUBLIC_SESSION_SECRET` no Vercel (obrigatório para o portal do cliente)
2. **Aplicar a migration `20260704120000_add_user_notifications`** no banco (`prisma migrate deploy` / `resolve --applied`) — criada aditiva mas não aplicada (banco de dev inacessível na sessão da central de notificações)
3. Fase 2 — Automation: regras de pós-atendimento, campanhas de reengajamento
4. Relatórios avançados com filtros por profissional + exportação agendada

---

## Workflow de branches e commits

Ver `.claude/BRANCHING.md` (fonte canônica).

---

## Checklist antes de entregar qualquer feature

- [ ] Branch dedicada criada (`feat/` ou `fix/`)
- [ ] `tenantId` em todo model novo no Prisma
- [ ] Repository com filtro de tenant em todas as queries
- [ ] Service com regras de negócio e publicação de eventos
- [ ] Zod schemas em `domains/[dominio]/schemas.ts` (nunca duplicados no frontend)
- [ ] API Route com `getSessionContext()` e validação Zod
- [ ] Erros tipados para todos os casos de falha
- [ ] Componente com loading state, error state e empty state
- [ ] Checklist mobile-first do `agent-mobile` executado
- [ ] Sem `any` no TypeScript
- [ ] Testes escritos: service (80%), repository (60%), API route (70%)
- [ ] `npx tsc --noEmit` — zero erros
- [ ] `npx vitest run` — todos os testes passando
- [ ] Security Agent executado — nenhum item 🔴 CRÍTICO
- [ ] Pull Request aberta para `main`
- [ ] PR mergeada na `main` — nenhuma entrega é considerada concluída até o merge acontecer

---

## Sistema de Skills — Como usar

O projeto usa **Claude Code Skills** para orquestração de desenvolvimento.
Cada skill é um agente especializado com responsabilidade exclusiva e gate de verificação obrigatório.

**Ponto de entrada:** ver `AGENTS.md` para lista completa de skills e fluxo de invocação.

### Fluxo padrão de desenvolvimento

```
Onboarding → Orchestrator → Database? → Backend → Frontend + Mobile → Testing + Security → Review → Documentation → PR
```

Testing e Security podem rodar em paralelo após o código estar escrito.
Review (gate de build) vem antes de Documentation.
Documentation é executada após o gate verde e antes de abrir o PR.

### Infraestrutura de testes

```
vitest.config.ts                    ← configuração global
src/shared/test/
  ├── setup.ts                      ← mocks globais (Prisma, eventBus)
  ├── prisma-mock.ts                ← DeepMock do PrismaClient
  └── factories/                    ← fixtures por entidade
      ├── tenant.factory.ts
      ├── user.factory.ts
      ├── customer.factory.ts
      ├── appointment.factory.ts
      └── transaction.factory.ts
```

---

## Arquivos de contexto complementares

- `AGENTS.md` — mapa de agents e lista completa de skills
- `.claude/BRANCHING.md` — workflow de branches, commits e PRs (fonte canônica)
- `.context/PATTERNS.md` — padrões detalhados de código
- `.context/CONVENTIONS.md` — naming conventions
- `docs/decisions.md` — decisões arquiteturais (ADRs)
