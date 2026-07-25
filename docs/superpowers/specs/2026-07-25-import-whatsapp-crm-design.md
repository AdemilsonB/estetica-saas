# Import de contatos do WhatsApp como clientes do CRM — design aprovado

> Data: 2026-07-25 · Aprovado pelo usuário no chat (mockup ASCII) antes de qualquer React.

## Objetivo

A partir do WhatsApp conectado (Evolution API), o dono importa contatos como **clientes completos do CRM**,
com **etapa de revisão/edição antes de salvar** (dois requisitos firmes do usuário).

## Diagnóstico da base atual

Fluxo existente: `EvolutionContactsImport` (Configurações) → `GET /api/whatsapp/evolution/contacts` →
`POST /api/crm/contacts/import`. Fraquezas confirmadas no código:

1. Nome importado = `pushName` (nome que a própria pessoa escolheu — "😍 Lu", "Contato" para quem não tem).
2. Zero enriquecimento (só nome+telefone).
3. Dedup por string exata do telefone com DDI `55` — cliente manual "(11) 98765-4321" vira duplicado.
4. Inconsistente com o import de .vcf (PR #288), que salva telefone local sem DDI.
5. Import não respeita `featureGuard.assertWithinLimit` (o create manual respeita) — furo de billing.
6. Lógica de negócio dentro da API Route (loop de `prisma.customer.create`).
7. Recurso invisível para quem está no CRM (só em Configurações).

## Desenho

### Fluxo de UI (wizard de 2 passos, mobile-first)

- **Seletor de origem**: botão "Importar" da página Clientes abre escolha entre
  "WhatsApp conectado" (estado: conectado ✓ / CTA para conectar em Configurações) e
  "Agenda do celular / arquivo .vcf" (modal da PR #288). Um Dialog por vez (nunca aninhados —
  regra do projeto sobre Radix Dialog). Configurações mantém o atalho direto atual.
- **Passo 1 — Selecionar**: busca; foto do WhatsApp **apenas exibida** (`profilePicUrl` se o Evolution
  devolver; fallback iniciais; nunca persistida — Customer não tem campo de foto e não haverá migration);
  telefone formatado; badge "já no CRM" via dedup por variantes com/sem DDI; "Selecionar todos os novos";
  aviso ⚠ em nomes suspeitos (sem pushName / 1 caractere / só emoji).
- **Passo 2 — Revisar e enriquecer**: lista só dos selecionados; nome editável inline (pré-preenchido);
  barra "Aplicar a todos" (tags — com `whatsapp` sugerida e removível — e VIP); cada card expande para
  campos individuais (e-mail, nascimento, nota, tags, VIP); rodapé fixo com aviso LGPD
  ("importados sem consentimento de marketing — registrado quando o cliente aceitar no portal");
  botão "Salvar N clientes". Dialog com `max-h` + `overflow-y-auto` + rodapé sticky.
- **Concluído**: contagem criados/já existentes + "Importar mais".

### Backend

- `customerService.importCustomers(tenantId, input, origin)` (nova, no service — camadas corretas):
  - valida payload rico (Zod em `domains/crm/types.ts`): `name`, `phone`, `email?`, `birthDate?`,
    `notes?`, `tags[]`, `isVip?`; array 1..500.
  - normaliza telefone com `normalizeImportedPhone` (sem DDI — unifica com o .vcf da PR #288);
  - dedup contra o banco com `buildPreviewPhoneVariants` (casa clientes gravados com ou sem `55`)
    e dedup interno do lote;
  - **respeita o limite do plano**: `assertWithinLimit(tenantId, 'customers', count + novos - 1)`;
  - cria com `consentGiven: false`, `consentDate: null`, `consentOrigin: origin` (`"whatsapp_import"`);
  - publica `crm.customer.created` por cliente criado (hoje o import não publica — o motor de
    notificações não fica sabendo);
  - retorno `{ created, skipped, errors }`.
- `POST /api/crm/contacts/import` vira controller fino (sessão + `customers.create` +
  gate `WHATSAPP_BASIC` + Zod + service). Mesmo path (o hook existente já o usa).
- `GET /api/whatsapp/evolution/contacts`: passa a devolver `phone` **normalizado local**,
  `profilePicUrl?` (passthrough do Evolution, tipado opcional no provider) e `inCrm` calculado
  com variantes com/sem DDI.
- `tenantId` sempre da sessão; nenhum campo de tenant no body.

### Fora de escopo (YAGNI)

Persistir foto (migration + risco de acoplamento a query de sessão), histórico de conversas,
disparo de mensagem pós-import, grupos, app nativo.

## Testes

- `customer.service.import.test.ts`: criação com campos ricos + consent/origin; skip de existente
  gravado com e sem DDI; dedup interno do lote; limite do plano estourado → `PlanLimitError` sem criar nada;
  erro pontual não derruba o lote (`errors[]`); evento publicado por criado.
- `phone.test.ts`: formatação BR (11/10 dígitos, fallback).
- Gates: `tsc --noEmit` 0 erros; `vitest run` sem regressões (4 falhas pré-existentes conhecidas).

## Decisões registradas

- Telefone salvo **sem DDI 55** (consistência com .vcf e cadastro manual típico).
- Foto de WhatsApp é efêmera (só na sessão de import, nunca no banco).
- Modal (não página dedicada) — padrão do app; página só se surgir demanda de centenas com edição pesada.
- `consentGiven` nunca é marcado pelo import — postura LGPD conservadora já existente, mantida.
