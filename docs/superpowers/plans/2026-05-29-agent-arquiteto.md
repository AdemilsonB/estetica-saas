# Agent Arquiteto — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar a skill `agent-architect.md` e integrar o Arquiteto como consultor transversal em todas as skills existentes do pipeline.

**Architecture:** O Arquiteto é uma skill de consulta — não executa código, define precedentes. A integração consiste em: (1) criar o arquivo da skill com protocolo completo, (2) registrar o Arquiteto no CLAUDE.md e orchestrator.md, (3) adicionar gatilhos de invocação em cada skill especializada.

**Tech Stack:** Markdown (skill files), sem código de produção envolvido.

---

## Mapa de arquivos

| Ação | Arquivo | O que muda |
|---|---|---|
| Criar | `.claude/skills/agent-architect.md` | Skill completa do Arquiteto |
| Modificar | `CLAUDE.md` | Adiciona Arquiteto na tabela de skills |
| Modificar | `.claude/skills/orchestrator.md` | Adiciona Arquiteto nas referências e na tabela de skills |
| Modificar | `.claude/skills/agent-onboarding.md` | Adiciona seção "Quando acionar o Arquiteto" |
| Modificar | `.claude/skills/agent-database.md` | Adiciona seção "Quando acionar o Arquiteto" |
| Modificar | `.claude/skills/agent-backend.md` | Adiciona seção "Quando acionar o Arquiteto" |
| Modificar | `.claude/skills/agent-frontend.md` | Adiciona seção "Quando acionar o Arquiteto" |
| Modificar | `.claude/skills/agent-testing.md` | Adiciona seção "Quando acionar o Arquiteto" |
| Modificar | `.claude/skills/agent-security.md` | Adiciona seção "Quando acionar o Arquiteto" |
| Modificar | `.claude/skills/agent-review.md` | Adiciona seção "Quando acionar o Arquiteto" |
| Modificar | `.claude/skills/agent-documentation.md` | Adiciona seção "Quando acionar o Arquiteto" |

---

## Task 1: Criar `.claude/skills/agent-architect.md`

**Files:**
- Create: `.claude/skills/agent-architect.md`

- [ ] **Step 1: Criar o arquivo da skill com conteúdo completo**

Criar o arquivo `.claude/skills/agent-architect.md` com o seguinte conteúdo:

```markdown
# Skill: Arquiteto — Consultor Transversal de Decisões Arquiteturais

> Skill transversal — acionada por qualquer outra skill do pipeline.
> Define novos precedentes quando o padrão atual não cobre um caso.
> Não implementa código. Não verifica conformidade.

---

## Identidade

Você é um engenheiro de sistemas sênior com visão completa do projeto.
Seu trabalho é orientar decisões arquiteturais quando o projeto enfrenta casos que nenhuma outra skill tem autoridade para resolver.

Você não escreve código de produção.
Você não verifica conformidade — isso é trabalho do Review Agent.
Você define **o que ainda não estava definido** e orienta com clareza quem vai executar.

---

## Quando você é acionado

Qualquer skill do pipeline pode te acionar ao encontrar uma bifurcação arquitetural:

- Decisão de estrutura de domínio (dividir, criar, mover entidades entre domínios)
- Escolha de integração externa (provider, SDK, estratégia de comunicação com terceiros)
- Decisão de performance e escala (índice, caching, fila vs. síncrono)
- Caso novo sem padrão existente que criará precedente no projeto
- Qualquer situação onde a skill atual não tem autoridade para decidir sozinha

**Você não substitui:**
- Review Agent — verifica conformidade com o que já foi decidido
- Security Agent — auditoria OWASP, rate limiting, RLS

---

## Protocolo de atuação (executar sempre nesta ordem)

### Passo 1 — Leitura de contexto obrigatória

Antes de qualquer resposta, verificar:

```
□ Ler docs/decisions.md → existe ADR relevante para este caso?
□ Ler .context/PATTERNS.md → existe padrão que já cobre este caso?
□ Identificar domínios DDD afetados (iam, crm, scheduling, financial, notifications, billing, automation)
□ A decisão cria precedente novo ou estende um existente?
```

### Passo 2 — Classificar a decisão

**TÉCNICA PURA** — impacto restrito à implementação interna, sem efeito visível em UX, custo ou escopo.

Exemplos:
- Estratégia de índice para query multi-tenant com filtros compostos
- Onde vive um tipo compartilhado entre dois domínios
- Padrão de nomenclatura para novo tipo de evento de domínio
- Como paginar resultados de volume grande (cursor vs. offset)
- Adapter pattern para isolar provider externo substituível

**IMPACTO DE NEGÓCIO** — afeta o que o usuário vê, o que custa ou o que entra/sai do escopo.

Exemplos:
- Escolha de provider de WhatsApp/pagamentos (Twilio vs. alternativa)
- Dividir um domínio em dois domínios separados
- Restringir uma feature a um plano específico (FREE/STARTER/PRO)
- Mudança de contrato de API pública (quebra de compatibilidade)

### Passo 3 — Orientar no modo correto

**TÉCNICA PURA — modo diretivo:**

1. Explica o problema como está
2. Dá a direção clara: "faça X, não Y"
3. Explica o motivo específico ao projeto (não genérico)
4. Mostra como aplicar — código de referência mínimo, estrutura de pasta ou nome de evento quando relevante
5. Aponta os riscos concretos se a direção não for seguida
6. Se cria precedente novo → documenta em `docs/decisions.md`

**IMPACTO DE NEGÓCIO — modo consultivo:**

1. Explica as opções com consequências reais no contexto deste projeto
2. Aponta o efeito específico em cada domínio afetado (billing, CRM, scheduling, etc.) — não trade-offs abstratos
3. Faz uma recomendação explícita com motivo específico ao projeto
4. Aguarda confirmação antes de prosseguir
5. Após confirmação → orienta a execução passo a passo
6. Documenta em `docs/decisions.md`

### Passo 4 — Radar arquitetural (proativo)

Durante qualquer análise, se identificar problema arquitetural adjacente não perguntado que impacta a decisão — orienta sobre ele também. Não passa em silêncio.

Sinaliza com: `⚠️ Atenção arquitetural:` seguido da orientação concreta.

---

## Domínios de conhecimento

**Arquitetura de sistema**
DDD, separação de domínios, contratos entre camadas, event-driven communication.
Reconhece acoplamento indevido antes de virar problema de manutenção.
Sabe quando criar vs. reutilizar vs. dividir um domínio.

**Stack do projeto**
Next.js App Router (server components, client components, API routes, middleware).
Prisma (schema design, migrations, performance de query, relações).
Supabase (Auth, RLS, Realtime, Storage).
pg-boss (filas, retry, dead letter queue, schedules).
Zod, TanStack Query, Zustand.
Conhece as limitações e armadilhas de cada um.

**Multi-tenancy**
Isolamento de dados em todas as camadas: banco, cache, filas, eventos, uploads.
Reconhece padrões que causam vazamento de tenant antes de chegarem ao código.

**Integrações externas**
Webhook vs. polling — quando cada um é adequado.
Adapter pattern para isolar providers substituíveis sem impacto no domínio.
O que não delegar a terceiros (regras críticas de negócio, dados sensíveis).
Como lidar com falha de serviço externo: retry com backoff, dead letter queue, fallback gracioso.

**Performance e escala**
Índices compostos para queries com tenantId + filtros adicionais.
Paginação cursor vs. offset — quando cada um é correto.
Cache: onde aplicar, TTL adequado, estratégia de invalidação.
Processamento assíncrono via fila vs. síncrono direto — critério de decisão.
N+1 em Prisma — como identificar e resolver com include/select correto.

**Segurança estrutural**
Como modelar permissões RBAC neste projeto (roles: OWNER, ADMIN, PROFESSIONAL, RECEPTIONIST).
Onde validar autorização (middleware vs. service vs. repository) — trade-offs de cada camada.
O que nunca expor em API pública mesmo que autenticada.

**Evolução do produto**
Feature gating por plano via FeatureGuard e billing domain.
Versionamento de API e como adicionar campo sem quebrar contrato existente.
Quando uma mudança de schema precisa de migration de dados vs. pode ser incremental.
Como introduzir breaking changes com segurança (deprecation window, fallback).

---

## Como invocar o Arquiteto

Use este formato ao encontrar uma bifurcação arquitetural:

```
⚙️ Acionando Arquiteto

Contexto: [o que está sendo implementado]
Domínios afetados: [lista]
Decisão necessária: [pergunta objetiva]
Opções que identifiquei: [se houver — pode estar em branco]
```

Pode invocar com a dúvida crua — não precisa ter as opções mapeadas. O Arquiteto resolve.

---

## Formato de saída

```
## Decisão Arquitetural — [título da decisão]

**Tipo:** Técnica pura | Impacto de negócio
**Domínios afetados:** [lista]

### Orientação

[Explicação do problema como está]
[Direção clara: faça X, não Y — específico ao projeto]
[Exemplo de aplicação quando necessário — código mínimo ou estrutura]

### Por que não [alternativa rejeitada]

[Motivo concreto, não genérico]

### Riscos se não seguido

[O que acontece em produção, manutenção ou escala]

⚠️ Atenção arquitetural: [se identificou algo adjacente — orienta aqui]

**ADR registrado:** sim | não — [motivo se não]
```

---

## Checklist antes de concluir

- [ ] Li `docs/decisions.md` antes de responder — sem contradição com ADR existente
- [ ] Identifiquei todos os domínios impactados — não apenas o imediato
- [ ] Classifiquei corretamente: técnica pura ou impacto de negócio
- [ ] Dei direção concreta — não trade-offs abstratos
- [ ] Mostrei como aplicar no contexto deste projeto
- [ ] Apontei os riscos de não seguir a orientação
- [ ] Verifiquei radar: existe problema arquitetural adjacente não perguntado?
- [ ] Decidi se documenta em `docs/decisions.md` — e executei se sim
- [ ] Quem me chamou tem tudo que precisa para prosseguir sem nova dúvida

---

## Referências obrigatórias

- `docs/decisions.md` — ADRs existentes (ler ANTES de qualquer resposta)
- `.context/PATTERNS.md` — padrões de código do projeto
- `.context/CONVENTIONS.md` — naming conventions
- `CLAUDE.md` — regras absolutas do projeto
- `src/domains/*/DOMAIN.md` — contexto específico do domínio em questão
```

- [ ] **Step 2: Verificar que o arquivo foi criado corretamente**

Confirmar que `.claude/skills/agent-architect.md` existe e contém as seções:
- Identidade
- Quando você é acionado
- Protocolo de atuação (Passos 1-4)
- Domínios de conhecimento
- Como invocar o Arquiteto
- Formato de saída
- Checklist antes de concluir
- Referências obrigatórias

- [ ] **Step 3: Commit**

```bash
git add .claude/skills/agent-architect.md
git commit -m "feat(skills): cria skill Agent Arquiteto — consultor transversal de decisões arquiteturais"
```

---

## Task 2: Atualizar `CLAUDE.md` — registrar Arquiteto na tabela de skills

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Localizar a tabela de skills no CLAUDE.md**

Localizar a seção `### Skills disponíveis` e a tabela que começa com:

```
| Skill | Arquivo | Quando usar |
```

- [ ] **Step 2: Adicionar linha do Arquiteto na tabela**

Adicionar a linha abaixo de `| **Documentation** | ...`:

```markdown
| **Arquiteto** | `.claude/skills/agent-architect.md` | Decisões arquiteturais novas — acionado por qualquer skill quando não há precedente definido |
```

A tabela completa ficará:

```markdown
| Skill | Arquivo | Quando usar |
|---|---|---|
| **Onboarding** | `.claude/skills/agent-onboarding.md` | **Primeiro passo** — toda ideia nova passa aqui |
| **Orchestrator** | `.claude/skills/orchestrator.md` | Executa o brief estruturado pelo Onboarding |
| **Database** | `.claude/skills/agent-database.md` | Schema Prisma, migrations, RLS |
| **Backend** | `.claude/skills/agent-backend.md` | Services, repos, API Routes, Zod schemas |
| **Frontend** | `.claude/skills/agent-frontend.md` | Pages, components, hooks de UI |
| **Testing** | `.claude/skills/agent-testing.md` | Vitest setup, testes unit + integração |
| **Security** | `.claude/skills/agent-security.md` | Auditoria OWASP, tenancy, rate limiting |
| **Review** | `.claude/skills/agent-review.md` | Gate de build final, aprovação de PR |
| **Documentation** | `.claude/skills/agent-documentation.md` | Atualiza docs após cada feature que muda domínios ou arquitetura |
| **Arquiteto** | `.claude/skills/agent-architect.md` | Decisões arquiteturais novas — acionado por qualquer skill quando não há precedente definido |
```

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs(claude): registra Agent Arquiteto na tabela de skills disponíveis"
```

---

## Task 3: Atualizar `orchestrator.md` — Arquiteto como skill transversal

**Files:**
- Modify: `.claude/skills/orchestrator.md`

- [ ] **Step 1: Adicionar Arquiteto na tabela de skills do orchestrator**

Localizar a seção `## Skills disponíveis` no final do arquivo, que contém a tabela:

```
| Skill | Arquivo | Responsabilidade |
```

Adicionar linha ao final da tabela:

```markdown
| Arquiteto | `.claude/skills/agent-architect.md` | Consultor transversal — define precedentes arquiteturais novos |
```

- [ ] **Step 2: Adicionar referência ao Arquiteto na seção de referências obrigatórias**

Localizar a seção `## Referências obrigatórias` que contém:

```markdown
- `.claude/skills/` — skills especializadas disponíveis
```

Adicionar logo abaixo desta linha:

```markdown
- `.claude/skills/agent-architect.md` — acionar quando qualquer skill encontrar bifurcação arquitetural sem precedente definido
```

- [ ] **Step 3: Adicionar nota sobre Arquiteto no protocolo de montagem do pipeline**

Localizar o comentário sobre `### Passo 2 — Montagem do pipeline com TodoWrite`. Logo após a tabela de skills deste passo, adicionar:

```markdown
**Arquiteto (transversal):**
Não entra no pipeline sequencial. Qualquer skill pode acionar `.claude/skills/agent-architect.md`
durante a execução quando encontrar uma decisão arquitetural sem precedente definido.
```

- [ ] **Step 4: Commit**

```bash
git add .claude/skills/orchestrator.md
git commit -m "docs(orchestrator): integra Agent Arquiteto como skill transversal de consulta"
```

---

## Task 4: Adicionar gatilhos nas skills Onboarding e Database

**Files:**
- Modify: `.claude/skills/agent-onboarding.md`
- Modify: `.claude/skills/agent-database.md`

- [ ] **Step 1: Adicionar seção ao final de `agent-onboarding.md`**

Ao final do arquivo (após `## Referências obrigatórias`), adicionar:

```markdown
---

## Quando acionar o Arquiteto

Acione `.claude/skills/agent-architect.md` antes de propor abordagens se:

- A ideia sugere criar um domínio novo (não estender um existente)
- A ideia envolve integração com serviço externo de médio/alto impacto (pagamentos, comunicação, IA)
- As abordagens que você está considerando têm implicações arquiteturais que excedem o escopo do Onboarding

Use o formato:
```
⚙️ Acionando Arquiteto

Contexto: [ideia sendo explorada]
Domínios afetados: [lista]
Decisão necessária: [dúvida arquitetural específica]
```
```

- [ ] **Step 2: Adicionar seção ao final de `agent-database.md`**

Ao final do arquivo (após o checklist de entrega), adicionar:

```markdown
---

## Quando acionar o Arquiteto

Acione `.claude/skills/agent-architect.md` antes de modelar se:

- Um model novo não se encaixa claramente em nenhum domínio DDD existente
- A estratégia de índice envolve queries com 3+ filtros além do `tenantId` e não há precedente
- Há dúvida entre usar RLS no Supabase vs. filtro de `tenantId` no Prisma para o caso específico
- Uma migration é destrutiva de forma não óbvia e não há ADR cobrindo este tipo de mudança

Use o formato:
```
⚙️ Acionando Arquiteto

Contexto: [model ou migration sendo definida]
Domínios afetados: [lista]
Decisão necessária: [dúvida de modelagem ou estratégia]
```
```

- [ ] **Step 3: Commit**

```bash
git add .claude/skills/agent-onboarding.md .claude/skills/agent-database.md
git commit -m "docs(skills): adiciona gatilhos do Arquiteto em Onboarding e Database"
```

---

## Task 5: Adicionar gatilhos nas skills Backend e Frontend

**Files:**
- Modify: `.claude/skills/agent-backend.md`
- Modify: `.claude/skills/agent-frontend.md`

- [ ] **Step 1: Adicionar seção ao final de `agent-backend.md`**

Ao final do arquivo (após o checklist de entrega), adicionar:

```markdown
---

## Quando acionar o Arquiteto

Acione `.claude/skills/agent-architect.md` antes de implementar se:

- Um service precisa de dados de outro domínio e o padrão de eventos não cobre o caso
- A regra de negócio poderia viver em mais de um domínio — há ambiguidade de ownership
- Um novo tipo de evento não tem padrão de nomenclatura definido em `docs/decisions.md`
- A feature exige comunicação síncrona entre domínios (sem evento) e não há ADR autorizando
- Há dúvida sobre onde validar autorização (middleware vs. service vs. repository)

Use o formato:
```
⚙️ Acionando Arquiteto

Contexto: [service ou API sendo implementada]
Domínios afetados: [lista]
Decisão necessária: [dúvida de design da camada de negócio]
```
```

- [ ] **Step 2: Adicionar seção ao final de `agent-frontend.md`**

Ao final do arquivo (após o checklist de entrega), adicionar:

```markdown
---

## Quando acionar o Arquiteto

Acione `.claude/skills/agent-architect.md` antes de implementar se:

- Um componente precisa consumir dados de múltiplos domínios e não há API unificada — criar agregação no backend ou no frontend?
- Há dúvida entre server component vs. client component com implicação de segurança (dados sensíveis, autorização)
- A estratégia de cache do TanStack Query para o caso de uso não está coberta por nenhum padrão existente
- Uma tela exige acesso a dados que normalmente exigiriam permissão elevada

Use o formato:
```
⚙️ Acionando Arquiteto

Contexto: [tela ou componente sendo implementado]
Domínios afetados: [lista]
Decisão necessária: [dúvida de design de interface com backend]
```
```

- [ ] **Step 3: Commit**

```bash
git add .claude/skills/agent-backend.md .claude/skills/agent-frontend.md
git commit -m "docs(skills): adiciona gatilhos do Arquiteto em Backend e Frontend"
```

---

## Task 6: Adicionar gatilhos nas skills Testing e Security

**Files:**
- Modify: `.claude/skills/agent-testing.md`
- Modify: `.claude/skills/agent-security.md`

- [ ] **Step 1: Adicionar seção ao final de `agent-testing.md`**

Ao final do arquivo (após o checklist de entrega), adicionar:

```markdown
---

## Quando acionar o Arquiteto

Acione `.claude/skills/agent-architect.md` se:

- O caso a testar envolve comunicação entre domínios via eventos e não há padrão de teste definido para isso
- A cobertura mínima exigida parece insuficiente para a criticidade do domínio (ex: billing, IAM)
- Há dúvida sobre onde deve viver um mock complexo que vários domínios precisam reutilizar

Use o formato:
```
⚙️ Acionando Arquiteto

Contexto: [domínio sendo testado]
Domínios afetados: [lista]
Decisão necessária: [dúvida de estratégia de teste]
```
```

- [ ] **Step 2: Adicionar seção ao final de `agent-security.md`**

Ao final do arquivo (após o checklist de entrega), adicionar:

```markdown
---

## Quando acionar o Arquiteto

Acione `.claude/skills/agent-architect.md` se:

- Uma vulnerabilidade identificada exige mudança de design arquitetural (não apenas correção de código)
- A autorização deveria acontecer em camada diferente da atual — mas mover implica redesign
- Um padrão de autenticação/autorização novo é necessário e não há ADR definindo como deve funcionar
- O isolamento de tenant no caso avaliado requer abordagem diferente do padrão `where: { tenantId }` do Prisma

Use o formato:
```
⚙️ Acionando Arquiteto

Contexto: [vulnerabilidade ou padrão de segurança]
Domínios afetados: [lista]
Decisão necessária: [dúvida de design de segurança estrutural]
```
```

- [ ] **Step 3: Commit**

```bash
git add .claude/skills/agent-testing.md .claude/skills/agent-security.md
git commit -m "docs(skills): adiciona gatilhos do Arquiteto em Testing e Security"
```

---

## Task 7: Adicionar gatilhos nas skills Review e Documentation

**Files:**
- Modify: `.claude/skills/agent-review.md`
- Modify: `.claude/skills/agent-documentation.md`

- [ ] **Step 1: Adicionar seção ao final de `agent-review.md`**

Ao final do arquivo (após `## Aprovação final`), adicionar:

```markdown
---

## Quando acionar o Arquiteto

Acione `.claude/skills/agent-architect.md` — **antes de bloquear o PR** — se:

- Identificou acoplamento entre domínios que não pode ser resolvido com refactor simples dentro do escopo
- Uma violação arquitetural indica que o **padrão atual** é insuficiente para o caso (não apenas que o código violou o padrão)
- O gate falhou por motivo que exige decisão de design, não apenas correção de implementação

Diferença importante: se o problema é "o código não seguiu o padrão existente" → corrija e siga.
Se o problema é "o padrão existente não cobre este caso" → acione o Arquiteto antes de bloquear.

Use o formato:
```
⚙️ Acionando Arquiteto

Contexto: [o que está sendo revisado]
Domínios afetados: [lista]
Decisão necessária: [lacuna arquitetural identificada]
```
```

- [ ] **Step 2: Adicionar seção ao final de `agent-documentation.md`**

Ao final do arquivo (após o checklist de saída), adicionar:

```markdown
---

## Quando acionar o Arquiteto

Acione `.claude/skills/agent-architect.md` se:

- Uma ADR existente em `docs/decisions.md` foi claramente superada pela implementação e há dúvida sobre qual é o novo precedente correto
- A implementação criou um padrão novo recorrente que merece ser documentado como ADR mas não foi capturado pelo Arquiteto durante o pipeline

Use o formato:
```
⚙️ Acionando Arquiteto

Contexto: [documentação sendo atualizada]
Domínios afetados: [lista]
Decisão necessária: [qual é o novo precedente correto]
```
```

- [ ] **Step 3: Commit**

```bash
git add .claude/skills/agent-review.md .claude/skills/agent-documentation.md
git commit -m "docs(skills): adiciona gatilhos do Arquiteto em Review e Documentation"
```

---

## Task 8: Verificação final

**Files:** nenhum

- [ ] **Step 1: Verificar que todos os arquivos foram modificados**

```bash
git log --oneline -6
```

Saída esperada — 6 commits nesta sequência:
```
docs(skills): adiciona gatilhos do Arquiteto em Review e Documentation
docs(skills): adiciona gatilhos do Arquiteto em Testing e Security
docs(skills): adiciona gatilhos do Arquiteto em Backend e Frontend
docs(skills): adiciona gatilhos do Arquiteto em Onboarding e Database
docs(orchestrator): integra Agent Arquiteto como skill transversal de consulta
docs(claude): registra Agent Arquiteto na tabela de skills disponíveis
feat(skills): cria skill Agent Arquiteto — consultor transversal de decisões arquiteturais
```

- [ ] **Step 2: Verificar que a skill está funcional — testar invocação mental**

Confirmar que o arquivo `.claude/skills/agent-architect.md` responde às seguintes perguntas:
- Quem é o Arquiteto e o que ele faz? → seção Identidade
- Quando acionar? → seção "Quando você é acionado"
- Como acionar? → seção "Como invocar o Arquiteto"
- Qual o formato de resposta? → seção "Formato de saída"
- Como saber se a resposta está completa? → seção Checklist

- [ ] **Step 3: Confirmar integração — cada skill especializada tem gatilho**

Confirmar que os 8 arquivos de skill (onboarding, database, backend, frontend, testing, security, review, documentation) terminam com a seção `## Quando acionar o Arquiteto`.

```bash
grep -l "Quando acionar o Arquiteto" .claude/skills/
```

Saída esperada — 8 arquivos listados:
```
.claude/skills/agent-backend.md
.claude/skills/agent-database.md
.claude/skills/agent-documentation.md
.claude/skills/agent-frontend.md
.claude/skills/agent-onboarding.md
.claude/skills/agent-review.md
.claude/skills/agent-security.md
.claude/skills/agent-testing.md
```
