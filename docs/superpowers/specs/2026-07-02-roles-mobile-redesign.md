# Spec: Redesenho mobile da tela de Cargos e permissões

**Data:** 2026-07-02  
**Branch:** `fix/roles-mobile-redesign`  
**Domínio:** IAM  

---

## Problema

A tela de edição de cargos (`/equipe` → Dialog "Cargos e permissões") está quebrada no mobile:

- `RolePermissionMatrix` renderiza `<table min-w-[560px]>` com 4 colunas de ação
- Em mobile (≈432px) não há como rolar horizontalmente — a tabela é cortada
- O layout de 2 painéis lado a lado (`lg:flex-row`) em mobile vira coluna mas continua inutilizável
- O preset `PROFESSIONAL` tem permissões mínimas por padrão, exigindo que o dono do negócio configure manualmente — o que ele não faz

---

## Escopo

3 mudanças independentes, nenhuma altera schema do banco:

1. **Navegação mobile em 2 passos** — `RolesManager`
2. **Matrix de permissões responsiva** — `RolePermissionMatrix`
3. **Defaults do Profissional** — `nav-registry.ts` + script de data migration

---

## Seção 1 — Navegação mobile em 2 passos

### Comportamento

`RolesManager` adiciona estado `mobileView: 'list' | 'editor'` (default `'list'`).

**Passo 1 — Lista (mobile):**
- Lista de cargos ocupa 100% do espaço do Dialog
- Clicar em qualquer cargo: `setEditingId(role.id)` + `setMobileView('editor')`
- Botão "+ Novo cargo" permanece acessível

**Passo 2 — Editor (mobile):**
- Lista some, editor ocupa 100% do espaço
- Cabeçalho do editor exibe botão `← Cargos` (`lg:hidden`)
- Clicar `← Cargos` → `setMobileView('list')`
- Ao executar Salvar ou Cancelar → `setMobileView('list')` além do comportamento atual

**Desktop (`lg:`):** layout inalterado — lista lateral `w-56` + editor flexível à direita.

### Controle de visibilidade (CSS puro, sem hook `isMobile`)

```
Lista:  hidden lg:block  quando mobileView === 'editor'
        block            quando mobileView === 'list'

Editor: hidden lg:block  quando mobileView === 'list'
        block            quando mobileView === 'editor'
```

### Arquivos

- `src/components/domain/iam/roles-manager.tsx`

---

## Seção 2 — Matrix de permissões responsiva

### Layout mobile — chips por seção

Abaixo de `lg:`, a tabela é substituída por um layout de chips:

```
Agenda
[✓ Ver] [✓ Criar] [✗ Editar] [✗ Excluir] [✗ Ver todos]

Serviços
[✓ Ver] [✗ Criar] [✗ Editar] [✗ Excluir]

Financeiro
[✗ Ver] [✗ Criar] [✗ Editar]
```

- Cada chip: pill `rounded-full px-3 py-1.5 text-xs` com ícone `Check` ou `X` + label
- Estado ativo: `bg-primary/10 border-primary/30 text-primary`
- Estado inativo: `bg-slate-50 border-slate-200 text-slate-400`
- Ações não suportadas pela seção não aparecem (sem "–")
- `onClick` chama a mesma `toggle()` existente
- `disabled` quando `updateRole.isPending`

### Layout desktop — tabela existente (inalterada)

Tabela atual envolvida em `<div className="hidden lg:block overflow-x-auto">`.

### Implementação

Duas renderizações no mesmo componente `RolePermissionMatrix`:
- `<div className="space-y-4 lg:hidden">` — chips
- `<div className="hidden lg:block overflow-x-auto">` — tabela atual

A lógica `toggle()` é compartilhada entre os dois layouts.

### Arquivos

- `src/components/domain/iam/role-permission-matrix.tsx`

---

## Seção 3 — Defaults do cargo Profissional

### Novos tenants — `nav-registry.ts`

Preset `PROFESSIONAL` passa a ter todas as ações disponíveis por seção:

| Seção        | Ações disponíveis            | Novo default PROFESSIONAL         |
|--------------|------------------------------|-----------------------------------|
| Agenda       | view, create, edit, delete, view_all | view, create, edit, delete, view_all |
| Serviços     | view, create, edit, delete   | view, create, edit, delete        |
| Produtos     | view, create, edit, delete   | view, create, edit, delete        |
| Clientes     | view, create, edit, delete   | view, create, edit                |
| Financeiro   | view, create, edit, delete   | view, create, edit                |
| Relatórios   | view                         | view                              |
| Equipe       | view, create, edit, delete   | view                              |
| Config.      | view, edit                   | view, edit                        |

Racional das exceções:
- **Clientes/Financeiro:** omite `delete` — deleção de clientes e transações é ação destrutiva; profissional pode ver, criar e editar sem precisar excluir
- **Equipe:** apenas `view` — gerenciar membros é responsabilidade do dono/gerente

### Tenants existentes — script de data migration

Arquivo: `prisma/scripts/update-professional-permissions.ts`

- Filtra `Role` onde `name = 'Profissional'` **e** `isDefault = true`
- Atualiza `permissions` para os novos defaults
- Roles que o tenant renomeou (ex: "Profissional Sênior") ou criou com `isDefault = false` **não são tocados**
- Loga: `N roles atualizados`

Execução: `npx tsx prisma/scripts/update-professional-permissions.ts`

> Deve ser executado **uma vez** após o deploy.

### Arquivos

- `src/shared/permissions/nav-registry.ts`
- `prisma/scripts/update-professional-permissions.ts` ← novo

---

## Fora do escopo

- Alterar permissões dos presets `MANAGER` e `RECEPTIONIST`
- Atualizar roles customizados (`isDefault = false`) de qualquer cargo
- Mudar o schema do banco (nenhuma migration Prisma necessária)
- Alterar o `RoleFilterPermissions` (já responsivo)

---

## Arquivos alterados (resumo)

| Arquivo | Tipo |
|---------|------|
| `src/components/domain/iam/roles-manager.tsx` | edição |
| `src/components/domain/iam/role-permission-matrix.tsx` | edição |
| `src/shared/permissions/nav-registry.ts` | edição |
| `prisma/scripts/update-professional-permissions.ts` | novo |
