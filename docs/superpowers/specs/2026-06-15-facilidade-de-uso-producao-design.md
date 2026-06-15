# Design: Facilidade de Uso para Produção

**Data:** 2026-06-15  
**Status:** Aprovado  
**Prazo alvo:** 1–2 meses  
**Objetivo:** Eliminar as maiores fricções de uso para profissional e cliente final, tornando o produto competitivo para lançamento em produção.

---

## Contexto

O produto está em 5.5/10 em facilidade de uso. Os dois bloqueadores mais críticos identificados:
1. **Cliente final não consegue chegar ao link de agendamento** — o profissional não tem onde encontrar e compartilhar o link de forma simples
2. **Profissional usa o sistema no celular** mas a UX ainda é pensada para desktop

Escopo desta sprint: 5 blocos de quick wins que entregam valor independente e cabem em 5–6 semanas.

Fora de escopo (feature separada): templates de onboarding por tipo de negócio.

---

## Bloco 1 — Link Sharing Hub

### Objetivo
Dar ao profissional uma central de compartilhamento do link de agendamento, pronta para WhatsApp, Instagram e QR Code impresso.

### Localização
Nova aba **"Meu Link"** em Configurações (`/settings/meu-link`), acessível também pelo sidebar com ícone de compartilhar.

### Componentes da tela

**1. URL pública**
- Exibe o link `/public/[slug]` do negócio
- Botão "Copiar" com feedback visual ("✅ Copiado!")
- Botão "Abrir" que abre em nova aba

**2. QR Code**
- Gerado client-side com `react-qr-code` (zero backend)
- Botão "Baixar PNG" via `canvas.toBlob()` — alta resolução para impressão
- Legenda: "Perfeito para imprimir em cartão de visita ou recepção"

**3. WhatsApp**
- Texto pré-escrito: `"Olá! Agora você pode agendar online comigo pelo link abaixo. É rápido e fácil! 👇\n[URL]"`
- Botão "Copiar texto"
- Botão "Abrir no WhatsApp" → `https://wa.me/?text=...` (funciona mobile e desktop)

**4. Instagram**
- URL formatada para copiar direto para a bio
- Dica contextual: "Use 'Link na Bio' nos seus Stories"

### Implementação
- Rota: `app/(app)/settings/meu-link/page.tsx`
- Componente: `src/components/domain/settings/link-sharing-hub.tsx`
- Dependência nova: `react-qr-code` (client-side only)
- Sem alterações de backend ou banco

---

## Bloco 2 — PWA Instalável

### Objetivo
Tornar o sistema instalável na tela inicial do celular, eliminando a percepção de "site" e aumentando frequência de uso do profissional.

### Arquivos a criar/modificar

```
public/
├── manifest.json
├── sw.js
└── icons/
    ├── icon-192.png
    └── icon-512.png

app/
└── layout.tsx   ← adicionar manifest link + apple meta tags
```

### manifest.json
```json
{
  "name": "Agendê",
  "short_name": "Agendê",
  "start_url": "/agenda",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#7C3AED",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

### Service Worker (escopo mínimo)
- Cache apenas do app shell (HTML, CSS, JS estático)
- Páginas dinâmicas sempre buscam da rede (network-first)
- Objetivo: carregamento mais rápido, não offline completo

### iOS (Safari)
```html
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="default" />
<link rel="apple-touch-icon" href="/icons/icon-192.png" />
```

### Prompt de instalação
- Android Chrome: aparece automaticamente após 2 visitas
- iOS Safari: banner discreto na tela de agenda — "Adicione à tela inicial para acesso rápido" com ícone de compartilhar
- Componente: `src/components/ui/pwa-install-banner.tsx` — exibido apenas se `window.matchMedia('(display-mode: browser)')` e não dispensado pelo usuário (localStorage flag)

---

## Bloco 3 — Mobile UX Fixes

### Objetivo
Corrigir os 3 pontos de maior fricção para o profissional no celular, sem tocar no layout desktop.

### 3A — Agenda: modo dia automático no mobile

**Comportamento:**
- `useMediaQuery('(max-width: 768px)')` → renderiza `AgendaDayView` ao invés da view semanal
- Navegação por setas (← dia anterior / dia seguinte →)
- Scroll vertical simples — sem grid horizontal
- Header: "Terça, 17 jun" com setas de navegação

**Componente:** `src/components/domain/scheduling/agenda-day-view.tsx` (novo)  
**Alteração:** `src/components/domain/scheduling/agenda-view.tsx` — condicional por breakpoint

### 3B — Card de agendamento com quick actions

```
┌────────────────────────────────────┐
│ 🕙 10:00 — João Silva              │
│ Corte + Barba · R$ 65,00           │
│ [✅ Confirmar] [💰 Fechar] [···]   │
└────────────────────────────────────┘
```

- **Confirmar:** PATCH status → `CONFIRMED` sem abrir drawer (toast de sucesso)
- **Fechar:** abre `CheckoutModal` com valor pré-preenchido
- **`···`:** menu de opções secundárias (reagendar, cancelar, ver anamnese)
- Botões com altura mínima de 44px (padrão de toque iOS/Android)
- Exibidos apenas no mobile — desktop mantém comportamento atual (clique abre drawer)

**Alteração:** `src/components/domain/scheduling/appointment-card.tsx`

### 3C — FAB (Floating Action Button)

- Botão `+` fixo no canto inferior direito da tela de agenda
- Visível apenas no mobile
- Abre modal de novo agendamento rápido
- Z-index acima do bottom nav

**Componente:** `src/components/domain/scheduling/agenda-fab.tsx` (novo)

---

## Bloco 4 — Booking Flow Auditado

### Objetivo
Reduzir o tempo de agendamento do cliente final para < 2 minutos (sem anamnese).

### Fluxo revisado

```
Antes: Negócio → Serviço → Profissional → Data → Horário → Dados → Anamnese → Confirmação
Depois: Negócio → Serviço → [Prof. se >1] → Data+Horário → Dados → [Anamnese] → Confirmação
```

### Otimizações

**Pulo automático do profissional**
- Se `professionals.length === 1` → selecionar automaticamente, pular step
- Reduz 1 passo para a maioria dos negócios solo

**Data + Horário em uma única tela (mobile)**
- Calendário compacto no topo
- Slots de horário disponíveis logo abaixo, atualizados ao selecionar o dia
- Sem navegação entre telas — tudo em scroll vertical

**Dados pessoais — reduzir para 2 campos obrigatórios**
- Obrigatórios: Nome completo + Telefone (WhatsApp)
- Opcionais (recolhidos pós-agendamento se necessário): Email, CPF
- Retorno: se telefone já existe no sistema → "Bem-vindo de volta, [Nome]! É você?" com opção de confirmar ou usar outro número

**Indicador de progresso**
```
● ── ● ── ○ ── ○
Serviço · Data · Dados · Pronto
```
- Sempre visível no topo durante o booking
- Atualiza conforme o cliente avança

**Tela de confirmação**
- "✅ Agendado!" com resumo (serviço, data, horário, local)
- "📱 Você receberá uma confirmação no WhatsApp"
- Botão "Adicionar ao calendário" → gera link `.ics` (iOS e Android)
- Botão "Compartilhar" → Web Share API (mobile)

### Arquivos afetados
- `src/app/(public)/[slug]/booking/` — steps existentes
- `src/components/domain/scheduling/booking/` — componentes do wizard

---

## Bloco 5 — WhatsApp Confiável

### Objetivo
Garantir que o diferencial de automação por WhatsApp não some quando a Evolution API cai, e dar visibilidade ao profissional sobre o status das notificações.

### 5A — Indicador de status em Settings

**Localização:** Settings → Notificações  
**Componente:** `src/components/domain/settings/notification-status.tsx`

- Health check da Evolution API a cada 5 min via pg-boss job
- Status persiste em `SystemConfig` no banco (`whatsapp_status`: `connected | disconnected | unknown`)
- Se desconectado → banner de aviso no topo do dashboard (dismissível por sessão)
- Botão "Testar envio" → dispara mensagem de teste para o número do profissional

### 5B — Fallback automático para email

**Lógica no `NotificationService`:**
```
1. Tenta WhatsApp (Evolution API)
   ├── Sucesso → log "whatsapp:sent"
   └── Falha   → tenta email (Supabase)
                 ├── Sucesso → log "email:sent"
                 └── Falha   → log "notification:failed" + flag no banco para alerta
```

**Templates de email obrigatórios (3 essenciais):**
- Confirmação de agendamento
- Lembrete 24h antes
- Cancelamento

Template HTML simples, responsivo — enviado via Resend (já disponível no ecossistema Next.js/Vercel) ou via SMTP configurado no Supabase. A escolha do provider é decisão de implementação; a interface do `NotificationService` permanece a mesma.

### 5C — Log de notificações

**Localização:** Settings → Notificações → Histórico  
**Exibe:** últimas 50 notificações com nome do cliente, tipo (confirmação/lembrete/cancelamento), canal usado (WhatsApp/Email), status (✅/❌), horário

**Model novo no Prisma:**
```prisma
model NotificationLog {
  id          String   @id @default(cuid())
  tenantId    String
  customerId  String?
  type        String   // "booking_confirmed" | "reminder_24h" | "booking_cancelled"
  channel     String   // "whatsapp" | "email"
  status      String   // "sent" | "failed"
  sentAt      DateTime @default(now())

  @@index([tenantId])
  @@index([tenantId, sentAt])
}
```

### Templates obrigatórios para produção

| Evento | Canal primário | Fallback | Timing |
|---|---|---|---|
| Agendamento criado | WhatsApp | Email | Imediato |
| Lembrete | WhatsApp | Email | 24h antes |
| Cancelamento | WhatsApp | Email | Imediato |

---

## Estimativa de prazo

| Bloco | Esforço estimado |
|---|---|
| 1. Link Sharing Hub | 4–5 dias |
| 2. PWA Instalável | 3–4 dias |
| 3. Mobile UX Fixes | 5–7 dias |
| 4. Booking Flow | 5–7 dias |
| 5. WhatsApp Confiável | 5–6 dias |
| **Total** | **~5–6 semanas** |

Os blocos 1, 2 e 5 são independentes entre si e podem ser desenvolvidos em paralelo.  
Os blocos 3 e 4 dependem de leitura do código atual mas não entre si.

---

## Checklist de produção (ao concluir todos os blocos)

- [ ] Link sharing hub acessível em Settings
- [ ] QR Code gerado e download funcionando
- [ ] PWA instalável no Android (Chrome) e iOS (Safari)
- [ ] Agenda exibe modo dia automaticamente no mobile
- [ ] Quick actions (Confirmar / Fechar) nos cards de agendamento mobile
- [ ] FAB de novo agendamento visível no mobile
- [ ] Booking flow: pulo automático do profissional quando só há 1
- [ ] Data + horário em tela única no mobile
- [ ] Formulário de dados: apenas 2 campos obrigatórios
- [ ] Tela de confirmação com botão "Adicionar ao calendário"
- [ ] Status de WhatsApp visível em Settings
- [ ] Fallback automático para email quando WhatsApp falha
- [ ] Log de notificações exibindo últimas 50 entradas
- [ ] 3 templates de email implementados e testados
- [ ] `npx tsc --noEmit` — zero erros
- [ ] `npx vitest run` — todos os testes passando
- [ ] PR aberta para main
