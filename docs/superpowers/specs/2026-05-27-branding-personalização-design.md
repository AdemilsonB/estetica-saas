# Design: Personalização de Marca (Branding)

**Data:** 2026-05-27
**Status:** Aprovado
**Escopo:** Permitir que cada tenant personalize a identidade visual do sistema — logo, cores, fonte, border-radius e modo de cor — com passo opcional no onboarding e aba dedicada nas configurações.

---

## Contexto

O sistema atual usa cores e tipografia fixas (`#191919`, Inter, fundo `#f8f8f7`). Negócios de estética têm identidade visual própria e esperam que o sistema reflita a marca deles. A personalização aumenta a percepção de valor e a adoção diária da plataforma.

O onboarding hoje coleta apenas nome do negócio e nome do usuário em tela única. O branding é adicionado como seção opcional na mesma tela (sem torná-la obrigatória). A configuração completa fica disponível permanentemente em Configurações → Layout.

---

## Decisões de arquitetura

### Abordagem: CSS Custom Properties injetadas via SSR

O `(app)/layout.tsx` (Server Component) busca o `BrandingConfig` do tenant, serializa os valores em CSS custom properties e injeta um `<style>` tag no `<head>` antes de qualquer JS rodar no cliente.

- **Zero flash de cor** — o HTML já chega com as variáveis corretas
- **Zero re-render de componentes** — nenhum provider React necessário
- **Compatível com Shadcn** — os tokens `--primary`, `--background`, `--radius` já existem em `globals.css`; a injeção simplesmente os sobrescreve
- **Cache:** query de branding cacheada com `unstable_cache`, invalidada no `PUT /api/iam/branding`

### Prévia ao vivo (client-side)

Na aba de configurações, alterações são refletidas instantaneamente via `document.documentElement.style.setProperty()` sem salvar no banco. O save só persiste ao clicar em "Salvar alterações".

### Domínio

Branding pertence ao domínio `iam` — é configuração de identidade do tenant. `BrandingRepository` e `BrandingService` vivem em `src/domains/iam/`.

---

## Modelo de dados

```prisma
model BrandingConfig {
  id              String   @id @default(cuid())
  tenantId        String   @unique
  tenant          Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  logoUrl         String?
  primaryColor    String   @default("#191919")
  secondaryColor  String   @default("#6366f1")
  accentColor     String   @default("#f59e0b")
  backgroundColor String   @default("#f8f8f7")
  fontFamily      String   @default("inter")    // inter | manrope | geist | dm-sans | plus-jakarta-sans | lato
  borderRadius    String   @default("medium")   // none | medium | full
  colorScheme     String   @default("light")    // light | dark

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([tenantId])
}
```

`BrandingConfig` é criado automaticamente com valores padrão na transação de registro do tenant (`POST /api/iam/register`).

---

## CSS Variables — mapeamento

```css
/* gerado por buildCssVariables(config: BrandingConfig) */
:root {
  --primary:            <R G B>;   /* cor primária em RGB sem vírgula — padrão Shadcn */
  --primary-foreground: <R G B>;   /* calculado: branco ou preto por luminância relativa (WCAG AA) */
  --secondary:          <R G B>;
  --secondary-foreground: <R G B>;
  --accent:             <R G B>;
  --accent-foreground:  <R G B>;
  --background:         <R G B>;
  --foreground:         <R G B>;   /* calculado contra background */
  --radius:             0rem | 0.5rem | 1rem;   /* none | medium | full */
  --font-sans:          'Inter' | 'Manrope' | ... , sans-serif;
}
```

Quando `colorScheme = "dark"`, adiciona `class="dark"` no `<html>` e as variáveis de fundo/texto são sobrescritas pelos valores dark do Shadcn.

**Contraste automático:** `buildCssVariables` calcula `--primary-foreground` usando luminância relativa (fórmula WCAG 2.1). Se o contraste calculado for inferior a 4.5:1, a aba de configurações exibe um aviso amarelo — não bloqueia o save.

---

## Fontes disponíveis

| Slug | Nome exibido |
|---|---|
| `inter` | Inter |
| `manrope` | Manrope |
| `geist` | Geist |
| `dm-sans` | DM Sans |
| `plus-jakarta-sans` | Plus Jakarta Sans |
| `lato` | Lato |

Todas carregadas via `next/font/google` (auto-hospedadas em build time — sem requisição ao Google em runtime). O layout carrega todas as fontes com `display: swap`; apenas a fonte ativa do tenant é aplicada via `--font-sans`.

---

## Upload de logo

- Bucket Supabase Storage: `logos`
- Path: `{tenantId}/logo` (sobrescreve ao trocar)
- Formatos aceitos: PNG, JPG, SVG
- Tamanho máximo: 2MB
- Upload via `POST /api/iam/branding/logo` (multipart/form-data) **antes** do save principal
- A rota retorna `{ logoUrl: string }` que é incluído no body do PUT subsequente
- Preview local via `URL.createObjectURL()` antes do upload

---

## API Routes

### Existente — modificada

```
POST /api/iam/register
```
Recebe `branding?: { logoUrl?, primaryColor?, backgroundColor? }` opcional no body.
Se presente, persiste no `BrandingConfig` criado na transação. Se ausente, usa defaults.

### Novas

```
GET  /api/iam/branding          → retorna BrandingConfig do tenant (usado pelo form client-side)
PUT  /api/iam/branding          → atualiza config completa + invalida cache SSR
POST /api/iam/branding/logo     → upload de logo para Supabase Storage, retorna { logoUrl }
```

Todas as rotas extraem `tenantId` do token via `withTenant(req)`. Permissão: `settings:edit` (OWNER e MANAGER).

---

## Onboarding — passo de branding (opcional)

Adicionado à tela `/onboarding` no modo `create`, abaixo do formulário existente, separado por divisor.

**Campos exibidos no onboarding:**
- Logo (upload opcional)
- Cor principal (`<input type="color">` nativo + preview hex)
- Cor de fundo (`<input type="color">` nativo + preview hex)

**Mensagem ao final da seção:**
> "💡 Mais opções de personalização em Configurações → Layout"

**Comportamento:**
- Todos os campos são opcionais; o botão "Começar →" não é bloqueado
- Upload de logo ocorre antes do submit do formulário principal
- Os valores são enviados no body do `POST /api/iam/register`

---

## Configurações → aba "Layout"

Nova quinta aba na página `/configuracoes`. O `TabsList` passa de `grid-cols-4` para `grid-cols-5`.

**Seções da aba:**
1. **Identidade visual** — logo (preview + trocar + remover)
2. **Cores** — cor primária, secundária, accent, fundo (cada um com `<input type="color">` + campo hex editável + aviso de contraste se aplicável)
3. **Tipografia** — select com as 6 fontes curadas
4. **Forma dos elementos** — radio group: Sem arredondamento / Médio / Totalmente arredondado
5. **Modo de cor** — toggle Claro / Escuro

**Prévia ao vivo:** cada alteração atualiza os CSS custom properties no DOM imediatamente via `style.setProperty`.

**Save:** botão "Salvar alterações" dispara `PUT /api/iam/branding`, invalida o cache SSR. Toast de sucesso/erro.

**Permissão:** `settings:edit` — roles OWNER e MANAGER.

---

## Fluxo completo de save (configurações)

```
1. Usuário altera valor → preview ao vivo (CSS var no DOM, sem request)
2. Clica "Salvar alterações"
   a. Se logo foi alterado → POST /api/iam/branding/logo → { logoUrl }
   b. PUT /api/iam/branding { primaryColor, secondaryColor, accentColor,
                              backgroundColor, fontFamily, borderRadius,
                              colorScheme, logoUrl? }
   c. Cache SSR invalidado
3. Próximo carregamento de página → layout.tsx injeta variáveis atualizadas
```

---

## Fluxo de register com branding (onboarding)

```
POST /api/iam/register {
  businessName: string,
  userName: string,
  branding?: {
    logoUrl?: string,         // já uploadado
    primaryColor?: string,    // hex
    backgroundColor?: string  // hex
  }
}

Prisma transaction:
  1. create Tenant
  2. create User (OWNER)
  3. create BrandingConfig (valores do body || defaults)
  4. update app_metadata do Supabase Auth
```

---

## Evento de domínio

```typescript
// publicado após PUT /api/iam/branding
{
  type: 'tenant.branding.updated',
  payload: { tenantId, changes: Partial<BrandingConfig> }
}
```

Reservado para automações futuras (ex: regenerar página pública de booking).

---

## Arquivos a criar / modificar

### Novos
```
prisma/migrations/XXXX_add_branding_config/
src/domains/iam/branding.repository.ts
src/domains/iam/branding.service.ts
src/domains/iam/branding.schemas.ts
src/app/api/iam/branding/route.ts          (GET + PUT)
src/app/api/iam/branding/logo/route.ts     (POST)
src/lib/branding/build-css-variables.ts    (serializer + contraste)
src/components/domain/settings/branding-form.tsx
```

### Modificados
```
prisma/schema.prisma                        (novo model BrandingConfig)
src/app/(app)/layout.tsx                    (injeção SSR do <style>)
src/app/(auth)/onboarding/page.tsx          (seção de branding opcional)
src/app/(app)/configuracoes/page.tsx        (nova aba Layout)
src/app/api/iam/register/route.ts           (aceita branding? no body)
src/domains/iam/register.service.ts         (cria BrandingConfig na transação)
```

---

## Checklist de entrega

- [ ] Migration Prisma com `BrandingConfig`
- [ ] `BrandingRepository` com filtro de `tenantId`
- [ ] `BrandingService` com create (defaults) e update
- [ ] `buildCssVariables` com cálculo de contraste WCAG AA
- [ ] Injeção SSR no `(app)/layout.tsx` com `unstable_cache`
- [ ] API Routes GET + PUT `/api/iam/branding`
- [ ] API Route POST `/api/iam/branding/logo`
- [ ] `POST /api/iam/register` aceita `branding?` opcional
- [ ] Onboarding: seção de branding opcional + mensagem de redirect
- [ ] Configurações: aba Layout com prévia ao vivo
- [ ] `npx tsc --noEmit` zero erros
- [ ] `npx vitest run` todos passando
