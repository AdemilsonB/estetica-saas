# Agent: Mobile-First
> A maioria dos usuários finais do Agendê acessa via dispositivo móvel.
> Este agent é invocado automaticamente pelo Orchestrator antes de toda entrega de frontend.

## Contexto do produto

| Perfil | Dispositivo principal |
|---|---|
| Usuários finais (clientes que agendam) | Mobile (> 70% do tráfego) |
| Gestores e administradores | Desktop |

---

## Checklist obrigatório — execute antes de qualquer entrega de UI

### Layout e viewport
- [ ] Layout funciona em 375px (iPhone SE — menor comum)
- [ ] Layout funciona em 390px (iPhone 14 — mais comum)
- [ ] Sem overflow horizontal em nenhum breakpoint
- [ ] Conteúdo crítico visível sem scroll em 667px de altura

### Touch e interação
- [ ] Touch targets mínimo 44×44px (botões, links, ícones clicáveis)
- [ ] Espaçamento mínimo 8px entre elementos clicáveis
- [ ] Campos de formulário com `type` correto: `tel`, `email`, `number`
- [ ] Sem interações hover-only (mobile não tem hover)

### Formulários de agendamento (críticos para o produto)
- [ ] Seletor de data/hora com picker nativo ou componente mobile-friendly
- [ ] Campos de input com `font-size` mínimo 16px (evita zoom automático no iOS)
- [ ] Botão de submit sempre visível acima do teclado virtual
- [ ] Validação inline — não apenas ao submit

### Performance mobile
- [ ] Imagens com lazy loading e tamanho adequado para mobile
- [ ] Sem animações pesadas em listas
- [ ] Loading states em todas as ações assíncronas

### Navegação
- [ ] Menu principal acessível com o polegar (bottom nav ou hamburger)
- [ ] Botões de ação primária na parte inferior da tela (thumb zone)
- [ ] Breadcrumbs apenas em desktop (> 768px)

---

## Padrões Tailwind mobile-first (sempre nesta ordem)

```tsx
// ✅ CORRETO — mobile (base) → tablet (md:) → desktop (lg:)
className="flex flex-col md:flex-row"
className="text-sm md:text-base lg:text-lg"
className="px-4 md:px-6 lg:px-8"

// ❌ INCORRETO — nunca desktop-first
className="flex-row md:flex-col"
```

## Componentes de agendamento — regras específicas

- **CalendarPicker**: usar versão com swipe entre meses em mobile
- **TimeSlots**: botões grandes (mín. `h-12`) para seleção por toque
- **Confirmação de agendamento**: tela dedicada, não modal em mobile
- **Histórico de agendamentos**: card list em mobile, tabela apenas em desktop
