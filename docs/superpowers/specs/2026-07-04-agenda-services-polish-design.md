# Spec: Polimento da Agenda, Serviços e Comissões

**Data:** 2026-07-04  
**Branch:** fix/agenda-ux-pencil-products  
**Escopo:** 7 melhorias de UX na agenda, serviços, promoções e comissões

---

## Contexto

Sessão de refinamento baseada em uso real do sistema. Todos os itens foram identificados pelo operador do negócio durante uso da tela de agenda (`/agenda`) e de serviços (`/servicos`).

---

## Item A — Novo layout do AppointmentCard

**Arquivo:** `src/components/domain/scheduling/appointment-card.tsx`

### Layout atual
```
[ Cliente · Serviço · Profissional   Confirmado ✏ ]
[ 09:00 – 13:00                                  ]
[ Fechar pagamento  (só mobile sm:hidden)         ]
```

### Layout novo
```
[ Confirmado                                   ✏ ]  ← linha 1: badge + lápis
[ Cleide Maria                                   ]  ← linha 2: cliente (destaque)
[ Mechas morena iluminado                        ]  ← linha 3: serviço (wrap se longo)
[ 09:00 – 13:00                                  ]  ← linha 4: horário
[ Fechar pagamento                               ]  ← linha 5: botão ação
```

**Regras:**
- Remover profissional do card (coluna já identifica o profissional)
- Botões de ação saem do `sm:hidden` — sempre visíveis (mobile e desktop)
- Ordem das informações: status → cliente → serviço → horário → ação

---

## Item B — Horário personalizado + botão WhatsApp no drawer de edição

**Arquivo:** `src/components/domain/scheduling/appointment-drawer.tsx`

### Campo de horário personalizado
No modo `isEditing`, após os chips de slots:

```
Horário
[ 09h ] [ 10h ] [ 10h30 ] ...        ← chips existentes

── ou informe um horário ──
[ 09:30 ]                            ← <input type="time" />
```

- O `<input type="time">` e os chips compartilham o mesmo estado `editTime`
- Selecionar chip → atualiza o input; digitar no input → atualiza/desseleciona chips
- Horário livre (não presente nos slots) é aceito normalmente

### Botão WhatsApp na view (não-edição)
Na seção de informações do cliente (view mode), se `customer.phone` existir:

```
[ Cliente ]
  Cleide Maria
  (11) 99999-9999  [ WhatsApp ↗ ]
```

- Link `https://wa.me/55{phone}?text={mensagem}` em nova aba
- Mensagem pré-preenchida: "Olá, {nome}! Lembrando do seu agendamento de {serviço} em {data} às {hora} com {profissional}. Te esperamos! 🤍"
- Botão visível apenas se `customer.phone` preenchido; sem dependência de `evolutionStatus`

---

## Item C — Filtro unificado (chips) para Serviços, Pacotes e Promoções

**Arquivos afetados:**
- `src/components/domain/services/service-picker-with-categories.tsx`
- `src/components/domain/booking/service-step.tsx`
- `src/components/domain/scheduling/create-appointment-modal.tsx`

### Comportamento
A fileira de chips fica:
```
[ Todos ] [ Alisamento ] [ Corte ] [ Mechas ] [ Pacote ] [ Promoção ]
```

- Chips "Pacote" e "Promoção" só aparecem se o tenant tiver itens cadastrados
- Ao selecionar "Pacote": mostra cards de pacotes (imagem, nome, preços dos serviços somados, duração total)
- Ao selecionar "Promoção": mostra cards de promoções (nome, badge de desconto, serviços vinculados)
- "Todos" mostra tudo junto (serviços + pacotes + promoções intercalados por ordem de nome)

### Interface do picker
```typescript
type PickerItem =
  | { type: 'service'; id: string; name: string; price: number; duration: number; ... }
  | { type: 'package'; id: string; name: string; price: number; duration: number; services: string[] }
  | { type: 'promotion'; id: string; name: string; discountValue: number; discountType: string; services: PromotionService[] }

type Props = {
  services: PickerService[]
  packages?: PickerPackage[]
  promotions?: PickerPromotion[]
  categories: Category[]
  onSelect: (item: PickerItem) => void
}
```

### Impacto no `service-step.tsx` (vitrine pública)
- Remove as `<Tabs>` (Serviços | Pacotes | Promoções)
- Passa `services`, `packages`, `promotions` para o picker unificado
- O `onSelect` trata cada tipo: `type === 'service'` → `onSelect(service)`, `type === 'package'` → `onPackageSelect(pkg)`, `type === 'promotion'` → expande serviços vinculados

### Impacto no `create-appointment-modal.tsx` (agenda profissional)
- Adiciona `usePackages()` e `usePromotions()` 
- Passa ao picker unificado
- Seleção de pacote: `packageId = pkg.id`, `serviceId = null`, price = pkg.price, duração = soma dos serviços
- Seleção de promoção: expande os serviços da promoção para o usuário selecionar qual; ao escolher: `serviceId = s.id`, `promotionId = promo.id`, price = preço com desconto

---

## Item D — Textarea para descrição em Pacotes e Promoções

**Arquivos:**
- `src/components/domain/services/package-form-modal.tsx` (linha 106)
- `src/components/domain/services/promotion-form-modal.tsx` (linha 141)

Substituir `<Input>` de descrição por:
```tsx
<Textarea
  className="min-h-[80px] resize-none"
  placeholder="Descreva o que está incluído"
  maxLength={500}
  value={description}
  onChange={(e) => setDescription(e.target.value)}
/>
```

A vitrine já usa `whitespace-pre-line` ao exibir a descrição — nenhuma mudança necessária lá.

---

## Item E — Promoções disponíveis no agendamento profissional

Coberto pelo Item C. O `create-appointment-modal.tsx` passará a exibir promoções via picker unificado. O payload para `POST /api/scheduling/appointments` já suporta `promotionId` (campo existente no modelo).

---

## Item F — Bug das comissões: zoom mobile + campo bloqueado

**Arquivo:** `src/components/domain/settings/commissions-grid.tsx`

### Causa raiz
1. Input controlado (`value={getRate(...)}`) sem `onChange` → React bloqueia toda digitação
2. `text-xs` (12px) dispara zoom automático no iOS Safari (requer mínimo 16px)

### Fix
```typescript
// Estado local para valores em edição por célula
const [localValues, setLocalValues] = useState<Record<string, string>>({})

function getCellKey(serviceId: string, professionalId: string) {
  return `${serviceId}:${professionalId}`
}

function getCellValue(serviceId: string, professionalId: string): string {
  const key = getCellKey(serviceId, professionalId)
  return key in localValues ? localValues[key] : getRate(serviceId, professionalId)
}
```

No input:
```tsx
<Input
  type="number"
  value={getCellValue(s.id, p.id)}
  onChange={(e) => setLocalValues(prev => ({ ...prev, [getCellKey(s.id, p.id)]: e.target.value }))}
  onFocus={(e) => e.target.select()}
  onBlur={(e) => {
    handleRateChange(s.id, p.id, e.target.value)
    setLocalValues(prev => { const n = {...prev}; delete n[getCellKey(s.id, p.id)]; return n })
  }}
  style={{ fontSize: '16px' }}
  className="h-8 w-16 text-center"
/>
```

---

## Item G — Campo numérico com "0" preso

Mesmo padrão do Item F. O único caso identificado é o `CommissionsGrid`. O fix do Item F resolve completamente: o `onChange` local permite apagar o "0" e digitar livremente; o `onBlur` persiste apenas o valor final válido.

---

## Arquivos a modificar

| Arquivo | Itens |
|---------|-------|
| `src/components/domain/scheduling/appointment-card.tsx` | A |
| `src/components/domain/scheduling/appointment-drawer.tsx` | B |
| `src/components/domain/services/service-picker-with-categories.tsx` | C |
| `src/components/domain/booking/service-step.tsx` | C |
| `src/components/domain/scheduling/create-appointment-modal.tsx` | C, E |
| `src/components/domain/services/package-form-modal.tsx` | D |
| `src/components/domain/services/promotion-form-modal.tsx` | D |
| `src/components/domain/settings/commissions-grid.tsx` | F, G |

Nenhuma mudança de banco de dados ou API necessária — todas as alterações são de frontend.

---

## Critérios de aceite

- [ ] Card da agenda exibe: status → cliente → serviço → horário → botão (sem profissional)
- [ ] Drawer de edição aceita horário digitado livremente além dos chips
- [ ] Botão WhatsApp aparece na view do drawer quando cliente tem telefone
- [ ] Chips "Pacote" e "Promoção" aparecem no picker quando há itens cadastrados
- [ ] Vitrine pública não usa mais abas; chips unificados funcionam
- [ ] Modal de criação de agendamento permite agendar pacotes e promoções
- [ ] Descrição de pacote e promoção aceita quebra de linha
- [ ] Comissões: campo editável sem travar; sem zoom em iOS
- [ ] `npx tsc --noEmit` sem erros
