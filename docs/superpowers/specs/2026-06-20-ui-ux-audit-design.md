# Spec: Audit UI/UX — Correção Completa de Interface
**Data:** 2026-06-20  
**Branch:** `fix/ui-ux-audit-junho-2026`  
**Escopo:** 42 fixes em 10 grupos de domínio  
**Issues relacionadas:** GitHub #121 (perf), #122 (db), #123 (qa) — fora deste escopo  

---

## Contexto

Auditoria sistemática de todas as telas do sistema identificou 42 problemas reais:
- **8 Alta** — erros silenciosos, crashes potenciais, ações destrutivas sem confirmação
- **23 Média** — feedback ausente, inconsistências de design, acessibilidade mobile
- **11 Baixa** — polimento visual, padronização, TypeScript

Implementação por domínio (Opção B aprovada). Branch única, sem refatorações além do escopo.

---

## Princípios de implementação

- **Cirúrgico:** alterar apenas o necessário em cada arquivo
- **Sem regressões:** não introduzir lógica nova — apenas corrigir o existente
- **Mobile-first:** toda correção de UI validada em 375px
- **Sem `any`:** type guards onde necessário, sem cast genérico

---

## Grupo 1 — Scheduling (6 fixes)

### 1.1 AlertDialog para ação NO_SHOW (Alta)
**Arquivo:** `src/components/domain/scheduling/appointment-drawer.tsx:209`  
**Problema:** Botão "Não compareceu" executa `updateStatus('NO_SHOW')` imediatamente sem confirmação.  
**Fix:** Envolver em `<AlertDialog>` com mesmo padrão do botão Cancelar (linha 217). Texto: "Marcar como não compareceu? Esta ação não pode ser desfeita."

### 1.2 Layout mobile para múltiplos profissionais (Alta)
**Arquivo:** `src/components/domain/scheduling/agenda-day-view.tsx:323-373`  
**Problema:** Modo multi-profissional usa `inline-flex` com scroll horizontal — inutilizável em mobile.  
**Fix:** Abaixo de `md:`, renderizar lista vertical: cada profissional em card colapsável com seus slots. Acima de `md:` mantém o layout de colunas atual.

### 1.3 Cores hardcoded → padrão Shadcn (Média)
**Arquivo:** `src/components/domain/scheduling/appointment-drawer.tsx:189-221`  
**Problema:** `bg-blue-600`, `bg-emerald-600`, `border-orange-200`, `border-red-200` hardcoded.  
**Fix:**
- Confirmar → `variant="default"` (usa `bg-primary`)
- Completar → `bg-green-600 hover:bg-green-700` (semântico, sem branding)
- Reagendar → `variant="outline"` com `className="border-amber-200 text-amber-700 hover:bg-amber-50"`
- Cancelar → `variant="destructive"`
- NO_SHOW → `variant="outline"` com `className="border-slate-200 text-slate-600 hover:bg-slate-50"`

### 1.4 Tooltip no ícone de remarcar (Média)
**Arquivo:** `src/components/domain/scheduling/appointment-card.tsx:92`  
**Problema:** `title="Remarcar"` nativo HTML — inconsistente com `<Tooltip>` do design system.  
**Fix:** Substituir por `<Tooltip><TooltipTrigger asChild>…<TooltipContent>Remarcar</TooltipContent></Tooltip>`.

### 1.5 Loading state em ConfirmAppointmentModal (Média)
**Arquivo:** `src/components/domain/scheduling/confirm-appointment-modal.tsx:56`  
**Problema:** Query de anamnese não desestrutura `isLoading` — loading invisível.  
**Fix:** Desestruturar `isLoading` e renderizar `<Skeleton className="h-20 w-full rounded-lg" />` na seção de anamnese enquanto carrega.

### 1.6 Arredondamento uniforme nos botões mobile (Baixa)
**Arquivo:** `src/components/domain/scheduling/appointment-card.tsx:106`  
**Problema:** Botões quick action com `rounded-lg` dentro de card `rounded-2xl`.  
**Fix:** `rounded-lg` → `rounded-xl`.

---

## Grupo 2 — Financial (5 fixes)

### 2.1 Mutation com feedback em AppointmentProductsSection (Média)
**Arquivo:** `src/components/domain/financial/appointment-products-section.tsx:161`  
**Problema:** `saveProducts.mutate()` sem `onSuccess`/`onError`.  
**Fix:** Adicionar callbacks:
```tsx
onSuccess: () => toast.success('Produtos atualizados'),
onError: () => toast.error('Erro ao salvar produtos'),
```

### 2.2 gray → slate em transaction-card (Média)
**Arquivo:** `src/components/domain/financial/transaction-card.tsx:10-18`  
**Problema:** `bg-gray-100 text-gray-600` inconsistente com Shadcn (usa `slate`).  
**Fix:** `gray-100` → `slate-100`, `gray-600` → `slate-600`.

### 2.3 Type cast em financeiro/page (Média)
**Arquivo:** `src/app/(app)/financeiro/page.tsx:31-32`  
**Problema:** `as unknown[]` indica tipagem incorreta.  
**Fix:** Usar tipo correto da API ou `Array.isArray()` com type guard explícito.

### 2.4 Error state em day-summary (Média)
**Arquivo:** `src/components/domain/financial/day-summary.tsx`  
**Problema:** Sem UI de erro quando query falha.  
**Fix:** Adicionar `if (isError) return <p className="text-sm text-destructive">Erro ao carregar resumo</p>`.

### 2.5 Botão Cortesia com tamanho consistente (Baixa)
**Arquivo:** `src/components/domain/financial/register-payment-modal.tsx:224`  
**Problema:** `size="sm"` inconsistente com demais botões do modal.  
**Fix:** `size="sm"` → `size="default"`.

---

## Grupo 3 — CRM (3 fixes)

### 3.1 Touch target em inputs de filtro (Média)
**Arquivo:** `src/components/domain/crm/filter-bar.tsx:84-90`  
**Problema:** Inputs numéricos com `h-8` (32px) — abaixo de 44px mínimo touch.  
**Fix:** `h-8` → `h-10 sm:h-8`.

### 3.2 Scroll no PopoverContent de filtros (Baixa)
**Arquivo:** `src/components/domain/crm/filter-bar.tsx`  
**Problema:** Popover pode truncar em telas pequenas.  
**Fix:** Adicionar `className="max-h-[80vh] overflow-y-auto"` no `PopoverContent`.

### 3.3 Contador de resultados em CustomerList (Baixa)
**Arquivo:** `src/components/domain/crm/customer-list.tsx:99`  
**Problema:** Sem indicação de total de clientes encontrados.  
**Fix:** Adicionar `<p className="text-xs text-muted-foreground">{data.length} cliente{data.length !== 1 ? 's' : ''} encontrado{data.length !== 1 ? 's' : ''}</p>` acima da lista quando `data.length > 0`.

---

## Grupo 4 — Serviços / Catálogo (4 fixes)

### 4.1 Toast de sucesso em ServiceFormModal (Média)
**Arquivo:** `src/components/domain/services/service-form-modal.tsx:131`  
**Problema:** `onSuccess` fecha modal sem toast — usuário não sabe se funcionou.  
**Fix:** Adicionar `toast.success('Serviço salvo com sucesso')` antes de `onClose()`.

### 4.2 Input de busca responsivo em CatalogGrid (Baixa)
**Arquivo:** `src/components/domain/services/catalog-grid.tsx:300`  
**Problema:** `max-w-sm` sem `w-full` — pode ficar pequeno em mobile.  
**Fix:** `className="max-w-sm"` → `className="w-full sm:max-w-sm"`.

### 4.3 Skeleton em StockSaleModal (Média)
**Arquivo:** `src/components/domain/stock/stock-sale-modal.tsx`  
**Problema:** Combo de produtos aparece vazio enquanto carrega.  
**Fix:** Desestruturar `isLoading` do hook de produtos e renderizar `<Skeleton className="h-10 w-full rounded-lg" />` no lugar do combobox.

### 4.4 Skeleton em StockPurchaseModal (Média)
**Arquivo:** `src/components/domain/stock/stock-purchase-modal.tsx`  
**Problema:** Mesmo problema do StockSaleModal.  
**Fix:** Mesmo fix.

---

## Grupo 5 — IAM (2 fixes)

### 5.1 Tooltip no botão de editar membro (Baixa)
**Arquivo:** `src/components/domain/iam/team-member-card.tsx:78`  
**Problema:** Botão com ícone Pencil sem `<Tooltip>` do design system (só `aria-label`).  
**Fix:** Envolver em `<Tooltip><TooltipTrigger asChild>…<TooltipContent>Editar membro</TooltipContent></Tooltip>`.

### 5.2 Texto "opcional" padronizado (Média)
**Arquivo:** `src/components/domain/iam/edit-member-modal.tsx:164`  
**Problema:** Texto "opcional" inline no Label sem padrão visual definido.  
**Fix:** `<span className="text-xs text-muted-foreground font-normal ml-1">(opcional)</span>` — aplicar padrão consistente.

---

## Grupo 6 — Configurações (8 fixes)

### 6.1 Erros silenciosos nos fetches de configurações (Alta)
**Arquivo:** `src/app/(app)/configuracoes/page.tsx:63-113`  
**Problema:** `.catch(() => {})` vazio — erros de fetch ignorados, usuário não sabe que algo falhou.  
**Fix:** Substituir por `.catch((err) => { console.error(err); toast.error('Erro ao carregar configurações') })` ou usar TanStack Query com `isError`.

### 6.2 Mutation sem onError em whatsapp-settings-form (Alta)
**Arquivo:** `src/components/domain/settings/whatsapp-settings-form.tsx:107`  
**Problema:** Falha de configuração do WhatsApp sem feedback.  
**Fix:** Adicionar `onError: (err) => toast.error(err.message ?? 'Erro ao salvar configurações')`.

### 6.3 Mutation sem onError em scheduling-policy-form (Alta)
**Arquivo:** `src/components/domain/settings/scheduling-policy-form.tsx:81`  
**Problema:** Política de agendamento salva sem feedback de erro.  
**Fix:** Mesmo padrão do 6.2.

### 6.4 Mutation sem onError em card-fees-form (Alta)
**Arquivo:** `src/components/domain/settings/card-fees-form.tsx:24`  
**Problema:** Taxas de cartão sem feedback de erro.  
**Fix:** Mesmo padrão do 6.2.

### 6.5 Memory leak em branding-form (Média)
**Arquivo:** `src/components/domain/settings/branding-form.tsx:229`  
**Problema:** `URL.createObjectURL()` nunca revogado — vazamento de memória.  
**Fix:** Usar `useEffect` para revogar: `return () => URL.revokeObjectURL(previewUrl)`.

### 6.6 handleToggle não reatualiza UI em team-visibility-list (Média)
**Arquivo:** `src/components/domain/settings/team-visibility-list.tsx:37`  
**Problema:** Erro omitido no catch — UI fica em estado inconsistente.  
**Fix:** No catch, reverter estado otimista e chamar `toast.error('Erro ao atualizar visibilidade')`.

### 6.7 Toast ausente em business-info-form (Baixa)
**Arquivo:** `src/components/domain/settings/business-info-form.tsx:31`  
**Problema:** `onSuccess` sem toast — salvamento silencioso.  
**Fix:** Adicionar `toast.success('Informações salvas')`.

### 6.8 Erro sem retry em public-page-form (Média)
**Arquivo:** `src/components/domain/settings/public-page-form.tsx:41-42`  
**Problema:** Catch genérico "Falha no upload" sem retry UI.  
**Fix:** Manter mensagem de erro, adicionar `toast.error('Falha no upload. Tente novamente.')` e garantir que o campo de arquivo seja resetado para permitir nova tentativa.

---

## Grupo 7 — Billing (2 fixes)

### 7.1 Skeleton sem aria-busy (Média)
**Arquivo:** `src/components/domain/billing/billing-plans-content.tsx:110`  
**Problema:** Skeleton sem acessibilidade.  
**Fix:** Adicionar `aria-busy="true" aria-label="Carregando planos..."` no container do skeleton.

### 7.2 Skeleton com altura fixa não responsiva (Baixa)
**Arquivo:** `src/components/domain/billing/billing-plans-content.tsx:110`  
**Problema:** `h-64` pode não caber em mobile.  
**Fix:** `h-64` → `min-h-48 h-auto`.

---

## Grupo 8 — Auth / Onboarding (5 fixes)

### 8.1 Error handling específico no login/cadastro (Alta)
**Arquivo:** `src/app/(auth)/login/login-client.tsx:438-443`  
**Problema:** Mensagem genérica "Erro ao criar conta" para todos os erros.  
**Fix:** Mapear erros Supabase:
- `User already registered` → "Este email já está cadastrado. Tente fazer login."
- `Password should be at least 6 characters` → "A senha deve ter pelo menos 6 caracteres."
- Outros → mensagem original do erro

### 8.2 Promise.all sem error handling no onboarding (Média)
**Arquivo:** `src/app/(auth)/onboarding/page.tsx:103`  
**Problema:** Falha em qualquer promise do `Promise.all` silenciosa.  
**Fix:** Envolver em `try/catch` com `toast.error('Erro ao salvar configurações. Tente novamente.')` e manter botão habilitado para nova tentativa.

### 8.3 Color picker touch target no onboarding (Média)
**Arquivo:** `src/app/(auth)/onboarding/page.tsx:176`  
**Problema:** `h-8 w-8` (32px) — abaixo do mínimo de 44px para toque.  
**Fix:** `h-8 w-8` → `h-11 w-11 sm:h-8 sm:w-8`.

### 8.4 Color picker touch target no login (Média)
**Arquivo:** `src/app/(auth)/login/login-client.tsx:176`  
**Problema:** Mesmo problema do 8.3.  
**Fix:** Mesmo fix.

### 8.5 Links mortos de Termos/Privacidade (Média)
**Arquivo:** `src/app/(auth)/login/login-client.tsx:621-629`  
**Problema:** `href="#"` não navega — links mortos.  
**Fix:** Usar `href="/termos"` e `href="/privacidade"` com `target="_blank" rel="noopener noreferrer"`. Se páginas não existirem, abrir issue separada para criar — por ora remover o link e deixar texto simples.

---

## Grupo 9 — Vitrine Pública / Portal do Cliente (5 fixes)

### 9.1 Loading state em client-history-modal (Alta)
**Arquivo:** `src/components/domain/vitrine/client-history-modal.tsx:123-151`  
**Problema:** Modal tenta renderizar antes de `isLoading` ser checado — crash potencial.  
**Fix:** Adicionar guard `if (isLoading) return <div className="p-6"><Skeleton className="h-40 w-full" /></div>` antes do render principal.

### 9.2 Gradiente CSS correto em vitrine-hero (Média)
**Arquivo:** `src/components/domain/vitrine/vitrine-hero.tsx:100`  
**Problema:** `bg-linear-to-b` não é classe Tailwind válida (deve ser `bg-gradient-to-b`).  
**Fix:** `bg-linear-to-b` → `bg-gradient-to-b`.

### 9.3 Ícone WhatsApp com cor hardcoded (Baixa)
**Arquivo:** `src/components/domain/vitrine/vitrine-hero.tsx:216`  
**Problema:** `text-green-500` hardcoded — não respeita branding.  
**Fix:** Manter `text-green-500` (WhatsApp tem cor de marca específica — verde é correto e esperado). Documentar como exceção intencional via comentário `{/* WhatsApp brand color — intencional */}`.

### 9.4 Focus ring inconsistente em client-history-modal (Média)
**Arquivo:** `src/components/domain/vitrine/client-history-modal.tsx:220`  
**Problema:** `focus:ring-2` com CSS variables custom — inconsistente com Shadcn.  
**Fix:** Substituir por `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2` (padrão Shadcn).

### 9.5 CPF masking e privacidade no Portal (Média)
**Arquivo:** `src/app/(public)/[slug]/cliente/page.tsx:9-12`  
**Problema:** CPF exibido com apenas últimas 4 dígitos visíveis — pode ser insuficiente em contexto de captura de tela.  
**Fix:** Exibir CPF como `***.***.XXX-XX` (mascara os 9 primeiros, expõe apenas os 2 últimos). O masking deve ser aplicado no Server Component antes de passar a prop — nunca no cliente. Localizar onde o CPF é passado para o componente e aplicar a função `maskCpf(cpf: string) => cpf.replace(/^(\d{3})\.(\d{3})\.(\d{3})-(\d{2})$/, '***.***.***-$4')`.

---

## Grupo 10 — Shared / Global (4 fixes)

### 10.1 Espaçamentos no dashboard-metrics (Baixa)
**Arquivo:** `src/components/domain/dashboard/dashboard-metrics.tsx:57-150`  
**Problema:** Mistura de `gap-1.5`, `gap-2`, `gap-3` sem padrão.  
**Fix:** Padronizar: `gap-1.5` → `gap-2`, manter `gap-2` e `gap-4` onde já corretos.

### 10.2 Skeleton de notificações com altura fixa (Baixa)
**Arquivo:** `src/components/domain/settings/notification-history.tsx:84`  
**Problema:** `h-40` fixo no skeleton — não responsivo.  
**Fix:** `h-40` → `min-h-20 h-auto`.

### 10.3 as any → type guard nas rotas admin (Baixa)
**Arquivos:**
- `src/app/api/admin/plans/[planName]/route.ts:26`
- `src/app/api/admin/plans/[planName]/limits/route.ts:23,41,43,48`
- `src/app/api/admin/plans/[planName]/features/route.ts:23`

**Problema:** `planName as any` para cast de enum Prisma.  
**Fix:**
```typescript
import { PlanName } from '@prisma/client'

function isPlanName(value: string): value is PlanName {
  return Object.values(PlanName).includes(value as PlanName)
}

// No handler:
if (!isPlanName(planName)) return Response.json({ error: 'Plano inválido' }, { status: 400 })
const plan = planName // agora tipado como PlanName
```

### 10.4 Página de relatórios sem feedback antes de redirect (Média)
**Arquivo:** `src/app/(app)/relatorios/page.tsx:3-4`  
**Problema:** Redirect sem estado de loading — usuário vê tela em branco.  
**Fix:** Verificar se a página tem `loading.tsx` correspondente. Se não, criar `src/app/(app)/relatorios/loading.tsx` com skeleton simples.

---

## Gates de verificação

Ao final de todos os grupos:
```bash
npx tsc --noEmit   # zero erros de tipo
npx vitest run     # todos os testes passando
```

---

## Critérios de aceite

- [ ] Zero ações destrutivas sem AlertDialog
- [ ] Zero mutations sem toast de feedback (success e error)
- [ ] Zero queries com loading/error invisível em telas críticas
- [ ] Zero `as any` nos arquivos modificados
- [ ] Todos os ícones standalone com Tooltip
- [ ] Touch targets ≥ 44px em mobile para todos os elementos interativos modificados
- [ ] `npx tsc --noEmit` — zero erros
- [ ] `npx vitest run` — todos passando
- [ ] PR aberta para `main`
