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

**Nunca inicie implementação sem antes fazer as perguntas necessárias.** Este protocolo é obrigatório mesmo que a tarefa pareça simples.

Ao receber uma demanda, siga esta sequência:

### 1. Leia o contexto existente
Antes de qualquer pergunta, verifique internamente:
- Qual domínio DDD é afetado? (`iam`, `crm`, `scheduling`, `financial`, `notifications`)
- Existe backend já implementado para isso? (ver tabela de status dos domínios abaixo)
- Existe componente ou hook que resolve parte do problema?
- Qual agente deve ser ativado? (ver `.claude/AGENTS.md`)

### 2. Faça as perguntas certas — agrupadas, máximo 5 por vez

Para qualquer demanda, cubra obrigatoriamente:

**Sobre o comportamento:**
- O que o usuário vê/faz antes, durante e depois da ação?
- Quem usa isso? (dono do salão, atendente, cliente final)
- Existe algum caso de erro ou edge case óbvio que precisa de tratamento especial?

**Sobre o escopo:**
- É criação do zero ou alteração de algo existente?
- Afeta mais de um domínio? Se sim, como se comunicam?
- Tem regra de negócio específica do setor de estética que eu preciso saber?

**Sobre pré-condições:**
- O que precisa existir antes (model Prisma, API, componente base)?

Apresente as perguntas assim:
```
Antes de começar, preciso entender melhor alguns pontos:

**Comportamento:**
1. [pergunta]
2. [pergunta]

**Escopo:**
3. [pergunta]

**Pré-condições:**
4. [pergunta]
```

### 3. Confirme o entendimento antes de codificar

Após as respostas, apresente:
```
Meu entendimento da tarefa:
- O que farei: [lista objetiva]
- O que não está no escopo: [lista]
- Agente(s) que vou usar: [database / backend / frontend / review]
- Estimativa: [simples <30min / médio 1-3h / complexo >3h]

Posso começar?
```

Só inicie o código após confirmação explícita.

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

---

## Padrão de API Route

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

## Padrão de Repository

```typescript
export class XRepository {
  async findById(tenantId: string, id: string) {
    return prisma.x.findFirst({
      where: { id, tenantId } // tenantId SEMPRE presente
    })
  }
}
```

## Padrão de Service

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

## Domínios — Fase 1 (MVP)

| Domínio       | Status              | Backend                                             | Frontend                  |
| ------------- | ------------------- | --------------------------------------------------- | ------------------------- |
| IAM           | 🟡 parcial           | session, RBAC, permissões ✅                         | login, onboarding ❌       |
| CRM           | 🟢 backend completo  | repository, service, API (busca + paginação) ✅      | UI ❌                      |
| Scheduling    | 🟢 backend completo  | repository, service, availability, API (filtros) ✅  | UI ❌                      |
| Financial     | 🟢 backend completo  | repository, service, API (filtros + paginação) ✅    | UI ❌                      |
| Notifications | 🟡 parcial           | subscriptions de eventos ✅                          | WhatsApp provider stub ⚠️ |
| Billing       | 🔴 stub Fase 2       | tipos + DOMAIN.md criados                           | —                         |
| Automation    | 🔴 stub Fase 2       | tipos + DOMAIN.md criados                           | —                         |

## Próximo passo crítico

Frontend — sem ele não há produto. Ordem recomendada:
1. Shell de navegação (sidebar desktop + bottom nav mobile)
2. IAM: login + registro de tenant
3. Scheduling: agenda semanal (tela principal)
4. CRM: listagem de clientes
5. Financial: resumo do dia

---

## Workflow de branches e commits

- Branch dedicada por feature/fix — nunca committar direto em `main`
- Nomenclatura: `feat/`, `fix/`, `refactor/`, `chore/`, `hotfix/`
- Commits seguem Conventional Commits em PT-BR: `feat(escopo): descrição em português`
- Pull Request para `main` ao concluir — com checklist abaixo
- Ver `.claude/BRANCHING.md` para o fluxo completo

---

## Checklist antes de entregar qualquer feature

- [ ] Branch dedicada criada (`feat/` ou `fix/`)
- [ ] `tenantId` em todo model novo no Prisma
- [ ] Repository com filtro de tenant em todas as queries
- [ ] Service com regras de negócio e publicação de eventos
- [ ] API Route com `withTenant()` e validação Zod
- [ ] Erros tipados para todos os casos de falha
- [ ] Componente com loading state e error state
- [ ] Sem `any` no TypeScript
- [ ] Pull Request aberta para `main`

---

## Arquivos de contexto complementares

- `.claude/PLANEJAMENTO.md` — protocolo de planejamento e refinamento de demandas
- `.claude/AGENTS.md` — como usar cada agente
- `.claude/BRANCHING.md` — workflow de branches, commits e PRs
- `.claude/agent-backend.md` — agente de domínios e API
- `.claude/agent-frontend.md` — agente de UI e componentes
- `.claude/agent-database.md` — agente de schema e migrations
- `.claude/agent-review.md` — agente revisor de código
- `.context/PATTERNS.md` — padrões detalhados de código
- `.context/CONVENTIONS.md` — naming conventions
- `docs/decisions.md` — decisões arquiteturais (ADRs)
