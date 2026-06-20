# Spec — Navegação por Swipe Horizontal (Mobile)

**Data:** 2026-06-20
**Status:** Aprovado
**Escopo:** Mobile only (`< md`)

---

## 1. Objetivo

Adicionar navegação por swipe horizontal entre as 4 páginas principais do app mobile, com animação em tempo real (página segue o dedo), idêntico ao padrão Instagram/iOS. Fora dessas 4 rotas, o comportamento atual do app é **totalmente preservado**.

---

## 2. Ciclo de swipe

```
← [/agenda] ↔ [/servicos] ↔ [/clientes] ↔ [/equipe] ↔ [/configuracoes] →
      0              1              2             3               4
```

- Swipe **esquerda**: avança no ciclo (Agenda → Serviços → … → Configurações)
- Swipe **direita**: recua no ciclo (Configurações → Equipe → … → Agenda)
- Na borda esquerda (`/agenda`): swipe direita ignorado
- Na borda direita (`/configuracoes`): swipe esquerda ignorado

---

## 3. Mapa completo de rotas e comportamento do swipe

| Rota | Swipe ativo? | Comportamento |
|---|---|---|
| `/agenda` | ✅ ciclo | avança para `/servicos` |
| `/servicos` | ✅ ciclo | recua para `/agenda` / avança para `/clientes` |
| `/clientes` | ✅ ciclo | recua para `/servicos` / avança para `/equipe` |
| `/equipe` | ✅ ciclo | recua para `/clientes` / avança para `/configuracoes` |
| `/configuracoes` | ✅ ciclo | recua para `/equipe` |
| `/clientes/[id]` | ✅ back | swipe direita → `router.back()` |
| `/dashboard` | ❌ | sem swipe |
| `/financeiro` | ❌ | sem swipe |
| `/financeiro/cobrancas` | ❌ | sem swipe |
| `/financeiro/despesas` | ❌ | sem swipe |
| `/financeiro/transacoes` | ❌ | sem swipe |
| `/configuracoes/catalogo` | ❌ | sem swipe |
| `/configuracoes/planos` | ❌ | sem swipe |
| `/relatorios` | ❌ | sem swipe |
| `/relatorios/agendamentos` | ❌ | sem swipe |
| `/relatorios/clientes` | ❌ | sem swipe |
| `/relatorios/financeiro` | ❌ | sem swipe |
| `/relatorios/profissionais` | ❌ | sem swipe |
| `/produtos` | ❌ | sem swipe |
| `/onboarding/catalogo` | ❌ | sem swipe |

> **Regra de detecção de sub-rota:** se `pathname` não corresponde exatamente a uma das 5 rotas do ciclo, o swipe do ciclo é desativado. Sub-rotas de `/configuracoes` (ex: `/configuracoes/planos`) são distintas de `/configuracoes` e ficam fora do ciclo. Para `/clientes/[id]` especificamente, swipe direita chama `router.back()`.

---

## 4. Componentes

### 4.1 `SwipeNavWrapper` (novo)

**Arquivo:** `src/components/app/swipe-nav-wrapper.tsx`
**Tipo:** Client Component

**Responsabilidades:**
- Detectar o índice da rota atual no ciclo `SWIPE_ROUTES`
- Envolver `children` em `motion.div` com `drag="x"`
- Animar entrada/saída via `AnimatePresence` com `key={pathname}`
- Chamar `router.push()` ao atingir threshold
- Em sub-rota de `/clientes/[id]`: habilitar swipe direita → `router.back()`
- Fora das rotas acima: renderizar `children` sem wrapper de animação (pass-through)
- Chamar `router.prefetch()` nas rotas adjacentes ao montar

**Constantes:**
```ts
const SWIPE_ROUTES = ['/agenda', '/servicos', '/clientes', '/equipe', '/configuracoes'] as const
const DRAG_THRESHOLD = 80      // px de offset para disparar navegação
const VELOCITY_THRESHOLD = 500 // px/s de velocidade para disparar navegação
```

**Detecção de modo:**
```ts
const cycleIndex = SWIPE_ROUTES.findIndex(r => pathname === r)
const isClientDetail = pathname.startsWith('/clientes/') && pathname !== '/clientes'
const isInCycle = cycleIndex !== -1
```

**Variantes de animação:**
```ts
// direction: -1 = avançando (swipe esq), +1 = recuando (swipe dir)
const variants = {
  enter:  (dir: number) => ({ x: dir < 0 ? '100%' : '-100%' }),
  center: { x: 0 },
  exit:   (dir: number) => ({ x: dir < 0 ? '-100%' : '100%' }),
}
// transition: spring com damping 30, stiffness 300
```

**Drag config:**
```ts
drag="x"
dragDirectionLock     // resolve conflito com scroll vertical
dragMomentum={false}  // sem momentum pós-soltar
dragConstraints={{ left: 0, right: 0 }}
dragElastic={0.15}    // resistência suave nas bordas do ciclo
```

**onDragEnd logic:**
```ts
(_, { offset, velocity }) => {
  const goNext = offset.x < -DRAG_THRESHOLD || velocity.x < -VELOCITY_THRESHOLD
  const goPrev = offset.x >  DRAG_THRESHOLD || velocity.x >  VELOCITY_THRESHOLD

  if (isInCycle) {
    if (goNext && cycleIndex < SWIPE_ROUTES.length - 1) navigate(+1)
    if (goPrev && cycleIndex > 0)                       navigate(-1)
    // nas bordas: snap-back automático (AnimatePresence não troca de rota)
  }

  if (isClientDetail && goPrev) router.back()
}
```

**Prefetch no mount:**
```ts
useEffect(() => {
  if (!isInCycle) return
  if (cycleIndex > 0) router.prefetch(SWIPE_ROUTES[cycleIndex - 1])
  if (cycleIndex < SWIPE_ROUTES.length - 1) router.prefetch(SWIPE_ROUTES[cycleIndex + 1])
}, [cycleIndex])
```

---

### 4.2 `MobileHeader` (modificado)

**Arquivo:** `src/components/app/mobile-header.tsx`

**Mudança:** detectar se está em sub-rota e alternar o botão esquerdo.

**Lógica:**
```ts
// Rotas que mostram hambúrguer (modo principal)
// Inclui raízes do ciclo + raízes de outras seções acessíveis via sidebar
const MAIN_ROUTES = ['/agenda', '/servicos', '/clientes', '/equipe', '/configuracoes',
                     '/dashboard', '/financeiro', '/relatorios', '/produtos', '/onboarding']

const isMainRoute = MAIN_ROUTES.some(r => pathname === r ||
  (r !== '/clientes' && r !== '/configuracoes' && pathname.startsWith(r + '/')))
  // exceções: /clientes/[id] e /configuracoes/[sub] → mostram Voltar
```

**Modo principal** (comportamento atual, preservado):
```tsx
<Button variant="ghost" size="icon" onClick={onOpenSidebar}>
  <Menu className="size-5" />
</Button>
```

**Modo detalhe** (sub-rotas como `/clientes/[id]`):
```tsx
<button onClick={() => router.back()} className="flex items-center gap-1 text-primary ...">
  <ChevronLeft className="size-5" />
  <span className="text-sm font-medium">Voltar</span>
</button>
```

O header permanece `sticky top-0 z-30` — já está fixo, sem alteração de posicionamento.

**Props adicionadas:** `pathname: string` (passado pelo AppShell via `usePathname`) — ou o hook é chamado diretamente dentro do MobileHeader (componente já é client).

---

### 4.3 `AppShell` (modificado)

**Arquivo:** `src/components/app/app-shell.tsx`

Única mudança: envolver o `{children}` com `SwipeNavWrapper`.

```tsx
// Antes:
<div className="flex-1 px-4 py-6 pb-24 sm:px-6 md:pb-6 xl:px-8 xl:py-8">
  {children}
</div>

// Depois:
<SwipeNavWrapper>
  <div className="flex-1 px-4 py-6 pb-24 sm:px-6 md:pb-6 xl:px-8 xl:py-8">
    {children}
  </div>
</SwipeNavWrapper>
```

O `SwipeNavWrapper` renderiza sem wrapper em telas `md+` (sidebar já ativa, swipe não se aplica). Detecção via `useState(false)` inicializado no `useEffect` com `window.matchMedia('(max-width: 767px)').matches` — se não for mobile, retorna `children` diretamente sem nenhum `motion.div`, garantindo zero impacto em desktop/tablet.

---

## 5. Dependência nova

```bash
npm install framer-motion
```

Versão recomendada: `^11.x` (compatível com React 19 e Next.js 16).

Impacto no bundle: ~30KB gzipped, carregado apenas no client.

---

## 6. Garantias de não-regressão

| Risco | Mitigação |
|---|---|
| Scroll vertical bloqueado | `dragDirectionLock: true` — primeiro gesto define direção |
| Sidebar drawer interferindo | SwipeNavWrapper renderiza pass-through em `md+` |
| Modais/Sheets sendo fechados por swipe | `motion.div` está no conteúdo, não sobre o overlay |
| Rota `/onboarding/catalogo` afetada | Não está em `SWIPE_ROUTES` → pass-through |
| Rota `/clientes` (lista) perdendo scroll | `dragDirectionLock` libera scroll vertical quando gesto é vertical |
| `router.back()` em `/clientes/[id]` navegando errado | Usa `router.back()` nativo — preserva histórico real do browser |
| Animação em desktop/tablet | `SwipeNavWrapper` retorna `children` sem motion em `md+` |

---

## 7. Arquivos alterados

| Arquivo | Tipo de alteração |
|---|---|
| `src/components/app/swipe-nav-wrapper.tsx` | Criado |
| `src/components/app/mobile-header.tsx` | Modificado — detecção de sub-rota |
| `src/components/app/app-shell.tsx` | Modificado — adiciona `SwipeNavWrapper` |
| `package.json` + `package-lock.json` | `framer-motion` adicionado |

---

## 8. Fora do escopo desta entrega

- Swipe em `/clientes/[id]` para navegar para o próximo/anterior cliente
- Indicador visual de "há mais páginas" (dots estilo carrossel)
- Animação no header ao trocar de rota
- Swipe em outras sub-rotas além de `/clientes/[id]`
