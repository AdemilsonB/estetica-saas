# Polimento de usabilidade — Login, Onboarding e instalação PWA

**Data:** 2026-07-01
**Branch:** `feat/polimento-usabilidade-login-onboarding-pwa`
**Contexto:** melhorias de detalhe voltadas ao cliente final (muitos leigos), a partir de
observação direta das telas de `/login` mobile e do onboarding.

---

## Problema

Cinco pontos de atrito observados no fluxo de entrada:

1. **`/login` no mobile parece um "modal gigante flutuando"** — todo o bloco (header
   gradiente + formulário) fica preso em `max-w-sm` centralizado sobre um fundo branco de
   altura total; em viewports largos vira uma coluna estreita boiando com muito vazio.
2. **Não há caminho de volta de `/login` para a landing** (nem mobile nem desktop).
3. **Eco visual de botões**: as abas dizem "Entrar" / "Criar conta" e os botões de submit
   repetem exatamente "Entrar" / "Criar conta".
4. **Pede CPF duas vezes sem explicar** — o signup coleta o CPF do titular (pessoa) e o
   onboarding coleta o CPF/CNPJ do negócio. São coisas diferentes, mas os rótulos não
   deixam isso claro; até um usuário técnico só entendeu após análise do código.
5. **Não existe orientação de como "instalar" o app** (PWA) nem momento ideal para convidar.

---

## Decisões tomadas (com o usuário)

- **CPFs permanecem separados** (titular vs. negócio) — a confusão se resolve com
  **rótulos/descrições claras**, não removendo o campo.
- **Reuso é opcional**, nunca automático: no onboarding, quando o documento for CPF, um
  atalho de 1 clique permite reaproveitar o CPF do titular.
- **Telefone e CEP saem do signup e vão para o onboarding** — o CEP é o endereço do
  negócio (`Tenant.zipCode`), então pertence à etapa do negócio; o signup fica focado na
  identidade da pessoa.
- **PWA**: banner discreto na `/agenda`, a partir do 2º acesso (valor percebido antes do
  convite), abrindo modal com passo-a-passo por sistema (Android/iOS).
- **Voltar à landing**: logo clicável **e** link textual "← Voltar ao site" nos dois
  breakpoints.

---

## Escopo por frente

### Frente 1 — Layout do `/login` no mobile

Arquivo: `src/app/(auth)/login/login-client.tsx`

- O header gradiente do mobile passa a ser **full-bleed** (encosta nas bordas), com cantos
  inferiores arredondados — vira "capa" do topo, não um card solto.
- O contêiner deixa de prender tudo em `max-w-sm`; usa largura confortável (`max-w-md`
  como teto, centralizado) e o corpo branco recebe respiro/continuidade visual para não
  ser um vazio.
- Desktop permanece com o split-panel atual (LeftPanel/RightPanel) — sem regressão.

Mockup (mobile, depois):
```
┌───────────────────────┐
│▓▓ 🟣 Agendê   ← Site ▓▓│  ← header full-bleed, logo + voltar
│▓ Seu salão no piloto ▓│
│▓ [📅] [👥] [💰] chips ▓│
└───────────────────────┘
┌───────────────────────┐
│ [ Entrar | Criar conta]│  ← abas
│ Email  [____________]  │
│ Senha  [____________]  │
│ [ Acessar minha conta ]│  ← botão renomeado
└───────────────────────┘
```

### Frente 2 — Voltar para a landing

Arquivo: `src/app/(auth)/login/login-client.tsx`

- Logo do LeftPanel (desktop) e do header mobile viram `<Link href="/">`.
- Link textual discreto **"← Voltar ao site"** ao lado do logo, visível em mobile e
  desktop.

### Frente 3 — Fim do eco de botões

Arquivo: `src/app/(auth)/login/login-client.tsx`

- Botão de submit do login: **"Acessar minha conta"** (era "Entrar").
- Botão de submit do signup: **"Criar minha conta grátis"** (era "Criar conta").
- Abas permanecem "Entrar" / "Criar conta" (seletor de modo). Auditoria não encontrou
  outro botão de fato duplicado.

### Frente 4 — Signup enxuto + rótulos claros

Arquivos: `src/app/(auth)/login/login-client.tsx`, `src/app/api/auth/signup/route.ts`

- `signupSchema` passa a conter: `nomeCompleto`, `email`, `cpf` (do titular), `password`,
  `confirmPassword`. **Removidos** `telefone` e `cep`.
- Rótulo do CPF: **"Seu CPF"** + ajuda **"CPF de quem vai administrar a conta (você)."**
- `buildUserMetadata` no signup passa a gravar `full_name` e `cpf` (mantém o CPF do
  titular em metadata, como hoje). `phone` e `cep` deixam de ser enviados aqui.
- Remover do `login-client.tsx` as máscaras/estado de telefone e CEP e a busca ViaCEP
  (migram para o onboarding).

### Frente 5 — Onboarding coleta o resto, uma vez, com reuso opcional

Arquivos: `src/app/(auth)/onboarding/page.tsx`, `src/app/api/iam/register/route.ts`,
`src/domains/iam/iam.service.ts`

Campos do modo "create" do onboarding:
```
Nome do negócio          [____________________]
Seu nome                 [pré-preenchido______]
Telefone                 [(00) 0 0000-0000____]   ← movido do signup
Documento do negócio     [•CPF][ CNPJ]
  [ ✓ Usar o meu CPF (mesmo do cadastro) ]        ← só aparece com CPF; opcional
  [__________________]
  ajuda: "Documento do seu negócio. Autônomo/MEI? Costuma ser o seu próprio CPF."
CEP                      [00000-000] 📍            ← movido do signup (ViaCEP)
─ Identidade visual (opcional) ─  (logo + cores, mantém)
```

- Reuso: quando `documentType === 'CPF'`, exibir checkbox "Usar o meu CPF"; ao marcar,
  preenche o campo com `meta.cpf` (CPF do titular vindo do signup). Puramente de UI.
- Máscara de telefone e ViaCEP migram para cá (reaproveitar as funções que existiam no
  `login-client.tsx`).

Backend:
- `RegisterSchema` (em `register/route.ts`) ganha `ownerPhone?: string` e
  `zipCode?: string` opcionais.
- `iamService.register()`: `ownerPhone = input.ownerPhone ?? meta.phone`;
  `zipCode = input.zipCode ?? meta.cep` (fallback mantém compatibilidade com contas
  legadas cujos dados ainda estejam em metadata). `ownerCpf` continua `meta.cpf` — sem
  mudança.
- Sem migration: `User.phone`, `User.cpf`, `Tenant.zipCode` já existem.

### Frente 6 — Instalar o app (PWA) na `/agenda`

Arquivos novos: `src/components/domain/pwa/install-app-banner.tsx`,
`src/components/domain/pwa/install-instructions-modal.tsx`
Inserção: página/layout da `/agenda`.

- **Banner** no topo da `/agenda`:
  - Não renderiza se já instalado (`window.matchMedia('(display-mode: standalone)')` ou
    `navigator.standalone` no iOS).
  - Aparece só a partir do **2º acesso** à agenda — contador incremental em
    `localStorage` (`agende:agenda-visits`).
  - Dispensável; ao fechar, grava `agende:install-banner-dismissed` e não volta.
- **Modal de instruções**, detectando o sistema:
  - **Android/Chrome:** captura `beforeinstallprompt` (guardar o evento); botão
    "Instalar" chama `prompt()` nativo. Sem o evento → passos "⋮ menu → Instalar app /
    Adicionar à tela inicial".
  - **iOS/Safari:** passos ilustrados "Toque em Compartilhar ⬆️ → Adicionar à Tela de
    Início → Adicionar".
- Momento ideal: cliente já usou a agenda ao menos uma vez.

Mockup do banner (mobile):
```
┌─────────────────────────────────┐
│ 📲 Tenha o Agendê na tela      ✕│
│    inicial — abre rápido, sem   │
│    navegador. [Ver como instalar]│
└─────────────────────────────────┘
```

---

## Fora de escopo (YAGNI)

- Prompt de instalação no **portal do cliente** (`(public)`): pode ser uma extensão
  futura do mesmo componente, mas não entra agora.
- Autopreenchimento de endereço completo (rua/número) a partir do CEP — mantém só
  cidade/UF como hoje.
- Qualquer mudança de schema Prisma (nenhuma é necessária).

---

## Impacto e riscos

- **Baixo risco de dados**: nenhum campo persistido é removido; apenas muda de onde o
  telefone/CEP são coletados. Fallback para `meta.*` preserva contas em andamento.
- **Regressão de fluxo**: garantir que o signup continue redirecionando para
  `/onboarding?plan=...` e que o onboarding trate `ownerPhone`/`zipCode` ausentes
  (ambos opcionais).
- **PWA**: banner é aditivo e isolado; não afeta rotas existentes.

---

## Testes

- `iamService.register`: novos casos cobrindo `ownerPhone`/`zipCode` vindos do input e o
  fallback para `meta.*`; `ownerCpf` inalterado.
- Signup: schema aceita ausência de telefone/CEP; metadata grava `full_name` + `cpf`.
- Onboarding: reuso opcional preenche o documento com `meta.cpf` só quando marcado.
- Banner PWA: não renderiza em standalone; aparece a partir do 2º acesso; dismiss
  persiste. (testes de componente / lógica de gating)
- `npx tsc --noEmit` e `npx vitest run` verdes.
