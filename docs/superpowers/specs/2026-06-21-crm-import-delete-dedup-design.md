# Design: CRM — Importar Contatos, Excluir Cliente e Deduplicação Pública

**Data:** 2026-06-21
**Status:** Aprovado
**Branch alvo:** `feat/crm-import-delete-dedup`

---

## Contexto

Três melhorias relacionadas ao CRM:

1. **Excluir cliente** — soft delete com possibilidade de restauração
2. **Importar contatos do celular** — Contact Picker API (Android) + vCard (iOS)
3. **Deduplicação no cadastro público** — evitar duplicatas por CPF ou telefone, atualizando dados existentes

---

## Feature 1 — Excluir cliente (soft delete)

### Decisão
Soft delete: cliente arquivado some da lista principal mas tem histórico preservado (agendamentos, transações, anamnese). Pode ser restaurado pela página de perfil.

### Schema (Prisma)

Adicionar ao model `Customer`:

```prisma
deletedAt DateTime?

@@index([tenantId, deletedAt])
```

Migration aditiva — sem breaking changes.

### Repository (`customer.repository.ts`)

- Todos os métodos com filtro `where` ganham `deletedAt: null`:
  - `findAll`, `findById`, `findByPhone`, `findByPhones`, `findWithAppointments`, `findByIdWithStats`, `findOrCreateByPhone`
- Novo método `softDelete(tenantId, customerId)` → seta `deletedAt: new Date()`
- Novo método `restore(tenantId, customerId)` → seta `deletedAt: null`

### Service (`customer.service.ts`)

- Novo método `delete(tenantId, customerId)`:
  - Valida existência (lança `CustomerNotFoundError` se não encontrar)
  - Chama `customerRepository.softDelete(...)`
  - Publica evento `crm.customer.deleted`
- Novo método `restore(tenantId, customerId)`:
  - Busca cliente **sem** o filtro de `deletedAt` (usando query raw ou método dedicado no repository)
  - Chama `customerRepository.restore(...)`
  - Publica evento `crm.customer.restored`

### API Routes

| Método | Rota | Permissão |
|--------|------|-----------|
| `DELETE` | `/api/crm/customers/[customerId]` | `customers.delete` |
| `POST` | `/api/crm/customers/[customerId]/restore` | `customers.edit` |

### UI

**`CustomerCard`** — adicionar menu de ações (`MoreHorizontal`):
- "Ver perfil" → link para `/clientes/[id]`
- "Arquivar cliente" → abre `AlertDialog` de confirmação

**`/clientes/[id]` (página de perfil)**:
- Se `customer.deletedAt !== null`: exibir banner de aviso ("Cliente arquivado em [data]") + botão "Restaurar cliente"
- O botão chama `POST /api/crm/customers/[id]/restore` e invalida a query

**Após arquivar**: `queryClient.invalidateQueries(['customers'])` para remover da lista imediatamente.

**Permissões**: O botão de arquivar só aparece para quem tem `customers.delete`. O de restaurar requer `customers.edit`.

---

## Feature 2 — Importar contatos do celular

### Decisão de plataforma

| Plataforma | Mecanismo |
|------------|-----------|
| Android Chrome / Edge / Samsung Internet | Contact Picker API (`navigator.contacts`) |
| iOS (qualquer browser) + Desktop | Upload de arquivo `.vcf` (vCard) |

Detecção: `'contacts' in navigator && 'ContactsManager' in window`

### Fluxo da máquina de estados do modal

```
idle → loading → preview → importing → done
                         ↘ error
```

- **idle**: botão "Importar contatos" na barra de ações
- **loading**: buscando contatos (picker nativo ou parse do vCard)
- **preview**: lista "X novos / Y já cadastrados" com checkboxes
- **importing**: chamando API de criação
- **done**: toast de sucesso + fecha modal

### Parsing vCard (client-side)

Extrai campos de cada bloco `BEGIN:VCARD ... END:VCARD`:
- `FN:` → nome completo
- `TEL` (qualquer variante de tipo) → telefone

Normaliza telefone: remove todos os não-dígitos. Feito inteiramente no browser — o arquivo `.vcf` nunca é enviado ao servidor.

### Endpoint de preview

`POST /api/crm/customers/import/preview`

- Body: `{ phones: string[] }` (telefones normalizados)
- Resposta: `{ existing: string[] }` (phones que já existem no tenant)
- Requer sessão autenticada + permissão `customers.view`
- Uma única query: `findByPhones(tenantId, phones)`

### Endpoint de importação

`POST /api/crm/customers/import`

- Body: `{ contacts: Array<{ name: string; phone: string }> }`
- Para cada contato: verifica por telefone → se novo, cria; se existe, pula
- Não atualiza dados de clientes existentes (importar contato ≠ o próprio cliente se recadastrando)
- Resposta: `{ created: number; skipped: number }`
- Requer permissão `customers.create`

### Componentes e hook

- `ImportContactsButton` — detecta suporte, renderiza o botão condicionalmente (sempre visível; comportamento interno muda)
- `ImportContactsModal` — gerencia estado da máquina, renderiza cada fase
- `useImportContacts` — encapsula lógica de Contact Picker, parse vCard e chamadas de API

### Localização do botão

Na barra de ações do `CustomerList`, ao lado do botão "Novo cliente". Visível apenas para quem tem permissão `customers.create`.

---

## Feature 3 — Deduplicação no cadastro público

### Problema atual

`/api/public/[slug]/customers` só verifica duplicata por CPF. Não verifica por telefone. Quando encontra cliente existente, não atualiza os dados.

### Nova lógica de lookup (ordem de prioridade)

```
1. Busca por CPF normalizado (se fornecido)
2. Se não encontrou → busca por telefone normalizado
3. Se encontrou (qualquer um):
     → atualiza registro com dados do formulário
     → cria sessão e retorna
4. Se não encontrou:
     → cria novo cliente
     → cria sessão e retorna
```

### Campos atualizados no upsert

Quando cliente já existe: `name`, `phone`, `email`, `birthDate`, `cpf` (se registro existente estava sem CPF), `consentGiven: true`, `consentDate: new Date()`, `consentOrigin: 'public_booking'`.

### Edge case: CPF bate com cliente A, telefone bate com cliente B

Prioriza o match de CPF. Ignora o match de telefone. Não mescla registros — mesclagem de duplicatas é escopo de fase futura.

### Normalização de telefone

`phone.replace(/\D/g, '')` — extrai apenas dígitos antes de buscar e antes de salvar.

### Escopo da mudança

Apenas `/api/public/[slug]/customers/route.ts`. Nenhuma alteração no `CustomerRepository` principal (fluxo público é autocontido).

---

## Permissões necessárias

Verificar se `customers.delete` já existe em `src/shared/auth/permissions.ts`. Se não existir, adicionar.

---

## Arquivos criados/modificados

### Schema
- `prisma/schema.prisma` — campo `deletedAt` + índice

### Domínio CRM
- `src/domains/crm/customer.repository.ts` — filtros `deletedAt`, `softDelete`, `restore`, `findDeletedById`
- `src/domains/crm/customer.service.ts` — métodos `delete`, `restore`

### API Routes
- `src/app/api/crm/customers/[customerId]/route.ts` — adicionar `DELETE`
- `src/app/api/crm/customers/[customerId]/restore/route.ts` — novo `POST`
- `src/app/api/crm/customers/import/preview/route.ts` — novo `POST`
- `src/app/api/crm/customers/import/route.ts` — novo `POST`
- `src/app/api/public/[slug]/customers/route.ts` — atualizar lógica de dedup

### Componentes
- `src/components/domain/crm/customer-card.tsx` — adicionar menu de ações
- `src/components/domain/crm/customer-list.tsx` — adicionar `ImportContactsButton`
- `src/components/domain/crm/import-contacts-modal.tsx` — novo
- `src/components/domain/crm/import-contacts-button.tsx` — novo

### Hooks
- `src/hooks/crm/use-import-contacts.ts` — novo

### Permissões
- `src/shared/auth/permissions.ts` — verificar/adicionar `customers.delete`

---

## O que não está no escopo

- Mesclagem automática de clientes duplicados
- Página de "Clientes arquivados" (restauração disponível via URL direta do perfil)
- Exportação de clientes para vCard
- Importação via CSV
