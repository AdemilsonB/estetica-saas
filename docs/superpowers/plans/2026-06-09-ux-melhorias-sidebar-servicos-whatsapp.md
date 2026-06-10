# UX Melhorias — Sidebar, Serviços e WhatsApp — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Melhorar a experiência do usuário logado com foto de perfil + badge de plano na sidebar, incentivo de upgrade para plano FREE, badge de WhatsApp pendente, e reorganização das abas de Serviços com seção de Precificação.

**Architecture:** Todas as mudanças são frontend-only. Tasks 1–4 modificam `app-shell.tsx` e os hooks/endpoints que ele consome. Task 5–6 reorganizam as páginas de Serviços e Configurações sem tocar em nenhum domínio de backend.

**Tech Stack:** Next.js 15 App Router, TypeScript strict, TailwindCSS, Shadcn UI, TanStack Query, Supabase Auth (para `avatar_url`)

---

## Mapa de arquivos

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `src/hooks/use-current-user.ts` | Modificar | Adicionar `avatarUrl: string \| null` ao tipo `CurrentUser` |
| `src/domains/iam/iam.service.ts` | Modificar | Buscar `avatar_url` do Supabase Auth e incluir no retorno de `getCurrentUser` |
| `src/components/app/app-shell.tsx` | Modificar | Foto de perfil, badge de plano, card de upgrade FREE, badge WhatsApp |
| `src/app/(app)/servicos/page.tsx` | Modificar | Dois grupos de abas: Catálogo e Precificação |
| `src/app/(app)/configuracoes/page.tsx` | Modificar | Remover DiscountTypesManager e CommissionsGrid; renomear título |

---

## Task 1: Expor `avatarUrl` no endpoint `/api/iam/me`

**Files:**
- Modify: `src/hooks/use-current-user.ts`
- Modify: `src/domains/iam/iam.service.ts`

- [ ] **Passo 1: Adicionar `avatarUrl` ao tipo `CurrentUser`**

Abra `src/hooks/use-current-user.ts` e adicione o campo:

```typescript
export type CurrentUser = {
  id: string
  tenantId: string
  email: string
  name: string
  role: 'OWNER' | 'MANAGER' | 'PROFESSIONAL' | 'RECEPTIONIST'
  isOwner: boolean
  roleId: string | null
  roleName: string
  permissions: Record<string, string[]>
  businessName: string
  avatarUrl: string | null   // ← adicionar esta linha
}
```

- [ ] **Passo 2: Buscar `avatar_url` do Supabase Auth no `getCurrentUser`**

Abra `src/domains/iam/iam.service.ts`. No método `getCurrentUser`, adicione a busca do `avatar_url` logo após a query do Prisma (antes do `return`). O arquivo já importa `supabaseAdmin`:

```typescript
async getCurrentUser(session: SessionContext) {
  const user = await prisma.user.findFirst({
    where: {
      id: session.userId,
      tenantId: session.tenantId,
    },
    select: {
      id: true,
      tenantId: true,
      email: true,
      name: true,
      role: true,
      roleId: true,
      customRole: { select: { id: true, name: true } },
      tenant: { select: { name: true } },
    },
  })

  if (!user) {
    throw new NotFoundError('Usuario')
  }

  // Busca avatar_url do Supabase Auth (pode ser null para usuários sem OAuth)
  const { data: authData } = await supabaseAdmin.auth.admin.getUserById(session.userId)
  const avatarUrl = authData?.user?.user_metadata?.['avatar_url'] as string | null ?? null

  return {
    id: user.id,
    tenantId: user.tenantId,
    email: user.email,
    name: user.name,
    role: user.role,
    isOwner: session.isOwner,
    roleId: user.roleId,
    roleName: session.isOwner ? 'Dono' : (user.customRole?.name ?? 'Sem cargo'),
    permissions: session.permissions,
    businessName: user.tenant.name,
    avatarUrl,   // ← adicionar esta linha
  }
}
```

- [ ] **Passo 3: Verificar tipos**

```bash
npx tsc --noEmit
```

Esperado: zero erros relacionados a `avatarUrl`.

- [ ] **Passo 4: Commit**

```bash
git add src/hooks/use-current-user.ts src/domains/iam/iam.service.ts
git commit -m "feat(iam): expõe avatarUrl do Supabase Auth no endpoint /api/iam/me"
```

---

## Task 2: Sidebar — foto de perfil e badge de plano

**Files:**
- Modify: `src/components/app/app-shell.tsx`

- [ ] **Passo 1: Adicionar imports necessários**

No topo de `src/components/app/app-shell.tsx`, adicione os imports:

```typescript
import { useBillingStatus } from '@/hooks/billing/use-billing-status'
```

- [ ] **Passo 2: Adicionar hooks e estado no topo do `AppShell`**

Logo após `const { canAccess, user, isLoading } = usePermissions()`, adicione:

```typescript
const { data: billingStatus } = useBillingStatus()
const [upgradeCardDismissed, setUpgradeCardDismissed] = useState<boolean>(() => {
  if (typeof window === 'undefined') return false
  return sessionStorage.getItem('upgrade-card-dismissed') === '1'
})
```

- [ ] **Passo 3: Criar componente `UserAvatar` dentro do `AppShell` (antes de `LogoBrand`)**

```typescript
function UserAvatar({ size = 'md' }: { size?: 'md' | 'sm' }) {
  const dim = size === 'sm' ? 'size-9' : 'size-[34px]'
  if (user?.avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={user.avatarUrl}
        alt={user.name}
        className={cn(dim, 'shrink-0 rounded-xl object-cover')}
      />
    )
  }
  return (
    <div className={cn(dim, 'inline-flex shrink-0 items-center justify-center rounded-xl bg-primary/15 text-xs font-bold text-primary')}>
      {getInitials(user?.name ?? 'U')}
    </div>
  )
}
```

- [ ] **Passo 4: Criar componente `PlanBadge` dentro do `AppShell`**

```typescript
function PlanBadge() {
  if (!billingStatus) return null
  const { plan, status, trialEndsAt } = billingStatus

  if (status === 'TRIALING' && trialEndsAt) {
    const daysLeft = Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / 86400000))
    return (
      <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700">
        Trial · {daysLeft}d
      </span>
    )
  }

  const styles: Record<string, string> = {
    FREE:       'bg-slate-100 text-slate-600 border-slate-200',
    STARTER:    'bg-blue-50 text-blue-700 border-blue-200',
    PRO:        'bg-violet-50 text-violet-700 border-violet-200',
    ENTERPRISE: 'bg-amber-50 text-amber-700 border-amber-200',
  }

  return (
    <span className={cn('inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide', styles[plan] ?? styles['FREE'])}>
      {plan}
    </span>
  )
}
```

- [ ] **Passo 5: Substituir o bloco de usuário dentro de `SidebarContent` (versão expandida)**

Localize o bloco `{showLabel && (...)}` que contém o rodapé do usuário (por volta da linha 194) e substitua-o por:

```typescript
{showLabel && (
  <div className="mt-2 space-y-2">
    <div className="flex items-center gap-2 rounded-xl border border-border/50 bg-accent/30 px-3 py-2">
      <UserAvatar />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-medium text-foreground">
          {isLoading ? '...' : (user?.name ?? '—')}
        </span>
        <PlanBadge />
      </span>
      <button
        onClick={handleLogout}
        className="shrink-0 text-muted-foreground transition hover:text-foreground"
        aria-label="Sair da conta"
      >
        <LogOut className="size-4" />
      </button>
    </div>
  </div>
)}
```

- [ ] **Passo 6: Substituir o avatar no header mobile**

Localize o bloco do avatar no header mobile (por volta da linha 267):

```typescript
// Antes:
<div className="inline-flex size-9 items-center justify-center rounded-xl bg-primary/15 text-xs font-bold text-primary">
  {isLoading ? '…' : getInitials(user?.name ?? 'U')}
</div>

// Depois:
<UserAvatar size="sm" />
```

- [ ] **Passo 7: Verificar tipos e renderização**

```bash
npx tsc --noEmit
```

Esperado: zero erros.

- [ ] **Passo 8: Commit**

```bash
git add src/components/app/app-shell.tsx
git commit -m "feat(sidebar): adiciona foto de perfil e badge de plano no rodapé do usuário"
```

---

## Task 3: Sidebar — card de upgrade para plano FREE

**Files:**
- Modify: `src/components/app/app-shell.tsx`

- [ ] **Passo 1: Substituir o bloco `{showLabel && (...)}` criado na Task 2 pela versão com o card de upgrade**

Este passo **substitui completamente** o bloco adicionado na Task 2, passo 5. O conteúdo anterior (bloco do usuário) é mantido — só adiciona o card de upgrade abaixo dele:

```typescript
{showLabel && (
  <div className="mt-2 space-y-2">
    <div className="flex items-center gap-2 rounded-xl border border-border/50 bg-accent/30 px-3 py-2">
      <UserAvatar />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-medium text-foreground">
          {isLoading ? '...' : (user?.name ?? '—')}
        </span>
        <PlanBadge />
      </span>
      <button
        onClick={handleLogout}
        className="shrink-0 text-muted-foreground transition hover:text-foreground"
        aria-label="Sair da conta"
      >
        <LogOut className="size-4" />
      </button>
    </div>

    {billingStatus?.plan === 'FREE' && billingStatus?.status !== 'TRIALING' && !upgradeCardDismissed && (
      <div className="rounded-xl bg-gradient-to-br from-violet-600 to-purple-600 p-3 text-white">
        <div className="flex items-start justify-between gap-1">
          <div className="min-w-0">
            <p className="text-xs font-bold leading-tight">🚀 Desbloqueie mais recursos</p>
            <p className="mt-0.5 text-[10px] leading-tight opacity-80">WhatsApp, relatórios e muito mais</p>
          </div>
          <button
            onClick={() => {
              sessionStorage.setItem('upgrade-card-dismissed', '1')
              setUpgradeCardDismissed(true)
            }}
            className="shrink-0 text-[12px] text-white/60 transition hover:text-white"
            aria-label="Dispensar"
          >
            ×
          </button>
        </div>
        <Link
          href="/configuracoes/planos"
          className="mt-2 block w-full rounded-lg bg-white py-1.5 text-center text-[11px] font-bold text-violet-700 transition hover:bg-white/90"
        >
          Ver planos →
        </Link>
      </div>
    )}
  </div>
)}
```

- [ ] **Passo 2: Verificar tipos**

```bash
npx tsc --noEmit
```

Esperado: zero erros.

- [ ] **Passo 3: Commit**

```bash
git add src/components/app/app-shell.tsx
git commit -m "feat(sidebar): adiciona card de upgrade para plano FREE com dismiss por sessão"
```

---

## Task 4: Sidebar — badge de WhatsApp pendente em Configurações

**Files:**
- Modify: `src/components/app/app-shell.tsx`

- [ ] **Passo 1: Adicionar import do `useEvolutionStatus`**

No topo do arquivo:

```typescript
import { useEvolutionStatus } from '@/hooks/settings/use-evolution-status'
```

- [ ] **Passo 2: Adicionar hook no topo do `AppShell`**

Logo após os outros hooks:

```typescript
const { data: evolutionStatus, isLoading: evolutionLoading } = useEvolutionStatus()
const whatsappPending = !evolutionLoading && evolutionStatus?.connected === false
```

- [ ] **Passo 3: Adicionar prop `hasBadge` ao `NavLink`**

Altere a assinatura do componente `NavLink`:

```typescript
function NavLink({ item, showLabel, hasBadge }: { item: NavSection; showLabel: boolean; hasBadge?: boolean }) {
```

Dentro do JSX do link, adicione o badge após o bloco de label:

```typescript
{showLabel && (
  <span className="min-w-0 flex-1">
    <span className="block text-sm font-medium">{item.label}</span>
    <span className="block text-xs text-muted-foreground">{item.description}</span>
  </span>
)}
{showLabel && hasBadge && (
  <span className="ml-auto inline-flex size-4 shrink-0 items-center justify-center rounded-full bg-green-500 text-[9px] font-bold leading-none text-white">
    !
  </span>
)}
{!showLabel && hasBadge && (
  <span className="absolute right-0.5 top-0.5 size-2 rounded-full bg-green-500" />
)}
```

> **Nota:** Para o badge no modo colapsado funcionar com `absolute`, o elemento pai precisa de `relative`. Envolva o `<Link>` em um `<div className="relative">` apenas para o item de configurações, ou adicione `relative` ao `<Link>` diretamente via `cn`.

Alternativa mais simples — adicione `relative` à classe do link quando `hasBadge` for true:

```typescript
<Link
  href={item.href}
  className={cn(
    'flex items-center rounded-xl transition',
    hasBadge && 'relative',
    showLabel ? 'gap-3 px-3 py-2.5' : 'size-10 justify-center',
    isActive
      ? 'bg-accent text-primary'
      : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
  )}
>
```

- [ ] **Passo 4: Passar `hasBadge` para o item de Configurações**

Localize onde `configItem` é renderizado (por volta da linha 182) e passe a prop:

```typescript
{configItem && (
  showLabel ? (
    <NavLink item={configItem} showLabel hasBadge={whatsappPending} />
  ) : (
    <Tooltip>
      <TooltipTrigger asChild>
        <div><NavLink item={configItem} showLabel={false} hasBadge={whatsappPending} /></div>
      </TooltipTrigger>
      <TooltipContent side="right">{configItem.label}</TooltipContent>
    </Tooltip>
  )
)}
```

- [ ] **Passo 5: Verificar tipos**

```bash
npx tsc --noEmit
```

Esperado: zero erros.

- [ ] **Passo 6: Commit**

```bash
git add src/components/app/app-shell.tsx
git commit -m "feat(sidebar): adiciona badge de WhatsApp pendente no item Configurações"
```

---

## Task 5: Página Serviços — grupos Catálogo e Precificação

**Files:**
- Modify: `src/app/(app)/servicos/page.tsx`

- [ ] **Passo 1: Substituir o conteúdo completo de `servicos/page.tsx`**

```typescript
'use client'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ServiceCatalog } from '@/components/domain/services/service-catalog'
import { PackageCatalog } from '@/components/domain/services/package-catalog'
import { PromotionCatalog } from '@/components/domain/services/promotion-catalog'
import { CategoryCatalog } from '@/components/domain/services/category-catalog'
import { DiscountTypesManager } from '@/components/domain/settings/discount-types-manager'
import { CommissionsGrid } from '@/components/domain/settings/commissions-grid'

export default function ServicosPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Serviços</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Gerencie seus serviços, pacotes, promoções e precificação
        </p>
      </div>

      <div className="space-y-6">
        {/* Grupo 1: Catálogo */}
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Catálogo</p>
          <Tabs defaultValue="servicos">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="categorias">Categorias</TabsTrigger>
              <TabsTrigger value="servicos">Serviços</TabsTrigger>
              <TabsTrigger value="pacotes">Pacotes</TabsTrigger>
              <TabsTrigger value="promocoes">Promoções</TabsTrigger>
            </TabsList>

            <TabsContent value="servicos" className="mt-6">
              <div className="rounded-2xl border border-border/50 bg-card p-6 shadow-sm">
                <h2 className="mb-4 text-base font-semibold text-foreground">Catálogo de serviços</h2>
                <ServiceCatalog />
              </div>
            </TabsContent>

            <TabsContent value="pacotes" className="mt-6">
              <div className="rounded-2xl border border-border/50 bg-card p-6 shadow-sm">
                <h2 className="mb-4 text-base font-semibold text-foreground">Pacotes</h2>
                <p className="mb-4 text-sm text-muted-foreground">
                  Agrupe serviços em pacotes com preço especial.
                </p>
                <PackageCatalog />
              </div>
            </TabsContent>

            <TabsContent value="promocoes" className="mt-6">
              <div className="rounded-2xl border border-border/50 bg-card p-6 shadow-sm">
                <h2 className="mb-4 text-base font-semibold text-foreground">Promoções</h2>
                <p className="mb-4 text-sm text-muted-foreground">
                  Crie descontos temporários para serviços ou pacotes.
                </p>
                <PromotionCatalog />
              </div>
            </TabsContent>

            <TabsContent value="categorias" className="mt-6">
              <div className="rounded-2xl border border-border/50 bg-card p-6 shadow-sm">
                <h2 className="mb-4 text-base font-semibold text-foreground">Categorias de serviços</h2>
                <CategoryCatalog />
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Grupo 2: Precificação */}
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Precificação</p>
          <Tabs defaultValue="descontos">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="descontos">Descontos</TabsTrigger>
              <TabsTrigger value="comissoes">Comissões</TabsTrigger>
            </TabsList>

            <TabsContent value="descontos" className="mt-6">
              <div className="rounded-2xl border border-border/50 bg-card p-6 shadow-sm">
                <h2 className="mb-4 text-base font-semibold text-foreground">Tipos de desconto</h2>
                <p className="mb-4 text-sm text-muted-foreground">
                  Configure os tipos de desconto aplicáveis em atendimentos.
                </p>
                <DiscountTypesManager />
              </div>
            </TabsContent>

            <TabsContent value="comissoes" className="mt-6">
              <div className="rounded-2xl border border-border/50 bg-card p-6 shadow-sm">
                <h2 className="mb-4 text-base font-semibold text-foreground">Comissões</h2>
                <p className="mb-4 text-sm text-muted-foreground">
                  Defina as comissões por profissional e serviço.
                </p>
                <CommissionsGrid />
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Passo 2: Verificar tipos**

```bash
npx tsc --noEmit
```

Esperado: zero erros.

- [ ] **Passo 3: Commit**

```bash
git add src/app/\(app\)/servicos/page.tsx
git commit -m "feat(servicos): adiciona seção Precificação com Descontos e Comissões"
```

---

## Task 6: Configurações — remover Descontos e Comissões da aba Financeiro

**Files:**
- Modify: `src/app/(app)/configuracoes/page.tsx`

- [ ] **Passo 1: Remover imports não mais usados**

Localize os imports no topo do arquivo e remova as linhas de `DiscountTypesManager` e `CommissionsGrid`:

```typescript
// Remover estas duas linhas:
import { DiscountTypesManager } from '@/components/domain/settings/discount-types-manager'
import { CommissionsGrid } from '@/components/domain/settings/commissions-grid'
```

- [ ] **Passo 2: Substituir o conteúdo da `TabsContent value="financeiro"`**

Localize o bloco completo da aba financeiro e substitua:

```typescript
// Antes:
<TabsContent value="financeiro" className="mt-6">
  <div className="space-y-8 rounded-2xl border border-white/80 bg-white/85 p-6 shadow-sm">
    <h2 className="text-base font-semibold text-slate-950">Configurações financeiras</h2>
    <DiscountTypesManager />
    <div className="border-t border-slate-100 pt-6">
      <CommissionsGrid />
    </div>
    <div className="border-t border-slate-100 pt-6">
      <CardFeesForm />
    </div>
  </div>
</TabsContent>

// Depois:
<TabsContent value="financeiro" className="mt-6">
  <div className="rounded-2xl border border-white/80 bg-white/85 p-6 shadow-sm">
    <h2 className="mb-4 text-base font-semibold text-slate-950">Taxas de pagamento</h2>
    <CardFeesForm />
  </div>
</TabsContent>
```

- [ ] **Passo 3: Verificar tipos**

```bash
npx tsc --noEmit
```

Esperado: zero erros.

- [ ] **Passo 4: Commit**

```bash
git add src/app/\(app\)/configuracoes/page.tsx
git commit -m "refactor(configuracoes): remove Descontos e Comissões da aba Financeiro; renomeia para Taxas de pagamento"
```

---

## Verificação final

- [ ] **Rodar type check completo**

```bash
npx tsc --noEmit
```

Esperado: zero erros.

- [ ] **Verificar critérios de aceite manualmente**

Abra o app e verifique cada item:

1. Foto aparece na sidebar se o usuário fez login via Google/GitHub (tem `avatar_url`)
2. Badge de plano exibe o plano correto com a cor correta
3. Card de upgrade aparece apenas para plano FREE e some após clicar "×" — não reaparece sem fechar o browser
4. Badge "!" verde aparece no item Configurações quando WhatsApp não está conectado; some ao conectar
5. Página Serviços exibe dois grupos de abas: Catálogo e Precificação
6. Aba Precificação → Descontos mostra `DiscountTypesManager`; Comissões mostra `CommissionsGrid`
7. Página Configurações → aba Financeiro mostra apenas "Taxas de pagamento" com `CardFeesForm`

- [ ] **Abrir PR para main**

```bash
git push origin HEAD
gh pr create --title "feat(ux): sidebar com foto/plano/upgrade, badge WhatsApp, Precificação em Serviços" --body "$(cat <<'EOF'
## Resumo

- Sidebar: foto de perfil, badge de plano e card de upgrade para FREE (dismiss por sessão)
- WhatsApp: badge "!" no item Configurações quando Evolution não está conectado
- Serviços: seção Precificação com Descontos e Comissões migradas de Configurações

## Checklist

- [ ] Foto de perfil exibe quando avatarUrl disponível
- [ ] Badge de plano correto por status
- [ ] Card FREE dispensável por sessão
- [ ] Badge WhatsApp aparece/some corretamente
- [ ] Abas Serviços reorganizadas
- [ ] Config. → Financeiro só mostra Taxas de pagamento
- [ ] `npx tsc --noEmit` zero erros
EOF
)"
```
