# Design: Pacote UX Mobile + Reorganização de Configurações

**Data:** 2026-06-15
**Branch:** `feat/ux-mobile-configuracoes`
**Escopo:** Exclusivamente camada de apresentação (Frontend). Zero alterações em services, repositories ou schema.

---

## Contexto

Quatro melhorias de UX agrupadas em uma branch:

1. Bottom navigation bar para mobile
2. Reorganização da página de configurações em cards híbridos
3. Avatar do usuário leva para `/equipe`
4. Varredura e remoção global de `autoFocus` em modais e sheets

---

## ENTREGA 1 — Bottom Navigation Bar (Mobile)

### Breakpoints definidos

| Viewport | Navegação |
|---|---|
| < 768px (mobile) | Bottom nav fixa |
| ≥ 768px (tablet) | Sidebar sempre expandida, sem botão de colapso |
| ≥ 1280px (desktop) | Sidebar com toggle colapso/expansão (comportamento atual) |

O breakpoint da sidebar muda de `xl:` (1280px) para `md:` (768px). O header mobile com hamburger é removido — substituído pela bottom nav abaixo de `md`.

### Componente novo: `src/components/app/bottom-nav.tsx`

5 itens fixos:

| Posição | Ícone | Label | Ação |
|---|---|---|---|
| 1 | `Calendar` | Agenda | navega `/agenda` |
| 2 | `Users` | Clientes | navega `/clientes` |
| 3 | `Plus` | — | chama `onNewAppointment()` (FAB elevado) |
| 4 | `DollarSign` | Financeiro | navega `/financeiro` |
| 5 | `Menu` | Menu | abre bottom drawer |

**FAB Plus:**
- Elevado acima da barra com `transform: translateY(-12px)` e sombra
- Fundo `bg-primary`, ícone `text-primary-foreground`
- Sem label
- Chama a prop `onNewAppointment` → abre `CreateAppointmentModal` (já existente)

**Bottom drawer "Menu":**
- Sheet Shadcn `side="bottom"`, altura automática
- Lista: Serviços `/servicos`, Produtos `/produtos`, Equipe `/equipe`, Configurações `/configuracoes`
- Card de usuário ao final: avatar + nome + cargo + link "Ver equipe" → `/equipe`

**safe-area:**
```tsx
style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 0.75rem)' }}
```

### Mudanças em `src/components/app/app-shell.tsx`

- `aside`: `hidden xl:flex` → `hidden md:flex`
- Botão de colapso (toggle): renderizar apenas em `xl:` com `hidden xl:flex` no elemento do botão
- Header mobile (`<header>` com hamburger): remover completamente — `BottomNav` substitui no mobile
- Padding inferior do content: `pb-24 md:pb-0` para não sobrepor bottom nav
- Estado `drawerOpen` migra para controlar o bottom drawer do `BottomNav`
- `CreateAppointmentModal` instanciado no `AppShell`, controlado por `openNewAppointment` state
- Prop `onNewAppointment` passada para `BottomNav`

### Ativação de item

Item ativo: `pathname.startsWith(item.href)` → `text-primary` e ícone com `fill-primary/20`. Itens inativos: `text-muted-foreground`.

---

## ENTREGA 2 — Configurações com cards híbridos

### Estrutura da página

Substituir `<Tabs>` por 3 `<SettingsGroup>` contendo `<SettingsCard>` com botão "Editar" que abre sheet.

### Componentes novos

**`src/components/domain/settings/settings-group.tsx`**
Props: `title`, `badge?` (`'essencial' | 'resultado' | null`), `children`
Estado: `expanded` (booleano, controlado localmente). Grupo 1 inicia expandido, Grupos 2 e 3 colapsados.
Header clicável com chevron animado (`rotate-180` quando expandido).

**`src/components/domain/settings/settings-card.tsx`**
Props: `icon`, `title`, `subtitle`, `statusBadge?`, `children`, `onEdit`
Layout: header com ícone + título + subtítulo + badge de status à direita + botão "Editar" (abre sheet).
Sem colapso próprio — visibilidade controlada pelo `SettingsGroup` pai.

**`src/components/domain/settings/settings-card-sheet.tsx`**
Wrapper de `Sheet` do Shadcn: `side="right"` no desktop, `side="bottom"` no mobile (`useMediaQuery`).
Props: `open`, `onClose`, `title`, `children`
**Regra de teclado:** nenhum `autoFocus` nos formulários filhos. Verificar e remover qualquer `autoFocus` nos forms existentes que forem usados dentro dos sheets.

### Grupos e cards

**GRUPO 1 — "Configure seu negócio"** badge `Essencial`, inicia expandido

| Card | Ícone | Componente existente | Status |
|---|---|---|---|
| Dados do negócio | `Building2` | `BusinessInfoForm` | Chama `GET /api/iam/business-info`; campos nome+telefone preenchidos → `✓ Completo` |
| Horários de funcionamento | `Clock` | `BusinessHoursForm` | ≥ 1 dia ativo → `✓ Configurado` |
| Identidade visual | `Palette` | `BrandingForm` | `logoUrl != null` → `✓ Logo enviada` |

**GRUPO 2 — "Divulgue e automatize"** sem badge, inicia colapsado

| Card | Ícone | Componente existente | Status |
|---|---|---|---|
| Meu link de agendamento | `Link` | `LinkSharingHub` | badge `💡 Dica` fixo |
| Regras de agendamento online | `Settings2` | `SchedulingPolicyForm` | nenhum |
| WhatsApp e notificações | `MessageCircle` | `WhatsAppSettingsForm` + `NotificationHistory` | `useEvolutionStatus()` → `Conectado` / `Inativo` |
| Automações de mensagens | `Zap` | `WhatsAppAutomationsForm` | banner inline se WhatsApp desconectado |

**GRUPO 3 — "Financeiro e acesso"** sem badge, inicia colapsado

| Card | Ícone | Componente existente | Observação |
|---|---|---|---|
| Taxas de pagamento | `CreditCard` | `CardFeesForm` | nenhuma |
| Plano e assinatura | `Sparkles` | `BillingPlansContent` | visível apenas se `user?.isOwner` |
| Ficha de anamnese | `ClipboardList` | texto estático | card estático sem botão "Editar"; link direto → `/servicos` |

### Comportamento mobile

- Cards ocupam largura total
- Tap no header do grupo expande/colapsa
- Ao expandir card: `element.scrollIntoView({ behavior: 'smooth', block: 'start' })`
- Sheet abre `side="bottom"` no mobile via `useMediaQuery('(max-width: 767px)')`

### Lazy load do BrandingForm

Manter o comportamento atual: `BrandingForm` só carrega os dados quando o sheet de Identidade visual é aberto (fetch lazy, igual à lógica da aba `layout` atual).

---

## ENTREGA 3 — Avatar → `/equipe`

### Desktop (sidebar)

Substituir o bloco de usuário no rodapé da sidebar por `DropdownMenu` (Shadcn):
- Trigger: bloco avatar + nome + badge de plano (mesmo visual atual, mas clicável)
- Itens: "Minha equipe" → `/equipe`; separador; "Sair" → `handleLogout()`
- Sem lógica nova

### Mobile (bottom drawer "Menu")

Card de usuário no bottom drawer já descrito na Entrega 1:
- Avatar + Nome + cargo
- Link "Ver equipe" → `/equipe`
- Botão "Sair" → `handleLogout()`

**Sem página `/perfil` nova.** Toda edição de perfil já existe em `/equipe`.

---

## ENTREGA 4 — Varredura global de autoFocus

Arquivos com `autoFocus` ou `useEffect → .focus()` identificados:

| Arquivo | Ação |
|---|---|
| `src/components/domain/crm/create-customer-modal.tsx` | Remover `autoFocus` |
| `src/components/domain/crm/edit-customer-modal.tsx` | Remover `autoFocus` |
| `src/components/domain/iam/invite-member-modal.tsx` | Remover `autoFocus` |
| `src/components/domain/iam/roles-manager.tsx` | Remover `autoFocus` |
| `src/components/domain/services/category-form-modal.tsx` | Remover `autoFocus` |

Busca adicional com `grep -r "autoFocus\|\.focus()"` nos formulários usados nos sheets da Entrega 2.

**Inputs permanecem interativos** (não `disabled`, não `readOnly`). Apenas sem foco automático ao montar.

---

## Arquivos criados/modificados

### Criados
- `src/components/app/bottom-nav.tsx`
- `src/components/domain/settings/settings-group.tsx`
- `src/components/domain/settings/settings-card.tsx`
- `src/components/domain/settings/settings-card-sheet.tsx`

### Modificados
- `src/components/app/app-shell.tsx` (breakpoints, header, dropdown usuário, modal novo agendamento)
- `src/app/(app)/configuracoes/page.tsx` (substituir Tabs por grupos)
- `src/components/domain/crm/create-customer-modal.tsx`
- `src/components/domain/crm/edit-customer-modal.tsx`
- `src/components/domain/iam/invite-member-modal.tsx`
- `src/components/domain/iam/roles-manager.tsx`
- `src/components/domain/services/category-form-modal.tsx`

---

## Checklist de entrega

- [ ] Branch `feat/ux-mobile-configuracoes` criada
- [ ] Bottom nav funcional no mobile com safe-area padding
- [ ] FAB Plus abre `CreateAppointmentModal`
- [ ] Bottom drawer "Menu" com links completos e card de usuário
- [ ] Sidebar desktop intacta (xl+), tablet sempre expandida (md–xl)
- [ ] Header mobile com hamburger removido
- [ ] Página de configurações sem abas — 3 grupos com cards híbridos
- [ ] Todo conteúdo das 8 abas antigas preservado nos novos cards
- [ ] Nenhum campo com `autoFocus` em modais, sheets ou cards de config
- [ ] Avatar desktop abre DropdownMenu com link para `/equipe` e logout
- [ ] Avatar mobile no drawer abre link para `/equipe`
- [ ] Zero alterações em services, repositories ou schema
- [ ] `npx tsc --noEmit` sem erros
- [ ] PR aberta para `main`
