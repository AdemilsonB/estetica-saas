# Spec: Layout Redesign — Visual Polish + Responsividade

**Data:** 2026-06-02  
**Status:** Aprovado  
**Abordagem:** Refatoração completa do App Shell + tokens de cor + correções de responsividade

---

## Objetivo

Elevar o padrão visual do produto de "básico" para profissional, e resolver os problemas críticos de responsividade mobile. Uma entrega única e coesa — sem estados intermediários.

---

## Decisões de design aprovadas

| Decisão | Escolha |
|---|---|
| Escopo | Refatoração completa (visual + responsividade juntos) |
| Estilo visual | Light Warm — off-white, acento terracota/âmbar |
| Desktop sidebar | Toggle collapse/expand — expandida por padrão (~220px), colapsada (~52px), preferência salva em localStorage |
| Mobile navegação | Header topbar com hamburger + drawer lateral deslizante (substitui bottom nav) |
| Configurações → Layout | Painel expandido com 6 tokens de cor editáveis individualmente |

---

## Paleta de cores — Novos defaults warm

| Token CSS | Nome amigável | Valor padrão | Uso |
|---|---|---|---|
| `--primary` | Cor da marca | `#c8916a` | Botões, ícones ativos, links |
| `--background` | Fundo da tela | `#faf7f4` | Background geral das páginas |
| `--accent` | Fundo de seleção | `#fdf0e8` | Item ativo na sidebar, hover states |
| `--border` | Bordas e separadores | `#e8ddd3` | Cards, dividers, inputs |
| `--foreground` | Texto principal | `#3d2b1f` | Títulos, texto de destaque |
| `--muted-foreground` | Texto secundário | `#8a7060` | Descrições, hints, labels |

Todos editáveis em Configurações → Layout. O sistema de branding por tenant (CSS variables injetadas pelo AppLayout) continua funcionando — esses são os defaults do produto quando o tenant não personalizou.

---

## Seção 1 — Database

### Migration aditiva em `BrandingConfig`

**Adicionar:**
- `borderColor String @default("#e8ddd3")`
- `foregroundColor String @default("#3d2b1f")`
- `mutedColor String @default("#8a7060")`

**Atualizar defaults existentes:**
- `primaryColor`: `#191919` → `#c8916a`
- `backgroundColor`: `#f8f8f7` → `#faf7f4`
- `accentColor`: `#f59e0b` → `#fdf0e8`

**Remover:**
- `secondaryColor` — coluna nunca usada na UI. Verificar referências antes; se houver, tornar nullable em vez de dropar.

---

## Seção 2 — Backend

### 2.1 `buildCssVariables.ts`

Adicionar emissão dos novos tokens:
- `--border` ← `borderColor`
- `--foreground` ← `foregroundColor`
- `--muted-foreground` ← `mutedColor`

Remover emissão de `--secondary`.

### 2.2 `branding.schemas.ts`

Adicionar campos ao `UpdateBrandingSchema`:
```typescript
borderColor: hexColor.optional(),
foregroundColor: hexColor.optional(),
mutedColor: hexColor.optional(),
```
Remover `secondaryColor`.

### 2.3 `branding.repository.ts` + `branding.service.ts`

Atualizar para incluir/persistir os novos campos. Remover referências a `secondaryColor`.

### 2.4 `iam.service.ts` — `getCurrentUser`

Incluir `tenant.name` na query:

```typescript
const user = await prisma.user.findFirst({
  where: { id: session.userId, tenantId: session.tenantId },
  select: {
    id: true, tenantId: true, email: true, name: true,
    role: true, permissions: true,
    tenant: { select: { name: true } },
  },
})
```

Atualizar `CurrentUser` type para incluir `businessName: string`.

### 2.5 `app/(app)/layout.tsx`

Passar `logoUrl` e `businessName` como props para o `AppShell`:

```typescript
<AppShell logoUrl={config?.logoUrl ?? null} businessName={tenant?.name ?? ''}>
  {children}
</AppShell>
```

---

## Seção 3 — Frontend

### 3.1 `globals.css` — Novos defaults warm

Atualizar variáveis CSS `@theme inline`:
- `--color-primary`: `#c8916a`
- `--color-background`: `#faf7f4`
- `--color-accent`: `#fdf0e8`
- `--color-border`: `#e8ddd3`
- `--color-foreground`: `#3d2b1f`
- `--color-muted-foreground`: `#8a7060`

### 3.2 `app-shell.tsx` — Redesign completo

**Remover:**
- Bottom nav mobile (`<nav className="sticky bottom-0 ...">`)
- Texto hardcoded "SaaS Estética" e "Operational Workspace"
- Bloco "Negócio ativo" com `user?.name`
- Texto "Workspace operacional" no header

**Adicionar props:**
```typescript
interface AppShellProps {
  children: ReactNode
  logoUrl: string | null
  businessName: string
}
```

**Nova sidebar desktop (xl+):**
- Cabeçalho: `<Link href="/dashboard">` com logo do tenant (`<img>` se logoUrl, iniciais como fallback em div âmbar) + nome do negócio
- Botão toggle collapse/expand: estado salvo em `localStorage` com chave `sidebar-collapsed`
- Estado colapsado: `w-[52px]` — só ícones com `<Tooltip>` no hover
- Estado expandido: `w-[220px]` — ícone + label + descrição
- Rodapé: avatar com iniciais + nome do usuário + botão sair discreto

**Novo header mobile (< xl):**
- Esquerda: botão hamburger que abre o Sheet drawer
- Centro: logo do tenant + nome do negócio
- Direita: avatar do usuário (iniciais em círculo âmbar)

**Novo drawer mobile:**
- `<Sheet side="left">` do Shadcn UI (já disponível no projeto)
- Mesmos itens de navegação da sidebar desktop
- User info + logout no rodapé
- Fecha automaticamente ao navegar (`useEffect` observando `pathname`)

### 3.3 `branding-form.tsx` — Expansão do painel de cores

Substituir a seção de cores atual por painel com 6 color pickers:
1. Cor da marca (`primaryColor`)
2. Fundo da tela (`backgroundColor`)
3. Fundo de seleção (`accentColor`)
4. Bordas e separadores (`borderColor`) — novo
5. Texto principal (`foregroundColor`) — novo
6. Texto secundário (`mutedColor`) — novo

Cada picker: swatch clicável (`<input type="color">`) + input hex + label + descrição do uso.

Botão "Restaurar padrão warm" preenche todos os 6 campos com os valores default da paleta warm.

A prévia ao vivo existente continua funcionando (já lê CSS variables em tempo real).

---

## Seção 4 — Correções de responsividade

### 4.1 `relatorios/layout.tsx` — CRÍTICO

```tsx
<div className="flex flex-col gap-6 md:flex-row md:gap-8">
  <aside className="w-full md:w-52 md:shrink-0">
    {/* mobile: <Select> com as rotas de relatório; md+: lista lateral normal */}
    <ReportsSidebar />
  </aside>
  <div className="min-w-0 flex-1">{children}</div>
</div>
```

`ReportsSidebar` renderiza `<Select>` com `useRouter` em mobile (`< md`) e lista de links em `md+`.

### 4.2 Selects fixos nas páginas de relatório (4 arquivos)

`SelectTrigger className="w-52"` → `className="w-full sm:w-52"`  
`SelectTrigger className="w-48"` → `className="w-full sm:w-48"`

Arquivos: `relatorios/agendamentos/page.tsx`, `relatorios/profissionais/page.tsx`, `relatorios/financeiro/page.tsx`, `relatorios/clientes/page.tsx`

### 4.3 `dashboard/page.tsx` — grid de métricas

`sm:grid-cols-2 xl:grid-cols-4` → `grid-cols-2 lg:grid-cols-4`

### 4.4 `login/login-client.tsx`

- Cores hardcoded (`#f7f6f3`, `#191919`, `#e5e5e5`, `#787774`) → tokens Tailwind (`bg-background`, `text-foreground`, `border-border`, `text-muted-foreground`)
- Painel esquerdo: `hidden lg:flex` → `hidden md:flex`

### 4.5 `configuracoes/page.tsx` — tabs em mobile

Wrapper de tabs com `overflow-x-auto` e `scrollbar-hide` para não quebrar layout em telas < 640px.

### 4.6 Tabelas com scroll (3 arquivos)

Adicionar wrapper com fade gradient nas bordas via CSS `mask-image`:
- `src/components/domain/reports/report-table.tsx`
- `src/components/domain/billing/billing-plans-content.tsx`
- `src/components/domain/settings/commissions-grid.tsx`

---

## Arquivos modificados

### Database / Prisma
- `prisma/schema.prisma`
- `prisma/migrations/` (nova migration aditiva)

### Backend
- `src/lib/branding/build-css-variables.ts`
- `src/domains/iam/branding.schemas.ts`
- `src/domains/iam/branding.service.ts`
- `src/domains/iam/branding.repository.ts`
- `src/domains/iam/iam.service.ts`
- `src/hooks/use-current-user.ts`
- `src/app/(app)/layout.tsx`

### Frontend
- `src/app/globals.css`
- `src/components/app/app-shell.tsx`
- `src/components/domain/settings/branding-form.tsx`
- `src/app/(app)/relatorios/layout.tsx`
- `src/app/(app)/relatorios/agendamentos/page.tsx`
- `src/app/(app)/relatorios/profissionais/page.tsx`
- `src/app/(app)/relatorios/financeiro/page.tsx`
- `src/app/(app)/relatorios/clientes/page.tsx`
- `src/app/(app)/dashboard/page.tsx`
- `src/app/(auth)/login/login-client.tsx`
- `src/app/(app)/configuracoes/page.tsx`
- `src/components/domain/reports/report-table.tsx`
- `src/components/domain/billing/billing-plans-content.tsx`
- `src/components/domain/settings/commissions-grid.tsx`

---

## Restrições

- Sistema de branding do tenant continua funcionando — novos tokens são defaults, substituídos pelas CSS variables do tenant quando configurado
- `secondaryColor`: verificar referências no código antes de dropar; se houver, tornar nullable
- `localStorage` para estado da sidebar: chave `sidebar-collapsed`, valor `'true'|'false'`
- Drawer mobile: usar `<Sheet>` do Shadcn (já disponível no projeto)
- Testes existentes de branding devem ser atualizados para os novos campos
