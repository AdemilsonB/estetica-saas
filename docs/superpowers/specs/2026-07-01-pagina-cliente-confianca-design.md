# Página do cliente — confiança do cliente final (WhatsApp, Instagram, Google)

**Data:** 2026-07-01
**Autor:** Claude (especialista da página do cliente) + Ademilson
**Status:** Aprovado para plano

---

## 1. Objetivo

Aumentar a **confiança do cliente final** com o estabelecimento na página pública
(vitrine `/[slug]` e portal `/[slug]/cliente`), atacando três lacunas:

1. **WhatsApp** — não há um canal de contato direto confiável e fácil de configurar; hoje ele
   está acoplado a um recurso pago e mora numa tela separada do Instagram.
2. **Instagram** — o ícone está apagado (cinza), sem a identidade da marca, passando pouca vida.
3. **Google** — só existe um link de rota; falta localização visual e prova social.

---

## 2. Diagnóstico (estado atual)

- O botão de contato WhatsApp na vitrine só aparece quando `tenant.whatsappEnabled === true`
  (`vitrine-hero.tsx:81-82`, `[slug]/page.tsx:146`). Esse mesmo campo é a flag da **automação de
  WhatsApp** (Evolution API / lembretes), travada por plano e configurada na seção de notificações
  (`whatsapp-settings-form.tsx:66`). Resultado: para exibir um simples "fale conosco" (recurso de
  confiança, gratuito), o dono precisa ativar um recurso pago em outro lugar → o "configurar em cada
  lugar" relatado.
- O Instagram é configurado no form "Página pública" (`public-page-form.tsx`), mas o WhatsApp aparece
  ali apenas como preview readonly. Falta simetria e centralização.
- `InstagramIcon` usa `fill="currentColor"` e é renderizado em cinza (`text-muted-foreground`) no
  header sem banner (`vitrine-hero.tsx:215`). Sem gradiente da marca.
- `VitrineLocationBlock` (`vitrine-location-block.tsx`) é só um botão de rota via `openRoute`
  (`maps-route.ts`). Não há mapa embutido, link do perfil Google, nem nota/avaliações.

---

## 3. Escopo

### A. WhatsApp centralizado (desacoplar da automação)

- Novo campo `whatsappContactEnabled` no Tenant — **independente** de `whatsappEnabled` (automação).
- Configurável no form "Página pública", **junto** do Instagram, numa subseção "Contato e redes".
  O link é derivado do telefone de "Dados do negócio" (`wa.me/55<phone>`), então continua sendo uma
  única fonte de verdade para o telefone.
- Migração aditiva com `@default(true)`: negócios com telefone passam a exibir o contato WhatsApp
  imediatamente (resolve a queixa). Quem não usa WhatsApp no telefone cadastrado desliga o toggle.
- A automação (`whatsappEnabled`) permanece intacta e sem relação com este campo.
- Todos os pontos que hoje derivam o botão de `whatsappEnabled` passam a usar `whatsappContactEnabled`:
  - `[slug]/page.tsx` (hero + CTA fixo mobile + `PublicMenuDrawer`)
  - `[slug]/cliente/page.tsx` (`whatsappUrl` do portal)
  - `vitrine-hero.tsx`, `public-menu-drawer.tsx`

### B. Instagram + WhatsApp com cor de marca

- `InstagramIcon` ganha variante com **gradiente oficial** (roxo→rosa→laranja) via
  `<linearGradient>` embutido no SVG, aplicada ao próprio glyph (não um bloco sólido "app icon",
  para não brigar com a estética warm do Agendê).
- Ícone do WhatsApp usa o verde de marca `#25D366`.
- Aplicar nos dois headers da vitrine (com e sem banner) e manter o botão grande de WhatsApp.
- **Antes de codar**, apresentar 2 variações de destaque em ASCII no chat para o usuário escolher o
  nível (glyph com gradiente circular vs. leve realce de fundo). Regra de memória: mockup literal
  antes de tocar em componente de UI.

### C. Google (keyless + selo de nota atrás de flag)

Evoluir `VitrineLocationBlock` para um card de **Localização** reutilizável na vitrine e no portal
`/cliente`:

- **Mapa embutido** — iframe keyless via `https://www.google.com/maps?q=<endereço>&output=embed`.
  Sem chave, sem custo. Só renderiza se houver `address`.
- **Rota** — reusa `openRoute` (comportamento atual, iOS→Apple Maps / demais→Google Maps).
- **Ver no Google** — botão que abre `googleBusinessUrl` (o link colado pelo dono) em nova aba;
  leva ao perfil real do negócio no Google (avaliações, fotos). Só aparece se preenchido.
- **Selo de nota (atrás de flag)** — quando `GOOGLE_PLACES_API_KEY` estiver definida:
  - Ao salvar `googleBusinessUrl`, o backend resolve o `googlePlaceId` (via Places API
    Find Place From Text usando a URL/nome, ou extração do CID quando presente na URL) e persiste.
  - Um helper server-side com cache (alinhado ao `revalidate` de 5min do SSR) busca
    `rating` + `userRatingCount` via Place Details e exibe um selo compacto:
    `⭐ 4,8 · 214 avaliações`, com atribuição ao Google conforme display policy.
  - Sem a chave: `googlePlaceId` permanece `null`, nenhuma chamada é feita, nenhum selo aparece —
    exatamente o comportamento keyless. Ligar a chave depois acende o selo sem nova sessão de dev.

---

## 4. Modelo de dados

```prisma
// model Tenant — campos aditivos
whatsappContactEnabled Boolean @default(true)  // contato público; ≠ whatsappEnabled (automação)
googleBusinessUrl      String?                  // link do perfil no Google Maps (colado pelo dono)
googlePlaceId          String?                  // resolvido só quando GOOGLE_PLACES_API_KEY existe
```

Migração **aditiva** (sem drop/alteração destrutiva). Adicionar os campos ao `select` de
`findTenantBySlug` (`public-booking.repository.ts`) e à API `public/[slug]/route.ts`.

---

## 5. Validação (Zod)

Em `updateTenantSchema` (`api/iam/tenant/route.ts`) e no schema de domínio correspondente:

```ts
whatsappContactEnabled: z.boolean().optional(),
googleBusinessUrl: z
  .string()
  .trim()
  .url()
  .max(500)
  .refine((u) => /(google\.[^/]+\/maps|g\.co|maps\.app\.goo\.gl|goo\.gl\/maps)/i.test(u), {
    message: 'Informe um link válido do Google Maps.',
  })
  .nullable()
  .optional(),
```

`updateTenant` (service + repository de IAM) passa a aceitar os novos campos.
Quando `GOOGLE_PLACES_API_KEY` existe e `googleBusinessUrl` muda, o service dispara a resolução do
`googlePlaceId` (falha na resolução não bloqueia o save — apenas deixa `googlePlaceId` null e loga).

---

## 6. Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `prisma/schema.prisma` + migration | 3 campos aditivos |
| `domains/iam/schemas.ts` / `iam.service.ts` / `iam.repository.ts` | aceitar novos campos + resolução opcional do placeId |
| `api/iam/tenant/route.ts` | validação Zod dos novos campos |
| `components/domain/settings/public-page-form.tsx` | subseção "Contato e redes": toggle WhatsApp + campo Google, centralizados |
| `components/domain/vitrine/vitrine-icons.tsx` | Instagram com gradiente |
| `components/domain/vitrine/vitrine-hero.tsx` | usar `whatsappContactEnabled`; ícones de marca |
| `components/domain/vitrine/public-menu-drawer.tsx` | usar `whatsappContactEnabled` |
| `components/domain/vitrine/vitrine-location-block.tsx` | evoluir para card: mapa embed + rota + Ver no Google + selo |
| `app/(public)/[slug]/page.tsx` | props novas; CTA fixo mobile usa `whatsappContactEnabled` |
| `app/(public)/[slug]/cliente/page.tsx` + `customer-history-client.tsx` | `whatsappUrl` via novo flag; incluir card de localização |
| `domains/scheduling/public-booking.repository.ts` | novos campos no select |
| `api/public/[slug]/route.ts` | expor novos campos |
| `shared/config/env.ts` | `GOOGLE_PLACES_API_KEY` opcional |
| `lib/google-places.ts` (novo) | helper server-side: resolver placeId + buscar rating (cacheado, gated) |

---

## 7. Testes

- **Schema/validação:** `googleBusinessUrl` aceita URLs válidas do Google e rejeita outras;
  `whatsappContactEnabled` booleano opcional.
- **Service IAM:** `updateTenant` persiste novos campos; com flag off não resolve placeId; com flag on
  (mock do helper) resolve e persiste; falha na resolução não quebra o save.
- **google-places helper:** parsing/normalização de URL; sem chave → retorna null sem chamar rede
  (mock fetch); com chave → mapeia rating/contagem.
- **Componente location:** renderiza mapa quando há endereço; botão "Ver no Google" só com URL;
  selo só quando há placeId+rating.
- **Vitrine hero:** botão WhatsApp aparece com `whatsappContactEnabled=true`+phone e some sem.

---

## 8. Fora de escopo / futuro

- **Listar avaliações completas** do Google (texto dos reviews) — display policy mais estrita;
  fica para depois. O "Ver no Google" já cobre isso levando ao perfil.
- **Autocomplete/busca por nome** do negócio para vincular Google — hoje o dono cola o link.
- Ativar a Places API em produção (criar projeto Google Cloud, habilitar Places + faturamento,
  definir `GOOGLE_PLACES_API_KEY` no Vercel) — operacional, do usuário. Até lá o selo fica dormente.

---

## 9. Riscos

- **Display policy do Google:** ao exibir a nota, mostrar atribuição ao Google e não modificar os
  dados; respeitar o cache curto. Mitigado por manter o selo simples (nota + contagem) e gated.
- **URL de Maps sem Place ID resolvível:** links encurtados (`maps.app.goo.gl`) podem exigir
  Find Place From Text (custo extra). Mitigado: resolução só roda com a chave ativa e falha silenciosa.
- **Iframe keyless de embed:** é uma URL não oficialmente documentada; risco baixo de quebra.
  Mitigado por degradar para o botão de rota caso o iframe falhe.
