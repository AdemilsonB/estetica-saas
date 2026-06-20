# AGENTS.md — Mapa do sistema de skills

> Referência humana do pipeline de desenvolvimento.
> Para uso no Codex CLI: cole o `CODEX.md` no início da sessão.
> Para Claude Code: o `CLAUDE.md` é carregado automaticamente.

---

## Ponto de entrada para qualquer tarefa

```
Ideia do usuário
      ↓
agent-onboarding   ← explora intenção, propõe abordagens, estrutura brief
      ↓
orchestrator       ← decide pipeline (hotfix / feature / arquitetural)
      ↓
[database] → [backend] → [frontend] + [mobile] → [testing + security] → [review] → [documentation]
      ↓
PR aberta e mergeada na main
```

Só acione o orchestrator diretamente (sem onboarding) se:
- É um bug com arquivo + comportamento + erro exatos descritos → usar `agent-hotfix`
- É uma mudança pontual e cirúrgica com escopo inequívoco

---

## Skills disponíveis

> Ver `CLAUDE.md` — seção "Sistema de Skills" para regras de uso.

| Skill | Arquivo | Quando usar |
|---|---|---|
| **Onboarding** | `.claude/skills/agent-onboarding.md` | **Primeiro passo** — toda ideia nova passa aqui |
| **Orchestrator** | `.claude/skills/orchestrator.md` | Coordena o pipeline pós-brief |
| **Hotfix** | `.claude/skills/agent-hotfix.md` | Bugs pontuais em produção — pipeline reduzido (~13k tokens) |
| **Database** | `.claude/skills/agent-database.md` | Schema Prisma, migrations, RLS |
| **Backend** | `.claude/skills/agent-backend.md` | Services, repos, API Routes, Zod schemas |
| **Frontend** | `.claude/skills/agent-frontend.md` | Pages, components, hooks de UI |
| **Mobile** | `.claude/skills/agent-mobile.md` | Checklist mobile-first — obrigatório após todo frontend |
| **Testing** | `.claude/skills/agent-testing.md` | Vitest, testes unit + integração |
| **Security** | `.claude/skills/agent-security.md` | Auditoria OWASP, tenancy, rate limiting |
| **Review** | `.claude/skills/agent-review.md` | Gate de build final, aprovação de PR |
| **Documentation** | `.claude/skills/agent-documentation.md` | Atualiza docs após cada feature |
| **Arquiteto** | `.claude/skills/agent-architect.md` | Decisões arquiteturais novas sem precedente em decisions.md |

---

## Pipelines disponíveis

| Tipo | Skills | Custo estimado |
|---|---|---|
| Hotfix / Bugfix | `agent-hotfix` → `agent-mobile`? → `agent-review` | ~13k tokens |
| Feature nova | onboarding → orchestrator → database? → backend → frontend + mobile → testing + security → review → documentation | ~28k tokens |
| Decisão arquitetural | `agent-architect` → `decisions.md` | ~4k tokens |

---

## Paralelismo possível no pipeline

- `agent-testing` e `agent-security` podem rodar em paralelo após o código pronto
- `agent-documentation` roda SEMPRE APÓS `agent-review` — nunca em paralelo com o gate de build

---

## Gates de validação obrigatórios

| Skill concluída | Validação |
|---|---|
| `agent-database` | `npx prisma validate && npx prisma generate` |
| `agent-backend` | `npx tsc --noEmit` sem erros na área modificada |
| `agent-frontend` | `npx tsc --noEmit` sem erros de tipo |
| `agent-mobile` | Checklist mobile completo — sem item não verificado |
| `agent-testing` | `npx vitest run` — todos passando |
| `agent-security` | Nenhum item CRÍTICO em aberto |
| `agent-review` | `npx tsc --noEmit` + `npx vitest run` — projeto inteiro verde |

---

## Regras para todos os agentes

- Sempre respeitar os padrões do `CLAUDE.md`
- TypeScript strict — sem `any`, sem `as unknown as`
- `tenantId` em todo model e em toda query de banco
- Erros tipados de `src/shared/errors/` — nunca strings genéricas
- Eventos via `eventBus.publish()` — nunca importação direta entre domínios
- Nunca lógica de negócio em componentes React
- Nunca queries diretas ao banco em API Routes
