# Máscara de valores, zoom no mobile e foco de modal aninhado

**Data:** 2026-07-29
**Tipo:** correção de UX transversal (somente camada de UI)
**Escopo:** frontend. Sem mudança de schema, API ou contrato de domínio.

---

## Problema

Três defeitos independentes, todos na camada de entrada de dados:

1. **Campos de valor com `0` imutável.** Campos monetários usam
   `<Input type="number">` com estado numérico e `onChange={e => setX(Number(e.target.value))}`.
   Como `Number('') === 0`, apagar o conteúdo devolve `0` ao campo: o profissional
   nunca consegue esvaziá-lo e precisa digitar o valor *na frente* do zero. Não há
   máscara — o campo não mostra `R$ 90,00` enquanto se digita, então não há
   confirmação visual do valor que está sendo inserido.
2. **Zoom automático no mobile.** Ao focar certos campos (notadamente no fluxo de
   novo agendamento), o navegador aproxima a página e o layout parece quebrar.
3. **Modal de novo cliente sem foco.** Aberto de dentro do modal de agendamento,
   o modal de cliente não escurece nem desfoca o fundo. Os dois formulários ficam
   igualmente nítidos e o usuário não sabe em qual está operando.

## Causa raiz

1. Já existe `src/components/ui/currency-input.tsx` com máscara centavos-primeiro,
   mas é usado em apenas 3 telas (serviços, pacotes, promoções). As outras ~24
   entradas numéricas do app usam `<Input type="number">` cru. O componente
   existente também tem um bug próprio: `useState(() => valueToDisplay(value))`
   inicializa o display **uma vez só**, então atualizações vindas do pai
   (carregamento assíncrono em modal de edição, botão "Cortesia", sugestão de preço
   da ficha de anamnese) não se refletem no campo.
2. iOS e Android aplicam zoom ao focar campo com `font-size < 16px`. O `Input` base
   é `text-base md:text-sm` (16px no mobile, correto), mas overrides pontuais como
   `className="h-8 text-sm"` derrubam para 14px. Já existia um remendo pontual
   (`style={{ fontSize: '16px' }}` em `commissions-grid.tsx`), sinal de que o
   problema já tinha sido notado sem tratamento sistêmico.
3. `CreateCustomerModal` recebe `modal={false}` — workaround necessário para o bug
   do Radix em que dois Dialogs modais simultâneos deixam `aria-hidden` preso na
   raiz do app. Porém **o Radix retorna `null` no `DialogOverlay` quando
   `modal={false}`**: o backdrop deixa de existir por completo. Além disso o
   componente está renderizado *dentro* do `<DialogContent>` do agendamento, que é
   um container com `overflow-y-auto`.

## Decisões

| Questão | Decisão |
|---|---|
| Comportamento da máscara | `"R$ "` fixo à esquerda como adorno não-apagável; dígitos preenchem da direita para a esquerda, centavos primeiro |
| Campo obrigatório vazio | Vazio ≠ zero. Bloqueia o salvar. Zerar de propósito exige digitar `0` (ou usar Cortesia) |
| Zoom | Regra global de `font-size: 16px` para `input`/`textarea`/`select` abaixo de `md`. `maximum-scale` do viewport **não** é alterado — pinch-zoom manual permanece |

## Design

### Componentes base (`src/components/ui/`)

**`CurrencyInput`** (reescrito)

- Prefixo `R$` renderizado como `<span>` absoluto fora do `<input>` — impossível de
  apagar. O `<input>` recebe `padding-left` para acomodá-lo.
- Estado interno de display sincronizado com a prop `value` do pai: atualização
  externa reflete no campo, mas a digitação em curso não perde o cursor.
- Máscara centavos-primeiro: apenas dígitos são aceitos; `9` → `0,09`,
  `90` → `0,90`, `9000` → `90,00`.
- Apagar tudo deixa o campo **vazio** e emite `onChange('')`. Placeholder `0,00`
  esmaecido — nunca um `0` real.
- `inputMode="numeric"` (teclado numérico no celular).
- Teto de 12 dígitos, para não estourar o `Decimal` do Prisma.

**`PercentageInput`** (reescrito) — mesma arquitetura, sufixo `%` como adorno,
vazio permitido, faixa 0–100.

**`NumberInput`** (novo) — inteiros sem unidade monetária (quantidade, dias, ordem,
limites de plano). Estado string, campo totalmente limpável, sem `0` fantasma.

### Regra de zoom (`src/app/globals.css`)

```css
@media (max-width: 767px) {
  input, textarea, select { font-size: 16px; }
}
```

Remove também o `style={{ fontSize: '16px' }}` hardcoded em `commissions-grid.tsx`.
A maioria dos campos não muda de tamanho (já eram 16px no mobile); os poucos com
override sobem de 14px para 16px, que é exatamente o que elimina o zoom.

### Dialog aninhado (`src/components/ui/dialog.tsx`)

Nova prop `stacked` em `DialogContent`:

- Renderiza backdrop próprio (`bg-black/40` + `backdrop-blur-sm`), mais forte que o
  `bg-black/10` do overlay padrão, porque precisa vencer um modal já claro atrás.
- Sobe para `z-60`, garantindo ordem correta independente da ordem de montagem.
- Mantém `modal={false}` (o workaround do `aria-hidden` continua necessário), mas
  como isso desliga o *focus trap* do Radix, o modo `stacked` adiciona trap de
  foco e fechamento por `Esc` explícitos — senão o Tab escapa para o formulário de
  trás.

`CreateCustomerModal` sai de dentro do `<DialogContent>` do agendamento e passa a
ser irmão do `<Dialog>`.

## Inventário de campos

**Dinheiro → `CurrencyInput`**

| Arquivo | Campo |
|---|---|
| `scheduling/confirm-appointment-modal.tsx` | Valor a cobrar |
| `financial/register-payment-modal.tsx` | Valor do serviço, Desconto (R$), Gorjeta |
| `app/(app)/financeiro/despesas/page.tsx` | Valor (criar + editar) |
| `inventory/ProductFormModal.tsx` | Custo, Preço de venda |
| `inventory/StockPurchaseModal.tsx` | Preço unitário |
| `inventory/StockSaleModal.tsx` | Preço unitário |
| `settings/discount-types-manager.tsx` | Valor padrão — **híbrido** R$/% conforme o tipo |
| `app/(admin)/admin/planos/[planName]/page.tsx` | Preço mensal |
| `admin/catalog/CatalogServiceSheet.tsx` | Preço sugerido |
| `admin/catalog/CatalogProductSheet.tsx` | Preço sugerido |

**Percentual → `PercentageInput`**

`settings/card-fees-form.tsx` (débito, crédito);
`settings/commissions-grid.tsx` (célula da grade, aplicar em massa).

**Unidades → `NumberInput`**

`inventory/StockSaleModal.tsx`, `inventory/StockPurchaseModal.tsx`,
`inventory/AdjustStockModal.tsx` (quantidades);
`inventory/ProductFormModal.tsx` (estoque inicial, ajuste, alerta);
`admin/catalog/CatalogServiceSheet.tsx` (duração, ordem);
`admin/catalog/CatalogProductSheet.tsx` (ordem);
`admin/catalog/CategoryManagerPanel.tsx` (ordem);
`services/service-anamnese-config.tsx` (validade em dias);
`app/(admin)/admin/planos/[planName]/page.tsx` (dias de trial, limites).

**Fora do escopo, deliberadamente**

- `crm/filter-bar.tsx` (faixas min/max de filtro): vazio já significa "sem filtro"
  e o comportamento atual está correto.
- Duração HH:MM dos serviços (`service-form-modal.tsx`): formato próprio, já correto.

## Impacto nas telas consumidoras

Cada tela migrada troca o tipo do estado de `number` para `string` e ajusta a
validação de submit para exigir campo preenchido. É aí que mora o risco de
regressão — daí a cobertura de teste abaixo.

## Testes

- **Componentes:** máscara centavos-primeiro, prefixo não-apagável, campo esvaziável,
  sincronização com valor vindo do pai, teto de dígitos.
- **Telas:** para cada formulário migrado, "campo vazio bloqueia o envio" e
  "`0` explícito é aceito" (cortesia / desconto zerado).
- **Dialog:** modo `stacked` renderiza backdrop; `CreateCustomerModal` aberto sobre
  o de agendamento não deixa `aria-hidden` preso ao fechar.

## Não-objetivos

- Nenhuma mudança de schema, migration, API ou serviço de domínio.
- Nenhuma alteração no `viewport` (pinch-zoom do usuário preservado).
- Nenhum redesign visual além do adorno `R$`/`%` e dos 2px de fonte no mobile.
