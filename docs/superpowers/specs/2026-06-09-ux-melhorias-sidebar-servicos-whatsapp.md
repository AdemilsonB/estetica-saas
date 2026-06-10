# Spec: Melhorias de UX — Sidebar, Serviços e WhatsApp

**Data:** 2026-06-09  
**Status:** Aprovado  
**Escopo:** Frontend only — sem migrations de banco, sem novos domínios

---

## Contexto

Três melhorias independentes de UX que aumentam a clareza do produto, incentivam upgrade de plano e organizam melhor as configurações de precificação.

---

## 1. Sidebar — rodapé do usuário

### Situação atual

O rodapé da sidebar exibe apenas as iniciais do nome do usuário (`getInitials`) dentro de um quadrado colorido. Não há foto, não há indicação do plano ativo.

### Design aprovado

**Foto de perfil**
- Substituir o bloco de iniciais por `<img>` quando `user.avatarUrl` estiver disponível
- Fallback: manter as iniciais com o fundo atual quando não houver foto
- Fonte: `avatar_url` da tabela `auth.users` do Supabase, exposto via `/api/iam/me`

**Badge de plano**
- Exibir ao lado do nome: `FREE`, `STARTER`, `PRO` ou `ENTERPRISE`
- Fonte: hook `useBillingStatus()` já existente
- Cor do badge por plano:
  - `FREE` → cinza (`bg-slate-100 text-slate-600`)
  - `STARTER` → azul (`bg-blue-50 text-blue-700`)
  - `PRO` → roxo (`bg-violet-50 text-violet-700`)
  - `ENTERPRISE` → dourado (`bg-amber-50 text-amber-700`)
- Durante `TRIALING`: mostrar badge amarelo com "Trial · N dias"

**Card de upgrade (somente FREE)**
- Aparece abaixo do rodapé do usuário, apenas quando `billingStatus.plan === 'FREE'`
- Conteúdo: título "Desbloqueie mais recursos", subtítulo, botão "Ver planos →" que navega para `/configuracoes/planos`
- **Comportamento de dismiss:** botão "× fechar" no canto superior direito
  - Ao clicar: salva `upgrade-card-dismissed` em `sessionStorage`
  - Card não reaparece durante a sessão atual
  - Volta a aparecer no próximo login/reload (sessionStorage é limpo ao fechar o browser)
- Não aparece para planos pagos (`STARTER`, `PRO`, `ENTERPRISE`) nem durante trial

### Arquivos

| Arquivo | Ação |
|---|---|
| `src/hooks/use-current-user.ts` | Adicionar `avatarUrl: string \| null` ao tipo `CurrentUser` |
| `src/app/api/iam/me/route.ts` | Expor `avatar_url` do Supabase Auth no payload do endpoint |
| `src/components/app/app-shell.tsx` | Foto, badge de plano, card de upgrade com dismiss |

---

## 2. WhatsApp — badge de ação pendente no menu

### Situação atual

Não há nenhuma indicação visual quando o WhatsApp (Evolution API) não está conectado. O usuário precisa navegar até Configurações → WhatsApp para descobrir.

### Design aprovado

- Badge verde com "!" no item "Configurações" da sidebar
- Condição de exibição: `evolutionStatus.connected === false`
- Hook a usar: `useEvolutionStatus()` já existente em `src/hooks/settings/use-evolution-status.ts` — retorna `{ connected: boolean, status: string }`. **Não criar hook novo.**
- Badge some automaticamente quando `connected` passa a `true` — o hook usa `queryKey: ['evolution', 'status']` que é invalidado após conexão bem-sucedida
- Não exibir o badge enquanto o status ainda está carregando (`isLoading === true`)
- **Não** adicionar banner na Agenda, **não** adicionar notificação push — apenas o badge na sidebar

### Arquivos

| Arquivo | Ação |
|---|---|
| `src/components/app/app-shell.tsx` | Importar `useEvolutionStatus`; renderizar badge "!" no item Configurações quando `!connected && !isLoading` |

---

## 3. Página Serviços — reorganização das abas com Precificação

### Situação atual

**Em `src/app/(app)/servicos/page.tsx`:** 4 abas — Categorias, Serviços, Pacotes, Promoções.

**Em `src/app/(app)/configuracoes/page.tsx` (aba "financeiro"):** `DiscountTypesManager`, `CommissionsGrid` e `CardFeesForm` agrupados juntos.

### Decisão de migração

| Componente | Origem | Destino | Justificativa |
|---|---|---|---|
| `DiscountTypesManager` | Config → Financeiro | Serviços → Precificação | Tipos de desconto são aplicados a serviços |
| `CommissionsGrid` | Config → Financeiro | Serviços → Precificação | Comissões são calculadas por serviço/profissional |
| `CardFeesForm` | Config → Financeiro | **Permanece** em Config → Financeiro | Taxa de cartão é política de pagamento do negócio, não de serviço |

### Design aprovado — nova estrutura de abas em Serviços

```
── Catálogo ──────────────────────────
  Categorias | Serviços | Pacotes | Promoções

── Precificação ──────────────────────
  Descontos | Comissões
```

- Dois grupos de abas com rótulo de seção (`<p class="text-xs ...">Catálogo</p>`)
- Implementação: **dois componentes `Tabs` independentes** — um para Catálogo, outro para Precificação. Sem estado compartilhado, sem necessidade de `value` controlado cruzando grupos.

### O que muda em Configurações

- Aba "financeiro" em `configuracoes/page.tsx`: remover `<DiscountTypesManager />` e `<CommissionsGrid />`
- Mantém apenas `<CardFeesForm />`
- Renomear o título da seção de "Configurações financeiras" para "Taxas de pagamento"

### Arquivos

| Arquivo | Ação |
|---|---|
| `src/app/(app)/servicos/page.tsx` | Adicionar grupos "Catálogo" e "Precificação" com as novas abas |
| `src/app/(app)/configuracoes/page.tsx` | Remover `DiscountTypesManager` e `CommissionsGrid`; renomear título da seção |

---

## Fora de escopo

- Upload de foto de perfil (apenas leitura do `avatar_url` já existente via Supabase Auth)
- Redesign da página `/configuracoes/planos` (conteúdo já funciona; a visibilidade é resolvida pelo card de upgrade na sidebar)
- Qualquer mudança no domínio financial ou em migrations de banco
- Trial gratuito para usuários já logados (comportamento intencional: trial só no onboarding)

---

## Critérios de aceite

- [ ] Foto aparece na sidebar quando o usuário tem `avatar_url` no Supabase Auth
- [ ] Badge de plano exibe o plano correto com a cor correta
- [ ] Card de upgrade aparece apenas para plano FREE
- [ ] Card de upgrade some ao clicar "× fechar" e não reaparece na mesma sessão
- [ ] Badge "!" aparece em Configurações quando WhatsApp não está conectado
- [ ] Badge some ao conectar o WhatsApp sem precisar recarregar
- [ ] Abas Descontos e Comissões estão em Serviços → Precificação
- [ ] Aba Financeiro em Configurações mostra apenas Taxas de pagamento (`CardFeesForm`)
- [ ] `npx tsc --noEmit` sem erros
