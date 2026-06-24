# CODEX.md — Contexto completo para Codex CLI

> Cole este arquivo no início de qualquer sessão no Codex.
> Contém o fluxo de trabalho, regras e contexto do projeto.

---

## Idioma e comunicação

**Todo output em Português do Brasil** — código, commits, logs, nomes de branch, respostas. Sem exceções.

---

## Protocolo obrigatório antes de qualquer implementação

### Regra de ouro: NUNCA inicie código sem completar o onboarding

Antes de escrever qualquer linha de código para uma ideia nova, execute o protocolo abaixo.

**Pode pular o onboarding apenas se:**
- É um bug com arquivo + linha + comportamento + erro exatos descritos
- É uma mudança pontual inequívoca (ex: "muda o label do botão X para Y")

---

## Protocolo de onboarding (execute sempre nesta ordem)

### Passo 1 — Leitura de contexto interna (antes de perguntar)

Antes de qualquer pergunta, verifique mentalmente:

```
Domínios DDD afetados:
  → iam / crm / scheduling / financial / notifications / billing / automation

Estado atual de cada domínio:
  → Backend implementado? Frontend implementado? (ver tabela de status abaixo)
  → É nova feature ou extensão do existente?

Arquivos relevantes já existentes:
  → Existe service, repository, componente ou hook que resolve parte disso?
  → Existe schema Prisma para as entidades envolvidas?

Restrições de plano (billing):
  → A feature é restrita por plano? Qual plano mínimo?
  → Afeta o FeatureGuard?
```

### Passo 2 — Entender o "porquê" (primeira pergunta)

Sempre comece com a motivação, não com detalhes técnicos.

Exemplos:
- "O que te fez pensar nessa ideia? Qual problema você quer resolver?"
- "Quem vai usar isso — o dono do salão, o profissional ou o cliente final?"
- "Você já tem uma imagem do fluxo? Me descreve como seria."

**Regra crítica: UMA pergunta por mensagem. Sempre. Sem exceção.**
Múltiplas perguntas fazem o usuário responder superficialmente.

### Passo 3 — Exploração progressiva (uma pergunta por vez)

Após entender o porquê, explore em sequência conforme necessário:

**Sobre o usuário e o fluxo:**
- Quem usa? Qual é o fluxo antes, durante e depois?
- Existe algum caso de erro que precisa de tratamento especial?

**Sobre o escopo:**
- É algo novo ou extensão do que já existe?
- Afeta mais de um domínio? Como eles se comunicam?
- Tem alguma regra específica do setor de estética que preciso saber?

**Sobre restrições:**
- Tem prazo ou dependência com outra feature?
- Deve funcionar em todos os planos ou só a partir de algum?

**Sobre sucesso:**
- Como saberemos que funcionou? Estado atual vs estado desejado?

**Pare de perguntar** quando conseguir descrever a feature em 2-3 frases precisas.

### Passo 4 — Propor 2-3 abordagens com trade-offs

```
Com base no que entendi, vejo N formas de implementar:

**Opção A — [nome curto]**
[descrição em 1-2 frases]
Trade-off: [o que ganha e o que perde]

**Opção B — [nome curto]**
[descrição em 1-2 frases]
Trade-off: [o que ganha e o que perde]

**Opção C — [nome curto]** ← minha recomendação
[descrição em 1-2 frases]
Trade-off: [o que ganha e o que perde]

Recomendo C porque [motivo específico ao contexto do projeto].
```

### Passo 5 — Apresentar brief estruturado e aguardar aprovação

```markdown
## Brief de desenvolvimento

**Feature:** [nome claro]
**Motivação:** [o porquê — em 1 frase]
**Usuário principal:** [quem usa]

**O que será feito:**
- [item 1]
- [item N]

**O que NÃO está no escopo:**
- [item excluído e motivo]

**Domínios afetados:** [lista]
**Restrição de plano:** [se houver]
**Complexidade estimada:** simples (<30min) / médio (1-3h) / complexo (>3h)
**Dependências:** [o que precisa existir antes]

---
Posso iniciar a implementação com este brief?
```

**Aguarde confirmação explícita antes de escrever código.**

---

## Pipeline de execução (após brief aprovado)

Execute nesta ordem, validando cada etapa antes de avançar:

```
[database?] → backend → frontend → testing + security → review → PR
```

| Etapa | Condição | Gate de validação |
|---|---|---|
| Database | Schema Prisma novo/alterado | `npx prisma validate && npx prisma generate` sem erro |
| Backend | Lógica de negócio nova/alterada | `npx tsc --noEmit` sem erros na área modificada |
| Frontend | Interface nova/alterada | `npx tsc --noEmit` sem erros de tipo |
| Testing | Sempre | `npx vitest run` — todos passando |
| Security | Sempre | Nenhum item CRÍTICO em aberto |
| Review (gate final) | Sempre | `npx tsc --noEmit` + `npx vitest run` — projeto inteiro verde |

Se validação falha → não avança. Corrige antes de prosseguir.

---

## Autonomia de execução

Após o brief aprovado, **execute até o fim sem pedir confirmação a cada passo**.

Interrompa APENAS em:
- Vai deletar dados/arquivos irreversivelmente
- Vai alterar schema em produção de forma destrutiva (DROP COLUMN/TABLE)
- Ambiguidade real que impede a implementação correta (não dúvida de preferência)
- Escopo se mostrou mais de 2× maior que o estimado

Em todos os outros casos — **execute diretamente e informe ao concluir**.

---

## Sobre o projeto

SaaS operacional para negócios de estética (barbearias, salões, clínicas, estúdios).
Posicionamento: **Vertical AI-Augmented Business Operating System**.

### Stack

- **Frontend + Backend**: Next.js 15 App Router + TypeScript
- **Banco**: Supabase (PostgreSQL gerenciado + Auth + Realtime)
- **ORM**: Prisma
- **UI**: Shadcn UI (Nova preset) + TailwindCSS
- **Estado**: Zustand (UI) + TanStack Query (server state)
- **Validação**: Zod
- **Filas**: pg-boss (sobre o PostgreSQL)
- **Deploy**: Vercel + Supabase

### Estrutura de pastas

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

## Regras absolutas — SEMPRE seguir

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
- Tipos de domínio em `domains/[dominio]/types.ts`

---

## Regras — NUNCA fazer

- Lógica de negócio em componentes React
- Queries diretas ao banco em API Routes (sempre via repository)
- Acoplamento direto entre domínios
- Hardcode de IDs, roles ou strings mágicas sem constante
- `console.log` em produção (usar logger estruturado)
- `tenantId` vindo do body da requisição
- Iniciar implementação sem o brief aprovado
- Considerar entrega concluída sem PR mergeada na `main`

---

## Padrões de código

### API Route

```typescript
export async function POST(req: Request) {
  try {
    const tenantId = await withTenant(req)
    const input = await validateInput(req, CreateXSchema)
    const result = await xService.create(tenantId, input)
    return Response.json(result, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
```

### Repository

```typescript
export class XRepository {
  async findById(tenantId: string, id: string) {
    return prisma.x.findFirst({
      where: { id, tenantId } // tenantId SEMPRE presente
    })
  }
}
```

### Service

```typescript
export class XService {
  constructor(
    private readonly repo: XRepository,
    private readonly events: DomainEventBus
  ) {}

  async create(tenantId: string, input: CreateXInput) {
    const result = await this.repo.create(tenantId, input)
    this.events.publish({ type: 'x.created', payload: { tenantId, result } })
    return result
  }
}
```

---

## Status dos domínios (2026-06-24)

| Domínio | Backend | Frontend | Observação |
|---------|---------|----------|------------|
| IAM | ✅ | ✅ | Cargos dinâmicos, RBAC, edição de membros, foto com enquadramento (zoom/posição) ajustável, vínculo de serviços |
| CRM | ✅ | ✅ | Filtros avançados, badge VIP, anamnese |
| Scheduling | ✅ | ✅ | Agenda semanal, slots configuráveis por tenant |
| Financial | ✅ | ✅ | Checkout, despesas, comissões, taxas, estornos |
| Notifications | ✅ | ✅ | Evolution API primário (WhatsApp), 6 templates |
| Dashboard | ✅ | ✅ | Métricas + polling 30s |
| Reports | ✅ | ✅ | 4 relatórios + filtros + CSV |
| Serviços | ✅ | ✅ | Categorias, imagens em retrato 4:5 com editor de enquadramento, picker visual |
| Produtos/Estoque | ✅ | ✅ | Catálogo, movimentação, reflexo financeiro, imagem com editor de enquadramento |
| Billing (Stripe) | ✅ | ✅ | Checkout, Portal, Webhook, planos dinâmicos do DB |
| Automation | stub | — | Fase 2 |

> Padrão de imagens: ver seção "Padrão de imagens" em `CLAUDE.md` —
> `EntityImage` + `ImageCropEditor` (`src/components/domain/shared/`) substituem qualquer
> `<img object-cover>` direto para avatar/serviço/pacote/promoção/produto.

---

## Detalhes técnicos críticos

### SessionContext

```typescript
type SessionContext = {
  tenantId: string
  userId: string
  isOwner: boolean
  permissions: Record<string, string[]> // { 'agenda': ['view','create'], ... }
}
```

### ensurePermission — duas assinaturas

```typescript
ensurePermission(session, 'agenda', 'view')        // nova (preferida)
ensurePermission(session, 'appointments:view')     // legacy (ainda suportada)
```

### WhatsApp

- Evolution API é provider primário (`WHATSAPP_PROVIDER=evolution`)
- Twilio é apenas fallback

### Modelo opt-out de navegação

Seções sem entrada em `PlanFeatureConfig` são habilitadas por padrão.
Apenas `enabled: false` bloqueia explicitamente.
`NAV_REGISTRY` em `src/shared/permissions/nav-registry.ts` é a fonte única de verdade.

### Planos

- FREE / STARTER / PRO / ENTERPRISE
- Limites de cargos por plano: FREE/STARTER = 3, PRO = 5, ENTERPRISE = ∞

---

## Workflow de branches e commits

```bash
# Sempre criar branch antes de implementar
git checkout main && git pull origin main
git checkout -b feat/nome-da-feature

# Commits: Conventional Commits em PT-BR
git commit -m "feat(scheduling): adiciona visualização semanal"

# PR ao concluir
gh pr create --title "feat(scheduling): agenda semanal" --body "..."

# Merge por squash
gh pr merge --squash
```

### Nomenclatura de branches

| Tipo | Prefixo | Exemplo |
|---|---|---|
| Nova funcionalidade | `feat/` | `feat/scheduling-weekly-view` |
| Correção de bug | `fix/` | `fix/tenant-filter-missing` |
| Refatoração | `refactor/` | `refactor/crm-repository` |
| Manutenção | `chore/` | `chore/update-prisma` |
| Hotfix urgente | `hotfix/` | `hotfix/auth-token-expired` |

**Nenhuma entrega é concluída até estar na `main`.**

---

## Checklist obrigatório antes de abrir PR

- [ ] Branch dedicada criada (`feat/` ou `fix/`)
- [ ] `tenantId` em todo model novo no Prisma
- [ ] Repository filtra tenant em todas as queries
- [ ] Service com regras de negócio e publicação de eventos
- [ ] Zod schemas em `domains/[dominio]/schemas.ts`
- [ ] API Route com `getSessionContext()` e validação Zod
- [ ] Erros tipados para todos os casos de falha
- [ ] Componente com loading, error e empty state
- [ ] Sem `any` no TypeScript
- [ ] `npx tsc --noEmit` — zero erros
- [ ] `npx vitest run` — todos os testes passando
- [ ] PR aberta para `main` e mergeada

---

## Skills especializadas disponíveis

Os arquivos em `.claude/skills/` definem os agentes do pipeline. Leia o arquivo da skill antes de executar cada etapa.

| Skill | Arquivo | Quando usar |
|---|---|---|
| Onboarding | `.claude/skills/agent-onboarding.md` | Toda ideia nova — exploração e brief |
| Orchestrator | `.claude/skills/orchestrator.md` | Coordenação do pipeline pós-brief |
| Database | `.claude/skills/agent-database.md` | Schema Prisma, migrations, RLS |
| Backend | `.claude/skills/agent-backend.md` | Services, repos, API Routes, Zod |
| Frontend | `.claude/skills/agent-frontend.md` | Pages, components, hooks de UI |
| Testing | `.claude/skills/agent-testing.md` | Vitest, testes unit + integração |
| Security | `.claude/skills/agent-security.md` | OWASP, tenancy, rate limiting |
| Review | `.claude/skills/agent-review.md` | Gate de build final |
| Documentation | `.claude/skills/agent-documentation.md` | Docs pós-entrega |
| Arquiteto | `.claude/skills/agent-architect.md` | Decisões arquiteturais novas |

---

## Output padrão ao concluir

```
✅ Concluído:
- [o que foi feito]

📁 Arquivos criados/modificados:
- [lista com paths]

⚠️ Pendências (se houver):
- [o que ficou fora do escopo e por quê]
```
