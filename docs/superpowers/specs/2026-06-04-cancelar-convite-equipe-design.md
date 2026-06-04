# Spec: Cancelar Convite Pendente — Aba Equipe

**Data:** 2026-06-04  
**Status:** Aprovado  
**Escopo:** Funcionalidade de cancelamento de convites pendentes na página `/equipe`, disponível exclusivamente para o dono do tenant (OWNER).

---

## Contexto

O sistema já permite enviar convites por email via `POST /api/iam/invites`. Os convites ficam com status `PENDING` até serem aceitos. Hoje não existe forma de cancelar um convite enviado por engano ou para um email errado.

A funcionalidade de cancelamento remove o registro `TenantInvite` do banco, tornando o link do email inútil — pois o fluxo de aceite (`joinTenant`) exige que o registro exista no banco antes de permitir a entrada no tenant.

---

## Decisões de design

| Decisão | Escolha | Motivo |
|---|---|---|
| O que acontece com o registro | Deletar permanentemente | Sem migration; o mesmo email pode ser re-convidado |
| Confirmação na UI | AlertDialog inline | Evita cancelamentos acidentais |
| Quem pode cancelar | Somente OWNER | Regra de negócio definida pelo usuário |
| Revogação no Supabase | Não realizada | O link fica tecnicamente vivo no Supabase, mas o `joinTenant` bloqueia na ausência do DB record |

---

## Arquitetura

### Backend

**Nova rota:** `DELETE /api/iam/invites/[id]`

```
src/app/api/iam/invites/[id]/route.ts
```

- Extrai `tenantId` via `withTenant(req)`
- Verifica `session.isOwner === true` — lança `ForbiddenError` caso contrário
- Chama `iamService.cancelInvite(tenantId, inviteId)`
- Retorna `204 No Content`

**Novo método no service:** `iamService.cancelInvite(tenantId: string, inviteId: string)`

```
src/domains/iam/iam.service.ts
```

- Delega para `iamRepository.deleteInvite(tenantId, inviteId)`
- Se o repository retornar `count === 0`, lança `NotFoundError`

**Novo método no repository:** `iamRepository.deleteInvite(tenantId: string, inviteId: string)`

```
src/domains/iam/iam.repository.ts
```

```typescript
async deleteInvite(tenantId: string, inviteId: string) {
  return prisma.tenantInvite.deleteMany({
    where: { id: inviteId, tenantId, status: 'PENDING' },
  })
}
```

O filtro `status: PENDING` garante que convites já aceitos não sejam afetados acidentalmente.

---

### Frontend

**Hook:** `useCancelInvite()` adicionado em `src/hooks/iam/use-team.ts`

```typescript
useCancelInvite() → useMutation(DELETE /api/iam/invites/:id)
  onSuccess: invalida ['team-invites']
  onError: toast de erro
```

**UI:** seção de convites pendentes em `src/app/(app)/equipe/page.tsx`

- Botão com ícone `X` (Lucide `X`) ao lado de cada convite
- Visível **somente se** `user?.isOwner === true`
- Loading state durante a mutation (ícone `Loader2` girando)
- Ao clicar: abre `AlertDialog` do Shadcn com:
  - Título: "Cancelar convite"
  - Descrição: "Deseja cancelar o convite enviado para **{email}**? O link do email deixará de funcionar."
  - Botões: "Manter convite" (fechar) / "Cancelar convite" (confirmar, variante destructive)
- Toast de sucesso: "Convite cancelado"

---

## Fluxo completo

```
[OWNER clica no X ao lado do convite]
  ↓
[AlertDialog abre: "Cancelar convite para {email}?"]
  ↓ Clica "Cancelar convite"
[useCancelInvite mutation]
  ↓ DELETE /api/iam/invites/:id
[API route — invites/[id]/route.ts]
  ↓ Verifica session.isOwner === true
  ↓ Chama iamService.cancelInvite(tenantId, inviteId)
[iamService.cancelInvite]
  ↓ Chama iamRepository.deleteInvite(tenantId, inviteId)
[iamRepository.deleteInvite]
  ↓ deleteMany({ id, tenantId, status: PENDING })
  ↓ Retorna { count }
[iamService]
  ↓ count === 0 → NotFoundError
  ↓ count === 1 → sucesso
[API route]
  ↓ 204 No Content
[React Query]
  ↓ onSuccess: invalida ['team-invites']
  ↓ Lista atualizada — convite removido
[Toast]
  ↓ "Convite cancelado"
```

---

## O que o cancelamento invalida

Quando o registro é deletado, o link do email (enviado via Supabase Auth) torna-se inútil porque `iamService.joinTenant()` faz `findInviteByEmailAndTenant()` antes de criar o usuário — sem o registro, retorna `ForbiddenError("Convite não encontrado ou expirado.")`. O token Supabase ainda autentica, mas o fluxo de onboarding bloqueia.

---

## Arquivos a criar/modificar

| Arquivo | Ação |
|---|---|
| `src/app/api/iam/invites/[id]/route.ts` | Criar — novo endpoint DELETE |
| `src/domains/iam/iam.service.ts` | Modificar — adicionar `cancelInvite()` |
| `src/domains/iam/iam.repository.ts` | Modificar — adicionar `deleteInvite()` |
| `src/hooks/iam/use-team.ts` | Modificar — adicionar `useCancelInvite()` |
| `src/app/(app)/equipe/page.tsx` | Modificar — botão X + AlertDialog |

---

## Fora do escopo

- Revogar o token no Supabase Auth (desnecessário dado o bloqueio no join)
- Reenviar convite (funcionalidade separada)
- Log de auditoria de cancelamentos
