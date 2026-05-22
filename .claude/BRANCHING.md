# BRANCHING.md — Workflow de branches e commits

> Regras que o Claude segue automaticamente para gestão de branches e commits.

---

## Estratégia de branches

```
main          ← produção (sempre estável)
  └── feat/nome-da-feature      ← nova funcionalidade
  └── fix/descricao-do-bug      ← correção de bug
  └── refactor/area-refatorada  ← refatoração sem mudança de comportamento
  └── chore/tarefa-de-manutencao ← dependências, config, docs
```

### Regras
- `main` nunca recebe commits diretos — apenas via Pull Request
- Cada feature/fix vive em sua própria branch
- Branch é criada a partir de `main` sempre atualizada
- Branches `feat/` são mantidas após o merge (rastreabilidade)
- Branches `fix/` e `hotfix/` podem ser deletadas após o merge

---

## Nomenclatura de branches

| Tipo | Prefixo | Exemplo |
|---|---|---|
| Nova funcionalidade | `feat/` | `feat/scheduling-weekly-view` |
| Correção de bug | `fix/` | `fix/tenant-filter-missing` |
| Refatoração | `refactor/` | `refactor/crm-repository` |
| Manutenção/infra | `chore/` | `chore/update-prisma` |
| Hotfix urgente | `hotfix/` | `hotfix/auth-token-expired` |

**Formato:** `tipo/descricao-em-kebab-case`

---

## Conventional Commits

Todos os commits seguem o padrão [Conventional Commits](https://conventionalcommits.org):

```
<tipo>(<escopo>): <descrição curta>

[corpo opcional — explica o PORQUÊ, não o QUÊ]

[rodapé opcional — breaking changes, refs]
```

### Tipos permitidos

| Tipo | Quando usar |
|---|---|
| `feat` | Nova funcionalidade |
| `fix` | Correção de bug |
| `refactor` | Refatoração sem mudança de comportamento |
| `chore` | Build, deps, config, sem impacto em src |
| `test` | Adição ou correção de testes |
| `docs` | Documentação apenas |
| `style` | Formatação, sem mudança de lógica |
| `perf` | Otimização de performance |
| `ci` | Mudanças em CI/CD |

### Exemplos de commits

```
feat(scheduling): adiciona visualização semanal da agenda

fix(crm): corrige filtro de tenantId ausente na busca por cliente

refactor(financial): extrai lógica de cálculo para FinancialService

chore: atualiza Prisma de 5.10 para 5.14

feat(iam)!: redesenha sistema de permissões RBAC

BREAKING CHANGE: roles agora são arrays de strings em vez de enum
```

---

## Fluxo completo (do zero ao merge)

```bash
# 1. Atualiza main antes de criar branch
git checkout main
git pull origin main

# 2. Cria branch para a feature/fix
git checkout -b feat/nome-da-feature

# 3. Implementa, commit atômico por unidade lógica
git add src/domains/scheduling/...
git commit -m "feat(scheduling): adiciona WeeklyView component"

git add src/app/api/scheduling/...
git commit -m "feat(scheduling): expõe endpoint GET /api/scheduling/appointments"

# 4. Abre Pull Request para main
gh pr create \
  --title "feat(scheduling): agenda semanal" \
  --body "$(cat <<'EOF'
## O que essa PR faz
- Adiciona visualização semanal de agendamentos
- Expõe endpoint GET com filtros de data e profissional

## Como testar
- [ ] Acesse /scheduling
- [ ] Verifique filtro por semana
- [ ] Verifique filtro por profissional

## Checklist
- [ ] tenantId em todos os models
- [ ] Repository filtra por tenant
- [ ] Sem `any` no TypeScript
- [ ] Loading e error states no componente
EOF
)"

# 5. Após aprovação, merge squash via GitHub
# feat/ → mantém branch após merge
gh pr merge --squash

# fix/ ou hotfix/ → pode deletar
gh pr merge --squash --delete-branch
```

---

## Regra obrigatória — merge na main ao concluir

**Nenhuma entrega é considerada concluída até estar na `main`.**

Ao finalizar qualquer implementação, o Claude deve obrigatoriamente:

1. Verificar se há commits pendentes de push na branch atual
2. Abrir PR para `main` via `gh pr create`
3. Mergear a PR via `gh pr merge --squash`
4. Confirmar que `main` está atualizada com `git log origin/main --oneline -3`

Isso se aplica a toda branch de `feat/`, `fix/`, `refactor/` e `chore/` — sem exceção.
O código que não está na `main` não existe do ponto de vista do produto.

---

## Quando o Claude cria branches automaticamente

O Claude cria uma nova branch **antes de começar qualquer implementação** quando:

1. A tarefa é uma **nova feature** (mesmo pequena)
2. A tarefa é uma **correção de bug** em código existente
3. O usuário pedir explicitamente

O Claude **não** cria branch quando:
- Edições em arquivos de documentação/config apenas
- O usuário já está em uma branch de feature ativa

---

## Merge Request — o que incluir

Toda PR criada pelo Claude inclui:

- **Título** seguindo Conventional Commits
- **Descrição**: o que faz + como testar
- **Checklist** do CLAUDE.md (tenantId, repository, TypeScript strict)
- **Screenshots** quando há mudança visual

---

## Referência rápida de comandos git

```bash
# Ver branch atual e status
git status

# Listar branches
git branch -a

# Trocar de branch
git checkout nome-da-branch

# Criar e trocar para nova branch
git checkout -b feat/nova-feature

# Deletar branch local após merge
git branch -d feat/nome-da-feature

# Deletar branch remota
git push origin --delete feat/nome-da-feature

# Ver PRs abertas
gh pr list

# Ver PR específica
gh pr view 42
```
