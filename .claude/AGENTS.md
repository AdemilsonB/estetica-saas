# AGENTS.md — Orquestrador de agentes

> Cole este arquivo no início de uma conversa quando precisar orientar o Claude
> sobre QUAL agente usar para a tarefa. O orquestrador decide o fluxo.

---

## Como funciona o sistema de agentes

Este projeto usa agentes especializados para diferentes tipos de tarefa.
Cada agente tem um prompt específico em `.claude/agent-*.md`.

Para ativar um agente, cole o conteúdo do arquivo correspondente
no início da conversa com o Claude, junto com o `CLAUDE.md`.

---

## Mapa de agentes

| Tarefa | Agente | Arquivo |
|---|---|---|
| Criar domínio, service, repository, API Route | Backend | `agent-backend.md` |
| Criar página, componente, layout, UI | Frontend | `agent-frontend.md` |
| Criar/alterar schema Prisma, migration | Database | `agent-database.md` |
| Revisar código gerado, encontrar problemas | Review | `agent-review.md` |

---

## Fluxo recomendado para uma nova feature

```
1. agent-database  →  schema Prisma + migration
2. agent-backend   →  repository + service + API Route
3. agent-frontend  →  componente + página + integração
4. agent-review    →  revisão final antes do commit
```

### Exemplo: implementar agendamento

```
Sessão 1 — Database Agent
"Crie o model Appointment no Prisma seguindo as regras do projeto"

Sessão 2 — Backend Agent
"Crie o AppointmentRepository, AppointmentService e a API Route POST /api/scheduling/appointments"

Sessão 3 — Frontend Agent
"Crie a página de agenda semanal consumindo a API de agendamentos"

Sessão 4 — Review Agent
"Revise o código gerado nas sessões anteriores"
```

---

## Como iniciar qualquer sessão de Vibe Coding

Cole sempre no início da conversa:

```
[conteúdo do CLAUDE.md]
---
[conteúdo do agent-*.md correspondente]
---
Tarefa: [descreva o que quer construir]
```

Quanto mais contexto você der, melhor o resultado.
Inclua também o `DOMAIN.md` do domínio sendo trabalhado.

---

## Regras para todos os agentes

- Sempre respeitar os padrões do `CLAUDE.md`
- Sempre gerar TypeScript strict — sem `any`
- Sempre incluir `tenantId` em operações de banco
- Sempre usar erros tipados de `src/shared/errors/`
- Sempre publicar eventos após operações importantes
- Nunca acoplar domínios diretamente
- Nunca gerar lógica de negócio em componentes React
- Nunca gerar queries diretas ao banco em API Routes
