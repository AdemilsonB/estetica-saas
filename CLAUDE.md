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
| IAM | ✅ | ✅ | Cargos dinâmicos, RBAC, edição completa de membros, foto com enquadramento (zoom/posição) ajustável, vínculo de serviços; cadastro de novo tenant exige CPF/CNPJ único na plataforma (dígito verificador validado; tenants legados sem documento não são afetados — ADR-013); página Equipe ganhou botão dedicado de Comissões (saiu de Serviços) com grid editável por serviço/profissional + aplicar em massa por cargo, permissão extra própria `comissoes` (`view`/`edit`, antes coberto pela `configuracoes` genérica); tenant novo é semeado com um único cargo padrão "Profissional" (`buildSoleProfessionalPermissions()` em `nav-registry.ts`) com todas as permissões liberadas exceto gerenciar outros membros da equipe (só `view` em `equipe` — editar o próprio perfil independe de permissão de cargo); tenants existentes não são afetados retroativamente; modal "Convidar membro" ganhou botão "+" para criar cargo personalizado com permissões sem sair do convite (só visível ao dono, já que criar/editar cargo exige `isOwner`); card de membro simplificado — sem prévia textual de permissões/serviços, só os links "Ver permissões" e "Configurar Serviços" (abre o modal de edição já rolado até a seção de serviços); **consolidação de RBAC (ADR-016, 2026-07-15):** `permission-dependencies.ts` expande automaticamente permissões implícitas ao salvar cargo (ex.: `agenda:create`→`clientes:view`+`servicos:view`; `financeiro:edit`→`descontos:view`), com aviso no editor quando algo é adicionado; fallback legado de `session.ts` deixou de ser tabela hardcoded e passou a ser computado a partir do `nav-registry.ts` (nunca mais diverge); script `scripts/backfill-rbac-consistency.ts` (`npm run rbac:backfill`, rodar uma vez em produção) atribui `roleId` a usuários legados sem cargo e cura cargos salvos incoerentes; editor de cargo deixa explícito que criar/editar cargo é exclusivo do dono (decisão confirmada, não migrou para permissão de `equipe`) |
| CRM | ✅ | ✅ | Filtros avançados, badge VIP, anamnese digital; CPF do cliente validado por dígito verificador no cadastro público (`cpfSchema` em `domains/crm/schemas.ts`) — login por CPF não exige dígito válido, só formato, para não travar contas antigas |
| Scheduling | ✅ | ✅ | Agenda semanal, slots, filtro profissional, quick actions mobile; disponibilidade pública respeita `minAdvanceMinutes`/`maxAdvanceDays` da policy (painel não — só bloqueia data passada, com switch "lançar atendimento esquecido" — ADR-014); picker de serviço do agendamento (`service-picker-with-categories.tsx`, compartilhado entre painel e vitrine pública) usa o mesmo card visual (foto 4:5, nome, linha de composição/descrição, preço, duração) para Serviço, Pacote e Promoção — "Todos" mostra só Serviços, Pacotes/Promoções só aparecem ao filtrar pelo chip "Pacotes e Promoções" ou pela busca; cada card tem ícone de olho flutuante (canto superior esquerdo da imagem, alvo de toque 44×44) que abre `PickerDetailModal` (`picker-detail-modal.tsx`) com o detalhe completo (descrição sem corte, composição com duração por item, preço/desconto) e atalho para selecionar direto do modal; promoção expande ao tocar o card para escolher qual serviço incluso agendar; corrigido bug em que selecionar um Serviço avulso na vitrine pública após ter escolhido uma Promoção mantinha o `promotionId` anterior aplicado por baixo dos panos (`handleServiceSelect` em `booking-client.tsx` não limpava `promotionId`/`packageId`) — painel interno já limpava certo, serve de referência; corrigido bug antigo em que promoção de serviço avulso agendada pela vitrine pública perdia o desconto (`promotionId` não era repassado ao `createAppointment` em `api/public/[slug]/appointments/route.ts`) |
| Financial | ✅ | ✅ | Checkout, despesas, comissões, taxas, estornos |
| Notifications | ✅ | ✅ | **Cliente:** Evolution API primário (WhatsApp), email fallback via Resend, 6 templates. **Motor de notificações da equipe (PR #277 backend + PR #278 UI, 2026-07-13/14):** dispatcher genérico orientado a `eventType` (substitui `notifyAppointment`/`notifyCustomerCreated`) cobrindo agendamento criado/cancelado/reagendado/no-show + novo cliente; 3 models novos (`TenantNotificationSetting`, `UserNotificationPreference`, `NotificationTemplate`) + 2 enums + campos de anti-fadiga no `User`; e-mail nunca mais inline — enfileirado via `pg-boss` (`team-notification-email`) e entregue pelo `/api/cron/tick`; resolvedor de canais puro (negócio ∩ override do colaborador, quiet hours e cálculo de "hoje" sempre no fuso do tenant, nunca no fuso do processo); motor de templates com `{{variaveis}}`, escape de HTML e fallback para templates padrão do sistema; resumo diário roda às 08:00 no fuso local do tenant (corrigido na PR #278, era fixo em UTC) + consolidado anti-fadiga do modo digest. **Aba Configurações › Notificações** (PR #278): sub-abas "Avisos do negócio" (matriz evento × canal in-app/e-mail, permissão `configuracoes:edit`, editor de mensagem com chips `{{variavel}}` + prévia ao vivo) e "Minhas preferências" (modo tempo-real/digest, quiet hours, e-mail por evento, sempre do próprio usuário); painel antigo de 3 switches removido, sino e Configurações linkam pra cá. ~~Limitação conhecida: cargo customizado sem permissão `configuracoes:view` vê "Minhas preferências" vazio~~ **resolvido em 2026-07-15 (ADR-016):** `GET /api/notifications/team-settings` deixou de exigir `configuracoes:view` — é leitura pura consumida por todo colaborador para montar a própria aba pessoal; a permissão continua exigida só no `PATCH` (alterar configuração do negócio). Os 3 booleans legados do `User` continuam funcionando (dual-write) — remoção, seed de defaults por cargo no convite, e hora do resumo configurável ficam para fase futura. Migration `20260713180000_add_team_notification_settings` e o script de backfill já foram aplicados em produção. |
| Dashboard | ✅ | ✅ | Métricas + polling 30s |
| Reports | ✅ | ✅ | 4 páginas (Visão Geral, Financeiro, Agendamentos, Clientes); KPIs com % de variação vs. período anterior; gráficos Recharts (line, donut, heatmap de sazonalidade); filtro de categoria; **filtro por profissional (seleção única, `ReportProfessionalFilter`) em Financeiro/Agendamentos/Clientes + heatmap de sazonalidade — o backend já aceitava `professionalId`, foi só UI; Visão Geral fica de fora (não agrega por profissional) — #188 parte 1**; clientes inativos com ação WhatsApp; paginação server-side; feature gate `reports_advanced` com upsell inline. Pendente: exportação agendada (#188 parte 2, ainda não iniciada) |
| Settings | ✅ | ✅ | Cargos, Meu Link (QR Code, WhatsApp, Instagram) |
| Serviços | ✅ | ✅ | 3 abas: Serviços, Pacotes, Promoções (sub-aba de Precificação/Comissões removida — migrou para a página Equipe); botão dedicado de Descontos no header abre lista editável de tipos de desconto, permissão extra própria `descontos` (`view`/`edit`, antes coberto pela `configuracoes` genérica); anamnese por serviço; imagens em proporção retrato 4:5 padronizada com editor de enquadramento (zoom/posição); tipo de desconto pode ser arquivado, reativado ou excluído — exclusão física só quando nunca usado em nenhum agendamento (`Appointment.discountTypeId`), senão bloqueia com `DiscountTypeInUseError` e força arquivar (soft delete) |
| Produtos/Estoque | ✅ | ✅ | Catálogo, movimentação, reflexo financeiro; imagem com editor de enquadramento (zoom/posição) |
| Branding | ✅ | ✅ | 6 tokens warm, logo |
| Billing (Stripe) | ✅ | ✅ | FeatureGuard, startTrial, Checkout/Portal/Webhook, planos dinâmicos do DB; `Subscription.plan` é a única fonte de verdade (Tenant.plan removido); plano FREE não é mais vendido (`isActive: false`) — trial/assinatura expirada bloqueia o painel via `SubscriptionLockedScreen` em vez de rebaixar para FREE (ver ADR-010) |
| Auth/Onboarding | ✅ | ✅ | Fluxo completo com plano pré-selecionado; signup enxuto (nome, e-mail, CPF do titular, senha) — telefone/CEP movidos para o onboarding; onboarding coleta telefone + documento do negócio + CEP com labels que diferenciam CPF do titular × documento do negócio e reuso opcional do CPF (checkbox "Usar o meu CPF"); backend `register` recebe `ownerPhone`/`zipCode` no corpo com fallback para `user_metadata` (contas legadas); `/login` mobile full-bleed com link "voltar ao site"; conta `isSystemAdmin` é isolada (nunca tem tenant) |
| Vitrine pública | ✅ | ✅ | SSR com revalidate 5min; modal de detalhe (serviço/pacote/promoção), perfil do profissional, filtro por categoria/profissional/preço, próximo horário livre, repetir último agendamento, favoritar serviços/pacotes (persistido), selo "Verificado" para negócio novo; cards de serviço/pacote/promoção em proporção retrato 4:5 com enquadramento (zoom/posição) consistente entre card e modal de detalhe; `maxAdvanceDays` do calendário de agendamento vem da `SchedulingPolicy` do tenant (não mais hardcoded); contato WhatsApp desacoplado da automação paga (`whatsappContactEnabled`, ≠ `whatsappEnabled`); ícones de contato com cor de marca (Instagram com gradiente oficial via `useId`, WhatsApp verde `#25D366`); card de localização com mapa Google embutido (iframe keyless), rota e "Ver no Google", mais selo de nota gated por `GOOGLE_PLACES_API_KEY` (helper `src/lib/google-places.ts`, keyless por padrão); visibilidade em 2 níveis — `SchedulingPolicy.allowPublicBooking` desliga só o agendamento (catálogo continua navegável, CTAs de "Agendar" somem em toda a vitrine incl. drawer/sheets) e `Tenant.publicPageEnabled` fecha a vitrine inteira (mostra página "indisponível", bloqueia `availability`/`appointments` públicas); toggle "Vitrine pública ativa" no card Página Pública das Configurações, com confirmação ao desligar; Portal do Cliente não é afetado por nenhum dos dois; cabeçalho da vitrine tem **atalho do cliente logado** (iniciais, `VitrineAccountButton`, nas duas variantes com/sem banner) sempre visível para o próprio perfil, e o card "Olá, {nome}" do menu lateral ganhou o rótulo "Ver meu perfil"; **carrosséis horizontais não usam mais `touch-pan-x`** — a classe gerava `touch-action: pan-x` e travava o scroll vertical da página no mobile quando o gesto começava sobre um carrossel (deixar `touch-action: auto` faz o navegador distinguir sozinho gesto horizontal × vertical); **selo "Mais procurado" (#169):** badge nos cards de Serviço e Pacote calculado por volume real de agendamento (`findMostBookedItem` no `public-booking.repository.ts` — 90 dias, status CONFIRMED/COMPLETED, mínimo 5, no máximo 1 selo na vitrine inteira entre serviços e pacotes; exposto como `mostBooked` no payload SSR, recalculado no ISR de 5min, sem cron; nunca valor fixo); no card de serviço o selo empilha verticalmente com o badge "Ficha" (anamnese) sem sobrepor |
| Portal do cliente | ✅ | ✅ | Hub central pós-identificação. **Login do portal é só por CPF** (a data de nascimento deixou de ser exigida como "senha"; cadastro de primeira vez segue completo). **Redirect pós-login/cadastro vai para a vitrine pública `/${slug}`, não mais para o portal** (reverte a decisão anterior de sempre cair no portal — usuário preferiu a vitrine como destino); o portal continua acessível pelo atalho de perfil (iniciais) no topo/menu da vitrine. Identidade visual do sistema (gradiente, cards); bloco **Meus Dados no topo** (primeiro bloco do perfil, antes de próximo agendamento/histórico); próximo agendamento, histórico, edição de perfil, info do negócio (endereço/rota + **horário de funcionamento recolhido por padrão**, expande ao clicar); card de localização com mapa Google + "Ver no Google" (compartilhado com a vitrine); contato WhatsApp via `whatsappContactEnabled`. (Foto de perfil do cliente foi implementada e depois removida a pedido do usuário — evitava depender de migration nova; se voltar, não acoplar os campos de foto à query de sessão `/me`.) |
| Admin (backoffice) | ✅ | ✅ | Painel `/admin` isolado do fluxo de tenant; sidebar mobile responsiva; audit log + rate limiting nas rotas `/api/admin/**`; CRUD de categorias do catálogo global com propagação automática ao ativar para o tenant; **painel de sinais de crescimento na home (#252):** ranking de capacidades bloqueadas mais clicadas (lê `CapabilityInterestLog`, 90 dias, top 10 — dado que já era coletado desde a Fase B e nunca lido) + tenants perto do limite (usa `getTenantUsage`, só assinaturas ACTIVE/TRIALING com algum limite ≥80%), via `getGrowthSignals`/`/api/admin/growth-signals`; **guard de sanidade da config de planos (#254):** `getPlanConfigWarnings` (`/api/admin/plans/sanity`) detecta monotonicidade quebrada entre planos (ordem maior com limite menor) e capability `status:'soon'` vendável, exibido como banner **não-bloqueante** no editor de plano; reforço server-side no `PUT` de features força capability `essential` a permanecer `enabled:true` (reusa `ESSENTIAL_KEYS` canônico do `capability-registry`, alinhado ao ADR-016) |
| PWA | ✅ | ✅ | Manifest + SW restrito a assets estáticos + ícones; banner de instalação na `/agenda` a partir do 2º acesso (`agende:agenda-visits` em localStorage), dispensável, oculto se já instalado (`display-mode: standalone`) ou em desktop sem caminho de instalação; modal de passos por plataforma (Android via `beforeinstallprompt`, iOS via Compartilhar → Adicionar à Tela de Início) — hook `usePwaInstall` em `src/components/domain/pwa/` |
| Automation | stub | — | Fase 2 |

## Próximo passo crítico

Produção e escala:
1. Configurar `PUBLIC_SESSION_SECRET` no Vercel (obrigatório para o portal do cliente)
2. Fase 2 — Automation: regras de pós-atendimento, campanhas de reengajamento
3. Relatórios avançados com filtros por profissional + exportação agendada

> ✅ 2026-07-10: todas as migrations pendentes (`add_transaction_type_paidat_index`, `add_public_trust_fields`, `add_user_notifications`, `add_capability_interest_log`, `add_public_page_enabled`) foram sincronizadas em produção — `prisma migrate status` limpo.
> ✅ 2026-07-10: `scripts/seed-plan-features-comissoes-descontos.mjs` rodado em produção (Comissões/Descontos liberados nos 4 planos) — o script estava desatualizado (`new PrismaClient()` sem adapter, quebrava com `PrismaClientInitializationError`); corrigido para usar `PrismaPg` como os demais seeds do projeto.
> ⚠️ 2026-07-13: PR #277 (motor de notificações da equipe) mergeando com migration `20260713180000_add_team_notification_settings` **pendente de aplicação manual** — rodar em produção `npx prisma migrate deploy` **imediatamente seguido** de `node scripts/backfill-team-notification-preferences.mjs` (mesma janela, nesta ordem — ver runbook no ADR-015 em `docs/decisions.md`). Sem isso, usuários existentes recebem e-mail de agendamento mesmo com a preferência antiga desligada.
> ⚠️ 2026-07-15: consolidação de RBAC (ADR-016) — rodar em produção **uma vez** após o deploy: `npm run rbac:backfill` (`scripts/backfill-rbac-consistency.ts`). Sem schema change, sem urgência de janela específica (o fallback sincronizado já cobre o caso em runtime), mas atribui `roleId` a usuários legados sem cargo e corrige cargos salvos com combinações de permissão incoerentes (ex.: `agenda:create` sem `clientes:view`).

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
